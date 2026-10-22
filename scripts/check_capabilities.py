"""Validate the canonical catalog and reproducible Markdown projection.

Run .venv/bin/python scripts/check_capabilities.py [--write].
"""
import argparse
import json
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from server.capabilities import CATALOG, validate_catalog, registry


def render(data):
    lines = ['# Generated capability and roadmap index', '',
             'Source: `server/config/capabilities-v1.json`. Generate with `scripts/check_capabilities.py --write`. This table is implementation status, not a new validation claim.', '',
             '| Capability | Implementation | Workflow | Source |', '|---|---|---|---|']
    for row in data['capabilities']:
        lines.append('| '+row['title']+' | '+row['implementation']+' | `'+row['route']+'` | '+', '.join('`'+p+'`' for p in row['source_files'])+' |')
    lines += ['', '## Long-term backlog', '', '| ID | Recommendation | Implementation | Checkpoint | Dependencies |', '|---|---|---|---|---|']
    lines += ['| '+' | '.join([r['id'],r['title'],r['implementation'],r['checkpoint'],', '.join(r['dependencies']) or 'Existing baseline'])+' |' for r in data['roadmap']]
    return '\n'.join(lines)+'\n'


if __name__ == '__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--write',action='store_true');args=parser.parse_args()
    data=validate_catalog(json.loads(CATALOG.read_text()));text=render(data)
    target=ROOT/'docs/next-generation/CAPABILITIES.md'
    if args.write:target.write_text(text)
    elif not target.is_file() or target.read_text()!=text:raise SystemExit('Capability projection is stale; regenerate explicitly.')
    view=registry()
    bad=[v for r in view['capabilities'] for v in r['validation'] if v['freshness'] in {'MISSING','INVALID'}]
    if bad:raise SystemExit('Invalid/missing proof artifacts: '+str(bad))
    print(f"Validated {len(data['capabilities'])} capabilities and {len(data['roadmap'])} roadmap items; historical receipts retain their original source scope.")
