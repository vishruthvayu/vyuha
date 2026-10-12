import importlib.util
import json
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from server import compliance


@pytest.fixture
def compliance_client(tmp_path, monkeypatch):
    monkeypatch.setattr(compliance, 'ROOT', tmp_path/'checkout')
    docs = compliance.ROOT/'docs/finale'
    docs.mkdir(parents=True)
    original = Path(__file__).resolve().parents[2]/'docs/finale/audit-backlog.json'
    if not original.is_file():
        original = Path('/tmp/finale-audit-matrix/deliverables/docs/finale/audit-backlog.json')
    (docs/'audit-backlog.json').write_bytes(original.read_bytes())
    (docs/'AUDIT-CLOSURE-MATRIX.md').write_text('Recorded acceptance matrix; PARTIAL')
    (docs/'RESEARCH-NOTES.md').write_text('Desktop OR VR; no extra official difficulty clause')
    (docs/'evidence.json').write_text(json.dumps(dict(acceptance='IN PROGRESS', source_tree_sha256=None)))
    app = FastAPI();app.include_router(compliance.router)
    with TestClient(app) as client:
        yield client, docs


def test_public_compliance_retains_all_original_rows_and_does_not_upgrade_acceptance(compliance_client):
    client, docs = compliance_client
    before = {p.name:p.read_bytes() for p in docs.iterdir()}
    result = client.get('/api/v1/system/compliance')
    assert result.status_code == 200
    body = result.json()
    assert len(body['items']) == len({i['id'] for i in body['items']}) == 93
    from collections import Counter
    source=json.loads((docs/'audit-backlog.json').read_text())
    rows=source['items']
    assert body['totals']==dict(Counter(i['status'] for i in rows))
    assert {i['id']:i['status'] for i in body['items']}=={i['id']:i['status'] for i in rows}
    assert body['independent_score'] is None
    assert 'FINAL ACCEPTANCE PENDING' in body['release_status']
    assert all(i['implemented_is_not_validated'] for i in body['items'])
    assert {p.name:p.read_bytes() for p in docs.iterdir()} == before


def test_official_clause_provenance_does_not_invent_audit_quality_requirements(compliance_client):
    client, _ = compliance_client
    items = {i['id']:i for i in client.get('/api/v1/system/compliance').json()['items']}
    for key in ['SC03','SC04','SC05','SC06','SC07','SC08','SC09','SC10','SC11','SC14']:
        assert items[key]['source_kind'] == 'official_clause_or_platform_choice'
    for key in ['SC12','SC13','SC16','SC18','SC19','SC20','X18']:
        assert items[key]['source_kind'] == 'audit_quality_expectation'
    assert items['SC02']['status'] == 'N/A'


def test_evidence_documents_are_whitelisted_and_unavailable_source_is_honest(compliance_client):
    client, docs = compliance_client
    (docs/'private-key.txt').write_text('DO NOT EXPOSE')
    manifest = client.get('/api/v1/system/compliance').json()
    for document in manifest['documents']:
        assert client.get(document['url']).status_code == 200
    assert client.get('/api/v1/system/compliance/documents/private-key.txt').status_code == 404
    assert client.get('/api/v1/system/compliance/documents/security').status_code == 404
    assert client.get('/api/v1/system/compliance/source').status_code == 404
    assert client.get(manifest['source']['fallback_url']).status_code == 200


def test_malformed_or_missing_traceability_fails_closed(compliance_client):
    client, docs = compliance_client
    audit = json.loads((docs/'audit-backlog.json').read_text())
    audit['items'].pop()
    (docs/'audit-backlog.json').write_text(json.dumps(audit))
    assert client.get('/api/v1/system/compliance').status_code == 503
    (docs/'audit-backlog.json').unlink()
    assert client.get('/api/v1/system/compliance').status_code == 503
