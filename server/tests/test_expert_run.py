import copy
from types import SimpleNamespace
import pytest
from server.expert_run import run_completed_session,observe_contact,evidence_policy,UnsupportedArchivedContract
from server.engine import make_scenario,replay,score
from server.raid_v2 import compose_raid
from server.response_v2 import configuration


def record(scenario,events=None,commands=None,end=None):
    end=scenario['duration']*30 if end is None else end
    events,commands=events or [],commands or []
    return dict(status='completed',scenario=scenario,events=events,commands=commands,end_tick=end,execution_tick=max([e['tick'] for e in events+commands],default=0),scorecard=score(replay(scenario,events,end,commands)))


def small_finale(probability=1.,ammo=2,channels=1):
    s=compose_raid(dict(seed=7,duration=60,terrain='rural',fog=0.,night=False,contacts=4))
    s['tracks']=[]
    for i,(kind,identity,rf) in enumerate([('fiber_fpv','hostile',False),('fiber_fpv','hostile',False),('quad','hostile',True),('quad','friendly',True)]):
        s['tracks'].append(dict(id=f'T{i+1}',kind=kind,identity=identity,rf=rf,spawn=0,bearing=30.+i*10,distance=100.+i*30,speed=2.,altitude=20.,motion=dict(version=1,primitive='direct',phase_s=0.,lateral_m=0.,period_s=10.,turn_deg=0.)))
    s['terrain_boxes']=[];s['sensor_config']=dict(optical_reliability=1.,radar_reliability=1.,iff_reply_probability=1.,rf_reliability=1.)
    s['response_model']=configuration(dict(kinetic_ammo=ammo,kinetic_cooldown_ticks=20,kinetic_delay_ticks=15,kinetic_success_probability=probability,jammer_channels=channels,jammer_duration_ticks=40,jammer_success_probability=probability))
    return s


def test_canonical_autonomous_legacy_reference_reconstructs_own_complete_actions():
    original=record(make_scenario(7,night=False))
    before=copy.deepcopy(original)
    out=run_completed_session(original)
    assert out['original_score']==original['scorecard'] and out['original_score']['score']==0
    assert out['reference_score']['score']==100 and not out['reference_score']['fratricide']
    assert {a['k'] for a in out['reference_actions']}=={'designate','classify','engage'}
    assert len({a['order'] for a in out['reference_actions']})==len(out['reference_actions'])
    assert score(replay(original['scenario'],out['reference_actions'],2250,out['reference_commands']))==out['reference_score']
    assert original==before and out==run_completed_session(original)
    assert 'CANONICAL' in out['basis'] and any('not a certified human expert' in x for x in out['limitations'])


def test_finite_ammo_cooldown_pending_effects_and_channels_drive_actual_rollout():
    out=run_completed_session(record(small_finale()))
    ledger=out['reference_score']['response_model']['reference_attempts']
    assert sum(r['effector']=='kinetic' for r in ledger)==2
    kinetic=[r for r in ledger if r['effector']=='kinetic']
    assert kinetic[1]['tick']>=kinetic[0]['tick']+20
    assert all(r['status']=='resolved' and r['result_tick']==r['due_tick'] for r in ledger if r['effector']!='hold')
    assert out['reference_score']['response_model']['kinetic_ammo_remaining']==0
    assert not out['reference_score']['fratricide']
    assert out['reference_score']['score']>=70 # Greedy resource-aware reference is explicitly not optimal.


def test_failed_delayed_effects_stop_at_finite_resources_and_bounded_retry_budget():
    out=run_completed_session(record(small_finale(probability=0.,ammo=1)))
    ledger=out['reference_score']['response_model']['reference_attempts']
    assert sum(r['effector']=='kinetic' for r in ledger)==1
    assert all(r['status']=='no_effect' for r in ledger if r['effector']!='hold')
    assert sum(r['effector']=='rf_jam' for r in ledger)==3
    assert out['reference_score']['response_model']['resolved_effects']==0
    assert out['reference_score']['leakers']>0
    # Good process can still fail to stop a target; do not invent an outcome advantage.
    assert any(r['engage']==35 and r['impact'] for r in out['reference_score']['rows'])


def test_applied_commands_payload_ticks_sequences_preserved_pause_does_not_deadlock():
    s=small_finale();commands=[]
    for seq,(tick,kind,payload) in enumerate([(0,'pause',{}),(30,'resume',{}),(60,'inject_contact',dict(kind='fiber_fpv',bearing=45)),(90,'sensor_fault',dict(sensor='eo',mode='failed')),(120,'sensor_restore',dict(sensor='eo'))],start=1):
        commands.append(dict(seq=seq,tick=tick,order=seq-1,type=kind,payload=payload,command_id='c'+str(seq),session_id='original',issued_at='recorded'))
    out=run_completed_session(record(s,commands=commands))
    assert all(a['tick']>=30 for a in out['reference_actions'])
    assert [{k:v for k,v in c.items() if k!='order'} for c in out['reference_commands']]==[{k:v for k,v in c.items() if k!='order'} for c in commands]
    combined=out['reference_actions']+out['reference_commands']
    assert len({e['order'] for e in combined})==len(combined)
    assert any(a['track']=='T5' for a in out['reference_actions'])
    assert score(replay(s,out['reference_actions'],1800,out['reference_commands']))==out['reference_score']
    assert any('pause' in line.lower() for line in out['limitations'])


def test_evidence_only_never_turns_silence_into_hostile_or_fiber_classification():
    ev=dict(geometry_available=True,silhouette='multirotor',rf_signal=False,iff='no_reply',range_m=100)
    a=evidence_policy(dict(ev,kind='fiber_fpv',identity='hostile',rf=False))
    b=evidence_policy(dict(ev,kind='quad',identity='friendly',rf=True))
    assert a==b and a['kind'] is None and a['identity'] is None and a['effector'] is None
    out=run_completed_session(record(small_finale()),'evidence_only')
    assert out['reference_actions']
    assert all(a.get('effector') in [None,'hold'] for a in out['reference_actions'])
    assert not any(a.get('identity')=='hostile' or a.get('kind')=='fiber_fpv' for a in out['reference_actions'])
    assert not out['reference_score']['fratricide']
    assert any('unresolved' in item.get('basis','').lower() for item in out['timeline'])


def test_v04_evidence_adapter_cannot_read_poisoned_hidden_truth_and_masks_unavailable_shapes():
    class Poison(dict):
        def __getitem__(self,k):
            if k in ['kind','identity','rf','x','z']:raise AssertionError('Read hidden '+k)
            return super().__getitem__(k)
        def get(self,k,default=None):
            if k in ['kind','identity','rf','x','z']:raise AssertionError('Read hidden '+k)
            return super().get(k,default)
    optical=dict(available=True,level='recognise',silhouette='multirotor',sample_tick=30,position=dict(x=0,z=100,altitude=20))
    o=dict(version='vyuha-0.4.0',eo=optical,ir=dict(available=False),radar=dict(available=False),rf=dict(available=True,detected=False),iff=dict(available=True,cue='no_reply'))
    t=Poison(id='T1',observation=o,kind='fiber_fpv',identity='hostile',rf=False,x=999,z=999)
    sim=SimpleNamespace(tick=30,scenario={})
    ev=observe_contact(sim,t)
    assert ev['range_m']==100 and 'kind' not in ev and 'identity' not in ev
    assert evidence_policy(ev)['identity'] is None
    o['eo']['available']=False
    ev=observe_contact(sim,t);assert not ev['geometry_available'] and ev['silhouette'] is None


def test_evidence_only_does_not_import_original_operator_classification():
    s=small_finale();base=record(s)
    initial=base['scenario']['tracks'][0]['id']
    # Hostile identity in original trainee history is not permission for the autonomous actor.
    actions=[dict(tick=0,order=0,k='designate',track=initial),dict(tick=0,order=1,k='classify',track=initial,kind='fiber_fpv',identity='hostile')]
    contaminated=record(s,events=actions)
    assert run_completed_session(base,'evidence_only')['reference_actions']==run_completed_session(contaminated,'evidence_only')['reference_actions']


def test_active_unknown_mode_bad_original_or_horizon_rejected_before_claiming_a_run():
    r=record(small_finale())
    for edited in [dict(r,status='active'),dict(r,scorecard=dict(score=999)),dict(r,execution_tick=2000)]:
        with pytest.raises(ValueError):run_completed_session(edited)
    with pytest.raises(ValueError):run_completed_session(r,'optimal_human_expert')


def test_no_database_api_called_and_every_input_is_unchanged(monkeypatch):
    from server import storage
    monkeypatch.setattr(storage,'connect',lambda: (_ for _ in ()).throw(AssertionError('Database access')))
    r=record(make_scenario(7));before=copy.deepcopy(r)
    run_completed_session(r,'canonical_reference');run_completed_session(r,'evidence_only')
    assert r==before


def test_legacy_current_range_not_extrapolated_after_loss():
    sim=SimpleNamespace(tick=60,scenario={},radar_status='failed',rf_available=False,night=False)
    t=dict(id='T1',radar=False,thermal=False,detected=0,classification=None,declared=None,x=20,z=50,kind='fiber_fpv',identity='hostile',rf=False)
    ev=observe_contact(sim,t)
    assert ev['range_m'] is None and ev['restricted'] is None and not ev['geometry_available']


def test_archived_01_score_marker_explicitly_unsupported_without_relabeling():
    r=record(make_scenario(7));r['scorecard']['engine_version']='vyuha-0.1.0'
    original=copy.deepcopy(r)
    with pytest.raises(UnsupportedArchivedContract) as err:run_completed_session(r)
    assert err.value.reason_code=='ARCHIVED_CONTRACT_UNSUPPORTED' and r==original
    with pytest.raises(ValueError):run_completed_session({k:v for k,v in original.items() if k!='scorecard'})
