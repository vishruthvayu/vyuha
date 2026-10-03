"""Versioned illustrative configurations and deterministic scenario compilation."""
import copy,hashlib
from typing import Literal
from pydantic import Field,model_validator
from .models import StrictModel
from .engine import rng,make_scenario
from .storage import dumps

Tactic=Literal['DIRECT','SATURATION','DECOY_THEN_STRIKE','STAGGERED_WAVES','LOW_APPROACH']
TACTICS=['DIRECT','SATURATION','DECOY_THEN_STRIKE','STAGGERED_WAVES','LOW_APPROACH']
PACKS={
 'army-forward-post':dict(id='army-forward-post',version=1,name='Army Forward Post',description='Mixed hostile approaches, no-RF FPV and sensor degradation.',example_values=True,
  defaults=dict(fog=.2,night=True,mix=['bird','friendly_uav','hostile_quad','no_rf_fpv','fixed_wing','hostile_quad']),rules=dict(rf_range=180,kinetic_range=160,restricted=dict(enabled=True,x_lt=-30,z_gt=20),effectors=['hold','rf_jam','kinetic'],risk_weights=dict(quad=1,fixed_wing=1.2,fiber_fpv=1.5,bird=0),asset_risk=1)),
 'capf-border-post':dict(id='capf-border-post',version=1,name='CAPF / Border Post',description='Mixed friendly/neutral traffic and lower-volume incursions.',example_values=True,
  defaults=dict(fog=.15,night=False,mix=['bird','friendly_uav','friendly_uav','hostile_quad','no_rf_fpv']),rules=dict(rf_range=150,kinetic_range=130,restricted=dict(enabled=True,x_lt=-30,z_gt=20),effectors=['hold','rf_jam','kinetic'],risk_weights=dict(quad=1,fixed_wing=1.1,fiber_fpv=1.3,bird=0),asset_risk=1)),
 'critical-infrastructure':dict(id='critical-infrastructure',version=1,name='Critical Infrastructure',description='Shorter effector ranges and a broader restricted kinetic sector.',example_values=True,
  defaults=dict(fog=.1,night=False,mix=['bird','friendly_uav','hostile_quad','no_rf_fpv','fixed_wing']),rules=dict(rf_range=140,kinetic_range=110,restricted=dict(enabled=True,x_lt=-15,z_gt=0),effectors=['hold','rf_jam','kinetic'],risk_weights=dict(quad=1,fixed_wing=1.4,fiber_fpv=1.8,bird=0),asset_risk=1.2)),
}
for p in PACKS.values():p['rules'].update(distance_precision=9,hold_any_range=True)
for p in PACKS.values():p.update(allowed_tactics=TACTICS,rubric=dict(detect=25,classify=25,prioritise=15,engage=35),terminology='illustrative training configuration; not official doctrine')
PRESETS={'bird':('bird','neutral',False),'friendly_uav':('quad','friendly',True),'hostile_quad':('quad','hostile',True),'no_rf_fpv':('fiber_fpv','hostile',False),'fixed_wing':('fixed_wing','hostile',False)}

class AuthorScenario(StrictModel):
 name:str=Field(min_length=3,max_length=70)
 created_by:str=Field(default='LOCAL-INSTRUCTOR',min_length=1,max_length=24,pattern=r'^[A-Za-z0-9_-]+$')
 pack_id:str='army-forward-post'
 seed:int=Field(default=482913,ge=0,le=4294967295)
 focus:Literal['detection','classification_iff','effector_choice','degraded_sensor_response']='effector_choice'
 terrain:Literal['urban']='urban'
 night:bool=True
 tactic:Tactic='DIRECT'
 mix:list[Literal['bird','friendly_uav','hostile_quad','no_rf_fpv','fixed_wing']]=Field(default_factory=lambda:['bird','friendly_uav','hostile_quad','no_rf_fpv'],min_length=1,max_length=18)
 sensor_fault:Literal['none','radar_degraded','radar_failed','rf_failed']='none'
 restricted:bool=True
 duration:Literal[75]=75
 difficulty:Literal['foundational','standard','challenging']='standard'
 @model_validator(mode='after')
 def compatible(self):
  if len(self.name.strip())<3:raise ValueError('Scenario name needs at least three non-space characters')
  if self.pack_id not in PACKS:raise ValueError('Unknown doctrine pack')
  hostile=sum(x in ['hostile_quad','no_rf_fpv','fixed_wing'] for x in self.mix)
  if self.tactic=='SATURATION' and hostile<3:raise ValueError('Saturation requires at least three hostile contacts')
  if self.tactic=='DECOY_THEN_STRIKE' and not {'hostile_quad','no_rf_fpv'}<=set(self.mix):raise ValueError('Decoy then strike requires an RF hostile quad and no-RF FPV')
  if self.tactic=='STAGGERED_WAVES' and len(self.mix)<3:raise ValueError('Staggered waves requires at least three contacts')
  if self.tactic=='LOW_APPROACH' and not hostile:raise ValueError('Low approach requires a hostile contact')
  return self

def scenario_id(s,prefix='adv'):
 s=copy.deepcopy(s);s.pop('id',None);return prefix+'_'+hashlib.sha256(dumps(s).encode()).hexdigest()[:24]

def apply_tactic(s,tactic,seed):
 """Compile timing/formation into the existing contact contract; reconstruction uses this snapshot."""
 s=copy.deepcopy(s);r=rng(seed);phases={};hostiles=[t for t in s['tracks'] if t['identity']=='hostile']
 for i,t in enumerate(s['tracks']):
  if tactic=='DIRECT':t['spawn']=0 if t['identity']!='hostile' else 60+i*15;role='direct'
  elif tactic=='SATURATION':
   t['spawn']=90+(hostiles.index(t)%3)*6 if t['identity']=='hostile' else 0
   if t['identity']=='hostile':t['bearing']=(35+(hostiles.index(t)%3)*55+int(r()*8))%360
   role='saturation' if t['identity']=='hostile' else 'background'
  elif tactic=='DECOY_THEN_STRIKE':
   strike=t['kind']=='fiber_fpv' and t['identity']=='hostile';t['spawn']=480 if strike else 240 if t['identity']=='hostile' else 0
   if t['identity']=='hostile':t['bearing']=(70 if strike else 35)+int(r()*8)
   role='strike' if strike else 'decoy' if t['identity']=='hostile' else 'background'
  elif tactic=='STAGGERED_WAVES':t['spawn']=(i%3)*240;role=f'wave_{i%3+1}'
  else:
   t['spawn']=90+i*12 if t['identity']=='hostile' else 0;role='low_approach' if t['identity']=='hostile' else 'background'
   if t['identity']=='hostile':t.update(altitude=4,distance=150,speed=max(t['speed'],3.8),radar_range=100,thermal_range=100)
  phases.setdefault((t['spawn'],role),[]).append(t['id'])
 s['red_force']=dict(version=1,tactic=tactic,tactic_seed=seed,phases=[dict(tick=t,role=role,contacts=ids) for (t,role),ids in sorted(phases.items())])
 return s

def enrich(s,pack_id,tactic=None,history=None):
 p=copy.deepcopy(PACKS[pack_id]);d=s.get('director_decision');seed=d['scenario_seed'] if d else s['seed']
 if tactic is None:
  choices={'detection':['LOW_APPROACH','DIRECT','STAGGERED_WAVES'],'classification_iff':['STAGGERED_WAVES','DIRECT','DECOY_THEN_STRIKE'],'effector_choice':['DECOY_THEN_STRIKE','DIRECT','SATURATION'],'degraded_sensor_response':['SATURATION','STAGGERED_WAVES','LOW_APPROACH']}.get(s['focus'],TACTICS)
  recent=[f.split(': ',1)[1] for h in (history or []) for f in h.get('scenario_features',[]) if f.startswith('Threat pattern: ')]
  allowed=[c for c in choices if c not in recent[:2]] or choices
  tactic=allowed[int(rng(seed)()*len(allowed))]
 s=apply_tactic(s,tactic,seed);s['doctrine']=p;s['prioritisation_version']=1
 if d:
  s['director_decision']['scenario_features']+=['Threat pattern: '+tactic,'Illustrative pack: '+p['name']]
  s['director_decision']['fingerprint']=hashlib.sha256(dumps({k:v for k,v in s.items() if k not in ['id','director_decision']}).encode()).hexdigest()[:24]
 s['id']=scenario_id(s);return s

def compile_authored(req):
 p=PACKS[req.pack_id];r=rng(req.seed);s=make_scenario(req.seed,req.focus,req.night)
 tracks=[]
 for i,preset in enumerate(req.mix):
  kind,identity,rf=PRESETS[preset]
  tracks.append(dict(id=f'T{i+1}',kind=kind,identity=identity,rf=rf,spawn=0,bearing=int(r()*360),distance=125+int(r()*40),speed={'bird':.65,'quad':2.5,'fiber_fpv':3.8,'fixed_wing':2.8}[kind],altitude={'bird':22,'quad':20,'fiber_fpv':10,'fixed_wing':35}[kind]))
 s.update(title=req.name,focus=req.focus,tracks=tracks,fog=p['defaults']['fog'],jamStart=2250,jamEnd=2250,terrain='urban',difficulty_label=req.difficulty)
 s=enrich(s,req.pack_id,req.tactic);s['doctrine']['rules']['restricted']['enabled']=req.restricted
 if req.sensor_fault=='radar_degraded':s.update(jamStart=180,jamEnd=660)
 elif req.sensor_fault=='radar_failed':s.update(radarFailureStart=180,radarFailureEnd=660)
 elif req.sensor_fault=='rf_failed':s.update(rfFailureStart=180,rfFailureEnd=660)
 s['authoring']=dict(version=1,created_by=req.created_by,identity_basis='unverified local instructor label',request=req.model_dump())
 s['id']=scenario_id(s,'lib');return s
