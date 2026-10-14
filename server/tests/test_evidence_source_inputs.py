"""Source freshness covers build/deployment changes, excludes generated/private data."""
import json

import pytest

from server import evidence
from server.tests.test_api import client


@pytest.fixture
def source_tree(tmp_path, monkeypatch):
    monkeypatch.setattr(evidence, 'ROOT', tmp_path)
    for name in [*evidence.SOURCE_FILES, 'server/main.py', 'client/src/App.tsx',
                 'client/public/font.woff2', 'client/public/icon.png',
                 'client/public/manifest.webmanifest', 'client/vite.config.ts',
                 'client/vite.config.mts', 'client/vite.config.cts',
                 'client/tsconfig.json', 'client/tsconfig.node.json',
                 'client/eslint.config.mjs', '.github/workflows/check.yml']:
        path=tmp_path/name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b'fixture')
    return tmp_path


@pytest.mark.parametrize('name', [
    'client/index.html', 'client/vite.config.ts', 'client/vite.config.mts',
    'client/vite.config.cts', 'client/tsconfig.json',
    'client/tsconfig.node.json', 'client/eslint.config.mjs', 'Dockerfile',
    '.dockerignore', 'docker-compose.yml', 'docker-compose.unit.yml',
    '.github/workflows/check.yml', 'client/public/font.woff2',
    'client/public/icon.png', 'client/public/manifest.webmanifest',
    'client/package-lock.json', 'server/requirements.lock.txt',
])
def test_changed_build_runtime_deployment_input_changes_freshness(source_tree, name):
    before=evidence.source_hash()
    path=source_tree/name
    original=path.read_bytes()
    path.write_bytes(original+b'changed')
    assert evidence.source_hash()!=before
    path.write_bytes(original)
    assert evidence.source_hash()==before, 'Restoring exact bytes restores the same provenance'
    path.unlink()
    assert evidence.source_hash()!=before, 'Deleted inputs cannot retain a validation receipt'


@pytest.mark.parametrize('name', [
    'client/dist/assets/generated.js', 'client/tsconfig.tsbuildinfo',
    'docs/finale/evidence.json', 'data/vyuha.db', '.env',
    'data/officer-auth.json', 'certificates/unit.key', 'server/__pycache__/main.py',
    'client/node_modules/package/index.js', '.git/config',
    'client/vite.config.key', 'client/eslint.config.env',
    'server/.pytest_cache/cache.json',
])
def test_generated_private_qa_and_dependency_cache_do_not_change_source_hash(source_tree, name):
    before=evidence.source_hash()
    path=source_tree/name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b'private or generated fixture')
    assert evidence.source_hash()==before


def test_input_order_is_deterministic_and_new_workflow_changes_provenance(source_tree):
    before=evidence.source_hash()
    (source_tree/'.github/workflows/new.yaml').write_text('test: true')
    assert evidence.source_hash()!=before
    names=[p.relative_to(source_tree).as_posix() for p in evidence.source_inputs()]
    assert names==sorted(names)
    assert len(names)==len(set(names))


def test_api_preserves_historical_policy_and_exposes_current_policy(client, source_tree):
    historical={'source_tree_sha256':'historical', 'source_hash_policy':'legacy-v1', 'release_version':'1.0.0'}
    docs=source_tree/'docs'
    docs.mkdir();(docs/'release-evidence.json').write_text(json.dumps(historical))
    finale=docs/'finale';finale.mkdir()
    current={'source_tree_sha256':evidence.source_hash(), 'source_hash_policy':evidence.SOURCE_HASH_POLICY}
    (finale/'evidence.json').write_text(json.dumps(current))
    result=client.get('/api/v1/system/evidence').json()
    assert result['source_matches'] is False
    assert result['source_hash_policy']=='legacy-v1', 'Historical receipts are never relabelled'
    assert result['current_source_hash_policy']==evidence.SOURCE_HASH_POLICY
    assert result['finale']['source_matches'] is True
    assert result['finale']['source_hash_policy']==evidence.SOURCE_HASH_POLICY
    (source_tree/'client/index.html').write_text('Changed document after validation')
    changed=client.get('/api/v1/system/evidence').json()
    assert changed['finale']['source_matches'] is False, 'A built entry-document change must invalidate the real API receipt'
    assert json.loads((docs/'release-evidence.json').read_text())==historical
    assert json.loads((finale/'evidence.json').read_text())==current
