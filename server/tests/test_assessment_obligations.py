"""Synthetic software opportunity checks, never a human/physical validation."""
import copy
import pytest
from server import assessment_obligations as module
from server.assessment_obligations import ObservationObligation, evaluate_observations, frozen_pilot, passive_observations, pilot_report
from server.tests.test_api import client

ROUTE = '/api/v1/evaluations/assessment-diagnostics/c01'


def observed(tick, *, sample=None, cue='no_reply', signal=True, track='OBS-1'):
    return dict(tick=tick, track_id=track,
                radar=dict(available=True, detected=signal, position=dict(x=1, z=2, altitude=3) if signal else None, sample_tick=tick if sample is None else sample),
                iff=dict(cue=cue))


def test_real_frozen_assessment_is_read_only_and_reproducible():
    scenario, _ = frozen_pilot()
    before = copy.deepcopy(scenario)
    result = evaluate_observations(passive_observations(scenario))
    assert scenario == before
    assert result['status'] == 'SATISFIED'
    assert result['observed_frames'] == 4*1800
    assert result == evaluate_observations(passive_observations(scenario))
    assert 'scorecard' not in result and 'kind' not in str(result) and 'proficiency' in result['limitation']


def test_pilot_binds_frozen_catalog_and_scenario_identity():
    result = pilot_report()
    assert result['item_id'] == 'C01_BASELINE-A_A'
    assert result['catalog_hash'] == module.PILOT_CATALOG
    assert len(result['scenario_sha256']) == 64
    assert result['engine_version'] == 'vyuha-0.4.0'


@pytest.mark.parametrize('mutation', ['remove_channels', 'delay_delivery', 'short_window'])
def test_negative_mutations_of_real_engine_observations(mutation):
    scenario, _ = frozen_pilot()
    rows = list(passive_observations(scenario))
    if mutation == 'remove_channels':
        for row in rows:
            for channel in ('radar', 'eo', 'ir'):
                row[channel]['available'] = False
    elif mutation == 'delay_delivery':
        # Sample times remain unchanged: later delivery cannot make old evidence fresh.
        for row in rows:
            row['tick'] += 31
    else:
        rows = [row for row in rows if row['tick'] < 14]
    assert evaluate_observations(rows)['status'] == 'UNSATISFIED'


def test_catalog_change_fails_closed(monkeypatch):
    from server import learning
    original = learning.catalog
    monkeypatch.setattr(learning, 'catalog', lambda: (original()[0], '0'*64))
    with pytest.raises(ValueError, match='Frozen pilot catalog changed'):
        frozen_pilot()


def test_removed_all_observation_channels_is_unsatisfied():
    rows = [observed(tick, signal=False) for tick in range(30)]
    assert evaluate_observations(rows)['reason'] == 'NO_TIME_VALID_WINDOW'


def test_short_and_missing_tick_windows_cannot_be_padded():
    assert evaluate_observations(observed(t) for t in range(14))['status'] == 'UNSATISFIED'
    rows = [observed(t) for t in list(range(7))+list(range(8, 15))]
    assert evaluate_observations(rows)['status'] == 'UNSATISFIED'
    assert max(r['ticks'] for r in evaluate_observations(rows)['longest_windows']) == 7


def test_delayed_stale_samples_and_outside_deadline_are_not_windows():
    delayed = [observed(t+31, sample=t) for t in range(30)]
    report = evaluate_observations(delayed)
    assert report['status'] == 'UNSATISFIED' and report['stale_channel_samples'] == 30
    assert evaluate_observations([observed(t) for t in range(20, 40)], ObservationObligation(end_tick=19))['status'] == 'UNSATISFIED'


def test_identity_ambiguity_is_allowed_and_extra_truth_is_not_a_feature():
    rows = [observed(t) for t in range(15)]
    original = evaluate_observations(rows)
    assert original['status'] == 'SATISFIED' and original['visible_ambiguous_identity_frames'] == 15
    for row in rows:
        row.update(kind='arbitrary-secret', identity='hidden-affiliation', hidden_position=dict(x=9000))
    assert evaluate_observations(rows) == original


def test_alternating_tracks_cannot_pool_a_contiguous_window():
    rows = [observed(t, track='A' if t % 2 else 'B') for t in range(30)]
    assert evaluate_observations(rows)['status'] == 'UNSATISFIED'


def test_duplicate_out_of_order_and_future_samples_fail_closed():
    with pytest.raises(ValueError, match='Duplicate'):
        evaluate_observations([observed(0), observed(0)])
    with pytest.raises(ValueError, match='ordered'):
        evaluate_observations([observed(2), observed(1)])
    with pytest.raises(ValueError, match='future'):
        evaluate_observations([observed(0, sample=1)])


@pytest.mark.parametrize('change', ['unavailable', 'tentative', 'no_position', 'no_sample'])
def test_non_detectable_radar_cannot_manufacture_opportunity(change):
    rows = [observed(t) for t in range(20)]
    for row in rows:
        key, value = {'unavailable': ('available', False), 'tentative': ('detected', False),
                      'no_position': ('position', None), 'no_sample': ('sample_tick', None)}[change]
        row['radar'][key] = value
    assert evaluate_observations(rows)['status'] == 'UNSATISFIED'


def test_optical_observations_can_supply_detection_without_radar():
    rows = [dict(tick=t, track_id='OPT', eo=dict(available=True, level='detect', position=dict(x=0, z=10, altitude=2), sample_tick=t)) for t in range(15)]
    assert evaluate_observations(rows)['status'] == 'SATISFIED'


def test_bounds_and_unsupported_competencies_are_explicit(monkeypatch):
    with pytest.raises(ValueError, match='C01 only'):
        ObservationObligation(competency_id='C02')
    with pytest.raises(ValueError):
        ObservationObligation(start_tick=True)
    with pytest.raises(ValueError):
        evaluate_observations([observed(0, sample=-1)])
    with pytest.raises(ValueError, match='object'):
        evaluate_observations([None])
    with pytest.raises(ValueError, match='object'):
        evaluate_observations([{**observed(0), 'iff': None}])
    monkeypatch.setattr(module, 'MAX_FRAMES', 1)
    with pytest.raises(ValueError, match='limit'):
        evaluate_observations([observed(0), observed(1)])


def test_officer_route_reconstructs_without_database_writes(client):
    from server import storage
    with storage.connect() as db:
        before = list(db.iterdump())
    result = client.get(ROUTE+'?seed=7')
    assert result.status_code == 200, result.text
    assert result.json()['observed_frames'] == 7200
    assert result.json()['item_id'] == module.PILOT_ITEM
    with storage.connect() as db:
        assert list(db.iterdump()) == before


def test_route_rejects_missing_invalid_and_non_ascii_auth_before_computation(client, monkeypatch):
    def forbidden(*args):
        pytest.fail('Unauthorized requests must not execute the simulation')
    monkeypatch.setattr(module, 'pilot_report', forbidden)
    client.headers.pop('Authorization')
    assert client.get(ROUTE).status_code == 401
    assert client.get(ROUTE, headers={'Authorization': 'Bearer invalid'}).status_code == 401
    # Raw ASGI bytes test the non-ASCII header path without httpx ASCII encoding.
    assert client.get(ROUTE, headers=[(b'Authorization', b'Bearer \xff')]).status_code == 401


@pytest.mark.parametrize('seed', ['-1', '4294967296', '1.5', 'true', 'NaN', ''])
def test_route_seed_validation_precedes_computation(client, monkeypatch, seed):
    def forbidden(*args):
        pytest.fail('Malformed seed must not execute the simulation')
    monkeypatch.setattr(module, 'pilot_report', forbidden)
    assert client.get(ROUTE+'?seed='+seed).status_code == 422


def test_route_accepts_seed_bounds_and_returns_clear_frozen_catalog_conflict(client, monkeypatch):
    received = []
    monkeypatch.setattr(module, 'pilot_report', lambda seed: received.append(seed) or {'seed': seed})
    for seed in (0, 4294967295):
        assert client.get(ROUTE+'?seed='+str(seed)).json() == {'seed': seed}
    assert received == [0, 4294967295]
    def changed(*args):
        raise ValueError('Frozen pilot catalog changed')
    monkeypatch.setattr(module, 'pilot_report', changed)
    result = client.get(ROUTE)
    assert result.status_code == 409 and 'catalog changed' in result.json()['detail']
