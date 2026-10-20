#!/usr/bin/env python3
import argparse,gzip,json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from server.experiment import run
p=argparse.ArgumentParser();p.add_argument('config',type=Path);p.add_argument('output',type=Path);a=p.parse_args();result=run(json.loads(a.config.read_text()));raw=json.dumps(result,separators=(',',':')).encode();a.output.with_suffix('.trajectories.json.gz').write_bytes(gzip.compress(raw,mtime=0));summary={**result,'results':[{k:v for k,v in r.items() if k!='trajectory'} for r in result['results']]};a.output.write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps({'label':result['label'],'summary':result['summary']},indent=2))
