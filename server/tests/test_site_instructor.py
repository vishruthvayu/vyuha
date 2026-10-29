"""Existing group assignment admits frozen site episodes and separate evidence."""
import json,copy
from server.tests.test_api import client
from server.tests.test_units import join,presence
from server.engine import Simulation
from server import storage

def launch(c,mode='practice',names=('SITE-A','SITE-B')):
    people=[join(c,n) for n in names]
    for p in people:presence(c,p)
    s=c.post('/api/v1/observation-missions-v3/prepare',json={'template':'timed_window','mode':mode}).json()
    body=dict(request_id='site_instructor',scenario_id=s['id'],trainees=[p['trainee_id'] for p in people])
    r=c.post('/api/v1/units/local/exercises',json=body);assert r.status_code==201,r.text
    return s,people,body,r.json()

def test_site_groups_keep_existing_assignment_idempotency_and_ownership(client):
    s,people,body,g=launch(client)
    assert len(g['results'])==2 and len({r['session_id'] for r in g['results']})==2
    assert client.post('/api/v1/units/local/exercises',json=body).json()==g
    assert client.post('/api/v1/units/local/exercises',json={**body,'seed':9}).status_code==409
    assignments=[client.get(f"/api/v1/trainees/{p['trainee_id']}/assignment").json()['assignment'] for p in people]
    assert all(a['scenario']==s and a['exercise_group_id']==g['exercise_group_id'] for a in assignments)
    assert client.post('/api/v1/assignments/'+assignments[0]['session_id']+'/accept',json={'trainee_id':people[1]['trainee_id']}).status_code==422
    for p,a in zip(people,assignments):assert client.post('/api/v1/assignments/'+a['session_id']+'/accept',json={'trainee_id':p['trainee_id']}).status_code==200
    auth=client.headers.pop('Authorization')
    assert client.get('/api/v1/units/local/exercises/'+g['exercise_group_id']+'/observation-evidence').status_code==401
    assert client.post('/api/v1/units/local/exercises',json=body).status_code==401
    client.headers['Authorization']=auth

def test_site_group_review_uses_only_completed_evidence_and_preserves_score_profile_and_independence(client):
    s,people,body,g=launch(client,'assessment')
    sid=g['results'][0]['session_id'];sim=Simulation(s)
    while sim.tick<300:sim.step(force=True)
    assert sim.act(dict(k='defer',tick=300,order=sim.next_order,track='T1',reason='affiliation_unresolved',decision_version='uncertainty-decisions-v1'))
    assert client.post(f'/api/v1/sessions/{sid}/events',json={'seq':0,'events':sim.events}).status_code==200
    done=client.post(f'/api/v1/sessions/{sid}/complete',json={'end_tick':2700,'execution_tick':330});assert done.status_code==200,done.text
    original=client.get(f'/api/v1/sessions/{sid}/aar').json()
    r=client.get('/api/v1/units/local/exercises/'+g['exercise_group_id']+'/observation-evidence');assert r.status_code==200,r.text
    v=r.json();assert v['mode']=='assessment' and v['mastery_awarded'] is False
    verified=next(x for x in v['results'] if x['session_id']==sid);pending=next(x for x in v['results'] if x['session_id']!=sid)
    assert verified['verified'] and verified['original_tactical_score']==original['scorecard']['score']
    assert verified['evidence']['declared_deferrals']==[{'tick':300,'reason':'affiliation_unresolved','track':'T1'}]
    assert verified['evidence']['competencies']==original['observation_assessment']['competencies']
    assert pending['evidence'] is None and pending['original_tactical_score'] is None and not pending['verified']
    assert client.get(f'/api/v1/sessions/{sid}/aar').json()==original
    assert client.get('/api/v1/trainees/'+people[0]['trainee_id']+'/profile').json()['sessions']==0
    assert s['fusion']['mode']=='assessment'

def test_site_assignment_rejects_forged_or_unadmitted_snapshots_and_cross_unit_review(client):
    s,people,body,g=launch(client)
    assert client.get('/api/v1/units/other/exercises/'+g['exercise_group_id']+'/observation-evidence').status_code==404
    bad=copy.deepcopy(s);bad['id']='raid_'+'a'*24;bad['terrain_boxes'][0]['height']=1
    with storage.connect() as db:db.execute('INSERT INTO scenarios VALUES (?,?)',(bad['id'],json.dumps(bad)))
    fresh=join(client,'SITE-C');presence(client,fresh)
    r=client.post('/api/v1/units/local/exercises',json={**body,'request_id':'forged','scenario_id':bad['id'],'trainees':[fresh['trainee_id']]})
    assert r.status_code==422,r.text


def test_site_review_fails_closed_if_frozen_catalog_is_corrupted(client):
    s,people,body,g=launch(client)
    bad=copy.deepcopy(s);bad['training_site']['structures'][0]['height']+=1
    with storage.connect() as db:db.execute('UPDATE scenarios SET spec=? WHERE id=?',(json.dumps(bad),s['id']))
    r=client.get('/api/v1/units/local/exercises/'+g['exercise_group_id']+'/observation-evidence')
    assert r.status_code==422,r.text
    assert r.json()['detail']=='Invalid frozen site mission'
