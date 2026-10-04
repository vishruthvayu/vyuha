"""Versioned measured manifest with an explicit source-tree freshness check."""
import hashlib,json
from pathlib import Path
from fastapi import APIRouter,HTTPException
ROOT=Path(__file__).resolve().parents[1]
router=APIRouter(prefix='/api/v1')
def source_hash():
 h=hashlib.sha256()
 for folder in ['server','client/src','client/public','client/scripts','scripts']:
  for p in sorted((ROOT/folder).rglob('*')):
   if p.is_file() and p.suffix in ['.py','.sh','.ts','.tsx','.css','.svg','.json','.mjs'] and '__pycache__' not in p.parts:
    h.update(str(p.relative_to(ROOT)).encode());h.update(p.read_bytes())
 for name in ['client/package.json','client/package-lock.json','server/requirements.lock.txt']:
  p=ROOT/name;h.update(name.encode());h.update(p.read_bytes())
 return h.hexdigest()

@router.get('/system/evidence')
def evidence():
 p=ROOT/'docs/qa-competitive-polish/evidence.json'
 if not p.exists():p=ROOT/'docs/release-evidence.json'
 if not p.exists():p=ROOT/'docs/qa-stage6/evidence.json'
 if not p.exists():raise HTTPException(503,'Final validation manifest has not been generated yet')
 result=json.loads(p.read_text());result['source_matches']=result.get('source_tree_sha256')==source_hash()
 result['freshness_note']='Manifest source hash matches this checkout.' if result['source_matches'] else 'Source changed after validation. These are historical measurements; rerun release validation before presenting them as current.'
 return result
