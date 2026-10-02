"""Read-only measurement of a completed local session's uncached AAR path."""
import argparse
import json
import statistics
import sys
from pathlib import Path
from time import perf_counter
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).resolve().parent.parent))
from server import main

parser=argparse.ArgumentParser()
parser.add_argument('session')
parser.add_argument('--runs',type=int,default=20)
parser.add_argument('--output',type=Path)
args=parser.parse_args()
original=main.build_review
review_times=[]

def measured(*values,**options):
    started=perf_counter()
    result=original(*values,**options)
    review_times.append((perf_counter()-started)*1000)
    return result

# Warm imports and validate the chosen completed session before measuring.
main.aar(args.session)
aar_times=[]
with patch.object(main,'build_review',measured):
    for _ in range(args.runs):
        started=perf_counter();response=main.aar(args.session)
        aar_times.append((perf_counter()-started)*1000)
encoded=json.dumps(response,separators=(',',':'),ensure_ascii=False).encode()
report=dict(session_id=args.session,runs=args.runs,method='Uncached in-process AAR endpoint; review includes replay, extraction and Pydantic validation. Excludes HTTP round-trip.',
            aar_generation_median_ms=round(statistics.median(aar_times),3),aar_generation_max_ms=round(max(aar_times),3),
            review_generation_median_ms=round(statistics.median(review_times),3),review_generation_max_ms=round(max(review_times),3),
            aar_payload_bytes=len(encoded),timeline_items=len(response['timeline']),decision_reviews=len(response['decision_reviews']),
            tracks=len(response['scorecard']['rows']),actions=len(response['events']),commands=len(response['commands']))
if args.output:args.output.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
