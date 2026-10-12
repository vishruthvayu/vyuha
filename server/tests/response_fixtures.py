"""Full dispatched response-mode fixtures; synthetic inputs, not human validation."""
import copy
import json
from server.engine import Simulation,replay,score
from server.raid_v2 import compose_raid
from server.response_v2 import configuration,public_state
CHECKPOINTS=(0,10,11,12,15,20,25,26,30,31,32,35,46,52,75,120)
FIELDS=('id','active','resolved','impact','detected','designated','classification','declared','attempts','observation')

def projection(sim):
    return copy.deepcopy(dict(tick=sim.tick,tracks=[{k:t[k] for k in FIELDS} for t in sim.tracks],response=public_state(sim.response_state),events=sim.events,commands=sim.commands,scorecard=score(sim)))


def fixtures():
    result=[]
    for seed in [0,7,482913]:
        for chance in [0.,.5,1.]:
            for safety in [False,True]:
                s=compose_raid(dict(seed=seed,duration=90,terrain='rural',fog=0.,night=False,contacts=4))
                s['terrain_boxes']=[];s['tracks']=[]
                for i,(kind,rf,identity) in enumerate([('quad',True,'hostile'),('fiber_fpv',False,'hostile'),('quad',True,'friendly' if safety else 'hostile'),('quad',True,'hostile')]):
                    s['tracks'].append(dict(id=f'T{i+1}',kind=kind,rf=rf,identity=identity,spawn=0,bearing=30.+i*10,distance=170.,speed=2.,altitude=20.,motion=dict(version=1,primitive='direct',phase_s=0.,lateral_m=0.,period_s=10.,turn_deg=0.)))
                s['sensor_config']=dict(optical_reliability=1.,radar_reliability=1.)
                s['response_model']=configuration(dict(kinetic_ammo=2,kinetic_cooldown_ticks=20,kinetic_delay_ticks=15,kinetic_success_probability=chance,jammer_channels=1,jammer_duration_ticks=20,jammer_success_probability=chance))
                sim=Simulation(s);order=0;points=[]
                planned={10:[('T1','rf_jam'),('T4','rf_jam')],11:[('T2','kinetic')],12:[('T2','kinetic')],15:[('T3','kinetic')],31:[('T2','kinetic')],32:[('T2','kinetic'),('T4','rf_jam')],52:[('T4','rf_jam')]}
                while sim.tick<=120:
                    if sim.tick in [20,35]:
                        command=dict(command_id='rf'+str(sim.tick),session_id='fixture',seq=len(sim.commands)+1,issued_at='fixture',tick=sim.tick,order=order,type='sensor_fault' if sim.tick==20 else 'sensor_restore',payload=dict(sensor='rf',mode='failed') if sim.tick==20 else dict(sensor='rf'))
                        assert sim.control(command);order+=1
                    for track_id,effector in planned.get(sim.tick,[]):
                        t=next(t for t in sim.tracks if t['id']==track_id)
                        if not t['active']:continue
                        if t['designated'] is None:
                            for kind,fields in [('designate',{}),('classify',dict(kind=t['kind'],identity=t['identity']))]:
                                assert sim.act(dict(tick=sim.tick,order=order,k=kind,track=t['id'],**fields));order+=1
                        a=dict(tick=sim.tick,order=order,k='engage',track=track_id,effector=effector)
                        assert sim.act(a);order+=1
                    if sim.tick in CHECKPOINTS:points.append(projection(sim))
                    if sim.tick==120:break
                    sim.step()
                terminal=replay(s,sim.events,120,sim.commands)
                assert projection(terminal)==projection(sim)
                result.append(dict(scenario=s,events=sim.events,commands=sim.commands,checkpoints=points))
    return result
if __name__=='__main__':print(json.dumps(fixtures(),separators=(',',':')))
