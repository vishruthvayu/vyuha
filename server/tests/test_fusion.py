import copy
import json
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from server import storage
from server.engine import replay
from server.fusion import Exposure, advice, brier_score, configuration, ensure_schema, reconstruct_boundaries, router, sanitize_evidence, validate_exposure
from server.raid_v2 import compose_raid
from server.storage import dumps

OBS = dict(version='vyuha-0.4.0',tick=30,track_id='T1',radar=dict(available=True,state='confirmed',sample_tick=30),eo=dict(available=True,level='recognise',silhouette='multirotor',sample_tick=30),ir=dict(available=False),rf=dict(available=True,detected=False),iff=dict(available=True,cue='no_reply'))


def test_truth_free_equal_evidence_gives_equal_outputs_and_silence_never_hostile():
    a = advice(OBS)
    assert advice(dict(OBS,kind='quad',identity='hostile',ground_truth=dict(rf=True))) == a
    assert advice(dict(OBS,kind='fiber_fpv',identity='friendly')) == a
    assert a['identity'] == 'unresolved' and a['recommendation'] == 'verify_identity'
    assert advice(OBS,dict(identity='hostile'))['identity'] == 'unresolved'
    assert abs(next(h['score'] for h in a['hypotheses'] if h['kind']=='quad') - next(h['score'] for h in a['hypotheses'] if h['kind']=='fiber_fpv')) < .025


def test_evidence_sanitizer_ignores_stale_unavailable_and_unresolved_shapes():
    for optical in [dict(OBS['eo'],available=False),dict(OBS['eo'],sample_tick=23),dict(OBS['eo'],sample_tick=31),dict(OBS['eo'],level='detect')]:
        assert not any(c['cue']=='optical_shape' for c in advice(dict(OBS,eo=optical))['contributions'])
    assert sanitize_evidence(dict(OBS,iff=dict(available=False,cue='friendly_reply')))['iff']=='unavailable'
    assert advice(OBS,config=dict(mode='assessment')) is None
    with pytest.raises(ValueError): configuration(dict(bias_seed=float('nan')))


def test_correlated_shapes_not_double_counted_and_bias_exercise_is_reproducibly_wrong():
    assert advice(OBS)['hypotheses']==advice(dict(OBS,ir=OBS['eo']))['hypotheses']
    bird=dict(OBS,eo=dict(OBS['eo'],silhouette='bird'))
    assert advice(bird)['hypotheses'][0]['kind']=='bird'
    biased=advice(bird,config=dict(exercise='rf_overweight',bias_seed=2))
    assert biased['bias_injected'] and biased['hypotheses'][0]['kind']=='quad'
    assert biased==advice(bird,config=dict(exercise='rf_overweight',bias_seed=2))


def test_brier_score_proper_bounds_and_rejects_invalid_confidence():
    assert brier_score(dict(bird=1,quad=0,fixed_wing=0,fiber_fpv=0),'bird')==0
    assert brier_score(dict(bird=1,quad=0,fixed_wing=0,fiber_fpv=0),'quad')==2
    assert brier_score(dict.fromkeys(['bird','quad','fixed_wing','fiber_fpv'],.25),'quad')==.75
    with pytest.raises(ValueError): brier_score(dict(bird=float('nan'),quad=0,fixed_wing=0,fiber_fpv=1),'quad')


@pytest.fixture
def scenario():
    s=compose_raid(dict(seed=7,duration=90,terrain='rural',night=False,fog=0.,contacts=2))
    s['fusion']=configuration()
    s['tracks']=s['tracks'][:1]
    s['tracks'][0].update(spawn=0,distance=100,speed=2,altitude=20,kind='quad',identity='hostile',rf=True)
    s['terrain_boxes']=[]
    s['sensor_config']=dict(optical_reliability=1.,radar_reliability=1.,rf_reliability=1.)
    return s


def fixture_receipt(s, tick=60, before_order=0):
    sim=replay(s,[],tick)
    track=sim.tracks[0]
    result=advice(track['observation'],config=s['fusion'],context=dict(session_id='S1',scenario_id=s['id'],before_order=before_order))
    return Exposure(tick=tick,before_order=before_order,track=track['id'],exposure_id=result['exposure_id'],action_order=1,association='unspecified',distribution=dict.fromkeys(['bird','quad','fixed_wing','fiber_fpv'],.25))


def fixture_events(s):
    t=s['tracks'][0]['id']
    return [dict(tick=60,order=0,k='designate',track=t),dict(tick=60,order=1,k='classify',track=t,kind='quad',identity='hostile')]


def test_reconstruction_uses_prefix_and_never_future_operator_labels(scenario):
    e=fixture_receipt(scenario); events=fixture_events(scenario)
    original=copy.deepcopy((scenario,events))
    receipt=validate_exposure(scenario,events,[],'S1',e,90)
    assert receipt['advice']['prior']==dict(kind=None,identity=None)
    assert receipt['confidence_diagnostic']['value']==.75
    assert receipt['association']=='unspecified'
    assert receipt['alignment']['relation'] in ['aligned','overrode']
    assert (scenario,events)==original
    boundaries=reconstruct_boundaries(scenario,events,[],[e])
    assert validate_exposure(scenario,events,[],'S1',e,90,_boundary=boundaries[(60,0)])==receipt
    for changed in [dict(exposure_id='fusion-00000000'),dict(tick=91),dict(before_order=3),dict(action_order=99),dict(action_order=0,track='T2')]:
        with pytest.raises(ValueError):validate_exposure(scenario,events,[],'S1',e.model_copy(update=changed),90)
    with pytest.raises(ValueError):validate_exposure(dict(scenario,fusion=configuration(dict(mode='assessment'))),events,[],'S1',e,90)


def test_same_tick_boundary_bound_to_receipt_and_rf_fault_is_seen_before_action(scenario):
    e=fixture_receipt(scenario);events=fixture_events(scenario)
    with pytest.raises(ValueError): validate_exposure(scenario,events,[],'S1',e.model_copy(update=dict(before_order=1)),90)
    command=dict(command_id='fault',session_id='S1',seq=1,issued_at='test',tick=60,order=0,type='sensor_fault',payload=dict(sensor='rf',mode='failed'))
    shifted=[dict(a,order=a['order']+1) for a in events]
    sim=replay(scenario,[],60,[command]);track=sim.tracks[0]
    a=advice(track['observation'],config=scenario['fusion'],context=dict(session_id='S1',scenario_id=scenario['id'],before_order=1))
    fault=Exposure(tick=60,before_order=1,track=track['id'],exposure_id=a['exposure_id'],action_order=2)
    boundaries=reconstruct_boundaries(scenario,shifted,[command],[fault])
    receipt=validate_exposure(scenario,shifted,[command],'S1',fault,90,_boundary=boundaries[(60,1)])
    assert receipt['advice']['evidence']['rf']=='unavailable'


@pytest.fixture
def client(tmp_path,monkeypatch,scenario):
    monkeypatch.setattr(storage,'DB_PATH',tmp_path/'fusion.db')
    storage.init()
    with storage.connect() as db:
        ensure_schema(db)
        db.execute('INSERT INTO scenarios VALUES (?,?)',(scenario['id'],dumps(scenario)))
        db.execute("INSERT INTO sessions(id,trainee,scenario_id,created_at,status,scorecard,end_tick,execution_tick) VALUES ('S1','C',?,'test','completed',?,2700,90)",(scenario['id'],dumps(dict(score=12))))
        db.execute('INSERT INTO chunks VALUES (?,?,?)',('S1',0,dumps(fixture_events(scenario))))
        db.execute("INSERT INTO skill_profiles VALUES ('C','detection',3,2,'test','S1')")
    app=FastAPI();app.include_router(router)
    with TestClient(app) as c:yield c


def test_receipts_idempotent_conflicts_rejected_and_original_score_beta_unchanged(client,scenario):
    body=dict(exposures=[fixture_receipt(scenario).model_dump()])
    with storage.connect() as db:
        original=(tuple(db.execute('SELECT * FROM sessions').fetchone()),tuple(db.execute('SELECT * FROM skill_profiles').fetchone()),tuple(db.execute('SELECT * FROM chunks').fetchone()))
    for _ in range(2):assert client.post('/api/v1/sessions/S1/fusion-exposures',json=body).status_code==200
    review=client.get('/api/v1/sessions/S1/fusion-review').json()
    assert len(review['exposures'])==1 and review['confidence_diagnostic']['mean_brier']==.75
    bad=copy.deepcopy(body);bad['exposures'][0]['association']='accepted'
    assert client.post('/api/v1/sessions/S1/fusion-exposures',json=bad).status_code==409
    with storage.connect() as db:
        assert original==(tuple(db.execute('SELECT * FROM sessions').fetchone()),tuple(db.execute('SELECT * FROM skill_profiles').fetchone()),tuple(db.execute('SELECT * FROM chunks').fetchone()))
        assert db.execute('SELECT COUNT(*) FROM fusion_exposures').fetchone()[0]==1


def test_active_reference_confidence_queries_rejected_and_forgery_is_atomic(client,scenario):
    with storage.connect() as db:db.execute("UPDATE sessions SET status='active',execution_tick=NULL,control_state=? WHERE id='S1'",(dumps(dict(tick=90)),))
    e=fixture_receipt(scenario).model_dump()
    assert client.post('/api/v1/sessions/S1/fusion-exposures',json=dict(exposures=[e])).status_code==422
    e.pop('distribution');bad=dict(e,exposure_id='fusion-00000000')
    assert client.post('/api/v1/sessions/S1/fusion-exposures',json=dict(exposures=[e,bad])).status_code==422
    assert client.get('/api/v1/sessions/S1/fusion-review').json()['exposures']==[]
    assert client.post('/api/v1/sessions/S1/fusion-exposures',json=dict(exposures=[e])).status_code==200
