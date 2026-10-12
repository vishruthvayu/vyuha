#!/usr/bin/env python3
"""Analyze a sanitized study export without modifying application profiles."""
import argparse
import hashlib
import json
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent.parent))
from server.data_validation import read_json, _json_line
from server.study_validation import evaluate_study


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest',required=True,type=Path)
    parser.add_argument('--trials',required=True,type=Path)
    parser.add_argument('--output',required=True,type=Path)
    args=parser.parse_args()
    try:
        raw=args.trials.read_bytes()
        trials=[_json_line(line) for line in raw.decode('utf-8').splitlines() if line.strip()]
        result=evaluate_study(read_json(args.manifest),trials,hashlib.sha256(args.manifest.read_bytes()).hexdigest(),hashlib.sha256(raw).hexdigest())
        if args.output.resolve() in {args.manifest.resolve(),args.trials.resolve()}:
            raise ValueError('Output must not overwrite study inputs')
        args.output.parent.mkdir(parents=True,exist_ok=True)
        args.output.write_text(json.dumps(result,indent=2,sort_keys=True,allow_nan=False)+'\n')
        print(json.dumps(dict(status=result['evidence_status'],output=str(args.output.resolve()))))
        return 0
    except (ValueError,OSError,TypeError,KeyError) as exc:
        print(f'REJECTED: {exc}',file=sys.stderr)
        return 2


if __name__=='__main__':
    raise SystemExit(main())
