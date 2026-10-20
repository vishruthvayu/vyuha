import copy
import json
from types import SimpleNamespace

import pytest
from server import reference_policy, storage
from server.engine import Simulation, make_scenario, replay
from server.tests.test_api import client


def simple_spec(identity='hostile', kind='quad', rf=True):
    spec=make_scenario(3622)
    spec['tracks']=[dict(id='T1',kind=kind,identity=identity,rf=rf,spawn=0,bearing=45,distance=20,speed=.5,altitude=20)]
    spec['fog']=0
    return spec


def actions(effector='hold', classification='quad', identity='hostile'):
    return [dict(tick=0,order=0,k='designate',track='T1'),dict(tick=0,order=1,k='classify',track='T1',kind=classification,identity=identity),dict(tick=0,order=2,k='engage',track='T1',effector=effector)]


def database_dump():
    with storage.connect() as db:return list(db.iterdump())


def completed(client, spec, events):
    with storage.connect() as db:
        db.execute('INSERT INTO scenarios VALUES (?,?)',(spec['id'],storage.dumps(spec)))
    sid=client.post('/api/v1/sessions',json=dict(scenario_id=spec['id'],trainee='REFERENCE-01')).json()['id']
    assert client.post('/api/v1/sessions/'+sid+'/events',json=dict(seq=0,events=events)).status_code==200
    result=client.post('/api/v1/sessions/'+sid+'/complete',json=dict(end_tick=spec['duration']*30,execution_tick=max((e['tick'] for e in events),default=0)))
    assert result.status_code==200,result.text
    return sid,result.json()


def test_every_recorded_response_has_original_before_action_evidence_in_one_replay(monkeypatch):
    events=actions()+[dict(tick=0,order=3,k='engage',track='T1',effector='hold'),dict(tick=0,order=4,k='classify',track='T1',kind='fiber_fpv',identity='neutral')]
    original=copy.deepcopy(events);calls=[];real=reference_policy.replay
    def counted(*args,**kwargs):
        calls.append(1);return real(*args,**kwargs)
    monkeypatch.setattr(reference_policy,'replay',counted)
    report=reference_policy.compare(simple_spec(),events,[],2250,'pure-session')
    assert len(calls)==1
    assert [e['decision_index'] for e in report['entries']]==[2,3]
    assert all(e['available_evidence']['prior_classification']=='quad' for e in report['entries'])
    assert all(e['available_evidence']['prior_identity']=='hostile' for e in report['entries'])
    assert events==original and report['original_history_unchanged']
    assert report['summary']['recorded_responses']==2
    assert 'not a score' in report['summary']['interpretation']


def test_policy_receives_masked_operator_state_and_not_canonical_track_truth(monkeypatch):
    real=reference_policy.reference_choice;seen=[]
    def boundary(ev,track,rules):
        seen.append(copy.deepcopy(track))
        assert set(track)=={'classification','declared'}
        assert not {'kind','identity','rf','x','z','rules'} & track.keys()
        return real(ev,track,rules)
    monkeypatch.setattr(reference_policy,'reference_choice',boundary)
    result=reference_policy.compare(simple_spec(),actions(),[],2250,'masked')
    assert seen and result['entries'][0]['reference_policy']['basis']=='available_evidence'
    assert result['entries'][0]['rubric_reference']['basis']=='full_rubric_truth'


def test_same_tick_applied_command_order_changes_only_available_evidence_boundary():
    events=actions();events[-1]['order']=3
    command=dict(seq=1,tick=0,order=2,type='sensor_fault',payload=dict(sensor='rf',mode='failed'))
    report=reference_policy.compare(simple_spec(),events,[command],2250,'controlled')
    entry=report['entries'][0]
    assert entry['available_evidence']['rf']['available'] is False
    assert entry['reference_policy']['action']=='hold' and entry['reference_policy']['confidence']=='uncertain'
    assert entry['rubric_reference']['effector']=='rf_jam'
    assert not entry['iff_no_reply_is_hostility']


def test_friendly_iff_reply_overrides_an_incorrect_hostile_declaration():
    report=reference_policy.compare(simple_spec(identity='friendly'),actions(effector='hold'),[],2250,'friendly')
    entry=report['entries'][0]
    assert entry['available_evidence']['prior_identity']=='hostile'
    assert entry['available_evidence']['rf']['iff']=='friendly_reply'
    assert entry['reference_policy']['action']=='hold' and entry['reference_policy']['confidence']=='supported'
    assert entry['agrees_with_policy']


def test_no_reply_and_no_rf_do_not_prove_hostility_or_fibre_link():
    spec=simple_spec(kind='fiber_fpv',rf=False)
    report=reference_policy.compare(spec,actions(classification='quad',effector='hold'),[],2250,'ambiguous')
    entry=report['entries'][0]
    assert entry['available_evidence']['rf']['iff']=='no_reply'
    assert entry['reference_policy']['action']=='hold' and entry['reference_policy']['confidence']=='uncertain'
    assert entry['rubric_reference']['effector']=='kinetic'
    assert entry['identity_assurance']=='operator_declaration_only'
    assert 'no reply' in ' '.join(report['limitations']).lower()


def test_empty_response_history_has_no_fabricated_agreement_fraction():
    report=reference_policy.compare(simple_spec(),[],[],2250,'empty')
    assert report['entries']==[]
    assert report['summary']['agreement_fraction'] is None
    assert report['summary']['recorded_responses']==0


def test_completed_endpoint_preserves_every_database_table_and_original_score(client):
    sid,score=completed(client,simple_spec(),actions())
    before=database_dump()
    for _ in range(2):
        result=client.get('/api/v1/sessions/'+sid+'/reference-policy')
        assert result.status_code==200,result.text
        assert result.json()['session_id']==sid
    assert database_dump()==before
    assert client.get('/api/v1/sessions/'+sid+'/aar').json()['scorecard']==score


def test_active_session_and_impossible_recorded_boundaries_fail_closed(client):
    spec=client.post('/api/v1/scenarios/generate',json={}).json()
    sid=client.post('/api/v1/sessions',json=dict(scenario_id=spec['id'])).json()['id']
    assert client.get('/api/v1/sessions/'+sid+'/reference-policy').status_code==409
    with pytest.raises(ValueError):reference_policy.compare(simple_spec(),[dict(tick=0,k='engage',track='T1',effector='kinetic')],[],2250,'invalid')


def test_real_v04_completed_history_uses_versioned_observation_evidence(client):
    spec=client.post('/api/v1/raids',json=dict(seed=62,family='DIRECT',duration=60,difficulty='foundational')).json()
    sim=Simulation(spec)
    target=None
    while sim.tick<spec['duration']*30:
        target=next((t for t in sim.tracks if t['active'] and t['detected'] is not None),None)
        if target:break
        sim.step()
    assert target is not None
    events=[dict(tick=sim.tick,order=0,k='designate',track=target['id']),dict(tick=sim.tick,order=1,k='classify',track=target['id'],kind=target['kind'],identity=target['identity']),dict(tick=sim.tick,order=2,k='engage',track=target['id'],effector='hold')]
    sid=client.post('/api/v1/sessions',json=dict(scenario_id=spec['id'],trainee='REFERENCE-V2')).json()['id']
    assert client.post('/api/v1/sessions/'+sid+'/events',json=dict(seq=0,events=events)).status_code==200
    response=client.post('/api/v1/sessions/'+sid+'/complete',json=dict(end_tick=spec['duration']*30,execution_tick=sim.tick))
    assert response.status_code==200,response.text
    before=database_dump();report=client.get('/api/v1/sessions/'+sid+'/reference-policy').json()
    assert report['engine_version']=='vyuha-0.4.0'
    assert report['entries'][0]['tick']==sim.tick
    assert report['entries'][0]['reference_policy']['basis']=='available_evidence'
    assert database_dump()==before
