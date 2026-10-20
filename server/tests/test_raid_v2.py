import copy,math
from collections import Counter
import pytest
from server.raid_v2 import FAMILIES,RaidRequest,compose_raid,configs,group_metrics,raid_contact_active,raid_position,similarity,validate_configs,validate_raid


@pytest.mark.parametrize('duration',[60,90,120,180])
@pytest.mark.parametrize('difficulty',['foundational','standard','challenging'])
@pytest.mark.parametrize('family',FAMILIES)
def test_seeded_bounded_raids_have_meaningful_geometric_response_windows(duration,difficulty,family):
 for seed in [0,1,72,482913,4294967295]:
  req=dict(seed=seed,duration=duration,difficulty=difficulty,family=family)
  scenario=compose_raid(req)
  assert scenario==compose_raid(req)
  assert scenario['version']==2 and scenario['engine_version']=='vyuha-0.4.0'
  assert validate_raid(scenario)==scenario['raid']['validation']
  assert scenario['raid']['validation']['peak_simultaneous_hostiles']<={'foundational':3,'standard':6,'challenging':12}[difficulty]
  assert all(w['usable_ticks']>=210 for w in scenario['raid']['validation']['response_windows'].values())
  assert len({t['id'] for t in scenario['tracks']})==len(scenario['tracks'])
  assert all(0<=t['spawn']<duration*30 for t in scenario['tracks'])
  assert all(t['distance']>=500 for t in scenario['tracks'])
  assert scenario['doctrine']['rules']['restricted']['enabled']


def test_variation_changes_rosters_timing_paths_and_sectors_not_merely_bearing_offset():
 raids=[compose_raid(dict(seed=i,difficulty='challenging',duration=180)) for i in range(16)]
 assert len({r['raid']['fingerprint'] for r in raids})==16
 assert len({tuple(t['kind'] for t in r['tracks']) for r in raids})>=8
 assert len({tuple(t['spawn'] for t in r['tracks']) for r in raids})>=8
 assert len({tuple(t['motion']['primitive'] for t in r['tracks']) for r in raids})>=8
 assert len({r['raid']['family'] for r in raids})>=5


def test_anti_repeat_uses_multiset_signatures_and_changes_seeded_candidate():
 request=dict(seed=17,duration=120,difficulty='challenging')
 first=compose_raid(request)
 second=compose_raid({**request,'recent_signatures':[first['raid']['signature']]})
 assert second['raid']['fingerprint']!=first['raid']['fingerprint']
 assert similarity(first['raid']['signature'],second['raid']['signature'])<=.6
 assert second['raid']['anti_repeat']['rejected_attempts']>=1
 assert similarity(['a','a','b'],['a','b','b'])==.5
 assert similarity([],[])==1


def test_split_swarm_has_shared_coherent_paths_then_actual_separation():
 s=compose_raid(dict(seed=7,family='SPLIT_SWARM',difficulty='challenging',duration=120))
 group=[t for t in s['tracks'] if t.get('group_id')=='G1_hostile_quad']
 assert len(group)>=2
 a,b=group[0],group[-1]
 assert (a['spawn'],a['speed'],a['bearing'],a['motion'])==(b['spawn'],b['speed'],b['bearing'],b['motion'])
 def separation(tick):
  x,y=raid_position(a,tick),raid_position(b,tick)
  return math.hypot(x['x']-y['x'],x['z']-y['z'])
 before=a['spawn']+round((a['group_split_s']-1)*30)
 after=a['spawn']+round((a['group_split_s']+8)*30)
 assert separation(after)>separation(before)+40
 assert len({t['formation_forward_m'] for t in group})>1


def test_probe_retires_after_real_approach_and_retreat_and_blind_sector_is_explicit():
 s=compose_raid(dict(seed=19,family='PROBE_AND_RETREAT',duration=120,difficulty='challenging'))
 probe=next(t for t in s['tracks'] if t['motion']['primitive']=='probe_retreat')
 def radius(age):
  p=raid_position(probe,probe['spawn']+round(age*30));return math.hypot(p['x'],p['z'])
 phase=probe['motion']['phase_s']
 assert radius(phase)<radius(0) and radius(phase+5)>radius(phase)
 assert raid_contact_active(probe,probe['expires_tick']-1)
 assert not raid_contact_active(probe,probe['expires_tick'])
 blind=compose_raid(dict(seed=19,family='BLIND_SECTOR',weak_sector_deg=225,duration=120))
 assert blind['raid']['sector_basis']=='Provided measured weak sector'
 assert all(175<=t['bearing']<=275 for t in blind['tracks'] if t['identity']=='hostile')
 random=compose_raid(dict(seed=19,family='BLIND_SECTOR',duration=120))
 assert 'no measured weakness' in random['raid']['sector_basis']


def test_decoy_then_strike_has_later_no_rf_arrivals_and_explicit_mix_survives():
 mix=['bird','friendly_uav','hostile_quad','hostile_quad','no_rf_fpv']
 s=compose_raid(dict(seed=73,family='DECOY_THEN_STRIKE',mix=mix,duration=90,difficulty='standard'))
 assert Counter(t['threat_profile'] for t in s['tracks'])==Counter(mix)
 decoy=[t['spawn'] for t in s['tracks'] if t['identity']=='hostile' and t['rf']]
 strike=[t['spawn'] for t in s['tracks'] if t['kind']=='fiber_fpv']
 assert min(strike)>max(decoy)+180


@pytest.mark.parametrize('body',[{'duration':59},{'duration':181},{'seed':-1},{'contacts':201},{'contacts':200,'difficulty':'foundational','duration':60},{'mix':['bird','friendly_uav']},{'mix':['no_rf_fpv']*12,'difficulty':'foundational','duration':60},{'recent_signatures':[['x']*201]},{'schema_version':1},{'family':'unknown'}])
def test_invalid_or_unsatisfiable_requests_are_not_silently_repaired(body):
 with pytest.raises(ValueError):compose_raid(body)


def test_frozen_configs_do_not_change_existing_scenario_and_invalid_config_rejected():
 s=compose_raid(dict(seed=17));threats,effectors=configs()
 old=copy.deepcopy(s['effector_config'])
 effectors['effectors']['kinetic']['max_range_m']=50
 assert s['effector_config']==old
 bad=copy.deepcopy(threats);bad['profiles']['no_rf_fpv']['rf']=True
 with pytest.raises(ValueError):validate_configs(bad,effectors)
 effectors['sensor_geometry']['radar_range_m']=float('nan')
 with pytest.raises(ValueError):validate_configs(threats,effectors)


@pytest.mark.parametrize('field,value',[('motion',{'version':1,'primitive':'direct','phase_s':0,'lateral_m':0,'period_s':0,'turn_deg':0}),('expires_tick',1),('speed',float('inf')),('distance',9000)])
def test_imported_raid_motion_and_ranges_are_bounded(field,value):
 s=compose_raid(dict(seed=17));s['tracks'][0][field]=value
 with pytest.raises(ValueError):validate_raid(s)


def test_group_outcome_metrics_use_only_observed_reconstructed_facts():
 s=compose_raid(dict(seed=7,family='SATURATION',difficulty='challenging',duration=90))
 group=[t for t in s['tracks'] if t.get('group_id')=='G1_hostile_quad']
 tracks=copy.deepcopy(s['tracks'])
 for t in tracks:t.update(resolved=t['id']==group[0]['id'],impact=t['id']==group[-1]['id'])
 tick=300
 events=[dict(k='engage',effector='rf_jam',track=group[0]['id'],tick=tick),dict(k='engage',effector='kinetic',track=group[0]['id'],tick=800)]
 result=group_metrics(s,events,tracks,tick)
 row=next(r for r in result['groups'] if r['group_id']=='G1_hostile_quad')
 assert row['observed_leakers']==1 and row['engagement_attempts']==1
 assert row['attempts_per_resolved_contact']==1
 assert row['time_to_first_engagement_s']==round((tick-group[0]['spawn'])/30,3)
 assert row['effector_attempt_counts']=={'rf_jam':1}
