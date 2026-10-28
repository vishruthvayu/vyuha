"""Isolated optical scheduler foundation, NOT a registered production engine.

An eventual engine adapter must supply trusted observed prefixes, deterministic
sample-time world reconstruction and merge local receipts into global order.
No sensor model, score, database, session admission or network route is changed.
"""
import copy
import re


def _integer(v, lo=0, hi=1000000):
    return type(v) is int and lo <= v <= hi


def _identifier(v):
    return type(v) is str and re.fullmatch(r'[A-Za-z0-9_-]{1,80}', v) is not None


class OpticalTaskScheduler:
    def __init__(self, policy, sample):
        fields = {'version', 'dwellTicks', 'cadenceTicks', 'latencyTicks', 'cooldownTicks', 'expiryTicks', 'maxReportAgeTicks', 'maxRequests'}
        bounds = {'dwellTicks': (1, 9000), 'cadenceTicks': (1, 900), 'latencyTicks': (0, 9000), 'cooldownTicks': (0, 9000), 'expiryTicks': (1, 9000), 'maxReportAgeTicks': (0, 9000), 'maxRequests': (1, 128)}
        if type(policy) is not dict or set(policy) != fields or policy['version'] != 'optical-task-policy-v1' or any(not _integer(policy[k], *b) for k, b in bounds.items()):
            raise ValueError('Invalid optical scheduling policy')
        self._policy = copy.deepcopy(policy)
        self._sample = sample
        self._state = dict(version='optical-task-scheduler-v1', tick=0, ended=False, pending=None, requests=[], results=[], events=[], cooldownUntil=0)
        self._order = 0
        self._sampled = None

    @property
    def policy(self):
        return copy.deepcopy(self._policy)

    def snapshot(self):
        return copy.deepcopy(self._state)

    def advance(self, tick):
        s, p = self._state, self._policy
        if not _integer(tick) or tick < s['tick'] or (s['ended'] and tick != s['tick']):
            raise ValueError('Invalid logical scheduler advance')
        q, reading = s['pending'], self._sampled
        if q and reading is None and q['sampleTick'] <= tick:
            r = self._sample(q['trackId'], q['channel'], q['sampleTick'])
            if type(r) is not dict or set(r) != {'available', 'level'} or type(r['available']) is not bool or r['level'] not in ('none', 'detect', 'recognise', 'identify') or (not r['available'] and r['level'] != 'none'):
                raise ValueError('Invalid sanitized optical reading')
            reading = copy.deepcopy(r)
        self._sampled = reading
        if q and q['releaseTick'] <= tick and reading is not None:
            self._order += 1
            s['results'].append(dict(q, releasedOrder=self._order, expiryTick=q['releaseTick'] + p['expiryTicks'], reading=reading))
            s['events'].append(dict(tick=q['releaseTick'], order=self._order, kind='released', requestId=q['id']))
            s['cooldownUntil'] = q['releaseTick'] + p['cooldownTicks']
            s['pending'] = None
            self._sampled = None
        s['tick'] = tick

    def request(self, tick, request, observed):
        if not _integer(tick):
            raise ValueError('Invalid logical scheduler advance')
        if type(request) is not dict or set(request) != {'id', 'trackId', 'channel'} or not _identifier(request['id']) or not _identifier(request['trackId']) or request['channel'] not in ('eo', 'ir'):
            raise ValueError('Invalid optical request')
        if type(observed) is not list or len(observed) > 200 or any(type(r) is not dict or set(r) != {'trackId', 'reportTick'} or not _identifier(r['trackId']) or not _integer(r['reportTick']) or r['reportTick'] > tick for r in observed) or len({r['trackId'] for r in observed}) != len(observed):
            raise ValueError('Invalid observed prefix')
        self.advance(tick)
        s, p = self._state, self._policy
        prior = next((q for q in s['requests'] if q['id'] == request['id']), None)
        if prior:
            return dict(status='duplicate', query=copy.deepcopy(prior)) if prior['trackId'] == request['trackId'] and prior['channel'] == request['channel'] else dict(status='rejected', reason='id-conflict')
        reason = None
        if s['ended']:
            reason = 'ended'
        elif not any(r['trackId'] == request['trackId'] and tick - r['reportTick'] <= p['maxReportAgeTicks'] for r in observed):
            reason = 'unavailable-or-stale'
        elif s['pending']:
            reason = 'busy'
        elif tick < s['cooldownUntil']:
            reason = 'cooldown'
        elif len(s['requests']) >= p['maxRequests']:
            reason = 'request-limit'
        if reason:
            return dict(status='rejected', reason=reason)
        sample_tick = ((tick + p['dwellTicks'] + p['cadenceTicks'] - 1) // p['cadenceTicks']) * p['cadenceTicks']
        if any(q['trackId'] == request['trackId'] and q['channel'] == request['channel'] and q['sampleTick'] == sample_tick for q in s['requests']):
            return dict(status='rejected', reason='sample-already-requested')
        self._order += 1
        q = dict(request, acceptedTick=tick, acceptedOrder=self._order, sampleTick=sample_tick, releaseTick=sample_tick + p['latencyTicks'], resultId='result_' + request['id'])
        s['requests'].append(q)
        s['pending'] = q
        s['events'].append(dict(tick=tick, order=self._order, kind='accepted', requestId=q['id']))
        return dict(status='accepted', query=copy.deepcopy(q))

    def end(self, tick):
        self.advance(tick)
        s = self._state
        if s['ended']:
            return
        if s['pending']:
            self._order += 1
            s['events'].append(dict(tick=tick, order=self._order, kind='cancelled', requestId=s['pending']['id'], reason='exercise-ended'))
        s['pending'] = None
        self._sampled = None
        s['ended'] = True

    def available_results(self, tick):
        self.advance(tick)
        return copy.deepcopy([r for r in self._state['results'] if r['releaseTick'] <= tick < r['expiryTick']])
