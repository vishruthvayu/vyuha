"""Capability lifecycle and read-only completed shared coordination history."""
import json
import pytest
from server import crew,storage
from server.tests.test_crew import shared,visible
from server.tests.test_api import client
from server.tests.test_portable_crew import shared_bundle,beta_state
from server.tests.test_portable_browser import browser_json


def restricted(shared,headers):
    c=shared['client'];cid=shared['cid'];sid=shared['issued']['session_id']
    assert c.get(f'/api/v1/crews/{cid}/state',headers=headers).status_code==401
    assert c.post(f'/api/v1/crews/{cid}/actions',headers=headers,json=dict(request_id='saved-decision',k='designate',track='T1')).status_code==401
    for leaf in ['aar','fusion-review','expert-run','reference-policy']:
        r=c.get(f'/api/v1/sessions/{sid}/{leaf}',headers=headers) if leaf in ['aar','fusion-review'] else c.post(f'/api/v1/sessions/{sid}/{leaf}',headers=headers,json={})
        assert r.status_code==401,(leaf,r.text)


def test_expired_code_denies_all_role_routes_even_existing_retry(shared,monkeypatch):
    tid=visible(shared);assert shared['act'](0,'saved-decision','designate',tid).status_code==200
    with storage.connect() as db:
        expiry=db.execute('SELECT expires_at FROM crew_members WHERE id=?',(shared['issued']['members'][0]['member_id'],)).fetchone()[0]
        before=list(db.iterdump())
    monkeypatch.setattr(crew,'capability_time',lambda:expiry)
    shared['client'].headers.clear();restricted(shared,shared['headers'][0])
    with storage.connect() as db:assert list(db.iterdump())==before


def test_revoke_rotate_preserves_member_and_accepted_evidence(shared):
    c=shared['client'];cid=shared['cid'];mid=shared['issued']['members'][0]['member_id'];track=visible(shared)
    assert shared['act'](0,'saved-decision','designate',track).status_code==200
    before=shared['state']()['attribution'];officer=dict(c.headers)
    r=c.post(f'/api/v1/crews/{cid}/members/{mid}/revoke',json={});assert r.status_code==200 and r.json()['status']=='revoked'
    c.headers.clear();restricted(shared,shared['headers'][0]);c.headers.update(officer)
    r=c.post(f'/api/v1/crews/{cid}/members/{mid}/rotate',json={'valid_minutes':15});assert r.status_code==200,r.text
    new=r.json();assert new['member_id']==mid and new['status']=='active'
    c.headers.clear();restricted(shared,shared['headers'][0])
    c.headers.update(officer)
    refreshed={'X-VYUHA-Crew-Token':new['code']}
    r=c.get(f'/api/v1/crews/{cid}/state',headers=refreshed);assert r.status_code==200 and r.json()['attribution']==before
    retry=c.post(f'/api/v1/crews/{cid}/actions',headers=refreshed,json=dict(request_id='saved-decision',k='designate',track=track))
    assert retry.status_code==200 and retry.json()['member_id']==mid
    assert c.post(f'/api/v1/crews/{cid}/actions',headers=refreshed,json=dict(request_id='other-role',k='engage',track=track,effector='hold')).status_code==403
    with storage.connect() as db:
        content='\n'.join(db.iterdump());assert new['code'] not in content
        assert len(list(db.execute('SELECT * FROM crew_attribution')))==1


def test_lifecycle_admin_routes_are_protected_scoped_and_bounded(shared):
    c=shared['client'];cid=shared['cid'];mid=shared['issued']['members'][0]['member_id'];officer=dict(c.headers)
    c.headers.clear()
    for headers in [{},{'Authorization':'Bearer forged'},shared['headers'][0]]:
        for method,path in [('GET','/history'),('GET',f'/{cid}/members'),('POST',f'/{cid}/members/{mid}/rotate'),('POST',f'/{cid}/members/{mid}/revoke')]:
            assert c.request(method,'/api/v1/crews'+path,headers=headers,json={} if method=='POST' else None).status_code==401
    c.headers.update(officer)
    assert c.get('/api/v1/crews/history?limit=101').status_code==422
    assert c.get('/api/v1/crews/history?limit=0').status_code==422
    for minutes in [0,14,1441,True]:
        assert c.post(f'/api/v1/crews/{cid}/members/{mid}/rotate',json={'valid_minutes':minutes}).status_code==422
    assert c.post(f'/api/v1/crews/{cid}/members/M_unknown/rotate',json={}).status_code==404
    second=c.post('/api/v1/crews',json={'name':'Second','scenario_id':shared['scenario']['id'],'members':[{'callsign':'W','role':'spotter'},{'callsign':'R','role':'responder'}]}).json()
    assert c.post(f"/api/v1/crews/{second['id']}/members/{mid}/revoke",json={}).status_code==404
    assert c.get(f"/api/v1/crews/{second['id']}/state",headers=shared['headers'][0]).status_code==401
    response=c.get(f'/api/v1/crews/{cid}/members').json()
    assert all('token_hash' not in m and 'code' not in m for m in response['members'])


def test_legacy_codes_require_rotation_and_additive_migration_keeps_ledger(shared):
    mid=shared['issued']['members'][0]['member_id'];cid=shared['cid'];c=shared['client']
    with storage.connect() as db:
        db.execute('UPDATE crew_members SET expires_at=NULL WHERE id=?',(mid,))
        before=[tuple(r) for r in db.execute('SELECT * FROM crew_attribution')]
        crew.ensure_schema(db);crew.ensure_schema(db)
        assert [tuple(r) for r in db.execute('SELECT * FROM crew_attribution')]==before
    assert c.get(f'/api/v1/crews/{cid}/state',headers=shared['headers'][0]).status_code==401
    assert next(m for m in c.get(f'/api/v1/crews/{cid}/members').json()['members'] if m['member_id']==mid)['status']=='rotation_required'
    rotated=c.post(f'/api/v1/crews/{cid}/members/{mid}/rotate',json={}).json()
    assert c.get(f'/api/v1/crews/{cid}/state',headers={'X-VYUHA-Crew-Token':rotated['code']}).status_code==200


def test_completed_history_three_sessions_roster_grouping_and_no_db_mutation(shared):
    c=shared['client'];spec=shared['scenario'];issued=shared['issued'];track=visible(shared)
    assert shared['act'](0,'mark1','designate',track).status_code==200
    shared['stamp'][0]+=.4
    assert shared['act'](1,'class1','classify',track,kind='quad',identity='hostile').status_code==200
    shared['stamp'][0]+=.2
    assert shared['act'](1,'hold1','engage',track,effector='hold').status_code==200
    assert c.post(f"/api/v1/crews/{issued['id']}/complete",json={}).status_code==200
    ids=[issued['session_id']]
    for i,watch in enumerate(['WATCH','OTHER']):
        r=c.post('/api/v1/crews',json=dict(name='Shared QA',scenario_id=spec['id'],members=[dict(callsign=watch,role='spotter'),dict(callsign='RESP',role='responder')]))
        assert r.status_code==201;r=r.json();ids.append(r['session_id'])
        assert c.post(f"/api/v1/crews/{r['id']}/complete",json={}).status_code==200
    # Add active session; it must not be included.
    c.post('/api/v1/crews',json=dict(name='Shared QA',scenario_id=spec['id'],members=[dict(callsign='WATCH',role='spotter'),dict(callsign='RESP',role='responder')]))
    with storage.connect() as db:before=list(db.iterdump())
    for _ in range(3):
        r=c.get('/api/v1/crews/history');assert r.status_code==200,r.text
        history=r.json();assert history['included_sessions']==3 and {s['session_id'] for s in history['sessions']}==set(ids)
        assert len(history['groups'])==2
        group=next(g for g in history['groups'] if g['session_count']==2)
        with storage.connect() as db:
            from server.main import logged_events
            actions=logged_events(db,issued['session_id'])
        assert group['median_designation_to_classification_s']==(actions[1]['tick']-actions[0]['tick'])/30
        assert group['median_classification_to_response_s']==(actions[2]['tick']-actions[1]['tick'])/30
        first=next(s for s in history['sessions'] if s['session_id']==issued['session_id'])
        assert [a['role'] for a in first['coordination_timeline']]==['spotter','responder','responder']
        assert [a['order'] for a in first['coordination_timeline']]==[a['order'] for a in actions]
        assert first['timeline_total_actions']==3 and first['timeline_truncated'] is False
        assert group['classification_handoff_count']==group['response_handoff_count']==1
        assert sum(m['accepted_actions'] for m in group['members'])==3
        assert 'not authenticated identity' in history['scope'] and 'individual competence' in history['interpretation']
        assert c.get('/api/v1/crews/history?limit=2').json()['included_sessions']==2
    with storage.connect() as db:assert list(db.iterdump())==before


def test_archived_history_survives_roundtrip_without_reviving_codes_or_individual_profiles(client,shared_bundle,monkeypatch,tmp_path):
    source=shared_bundle;before=beta_state();local=client.get('/api/v1/crews/history').json()['sessions'][0]
    assert local['coordination_metrics']['accepted_actions']==3 and beta_state()==before
    monkeypatch.setattr(storage,'DB_PATH',tmp_path/'history-recipient.db');storage.init()
    bundle=browser_json(source['bundle'])
    assert client.post('/api/v1/bundle/import',json=bundle).status_code==200
    with storage.connect() as db:before=list(db.iterdump())
    history=client.get('/api/v1/crews/history').json();entry=history['sessions'][0]
    assert history['included_sessions']==1 and entry['source']=='imported_pseudonymous_archive'
    assert entry['coordination_metrics']['accepted_actions']==entry['coordination_metrics']['attributed_actions']==3
    assert entry['coordination_metrics']['median_designation_to_classification_s']==local['coordination_metrics']['median_designation_to_classification_s']
    assert entry['scorecard']==local['scorecard'] and entry['name']=='Pseudonymous shared crew'
    assert beta_state()==([],[])
    with storage.connect() as db:
        assert list(db.iterdump())==before
        assert db.execute('SELECT COUNT(*) FROM crew_members').fetchone()[0]==0
    assert all(m['code'] not in json.dumps(history) and m['callsign'] not in json.dumps(history) for m in source['issued']['members'])
    officer=dict(client.headers);client.headers.clear()
    assert client.get('/api/v1/crews/history').status_code==401
    assert client.get('/api/v1/sessions/'+source['sid']+'/aar',headers={'X-VYUHA-Crew-Token':source['issued']['members'][0]['code']}).status_code==401
    client.headers.update(officer)


def test_completed_code_revocation_does_not_change_cards_attribution_or_skills(shared):
    c=shared['client'];cid=shared['cid'];mid=shared['issued']['members'][0]['member_id']
    assert c.post(f'/api/v1/crews/{cid}/complete',json={}).status_code==200
    def immutable():
        with storage.connect() as db:return {t:[tuple(r) for r in db.execute('SELECT * FROM '+t)] for t in ['sessions','chunks','crew_attribution','skill_profiles','skill_outcomes']}
    before=immutable()
    assert c.post(f'/api/v1/crews/{cid}/members/{mid}/revoke',json={}).status_code==200
    assert c.get(f'/api/v1/crews/{cid}/state',headers=shared['headers'][0]).status_code==401
    assert c.get('/api/v1/crews/history').status_code==200
    assert immutable()==before
