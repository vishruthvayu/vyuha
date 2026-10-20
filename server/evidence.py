"""Versioned measured manifest with an explicit source-tree freshness check."""
import hashlib,json
from pathlib import Path
from fastapi import APIRouter,HTTPException
ROOT=Path(__file__).resolve().parents[1]
router=APIRouter(prefix='/api/v1')
SOURCE_HASH_POLICY = 'vyuha-source-inputs-v2'
# Source-only inputs, never data/, .env, private keys, dist/, docs/receipts or caches.
SOURCE_FOLDERS = ('server', 'client/src', 'client/public', 'client/scripts', 'scripts', 'examples')
SOURCE_SUFFIXES = frozenset({'.py', '.sh', '.ps1', '.ts', '.tsx', '.mts', '.cts', '.css', '.svg', '.json', '.mjs', '.js', '.cjs', '.html', '.webmanifest', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.otf', '.mp3', '.ogg', '.wav', '.mp4', '.webm', '.glb', '.gltf', '.bin'})
IGNORED_SOURCE_PARTS = frozenset({'__pycache__', '.pytest_cache', '.mypy_cache', '.ruff_cache', 'node_modules', 'dist'})
SOURCE_FILES = ('client/index.html', 'client/package.json', 'client/package-lock.json', 'server/requirements.lock.txt', 'Dockerfile', '.dockerignore', 'docker-compose.yml', 'docker-compose.unit.yml')
SOURCE_GLOBS = ('client/vite.config.*', 'client/tsconfig*.json', 'client/eslint.config.*', '.github/workflows/*.yml', '.github/workflows/*.yaml')

def source_inputs():
 paths = {ROOT / name for name in SOURCE_FILES}
 for folder in SOURCE_FOLDERS:
  paths.update(p for p in (ROOT/folder).rglob('*') if p.is_file() and p.suffix.lower() in SOURCE_SUFFIXES and not IGNORED_SOURCE_PARTS.intersection(p.relative_to(ROOT).parts))
 for pattern in SOURCE_GLOBS:
  paths.update(p for p in ROOT.glob(pattern) if p.is_file() and p.suffix.lower() in SOURCE_SUFFIXES | {'.yml', '.yaml'})
 return sorted(paths, key=lambda p: p.relative_to(ROOT).as_posix())

def source_hash():
 """Policy-v2 build/runtime/deployment inputs; old receipts keep their old hash.

 Optional absent inputs have an explicit marker, so deletion changes provenance.
 The deterministic length framing prevents path/content concatenation ambiguity.
 Generated artifacts and private QA data are deliberately outside this scope.
 """
 h=hashlib.sha256(SOURCE_HASH_POLICY.encode()+b'\0')
 for p in source_inputs():
  name=p.relative_to(ROOT).as_posix().encode()
  h.update(len(name).to_bytes(4,'big'));h.update(name)
  if p.is_file():
   data=p.read_bytes();h.update(b'P');h.update(len(data).to_bytes(8,'big'));h.update(data)
  else:h.update(b'M')
 return h.hexdigest()

@router.get('/system/evidence')
def evidence():
 p=ROOT/'docs/qa-competitive-polish/evidence.json'
 if not p.exists():p=ROOT/'docs/release-evidence.json'
 if not p.exists():p=ROOT/'docs/qa-stage6/evidence.json'
 if not p.exists():raise HTTPException(503,'Final validation manifest has not been generated yet')
 result=json.loads(p.read_text());result['current_source_hash_policy']=SOURCE_HASH_POLICY;result['source_matches']=result.get('source_tree_sha256')==source_hash()
 result['freshness_note']='Manifest source hash matches this checkout.' if result['source_matches'] else 'Source changed after validation. These are historical measurements; rerun release validation before presenting them as current.'
 candidate=ROOT/'docs/finale/evidence.json'
 if candidate.exists():
  result['finale']=json.loads(candidate.read_text())
  result['finale']['current_source_hash_policy']=SOURCE_HASH_POLICY
  result['finale']['source_matches']=result['finale'].get('source_tree_sha256')==source_hash()
 return result
