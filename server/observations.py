"""Software observation adapters; no external sensor or hardware dependencies."""
import hashlib,math
from typing import Literal
from pydantic import Field,model_validator
from .models import StrictModel
from .storage import dumps

class Sample(StrictModel):
 tick:int=Field(ge=0,le=2250)
 x:float=Field(ge=-2000,le=2000,allow_inf_nan=False)
 z:float=Field(ge=-2000,le=2000,allow_inf_nan=False)
 altitude:float=Field(ge=0,le=500,allow_inf_nan=False)
 radar:bool
 thermal:bool
 rf_signal:bool|None
 iff:Literal['friendly_reply','no_reply','unavailable']

class GroundTruth(StrictModel):
 kind:Literal['bird','quad','fixed_wing','fiber_fpv']
 identity:Literal['hostile','friendly','neutral']
 rf_link:bool

class RecordedTrack(StrictModel):
 track_id:str=Field(pattern=r'^T[1-9][0-9]{0,2}$')
 samples:list[Sample]=Field(min_length=1,max_length=2251)
 ground_truth:GroundTruth|None=None
 @model_validator(mode='after')
 def monotonic(self):
  if any(a.tick>=b.tick for a,b in zip(self.samples,self.samples[1:])):raise ValueError('Samples must have strictly increasing simulation ticks')
  return self

class Recording(StrictModel):
 schema_version:Literal[1]=1
 title:str=Field(min_length=3,max_length=70)
 duration_ticks:int=Field(ge=1,le=2250)
 tracks:list[RecordedTrack]=Field(min_length=1,max_length=200)
 @model_validator(mode='after')
 def bounded(self):
  if len({t.track_id for t in self.tracks})!=len(self.tracks):raise ValueError('Duplicate track IDs')
  if sum(len(t.samples) for t in self.tracks)>20000:raise ValueError('Recording exceeds 20000 samples')
  if any(s.tick>self.duration_ticks for t in self.tracks for s in t.samples):raise ValueError('Sample exceeds recording duration')
  return self

def recording_hash(recording):return hashlib.sha256(dumps(recording.model_dump()).encode()).hexdigest()

def observation(source,tick,track,sensor,available,detected,position,**extra):
 return dict(source=source,schema_version=1,tick=tick,track_id=track,sensor=sensor,available=available,detected=detected,position=position,**extra)

class SimulatedSource:
 def __init__(self,sim):self.sim=sim
 def observations_at(self,tick):
  if tick<self.sim.tick:raise ValueError('Rewind with existing replay, then create a new adapter')
  if not 0<=tick<=2250:raise ValueError('Tick outside exercise')
  while self.sim.tick<tick:self.sim.step(force=True)
  result=[]
  for t in self.sim.tracks:
   if not t['active']:continue
   pos=dict(x=t['x'],z=t['z'],altitude=t['altitude'])
   result.extend([observation('simulated',tick,t['id'],'radar',self.sim.radar_status!='failed',t['radar'],pos),observation('simulated',tick,t['id'],'thermal',True,t['thermal'],pos),observation('simulated',tick,t['id'],'rf',self.sim.rf_available,self.sim.rf_available and t['rf'],pos,rf_signal=t['rf'] if self.sim.rf_available else None,iff='unavailable' if not self.sim.rf_available else 'friendly_reply' if t['identity']=='friendly' else 'no_reply')])
  return result

class RecordedSource:
 def __init__(self,recording):self.recording=recording
 def samples_at(self,tick):
  if not 0<=tick<=self.recording.duration_ticks:raise ValueError('Tick outside recording')
  result=[]
  for t in self.recording.tracks:
   prior=[s for s in t.samples if s.tick<=tick]
   if prior and tick-prior[-1].tick<=30:result.append((t,prior[-1]))
  return result
 def observations_at(self,tick):
  result=[]
  for t,s in self.samples_at(tick):
   pos=dict(x=s.x,z=s.z,altitude=s.altitude)
   result.extend([observation('recorded',tick,t.track_id,'radar',True,s.radar,pos,sample_tick=s.tick),observation('recorded',tick,t.track_id,'thermal',True,s.thermal,pos,sample_tick=s.tick),observation('recorded',tick,t.track_id,'rf',s.iff!='unavailable',s.rf_signal is True,pos,sample_tick=s.tick,rf_signal=s.rf_signal,iff=s.iff)])
  return result
