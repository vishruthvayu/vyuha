#!/usr/bin/env python3
"""Repeatable local scale and production component measurements, disposable SQLite."""
import argparse,copy,json,math,statistics,sys,tempfile,tracemalloc,platform
from pathlib import Path
from time import perf_counter
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from server.engine import make_scenario,Simulation,score,replay
from server.review import build_review
from server.director import select_director,adapt_scenario
from server.exercises import enrich,AuthorScenario,compile_authored
from server.advanced import make_rapid
from server import main,storage

def stats(values):
 x=sorted(values);return dict(n=len(x),median_ms=round(statistics.median(x),4),p95_ms=round(x[max(0,math.ceil(.95*len(x))-1)],4))
def scale(n):
 s=make_scenario(62147);base=s['tracks'];s['id']='scale_'+str(n);s['tracks']=[dict(**{k:v for k,v in base[i%8].items() if k not in ['id','spawn','distance','bearing']},id=f'T{i+1}',spawn=0,distance=125+i%15,bearing=(i*137)%360) for i in range(n)];return s
p=argparse.ArgumentParser();p.add_argument('--output',type=Path,required=True);a=p.parse_args();results=[]
for n in [8,25,50,100,200]:
 s=scale(n);sim=Simulation(s);ticks=[]
 for i in range(2250):
  t=perf_counter();sim.step();ticks.append((perf_counter()-t)*1000)
 times=[];aar=None
 for i in range(5):
  t=perf_counter();aar,card=build_review(s,[],[],'scale-measure',2250);times.append((perf_counter()-t)*1000)
 assert card==score(sim)
 tracemalloc.start();replay(s,[],2250);_,peak=tracemalloc.get_traced_memory();tracemalloc.stop()
 results.append(dict(contacts=n,tick=stats(ticks),ghost_replay_scoring=stats(times),python_traced_peak_mib=round(peak/1024**2,3),review_payload_bytes=len(json.dumps(aar).encode()),score=card['score'],render_fps=None,note='All contacts spawn together; unchanged movement/sensor/scoring. Empty trainee decisions test worst missed-contact reconstruction. Python traced allocations are not whole-process RSS. Rendering requires browser benchmark.'))
components={}
with tempfile.TemporaryDirectory(prefix='vyuha-hardening-bench-') as folder:
 old=storage.DB_PATH;storage.DB_PATH=Path(folder)/'bench.db';storage.init();profile=main.profile('SCALE-QA')
 funcs={'scenario_generation':lambda:main.generate(main.Generate(seed=62147,trainee='SCALE-QA',mode='adaptive',advanced=True)),'director_decision':lambda:select_director(profile,[],62147),'red_force':lambda:enrich(make_scenario(62147),'army-forward-post','SATURATION'),'rapid_15':lambda:make_rapid(62147,15),'author_compile':lambda:compile_authored(AuthorScenario(schema_version=2,name='Benchmark rural',terrain='rural')),'dashboard':lambda:main.dashboard('local')}
 for label,fn in funcs.items():
  fn();samples=[]
  for i in range(50):t=perf_counter();fn();samples.append((perf_counter()-t)*1000)
  components[label]=stats(samples)
 storage.DB_PATH=old
report=dict(schema_version=1,environment=dict(os=platform.system(),python=platform.python_version()),method='2250 simulation steps per contact size, five Ghost/replay/scoring runs, 50 warm component runs. Local CPU only. Memory is tracemalloc peak, not device RAM or RSS. Empty histories for component dashboard. HTTP concurrency measured separately.',scale=results,components=components)
a.output.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
