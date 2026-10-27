"""Targeted opportunity rehearsal tests; no old scorecards or engine changes."""
import copy
import hashlib
import json
import time

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from server import auth, storage
from server.engine import HZ, Simulation
from server.episode_opportunities import (
    CHANNELS, MAX_CONTACTS, MAX_TRACK_TICKS, CapacityError,
    OpportunityRequest, _SLOT, _reading, rehearse_opportunities, router,
)
from server.raid_v2 import compose_raid, raid_id


def raid():
    return compose_raid(dict(seed=91, duration=60, family='DIRECT', difficulty='foundational',
                             mix=['hostile_quad', 'friendly_uav'], night=False))


def invoke(spec, **options):
    return rehearse_opportunities(spec, spec['id'], spec['raid']['fingerprint'], **options)


def materialize(result, contact, channel):
    values = []
    for interval in contact['channels'][channel]['intervals']:
        assert interval['first_tick'] == len(values)
        assert interval['end_tick_exclusive'] > interval['first_tick']
        assert interval['end_tick_exclusive'] <= result['horizon']['end_tick_exclusive']
        values.extend([(interval['state'], interval['available'])] *
                      (interval['end_tick_exclusive'] - interval['first_tick']))
    assert len(values) == result['horizon']['end_tick_exclusive']
    return values


def test_exact_tick_intervals_equal_unchanged_engine_and_do_not_modify_source():
    spec = raid()
    before = copy.deepcopy(spec)
    result = invoke(spec)
    assert spec == before
    assert result['version'] == 'episode-opportunities-v1'
    assert result['scenario_hash'] == hashlib.sha256(json.dumps(spec, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()).hexdigest()
    assert result['horizon'] == dict(first_tick=0, end_tick_exclusive=60*HZ, hz=HZ)
    assert result['actions_applied'] == result['commands_applied'] == 0
    actual = {(row['track_id'], channel): materialize(result, row, channel)
              for row in result['contacts'] for channel in CHANNELS}
    sim = Simulation(spec)
    active = {row['track_id']: 0 for row in result['contacts']}
    sample_clocks = {key: [] for key in actual}
    for tick in range(60*HZ):
        for track in sim.tracks:
            active[track['id']] += int(track['active'])
            for channel in CHANNELS:
                state, available, sample = _reading(track['active'], channel, track['observation'])
                assert actual[(track['id'], channel)][tick] == (state, available)
                assert sample is None or 0 <= sample <= tick
                sample_clocks[(track['id'], channel)].append(sample)
        if tick + 1 < 60*HZ:
            sim.step(force=True)
    assert {row['track_id']: row['active_ticks'] for row in result['contacts']} == active
    assert not sim.events and not sim.commands
    for row in result['contacts']:
        for name, channel in row['channels'].items():
            for interval in channel['intervals']:
                known = [v for v in sample_clocks[(row['track_id'], name)][interval['first_tick']:interval['end_tick_exclusive']] if v is not None]
                assert interval['first_sample_tick'] == (known[0] if known else None)
                assert interval['last_sample_tick'] == (known[-1] if known else None)
            assert sum(channel['state_ticks'].values()) == 60*HZ
            if name in ('rf', 'iff'):
                assert all(v['first_sample_tick'] is None and v['last_sample_tick'] is None
                           for v in channel['intervals'])
    assert 'identity' not in json.dumps(result) and 'kind' not in json.dumps(result)
    assert 'not actual notice' in result['limitation']


def test_night_unavailability_and_report_gaps_are_not_flattened_into_opportunity():
    spec = raid()
    spec['night'] = True
    spec['radarFailureStart'], spec['radarFailureEnd'] = 150, 210
    spec['rfFailureStart'], spec['rfFailureEnd'] = 240, 300
    spec['id'] = raid_id(spec)
    result = invoke(spec)
    first = result['contacts'][0]
    radar = materialize(result, first, 'radar')
    assert all(radar[t] == ('unavailable', False) for t in range(150, 210))
    assert radar[210][1] is True
    eo = materialize(result, first, 'eo')
    assert all(not available for _, available in eo)
    iff = materialize(result, first, 'iff')
    assert all(iff[t] == ('unavailable', False) for t in range(240, 300))
    assert iff[300][1] is True
    for name in CHANNELS:
        assert materialize(result, first, name)[0][0] == 'inactive'
    assert any(row['channels']['iff']['state_ticks'].get('friendly_reply', 0) > 0 for row in result['contacts'])


def test_unchanged_engine_repeated_inputs_are_deterministic():
    spec = raid()
    assert invoke(spec) == invoke(copy.deepcopy(spec))


@pytest.mark.parametrize('mutation', [
    lambda s: s.update(engine_version='vyuha-0.5.0'),
    lambda s: s.update(engine_version=None),
    lambda s: s.update(version=1),
    lambda s: s.update(duration=True),
    lambda s: s.update(raid='corrupt'),
    lambda s: s['tracks'][0].update(speed=float('nan')),
    lambda s: s['tracks'][0].update(kind='loitering'),
    lambda s: s.update(hidden_result={'correct': True}),
])
def test_unknown_malformed_or_tampered_raid_is_rejected_before_reconstruction(mutation):
    spec = raid()
    sid, fingerprint = spec['id'], spec['raid']['fingerprint']
    mutation(spec)
    with pytest.raises((ValueError, TypeError)):
        rehearse_opportunities(spec, sid, fingerprint)


def test_wrong_reference_and_hard_work_limits_fail_closed(monkeypatch):
    spec = raid()
    with pytest.raises(ValueError, match='selected frozen'):
        rehearse_opportunities(spec, 'raid_'+'a'*24, spec['raid']['fingerprint'])
    with pytest.raises(ValueError, match='selected frozen'):
        rehearse_opportunities(spec, spec['id'], 'b'*24)
    excessive = copy.deepcopy(spec)
    excessive['tracks'] = excessive['tracks'] * (MAX_CONTACTS+1)
    monkeypatch.setattr('server.episode_opportunities.Simulation', lambda _: pytest.fail('Over-limit request reached engine'))
    with pytest.raises(CapacityError):
        invoke(excessive)
    geometry = copy.deepcopy(spec)
    geometry['terrain_boxes'] = geometry['terrain_boxes'] * 17
    with pytest.raises(CapacityError, match='static-geometry'):
        invoke(geometry)
    excessive = copy.deepcopy(spec)
    excessive['duration'] = 180
    excessive['tracks'] = excessive['tracks'] * 10
    assert len(excessive['tracks']) * 180 * HZ > MAX_TRACK_TICKS
    with pytest.raises(CapacityError):
        invoke(excessive)


def test_service_timeout_and_segment_limits_return_no_partial_result(monkeypatch):
    spec = raid()
    with pytest.raises(TimeoutError):
        invoke(spec, maximum_seconds=-1)
    monkeypatch.setattr('server.episode_opportunities.MAX_SEGMENTS', 1)
    with pytest.raises(CapacityError, match='exact intervals'):
        invoke(spec)


@pytest.fixture
def protected_client(tmp_path, monkeypatch):
    monkeypatch.setattr(storage, 'DB_PATH', tmp_path/'author.db')
    monkeypatch.setenv('VYUHA_AUTH_FILE', str(tmp_path/'officer.json'))
    with auth._LOCK:
        auth._SESSIONS.clear()
        auth._ATTEMPTS.clear()
    password = 'local-test-only-author-credential'
    auth.provision(password)
    application = FastAPI()
    application.include_router(router)
    auth.install(application)
    storage.init()
    with TestClient(application) as client:
        yield client, password


def body(spec):
    return dict(version='episode-opportunities-request-v1', scenario=spec,
                expected_scenario_id=spec['id'], expected_fingerprint=spec['raid']['fingerprint'])


def test_real_protected_api_denies_trainee_and_returns_original_engine_report_without_db_writes(protected_client):
    client, password = protected_client
    spec = raid()
    payload = body(spec)
    with storage.connect() as db:
        before = list(db.iterdump())
    assert client.post('/api/v1/raids/opportunities', json=payload).status_code == 401
    assert client.post('/api/v1/raids/opportunities', json=payload, headers={'Authorization': 'Bearer forged'}).status_code == 401
    token = client.post('/api/v1/auth/login', json={'password': password}).json()['token']
    client.headers['Authorization'] = 'Bearer '+token
    response = client.post('/api/v1/raids/opportunities', json=payload)
    assert response.status_code == 200, response.text
    assert response.json() == invoke(spec)
    with storage.connect() as db:
        assert list(db.iterdump()) == before
    assert client.post('/api/v1/raids/opportunities', json={**payload, 'client_results': []}).status_code == 422
    assert client.post('/api/v1/raids/opportunities', json={**payload, 'expected_fingerprint': 'b'*24}).status_code == 422
    assert client.post('/api/v1/raids/opportunities', json={**payload, 'version': 'future'}).status_code == 422
    unknown = copy.deepcopy(spec);unknown['engine_version'] = 'vyuha-0.5.0'
    assert client.post('/api/v1/raids/opportunities', json={**payload, 'scenario': unknown}).status_code == 422
    malformed = copy.deepcopy(spec);malformed['raid'] = 'corrupt'
    assert client.post('/api/v1/raids/opportunities', json={**payload, 'scenario': malformed}).status_code == 422
    with auth._LOCK:
        auth._SESSIONS.clear()
    assert client.post('/api/v1/raids/opportunities', json=payload).status_code == 401


def test_api_bounded_concurrency_and_timeout_never_publish_partial_result(protected_client, monkeypatch):
    client, password = protected_client
    client.headers['Authorization'] = 'Bearer '+client.post('/api/v1/auth/login', json={'password': password}).json()['token']
    payload = body(raid())
    assert _SLOT.acquire(blocking=False)
    try:
        response = client.post('/api/v1/raids/opportunities', json=payload)
        assert response.status_code == 429 and response.headers['retry-after'] == '2'
    finally:
        _SLOT.release()
    monkeypatch.setattr('server.episode_opportunities.MAX_SECONDS', -1)
    response = client.post('/api/v1/raids/opportunities', json=payload)
    assert response.status_code == 503 and response.headers['retry-after'] == '2'
    assert set(response.json()) == {'detail'}
    assert _SLOT.acquire(blocking=False)
    _SLOT.release()


from server.tests.test_api import client as integrated_client


def test_main_router_exposes_opportunities_with_existing_officer_boundary(integrated_client):
    payload = body(raid())
    denied = integrated_client.post('/api/v1/raids/opportunities', json=payload, headers={'Authorization': ''})
    assert denied.status_code == 401
    result = integrated_client.post('/api/v1/raids/opportunities', json=payload)
    assert result.status_code == 200, result.text
    assert result.json()['scenario_id'] == payload['expected_scenario_id']
    assert result.json()['actions_applied'] == result.json()['commands_applied'] == 0
    assert 'score' not in result.json()
