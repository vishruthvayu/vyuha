"""v0.6 adds a declared uncertainty decision; v0.5 sensor/rubric arithmetic is reused.

Defer is a recorded choice to withhold a new classification/response. It neither
classifies, designates, resolves, spends an effector nor earns tactical points.
It is not a claim about private reasoning, and absence of an action is not Defer.
"""
import copy
from . import engine_v3 as base

ENGINE_VERSION='vyuha-0.6.0'
DECISION_VERSION='uncertainty-decisions-v1'
REASONS=('type_unresolved','affiliation_unresolved','conflicting_reports')
POLICY=dict(version=DECISION_VERSION,reasons=list(REASONS))

def validate_policy(scenario):
    if scenario.get('engine_version')!=ENGINE_VERSION or scenario.get('decision_policy')!=POLICY:
        raise ValueError('Unsupported uncertainty decision engine/policy')
    normalized=copy.deepcopy(scenario)
    normalized['engine_version']=base.ENGINE_VERSION
    normalized.pop('decision_policy')
    base.validate_policy(normalized)
    return scenario['decision_policy']

class Simulation(base.Simulation):
    def __init__(self,scenario):
        validate_policy(scenario)
        normalized=copy.deepcopy(scenario);normalized['engine_version']=base.ENGINE_VERSION
        super().__init__(normalized)
        self.scenario=copy.deepcopy(scenario)

    def act(self,action):
        if action.get('k')!='defer':
            if any(action.get(k) is not None for k in ('decision_version','reason')):return False
            return super().act(action)
        a=copy.deepcopy(action);a.setdefault('order',self.next_order)
        if set(a)!={'tick','order','k','track','decision_version','reason'}:return False
        if a['decision_version']!=DECISION_VERSION or a['reason'] not in REASONS:return False
        if type(a['tick']) is not int or type(a['order']) is not int or a['tick']!=self.tick or a['order']!=self.next_order:return False
        if self.paused or self.tick>=self.scenario['duration']*30 or self.acquisition.snapshot()['ended']:return False
        t=next((t for t in self.tracks if t['id']==a['track']),None)
        if not t or not t['active'] or t['detected'] is None:return False
        # Same-tick duplicate clicks are not a second declaration, even if they
        # arrive with a different transport ID or a new external order.
        if any(e['k']=='defer' and e['track']==a['track'] and e['tick']==self.tick for e in self.events):return False
        self.events.append(a);self.next_order+=1
        return True

def replay(scenario, events, end_tick, commands=None, observer=None, acquisition_end_tick=None):
    sim = Simulation(scenario)
    timeline = [(e['tick'], e.get('order', i), 'action', e) for i, e in enumerate(events)]
    timeline += [(c['tick'], c['order'], 'command', c) for c in commands or []]
    if any(events[i]['tick'] > events[i+1]['tick'] for i in range(len(events)-1)):
        raise ValueError('Events must be ordered')
    if len({t[1] for t in timeline}) != len(timeline):
        raise ValueError('Acquisition external orders must be unique')
    timeline.sort(key=lambda e: (e[0], e[1]))
    if observer:
        observer(sim, 'initial', None, None)
    i = 0
    while sim.tick <= end_tick:
        while i < len(timeline) and timeline[i][0] == sim.tick:
            _, order, kind, event = timeline[i]
            if observer and kind == 'action':
                observer(sim, 'before_action', event, order)
            if not (sim.control(event) if kind == 'command' else sim.act(event)):
                raise ValueError(f'Invalid {kind} at tick {sim.tick}')
            if observer:
                observer(sim, kind, event, order)
            i += 1
        if acquisition_end_tick is not None and sim.tick == acquisition_end_tick:
            sim.end_acquisition()
        if sim.tick == end_tick:
            break
        sim.step(force=True)
        if observer:
            observer(sim, 'step', None, None)
    if i != len(timeline):
        raise ValueError('Events must be inside the observed horizon')
    return sim


def score(sim):
    result=base.score(sim)
    result['engine_version']=ENGINE_VERSION
    return result
