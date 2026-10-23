#!/usr/bin/env python3
"""Print one read-only, synthetic C01 opportunity report; no DB or score writes."""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server.assessment_obligations import pilot_report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--seed', type=int, default=7)
    args = parser.parse_args()
    print(json.dumps(pilot_report(args.seed), indent=2))


if __name__ == '__main__':
    main()
