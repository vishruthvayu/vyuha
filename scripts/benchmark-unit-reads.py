#!/usr/bin/env python3
"""Comparable unit-read latency/SQL observations on a disposable fixture backup."""
import argparse,hashlib,json,math,os,statistics,sys,time
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--repo',type=Path,required=True);p.add_argument('--db',type=Path,required=True);p.add_argument('--unit',default='local');p.add_argument('--samples',type=int,default=30);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
if not 5<=a.samples<=100:raise SystemExit('Use5–100 bounded samples')
os.environ['VYUHA_DB']=str(a.db.resolve());sys.path.insert(0,str(a.repo.resolve()))
from server import storage,units
try:
    from server.query_cache import clear as cache_clear,metrics
except ImportError:
    cache_clear=lambda:None
    metrics=lambda:{}


storage.init();query_count=0
connect=storage.connect
def traced():
    connection=connect()
    def count(statement):
        global query_count
        query_count+=1
    connection.set_trace_callback(count)
    return connection
# warm legacy backfill before the observation; its work is not hidden in hot timings.
units.unit_dashboard(a.unit)
storage.connect=traced;units.connect=traced
before_hash=None;results={}
for mode in ['cold','repeated']:
    elapsed=[];queries=[];hashes=[]
    cache_clear()
    for i in range(a.samples):
        if mode=='cold':cache_clear()
        count_before=query_count;start=time.perf_counter()
        body=units.unit_dashboard(a.unit)
        elapsed.append((time.perf_counter()-start)*1000);queries.append(query_count-count_before)
        hashes.append(hashlib.sha256(storage.dumps(body).encode()).hexdigest())
    assert len(set(hashes))==1,'Reader output changed within the quiescent workload'
    if before_hash is None:before_hash=hashes[0]
    else:assert hashes[0]==before_hash
    results[mode]={'samples_ms':elapsed,'median_ms':statistics.median(elapsed),'p95_ms':sorted(elapsed)[math.ceil(.95*len(elapsed))-1],'sql_statement_counts':queries,'output_sha256':hashes[0]}
out={'scope':'Synthetic disposable20-member fixture, no concurrent writes, exact full read outputs; cold/repeated reads reported separately. SQL counts exclude cache observer PRAGMA calls. This is not physical unit scalability or whole-memory certification.','samples':a.samples,'repo':str(a.repo.resolve()),'unit_source_sha256':hashlib.sha256((a.repo/'server/units.py').read_bytes()).hexdigest(),'results':results,'cache':metrics()}
cache_clear();a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(out,indent=2)+'\n');print(json.dumps({k:{'median_ms':v['median_ms'],'p95_ms':v['p95_ms'],'queries_median':statistics.median(v['sql_statement_counts'])} for k,v in results.items()}))
