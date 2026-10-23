"""Bounded authoring diagnostics, not item calibration or trainee delivery."""
import copy

import pytest
from server import assessment_obligations as module
from server.tests.test_api import client

ROUTE = '/api/v1/evaluations/assessment-diagnostics/c01/generation'


@pytest.fixture(autouse=True)
def clear_generation_cache():
    module._cached_generation.cache_clear()
    yield
    module._cached_generation.cache_clear()


def visible_rows():
    return [dict(tick=t, track_id='OBS-1', iff=dict(cue='no_reply'),
                 radar=dict(available=True, detected=True, sample_tick=t,
                            position=dict(x=1, z=2, altitude=3))) for t in range(15)]


def test_real_generation_receipt_is_reproducible_without_cache_and_contains_no_truth():
    first = module.generation_report()
    module._cached_generation.cache_clear()
    second = module.generation_report()
    assert first['receipt'] == second['receipt']
    assert first['receipt_sha256'] == second['receipt_sha256'] == module._sha256(first['receipt'])
    receipt = first['receipt']
    assert receipt['disposition'] == 'valid-ambiguous'
    assert (receipt['attempted_count'], receipt['accepted_count'], receipt['rejected_count']) == (1, 1, 0)
    assert receipt['mode'] == 'assessment' and receipt['study_mode'] == 'not-enrolled'
    assert receipt['frozen_inputs']['content_version'] == 'learning-v1'
    assert receipt['frozen_inputs']['catalog_hash'] == module.PILOT_CATALOG
    assert 'server/sensors_v2.py' in receipt['frozen_inputs']['source_sha256']
    attempt = receipt['attempts'][0]
    assert attempt['observation_diagnostic']['observed_frames'] == 7200
    assert attempt['parameter_assignment']['requested_seed'] == 7
    assert attempt['delivery_manifest']['assistance'] == 'none'
    for forbidden in ('tracks', 'kind', 'identity', 'threat_profile', 'answer_key', 'mix'):
        assert f'"{forbidden}"' not in __import__('json').dumps(receipt)
    assert 'human-solvability' in receipt['not_evaluated']
    assert first['performance']['attempt_seconds'][0] >= 0


def test_preview_fixed_seed_never_enters_delivery_manifest(monkeypatch):
    monkeypatch.setattr(module, 'passive_observations', lambda scenario: visible_rows())
    baseline = module.generation_report(seed=7)
    preview = module.generation_report(seed=7, preview_seed=91)
    assert preview['receipt'] == baseline['receipt']
    assert preview['receipt_sha256'] == baseline['receipt_sha256']
    assert preview['preview']['parameter_assignment']['requested_seed'] == 91
    assert preview['receipt']['attempts'][0]['delivery_manifest']['seed'] == 7
    assert 'observation validity not evaluated' in preview['preview']['scope']


def test_impossible_window_stops_at_bound_without_compiler_or_engine(monkeypatch):
    def forbidden(*args):
        pytest.fail('A contradictory proposed window needs no compiler or engine work')
    monkeypatch.setattr(module, 'frozen_pilot', forbidden)
    result = module.generation_report(7, 3, module.ObservationObligation(end_tick=13))['receipt']
    assert result['disposition'] == 'generation-exhausted'
    assert result['objective_scope'] == 'unsatisfiable-under-declared-window'
    assert (result['attempted_count'], result['accepted_count'], result['rejected_count']) == (3, 0, 3)
    assert all(a['rejection_reasons'] == ['UNSATISFIABLE_OBSERVATION_WINDOW'] for a in result['attempts'])
    assert all(a['delivery_manifest'] is None for a in result['attempts'])


def test_missing_evidence_and_leaked_cue_are_separate_failures_and_not_echoed(monkeypatch):
    scenario, context = module.frozen_pilot()
    before = copy.deepcopy((scenario, context))
    monkeypatch.setattr(module, 'passive_observations', lambda scenario: [])
    missing = module._generation_candidate(scenario, context, module.ObservationObligation())
    assert missing['rejection_reasons'] == ['NO_TIME_VALID_WINDOW_PASSIVE_RUN']
    manifest = module._delivery_manifest(scenario, context)
    manifest['answer_key'] = 'deliberately secret cue'
    def forbidden(*args):
        pytest.fail('Rejected delivery copy must not execute a trace')
    monkeypatch.setattr(module, 'passive_observations', forbidden)
    leaked = module._generation_candidate(scenario, context, module.ObservationObligation(), manifest)
    assert leaked['disposition'] == 'invalid'
    assert 'LEAKED_ANSWER_CUE_FIELD' in leaked['rejection_reasons']
    assert 'NO_TIME_VALID_WINDOW_PASSIVE_RUN' not in leaked['rejection_reasons']
    assert 'deliberately secret cue' not in str(leaked)
    assert leaked['delivery_manifest'] is None and leaked['observation_diagnostic'] is None
    assert (scenario, context) == before


def test_frozen_prose_edit_is_rejected_without_claiming_semantic_cue_detection(monkeypatch):
    scenario, context = module.frozen_pilot()
    manifest = module._delivery_manifest(scenario, context)
    manifest['content']['instructions'].append('A different unsupported author instruction')
    result = module._generation_candidate(scenario, context, module.ObservationObligation(), manifest)
    assert result['rejection_reasons'] == ['FROZEN_DELIVERY_MANIFEST_MISMATCH']


def test_compiler_exhaustion_has_bounded_seed_schedule_and_no_raw_error(monkeypatch):
    seeds = []
    def reject(seed):
        seeds.append(seed)
        raise ValueError('sensitive internal error detail')
    monkeypatch.setattr(module, 'frozen_pilot', reject)
    receipt = module.generation_report(4294967295, 3)['receipt']
    assert seeds == [(4294967295 + i*0x9E3779B9) & 0xffffffff for i in range(3)]
    assert receipt['disposition'] == 'generation-exhausted'
    assert receipt['rejected_count'] == 3 and receipt['accepted_count'] == 0
    assert all(a['rejection_reasons'] == ['COMPILER_CONSTRAINT_REJECTED'] for a in receipt['attempts'])
    assert 'sensitive internal' not in str(receipt)
    assert receipt['objective_scope'] == 'passive-observation-check-only'


def test_rejected_candidate_retries_then_stops_on_first_valid_candidate(monkeypatch):
    original = module.frozen_pilot
    calls = []
    def sometimes(seed):
        calls.append(seed)
        if len(calls) == 1:
            raise ValueError('No bounded candidate')
        return original(seed)
    monkeypatch.setattr(module, 'frozen_pilot', sometimes)
    monkeypatch.setattr(module, 'passive_observations', lambda scenario: visible_rows())
    result = module.generation_report(7, 3)['receipt']
    assert len(calls) == 2
    assert (result['attempted_count'], result['accepted_count'], result['rejected_count']) == (2, 1, 1)
    assert result['disposition'] == 'valid-ambiguous'


def test_observation_contract_failure_is_distinct_from_compiler_failure(monkeypatch):
    def invalid_trace(scenario):
        return [dict(tick=0, track_id='OBS-1', radar=dict(sample_tick=1))]
    monkeypatch.setattr(module, 'passive_observations', invalid_trace)
    receipt = module.generation_report(7, 1)['receipt']
    assert receipt['disposition'] == 'generation-exhausted'
    assert receipt['attempts'][0]['rejection_reasons'] == ['OBSERVATION_CONTRACT_REJECTED']


def test_concurrent_input_drift_cannot_populate_cache(monkeypatch):
    original = module._generation_inputs
    drifted = False
    def inputs():
        snapshot = original()
        return {**snapshot, 'changed_during_run': True} if drifted else snapshot
    def trace(scenario):
        nonlocal drifted
        drifted = True
        return visible_rows()
    monkeypatch.setattr(module, '_generation_inputs', inputs)
    monkeypatch.setattr(module, 'passive_observations', trace)
    with pytest.raises(ValueError, match='changed during computation'):
        module.generation_report(7, 1)
    assert module._cached_generation.cache_info().currsize == 0


def test_cache_is_bounded_input_keyed_and_returns_defensive_copies(monkeypatch):
    calls = []
    def trace(scenario):
        calls.append(scenario['seed'])
        return visible_rows()
    monkeypatch.setattr(module, 'passive_observations', trace)
    first = module.generation_report(7)
    expected = copy.deepcopy(first)
    first['receipt']['attempts'].clear()
    assert module.generation_report(7) == expected
    assert len(calls) == 1
    module.generation_report(19)
    module.generation_report(7, 1)
    module.generation_report(7, obligation=module.ObservationObligation(minimum_contiguous_ticks=14))
    assert len(calls) == 4
    assert module._cached_generation.cache_info().maxsize == 8


def test_source_drift_fails_before_serving_cached_receipt(monkeypatch):
    monkeypatch.setattr(module, 'passive_observations', lambda scenario: visible_rows())
    module.generation_report()
    changed = {**module._source_hashes(), 'server/raid_v2.py': '0'*64}
    monkeypatch.setattr(module, '_source_hashes', lambda: changed)
    with pytest.raises(ValueError, match='changed after import'):
        module.generation_report()


def test_catalog_drift_fails_before_serving_cached_receipt(monkeypatch):
    from server import learning
    monkeypatch.setattr(module, 'passive_observations', lambda scenario: visible_rows())
    module.generation_report()
    data, _ = learning.catalog()
    monkeypatch.setattr(learning, 'catalog', lambda: (data, '0'*64))
    with pytest.raises(ValueError, match='Frozen pilot catalog changed'):
        module.generation_report()


def test_officer_generation_route_does_not_mutate_database(client):
    from server import storage
    with storage.connect() as db:
        before = list(db.iterdump())
    response = client.get(ROUTE+'?seed=7&preview_seed=91')
    assert response.status_code == 200, response.text
    assert response.json()['receipt']['disposition'] == 'valid-ambiguous'
    assert response.json()['preview']['parameter_assignment']['requested_seed'] == 91
    with storage.connect() as db:
        assert list(db.iterdump()) == before


def test_route_officer_dependency_rejects_before_computation(client, monkeypatch):
    def forbidden(*args, **kwargs):
        pytest.fail('Unauthorized requests must not generate candidates')
    monkeypatch.setattr(module, 'generation_report', forbidden)
    client.headers.pop('Authorization')
    assert client.get(ROUTE).status_code == 401
    assert client.get(ROUTE, headers={'Authorization': 'Bearer invalid'}).status_code == 401
    assert client.get(ROUTE, headers=[(b'Authorization', b'Bearer \xff')]).status_code == 401


@pytest.mark.parametrize('query', ['seed=-1', 'seed=4294967296', 'seed=1.5',
                                  'max_attempts=0', 'max_attempts=4',
                                  'preview_seed=-1', 'preview_seed=true'])
def test_route_bounds_precede_computation(client, monkeypatch, query):
    monkeypatch.setattr(module, 'generation_report', lambda *a, **kw: pytest.fail('Invalid bounds must not compute'))
    assert client.get(ROUTE+'?'+query).status_code == 422


def test_route_source_conflict_is_explicit(client, monkeypatch):
    def changed(*args, **kwargs):
        raise ValueError('Generation source/config changed after import; restart before generating a receipt')
    monkeypatch.setattr(module, 'generation_report', changed)
    response = client.get(ROUTE)
    assert response.status_code == 409 and 'restart' in response.json()['detail']


def test_small_declared_seed_report_counts_and_nearest_rank_timing(monkeypatch):
    def fake(seed, max_attempts):
        return dict(receipt=dict(accepted_count=1, rejected_count=seed % 2, disposition='valid-ambiguous'),
                    performance=dict(attempt_seconds=[float(seed+1)]))
    monkeypatch.setattr(module, 'generation_report', fake)
    report = module.generation_seed_report()
    assert report['seeds'] == [0, 7, 19]
    assert (report['accepted_count'], report['rejected_count'], report['exhausted_count']) == (3, 2, 0)
    assert report['generation_seconds']['p95'] == report['generation_seconds']['maximum'] == 20
    for invalid in ([], [0, 0], [0, 1, 2, 3], [True]):
        with pytest.raises(ValueError):
            module.generation_seed_report(invalid)
