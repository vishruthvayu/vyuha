# Verify this research package

The application source is the merged baseline `2d90137e8116075cd1e48eadab64cb306ea12278`. A later documentation commit is the research envelope, not a newly tested simulator. Product tests were not rerun because no product source changed.

From the repository root, verify artifact hashes and the previously recorded runtime input set without installing dependencies:

```bash
python3 - <<'PY'
import hashlib, json
from pathlib import Path
root = Path('docs/competitive-research')
manifest = json.loads((root / 'research-manifest.json').read_text())
failures = []
for item in manifest['files']:
    path = root / item['path']
    if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != item['sha256']:
        failures.append(str(path))
source = json.loads(Path('docs/vr-unification/evidence/source-inputs.json').read_text())
for item in source['inputs']:
    path = Path(item['path'])
    if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != item['sha256']:
        failures.append(str(path))
print('Research artifacts:', len(manifest['files']))
print('Historical runtime inputs:', len(source['inputs']))
print('Mismatches:', failures)
raise SystemExit(bool(failures))
PY
```

This validates byte identity, not the truth of a third-party claim. The manifest intentionally excludes its own hash. Research-only changes should be confined to this directory when comparing the research commit with baseline main.

For discovery reproduction, the six exact GitHub queries are in SOURCES.md and their raw response bodies are in `evidence/github-*-body.json`. `expanded-search-screening.json` records the union and triage, `git-revision-verification.json` confirms named-branch revisions, and file-inspection receipts record pinned URLs/hashes. Future repository heads may move; use pinned revisions rather than assuming a fresh default branch is identical.

Live screenshots establish only their named screen states on the research date. No competitor training data was submitted. No competitor dependency was installed or its source executed. Professional product claims and author benchmark results remain labeled as such. A failed public API tree fetch is not evidence of an empty application; README fallbacks are explicit.

For later implementation, first approve a roadmap tranche. Introduce versioned semantics only with Python/TS parity, historical compatibility, relevant regression and actual browser acceptance. Physical-device and human-learning claims require their own new evidence.
