"""Read-only verification of this milestone's artifacts and source freshness."""
import hashlib,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT))
from server.evidence import source_hash
p=Path(__file__).resolve().parent
m=json.loads((p/'manifest.json').read_text())
failed=[name for name,digest in m['files'].items() if not (p/name).is_file() or hashlib.sha256((p/name).read_bytes()).hexdigest()!=digest]
print(json.dumps({'artifacts':'PASS' if not failed else 'FAIL','failed':failed,'source':'MATCH' if source_hash()==m['source_tree_sha256'] else 'HISTORICAL','runtime_commit':m['runtime_commit'],'scope':m['scope'],'acceptance':m['acceptance']},indent=2))
raise SystemExit(bool(failed))
