"""Public presentation projection only; no new engine, learner or efficacy claim."""
import copy
import json

import pytest

from server import learning, storage
from server.tests.test_api import client
from server.tests.test_learning import joined, prepared
from server.tests.test_learning_catalogs import change_current, context

FIELDS = {'version', 'preparation_id', 'scenario_id', 'catalog_version',
          'catalog_hash', 'item_id', 'competency_id', 'mode', 'assistance',
          'title', 'objective', 'instructions'}


def snapshot(preparation_id):
    with storage.connect() as db:
        row = dict(db.execute('SELECT * FROM learning_preparations WHERE id=?', (preparation_id,)).fetchone())
        scenario = db.execute('SELECT spec FROM scenarios WHERE id=?', (row['scenario_id'],)).fetchone()['spec']
        attempts = [tuple(r) for r in db.execute('SELECT * FROM learning_attempts')]
    return row, scenario, attempts


@pytest.mark.parametrize('mode', ['practice', 'adaptive', 'assessment'])
def test_new_retry_and_get_publish_the_same_public_briefing_without_storage_changes(client, mode):
    tid = joined(client, 'EPISODE-BRIEFING')
    kwargs = {'form': 'baseline-a'} if mode == 'assessment' else {}
    prep = prepared(client, tid, mode, **kwargs)
    original = copy.deepcopy(prep)
    before = snapshot(prep['preparation_id'])
    retried = prepared(client, tid, mode, **kwargs)
    response = client.get('/api/v1/learning/preparations/' + prep['preparation_id'], params={'trainee': tid})
    assert response.status_code == 200, response.text
    read = response.json()
    assert prep['briefing'] == retried['briefing'] == read['briefing']
    assert prep['context'] == retried['context'] == read['context']
    assert prep['scenario'] == retried['scenario'] == read['scenario']
    assert snapshot(prep['preparation_id']) == before
    b = prep['briefing']
    assert set(b) == FIELDS
    assert b['version'] == 'episode-briefing-v1'
    assert b['preparation_id'] == prep['preparation_id']
    assert b['scenario_id'] == prep['scenario']['id']
    assert b['catalog_hash'] == prep['context']['catalog_hash']
    assert b['catalog_version'] == prep['context']['version']
    assert b['mode'] == mode and b['assistance'] == prep['context']['assistance']
    frozen_item = learning.item_for(prep['context'])
    assert [b[k] for k in ['title', 'objective', 'instructions']] == [frozen_item[k] for k in ['title', 'objective', 'instructions']]
    b['instructions'].append('Mutated consumer copy')
    assert retried['briefing'] == original['briefing']
    assert learning.item_for(prep['context'])['instructions'] == original['briefing']['instructions']
    assert snapshot(prep['preparation_id']) == before


def test_historical_preparation_briefing_uses_its_exact_catalog_after_current_changes(client, monkeypatch, tmp_path):
    tid = joined(client, 'FROZEN-EPISODE')
    old = prepared(client, tid, item_id='C01_PRACTICE_A')
    before = snapshot(old['preparation_id'])
    _, old_hash, _, new_hash = change_current(monkeypatch, tmp_path)
    retry = prepared(client, tid, item_id='C01_PRACTICE_A')
    read = client.get('/api/v1/learning/preparations/' + old['preparation_id'], params={'trainee': tid}).json()
    newer = prepared(client, tid, rid='next-catalog-episode', item_id='C01_PRACTICE_A')
    assert old['briefing'] == retry['briefing'] == read['briefing']
    assert old['briefing']['catalog_hash'] == old_hash
    assert newer['briefing']['catalog_hash'] == new_hash
    assert newer['briefing']['objective'] == 'Synthetic changed objective'
    assert old['briefing']['objective'] != newer['briefing']['objective']
    assert snapshot(old['preparation_id']) == before


def test_retry_and_get_do_not_need_the_current_catalog_or_change_owner_validation(client, monkeypatch):
    tid = joined(client, 'ORIGINAL-OWNER')
    old = prepared(client, tid)
    before = snapshot(old['preparation_id'])
    other = joined(client, 'OTHER-OWNER')
    def unavailable():
        raise ValueError('Current catalog unavailable')
    monkeypatch.setattr(learning, 'catalog', unavailable)
    retry = prepared(client, tid)
    assert retry == old
    assert client.get('/api/v1/learning/preparations/' + old['preparation_id'], params={'trainee': tid}).json()['briefing'] == old['briefing']
    assert client.get('/api/v1/learning/preparations/' + old['preparation_id'], params={'trainee': other}).status_code == 404
    changed_owner = client.post('/api/v1/learning/prepare', json=dict(request_id=old['preparation_id'], trainee=other, mode='practice', seed=7))
    assert changed_owner.status_code == 409
    assert snapshot(old['preparation_id']) == before


def test_unknown_or_mismatched_context_never_falls_back_to_current_lesson():
    data, digest = learning.catalog()
    valid = context(data, digest)
    scenario = learning.compile_item(valid)
    original = copy.deepcopy(valid)
    for change in [dict(catalog_hash='0'*64), dict(assistance='none'), dict(item_id='C06_PRACTICE_A'), dict(mode='assessment')]:
        invalid = {**valid, **change}
        with pytest.raises(ValueError):
            learning.episode_briefing(invalid, 'episode-fixture', scenario['id'])
        result = learning.preparation_response('episode-fixture', scenario, invalid)
        assert result['briefing'] is None
        assert result['context'] == invalid and result['scenario'] == scenario
    assert valid == original


def test_invalid_public_prose_is_omitted_without_rewriting_the_preparation(monkeypatch):
    data, digest = learning.catalog()
    valid = context(data, digest)
    scenario = learning.compile_item(valid)
    source_item = learning.item_for(valid)
    for changed in [dict(objective=''), dict(instructions=[]), dict(instructions=['x'*1001]), dict(title=None)]:
        bad_item = {**source_item, **changed}
        monkeypatch.setattr(learning, 'item_for', lambda _ctx: bad_item)
        with pytest.raises(ValueError):
            learning.episode_briefing(valid, 'episode-fixture', scenario['id'])
        result = learning.preparation_response('episode-fixture', scenario, valid)
        assert result['briefing'] is None
        assert result['scenario'] == scenario and result['context'] == valid
