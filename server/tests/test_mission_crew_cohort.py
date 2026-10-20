"""Signed roster continuity without names, operational memberships or Beta credit."""
import copy
import json
import pytest
from server import crew, storage
from server.portable import sign
from server.tests.test_api import client
from server.tests.test_crew import shared, visible
from server.tests.test_hardening import KEY
from server.tests.test_portable_browser import browser_json
from server.tests.test_portable_crew import beta_state


def snapshot():
    with storage.connect() as db:
        return list(db.iterdump())


def complete(c, issued, stamp):
    cid = issued['id']
    headers = [{'X-VYUHA-Crew-Token': m['code']} for m in issued['members']]
    r = c.post(f'/api/v1/crews/{cid}/control', json=dict(command_id='resume-'+cid, type='resume', payload={}))
    assert r.status_code == 200, r.text
    for _ in range(50):
        state = c.get(f'/api/v1/crews/{cid}/state', headers=headers[0]).json()
        if state['contacts']:
            break
        stamp[0] += .5
    track = state['contacts'][0]['id']
    for role, body in [(0, dict(k='designate')), (1, dict(k='classify', kind='quad', identity='hostile')), (1, dict(k='engage', effector='hold'))]:
        r = c.post(f'/api/v1/crews/{cid}/actions', headers=headers[role], json=dict(request_id=body['k'], track=track, **body))
        assert r.status_code == 200, r.text
        stamp[0] += .1
    r = c.post(f'/api/v1/crews/{cid}/complete', json={})
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture
def cohort_bundle(shared, monkeypatch):
    monkeypatch.setenv('VYUHA_BUNDLE_SECRET', KEY)
    c = shared['client']
    issued = [shared['issued']]
    cards = {issued[0]['session_id']: complete(c, issued[0], shared['stamp'])}
    for index in range(2):
        # Case and input order do not change the local declared roster identity.
        r = c.post('/api/v1/crews', json=dict(name='Shared QA', scenario_id=shared['scenario']['id'], members=[dict(callsign='resp', role='responder'), dict(callsign='watch', role='spotter')]))
        assert r.status_code == 201, r.text
        item = r.json(); issued.append(item)
        # Roles follow creation input order: reverse to spotter then responder.
        item['members'].reverse()
        cards[item['session_id']] = complete(c, item, shared['stamp'])
    before = snapshot()
    r = c.post('/api/v1/units/local/bundle/export', json={})
    assert r.status_code == 200, r.text
    assert snapshot() == before
    return dict(bundle=browser_json(r.json()), issued=issued, cards=cards)


def test_three_exercise_cohort_survives_signed_browser_import_forwarding_and_readonly_history(client, cohort_bundle, monkeypatch, tmp_path):
    source = cohort_bundle; bundle = source['bundle']; entries = bundle['payload']['sessions']
    assert len({e['shared_crew']['cohort']['id'] for e in entries}) == 1
    assert len({e['shared_crew']['id'] for e in entries}) == 3
    assert len({tuple(sorted(m['id'] for m in e['shared_crew']['cohort']['members'])) for e in entries}) == 1
    serialized = json.dumps(bundle)
    assert all(m['code'] not in serialized and json.dumps(m['callsign']) not in serialized for i in source['issued'] for m in i['members'])
    assert 'Shared QA' not in serialized and 'token_hash' not in serialized
    before = snapshot()
    r = client.post('/api/v1/bundle/import', json=bundle)
    assert r.status_code == 200 and r.json()['skipped_sessions'] == 3, r.text
    assert snapshot() == before
    monkeypatch.setattr(storage, 'DB_PATH', tmp_path/'recipient.db'); storage.init()
    assert client.post('/api/v1/bundle/import', json=bundle).status_code == 200
    before = snapshot()
    for _ in range(3):
        history = client.get('/api/v1/crews/history').json()
        assert history['included_sessions'] == 3 and [g['session_count'] for g in history['groups']] == [3]
        group = history['groups'][0]
        assert group['grouping_basis'] == 'Signed pseudonymous source roster cohort'
        assert sorted(m['accepted_actions'] for m in group['members']) == [3, 6]
        assert len(group['members']) == 2
        for session in history['sessions']:
            assert session['scorecard'] == source['cards'][session['session_id']]
            assert session['coordination_metrics']['attributed_actions'] == 3
            assert client.get('/api/v1/sessions/'+session['session_id']+'/aar').json()['scorecard'] == session['scorecard']
    assert snapshot() == before and beta_state() == ([], [])
    with storage.connect() as db:
        assert db.execute('SELECT COUNT(*) FROM crew_members').fetchone()[0] == 0
        assert db.execute('SELECT COUNT(*) FROM crews').fetchone()[0] == 0
    assert client.post('/api/v1/bundle/import', json=bundle).json()['skipped_sessions'] == 3
    assert snapshot() == before
    forwarded = client.post('/api/v1/units/'+bundle['payload']['unit']['id']+'/bundle/export', json={}).json()
    assert browser_json(forwarded)['payload'] == bundle['payload']
    assert snapshot() == before
    # Old role capabilities grant neither archived AAR nor a live restored crew.
    officer = dict(client.headers); client.headers.clear()
    for issued in source['issued']:
        headers = {'X-VYUHA-Crew-Token': issued['members'][0]['code']}
        assert client.get('/api/v1/sessions/'+issued['session_id']+'/aar', headers=headers).status_code == 401
        assert client.get('/api/v1/crews/'+issued['id']+'/state', headers=headers).status_code == 404
    client.headers.update(officer)


@pytest.mark.parametrize('mutation', ['unversioned', 'missing', 'legacy_binding', 'extra', 'duplicate_member', 'duplicate_ref', 'foreign_member', 'role_collision', 'cohort_roster', 'id_format', 'boolean_version', 'float_version', 'archive_float_version', 'unit_scope'])
def test_invalid_signed_cohort_is_rejected_before_any_write(client, cohort_bundle, mutation):
    p = copy.deepcopy(cohort_bundle['bundle']['payload']); meta = p['sessions'][0]['shared_crew']; binding = meta['cohort']
    if mutation == 'unversioned': binding['version'] = 2
    elif mutation == 'missing': meta.pop('cohort')
    elif mutation == 'legacy_binding': meta['version'] = 1
    elif mutation == 'extra': binding['callsign'] = 'PRIVATE'
    elif mutation == 'duplicate_member': binding['members'][1]['id'] = binding['members'][0]['id']
    elif mutation == 'duplicate_ref': binding['members'][1]['member_id'] = binding['members'][0]['member_id']
    elif mutation == 'foreign_member': binding['members'][0]['member_id'] = 'CM_'+'0'*20
    elif mutation == 'role_collision':
        # Still individually schema-valid, but contradicts peers in same cohort.
        for m in meta['members']: m['role'] = 'responder' if m['role'] == 'spotter' else 'spotter'
        for a in meta['attribution']: a['role'] = 'responder' if a['role'] == 'spotter' else 'spotter'
    elif mutation == 'cohort_roster': binding['members'][0]['id'] = 'CCM_'+'0'*20
    elif mutation == 'boolean_version': binding['version'] = True
    elif mutation == 'float_version': binding['version'] = 1.0
    elif mutation == 'archive_float_version': meta['version'] = 2.0
    elif mutation == 'unit_scope': binding['unit_id'] = 'U_'+'0'*20
    else: binding['id'] = 'CC_private'
    before = snapshot()
    r = client.post('/api/v1/bundle/import', json=sign(p, KEY.encode()))
    assert r.status_code == 422, r.text
    assert snapshot() == before


def test_unsigned_cohort_tamper_fails_integrity(client, cohort_bundle):
    bundle = copy.deepcopy(cohort_bundle['bundle'])
    bundle['payload']['sessions'][0]['shared_crew']['cohort']['id'] = 'CC_'+'0'*20
    before = snapshot(); r = client.post('/api/v1/bundle/import', json=bundle)
    assert r.status_code == 422 and 'integrity' in r.text
    assert snapshot() == before


def test_cohort_conflict_against_previous_archive_rolls_back(client, cohort_bundle, monkeypatch, tmp_path):
    p = copy.deepcopy(cohort_bundle['bundle']['payload'])
    monkeypatch.setattr(storage, 'DB_PATH', tmp_path/'conflict.db'); storage.init()
    first = copy.deepcopy(p); first['sessions'] = p['sessions'][:1]
    assert client.post('/api/v1/bundle/import', json=sign(first, KEY.encode())).status_code == 200
    p['sessions'] = p['sessions'][1:]
    for e in p['sessions']:
        for m in e['shared_crew']['cohort']['members']: m['id'] = 'CCM_' + ('a' if m['id'][-1] != 'a' else 'b') + m['id'][5:]
    before = snapshot(); r = client.post('/api/v1/bundle/import', json=sign(p, KEY.encode()))
    assert r.status_code == 409 and 'cohort' in r.text.lower(), r.text
    assert snapshot() == before


def test_legacy_archives_forward_unchanged_and_do_not_infer_roster_continuity(client, cohort_bundle, monkeypatch, tmp_path):
    p = copy.deepcopy(cohort_bundle['bundle']['payload'])
    for e in p['sessions']:
        e['shared_crew']['version'] = 1; e['shared_crew'].pop('cohort')
    legacy = sign(p, KEY.encode())
    # Legacy source duplicate compatibility does not replace modern bindings.
    before = snapshot(); r = client.post('/api/v1/bundle/import', json=legacy)
    assert r.status_code == 200 and r.json()['skipped_sessions'] == 3, r.text
    assert snapshot() == before
    monkeypatch.setattr(storage, 'DB_PATH', tmp_path/'legacy.db'); storage.init()
    assert client.post('/api/v1/bundle/import', json=legacy).status_code == 200
    before = snapshot(); history = client.get('/api/v1/crews/history').json()
    assert sorted(g['session_count'] for g in history['groups']) == [1, 1, 1]
    assert all('Legacy archive' in g['grouping_basis'] for g in history['groups'])
    exported = client.post('/api/v1/units/'+p['unit']['id']+'/bundle/export', json={}).json()
    assert browser_json(exported)['payload'] == p
    assert client.post('/api/v1/bundle/import', json=legacy).json()['skipped_sessions'] == 3
    # A later v2 assertion cannot silently alter immutable legacy metadata.
    r = client.post('/api/v1/bundle/import', json=cohort_bundle['bundle'])
    assert r.status_code == 409, r.text
    assert snapshot() == before


@pytest.mark.parametrize('change', ['name', 'role', 'roster', 'origin', 'unit'])
def test_cohort_binding_is_scoped_to_exact_declared_roster_unit_and_installation(client, cohort_bundle, change):
    from server.portable_crew import shared_metadata
    original = cohort_bundle['bundle']['payload']['sessions'][0]
    sid = original['id']
    before = snapshot()
    with storage.connect() as db:
        if change == 'origin':
            nonce=db.execute('SELECT nonce FROM transfer_origin WHERE singleton=1').fetchone()[0]
            db.execute("UPDATE transfer_origin SET nonce='another-installation' WHERE singleton=1")
            db.commit()
            new = shared_metadata(db, sid, KEY.encode())
        elif change == 'unit':
            db.execute("UPDATE sessions SET unit_id='other-unit' WHERE id=?", (sid,))
            new = shared_metadata(db, sid, KEY.encode())
        else:
            members = [dict(callsign='WATCH', role='spotter'), dict(callsign='RESP', role='responder')]
            name = 'Shared QA'
            if change == 'name': name = 'Different crew'
            elif change == 'role':
                for m in members: m['role'] = 'responder' if m['role'] == 'spotter' else 'spotter'
            else: members[0]['callsign'] = 'ANOTHER-WATCH'
            # No exercise mutation: derive the new binding from a distinct crew.
            db.rollback()
            r = client.post('/api/v1/crews', json=dict(name=name, scenario_id=original['scenario']['id'], members=members))
            assert r.status_code == 201, r.text
            new = shared_metadata(db, r.json()['session_id'], KEY.encode())
        assert new['cohort']['id'] != original['shared_crew']['cohort']['id']
        assert {m['id'] for m in new['cohort']['members']}.isdisjoint(m['id'] for m in original['shared_crew']['cohort']['members'])
        if change == 'origin':
            db.execute('UPDATE transfer_origin SET nonce=? WHERE singleton=1',(nonce,));db.commit()
        elif change == 'unit': db.rollback()
    if change in ['origin', 'unit']: assert snapshot() == before


def test_bound_archives_are_separate_from_same_labels_local_and_unbound_legacy(client, cohort_bundle, monkeypatch, tmp_path):
    bundle = cohort_bundle['bundle']; p = copy.deepcopy(bundle['payload'])
    legacy = copy.deepcopy(p['sessions'][0]); legacy['id'] = 'legacy-separated-session'
    for command in legacy['commands']: command['session_id'] = legacy['id']
    legacy['shared_crew']['version'] = 1; legacy['shared_crew'].pop('cohort')
    p['sessions'].append(legacy)
    monkeypatch.setattr(storage, 'DB_PATH', tmp_path/'separation.db'); storage.init()
    assert client.post('/api/v1/bundle/import', json=sign(p, KEY.encode())).status_code == 200
    issued = client.post('/api/v1/crews', json=dict(name='Shared QA', scenario_id=p['sessions'][0]['scenario']['id'], members=[dict(callsign='WATCH', role='spotter'), dict(callsign='RESP', role='responder')])).json()
    assert client.post('/api/v1/crews/'+issued['id']+'/complete', json={}).status_code == 200
    before = snapshot(); history = client.get('/api/v1/crews/history').json()
    assert sorted(g['session_count'] for g in history['groups']) == [1, 1, 3]
    assert len({g['group_id'] for g in history['groups']}) == 3
    assert snapshot() == before and beta_state() == ([], [])
