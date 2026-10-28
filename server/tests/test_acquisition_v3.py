import copy
import pytest
from server.acquisition import make_practice, validate_snapshot_v3
from server.engine import Simulation, replay, score
from server.review import build_review
from server.models import Action
from server.tests.test_api import client


def at(sim, tick):
    while sim.tick < tick:
        sim.step(force=True)
    return sim


def inspect(sim, request='request_1', channel='eo', track='T1'):
    return dict(k='inspect', tick=sim.tick, order=sim.next_order, track=track, channel=channel, request_id=request)


def test_opt_in_masks_passive_optics_and_preserves_historical_dispatch():
    spec=make_practice()
    sim=at(Simulation(spec),150)
    assert all(t['observation'][c]['level']=='none' for t in sim.tracks for c in ('eo','ir'))
    old=copy.deepcopy(spec);old.pop('acquisition_policy');old['engine_version']='vyuha-0.4.0'
    assert not hasattr(Simulation(old),'acquisition')
    with pytest.raises(ValueError):Simulation(dict(spec,engine_version='vyuha-0.9.0'))


def test_scheduled_release_uses_global_order_and_sampling_is_not_early():
    spec=make_practice();sim=at(Simulation(spec),150)
    a=inspect(sim);assert sim.act(a)
    at(sim,179);assert sim.acquisition_snapshot()['results']==[]
    at(sim,180);assert sim.acquisition_snapshot()['samples']==[]
    at(sim,186);state=sim.acquisition_snapshot()
    assert state['results'][0]['sampleTick']==180 and state['results'][0]['releaseTick']==186
    assert state['results'][0]['releasedOrder']==1 and sim.next_order==2
    assert sim.act(dict(tick=186,order=2,k='designate',track='T1'))
    rebuilt=replay(spec,sim.events,186)
    assert rebuilt.acquisition_snapshot()==sim.acquisition_snapshot()
    assert rebuilt.events==sim.events


def test_duplicate_and_hidden_alias_rejection_do_not_consume_order_or_reroll():
    sim=at(Simulation(make_practice()),150)
    assert not sim.act(inspect(sim,track='T99'))
    assert sim.next_order==0
    a=inspect(sim);assert sim.act(a)
    assert not sim.act(dict(a,order=1))
    assert len(sim.events)==1 and sim.next_order==1
    assert not sim.act(inspect(sim,request='other'))
    assert len(sim.acquisition_snapshot()['requests'])==1


def test_night_eo_is_immutable_unavailable_and_expiry_hides_result():
    sim=at(Simulation(make_practice(night=True)),150)
    assert sim.act(inspect(sim));at(sim,186)
    state=sim.acquisition_snapshot();result=state['results'][0]
    assert result['reading']==dict(available=False,level='none')
    state['results'][0]['reading']['level']='identify'
    assert sim.acquisition_snapshot()['results'][0]['reading']['level']=='none'
    at(sim,276)
    assert sim.tracks[0]['observation']['eo']['level']=='none'


def test_policy_and_frozen_archive_hash_fail_closed():
    spec=make_practice();validate_snapshot_v3(spec)
    bad=copy.deepcopy(spec);bad['acquisition_policy']['dwellTicks']=0
    with pytest.raises(ValueError):validate_snapshot_v3(bad)
    bad=copy.deepcopy(spec);bad['night']=not bad['night']
    with pytest.raises(ValueError):validate_snapshot_v3(bad)
    with pytest.raises(ValueError):Action.model_validate(dict(k='inspect',tick=1,track='T1'))
    with pytest.raises(ValueError):Action.model_validate(dict(k='designate',tick=1,track='T1',channel='eo'))


def test_completion_cancels_pending_and_ghost_never_scores_inspect_as_decision():
    spec=make_practice();sim=at(Simulation(spec),150);assert sim.act(inspect(sim))
    review,card=build_review(spec,sim.events,[],'qa',160,'completion',2700)
    assert review['acquisition']['ended']
    assert review['acquisition']['results']==[]
    assert review['acquisition']['events'][-1]['kind']=='cancelled'
    assert not any(r['trainee_action'] and r['trainee_action']['k']=='inspect' for r in review['decision_reviews'])
    assert any(e['code']=='ACQUISITION_CANCELLED' for e in review['timeline'])
    assert card['engine_version']=='vyuha-0.5.0'


def test_live_api_persists_intents_and_reconstructs_verified_results(client):
    spec=client.post('/api/v1/acquisition/practice',json={'seed':482913,'night':True})
    assert spec.status_code==200,spec.text
    spec=spec.json();sim=at(Simulation(spec),150);assert sim.act(inspect(sim));at(sim,186)
    sid=client.post('/api/v1/sessions',json={'scenario_id':spec['id']}).json()['id']
    batch=client.post(f'/api/v1/sessions/{sid}/events',json={'seq':0,'events':sim.events})
    assert batch.status_code==200,batch.text
    complete=client.post(f'/api/v1/sessions/{sid}/complete',json={'end_tick':2700,'execution_tick':200})
    assert complete.status_code==200,complete.text
    result=client.get(f'/api/v1/sessions/{sid}/aar')
    assert result.status_code==200,result.text
    aar=result.json();assert aar['verified'] and aar['events']==sim.events
    assert aar['acquisition']['results'][0]['reading']==dict(available=False,level='none')
    assert client.post(f'/api/v1/sessions/{sid}/complete',json={'end_tick':2700,'execution_tick':200}).json()==complete.json()


def test_active_practice_transfer_regenerates_results_and_duplicate_protection(client,monkeypatch,tmp_path):
    from server import storage
    from server.tests.test_hardening import KEY
    monkeypatch.setenv('VYUHA_BUNDLE_SECRET',KEY)
    spec=client.post('/api/v1/acquisition/practice',json={'seed':482913,'night':True}).json()
    sim=at(Simulation(spec),150);assert sim.act(inspect(sim));at(sim,200)
    sid=client.post('/api/v1/sessions',json={'scenario_id':spec['id']}).json()['id']
    assert client.post(f'/api/v1/sessions/{sid}/events',json={'seq':0,'events':sim.events}).status_code==200
    assert client.post(f'/api/v1/sessions/{sid}/complete',json={'end_tick':2700,'execution_tick':200}).status_code==200
    original=client.get(f'/api/v1/sessions/{sid}/aar').json()
    with storage.connect() as db:
        assert db.execute('SELECT COUNT(*) FROM skill_outcomes WHERE session_id=?',(sid,)).fetchone()[0]==0
    exported=client.post('/api/v1/units/local/bundle/export',json={})
    assert exported.status_code==200,exported.text
    bundle=exported.json();assert bundle['payload']['sessions'][0]['outcomes'] is None
    monkeypatch.setattr(storage,'DB_PATH',tmp_path/'active-destination.db');storage.init()
    imported=client.post('/api/v1/bundle/import',json=bundle)
    assert imported.status_code==200,imported.text
    restored=client.get(f'/api/v1/sessions/{sid}/aar')
    assert restored.status_code==200,restored.text
    assert restored.json()['acquisition']==original['acquisition']
    assert restored.json()['scorecard']==original['scorecard']
    assert client.post('/api/v1/bundle/import',json=bundle).json()['skipped_sessions']==1


def test_fusion_boundary_counts_internal_releases_and_exposes_only_released_evidence():
    from server.fusion import advice, Exposure, validate_exposure,reconstruct_boundaries
    spec=make_practice();sim=at(Simulation(spec),150);assert sim.act(inspect(sim));at(sim,186)
    track=sim.tracks[0]
    value=advice(track['observation'],dict(kind=None,identity=None),spec['fusion'],dict(session_id='qa',scenario_id=spec['id'],before_order=sim.next_order))
    exposure=Exposure(tick=186,before_order=sim.next_order,track='T1',exposure_id=value['exposure_id'])
    boundaries=reconstruct_boundaries(spec,sim.events,[],[exposure])
    result=validate_exposure(spec,sim.events,[],'qa',exposure,200,_boundary=boundaries[(186,sim.next_order)])
    assert result['advice']==value


def test_legacy_batch_rejects_inspection_before_persistence_without_500(client):
    from server.storage import connect
    spec=client.post('/api/v1/scenarios/generate',json={}).json()
    assert spec.get('engine_version')!='vyuha-0.5.0'
    sid=client.post('/api/v1/sessions',json={'scenario_id':spec['id']}).json()['id']
    response=client.post(f'/api/v1/sessions/{sid}/events',json={'seq':0,'events':[dict(k='inspect',tick=120,order=0,track='T1',channel='eo',request_id='old-rejected')]})
    assert response.status_code==422,response.text
    with connect() as db:assert db.execute('SELECT COUNT(*) FROM chunks WHERE session_id=?',(sid,)).fetchone()[0]==0


def test_pending_recovery_pause_and_same_tick_fault_preserve_sample_order():
    spec=make_practice();sim=at(Simulation(spec),150);assert sim.act(inspect(sim))
    pending=replay(spec,sim.events,160)
    assert pending.acquisition_snapshot()['pending']['sampleTick']==180
    at(sim,180);at(pending,180)
    command=dict(seq=1,command_id='fault',type='sensor_fault',payload=dict(sensor='eo',mode='failed'),tick=180,order=sim.next_order)
    assert sim.control(command) and pending.control(command)
    # Sampling at180 already happened before the external fault; it cannot reroll.
    at(sim,186);at(pending,186)
    assert sim.acquisition_snapshot()==pending.acquisition_snapshot()
    assert sim.acquisition_snapshot()['results'][0]['reading']['available'] is True
    at(sim,200)
    pause=dict(seq=2,command_id='pause',type='pause',payload={},tick=200,order=sim.next_order)
    assert sim.control(pause)
    before=sim.acquisition_snapshot();sim.step()
    assert sim.tick==200 and sim.acquisition_snapshot()==before


def test_active_practice_profile_reads_never_reconstruct_excluded_practice(client, monkeypatch):
    # Without this exclusion every read retries practice backfill under a writer
    # lock, despite persist_skill_results correctly excluding these outcomes.
    from server import main
    spec=client.post('/api/v1/acquisition/practice',json={}).json()
    sid=client.post('/api/v1/sessions',json={'scenario_id':spec['id'],'trainee':'practice-profile'}).json()['id']
    assert client.post(f'/api/v1/sessions/{sid}/complete',json={'end_tick':2700,'execution_tick':0}).status_code==200
    def forbidden(*args):
        raise AssertionError('Practice must be filtered before profile reconstruction / write transaction')
    monkeypatch.setattr(main,'review_session',forbidden)
    for _ in range(2):
        result=client.get('/api/v1/trainees/practice-profile/profile')
        assert result.status_code==200,result.text
        assert result.json()['sessions']==0
        assert result.json()['unprocessed_sessions']==[]
        assert all(s['alpha']==1 and s['beta']==1 for s in result.json()['skills'].values())
