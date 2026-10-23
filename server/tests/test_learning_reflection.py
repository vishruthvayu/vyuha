"""Synthetic annotation contracts; these tests are not learner efficacy data."""
import json
from datetime import datetime, timezone

from server import learning, main, storage
from server.durability import backup, restore
from server.tests.test_api import client
from server.tests.test_hardening import KEY
from server.tests.test_learning import finished, joined, launch, prepared


def endpoint(sid):
    return f'/api/v1/learning/sessions/{sid}/reflections'


def request(tid, aar, rid='reflection-request-01'):
    return dict(request_id=rid, trainee=tid,
                review_hash=aar['learning']['evidence']['original_review_hash'],
                observed_cue='The radar contact stayed visible.', remaining_uncertainty='',
                next_check='Compare the next available sensor cue.')


def completed(client, mode='assessment'):
    tid = joined(client)
    p = prepared(client, tid, mode, **({'form': 'baseline-a'} if mode == 'assessment' else {}))
    sid, aar = finished(client, p, tid)
    return tid, sid, aar


def original_rows():
    """All original database tables, including raw evidence/events/profile rows."""
    with storage.connect() as db:
        tables = [r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name!='learning_reflections' ORDER BY name")]
        return {name: [tuple(row) for row in db.execute(f'SELECT * FROM "{name}" ORDER BY rowid')] for name in tables}


def test_assessment_reflection_contract_is_plain_text_immutable_annotation(client, monkeypatch):
    tid, sid, aar = completed(client)
    before_profile = client.get(f'/api/v1/trainees/{tid}/profile').json()
    before = original_rows()
    # Reflection reads/saves must stay cheap and must not reinterpret catalogues
    # or re-simulate a verified exercise, including old large-contact histories.
    def forbidden(*args, **kwargs):
        raise AssertionError('Annotations must not reconstruct original learning evidence')
    monkeypatch.setattr(main, 'review_session', forbidden)
    monkeypatch.setattr(learning, 'evidence_for', forbidden)
    monkeypatch.setattr(learning, 'catalog', forbidden)
    client.headers.clear()  # Existing trusted-LAN trainee identity, no stronger claim.
    empty = client.get(endpoint(sid), params={'trainee': tid})
    assert empty.status_code == 200, empty.text
    assert set(empty.json()) == {'session_id', 'trainee', 'review_hash', 'prompt_version', 'reflections', 'note'}
    assert empty.json()['reflections'] == []
    text = '<script>alert("learner text")</script>\nSecond cue\tstill text'
    body = request(tid, aar)
    body.update(observed_cue='  ' + text + '  ', next_check='  Recheck classification.  ')
    start = datetime.now(timezone.utc)
    result = client.post(endpoint(sid), json=body)
    assert result.status_code == 201, result.text
    row = result.json()['reflections'][0]
    assert set(row) == {'id', 'request_id', 'session_id', 'trainee', 'review_hash', 'prompt_version', 'observed_cue', 'remaining_uncertainty', 'next_check', 'created_at'}
    assert row['observed_cue'] == text and row['next_check'] == 'Recheck classification.'
    assert row['remaining_uncertainty'] == '' and row['prompt_version'] == 'reflection-prompts-v1'
    created = datetime.fromisoformat(row['created_at'])
    assert created.utcoffset().total_seconds() == 0 and start <= created <= datetime.now(timezone.utc)
    assert client.get(endpoint(sid), params={'trainee': tid}).json() == result.json()
    assert original_rows() == before
    assert client.get(f'/api/v1/trainees/{tid}/profile').json() == before_profile
    with storage.connect() as db:
        assert db.execute('SELECT version FROM learning_reflections').fetchone()[0] == 'reflection-v1'
    assert 'trusted-LAN' in result.json()['note'] and 'administrator' in result.json()['note']


def test_practice_reflections_do_not_create_assessment_credit(client):
    tid, sid, aar = completed(client, 'practice')
    before = original_rows()
    result = client.post(endpoint(sid), json=request(tid, aar))
    assert result.status_code == 201, result.text
    assert original_rows() == before
    assert not aar['learning']['evidence']['assessed']
    with storage.connect() as db:
        assert db.execute('SELECT COUNT(*) FROM skill_outcomes').fetchone()[0] == 0


def test_owner_pending_nonlearning_and_real_crew_are_ineligible(client):
    tid = joined(client)
    p = prepared(client, tid)
    sid = launch(client, p, tid)
    body = dict(request_id='pending-reflection', trainee=tid, review_hash='0'*64,
                observed_cue='Cue', remaining_uncertainty='', next_check='Check')
    for method in ['get', 'post']:
        result = (client.get(endpoint(sid), params={'trainee': tid}) if method == 'get'
                  else client.post(endpoint(sid), json=body))
        assert result.status_code == 409
        other = dict(body, trainee='OTHER')
        wrong = (client.get(endpoint(sid), params={'trainee': 'OTHER'}) if method == 'get'
                 else client.post(endpoint(sid), json=other))
        assert wrong.status_code == 404
    assert client.get(endpoint('missing'), params={'trainee': tid}).status_code == 404
    spec = client.post('/api/v1/scenarios/generate', json={}).json()
    ordinary = client.post('/api/v1/sessions', json={'scenario_id': spec['id'], 'trainee': tid}).json()['id']
    assert client.get(endpoint(ordinary), params={'trainee': tid}).status_code == 404
    shared_spec = client.post('/api/v1/raids', json=dict(name='Reflection isolation', duration=60,
        seed=62, difficulty='foundational', family='DIRECT', terrain='rural')).json()
    crew = client.post('/api/v1/crews', json=dict(name='Reflection isolation', scenario_id=shared_spec['id'],
        members=[dict(callsign='WATCH', role='spotter'), dict(callsign='RESP', role='responder')]))
    assert crew.status_code == 201, crew.text
    crew_sid = crew.json()['session_id']
    with storage.connect() as db:
        owner = db.execute('SELECT trainee FROM sessions WHERE id=?', (crew_sid,)).fetchone()[0]
    assert client.get(endpoint(crew_sid), params={'trainee': owner}).status_code == 422
    assert client.post(endpoint(crew_sid), json=dict(body, trainee=owner)).status_code == 422
    with storage.connect() as db:
        assert db.execute('SELECT COUNT(*) FROM learning_reflections').fetchone()[0] == 0


def test_strict_shape_control_characters_trimmed_bounds_and_no_edit_routes(client):
    tid, sid, aar = completed(client)
    body = request(tid, aar)
    invalid = [dict(body, observed_cue=' \n\t '), dict(body, next_check='x'*801),
               dict(body, remaining_uncertainty='x'*801), dict(body, observed_cue=17),
               dict(body, next_check='bad\rtext'), dict(body, observed_cue='\x00edge'),
               dict(body, remaining_uncertainty='bad\x7ftext'), dict(body, created_at='fake'),
               dict(body, prompt_version='invented'), dict(body, review_hash='not-a-review-hash')]
    for bad in invalid:
        result = client.post(endpoint(sid), json=bad)
        assert result.status_code == 422, result.text
    edge = dict(body, observed_cue='x'*800, remaining_uncertainty='y'*800, next_check='z'*800)
    assert client.post(endpoint(sid), json=edge).status_code == 201
    assert client.put(endpoint(sid), json=body).status_code == 405
    assert client.delete(endpoint(sid)).status_code == 405
    assert client.patch(endpoint(sid), json=body).status_code == 405


def test_idempotent_retry_conflict_stale_hash_and_twenty_note_limit(client):
    tid, sid, aar = completed(client)
    body = request(tid, aar)
    first = client.post(endpoint(sid), json=body)
    assert first.status_code == 201, first.text
    assert client.post(endpoint(sid), json=body).json() == first.json()
    changed = dict(body, next_check='A different next check')
    assert client.post(endpoint(sid), json=changed).status_code == 409
    assert client.post(endpoint(sid), json=dict(body, review_hash='0'*64)).status_code == 409
    for i in range(1, 20):
        result = client.post(endpoint(sid), json=dict(body, request_id=f'reflection-{i:02d}'))
        assert result.status_code == 201, result.text
    assert len(result.json()['reflections']) == 20
    assert client.post(endpoint(sid), json=dict(body, request_id='reflection-over-limit')).status_code == 422
    assert len(client.post(endpoint(sid), json=body).json()['reflections']) == 20
    with storage.connect() as db:
        assert db.execute('SELECT COUNT(*) FROM learning_reflections').fetchone()[0] == 20


def test_missing_or_malformed_original_verified_record_fails_closed(client):
    tid, sid, aar = completed(client)
    body = request(tid, aar)
    with storage.connect() as db:
        evidence = db.execute('SELECT evidence FROM learning_attempts WHERE session_id=?', (sid,)).fetchone()[0]
        score = db.execute('SELECT scorecard FROM sessions WHERE id=?', (sid,)).fetchone()[0]
    for broken in [None, '{}', json.dumps(dict(json.loads(evidence), original_review_hash='bad')), '[]']:
        with storage.connect() as db:
            db.execute('UPDATE learning_attempts SET evidence=? WHERE session_id=?', (broken, sid))
        assert client.get(endpoint(sid), params={'trainee': tid}).status_code == 409
        assert client.post(endpoint(sid), json=body).status_code == 409
    with storage.connect() as db:
        db.execute('UPDATE learning_attempts SET evidence=? WHERE session_id=?', (evidence, sid))
        db.execute('UPDATE sessions SET scorecard=NULL WHERE id=?', (sid,))
    assert client.post(endpoint(sid), json=body).status_code == 409
    with storage.connect() as db:
        db.execute('UPDATE sessions SET scorecard=? WHERE id=?', (score, sid))
    assert client.post(endpoint(sid), json=body).status_code == 201


def test_ordinary_transfer_deliberately_omits_reflection_notes(client, monkeypatch, tmp_path):
    monkeypatch.setenv('VYUHA_BUNDLE_SECRET', KEY)
    tid, sid, aar = completed(client)
    body = request(tid, aar)
    body['observed_cue'] = 'PRIVATE-REFLECTION-NOT-IN-ORDINARY-TRANSFER'
    assert client.post(endpoint(sid), json=body).status_code == 201
    exported = client.post('/api/v1/units/local/bundle/export', json={})
    assert exported.status_code == 200, exported.text
    bundle = exported.json()
    assert body['observed_cue'] not in json.dumps(bundle)
    assert 'learning_reflections' not in json.dumps(bundle) and 'reflection-prompts-v1' not in json.dumps(bundle)
    monkeypatch.setattr(storage, 'DB_PATH', tmp_path/'recipient.db')
    storage.init()
    imported = client.post('/api/v1/bundle/import', json=bundle)
    assert imported.status_code == 200, imported.text
    imported_tid = bundle['payload']['sessions'][0]['trainee']
    result = client.get(endpoint(sid), params={'trainee': imported_tid})
    assert result.status_code == 200, result.text
    assert result.json()['reflections'] == []
    assert result.json()['review_hash'] == body['review_hash']


def test_populated_original_backup_restore_preserves_notes_and_original_history(client, monkeypatch, tmp_path):
    tid, sid, aar = completed(client)
    body = request(tid, aar)
    assert client.post(endpoint(sid), json=body).status_code == 201
    assert client.post(endpoint(sid), json=dict(body, request_id='reflection-backup-02')).status_code == 201
    before = client.get(endpoint(sid), params={'trainee': tid}).json()
    original = original_rows()
    snapshot = backup(storage.DB_PATH, tmp_path/'reflection-backup.db')
    assert client.post(endpoint(sid), json=dict(body, request_id='reflection-after-backup')).status_code == 201
    restored = restore(snapshot, tmp_path/'reflection-restored.db')
    monkeypatch.setattr(storage, 'DB_PATH', restored)
    storage.init()  # Migration is idempotent on a populated restored database.
    assert client.get(endpoint(sid), params={'trainee': tid}).json() == before
    assert original_rows() == original
    assert client.get(f'/api/v1/sessions/{sid}/aar').json() == aar
    retry = client.post(endpoint(sid), json=body)
    assert retry.status_code == 201 and retry.json() == before
