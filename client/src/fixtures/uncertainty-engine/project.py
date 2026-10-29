"""Actual Python oracle for the v0.6 decision extension, including observations."""
import json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[4]))
from server.observation_missions_v2 import compile_mission
from server.engine_v4 import Simulation,score

def projection(sim):
 return dict(tick=sim.tick,acquisition=sim.acquisition_snapshot(),tracks=[{k:t[k] for k in ['id','active','detected','designated','classification','declared','thermal','radar','observation']} for t in sim.tracks],events=sim.events,commands=sim.commands,score=score(sim))
def fixture(template,fault=False,early=False):
 s=compile_mission(dict(template=template));sim=Simulation(s);points=[]
 def act(**fields):assert sim.act(dict(tick=sim.tick,order=sim.next_order,track='T1',**fields))
 for tick in range(241):
  if tick==150:act(k='inspect',channel='ir',request_id='defer_parity_ir')
  if tick in (151,186,200):act(k='defer',decision_version='uncertainty-decisions-v1',reason='affiliation_unresolved')
  if tick==170 and fault:assert sim.control(dict(seq=1,command_id='fault',type='sensor_fault',payload=dict(sensor='ir',mode='failed'),tick=tick,order=sim.next_order))
  if tick==187:
   act(k='designate');act(k='classify',kind='quad',identity='hostile')
  if tick==190:act(k='engage',effector='hold')
  if tick==200:act(k='inspect',channel='eo',request_id='late_eo')
  if tick==205 and early:sim.end_acquisition()
  if tick in (0,60,149,150,151,169,170,185,186,187,190,200,205,210,240):points.append(json.loads(json.dumps(projection(sim))))
  if tick<240:sim.step(force=True)
 return dict(scenario=s,checkpoints=points,events=sim.events,commands=sim.commands,early_end=205 if early else None)
print(json.dumps([fixture('night_switch'),fixture('civil_restraint',True),fixture('timed_window',False,True)]))
