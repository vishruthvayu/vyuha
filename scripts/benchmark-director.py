"""Measure production Director paths in a disposable SQLite DB; no training experiment."""
import argparse,json,statistics,sys,tempfile
from pathlib import Path
from time import perf_counter
sys.path.insert(0,str(Path(__file__).resolve().parent.parent))
from server import main,storage
from server.models import Generate
from server.director import persist_outcomes,select_director

parser=argparse.ArgumentParser();parser.add_argument('session');parser.add_argument('--runs',type=int,default=50);parser.add_argument('--output',type=Path);args=parser.parse_args()
if args.runs<1:parser.error('runs must be positive')
source=main.aar(args.session)
original=storage.DB_PATH
updates=[];decisions=[];generations=[]
with tempfile.TemporaryDirectory() as folder:
    storage.DB_PATH=Path(folder)/'benchmark.db';storage.init()
    snapshot=main.profile('MEASURE')
    # Warm each path outside samples.
    main.generate(Generate(mode='adaptive',trainee='MEASURE',seed=0))
    for i in range(args.runs):
        started=perf_counter()
        with storage.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            persist_outcomes(db,'MEASURE',f'measured_{i}',source)
        updates.append((perf_counter()-started)*1000)
        started=perf_counter();select_director(snapshot,[],i);decisions.append((perf_counter()-started)*1000)
        started=perf_counter();main.generate(Generate(mode='adaptive',trainee='MEASURE',seed=i));generations.append((perf_counter()-started)*1000)
    storage.DB_PATH=original
report=dict(runs=args.runs,source_session=args.session,method='Disposable local SQLite. Profile update includes aggregation, transaction and commit after authoritative AAR generation. Director decision is pure seeded selection on fixed profile/history. Scenario generation is the production endpoint including profile/history reads, selection, adaptation and scenario storage. Excludes prior AAR reconstruction, HTTP round-trip and browser rendering.',
            profile_update_median_ms=round(statistics.median(updates),3),director_decision_median_ms=round(statistics.median(decisions),3),scenario_generation_median_ms=round(statistics.median(generations),3),
            profile_update_max_ms=round(max(updates),3),director_decision_max_ms=round(max(decisions),3),scenario_generation_max_ms=round(max(generations),3))
if args.output:args.output.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
