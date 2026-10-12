"""Version-aware Ghost entrypoints; released review semantics remain frozen."""
from .review_v1_0_1 import *
from . import review_v1_0_1 as legacy
from .engine import validate_engine

def evidence(sim,t):
    if sim.scenario.get('engine_version')=='vyuha-0.4.0':
        from .review_v2 import evidence as finale_evidence
        return finale_evidence(sim,t)
    return legacy.evidence(sim,t)

def build_review(scenario,actions,commands,sid,observed_end,horizon_source='completion',scoring_end=2250):
    validate_engine(scenario)
    if scoring_end!=round(scenario['duration']*30):raise ValueError('Scoring horizon must match frozen exercise duration')
    if scenario.get('engine_version')=='vyuha-0.4.0':
        from .review_v2 import build_review as finale_review
        return finale_review(scenario,actions,commands,sid,observed_end,horizon_source,scoring_end)
    return legacy.build_review(scenario,actions,commands,sid,observed_end,horizon_source,scoring_end)
