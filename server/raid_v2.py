"""Procedural, frozen raid inputs and closed-form motion for engine 0.4.0.

All meter/m/s parameters are illustrative research/training values. This is a
 constrained raid grammar with coordinated leader/slots, not learned swarm AI.
 Existing v1 generators and historical engine contracts remain untouched.
"""
import copy,hashlib,json,math
from collections import Counter
from pathlib import Path
from typing import Literal
from pydantic import Field,model_validator
from server.models import StrictModel
from server.engine_v1_0_1 import rng
from server.sensors_v2 import configuration as sensor_configuration, line_of_sight, VERSION as SENSOR_VERSION

HZ=30
ENGINE_VERSION='vyuha-0.4.0'
FAMILIES=['DIRECT','SATURATION','DECOY_THEN_STRIKE','STAGGERED_WAVES','LOW_APPROACH','SPLIT_SWARM','PROBE_AND_RETREAT','BLIND_SECTOR']
Family=Literal['DIRECT','SATURATION','DECOY_THEN_STRIKE','STAGGERED_WAVES','LOW_APPROACH','SPLIT_SWARM','PROBE_AND_RETREAT','BLIND_SECTOR']
ROOT=Path(__file__).resolve().parents[1]


def configs():
 threats=json.loads((ROOT/'examples/finale-threats-v1.json').read_text())
 effectors=json.loads((ROOT/'examples/finale-effectors-v1.json').read_text())
 validate_configs(threats,effectors)
 return threats,effectors


def validate_configs(threats,effectors):
 if type(threats) is not dict or type(effectors) is not dict:raise ValueError('Configuration must be an object')
 if set(threats)!={'version','id','label','units','profiles'} or set(effectors)!={'version','id','label','units','sensor_geometry','effectors','engagement_channels','asset_radius_m','minimum_response_window_s'}:raise ValueError('Unknown or missing configuration fields')
 for cfg in [threats,effectors]:
  if any(type(cfg.get(k)) is not str or not 1<=len(cfg[k])<=240 for k in ['id','label']):raise ValueError('Configuration needs bounded id and illustrative label')
 if threats['units']!={'distance':'m','speed':'m/s','altitude':'m','time':'s'} or effectors['units']!={'distance':'m'}:raise ValueError('Configuration units are part of the versioned contract')
 if threats.get('version')!=1 or effectors.get('version')!=1:raise ValueError('Unsupported illustrative configuration version')
 expected={'hostile_quad':('quad','hostile',True),'no_rf_fpv':('fiber_fpv','hostile',False),'fixed_wing':('fixed_wing','hostile',False),'bird':('bird','neutral',False),'friendly_uav':('quad','friendly',True),'civil_uav':('quad','neutral',True)}
 if set(threats.get('profiles',{}))!=set(expected):raise ValueError('Unsupported threat profile roster')
 def number(v,minimum,maximum):
  if type(v) not in (int,float) or not math.isfinite(v) or not minimum<=v<=maximum:raise ValueError('Illustrative configuration number exceeds bounded range')
 for name,profile in threats['profiles'].items():
  allowed={'kind','identity','rf','speed_mps','altitude_m'}|({'registration_beacon'} if name=='civil_uav' else set())
  if type(profile) is not dict or set(profile)!=allowed:raise ValueError('Unknown or missing threat profile fields')
  if name=='civil_uav' and profile['registration_beacon'] is not True:raise ValueError('Civil UAV profile requires an explicit simulated registration beacon')
  if (profile.get('kind'),profile.get('identity'),profile.get('rf'))!=expected[name] or type(profile.get('rf')) is not bool:raise ValueError('Threat profile identity/link contract mismatch')
  for key,bounds in [('speed_mps',(1,100)),('altitude_m',(0,2000))]:
   values=profile.get(key)
   if not isinstance(values,list) or len(values)!=2:raise ValueError('Threat profile requires bounded low/high band')
   for value in values:number(value,*bounds)
   if values[0]>values[1]:raise ValueError('Threat profile band must be ordered')
 for value in effectors.get('sensor_geometry',{}).values():number(value,20,10000)
 if set(effectors.get('sensor_geometry',{}))!={'radar_range_m','day_camera_range_m','thermal_range_m'}:raise ValueError('Invalid sensor geometry configuration')
 if set(effectors.get('effectors',{}))!={'hold','rf_jam','kinetic'}:raise ValueError('Unsupported effector roster')
 for name,cfg in effectors['effectors'].items():
  expected_fields={'enabled'}|({'max_range_m'} if name!='hold' else set())|({'requires_rf_link'} if name=='rf_jam' else set())
  if type(cfg) is not dict or set(cfg)!=expected_fields:raise ValueError('Unknown or missing effector fields')
  if name=='rf_jam' and cfg['requires_rf_link'] is not True:raise ValueError('RF jammer requires an RF link in this contract')
  if type(cfg.get('enabled')) is not bool:raise ValueError('Effector enabled must be boolean')
  if name!='hold':number(cfg.get('max_range_m'),20,5000)
 number(effectors.get('minimum_response_window_s'),1,30)
 number(effectors.get('engagement_channels'),1,12)
 if type(effectors['engagement_channels']) is not int:raise ValueError('Engagement channels must be an integer')
 if effectors.get('asset_radius_m')!=8:raise ValueError('This engine contract requires the frozen 8m asset radius')


from .fusion import FrozenFusionConfig
from .response_v2 import ResponseConfig

class RaidRequest(StrictModel):
 response_model:ResponseConfig|None=None
 fusion:FrozenFusionConfig|None=None
 schema_version:Literal[2]=2
 seed:int=Field(default=482913,ge=0,le=4294967295)
 duration:int=Field(default=90,ge=60,le=180)
 name:str=Field(default='Procedural local raid',min_length=3,max_length=70)
 difficulty:Literal['foundational','standard','challenging']='standard'
 focus:Literal['detection','classification_iff','effector_choice','degraded_sensor_response']='effector_choice'
 family:Family|None=None
 terrain:Literal['urban','rural']='urban'
 night:bool=False
 fog:float=Field(default=.15,ge=0,le=.8,allow_inf_nan=False)
 contacts:int|None=Field(default=None,ge=2,le=200)
 mix:list[Literal['bird','friendly_uav','civil_uav','hostile_quad','no_rf_fpv','fixed_wing']]|None=Field(default=None,min_length=2,max_length=200)
 weak_sector_deg:float|None=Field(default=None,ge=0,lt=360,allow_inf_nan=False)
 recent_signatures:list[list[str]]=Field(default_factory=list,max_length=5)
 @model_validator(mode='after')
 def valid(self):
  if not self.name.strip():raise ValueError('Raid name cannot be blank')
  if self.mix and self.contacts is not None and self.contacts!=len(self.mix):raise ValueError('contacts must equal the configured mix length')
  if any(len(s)>200 or any(len(f)>100 for f in s) for s in self.recent_signatures):raise ValueError('Recent signatures exceed bounded feature history')
  if self.mix and not any(x in ['hostile_quad','no_rf_fpv','fixed_wing'] for x in self.mix):raise ValueError('Raid requires hostile training contacts')
  return self


class RaidMotion(StrictModel):
 version:Literal[1]=1
 primitive:Literal['direct','weave','orbit_then_dash','dogleg','probe_retreat']
 phase_s:float=Field(ge=0,le=180,allow_inf_nan=False)
 lateral_m:float=Field(ge=0,le=500,allow_inf_nan=False)
 period_s:float=Field(gt=0,le=120,allow_inf_nan=False)
 turn_deg:float=Field(ge=-360,le=360,allow_inf_nan=False)


class RaidTrackSpec(StrictModel):
 id:str=Field(pattern=r'^T[1-9][0-9]{0,2}$')
 kind:Literal['bird','quad','fixed_wing','fiber_fpv']
 identity:Literal['hostile','friendly','neutral']
 rf:bool
 spawn:int=Field(ge=0,le=5400)
 bearing:float=Field(ge=0,lt=360,allow_inf_nan=False)
 distance:float=Field(gt=0,le=4000,allow_inf_nan=False)
 speed:float=Field(gt=0,le=100,allow_inf_nan=False)
 altitude:float=Field(ge=0,le=2000,allow_inf_nan=False)
 motion:RaidMotion
 radar_range:float=Field(gt=0,le=10000,allow_inf_nan=False)
 thermal_range:float=Field(gt=0,le=10000,allow_inf_nan=False)
 threat_profile:str=Field(min_length=1,max_length=40)
 registration_id:str|None=Field(default=None,min_length=1,max_length=32,pattern=r'^[A-Za-z0-9_-]+$')
 group_id:str|None=Field(default=None,min_length=1,max_length=60)
 formation_offset_m:float=Field(default=0,ge=-1000,le=1000,allow_inf_nan=False)
 formation_forward_m:float=Field(default=0,ge=-1000,le=1000,allow_inf_nan=False)
 group_split_s:float|None=Field(default=None,ge=0,le=180,allow_inf_nan=False)
 expires_tick:int|None=Field(default=None,ge=1,le=5400)


def raid_contact_active(track,tick):
 return tick>=track['spawn'] and (track.get('expires_tick') is None or tick<track['expires_tick'])


def raid_position(track,tick):
 """Analytic leader path plus member slots; no step-integrated boid drift."""
 age=max(0,(tick-track['spawn'])/HZ)
 motion=track.get('motion',{})
 primitive=motion.get('primitive','direct');phase=motion.get('phase_s',0)
 angle=track['bearing']*math.pi/180;speed=track['speed'];dist=track['distance']
 lateral=0.0
 if primitive=='orbit_then_dash':
  before=min(age,phase)
  angle+=motion.get('turn_deg',0)*math.pi/180*(before/max(phase,1/HZ))
  radius=max(0,dist-max(0,age-phase)*speed)
 elif primitive=='probe_retreat':
  radius=max(0,dist-min(age,phase)*speed+max(0,age-phase)*speed*.75)
 else:
  radius=max(0,dist-age*speed)
  if primitive=='weave':lateral=motion.get('lateral_m',0)*math.sin(age*2*math.pi/max(motion.get('period_s',1),1/HZ))*min(1,radius/80)
  elif primitive=='dogleg':
   progress=max(0,min(1,(age-phase)/max(motion.get('period_s',1),1/HZ)))
   lateral=motion.get('lateral_m',0)*math.sin(math.pi*progress)*min(1,radius/80)
 # A shared leader, same speed/spawn/bearing, and member slots preserve cohesion.
 # After split_s two half formations move toward distinct lateral sub-axes.
 slot=track.get('formation_offset_m',0)
 radius+=track.get('formation_forward_m',0)*min(1,radius/80)
 split=track.get('group_split_s')
 if split is not None and age>split:slot+=(-1 if slot<0 else 1)*min(180,(age-split)*6)
 lateral+=slot*min(1,radius/80)
 x=math.sin(angle)*radius+math.cos(angle)*lateral
 z=math.cos(angle)*radius-math.sin(angle)*lateral
 # Fixed rounding is part of the v2 parity contract; neither language accumulates
 # prior-step error, and all scoring geometry sees the same 1 micrometer grid.
 return {'x':math.floor(x*1e6+.5)/1e6,'z':math.floor(z*1e6+.5)/1e6}


# Alias kept explicit for the integration dispatch's readability.
position_v2=raid_position


def feature_signature(scenario):
 waves={tid:index for index,w in enumerate(scenario['raid']['waves']) for tid in w['contacts']}
 return sorted(f"{t['kind']}:{int(t['bearing']//45)}:{waves.get(t['id'],0)}:{t.get('motion',{}).get('primitive','direct')}" for t in scenario['tracks'])


def similarity(a,b):
 left,right=Counter(a),Counter(b)
 union=sum((left|right).values())
 return sum((left&right).values())/union if union else 1


def _candidate(req,attempt,threats,effectors):
 seed=(req.seed+attempt*0x9E3779B9)&0xffffffff;r=rng(seed)
 cap={'foundational':3,'standard':6,'challenging':12}[req.difficulty]
 # Keep enough physical travel time for >=500m approaches without changing
 # m/s units. Short raids cannot honestly fit four independent long waves.
 max_waves=min(4,max(1,req.duration//45))
 min_waves=max(1,math.ceil(req.duration/90))
 wave_count=min_waves+int(r()*(max_waves-min_waves+1))
 family=req.family or FAMILIES[int(r()*len(FAMILIES))]
 if family=='STAGGERED_WAVES' and max_waves>1:wave_count=max_waves
 if req.mix:
  hostile_mix=[p for p in req.mix if threats['profiles'][p]['identity']=='hostile']
  backgrounds=[p for p in req.mix if threats['profiles'][p]['identity']!='hostile']
  wave_count=math.ceil(len(hostile_mix)/cap)
 elif req.contacts is not None:
  background_count=min(4,max(1,req.contacts//4));hostile_count=req.contacts-background_count
  wave_count=math.ceil(hostile_count/cap)
  hostile_mix=[['hostile_quad','no_rf_fpv','fixed_wing'][int(r()*3)] for _ in range(hostile_count)]
  backgrounds=[['bird','friendly_uav','civil_uav'][int(r()*3)] for _ in range(background_count)]
 else:
  hostile_count=wave_count*(cap if family in ['SATURATION','SPLIT_SWARM'] else 2+int(r()*max(1,cap-1)))
  hostile_mix=[['hostile_quad','no_rf_fpv','fixed_wing'][int(r()*3)] for _ in range(hostile_count)]
  backgrounds=[['bird','friendly_uav','civil_uav'][int(r()*3)] for _ in range(1+int(r()*5))]
 if not 1<=wave_count<=max_waves:raise ValueError('Requested roster cannot fit bounded nonoverlapping waves at this duration/difficulty')
 if req.focus=='effector_choice' and not req.mix and len(hostile_mix)>=2:hostile_mix[:2]=['hostile_quad','no_rf_fpv']
 # Coordinated default groups use compatible speed bands within each group.
 if family in ['SATURATION','SPLIT_SWARM'] and req.mix is None and req.contacts is None:
  per_wave=['hostile_quad']*max(2,cap//3)+['no_rf_fpv']*max(1,cap//3)
  per_wave+=['fixed_wing']*(cap-len(per_wave))
  hostile_mix=per_wave*wave_count
 else:
  # Deterministically vary order, not merely the old fixed roster bearings.
  for i in range(len(hostile_mix)-1,0,-1):
   j=int(r()*(i+1));hostile_mix[i],hostile_mix[j]=hostile_mix[j],hostile_mix[i]
 tracks=[];waves=[];slot_s=req.duration/wave_count
 for w in range(wave_count):
  members=hostile_mix[w*cap:(w+1)*cap] if req.contacts is not None or req.mix else hostile_mix[w*len(hostile_mix)//wave_count:(w+1)*len(hostile_mix)//wave_count]
  spawn=round((w*slot_s+2)*HZ)
  bearing=int(r()*360)
  if family=='BLIND_SECTOR' and req.weak_sector_deg is not None:bearing=req.weak_sector_deg
  coordinated=family in ['SATURATION','SPLIT_SWARM'] and len(members)>1
  group_states={}
  for j,preset in enumerate(members):
   profile=threats['profiles'][preset];lo,hi=profile['speed_mps']
   life=slot_s*.72
   minimum_speed=max(lo,500/max(life-4,1))
   if minimum_speed>hi:raise ValueError('Duration/difficulty cannot provide a 500m approach and minimum response window for this profile')
   speed=round(minimum_speed+r()*(hi-minimum_speed),3)
   primitive=['direct','weave','dogleg','orbit_then_dash'][int(r()*4)]
   if family=='LOW_APPROACH':primitive='weave'
   if family=='PROBE_AND_RETREAT' and j==0:primitive='probe_retreat'
   if coordinated:primitive='weave'
   phase=round(min(4,life*.15),3) if primitive=='orbit_then_dash' else round(life*.25,3)
   motion=dict(version=1,primitive=primitive,phase_s=phase,lateral_m=round(25+r()*90,3),period_s=round(10+r()*12,3),turn_deg=round(-35+r()*70,3))
   distance=round(speed*(life-phase if primitive=='orbit_then_dash' else life),3)
   if coordinated and preset in group_states:speed,distance,motion=group_states[preset];motion=copy.deepcopy(motion)
   elif coordinated:group_states[preset]=(speed,distance,copy.deepcopy(motion))
   if primitive=='probe_retreat':
    maximum=effectors['effectors']['rf_jam' if profile['rf'] else 'kinetic']['max_range_m']
    distance=round(max(500,min(maximum*.85,speed*life*.55)),3)
    motion['phase_s']=round(max(1,min(life*.4,(distance-maximum*.5)/speed)),3)
   altitude=round(profile['altitude_m'][0]+r()*(profile['altitude_m'][1]-profile['altitude_m'][0]),3)
   if family=='LOW_APPROACH':altitude=4+r()*3
   track=dict(id=f'T{len(tracks)+1}',kind=profile['kind'],identity=profile['identity'],rf=profile['rf'],spawn=spawn+(210 if family=='DECOY_THEN_STRIKE' and not profile['rf'] else 0)+(0 if coordinated else j*3),bearing=bearing if coordinated else (bearing+int(r()*100)-50)%360,distance=distance,speed=speed,altitude=altitude,motion=motion,radar_range=effectors['sensor_geometry']['radar_range_m'],thermal_range=effectors['sensor_geometry']['thermal_range_m'],threat_profile=preset)
   if coordinated:
    slots=[i for i,value in enumerate(members) if value==preset]
    offset=round((slots.index(j)-(len(slots)-1)/2)*28,3)
    track.update(group_id=f'G{w+1}_{preset}',formation_offset_m=offset,formation_forward_m=abs(offset)*.5 if family=='SPLIT_SWARM' else 0)
    if family=='SPLIT_SWARM':track['group_split_s']=round(life*.35,3)
   if primitive=='probe_retreat':track['expires_tick']=min(req.duration*HZ,spawn+round(life*HZ))
   tracks.append(track)
  waves.append(dict(tick=spawn,role=family.lower(),contacts=[t['id'] for t in tracks if t['spawn']>=spawn and t['id'] not in {i for old in waves for i in old['contacts']}]))
 for preset in backgrounds:
  profile=threats['profiles'][preset];speed=round(profile['speed_mps'][0]+r()*(profile['speed_mps'][1]-profile['speed_mps'][0]),3)
  tracks.append(dict(id=f'T{len(tracks)+1}',kind=profile['kind'],identity=profile['identity'],rf=profile['rf'],spawn=int(r()*req.duration*.25)*HZ,bearing=int(r()*360),distance=round(600+r()*1600,3),speed=speed,altitude=round(20+r()*70,3),motion=dict(version=1,primitive='orbit_then_dash',phase_s=req.duration,turn_deg=70,period_s=20,lateral_m=0),expires_tick=req.duration*HZ,threat_profile=preset,radar_range=effectors['sensor_geometry']['radar_range_m'],thermal_range=effectors['sensor_geometry']['thermal_range_m']))
 for track in tracks:
  if track['threat_profile']=='civil_uav':track['registration_id']=f"CIV-{seed%10000}-{track['id']}"
 end=req.duration*HZ
 boxes=[dict(x_min=120,x_max=210,z_min=300,z_max=390,height=28),dict(x_min=-230,x_max=-130,z_min=-350,z_max=-240,height=35)] if req.terrain=='urban' else [dict(x_min=-160,x_max=-90,z_min=200,z_max=260,height=10)]
 doctrine=dict(id='army-forward-post',version=1,name='Illustrative finale local pack',description='Frozen meter-scale training research configuration; not official doctrine',example_values=True,rules=dict(rf_range=effectors['effectors']['rf_jam']['max_range_m'],kinetic_range=effectors['effectors']['kinetic']['max_range_m'],restricted=dict(enabled=req.terrain=='urban',x_lt=-300,z_gt=200),effectors=[name for name,cfg in effectors['effectors'].items() if cfg['enabled']],risk_weights=dict(quad=1,fixed_wing=1.2,fiber_fpv=1.5,bird=0),asset_risk=1,distance_precision=6,hold_any_range=True),defaults=dict(fog=req.fog,night=req.night,mix=[]),allowed_tactics=FAMILIES,rubric=dict(detect=25,classify=25,prioritise=15,engage=35))
 s=dict(version=2,engine_version=ENGINE_VERSION,id='pending',seed=seed,title=req.name,duration=req.duration,night=req.night,fog=req.fog,jamStart=end,jamEnd=end,focus=req.focus,tracks=tracks,terrain=req.terrain,terrain_id='rural_forward_base' if req.terrain=='rural' else 'urban_outpost',terrain_version=1,difficulty_label=req.difficulty,sensor_version=SENSOR_VERSION,sensor_config=copy.deepcopy(sensor_configuration()),terrain_boxes=boxes,doctrine=doctrine,prioritisation_version=1,threat_config=copy.deepcopy(threats),effector_config=copy.deepcopy(effectors),raid=dict(version=2,family=family,requested_seed=req.seed,waves=waves,formation_model='Closed-form shared leader with bounded slots and optional split; not autonomous swarm AI',constraints=dict(response_window_s=effectors['minimum_response_window_s'],peak_hostile_cap=cap,max_contacts=200),anti_repeat=dict(rejected_attempts=attempt,history_considered=len(req.recent_signatures))))
 if req.focus=='degraded_sensor_response':s.update(jamStart=min(180,end//5),jamEnd=min(end-30,end//2))
 s['red_force']=dict(version=2,tactic=family,tactic_seed=seed,phases=copy.deepcopy(waves))
 signature=feature_signature(s);s['raid']['signature']=signature
 s['raid']['fingerprint']=hashlib.sha256(json.dumps(signature,separators=(',',':')).encode()).hexdigest()[:24]
 if family=='BLIND_SECTOR':s['raid']['sector_basis']='Provided measured weak sector' if req.weak_sector_deg is not None else 'Seeded random sector; no measured weakness supplied'
 s['raid']['validation']=validate_raid(s)
 if req.fusion:s['fusion']=req.fusion.model_dump()
 if req.response_model:s['response_model']=req.response_model.model_dump()
 s['id']=raid_id(s)
 return s


def raid_id(scenario):
 serial=copy.deepcopy(scenario);serial.pop('id',None)
 if serial.get('director_v2'):
  # Identity is bound by the opaque installation-local owner binding. Exclude
  # direct identifiers and nonbehavioral history dates for pseudonymous transfer.
  decision=serial.get('director_decision',{})
  decision.pop('trainee_id',None)
  for estimate in decision.get('profile_snapshot',{}).values():
   estimate.pop('updated_at',None);estimate.pop('last_session_id',None)
 def normalize(value):
  if type(value) is float and value.is_integer():return int(value)
  if type(value) is list:return [normalize(v) for v in value]
  if type(value) is dict:return {k:normalize(v) for k,v in value.items()}
  return value
 return 'raid_'+hashlib.sha256(json.dumps(normalize(serial),sort_keys=True,separators=(',',':'),allow_nan=False).encode()).hexdigest()[:24]


def validate_raid(s):
 if s.get('version')!=2 or s.get('engine_version')!=ENGINE_VERSION:raise ValueError('Unsupported raid engine contract')
 if type(s.get('duration')) is not int or not 60<=s['duration']<=180:raise ValueError('Raid duration outside 60–180 seconds')
 if s.get('sensor_version')!=SENSOR_VERSION:raise ValueError('Unsupported frozen sensor contract')
 from server.sensors_v2 import BOUNDS
 if set(s.get('sensor_config',{}))!=set(BOUNDS):raise ValueError('Full frozen sensor configuration is required')
 sensor_configuration(s['sensor_config'])
 validate_configs(s['threat_config'],s['effector_config'])
 if not 1<=len(s['tracks'])<=200 or len({t['id'] for t in s['tracks']})!=len(s['tracks']):raise ValueError('Invalid bounded track roster')
 end=s['duration']*HZ;windows={};live_counts=[0]*(end+1)
 minimum=round(s['raid']['constraints']['response_window_s']*HZ)
 for track in s['tracks']:
  RaidTrackSpec.model_validate(track)
  if track.get('expires_tick') is not None and not track['spawn']<track['expires_tick']<=end:raise ValueError('Track expiry must follow spawn within raid duration')
  if not 0<=track['spawn']<end:raise ValueError('Track spawn must precede raid end')
  if track['identity']!='hostile':continue
  maximum=s['doctrine']['rules']['rf_range' if track['rf'] else 'kinetic_range']
  if ('rf_jam' if track['rf'] else 'kinetic') not in s['doctrine']['rules']['effectors']:raise ValueError('No modeled effective response is enabled for a hostile track')
  usable=0;last_tick=None;first_tick=None
  for tick in range(track['spawn'],min(track.get('expires_tick',end),end)):
   pos=raid_position(track,tick);d=math.hypot(pos['x'],pos['z'])
   if d<=8:break
   live_counts[tick]+=1
   zone=s['doctrine']['rules']['restricted']
   restricted=not track['rf'] and zone['enabled'] and pos['x']<zone['x_lt'] and pos['z']>zone['z_gt']
   if d<=min(maximum,track.get('radar_range',3000)) and not restricted and line_of_sight({**pos,'altitude':track['altitude']},{'terrain':s.get('terrain_boxes',[])}):
    if first_tick is None:first_tick=tick
    last_tick=tick;usable+=1
  if usable<minimum:raise ValueError('Hostile has insufficient modeled sensor/effector geometry response window')
  windows[track['id']]=dict(first_tick=first_tick,last_tick=last_tick,usable_ticks=usable)
 peak=max(live_counts,default=0)
 if peak>s['raid']['constraints']['peak_hostile_cap']:raise ValueError('Raid exceeds difficulty simultaneous hostile cap')
 return dict(basis='Geometric baseline check with declared ranges; not calibrated sensor reliability or a certified human-solvability claim',response_windows=windows,peak_simultaneous_hostiles=peak,saturation_index=round(peak/s['effector_config']['engagement_channels'],3))


def compose_raid(request):
 req=request if isinstance(request,RaidRequest) else RaidRequest.model_validate(request)
 threats,effectors=configs()
 cap={'foundational':3,'standard':6,'challenging':12}[req.difficulty]
 max_waves=min(4,max(1,req.duration//45))
 requested_hostiles=sum(threats['profiles'][p]['identity']=='hostile' for p in req.mix) if req.mix else req.contacts-min(4,max(1,req.contacts//4)) if req.contacts is not None else 0
 if requested_hostiles>cap*max_waves:raise ValueError('Requested roster cannot fit bounded nonoverlapping waves at this duration/difficulty')
 last_error=None
 for attempt in range(24):
  try:s=_candidate(req,attempt,threats,effectors)
  except ValueError as error:
   last_error=error;continue
  if all(similarity(s['raid']['signature'],old)<=.6 for old in req.recent_signatures):return s
 raise ValueError('No bounded nonrepeating raid after 24 deterministic candidates: '+str(last_error or 'recent signature similarity exceeds 0.6'))


def group_metrics(scenario,events,tracks,execution_tick):
 """Reconstructed observed group facts; never edits score or learning history."""
 groups={}
 for track in tracks:
  group=track.get('group_id')
  if group and track['spawn']<=execution_tick:groups.setdefault(group,[]).append(track)
 result=[]
 for group,members in sorted(groups.items()):
  ids={t['id'] for t in members}
  attempts=[a for a in events if a['track'] in ids and a['k']=='engage' and a['tick']<=execution_tick]
  first=min((a['tick'] for a in attempts),default=None)
  resolved=sum(bool(t.get('resolved')) for t in members)
  result.append(dict(group_id=group,contacts=sorted(ids),coordinated_members=len(members),observed_leakers=sum(bool(t.get('impact')) for t in members),unresolved_at_observed_end=sum(not t.get('resolved',False) and not t.get('impact',False) for t in members),time_to_first_engagement_s=None if first is None else round((first-min(t['spawn'] for t in members))/HZ,3),engagement_attempts=len(attempts),attempts_per_resolved_contact=round(len(attempts)/resolved,3) if resolved else None,effector_attempt_counts=dict(Counter(a['effector'] for a in attempts))))
 return dict(version=1,basis='Observed reconstructed group outcomes; attempts/contact is descriptive, not a military effector-efficiency certification',groups=result,planned_peak_threats=scenario['raid']['validation']['peak_simultaneous_hostiles'],planned_saturation_index=scenario['raid']['validation']['saturation_index'])
