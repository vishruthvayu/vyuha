"""Actual Python v0.5 parity oracle; no production data or network."""
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
from server.acquisition import make_practice
from server.engine_v3 import Simulation, score


def projection(sim):
    return dict(tick=sim.tick, acquisition=sim.acquisition_snapshot(),
                tracks=[{k:t[k] for k in ['id','active','detected','designated','classification','declared','thermal','radar','observation']} for t in sim.tracks],
                events=sim.events, commands=sim.commands, score=score(sim))


def fixture(night, fault, early):
    scenario=make_practice(482913,night)
    sim=Simulation(scenario)
    points=[]
    rejected=[]
    for tick in range(241):
        if tick==150:
            assert sim.act(dict(tick=tick,order=sim.next_order,k='inspect',track='T1',channel='ir',request_id='parity_ir'))
        if tick==151:
            rejected.append(sim.act(dict(tick=tick,order=sim.next_order,k='inspect',track='T1',channel='ir',request_id='parity_ir')))
        if tick==152:
            rejected.append(sim.act(dict(tick=tick,order=sim.next_order,k='inspect',track='T1',channel='eo',request_id='busy_eo')))
        if tick==170 and fault:
            assert sim.control(dict(seq=1,command_id='irfault',type='sensor_fault',payload=dict(sensor='ir',mode='failed'),tick=tick,order=sim.next_order))
        if tick==160 and early:
            sim.end_acquisition()
        if tick==186 and not early:
            assert sim.act(dict(tick=tick,order=sim.next_order,k='designate',track='T1'))
        if tick==190 and not early:
            assert sim.act(dict(tick=tick,order=sim.next_order,k='classify',track='T1',kind='quad',identity='hostile'))
        if tick in [0,60,120,149,150,151,152,159,160,169,170,179,180,185,186,189,190,239,240]:
            points.append(json.loads(json.dumps(projection(sim))))
        if tick<240:sim.step(force=True)
    return dict(scenario=scenario,checkpoints=points,events=sim.events,commands=sim.commands,rejected=rejected,early_end=160 if early else None)

print(json.dumps([fixture(False,False,False),fixture(True,False,False),fixture(False,True,False),fixture(False,False,True)]))
