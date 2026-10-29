"""Actual engine checkpoints around each site's geometric loss/reacquisition."""
import json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[4]))
from server.observation_missions_v3 import compile_mission,rehearse
from server.engine_v4 import Simulation,replay,score

def projection(sim):
 return dict(tick=sim.tick,acquisition=sim.acquisition_snapshot(),tracks=[{k:t[k] for k in ['id','active','detected','designated','classification','declared','thermal','radar','observation']} for t in sim.tracks],events=sim.events,commands=sim.commands,score=score(sim))
out=[]
for site in ('freight_corridor','open_campus'):
 s=compile_mission(dict(site=site,template='timed_window'));report=rehearse(s);sim=Simulation(s)
 schedule={a['tick']:a for a in report['request_schedule']}
 end=s['duration']*30
 for tick in range(end+1):
  if tick in schedule:
   a={**schedule[tick],'order':sim.next_order};assert sim.act(a)
  if tick in (300,900,2000):
   t=sim.tracks[0]
   if t['active'] and t['detected'] is not None:assert sim.act(dict(k='defer',track=t['id'],tick=tick,order=sim.next_order,decision_version='uncertainty-decisions-v1',reason='type_unresolved'))
  if tick<end:sim.step(force=True)
 points={0,60,150,300,900,2000,end}
 for v in report['site_geometry']['line_of_sight_intervals']:
  points.update(max(0,min(end,v['start_tick']+d)) for d in (-1,0,1))
 for r in sim.acquisition_snapshot()['results']:
  points.update(max(0,min(end,r[k])) for k in ('sampleTick','releaseTick','expiryTick'))
 events=sim.events
 out.append(dict(scenario=s,events=events,checkpoints=[projection(replay(s,[a for a in events if a['tick']<=tick],tick)) for tick in sorted(points)]))
print(json.dumps(out))
