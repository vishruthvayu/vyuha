import copy, hashlib, json, platform, statistics, subprocess, time, types
from pathlib import Path
from server import engine_v3
from server.acquisition import make_practice
from server.raid_v2 import compose_raid,RaidRequest
BASELINE='733c6f8581c164ea287824aa8fda2580094922ac'
source=subprocess.check_output(['git','show',BASELINE+':server/engine_v3.py'],text=True)
old=types.ModuleType('server._active_benchmark_baseline');old.__package__='server';exec(compile(source,'733c6f8/engine_v3.py','exec'),old.__dict__)
def projection(sim):
 return dict(tracks=sim.tracks,acquisition=sim.acquisition_snapshot(),events=sim.events,commands=sim.commands,score=engine_v3.score(sim))
receipts=json.loads(Path('/private/tmp/vyuha-v05-browser-receipts.json').read_text())
integrity=[]
for sid,r in receipts.items():
 args=(r['scenario'],r['events'],r['endTick'],r['commands'])
 a=old.replay(*args,acquisition_end_tick=r['executionTick']);b=engine_v3.replay(*args,acquisition_end_tick=r['executionTick'])
 assert projection(a)==projection(b)
 integrity.append(dict(session=sid,equal=True,events=len(r['events']),queries=len(b.acquisition_snapshot()['requests'])))
results=[]
for n in (3,20):
 if n==3:spec=make_practice()
 else:
  spec=compose_raid(RaidRequest(seed=482913,duration=120,difficulty='challenging',mix=(['hostile_quad','friendly_uav','bird']*7)[:20]))
  spec['engine_version']='vyuha-0.5.0';spec['acquisition_policy']=dict(engine_v3.DEFAULT_POLICY,cadenceTicks=spec['sensor_config']['optical_sample_ticks'])
 raw={'baseline':[],'optimized':[]};expected=None
 for repeat in range(3):
  for label,module in ([('baseline',old),('optimized',engine_v3)] if repeat%2==0 else [('optimized',engine_v3),('baseline',old)]):
   start=time.perf_counter();cpu=time.process_time();sim=module.Simulation(copy.deepcopy(spec))
   while sim.tick<spec['duration']*30:sim.step(force=True)
   row=dict(wall_s=time.perf_counter()-start,cpu_s=time.process_time()-cpu)
   value=projection(sim)
   if expected is None:expected=value
   assert value==expected
   raw[label].append(row)
 summary={k:dict(median_wall_s=statistics.median(r['wall_s'] for r in v),median_cpu_s=statistics.median(r['cpu_s'] for r in v),wall_range_s=[min(r['wall_s'] for r in v),max(r['wall_s'] for r in v)]) for k,v in raw.items()}
 results.append(dict(contacts=n,scenario=spec,scenario_sha256=hashlib.sha256(json.dumps(spec,sort_keys=True).encode()).hexdigest(),raw=raw,summary=summary))
 print(n,summary,flush=True)
result=dict(baseline_commit=BASELINE,optimized_source_sha256=hashlib.sha256(Path('server/engine_v3.py').read_bytes()).hexdigest(),platform=platform.system(),architecture=platform.machine(),method='Matched frozen scenarios, no actions/commands, alternating 3 paired native Python replays; equal final complete track/acquisition/event/score projections. Includes separate original browser positive and outage histories replayed identically. Loaded Mac, not isolated capacity; no GPU, headset FPS, memory or learning-gain claim.',integrity=integrity,results=results)
Path('/private/tmp/vyuha-v05-matched-performance.json').write_text(json.dumps(result,indent=2))
