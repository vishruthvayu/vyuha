import copy,json
from server.exercises import AuthorScenario,compile_authored
from server.engine import replay,score
from server.tests.test_director import expert
from server.observations import Recording,RecordedSource

def fixtures():
 out=[]
 for i,(night,fog) in enumerate((n,f) for n in [False,True] for f in [0.0,.2,.6]):
  s=compile_authored(AuthorScenario(schema_version=2,name='Rural parity',terrain='rural',night=night,fog=fog,seed=62147+i,tactic='DECOY_THEN_STRIKE',sensor_fault=['radar_failed','rf_failed','radar_degraded'][i%3]));sim=expert(s);checkpoints=[]
  for tick in [0,90,180,300,480,660,750,1800,2250]:
   x=replay(s,[e for e in sim.events if e['tick']<=tick],tick);checkpoints.append(dict(tick=tick,radar_status=x.radar_status,rf_available=x.rf_available,tracks=[{k:t[k] for k in ['id','detected','resolved','impact','radar','thermal','classification','declared','attempts']} for t in x.tracks]))
  out.append(dict(scenario=s,events=sim.events,checkpoints=checkpoints,scorecard=score(sim)))
 from pathlib import Path
 r=Recording.model_validate_json((Path(__file__).resolve().parents[2]/'client/public/examples/recorded-exercise.json').read_text());source=RecordedSource(r)
 return dict(rural=out,recording=r.model_dump(),recorded_observations=[source.observations_at(t) for t in [0,29,30,299,300]])
if __name__=='__main__':print(json.dumps(fixtures()))
