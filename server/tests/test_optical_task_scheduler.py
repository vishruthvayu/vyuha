"""Focused isolated scheduler checks; not production-engine acceptance."""
import copy
import json
from pathlib import Path

import pytest
from server.optical_task_scheduler import OpticalTaskScheduler

FIXTURE = Path(__file__).resolve().parents[2] / 'client/src/fixtures/optical-task-scheduler/cases.json'


def transcript(case):
    calls = []
    def sample(track, channel, tick):
        calls.append(dict(trackId=track, channel=channel, tick=tick))
        return case.get('readings', {}).get(f'{channel}:{tick}', dict(available=True, level='none'))
    scheduler = OpticalTaskScheduler(case['policy'], sample)
    replies = []
    for step in case['steps']:
        if step['kind'] == 'request':
            replies.append(scheduler.request(step['tick'], step['request'], step['observed']))
        elif step['kind'] == 'end':
            scheduler.end(step['tick'])
        elif step['kind'] == 'available':
            replies.append(scheduler.available_results(step['tick']))
        else:
            scheduler.advance(step['tick'])
    return dict(replies=replies, state=scheduler.snapshot(), calls=calls)


@pytest.mark.parametrize('case', json.loads(FIXTURE.read_text())['cases'], ids=lambda c: c['id'])
def test_shared_transcript(case):
    assert transcript(case) == case['expected']


def test_invalid_policy_requests_and_oracle_are_atomic():
    policy = json.loads(FIXTURE.read_text())['cases'][0]['policy']
    for field, value in [('version', 'future'), ('dwellTicks', 0), ('cadenceTicks', True), ('maxRequests', 129), ('expiryTicks', -1)]:
        bad = dict(policy, **{field: value})
        with pytest.raises(ValueError):
            OpticalTaskScheduler(bad, lambda *_: {})
    scheduler = OpticalTaskScheduler(policy, lambda *_: dict(available=False, level='identify'))
    before = scheduler.snapshot()
    for bad_tick in (None, '0', True, float('inf')):
        with pytest.raises(ValueError):
            scheduler.request(bad_tick, dict(id='a', trackId='T1', channel='eo'), [dict(trackId='T1', reportTick=0)])
        assert scheduler.snapshot() == before
    for request, observed in [
        (dict(id='a', trackId='T1', channel='rf'), []),
        (dict(id='a', trackId='T1', channel='eo', truth=True), []),
        (dict(id='a', trackId='T1', channel='eo'), [dict(trackId='T1', reportTick=99)]),
    ]:
        with pytest.raises(ValueError):
            scheduler.request(0, request, observed)
        assert scheduler.snapshot() == before
    scheduler.request(0, dict(id='a', trackId='T1', channel='eo'), [dict(trackId='T1', reportTick=0)])
    before = scheduler.snapshot()
    with pytest.raises(ValueError):
        scheduler.advance(30)
    assert scheduler.snapshot() == before


def test_policy_and_returned_ownership_and_monotonic_clock():
    policy = json.loads(FIXTURE.read_text())['cases'][0]['policy']
    scheduler = OpticalTaskScheduler(policy, lambda *_: dict(available=True, level='detect'))
    original = copy.deepcopy(policy)
    policy['dwellTicks'] = 100
    assert scheduler.policy == original
    answer = scheduler.request(0, dict(id='a', trackId='T1', channel='eo'), [dict(trackId='T1', reportTick=0)])
    answer['query']['trackId'] = 'T2'
    snapshot = scheduler.snapshot()
    snapshot['pending']['trackId'] = 'T3'
    assert scheduler.snapshot()['pending']['trackId'] == 'T1'
    scheduler.advance(20)
    for bad_tick in (19, -1, 1.5, True):
        with pytest.raises(ValueError):
            scheduler.advance(bad_tick)
