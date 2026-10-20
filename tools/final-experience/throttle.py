#!/usr/bin/env python3
"""Additional synthetic CPU-constrained browser evidence, serialized after the
normal collector. Four-times DevTools main-thread throttle is not a physical
low-end device. Before and after use identical inputs and fixed Medium quality.
"""
import argparse,os,subprocess,sys,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('--wait-pid',type=int,default=0);p.add_argument('--baseline-root',required=True);args=p.parse_args()
while args.wait_pid:
 try:os.kill(args.wait_pid,0);time.sleep(2)
 except ProcessLookupError:break
if not (ROOT/'docs/final-experience/closure-receipt.json').exists():raise RuntimeError('Normal acceptance collector did not finish; inspect its log')
for label,root,port in [('baseline',args.baseline_root,18101),('after',str(ROOT),18102)]:
 command=[sys.executable,'tools/final-experience/browser.py','--url',f'http://127.0.0.1:{port}','--serve-root',root,'--output',f'docs/final-experience/{label}/throttle4','--label','throttle-'+label,'--suite','matrix','--repeat','2','--seconds','12','--throttle','4']
 subprocess.run(command,cwd=ROOT,check=True,env=os.environ.copy())
print('THROTTLED EVIDENCE COMPLETE',flush=True)
