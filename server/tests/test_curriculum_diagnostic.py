import copy
import hashlib
import pytest
from server import curriculum_diagnostic as module, learning, storage
from server.tests.test_api import client

ROUTE = '/api/v1/evaluations/policy-diagnostics/coverage'


def test_reproducible_bounded_receipt_and_unchanged_inputs(monkeypatch):
    data, digest = learning.catalog()
    state = module.cases(data)
    before = copy.deepcopy((data, state))
    monkeypatch.setattr(module, 'cases', lambda _: state)
    monkeypatch.setattr(learning, 'catalog', lambda: (data, digest))
    report = module.compare(seed=4294967295, trials=32)
    assert report == module.compare(seed=4294967295, trials=32)
    assert (data, state) == before
    digest = report.pop('receipt_sha256')
    assert hashlib.sha256(storage.dumps(report).encode()).hexdigest() == digest
    assert len(report['cases']) == 6
    for case in report['cases']:
        for row in case['policies']:
            assert sum(row['competency_counts'].values()) == row['selections'] == 32
            assert len(row['selected_items']) == 32
            assert set(row['selected_items']) <= {i['id'] for i in report['practice_pool']}
    assert all(i['assistance'] != 'none' for i in report['practice_pool'])
    assert 'learning gains' in ' '.join(report['limitations'])


def test_coverage_error_unassessable_and_repeat_tradeoffs_are_visible():
    report = module.compare()
    cases = {c['case']: c for c in report['cases']}
    for name, target in [('one-underexposed-competency', 'C05'), ('errors-at-equal-exposure', 'C03'), ('unassessable-is-not-success', 'C02')]:
        assert cases[name]['policies'][0]['competency_counts'][target] == 64
    conflict = cases['recent-exclusion-vs-coverage']['policies'][0]
    assert conflict['least_assessed_selections'] == 0
    assert conflict['last_two_repeat_selections'] == 0
    assert all(v > 0 for v in cases['cold-start']['policies'][0]['competency_counts'].values())
    assert module.compare(seed=8)['receipt_sha256'] != report['receipt_sha256']


@pytest.mark.parametrize('kwargs', [{'seed': -1}, {'seed': 4294967296}, {'seed': True}, {'trials': 0}, {'trials': 129}, {'trials': True}])
def test_contract_bounds(kwargs):
    with pytest.raises(ValueError):
        module.compare(**kwargs)


def test_officer_only_read_only_route_has_no_storage_or_engine_side_effects(client, monkeypatch):
    def forbidden(*args, **kwargs):
        raise AssertionError('Diagnostic must not create training evidence')
    monkeypatch.setattr(storage, 'connect', forbidden)
    monkeypatch.setattr(learning, 'compile_item', forbidden)
    response = client.get(ROUTE)
    assert response.status_code == 200, response.text
    assert response.json() == module.compare()
    assert client.get(ROUTE, params={'trials': 129}).status_code == 422
    client.headers.clear()
    monkeypatch.setattr(module, 'compare', forbidden)
    assert client.get(ROUTE).status_code == 401
    client.headers['Authorization'] = 'Bearer wrong'
    assert client.get(ROUTE).status_code == 401
