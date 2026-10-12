"""Explicit scenario dispatch. Released v1.0.1 semantics remain frozen.

Absent engine_version is the original released contract (0.2 score marker or
0.3 prioritisation marker). Unknown versions fail closed instead of replaying
under a different algorithm. New engines must be registered here explicitly.
"""
from .engine_v1_0_1 import *
from . import engine_v1_0_1 as legacy

LEGACY_VERSIONS = {None, 'vyuha-0.2.0', 'vyuha-0.3.0'}

def validate_engine(scenario):
    if scenario.get('engine_version')=='vyuha-0.4.0':
        if scenario.get('version')!=2 or type(scenario.get('duration')) is not int or not 60<=scenario['duration']<=180:
            raise ValueError('Unsupported finale scenario duration/schema')
        return
    if scenario.get('engine_version') not in LEGACY_VERSIONS:
        raise ValueError('Unsupported frozen scenario engine version')
    if scenario.get('version',1)!=1:
        raise ValueError('Unsupported frozen scenario schema version')

class Simulation(legacy.Simulation):
    def __new__(cls,scenario):
        validate_engine(scenario)
        if scenario.get('engine_version')=='vyuha-0.4.0':
            from .engine_v2 import Simulation as FinaleSimulation
            return FinaleSimulation(scenario)
        return super().__new__(cls)
    def __init__(self,scenario):
        validate_engine(scenario)
        super().__init__(scenario)

def replay(scenario,actions,end_tick=2250,commands=None,observer=None):
    validate_engine(scenario)
    maximum=round(scenario['duration']*HZ)
    if isinstance(end_tick,bool) or not isinstance(end_tick,int) or not 0<=end_tick<=maximum:
        raise ValueError('Replay horizon exceeds the frozen exercise duration')
    if scenario.get('engine_version')=='vyuha-0.4.0':
        from .engine_v2 import replay as finale_replay
        return finale_replay(scenario,actions,end_tick,commands,observer)
    return legacy.replay(scenario,actions,end_tick,commands,observer)

def score(sim):
    if sim.scenario.get('engine_version')=='vyuha-0.4.0':
        from .engine_v2 import score as finale_score
        return finale_score(sim)
    return legacy.score(sim)

def position(track,tick):
    if track.get('motion'):
        from .raid_v2 import position_v2
        return position_v2(track,tick)
    return legacy.position(track,tick)
