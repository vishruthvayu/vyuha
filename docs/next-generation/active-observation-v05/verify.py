"""Verify the sealed development source and available evidence; no DB writes."""
import hashlib,json,subprocess
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT))
from server.evidence import source_hash
HERE=Path(__file__).resolve().parent
m=json.loads((HERE/'manifest.json').read_text())
assert source_hash()==m['source_tree_sha256'],'Runtime source has changed; preserve this as historical evidence'
subprocess.run(['git','merge-base','--is-ancestor',m['runtime_commit'],'HEAD'],cwd=ROOT,check=True)
for name,digest in m['source_files'].items():
 data=subprocess.check_output(['git','show',m['runtime_commit']+':'+name],cwd=ROOT)
 assert hashlib.sha256(data).hexdigest()==digest,name
 assert hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==digest,name
for name,digest in m['frozen_files'].items():
 assert hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==digest,name
for ref,sha in m['protected_refs'].items():
 assert subprocess.check_output(['git','rev-parse',ref],cwd=ROOT,text=True).strip()==sha,ref
for row in m['artifacts']:
 p=ROOT/row['path']
 assert p.stat().st_size==row['bytes'] and hashlib.sha256(p.read_bytes()).hexdigest()==row['sha256'],row['path']
print(f"PASS: {len(m['source_files'])} changed source files, {len(m['frozen_files'])} frozen files, {len(m['artifacts'])} evidence artifacts, {len(m['protected_refs'])} protected refs; exact runtime {m['runtime_commit']}")
