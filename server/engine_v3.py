"""Opt-in v0.5 acquisition engine; v0.4 source remains frozen.

Scheduled releases precede external events, all sharing one integer order. Only
already radar-reported aliases can be queried. Pointing never improves sampling.
"""
import copy
from . import engine_v2 as base
from .optical_task_scheduler import OpticalTaskScheduler
from .sensors_v2 import configuration

ENGINE_VERSION = 'vyuha-0.5.0'
DEFAULT_POLICY = dict(version='optical-task-policy-v1', dwellTicks=30, cadenceTicks=3,
                      latencyTicks=6, cooldownTicks=6, expiryTicks=90,
                      maxReportAgeTicks=90, maxRequests=64)


def validate_policy(scenario):
    if type(scenario.get('duration')) is not int or not 60<=scenario['duration']<=180 or type(scenario.get('tracks')) is not list or not 1<=len(scenario['tracks'])<=20:
        raise ValueError('Acquisition practice supports 1–20 contacts and 60–180 seconds')
    policy = scenario.get('acquisition_policy')
    OpticalTaskScheduler(policy, lambda *_: None)
    if policy['cadenceTicks'] != configuration(scenario.get('sensor_config'))['optical_sample_ticks']:
        raise ValueError('Acquisition cadence must match the frozen optical sensor cadence')
    if scenario.get('version') != 2 or scenario.get('engine_version') != ENGINE_VERSION:
        raise ValueError('Unsupported acquisition engine/schema')
    return policy


class Simulation(base.Simulation):
    def __init__(self, scenario):
        self.next_order = 0
        self._mapped = {}
        self._raw = {}
        self._sample_payloads = {}
        self._radar_prefix = {}
        self.acquisition = OpticalTaskScheduler(validate_policy(scenario), self._sample_optical)
        super().__init__(scenario)

    def _sample_optical(self, track_id, channel, tick):
        if tick != self.tick:
            raise ValueError('Acquisition must sample the world at its exact logical cadence tick')
        pending = self.acquisition.snapshot()['pending']
        track = next((t for t in self.tracks if t['id'] == track_id), None)
        value = copy.deepcopy(self._raw[track_id][channel])
        if not track or not track['active']:
            value.update(level='none', position=None, silhouette=None, sample_tick=None)
        self._sample_payloads[pending['resultId']] = value
        return dict(available=value['available'], level=value['level'])

    def _sync_order(self, accepted_order=None):
        for event in self.acquisition.snapshot()['events']:
            local = event['order']
            if local in self._mapped:
                continue
            if event['kind'] == 'accepted':
                if accepted_order is None:
                    raise ValueError('Acquisition acceptance requires an external action order')
                self._mapped[local] = accepted_order
            else:
                self._mapped[local] = self.next_order
                self.next_order += 1

    def acquisition_snapshot(self):
        result = self.acquisition.snapshot()
        result['requests'] = [copy.deepcopy(q) for q in result['requests']]
        result['results'] = [copy.deepcopy(q) for q in result['results']]
        result['pending'] = copy.deepcopy(result['pending'])
        for query in result['requests'] + result['results'] + ([result['pending']] if result['pending'] else []):
            query['acceptedOrder'] = self._mapped[query['acceptedOrder']]
            if 'releasedOrder' in query:
                query['releasedOrder'] = self._mapped[query['releasedOrder']]
        for event in result['events']:
            event['order'] = self._mapped[event['order']]
        result['samples'] = [dict(resultId=r['resultId'], observation=copy.deepcopy(self._sample_payloads[r['resultId']])) for r in result['results']]
        result['ordering'] = 'scheduled-before-external-v1'
        result['next_order'] = self.next_order
        return result

    def observe(self):
        previous = {t['id']: t['detected'] for t in self.tracks}
        super().observe()
        # v0.4 replaces each complete observation on every observe(). Retain its
        # channel values behind a separate top-level mapping, then replace the
        # public optical channels below. Only an actual sample needs a deep copy;
        # copying every nested report at 30 Hz adds no evidence isolation.
        self._raw = {t['id']: dict(t['observation']) for t in self.tracks}
        for t in self.tracks:
            radar = t['observation']['radar']
            if radar['position'] is not None and radar['sample_tick'] is not None and radar['state'] in ('tentative', 'confirmed'):
                self._radar_prefix[t['id']] = radar['sample_tick']
        if not self.acquisition.snapshot()["ended"]:
            self.acquisition.advance(self.tick)
        self._sync_order()
        released = [r for r in self.acquisition.snapshot()["results"] if r["releaseTick"] <= self.tick < r["expiryTick"]]
        for t in self.tracks:
            t['detected'] = previous.get(t['id'])
            for channel in ('eo', 'ir'):
                source = self._raw[t['id']][channel]
                masked = dict(available=source['available'], level='none', position=None, silhouette=None, sample_tick=None)
                match = next((r for r in reversed(released) if r['trackId'] == t['id'] and r['channel'] == channel), None)
                if match:
                    masked = copy.deepcopy(self._sample_payloads[match['resultId']])
                t['observation'][channel] = masked
            t['thermal'] = any(t['observation'][c]['level'] != 'none' for c in ('eo', 'ir'))
            if t['detected'] is None and (t['radar'] or t['thermal']):
                t['detected'] = self.tick

    def act(self, action):
        a = copy.deepcopy(action)
        if any(a.get(k) is not None for k in ('decision_version','reason')):
            return False
        order = a.get('order', self.next_order)
        if type(order) is not int or order != self.next_order:
            return False
        a['order'] = order
        if a['k'] != 'inspect':
            if any(a.get(k) is not None for k in ('channel', 'request_id')):
                return False
            accepted = super().act(a)
            if accepted:
                self.next_order += 1
            return accepted
        if self.paused or a['tick'] != self.tick or self.tick >= self.scenario['duration'] * 30:
            return False
        if set(a) != {'tick', 'order', 'k', 'track', 'channel', 'request_id'}:
            return False
        try:
            response = self.acquisition.request(self.tick, dict(id=a['request_id'], trackId=a['track'], channel=a['channel']),
                                                [dict(trackId=k, reportTick=v) for k, v in self._radar_prefix.items()])
        except ValueError:
            return False
        if response['status'] != 'accepted':
            return False
        self._sync_order(order)
        self.next_order += 1
        self.events.append(a)
        return True

    def control(self, command):
        order = command.get('order')
        if type(order) is not int or order != self.next_order:
            return False
        accepted = super().control(command)
        if accepted:
            self.next_order += 1
        return accepted

    def end_acquisition(self):
        self.acquisition.end(self.tick)
        self._sync_order()


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
    result = base.score(sim)
    result['engine_version'] = ENGINE_VERSION
    return result
