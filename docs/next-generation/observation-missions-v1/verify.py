"""Verify immutable artifact hashes and disclose source freshness without rewriting receipts."""
import hashlib,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT))
from server.evidence import source_hash
p=Path(__file__).resolve().parent
m=json.loads((p/'manifest.json').read_text())
failed=[name for name,digest in m['files'].items() if not (p/name).is_file() or hashlib.sha256((p/name).read_bytes()).hexdigest()!=digest]
print(json.dumps({'artifacts':'PASS' if not failed else 'FAIL','failed':failed,'source':'MATCH' if source_hash()==m['source_tree_sha256'] else 'HISTORICAL','implementation_commit':m['implementation_commit'],'scope':m['scope']},indent=2))
raise SystemExit(bool(failed))
