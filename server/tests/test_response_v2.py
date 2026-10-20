import copy
import pytest
from server.response_v2 import configuration,create_state,attempt_response,advance_response,public_state
from server.engine import Simulation,score
from server.raid_v2 import compose_raid

E=dict(allowed=True,in_range=True,restricted=False,compatible=True,ideal_match=True)

def intent(tick=0,effector='kinetic',track='T1'):return dict(tick=tick,track=track,effector=effector)

def advance(s,tick,seed=7,active=True,effective=True):
    resolved=[]
    done=advance_response(s,tick,seed,lambda *_:dict(active=active,effective=effective),resolved.append)
    return done,resolved


def test_bounded_frozen_configuration_and_fresh_resources():
    for changes in [dict(version=True),dict(illustrative_training_assumptions=False),dict(kinetic_ammo=-1),dict(jammer_channels=9),dict(jammer_duration_ticks=0),dict(kinetic_delay_ticks=1.5),dict(kinetic_success_probability=float('nan')),dict(extra=3)]:
        with pytest.raises(ValueError):configuration(changes)
    c=dict(kinetic_ammo=2);s=create_state(c);c['kinetic_ammo']=99
    assert s['kinetic_ammo_remaining']==2 and create_state()['attempts']==[]


def test_kinetic_consumption_cooldown_no_infinite_shots_and_delayed_resolution():
    s=create_state(dict(kinetic_ammo=2,kinetic_cooldown_ticks=10,kinetic_delay_ticks=5,kinetic_success_probability=1))
    a=attempt_response(s,intent(),E)
    assert a['status']=='pending' and s['kinetic_ammo_remaining']==1
    assert advance(s,4)==([],[])
    assert advance(s,5)==(['R1'],['T1']) and a['result_tick']==5
    assert attempt_response(s,intent(5,track='T2'),E)['status']=='blocked_cooldown'
    assert attempt_response(s,intent(10,track='T2'),E)['status']=='pending'
    assert attempt_response(s,intent(11,track='T3'),E)['status']=='blocked_ammo'
    assert s['kinetic_ammo_remaining']==0


def test_jammer_channels_held_until_dwell_then_released_on_failure_or_inactive_target():
    s=create_state(dict(jammer_channels=1,jammer_duration_ticks=10,jammer_success_probability=0))
    a=attempt_response(s,intent(effector='rf_jam'),E)
    assert public_state(s)['jammer_channels_in_use']==1
    assert attempt_response(s,intent(1,'rf_jam','T2'),E)['status']=='blocked_channels'
    assert advance(s,9)==([],[])
    assert advance(s,10)==(['R1'],[]) and a['status']=='no_effect'
    b=attempt_response(s,intent(10,'rf_jam','T2'),E)
    advance(s,20,active=False);assert b['status']=='target_inactive' and public_state(s)['jammer_channels_in_use']==0


def test_pending_receipt_never_leaks_hidden_compatibility_ideal_or_draw():
    a,b=create_state(),create_state()
    attempt_response(a,intent(effector='rf_jam'),E)
    attempt_response(b,intent(effector='rf_jam'),dict(E,compatible=False,ideal_match=False))
    assert public_state(a)==public_state(b)
    assert 'launch_eligible' not in str(public_state(a)) and 'process_valid' not in str(public_state(a))
    assert a['attempts'][0]['process_valid'] and not b['attempts'][0]['process_valid']


def test_due_rechecks_constraints_and_never_refunds_consumed_resources():
    s=create_state(dict(kinetic_success_probability=1));attempt_response(s,intent(),E)
    _,resolved=advance(s,15,effective=False)
    assert not resolved and s['attempts'][0]['status']=='no_effect' and s['kinetic_ammo_remaining']==7
    with pytest.raises(ValueError):advance(s,14)
    assert advance(s,16)==([],[])


def test_seeded_draw_reproducible_and_probability_has_synthetic_sanity():
    count=0
    for seed in range(200):
        a,b=create_state(dict(kinetic_success_probability=.5)),create_state(dict(kinetic_success_probability=.5))
        attempt_response(a,intent(),E);attempt_response(b,intent(),E)
        advance(a,15,seed);advance(b,15,seed)
        assert a==b
        count+=a['attempts'][0]['status']=='resolved'
    assert 75<count<125 # Synthetic sampler sanity; not an empirical effectiveness/calibration study.


def fixture_scenario(response=True,friendly=False):
    s=compose_raid(dict(seed=7,duration=90,night=False,terrain='rural',fog=0.,contacts=2))
    s['tracks']=s['tracks'][:1];s['tracks'][0].update(spawn=0,distance=100,bearing=30,speed=2,altitude=20,kind='fiber_fpv',identity='friendly' if friendly else 'hostile',rf=False)
    s['terrain_boxes']=[];s['sensor_config']=dict(optical_reliability=1.)
    if response:s['response_model']=configuration(dict(kinetic_success_probability=0,jammer_success_probability=0))
    else:s.pop('response_model',None)
    return s


def engage(sim):
    while sim.tick<30:sim.step()
    t=sim.tracks[0]
    for k,extra in [('designate',{}),('classify',dict(kind=t['kind'],identity=t['identity'])),('engage',dict(effector='kinetic'))]:
        assert sim.act(dict(tick=sim.tick,order=len(sim.events),k=k,track=t['id'],**extra))


def test_opt_in_process_credit_is_separate_from_stochastic_outcome_and_legacy_remains_immediate():
    sim=Simulation(fixture_scenario());engage(sim)
    assert not sim.tracks[0]['resolved']
    for _ in range(15):sim.step()
    card=score(sim)
    assert sim.response_state['attempts'][0]['status']=='no_effect' and card['rows'][0]['engage']==35
    assert not sim.tracks[0]['resolved'] and card['response_model']['resolved_effects']==0
    legacy=Simulation(fixture_scenario(False));engage(legacy)
    assert legacy.tracks[0]['resolved'] and 'response_model' not in score(legacy)


def test_non_hostile_destructive_attempt_fails_safety_even_when_no_effect_or_no_ammo():
    for ammo in [0,8]:
        s=fixture_scenario(friendly=True);s['response_model']['kinetic_ammo']=ammo
        sim=Simulation(s);engage(sim)
        for _ in range(15):sim.step()
        card=score(sim)
        assert card['fratricide'] and not card['passed'] and card['score']==0
        assert not sim.tracks[0]['resolved']
        assert any('regardless of stochastic effect' in f for f in card['rows'][0]['feedback'])


def test_due_effect_before_same_tick_asset_impact_and_pause_freezes_pending_clock():
    for chance in [0.,1.]:
        s=fixture_scenario();s['tracks'][0].update(distance=9,speed=30,bearing=0,motion=dict(version=1,primitive='direct',phase_s=0,lateral_m=0,period_s=10,turn_deg=0))
        s['response_model'].update(kinetic_delay_ticks=1,kinetic_success_probability=chance)
        sim=Simulation(s);t=sim.tracks[0]
        for k,extra in [('designate',{}),('classify',dict(kind=t['kind'],identity=t['identity'])),('engage',dict(effector='kinetic'))]:
            assert sim.act(dict(tick=0,order=len(sim.events),k=k,track=t['id'],**extra))
        pause=dict(command_id='p',session_id='S',seq=1,issued_at='test',tick=0,order=3,type='pause',payload={})
        assert sim.control(pause)
        for _ in range(10):sim.step()
        assert sim.tick==0 and sim.response_state['attempts'][0]['status']=='pending'
        assert sim.control(dict(pause,seq=2,order=4,command_id='r',type='resume'))
        sim.step()
        assert t['resolved']==bool(chance) and t['impact']==(not bool(chance))
        assert sim.response_state['attempts'][0]['result_tick']==1
