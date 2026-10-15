#!/usr/bin/env python3
"""Reproducible Stage 5 timings; synthetic API load, no efficacy experiment."""
import json,os,sys,time,statistics,runpy
from pathlib import Path
import httpx
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from server.exercises import AuthorScenario,compile_authored,enrich
from server.engine import make_scenario,Simulation
from server.advanced import make_rapid
from server.prioritisation import evaluate

def measure(fn,n=50):
 values=[]
 for _ in range(n):
  start=time.perf_counter();fn();values.append((time.perf_counter()-start)*1000)
 return dict(n=n,median_ms=round(statistics.median(values),4),max_ms=round(max(values),4))

if __name__=='__main__':
 token=os.environ.get('VYUHA_BENCHMARK_OFFICER_TOKEN','')
 if len(sys.argv)>1 and not token:raise SystemExit('For an external analytics target, set VYUHA_BENCHMARK_OFFICER_TOKEN to an authorized officer token. It is never printed.')
 scenario=compile_authored(AuthorScenario(name='Benchmark',tactic='SATURATION',mix=['hostile_quad']*6))
 sim=Simulation(scenario)
 while sim.tick<150:sim.step()
 for t in sim.tracks:
  for a in [dict(k='designate'),dict(k='classify',kind=t['kind'],identity=t['identity']),dict(k='engage',effector='rf_jam')]:sim.act(dict(tick=150,order=len(sim.events),track=t['id'],**a))
 workload=runpy.run_path(str(Path(__file__).with_name('benchmark-unit.py')))['benchmark']
 results=dict(method='Local warm process, 50 sequential microbenchmarks. HTTP concurrency uses fresh disposable SQLite, three rounds/client, same six-client barrier workload. No human learner, WAN latency, CPU or low-end certification claims.',microbenchmarks={
 'red_force_generation':measure(lambda:enrich(make_scenario(7),'army-forward-post','SATURATION')),
 'rapid_15_round_generation':measure(lambda:make_rapid(7,15)),
 'authored_validation_and_compilation':measure(lambda:compile_authored(AuthorScenario.model_validate(dict(name='Benchmark',tactic='DECOY_THEN_STRIKE',mix=['friendly_uav','hostile_quad','no_rf_fpv'])))),
 'prioritisation_calculation_six_choices':measure(lambda:evaluate(sim))},legacy_six_client=workload(6),advanced_six_client=workload(6,advanced=True))
 if len(sys.argv)>1:
  with httpx.Client(base_url=sys.argv[1],timeout=60,headers={'Authorization':'Bearer '+token}) as client:
   def endpoint():client.get('/api/v1/units/local/analytics').raise_for_status()
   results['unit_analytics_http']=measure(endpoint,30)
 print(json.dumps(results,indent=2))
