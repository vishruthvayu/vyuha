"""Versioned educational authoring on the admitted v0.5 engine, not a new sensor model."""
import copy
import json
import threading
from typing import Literal
from fastapi import APIRouter, HTTPException
from pydantic import Field
from .models import StrictModel
from .raid_v2 import RaidRequest, compose_raid, raid_id
from .engine_v3 import Simulation, DEFAULT_POLICY
from .storage import connect, dumps

VERSION='observation-mission-v1'
ASSESSMENT='evidence-assessment-v1'
TEMPLATES={
 'night_switch':dict(title='A channel is not an answer',summary='Night optics may be unavailable. Choose a useful cross-check and retain uncertainty about affiliation.',objectives=['Separate channel unavailability from an empty sky.','Choose a cross-check that can supply new information.','Keep shape resolution separate from affiliation.'],competencies=['C01','C02','C05'],night=True,fog=.15,terrain='urban',family='DIRECT',mix=['hostile_quad','friendly_uav','bird']),
 'civil_restraint':dict(title='Resolve the affiliation conflict',summary='Positive affiliation cues can justify restraint even when optical detail is inconclusive or old.',objectives=['Compare current IFF, radar and requested optics without discarding contradictory cues.','Use positive affiliation evidence when selecting restraint.','Do not infer hostility from no reply or absence of a radio report.'],competencies=['C02','C03','C05'],night=False,fog=.28,terrain='rural',family='DIRECT',mix=['civil_uav','friendly_uav','hostile_quad','bird']),
 'timed_window':dict(title='Evidence has a clock',summary='Moving contacts and short-lived reports create a timing problem, not a request-count competition.',objectives=['Relate request, sample, publication and expiry to the decision boundary.','Reacquire only when a new observation can change a decision.','Retain uncertainty when current evidence does not establish type or affiliation.'],competencies=['C01','C02','C03'],night=False,fog=.45,terrain='urban',family='LOW_APPROACH',mix=['hostile_quad','no_rf_fpv','friendly_uav','bird']),
}
Template=Literal['night_switch','civil_restraint','timed_window']
Mode=Literal['practice','assessment']

class PrepareMission(StrictModel):
 template:Template='night_switch'
 seed:int=Field(default=482913,ge=0,le=4294967295)
 mode:Mode='practice'

class MissionRequest(PrepareMission):
 version:Literal['observation-mission-v1']=VERSION
 title:str=Field(default='',max_length=70)
 duration:int=Field(default=90,ge=60,le=120)
 terrain:Literal['urban','rural']|None=None
 night:bool|None=None
 fog:float|None=Field(default=None,ge=0,le=.8,allow_inf_nan=False)
 dwell_ticks:int=Field(default=30,ge=15,le=150)
 expiry_ticks:int|None=Field(default=None,ge=30,le=600)
 objectives:list[str]|None=Field(default=None,min_length=1,max_length=5)
 extra_contacts:int=Field(default=0,ge=0,le=2)

router=APIRouter(prefix='/api/v1/observation-missions',tags=['Authored observation missions'])
_SLOT=threading.BoundedSemaphore(1)

def brief(template):
 t=TEMPLATES[template]
 return dict(id=template,title=t['title'],summary=t['summary'],objectives=t['objectives'],competencies=t['competencies'],default_conditions=dict(night=t['night'],fog=t['fog'],terrain=t['terrain']))

def compile_mission(request):
 req=request if isinstance(request,MissionRequest) else MissionRequest.model_validate(request)
 t=TEMPLATES[req.template]
 if req.title and not req.title.strip():raise ValueError('Mission title cannot be blank')
 objectives=req.objectives if req.objectives is not None else t['objectives']
 if any(not isinstance(x,str) or not x.strip() or len(x)>200 for x in objectives):raise ValueError('Use 1–5 nonblank objectives of at most 200 characters')
 s=compose_raid(RaidRequest(seed=req.seed,duration=req.duration,name=req.title or t['title'],difficulty='foundational',focus='classification_iff',family=t['family'],terrain=req.terrain or t['terrain'],night=t['night'] if req.night is None else req.night,fog=t['fog'] if req.fog is None else req.fog,mix=t['mix']+['bird']*req.extra_contacts,fusion={'mode':'assessment' if req.mode=='assessment' else 'training'}))
 s['engine_version']='vyuha-0.5.0'
 s['acquisition_policy']=dict(DEFAULT_POLICY,cadenceTicks=s['sensor_config']['optical_sample_ticks'],dwellTicks=req.dwell_ticks,expiryTicks=req.expiry_ticks if req.expiry_ticks is not None else {'night_switch':180,'civil_restraint':300,'timed_window':60}[req.template])
 s['observation_mission']=dict(version=VERSION,assessment_version=ASSESSMENT,template=req.template,criterion_profile=req.template,mode=req.mode,title=s['title'],objectives=objectives,competencies=t['competencies'],authoring=req.model_dump())
 s['id']=raid_id(s)
 return s

def validate_mission(scenario):
 metadata=scenario.get('observation_mission')
 if type(metadata) is not dict or set(metadata)!={'version','assessment_version','template','criterion_profile','mode','title','objectives','competencies','authoring'}:raise ValueError('Unsupported observation mission metadata')
 if metadata['version']!=VERSION or metadata['assessment_version']!=ASSESSMENT:raise ValueError('Unsupported mission/educational assessment contract')
 expected=compile_mission(MissionRequest.model_validate(metadata['authoring']))
 if scenario!=expected:raise ValueError('Frozen observation mission disagrees with its complete authored definition')
 return scenario

def rehearse(scenario, *, _validate=validate_mission, _simulation=Simulation):
 """One observable-only probe; no raw optical/identity truth drives actions."""
 _validate(scenario)
 sim=_simulation(scenario);end=scenario['duration']*30
 requests=[];positive_iff=[];intervals=[];open_intervals={};turn=0
 for tick in range(end+1):
  observed=[t for t in sim.tracks if t['active'] and t['observation']['radar']['position'] is not None and t['observation']['radar']['sample_tick'] is not None]
  for t in sim.tracks:
   o=t['observation']
   for channel in ('radar','eo','ir','rf','iff'):
    v=o[channel];state=(v.get('state') if channel=='radar' else v.get('level') if channel in ('eo','ir') else v.get('cue') if channel=='iff' else 'detected' if v.get('detected') else 'none')
    key=(t['id'],channel);reading=(bool(t['active']),v['available'],state);prior=open_intervals.get(key)
    if prior and prior['reading']!=reading:
     intervals.append(dict(track=key[0],channel=channel,start_tick=prior['start'],end_tick=tick,active=prior['reading'][0],available=prior['reading'][1],state=prior['reading'][2]));prior=None
    if prior is None:open_intervals[key]=dict(start=tick,reading=reading)
   if t['active'] and o['iff']['cue'] in ('friendly_reply','registered_civil') and not any(x['track']==t['id'] for x in positive_iff):positive_iff.append(dict(track=t['id'],tick=tick,cue=o['iff']['cue']))
  a=sim.acquisition_snapshot()
  if observed and not a['pending'] and tick>=a['cooldownUntil'] and tick<end-180 and len(requests)<12:
   target=observed[(turn//2)%len(observed)];channel=('eo','ir')[turn%2]
   action=dict(tick=tick,order=sim.next_order,k='inspect',track=target['id'],channel=channel,request_id=f'author_probe_{turn}')
   if sim.act(action):requests.append(action);turn+=1
  if tick==end:break
  sim.step(force=True)
 for (track,channel),v in open_intervals.items():intervals.append(dict(track=track,channel=channel,start_tick=v['start'],end_tick=end+1,active=v['reading'][0],available=v['reading'][1],state=v['reading'][2]))
 a=sim.acquisition_snapshot();results=a['results']
 coverage=dict(radar_aliases=sorted({q['track'] for q in requests}),accepted_requests=len(requests),published_results=len(results),unavailable_results=sum(not r['reading']['available'] for r in results),optical_detections=sum(r['reading']['available'] and r['reading']['level']!='none' for r in results),positive_affiliation_reports=positive_iff)
 checks=[dict(id='observed_alias',passed=bool(requests),description='At least one radar-reported alias admitted a request.'),dict(id='publication',passed=bool(results),description='A scheduled request reached publication inside the frozen horizon.')]
 if scenario['observation_mission']['template']=='night_switch':checks.append(dict(id='channel_contrast',passed=any(r['channel']=='eo' and not r['reading']['available'] for r in results) and any(r['channel']=='ir' and r['reading']['available'] and r['reading']['level']!='none' for r in results),description='This probe produced unavailable EO and detected IR at their own sample moments.'))
 elif scenario['observation_mission']['template']=='civil_restraint':checks.append(dict(id='positive_affiliation',passed=bool(positive_iff),description='At least one positive affiliation cue occurred in the passive modeled stream.'))
 else:checks.append(dict(id='dated_optical_evidence',passed=any(r['reading']['level']!='none' and r['expiryTick']<end for r in results),description='At least one detected report has a sample/release/expiry boundary before the horizon.'))
 return dict(version='observation-mission-rehearsal-v1',scenario_id=scenario['id'],request_schedule=requests,results=results,passive_intervals=intervals,coverage=coverage,checks=checks,attainable_probe=all(c['passed'] for c in checks),limitations=['One deterministic author-only request schedule, not an optimal policy, human detectability or guaranteed solvability.','A check failure can be an intentionally authored information problem; publication remains allowed with explicit warning.','EO/IR intervals here are the probe schedule’s released observations; radar/RF/IFF remain passive.','No observations from this rehearsal are copied into a trainee session.'])

def _persist(scenario):
 with connect() as db:db.execute('INSERT OR IGNORE INTO scenarios(id,spec) VALUES (?,?)',(scenario['id'],dumps(scenario)))
 return scenario

@router.get('/catalog')
def catalog():
 with connect() as db:rows=db.execute("SELECT id,spec FROM scenarios WHERE json_extract(spec,'$.observation_mission.version')=? ORDER BY rowid DESC LIMIT 40",(VERSION,)).fetchall()
 missions=[]
 for row in rows:
  s=json.loads(row['spec']);m=s['observation_mission'];missions.append(dict(id=s['id'],title=m['title'],objectives=m['objectives'],mode=m['mode'],template=m['template']))
 return dict(version=VERSION,templates=[brief(k) for k in TEMPLATES],missions=missions)

@router.post('/prepare')
def prepare(request:PrepareMission):
 try:return _persist(compile_mission(MissionRequest(**request.model_dump())))
 except ValueError as e:raise HTTPException(422,str(e)) from e

@router.post('/compile')
def compile_preview(request:MissionRequest):
 if not _SLOT.acquire(blocking=False):raise HTTPException(429,'Another author rehearsal is running; retry after it finishes')
 try:
  scenario=compile_mission(request);return dict(scenario=scenario,rehearsal=rehearse(scenario))
 except ValueError as e:raise HTTPException(422,str(e)) from e
 finally:_SLOT.release()

@router.post('/publish')
def publish(request:MissionRequest):
 try:return _persist(compile_mission(request))
 except ValueError as e:raise HTTPException(422,str(e)) from e

@router.get('/{scenario_id}')
def frozen(scenario_id:str):
 with connect() as db:row=db.execute('SELECT spec FROM scenarios WHERE id=?',(scenario_id,)).fetchone()
 if not row:raise HTTPException(404,'Frozen observation mission not found')
 scenario=json.loads(row['spec'])
 if not scenario.get('observation_mission'):raise HTTPException(404,'Scenario is not an observation mission')
 try:validate_mission(scenario)
 except ValueError as e:raise HTTPException(422,str(e)) from e
 return scenario
