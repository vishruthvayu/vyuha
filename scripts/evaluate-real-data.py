#!/usr/bin/env python3
"""Strict, offline exported-record intake and held-out metrics; no live writes."""
import argparse
import hashlib
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from server.data_validation import ingest, evaluate, read_json, validate_parameter_proposal, _json_line


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', required=True, type=Path)
    parser.add_argument('--predictions', type=Path, help='JSONL, one prediction per held-out sample')
    parser.add_argument('--proposal', type=Path, help='Validate a proposal against this evaluation; never apply it')
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    try:
        manifest, records, digest = ingest(args.manifest)
        if args.proposal and not args.predictions:
            raise ValueError('--proposal requires --predictions')
        if args.predictions:
            raw = args.predictions.read_bytes()
            predictions = [_json_line(line) for line in raw.decode('utf-8').splitlines() if line.strip()]
            result = evaluate(manifest, records, predictions, digest, hashlib.sha256(raw).hexdigest())
            if args.proposal:
                proposal = read_json(args.proposal)
                # Bind the proposal to the exact reproducible evaluation report before
                # adding proposal validation to the report envelope.
                report_hash = hashlib.sha256((json.dumps(result, indent=2, sort_keys=True, allow_nan=False)+'\n').encode()).hexdigest()
                if proposal['report_sha256'] != report_hash:
                    raise ValueError('Proposal report hash does not match current evaluation')
                result['parameter_proposal'] = validate_parameter_proposal(proposal, manifest, result)
        else:
            result = dict(schema_version=1, status='INTAKE_CONTRACT_VALID_UNREVIEWED', dataset_id=manifest['dataset_id'], dataset_version=manifest['version'], records=len(records), manifest_sha256=digest, rights_status=manifest['license']['review_status'], evaluation_performed=False, limitation='Hashes/schema/grouping verified; declared provenance/rights/calibration have not been independently authenticated.')
        output = args.output.resolve()
        protected = {args.manifest.resolve()} | {(args.manifest.parent/a['path']).resolve() for a in manifest['artifacts']}
        if args.predictions:
            protected.add(args.predictions.resolve())
        if args.proposal:
            protected.add(args.proposal.resolve())
        if output in protected:
            raise ValueError('Output must not overwrite an input artifact')
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(result, indent=2, sort_keys=True, allow_nan=False)+'\n')
        print(json.dumps(dict(status=result.get('status', result.get('evidence_status')), output=str(output))))
        return 0
    except (ValueError, OSError, KeyError, TypeError) as exc:
        print(f'REJECTED: {exc}', file=sys.stderr)
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
