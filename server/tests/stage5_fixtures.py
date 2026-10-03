"""Cross-language fixtures from actual authoritative advanced simulations."""
import json,copy
from server.exercises import PACKS,TACTICS,AuthorScenario,compile_authored
from server.engine import Simulation,score,ideal
from server.prioritisation import priority_fact

def fixtures():
 out=[]
 for pi,pack in enumerate(PACKS):
  for ti,tactic in enumerate(TACTICS):
   s=compile_authored(AuthorScenario(name='Parity fixture',pack_id=pack,tactic=tactic,seed=7+ti*17+pi*31,mix=['bird','friendly_uav','hostile_quad','no_rf_fpv','hostile_quad','fixed_wing'],sensor_fault=['radar_degraded','radar_failed','rf_failed'][pi]))
   sim=Simulation(s);checkpoints=[];order=0
   commands={600:('inject_swarm',{'count':6,'bearing':75}),750:('sensor_fault',{'sensor':'rf','mode':'failed'}),810:('sensor_restore',{'sensor':'rf'})}
   while sim.tick<=2250:
    if sim.tick in commands:
     kind,p=commands[sim.tick];sim.control(dict(seq=len(sim.commands)+1,tick=sim.tick,order=order,type=kind,payload=p,command_id=f'c{order}',session_id='fixture',issued_at='fixture'));order+=1
    if sim.tick%30==0 and sim.tick<2250:
     targets=[t for t in sim.tracks if t['active'] and t['detected'] is not None]
     targets.sort(key=lambda t:priority_fact(t,s['doctrine']['rules'],sim.tick)['priority'],reverse=ti%2==0)
     for t in targets:
      if t['designated'] is None:
       for a in [dict(k='designate'),dict(k='classify',kind=t['kind'],identity=t['identity'])]:sim.act(dict(tick=sim.tick,order=order,track=t['id'],**a));order+=1
      if not t['attempts']:
       sim.act(dict(tick=sim.tick,order=order,track=t['id'],k='engage',effector='rf_jam' if t['identity']=='hostile' else 'hold'));order+=1
    if sim.tick in [0,90,180,480,600,660,750,1800,2250]:
     checkpoints.append(copy.deepcopy(dict(tick=sim.tick,radar_status=sim.radar_status,rf_available=sim.rf_available,tracks=[{k:t[k] for k in ['id','detected','resolved','impact','radar','thermal','classification','declared','attempts']} for t in sim.tracks])))
    if sim.tick==2250:break
    sim.step()
   out.append(dict(scenario=s,events=sim.events,commands=sim.commands,checkpoints=checkpoints,scorecard=score(sim)))
 return out

if __name__=='__main__':print(json.dumps(fixtures()))
