"""Explicit Defer is a versioned decision, not inactivity or a frozen score rewrite."""
import copy,json
import pytest
from server.engine import Simulation,replay,score
from server.observation_missions_v2 import compile_mission,validate_snapshot
from server.observation_missions import compile_mission as v1_mission
from server.models import Action
from server.review import build_review
from server.tests.test_api import client

def advance(sim,tick):
    while sim.tick<tick:sim.step(force=True)
    return sim

def action(sim,reason='affiliation_unresolved',track='T1'):
    return dict(k='defer',track=track,tick=sim.tick,order=sim.next_order,decision_version='uncertainty-decisions-v1',reason=reason)

def test_defer_without_classification_has_no_tactical_or_sensor_effect_and_same_tick_duplicates_fail():
    scenario=compile_mission({});sim=advance(Simulation(scenario),150)
    before=copy.deepcopy(sim.tracks);card=score(sim);q=sim.acquisition_snapshot()
    assert sim.act(action(sim))
    assert sim.tracks==before and score(sim)==card
    assert sim.acquisition_snapshot()['results']==q['results']
    assert not sim.act(action(sim))
    assert sim.tracks[0]['designated'] is None and sim.tracks[0]['classification'] is None
    assert replay(scenario,sim.events,150).events==sim.events
    # A later explicit classification remains possible; Defer never selects it.
    for fields in [dict(k='designate'),dict(k='classify',kind='quad',identity='hostile')]:
        assert sim.act(dict(tick=sim.tick,order=sim.next_order,track='T1',**fields))
    advance(sim,151);assert sim.act(action(sim,'type_unresolved'))
    assert sim.tracks[0]['classification']=='quad' and sim.tracks[0]['declared']=='hostile'


def test_old_action_contract_and_new_schema_reject_ambiguous_or_forged_defer():
    old=advance(Simulation(v1_mission({})),150)
    assert not old.act(action(old))
    for changes in [dict(decision_version=None),dict(reason=None),dict(reason='no_internet'),dict(kind='quad'),dict(effector='hold')]:
        with pytest.raises(ValueError):Action.model_validate({**action(old),**changes})
    sim=advance(Simulation(compile_mission({})),150)
    for changes in [dict(track='T999'),dict(track='T2'),dict(tick=149),dict(order=5),dict(decision_version='future'),dict(reason='future')]:
        assert not sim.act({**action(sim),**changes})
    sim.paused=True;assert not sim.act(action(sim));sim.paused=False
    sim.end_acquisition();assert not sim.act(action(sim))


def test_versioned_snapshot_recomposes_and_old_compiler_stays_frozen():
    s=compile_mission({'seed':0});validate_snapshot(s)
    for mutate in [lambda x:x['decision_policy'].update(version='future'),lambda x:x['observation_mission']['objectives'].append('forged'),lambda x:x['decision_policy']['reasons'].reverse()]:
        bad=copy.deepcopy(s);mutate(bad)
        with pytest.raises(ValueError):validate_snapshot(bad)
    with pytest.raises(ValueError):Simulation({**s,'engine_version':'vyuha-0.7.0'})
    assert v1_mission({})['engine_version']=='vyuha-0.5.0'


def test_educational_defer_review_never_infers_inactivity_or_changes_frozen_rubric():
    s=compile_mission({});sim=advance(Simulation(s),150)
    blank,blank_card=build_review(s,[],[],'blank',180,'completion',2700)
    assert blank['observation_assessment']['decisions']==[]
    assert all(c['status']=='unassessable' for c in blank['observation_assessment']['competencies'])
    assert sim.act(action(sim));r,card=build_review(s,sim.events,[],'declared',180,'completion',2700)
    assert card==blank_card
    report=r['observation_assessment'];assert report['version']=='evidence-assessment-v2'
    assert report['decisions'][0]['status']=='supported'
    assert report['decisions'][0]['action']['k']=='defer'
    assert next(c for c in report['competencies'] if c['id']=='C03')['status']=='supported'
    assert not report['summary']['mastery_awarded']
    assert 'mission_version=2' in report['follow_up']['href']
    assert any(t['code']=='defer' for t in r['timeline'])
    assert all(d['trainee_action'] is None or d['trainee_action']['k']!='defer' for d in r['decision_reviews'])


def test_v2_auth_completion_transfer_and_profile_isolation(client,monkeypatch,tmp_path):
    from server import storage
    from server.tests.test_hardening import KEY
    from server.storage import dumps
    auth=client.headers.pop('Authorization')
    for route in ('compile','publish'):
        assert client.post('/api/v1/observation-missions-v2/'+route,json={}).status_code==401
    s=client.post('/api/v1/observation-missions-v2/prepare',json={'template':'timed_window','mode':'assessment'}).json()
    assert s['fusion']['mode']=='assessment';validate_snapshot(s)
    assert client.get('/api/v1/observation-missions-v2/'+s['id']).json()==s
    old=client.post('/api/v1/observation-missions/prepare',json={}).json()
    old_sid=client.post('/api/v1/sessions',json={'scenario_id':old['id']}).json()['id']
    sim=advance(Simulation(s),150);assert sim.act(action(sim))
    assert client.post(f'/api/v1/sessions/{old_sid}/events',json={'seq':0,'events':sim.events}).status_code==422
    sid=client.post('/api/v1/sessions',json={'scenario_id':s['id'],'trainee':'DEFER-QA'}).json()['id']
    body={'seq':0,'events':sim.events}
    assert client.post(f'/api/v1/sessions/{sid}/events',json=body).status_code==200
    assert client.post(f'/api/v1/sessions/{sid}/events',json=body).json()['duplicate']
    assert client.post(f'/api/v1/sessions/{sid}/complete',json={'end_tick':2700,'execution_tick':180}).status_code==200
    original=client.get(f'/api/v1/sessions/{sid}/aar').json();assert original['verified']
    p=client.get('/api/v1/trainees/DEFER-QA/profile').json();assert p['sessions']==0
    progress=client.get('/api/v1/observation-learning/trainees/DEFER-QA/progression').json()
    assert progress['version']=='observation-progression-v2' and progress['assessment']['sessions']==1
    assert progress['assessment']['competencies']['C03']['supported']==1
    assert 'mission_version=2' in progress['recommendation']['href']
    with storage.connect() as db:
        assert db.execute('SELECT COUNT(*) FROM skill_outcomes WHERE trainee=?',('DEFER-QA',)).fetchone()[0]==0
    client.headers['Authorization']=auth;monkeypatch.setenv('VYUHA_BUNDLE_SECRET',KEY)
    exported=client.post('/api/v1/units/local/bundle/export',json={});assert exported.status_code==200,exported.text
    monkeypatch.setattr(storage,'DB_PATH',tmp_path/'restored-v2.db');storage.init()
    imported=client.post('/api/v1/bundle/import',json=exported.json());assert imported.status_code==200,imported.text
    restored=client.get(f'/api/v1/sessions/{sid}/aar').json()
    assert restored['observation_assessment']==original['observation_assessment']
    assert restored['scorecard']==original['scorecard'] and restored['events']==original['events']
    assert client.post('/api/v1/bundle/import',json=exported.json()).json()['skipped_sessions']==1

def test_author_v2_rehearsal_runs_actual_new_engine_without_copying_probe_actions(client):
    compiled=client.post('/api/v1/observation-missions-v2/compile',json={'version':'observation-mission-v2','template':'night_switch','duration':60})
    assert compiled.status_code==200,compiled.text
    body=compiled.json();validate_snapshot(body['scenario'])
    assert body['rehearsal']['attainable_probe']
    assert all(a['k']=='inspect' for a in body['rehearsal']['request_schedule'])
    saved=client.post('/api/v1/observation-missions-v2/publish',json={'version':'observation-mission-v2','template':'night_switch','duration':60})
    assert saved.json()==body['scenario']
    assert 'results' not in saved.json()['observation_mission']


def test_explicit_reason_does_not_fabricate_evidence_or_confidence_and_new_contract_stays_out_of_crew(client):
    from server.observation_assessment_v2 import interpret
    from server.observation_assessment import public_facts
    s=compile_mission({'template':'civil_restraint'});sim=advance(Simulation(s),180)
    t=next(t for t in sim.tracks if t['id']=='T2')
    f=public_facts(sim,t);f['observation']['iff']=dict(available=True,cue='registered_civil')
    a=action(sim,track='T2')
    assert interpret(a,f,'civil_restraint')[0]['status']=='inconclusive'
    assert 'positive non-hostile cue' in interpret(a,f,'civil_restraint')[0]['explanation']
    a['reason']='conflicting_reports';assert interpret(a,f,'civil_restraint')[0]['status']=='inconclusive'
    old=copy.deepcopy(f);f['kind']='fiber_fpv';f['identity']='hostile'
    assert interpret(a,f,'civil_restraint')==interpret(a,old,'civil_restraint')
    prepared=client.post('/api/v1/observation-missions-v2/prepare',json={}).json()
    denied=client.post('/api/v1/crews',json={'name':'Unadmitted contract QA','scenario_id':prepared['id'],'members':[{'callsign':'WATCH','role':'spotter'},{'callsign':'RESP','role':'responder'}]})
    assert denied.status_code==422 and 'shared v0.4' in denied.json()['detail']

def test_v2_compiler_defaults_are_frozen_and_future_edits_cannot_rebase_existing_missions():
    from pathlib import Path
    fixture=json.loads((Path(__file__).parent/'fixtures/observation-missions-v2.json').read_text())
    for case in fixture['cases']:
        assert compile_mission(case['request'])==case['scenario']
        validate_snapshot(case['scenario'])


def test_defer_confidence_is_not_classification_and_fusion_frontier_includes_new_decision_order():
    from server.fusion import advice,Exposure,validate_exposure
    s=compile_mission({});sim=advance(Simulation(s),150)
    before=copy.deepcopy(sim.tracks[0]);assert sim.act(action(sim))
    result=advice(before['observation'],dict(kind=None,identity=None),s['fusion'],dict(session_id='confidence',scenario_id=s['id'],before_order=0))
    exposure=Exposure(tick=150,before_order=0,track='T1',exposure_id=result['exposure_id'],action_order=0)
    receipt=validate_exposure(s,sim.events,[],'confidence',exposure,150)
    assert receipt['alignment']['relation']=='unassessable' and receipt['confidence_diagnostic'] is None
    forged=exposure.model_copy(update={'distribution':dict(bird=.25,quad=.25,fixed_wing=.25,fiber_fpv=.25)})
    with pytest.raises(ValueError,match='not a classification confidence'):validate_exposure(s,sim.events,[],'confidence',forged,150)
