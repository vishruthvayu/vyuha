"""Catalog provenance/compatibility only; no new curriculum or human learning claim."""
import copy
import hashlib
import json
from pathlib import Path

import pytest

from server import learning, learning_catalogs as registry, storage
from server.learning import LearningContext, PrepareLearning
from server.tests.test_api import client
from server.tests.test_learning import joined, prepared, launch, finished

FROZEN_HASH = '5abe5c7920a40c989546bc59abf77c4cb6430f0cd8a8af5dca2a361ac977d345'


def context(data, digest):
    state = {'competencies': {c['id']: dict(correct=0, incorrect=0, unassessable=0, assessed_sessions=0)
                            for c in data['competencies'] if c['scope'] == 'individual'}, 'recent_items': []}
    req = PrepareLearning(request_id='catalog-fixture', trainee='QA', mode='practice', item_id='C01_PRACTICE_A', seed=7)
    item, selection = learning.choose_item(data, state, req)
    return LearningContext(catalog_hash=digest, item_id=item['id'], mode=req.mode,
                           assistance=item['assistance'], seed=7, selection=selection).model_dump()


def change_current(monkeypatch, tmp_path):
    """Two explicitly registered catalogs for one unchanged learning-v1 contract.

    Only title/objective change in the synthetic test catalog; this is not
    new production content or an assertion that schema-v2 is now supported.
    """
    data, old_hash = learning.catalog()
    raw = learning.CATALOG.read_bytes()
    newer = copy.deepcopy(data)
    next(i for i in newer['items'] if i['id'] == 'C01_PRACTICE_A').update(
        title='Synthetic new current lesson', objective='Synthetic changed objective')
    new_raw = json.dumps(newer, sort_keys=True).encode()
    new_hash = hashlib.sha256(new_raw).hexdigest()
    folder = tmp_path / 'learning-catalogs'
    folder.mkdir()
    (folder / (old_hash + '.json')).write_bytes(raw)
    (folder / (new_hash + '.json')).write_bytes(new_raw)
    index = tmp_path / 'learning-catalogs-v1.json'
    index.write_text(json.dumps(dict(version='learning-catalog-registry-v1', catalogs=[
        dict(sha256=h, contract='learning-v1', file=f'learning-catalogs/{h}.json')
        for h in [old_hash, new_hash]])))
    current = tmp_path / 'current.json'
    current.write_bytes(new_raw)
    monkeypatch.setattr(registry, 'REGISTRY', index)
    monkeypatch.setattr(learning, 'CATALOG', current)
    return data, old_hash, newer, new_hash


def test_bundled_snapshot_is_exact_original_bytes_and_current_default_unchanged():
    raw = learning.CATALOG.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == FROZEN_HASH
    snapshot = registry.REGISTRY.parent / 'learning-catalogs' / (FROZEN_HASH + '.json')
    assert snapshot.read_bytes() == raw
    assert learning.catalog() == registry.catalog_by_hash(FROZEN_HASH)
    assert len(learning.catalog()[0]['items']) == 52


def test_old_context_compiles_identically_after_current_catalog_changes(monkeypatch, tmp_path):
    data, digest = learning.catalog()
    ctx = context(data, digest)
    before = copy.deepcopy(ctx)
    compiled = learning.compile_item(ctx)
    _, old_hash, newer, new_hash = change_current(monkeypatch, tmp_path)
    assert learning.catalog() == (newer, new_hash)
    assert learning.item_for(ctx)['title'] != 'Synthetic new current lesson'
    assert learning.compile_item(ctx) == compiled
    new_ctx = context(newer, new_hash)
    assert learning.item_for(new_ctx)['title'] == 'Synthetic new current lesson'
    assert learning.compile_item(new_ctx)['title'] == 'Synthetic new current lesson'
    assert registry.catalog_by_hash(old_hash)[0] == data
    assert ctx == before


def test_completed_evidence_and_history_remain_identical_after_current_change(client, monkeypatch, tmp_path):
    tid = joined(client, 'HISTORICAL-CATALOG')
    prep = prepared(client, tid)
    sid, review = finished(client, prep, tid)
    with storage.connect() as db:
        original_attempt = dict(db.execute('SELECT * FROM learning_attempts WHERE session_id=?', (sid,)).fetchone())
        original_session = dict(db.execute('SELECT * FROM sessions WHERE id=?', (sid,)).fetchone())
    expected = learning.evidence_for(review, prep['context'])
    change_current(monkeypatch, tmp_path)
    assert learning.evidence_for(review, prep['context']) == expected
    assert client.get(f'/api/v1/sessions/{sid}/aar').json() == review
    with storage.connect() as db:
        learning.complete_attempt(db, sid, review)
        assert dict(db.execute('SELECT * FROM learning_attempts WHERE session_id=?', (sid,)).fetchone()) == original_attempt
        assert dict(db.execute('SELECT * FROM sessions WHERE id=?', (sid,)).fetchone()) == original_session


def test_prepared_old_catalog_still_launches_with_owner_checks_after_current_change(client, monkeypatch, tmp_path):
    tid = joined(client, 'OLD-PREPARATION')
    prep = prepared(client, tid)
    change_current(monkeypatch, tmp_path)
    other = joined(client, 'WRONG-OWNER')
    assert client.get(f"/api/v1/learning/preparations/{prep['preparation_id']}?trainee={other}").status_code == 404
    assert client.post('/api/v1/sessions', json=dict(scenario_id=prep['scenario']['id'], trainee=other,
                                                   learning_preparation=prep['preparation_id'])).status_code == 422
    assert launch(client, prep, tid)
    assert client.get(f"/api/v1/learning/preparations/{prep['preparation_id']}?trainee={tid}").json()['context'] == prep['context']


@pytest.mark.parametrize('digest', ['0' * 64, '../learning-v1.json', 'A' * 64, None])
def test_unknown_or_malformed_digest_cannot_fall_back_to_current(digest):
    with pytest.raises(ValueError, match='Unknown frozen curriculum catalog'):
        registry.catalog_by_hash(digest)


def test_registered_snapshot_tampering_is_detected_even_after_a_successful_read(monkeypatch, tmp_path):
    _, old, _, _ = change_current(monkeypatch, tmp_path)
    registry.catalog_by_hash(old)
    path = tmp_path / 'learning-catalogs' / (old + '.json')
    path.write_bytes(path.read_bytes() + b' ')
    with pytest.raises(ValueError, match='content hash mismatch'):
        registry.catalog_by_hash(old)


def test_returned_catalog_is_a_fresh_object_not_mutable_shared_state():
    data, digest = registry.catalog_by_hash(FROZEN_HASH)
    data['items'][0]['title'] = 'Mutated reader copy'
    assert registry.catalog_by_hash(digest)[0]['items'][0]['title'] != 'Mutated reader copy'


def test_registry_path_escape_duplicate_and_contract_mismatch_fail_closed(monkeypatch, tmp_path):
    _, old, _, _ = change_current(monkeypatch, tmp_path)
    path = registry.REGISTRY
    original = json.loads(path.read_text())
    bad = copy.deepcopy(original)
    bad['catalogs'][0]['file'] = '../learning-v1.json'
    path.write_text(json.dumps(bad))
    with pytest.raises(ValueError, match='registry entry'):
        registry.catalog_by_hash(old)
    bad = copy.deepcopy(original)
    bad['catalogs'].append(copy.deepcopy(bad['catalogs'][0]))
    path.write_text(json.dumps(bad))
    with pytest.raises(ValueError, match='registry entry'):
        registry.catalog_by_hash(old)
    path.write_text(json.dumps(original))
    with pytest.raises(ValueError, match='Unknown frozen curriculum catalog'):
        registry.catalog_by_hash(old, 'learning-v2')


def test_current_pointer_drift_requires_explicit_registration(monkeypatch, tmp_path):
    current = tmp_path / 'unregistered-current.json'
    current.write_bytes(learning.CATALOG.read_bytes() + b' ')
    monkeypatch.setattr(learning, 'CATALOG', current)
    with pytest.raises(ValueError, match='Unknown frozen curriculum catalog'):
        learning.catalog()
