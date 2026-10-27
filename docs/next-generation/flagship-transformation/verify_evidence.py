"""Read-only verification of this development milestone's evidence bundle."""
import hashlib
import json
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT))
from server.evidence import source_hash

manifest = json.loads((HERE / "manifest.json").read_text())
for item in manifest["artifacts"]:
    p = HERE / item["path"]
    assert p.is_file(), item["path"]
    assert hashlib.sha256(p.read_bytes()).hexdigest() == item["sha256"], item["path"]
if "--artifacts-only" not in sys.argv:
    assert source_hash() == manifest["runtime_source_hash"], "Runtime source differs from this receipt; do not reuse it as current acceptance"
a = json.loads((HERE / manifest["matched_performance"]["baseline_receipt"]).read_text())
b = json.loads((HERE / manifest["matched_performance"]["candidate_receipt"]).read_text())
for key in manifest["matched_performance"]["matching_keys"]:
    assert a[key] == b[key], (key, a[key], b[key])
assert b["source"]["commit"] == manifest["runtime_commit"]
assert b["source"]["source_hash"] == manifest["runtime_source_hash"]
assert not b["source"]["working_tree_source_dirty"]
for x in (a, b):
    assert x["timing_samples_complete"] and x["visibility_interruptions"] == 0
    assert x["minimum_active_contacts"] == 200
before = json.loads((HERE / "evidence/vyuha-flagship-original-evidence-before.json").read_text())
after = json.loads((HERE / "evidence/vyuha-flagship-original-evidence-after.json").read_text())
assert before == after and len(before["tables"]) == 18
print("PASS: artifact hashes, runtime source, matched workload and original-session integrity")
