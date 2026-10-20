import copy
import json
import pytest
from server.engine import Simulation, make_scenario, replay, score, ideal, engagement_rule
from server.review import build_review
from server.tests.test_api import client, session
from server.tests.test_instructor import issue, heartbeat
from server import storage


def control(seq, kind, payload, tick, order):
    return dict(command_id=f'c{seq}',session_id='review-test',seq=seq,issued_at='2026-10-03T00:00:00Z',type=kind,payload=payload,tick=tick,order=order)


def injected(kind='fiber_fpv', bearing=40):
    return [control(1,'inject_contact',dict(kind=kind,bearing=bearing),30,0)]


def actions(tick=30, track='T9', kind='fiber_fpv', identity='hostile', effector='rf_jam', start=1):
    return [dict(tick=tick,order=start,k='designate',track=track),
            dict(tick=tick,order=start+1,k='classify',track=track,kind=kind,identity=identity),
            dict(tick=tick,order=start+2,k='engage',track=track,effector=effector)]


def engagement(result, track='T9'):
    return next(r for r in result['decision_reviews'] if r['track_id']==track and r['decision_kind']=='engagement')


def first_tick(spec, track):
    sim=Simulation(spec)
    target=next(t for t in sim.tracks if t['id']==track)
    while target['detected'] is None:sim.step()
    return sim.tick


def test_no_rf_jammer_links_observed_impact_and_real_node_score():
    spec=make_scenario();review,card=build_review(spec,actions(),injected(),'test',2250)
    r=engagement(review)
    assert r['expected_action']['effector']=='kinetic' and r['trainee_action']['effector']=='rf_jam'
    assert r['reason_code']=='NO_RF_JAM_INEFFECTIVE' and r['verdict']=='incorrect'
    assert r['evidence']['rf']['signal'] is False and r['evidence']['rf']['iff']=='no_reply'
    assert r['evidence']['visual']['silhouette'] is None  # radar-only at this exact tick
    assert r['consequence']['kind']=='asset_impact' and r['consequence']['immediate']=='remained_active'
    assert r['consequence']['tick']>30 and 'later reached' in r['consequence']['text']
    assert r['score_effect']['points_awarded']==0 and r['score_effect']['session_penalty']==10
    assert r['score_effect']['penalty_basis']=='observed' and 'effector_choice' in r['skill_tags']
    assert card==score(replay(spec,actions(),2250,injected()))


def test_correct_jammer_and_kinetic_are_grounded_in_shared_rules():
    for kind,effector,code in [('quad','rf_jam','CORRECT_RF_JAM'),('fiber_fpv','kinetic','CORRECT_KINETIC')]:
        result,_=build_review(make_scenario(),actions(kind=kind,effector=effector),injected(kind),'test',2250)
        r=engagement(result)
        assert r['verdict']=='correct' and r['reason_code']==code
        assert r['consequence']['kind']=='resolved' and r['consequence']['tick']==30
        assert r['score_effect']['points_awarded']==35


@pytest.mark.parametrize('track,kind,identity,code',[('T2','quad','friendly','FRIENDLY_ENGAGED'),('T1','bird','neutral','NEUTRAL_ENGAGED')])
def test_non_hostile_engagement_requires_hold_and_matches_actual_failure(track,kind,identity,code):
    spec=make_scenario();tick=first_tick(spec,track)
    result,card=build_review(spec,actions(tick,track,kind,identity,'kinetic',0),[],'test',2250)
    r=engagement(result,track)
    assert r['expected_action']['effector']=='hold' and r['reason_code']==code
    assert r['score_effect']['session_failure']==card['fratricide']==True


def test_radar_rf_failures_do_not_leak_hidden_evidence():
    cs=[control(1,'sensor_fault',dict(sensor='radar',mode='failed'),0,0),
        control(2,'sensor_fault',dict(sensor='rf',mode='failed'),0,1),
        control(3,'inject_contact',dict(kind='fiber_fpv',bearing=40),30,2)]
    result,_=build_review(make_scenario(),actions(tick=31,start=3),cs,'test',2250)
    r=engagement(result)
    assert r['evidence']['radar']==dict(available=False,state='failed',detected=False)
    assert r['evidence']['rf']==dict(available=False,signal=None,iff='unavailable')
    assert r['ground_truth']['rf_link'] is False and r['ground_truth']['identity']=='hostile'
    assert 'not visible in the RF panel' in r['explanation']
    assert r['expected_action']['basis']=='ground_truth_reference'
    assert 'degraded_sensor_response' in r['skill_tags']
    assert any(e['category']=='sensor_transition' and 'radar failed' in e['title'].lower() for e in result['timeline'])


def test_unobserved_contact_has_no_target_rf_range_or_identity_evidence():
    spec=make_scenario();spec['tracks'][2]['distance']=170
    cs=[control(1,'sensor_fault',dict(sensor='radar',mode='failed'),0,0)]
    result,_=build_review(spec,[],cs,'test',65)
    r=next(r for r in result['decision_reviews'] if r['track_id']=='T3')
    assert r['reason_code']=='NO_EVIDENCE_AVAILABLE' and r['verdict']=='unassessable'
    assert r['evidence']['rf']['signal'] is None and r['evidence']['rf']['iff']=='unavailable'
    assert r['evidence']['range_m'] is None and r['evidence']['restricted'] is None
    assert r['evidence']['visual']['silhouette'] is None


def test_injected_restricted_contact_uses_hold_or_permitted_alternate():
    for kind,expected in [('fiber_fpv','hold'),('quad','rf_jam')]:
        result,card=build_review(make_scenario(),actions(kind=kind,effector='kinetic'),injected(kind,320),'test',2250)
        r=engagement(result)
        assert r['reason_code']=='KINETIC_ROE_RESTRICTED' and r['expected_action']['effector']==expected
        assert r['evidence']['restricted'] and card['roe_breaches']==1


def test_kinetic_out_of_range_has_measured_values_and_hold_reference():
    spec=make_scenario();spec['tracks'][3]['distance']=180
    tick=first_tick(spec,'T4')
    result,_=build_review(spec,actions(tick,'T4','fixed_wing','hostile','kinetic',0),[],'test',2250)
    r=engagement(result,'T4')
    assert r['reason_code']=='KINETIC_OUT_OF_RANGE' and r['evidence']['range_m']>160
    assert r['expected_action']['effector']=='hold'
    assert '160 m' in r['explanation'] and f"{r['evidence']['range_m']:.1f}" in r['explanation']


def test_classification_and_iff_errors_are_separate_from_available_identity():
    spec=make_scenario();tick=first_tick(spec,'T2')
    result,_=build_review(spec,actions(tick,'T2','fiber_fpv','hostile','hold',0),[],'test',2250)
    r=next(r for r in result['decision_reviews'] if r['decision_kind']=='classification_iff')
    assert r['reason_code']=='FRIENDLY_MISIDENTIFIED' and r['evidence']['rf']['iff']=='friendly_reply'
    assert r['expected_action']['kind']=='quad' and r['expected_action']['identity']=='friendly'
    assert r['score_effect']['points_awarded']==0
    result,_=build_review(make_scenario(),actions(kind='quad',effector='kinetic'),injected(),'test',2250)
    r=next(r for r in result['decision_reviews'] if r['decision_kind']=='classification_iff')
    assert r['reason_code']=='WRONG_TYPE' and r['score_effect']['points_awarded']==12


def test_detection_uses_first_working_sensor_observation_not_spawn_or_pause_issue_time():
    spec=make_scenario();spec['tracks'][2]['distance']=170
    cs=[control(1,'sensor_fault',dict(sensor='radar',mode='failed'),0,0),
        control(2,'sensor_restore',dict(sensor='radar'),300,1),
        control(3,'pause',{},300,2),control(4,'resume',{},300,3)]
    sim=replay(spec,[],300,cs);detected=next(t for t in sim.tracks if t['id']=='T3')['detected']
    assert detected is not None and detected>=300
    log=actions(450,'T3','quad','hostile','rf_jam',4)
    result,_=build_review(spec,log,cs,'test',2250)
    r=next(r for r in result['decision_reviews'] if r['track_id']=='T3' and r['decision_kind']=='detection')
    assert r['reason_code']=='DETECTION_LATE' and r['evidence']['first_detectable_tick']==detected
    assert '5.00s' in r['explanation'] and r['score_effect']['points_awarded']==22
    changed=copy.deepcopy(cs);changed[2]['issued_at']='2026-10-03T01:00:00Z';changed[3]['issued_at']='2026-10-04T01:00:00Z'
    assert build_review(spec,log,changed,'test',2250)==(result,score(replay(spec,log,2250,cs)))


def test_early_completion_excludes_future_events_and_labels_projected_penalty():
    result,_=build_review(make_scenario(),actions(),injected(),'test',60)
    assert max(e['tick'] for e in result['timeline'])<=60
    assert all(r['track_id'] in ['T1','T2','T3','T9'] for r in result['decision_reviews'])
    r=engagement(result)
    assert r['consequence']['kind']=='remained_active' and r['consequence']['tick'] is None
    assert r['score_effect']['penalty_basis']=='scoring_projection'
    assert not any(e['category']=='asset_impact' for e in result['timeline'])


def test_repeated_reconstruction_and_summary_are_deterministic():
    args=(make_scenario(),actions(),injected(),'test',2250)
    assert build_review(*args)==build_review(*copy.deepcopy(args))
    result,_=build_review(*args)
    assert result['ghost_summary']['mistake_counts']['effector_choice']==1
    assert result['ghost_summary']['largest_loss'] in {r['decision_id'] for r in result['decision_reviews']}


def test_no_errors_highlights_success_without_inventing_missing_decisions():
    sim=Simulation(make_scenario())
    while sim.tick<2250:
        for t in sim.tracks:
            if not t['active'] or t['detected'] is None:continue
            if t['designated'] is None:
                sim.act(dict(tick=sim.tick,k='designate',track=t['id']))
                sim.act(dict(tick=sim.tick,k='classify',track=t['id'],kind=t['kind'],identity=t['identity']))
            effector=ideal(t)
            if 'hold' not in t['attempts'] and (effector=='hold' or engagement_rule(t,effector)['effective']):
                sim.act(dict(tick=sim.tick,k='engage',track=t['id'],effector=effector))
        sim.step()
    result,card=build_review(sim.scenario,sim.events,[],'test',2250)
    assert card['score']==100 and result['ghost_summary']['no_major_errors']
    assert result['ghost_summary']['recommended_focus'] is None and result['ghost_summary']['strongest_decision']


def test_api_persists_execution_horizon_and_returns_equivalent_review_after_reload(client):
    spec,sid=session(client)
    c={**issue(client,sid,'inject_contact',dict(kind='fiber_fpv',bearing=40)),'tick':30,'order':0}
    assert heartbeat(client,sid,[c],tick=60).status_code==200
    assert client.post(f'/api/v1/sessions/{sid}/events',json={'seq':0,'events':actions()}).status_code==200
    assert client.post(f'/api/v1/sessions/{sid}/complete',json={'execution_tick':60}).status_code==200
    first=client.get(f'/api/v1/sessions/{sid}/aar').json()
    storage.init()
    assert client.get(f'/api/v1/sessions/{sid}/aar').json()==first
    assert first['executionTick']==60 and first['replay_metadata']['horizon_source']=='completion'
    assert 'decision_reviews' not in client.get('/api/v1/units/local/dashboard').json()['sessions'][0]
    assert client.get('/api/v1/contracts').json()['DecisionReview']


def test_incomplete_malformed_and_impossible_horizons_fail_gracefully(client):
    _,sid=session(client)
    assert client.get(f'/api/v1/sessions/{sid}/aar').status_code==409
    assert client.get('/api/v1/sessions/missing/aar').status_code==404
    client.post(f'/api/v1/sessions/{sid}/events',json={'seq':0,'events':[dict(tick=60,k='designate',track='T3')]})
    assert client.post(f'/api/v1/sessions/{sid}/complete',json={'execution_tick':20}).status_code==422
    assert client.post(f'/api/v1/sessions/{sid}/complete',json={'execution_tick':2251}).status_code==422
    assert client.post(f'/api/v1/sessions/{sid}/complete',json={}).status_code==200
    with storage.connect() as db:
        original=db.execute("SELECT scorecard FROM sessions WHERE id=?",(sid,)).fetchone()[0]
        forged=json.loads(original);forged['score']=1
        db.execute("UPDATE sessions SET scorecard=? WHERE id=?",(json.dumps(forged),sid))
    assert client.get(f'/api/v1/sessions/{sid}/aar').status_code==422
    with storage.connect() as db:db.execute("UPDATE sessions SET scorecard=? WHERE id=?",(original,sid))
    with storage.connect() as db:db.execute("UPDATE chunks SET payload=? WHERE session_id=?",(json.dumps([dict(tick=0,k='designate',track='T5')]),sid))
    assert client.get(f'/api/v1/sessions/{sid}/aar').status_code==422


def test_omission_evidence_is_from_first_detectability_not_a_later_sensor_fault():
    spec=make_scenario()
    cs=[control(1,'sensor_fault',dict(sensor='rf',mode='failed'),300,0)]
    result,_=build_review(spec,[],cs,'test',2250)
    r=next(r for r in result['decision_reviews'] if r['track_id']=='T3')
    assert r['reason_code']=='THREAT_MISSED' and r['evidence']['tick']<300
    assert r['evidence']['rf']['available'] and 'degraded_sensor_response' not in r['skill_tags']
    assert r['consequence']['kind']=='asset_impact' and r['consequence']['tick']<r['tick']
