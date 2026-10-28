"""Held-out synthetic support cases, separate from the compiler's witness probe."""
import copy
import json
import pytest
from server.observation_assessment import assess_mission, interpret, public_facts, progression
from server.observation_missions import compile_mission
from server.engine import Simulation, score
from server.review import build_review
from server.tests.test_api import client


def at(sim,tick):
    while sim.tick<tick:sim.step(force=True)
    return sim


def facts(*,shape=None,iff='no_reply',level='none',rf=True):
    optical=dict(available=True,level=level,silhouette=shape,position=None,sample_tick=None)
    return dict(tick=200,track='T1',has_geometry=True,current_optical_results=[],observation=dict(radar=dict(available=True,position=dict(x=20,z=30,altitude=10)),rf=dict(available=True,detected=rf),iff=dict(available=iff!='unavailable',cue=iff),eo=copy.deepcopy(optical),ir=copy.deepcopy(optical)))


def test_type_identity_and_outcome_are_distinct_even_with_current_optics():
    action=dict(k='classify',kind='quad',identity='hostile')
    result=interpret(action,facts(shape='multirotor',level='recognise'),'night_switch')
    assert result[0]['status']=='supported' and result[0]['code']=='PROVISIONAL_RF_MULTIROTOR'
    assert result[1]['status']=='unsupported' and result[1]['code']=='HOSTILITY_NOT_ESTABLISHED'
    empty=interpret(action,facts(),'night_switch')
    assert empty[0]['status']=='inconclusive'
    assert empty[1]['status']=='unsupported'


def test_positive_iff_supports_identity_and_restraint_without_optical_reports():
    evidence=facts(iff='friendly_reply')
    report=interpret(dict(k='classify',kind='quad',identity='friendly'),evidence,'civil_restraint')
    assert report[0]['status']=='inconclusive'
    assert report[1]['status']=='supported'
    hold=interpret(dict(k='engage',effector='hold'),evidence,'civil_restraint')
    assert hold[0]['status']=='supported' and hold[0]['code']=='POSITIVE_CUE_RESTRAINT'
    destructive=interpret(dict(k='engage',effector='rf_jam'),evidence,'civil_restraint')
    assert destructive[0]['code']=='POSITIVE_NONHOSTILE_CUE_IGNORED'


def test_uncertain_hold_is_supported_but_silence_never_proves_fibre_or_hostility():
    evidence=facts(rf=False)
    assert interpret(dict(k='engage',effector='hold'),evidence,'timed_window')[0]['code']=='UNCERTAINTY_RETAINED'
    result=interpret(dict(k='classify',kind='fiber_fpv',identity='hostile'),evidence,'timed_window')
    assert [r['status'] for r in result]==['unsupported','unsupported']
    assert result[0]['code']=='CONTROL_MEDIUM_NOT_OBSERVED'


def test_public_interpretation_is_invariant_to_injected_canonical_truth():
    original=facts(shape='bird',level='identify')
    action=dict(k='classify',kind='bird',identity='neutral')
    expected=interpret(action,original,'civil_restraint')
    adversarial=copy.deepcopy(original)
    adversarial.update(kind='fiber_fpv',identity='hostile',rf_link=False,x=0,z=0,canonical_identity='friendly')
    adversarial['observation'].update(kind='hostile_quad',truth=dict(identity='hostile'))
    assert interpret(action,adversarial,'civil_restraint')==expected


def example():
    scenario=compile_mission(dict(template='night_switch',night=False,seed=482913,fog=.15))
    sim=at(Simulation(scenario),150)
    assert sim.act(dict(k='designate',track='T1',tick=150,order=sim.next_order))
    assert sim.act(dict(k='inspect',track='T1',tick=150,order=sim.next_order,channel='ir',request_id='first'))
    at(sim,186)
    assert sim.act(dict(k='classify',track='T1',tick=186,order=sim.next_order,kind='quad',identity='hostile'))
    assert sim.act(dict(k='engage',track='T1',tick=186,order=sim.next_order,effector='rf_jam'))
    return scenario,sim


def test_high_rubric_score_can_coexist_with_unestablished_identity_and_no_score_rewrite():
    scenario,sim=example()
    before=copy.deepcopy((scenario,sim.events))
    review,card=build_review(scenario,sim.events,[],'support-case',200,'completion',2700)
    plain=copy.deepcopy(scenario);plain.pop('observation_mission')
    old_review,old_card=build_review(plain,sim.events,[],'support-case',200,'completion',2700)
    assert card==old_card and card['score']==100
    assert 'observation_assessment' not in old_review
    report=review['observation_assessment']
    assert report['version']=='evidence-assessment-v1'
    assert report['summary']['mastery_awarded'] is False
    assert report['decisions'][-2]['findings'][-1]['code']=='HOSTILITY_NOT_ESTABLISHED'
    assert report['decisions'][-1]['findings'][0]['code']=='DESTRUCTIVE_BASIS_UNESTABLISHED'
    assert (scenario,sim.events)==before
    assert report==assess_mission(scenario,sim.events,[],'support-case',200)


def test_same_tick_release_precedes_decision_and_future_sample_does_not_leak():
    scenario,sim=example()
    report=assess_mission(scenario,sim.events,[],'boundary',200)
    q=report['acquisitions'][0]
    decision=next(d for d in report['decisions'] if d['action']['k']=='classify')
    assert q['release_tick']==decision['tick']==186
    assert decision['order']>sim.acquisition_snapshot()['results'][0]['releasedOrder']
    assert q['result_id'] in [r['resultId'] for r in decision['available_evidence']['current_optical_results']]
    prefix=[e for e in sim.events if e['tick']<186]
    early=assess_mission(scenario,prefix,[],'early',180)
    assert early['acquisitions'][0]['utility']=='unassessable'
    assert early['acquisitions'][0]['result_id'] is None
    assert early['competencies'][1]['status']=='unassessable'


def test_expiry_is_not_a_blanket_failure_and_redundant_requests_earn_no_observations():
    scenario=compile_mission(dict(template='civil_restraint',seed=482913,expiry_ticks=30))
    sim=at(Simulation(scenario),150)
    assert sim.act(dict(k='inspect',track='T1',tick=150,order=sim.next_order,channel='ir',request_id='ir1'))
    at(sim,220)
    assert sim.acquisition_snapshot()['results'][0]['expiryTick']<=sim.tick
    # No decisions: released or repeated requests cannot create supported competencies.
    assert sim.act(dict(k='inspect',track='T1',tick=220,order=sim.next_order,channel='ir',request_id='ir2'))
    report=assess_mission(scenario,sim.events,[],'no-credit',260)
    assert len(report['acquisitions'])==2
    assert all(c['status']=='unassessable' for c in report['competencies'])
    assert not report['summary']['mastery_awarded']


def test_night_unavailable_result_is_reported_without_inventing_detection():
    scenario=compile_mission(dict(template='night_switch',seed=482913))
    sim=at(Simulation(scenario),150)
    assert sim.act(dict(k='inspect',track='T1',tick=150,order=sim.next_order,channel='eo',request_id='unavailable'))
    report=assess_mission(scenario,sim.events,[],'night',200)
    assert report['acquisitions'][0]['utility']=='no_new_decision_feature'
    assert report['acquisitions'][0]['available_before_decisions']==[]
    assert all(c['status']=='unassessable' for c in report['competencies'])


def test_unknown_version_and_future_events_fail_closed():
    scenario,sim=example();bad=copy.deepcopy(scenario)
    bad['observation_mission']['assessment_version']='future'
    with pytest.raises(ValueError):assess_mission(bad,sim.events,[],'bad',200)
    with pytest.raises(ValueError):assess_mission(scenario,sim.events,[],'bad',170)
    original=copy.deepcopy(scenario);original.pop('observation_mission')
    assert assess_mission(original,sim.events,[],'legacy',200) is None


def test_progression_is_read_only_separates_modes_and_recommends_relevant_practice(client):
    from server import storage
    from server.storage import dumps
    sid_list=[]
    for mode in ('practice','assessment'):
        scenario=compile_mission(dict(template='night_switch',night=False,seed=482913,mode=mode))
        _,sim=example()
        with storage.connect() as db:db.execute('INSERT INTO scenarios VALUES (?,?)',(scenario['id'],dumps(scenario)))
        sid=client.post('/api/v1/sessions',json={'scenario_id':scenario['id'],'trainee':'evidence-person'}).json()['id'];sid_list.append(sid)
        assert client.post(f'/api/v1/sessions/{sid}/events',json={'seq':0,'events':sim.events}).status_code==200
        result=client.post(f'/api/v1/sessions/{sid}/complete',json={'end_tick':2700,'execution_tick':200})
        assert result.status_code==200,result.text
    with storage.connect() as db:
        before=[tuple(r) for r in db.execute('SELECT * FROM sessions')]
        assert db.execute("SELECT COUNT(*) FROM skill_outcomes WHERE trainee='evidence-person'").fetchone()[0]==0
    for sid in sid_list:
        aar=client.get(f'/api/v1/sessions/{sid}/aar')
        assert aar.status_code==200,aar.text
        assert aar.json()['observation_assessment']['session_id']==sid
        assert aar.json()['observation_assessment']['summary']['mastery_awarded'] is False
    route=client.get('/api/v1/observation-learning/trainees/evidence-person/progression')
    assert route.status_code==200,route.text
    report=progression('evidence-person')
    assert report==progression('evidence-person')
    assert report['practice']['sessions']==report['assessment']['sessions']==1
    assert report['assessment']['competencies']['C02']['unsupported']==1
    assert report['recommendation']['template']=='civil_restraint'
    assert report['recommendation']['mode']=='practice'
    assert report['recommendation']['based_on'][0]['mode']=='assessment'
    assert report['window']['completed_mission_sessions']==2
    with storage.connect() as db:assert before==[tuple(r) for r in db.execute('SELECT * FROM sessions')]


def test_repeated_fresh_feature_requests_are_described_without_invented_credit():
    scenario=compile_mission(dict(template='night_switch',night=False,seed=482914,expiry_ticks=300))
    sim=at(Simulation(scenario),150)
    assert sim.act(dict(k='inspect',track='T1',tick=150,order=sim.next_order,channel='ir',request_id='fresh1'))
    at(sim,192)
    assert sim.act(dict(k='inspect',track='T1',tick=192,order=sim.next_order,channel='ir',request_id='fresh2'))
    report=assess_mission(scenario,sim.events,[],'refresh',230)
    assert report['acquisitions'][0]['utility']=='new_reported_feature'
    assert report['acquisitions'][1]['utility']=='no_new_decision_feature'
    assert all(c['status']=='unassessable' for c in report['competencies'])
    assert report['summary']['mastery_awarded'] is False
    assert any('unclassified defer' in limit for limit in report['limitations'])


def test_transfer_regenerates_educational_report_and_duplicate_import_keeps_history(client,monkeypatch,tmp_path):
    from server import storage
    from server.tests.test_hardening import KEY
    from server.storage import dumps
    monkeypatch.setenv('VYUHA_BUNDLE_SECRET',KEY)
    scenario,sim=example()
    with storage.connect() as db:db.execute('INSERT INTO scenarios VALUES (?,?)',(scenario['id'],dumps(scenario)))
    sid=client.post('/api/v1/sessions',json={'scenario_id':scenario['id'],'trainee':'transfer-evidence'}).json()['id']
    assert client.post(f'/api/v1/sessions/{sid}/events',json={'seq':0,'events':sim.events}).status_code==200
    assert client.post(f'/api/v1/sessions/{sid}/complete',json={'end_tick':2700,'execution_tick':200}).status_code==200
    original=client.get(f'/api/v1/sessions/{sid}/aar').json()
    exported=client.post('/api/v1/units/local/bundle/export',json={})
    assert exported.status_code==200,exported.text
    bundle=exported.json()
    assert bundle['payload']['sessions'][0]['outcomes'] is None
    monkeypatch.setattr(storage,'DB_PATH',tmp_path/'education-restored.db');storage.init()
    imported=client.post('/api/v1/bundle/import',json=bundle)
    assert imported.status_code==200,imported.text
    restored=client.get(f'/api/v1/sessions/{sid}/aar')
    assert restored.status_code==200,restored.text
    assert restored.json()['observation_assessment']==original['observation_assessment']
    assert restored.json()['scorecard']==original['scorecard']
    assert client.post('/api/v1/bundle/import',json=bundle).json()['skipped_sessions']==1


def test_real_replay_positive_iff_still_supports_restraint_after_optical_expiry():
    scenario=compile_mission(dict(template='civil_restraint',seed=482913,expiry_ticks=30))
    sim=at(Simulation(scenario),270)
    assert sim.act(dict(k='inspect',track='T3',tick=270,order=sim.next_order,channel='ir',request_id='expired_friendly'))
    at(sim,340)
    while sim.tick<500 and sim.tracks[2]['observation']['iff']['cue']!='friendly_reply':sim.step(force=True)
    assert sim.tracks[2]['observation']['iff']['cue']=='friendly_reply'
    assert sim.acquisition_snapshot()['results'][0]['expiryTick']<sim.tick
    for fields in [dict(k='designate'),dict(k='classify',kind='quad',identity='friendly'),dict(k='engage',effector='hold')]:
        assert sim.act(dict(tick=sim.tick,order=sim.next_order,track='T3',**fields))
    report=assess_mission(scenario,sim.events,[],'iff-survives-expiry',sim.tick)
    classified=next(d for d in report['decisions'] if d['action']['k']=='classify')
    held=report['decisions'][-1]
    assert classified['available_evidence']['current_optical_results']==[]
    assert classified['findings'][1]['status']=='supported'
    assert classified['findings'][1]['code']=='POSITIVE_FRIENDLY_IFF'
    assert held['status']=='supported'
    assert held['findings'][0]['code']=='POSITIVE_CUE_RESTRAINT'
