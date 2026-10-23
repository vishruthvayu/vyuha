"""Synthetic contract tests, never participant or learning efficacy evidence."""
import copy
import hashlib
import json
import pytest
from server import storage, learning
from server.learning import LearningContext, PrepareLearning, catalog, choose_item, compile_item, coverage, evidence_for
from server.engine import Simulation
from server.engine_v2 import observed_position
from server.portable import sign
from server.tests.test_api import client
from server.tests.test_hardening import KEY


def joined(client,name='ACADEMY-QA'):
    r=client.post('/api/v1/units/join',json={'unit_id':'local','callsign':name,'request_id':'join-'+name})
    assert r.status_code==200,r.text
    return r.json()['trainee_id']

def prepared(client,tid,mode='practice',rid='lesson-request-01',**extra):
    r=client.post('/api/v1/learning/prepare',json=dict(request_id=rid,trainee=tid,mode=mode,seed=7,**extra))
    assert r.status_code==201,r.text
    return r.json()

def launch(client,p,tid):
    r=client.post('/api/v1/sessions',json=dict(scenario_id=p['scenario']['id'],trainee=tid,learning_preparation=p['preparation_id']))
    assert r.status_code==201,r.text
    return r.json()['id']

def finished(client,p,tid,actions=True):
    sid=launch(client,p,tid);spec=p['scenario'];sim=Simulation(spec)
    # Deliberately synthetic labels exercise reconstruction, not human reasoning.
    for _ in range(300):
        for t in sim.tracks:
            if t['active'] and observed_position(t) and t['designated'] is None:
                sim.act(dict(tick=sim.tick,k='designate',track=t['id']))
                sim.act(dict(tick=sim.tick,k='classify',track=t['id'],kind=t['kind'],identity=t['identity']))
        sim.step()
    log=sim.events if actions else []
    assert client.post(f'/api/v1/sessions/{sid}/events',json=dict(seq=0,events=log)).status_code==200
    r=client.post(f'/api/v1/sessions/{sid}/complete',json=dict(end_tick=spec['duration']*30,execution_tick=300))
    assert r.status_code==200,r.text
    a=client.get(f'/api/v1/sessions/{sid}/aar');assert a.status_code==200,a.text
    return sid,a.json()


def test_catalogue_excludes_compiler_truth_and_unimplemented_crew_is_not_launchable(client):
    data=client.get('/api/v1/learning/catalogue').json()
    assert len(data['items'])==52 and len(data['competencies'])==6
    assert all('scenario' not in i and 'tracks' not in i for i in data['items'])
    tid=joined(client)
    r=client.post('/api/v1/learning/prepare',json=dict(request_id='forbidden-crew',trainee=tid,item_id='C06_PRACTICE_A'))
    assert r.status_code==422


def test_frozen_bank_semantic_disjointness_and_structural_assessment_balance():
    data,digest=catalog();practice=set();forms={}
    state={'competencies':{c['id']:dict(correct=0,incorrect=0,unassessable=0,assessed_sessions=0) for c in data['competencies'] if c['scope']=='individual'},'recent_items':[]}
    for i in data['items']:
        if i['audience']!='individual':continue
        req=PrepareLearning(request_id='compile-bank',trainee='QA',mode='assessment' if i['pool']=='assessment' else 'practice',item_id=i['id'],form=i['form'],seed=7)
        _,selection=choose_item(data,state,req)
        ctx=LearningContext(catalog_hash=digest,item_id=i['id'],mode=req.mode,assistance=i['assistance'],seed=7,selection=selection)
        spec=compile_item(ctx)
        assert len(spec['tracks'])==i['scenario']['contacts']
        assert spec['duration']==60
        semantic=storage.dumps(i['scenario'])
        if i['pool']=='practice':practice.add(semantic)
        else:
            forms.setdefault(i['form'],[]).append(i)
            assert spec['fusion']['mode']=='assessment'
            assert semantic not in practice
    assert set(forms)=={'baseline-a','immediate-b','retention-c','transfer-d'}
    for items in forms.values():
        assert len(items)==10
        assert {i['scenario']['contacts'] for i in items}=={4}
        assert all(sorted(i['scenario']['mix'])==['bird','friendly_uav','hostile_quad','hostile_quad'] for i in items)
    # Form blueprint sets are distinct beyond seed/name/ID; this is not empirical fairness.
    sets=[{storage.dumps(i['scenario']) for i in rows} for rows in forms.values()]
    assert all(a.isdisjoint(b) for n,a in enumerate(sets) for b in sets[n+1:])
    for i in data['items']:
        if i['pool']=='practice' and i['id'].endswith('_B'):
            assert i['scenario']==next(j['scenario'] for j in data['items'] if j['id']==i['id'][:-1]+'A')


def test_preparation_idempotency_launch_owner_and_reuse(client):
    tid=joined(client);p=prepared(client,tid)
    assert prepared(client,tid)==p
    assert client.post('/api/v1/learning/prepare',json=dict(request_id=p['preparation_id'],trainee=tid,seed=8)).status_code==409
    other=joined(client,'OTHER')
    assert client.get(f"/api/v1/learning/preparations/{p['preparation_id']}?trainee={other}").status_code==404
    assert client.post('/api/v1/sessions',json=dict(scenario_id=p['scenario']['id'],trainee=other,learning_preparation=p['preparation_id'])).status_code==422
    sid=launch(client,p,tid);assert launch(client,p,tid)==sid
    client.post(f'/api/v1/sessions/{sid}/events',json=dict(seq=0,events=[]))
    assert client.post('/api/v1/sessions',json=dict(scenario_id=p['scenario']['id'],trainee=tid,learning_preparation=p['preparation_id'])).status_code==409


@pytest.mark.parametrize('mode',['practice','adaptive','assessment'])
def test_verified_evidence_practice_isolation_completion_and_replay_immutability(client,mode):
    tid=joined(client);before=client.get(f'/api/v1/trainees/{tid}/profile').json()
    p=prepared(client,tid,mode,**({'form':'baseline-a'} if mode=='assessment' else {}))
    sid,aar=finished(client,p,tid)
    assert aar['verified'] and aar['learning']['context']==p['context']
    assert aar['learning']['evidence']['assessed']==(mode=='assessment')
    assert all(o['tick']<=300 for o in aar['learning']['evidence']['observations'])
    profile=client.get(f'/api/v1/trainees/{tid}/profile').json()
    progress=client.get(f'/api/v1/learning/trainees/{tid}/progress').json()
    if mode!='assessment':
        assert profile==before
        assert progress['practice_attempts']==1 and progress['assessed_attempts']==0
        assert all(c['correct']==c['incorrect']==c['assessed_sessions']==0 for c in progress['competencies'].values())
    else:assert profile['sessions']==1 and progress['assessed_attempts']==1
    with storage.connect() as db:
        before_rows=[tuple(r) for r in db.execute('SELECT * FROM learning_attempts')]
        learning.complete_attempt(db,sid,{**aar})
        assert before_rows==[tuple(r) for r in db.execute('SELECT * FROM learning_attempts')]
        changed=copy.deepcopy(aar);changed['decision_reviews'].append(copy.deepcopy(aar['decision_reviews'][0]))
        # A duplicate ID cannot inflate the evidence projection; original review hash still detects mutation.
        with pytest.raises(ValueError):learning.complete_attempt(db,sid,changed)
    assert client.get(f'/api/v1/sessions/{sid}/aar').json()==aar
    assert client.get(f'/api/v1/sessions/{sid}/aar?include_review=false').json()['learning']==aar['learning']


def test_hidden_reference_expectations_never_become_assessed_competence(client):
    tid=joined(client);p=prepared(client,tid,'assessment',form='baseline-a');_,aar=finished(client,p,tid)
    result=aar['learning']['evidence'];byid={r['decision_id']:r for r in aar['decision_reviews']}
    for row in result['observations']:
        d=byid[row['decision_id']]
        if d['decision_kind']!='detection' and d['expected_action']['basis']!='available_evidence':assert row['verdict']=='unassessable'


def test_curriculum_selection_is_reproducible_frozen_and_avoids_recent_items(client):
    tid=joined(client);p=prepared(client,tid,'adaptive');sid,_=finished(client,p,tid)
    q=prepared(client,tid,'adaptive',rid='second-curriculum')
    assert p['context']['item_id']!=q['context']['item_id']
    assert q['context']['selection']['recent_items']==[p['context']['item_id']]
    assert client.get(f"/api/v1/learning/preparations/{p['preparation_id']}?trainee={tid}").json()['context']==p['context']
    assert 'heuristic' in q['context']['selection']['reason']
    bad=copy.deepcopy(p['context']);bad['catalog_hash']='0'*64
    with pytest.raises(ValueError):compile_item(bad)
    bad=copy.deepcopy(p['context']);bad['selection']['candidates']=['C06_PRACTICE_A']
    with pytest.raises(ValueError):compile_item(bad)


@pytest.mark.parametrize('mode',['practice','assessment'])
def test_curriculum_transfer_roundtrip_duplicate_and_tamper(client,monkeypatch,tmp_path,mode):
    monkeypatch.setenv('VYUHA_BUNDLE_SECRET',KEY)
    tid=joined(client);p=prepared(client,tid,mode,**({'form':'baseline-a'} if mode=='assessment' else {}));sid,aar=finished(client,p,tid)
    r=client.post('/api/v1/units/local/bundle/export',json={});assert r.status_code==200,r.text
    bundle=r.json();entry=bundle['payload']['sessions'][0]
    assert entry['learning_context']==p['context']
    assert (entry['outcomes'] is None)==(mode=='practice')
    monkeypatch.setattr(storage,'DB_PATH',tmp_path/'destination.db');storage.init()
    r=client.post('/api/v1/bundle/import',json=bundle);assert r.status_code==200,r.text
    restored=client.get(f'/api/v1/sessions/{sid}/aar').json()
    assert restored['scorecard']==aar['scorecard'] and restored['learning']==aar['learning']
    assert client.post('/api/v1/bundle/import',json=bundle).json()['skipped_sessions']==1
    tampered=copy.deepcopy(bundle['payload']);tampered['sessions'][0]['learning_context']['seed']+=1
    assert client.post('/api/v1/bundle/import',json=sign(tampered,KEY.encode())).status_code==422
    with storage.connect() as db:
        assert db.execute('SELECT COUNT(*) FROM learning_attempts').fetchone()[0]==1
        assert db.execute('SELECT COUNT(*) FROM skill_outcomes').fetchone()[0]==(1 if mode=='assessment' else 0)


def test_repeated_decisions_do_not_farm_competency_credit(client):
    tid=joined(client);p=prepared(client,tid,'assessment',form='baseline-a');_,aar=finished(client,p,tid)
    review=copy.deepcopy(aar)
    first=next(r for r in review['decision_reviews'] if r['decision_kind']=='detection')
    duplicate=copy.deepcopy(first);duplicate['decision_id']='repeated-decision';review['decision_reviews'].append(duplicate)
    assert evidence_for(review,p['context'])['summary']==aar['learning']['evidence']['summary']
    duplicate['verdict']='incorrect'
    negative=evidence_for(review,p['context'])['summary']['C01']
    assert negative['incorrect']>=1
    assert sum(negative.values())==sum(aar['learning']['evidence']['summary']['C01'].values())

@pytest.mark.parametrize('mode',['practice','assessment'])
def test_advanced_reviews_preserve_curriculum_intent_evidence_and_profiles(client,mode):
    tid=joined(client);p=prepared(client,tid,mode,**({'form':'baseline-a'} if mode=='assessment' else {}));sid,aar=finished(client,p,tid)
    client.get(f'/api/v1/trainees/{tid}/profile')
    with storage.connect() as db:before=list(db.iterdump())
    r=client.get(f'/api/v1/sessions/{sid}/reference-policy');assert r.status_code==200,r.text
    r=client.get(f'/api/v1/sessions/{sid}/expert-run?mode=evidence_only');assert r.status_code==200,r.text
    index=next(i for i,a in enumerate(aar['events']) if a['k']=='classify')
    alternative={**aar['events'][index],'identity':'neutral'}
    r=client.post(f'/api/v1/sessions/{sid}/what-if',json=dict(decision_index=index,action=alternative));assert r.status_code==200,r.text
    with storage.connect() as db:assert list(db.iterdump())==before
    assert client.get(f'/api/v1/sessions/{sid}/aar').json()==aar
