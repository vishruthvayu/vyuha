#!/usr/bin/env python3
"""Serial evidence collector. Baseline root contains the immutable base server,
examples and pre-change production build; candidate root is this worktree.
Never run other benchmarks/builds concurrently with this collector.
"""
import argparse,hashlib,json,os,subprocess,sys,time
from pathlib import Path
from urllib.request import urlopen
ROOT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('--baseline-root',type=Path,required=True);p.add_argument('--wait-pid',type=int);args=p.parse_args()
def fingerprint():
 h=hashlib.sha256()
 for folder in ['client/src','client/public','server']:
  for file in sorted((ROOT/folder).rglob('*')):
   if file.is_file() and '__pycache__' not in file.parts:h.update(str(file.relative_to(ROOT)).encode());h.update(file.read_bytes())
 for name in ['client/package.json','client/package-lock.json']:h.update((ROOT/name).read_bytes())
 return h.hexdigest()
if args.wait_pid:
 print('Waiting for regression process before timing',flush=True)
 while True:
  try:os.kill(args.wait_pid,0);time.sleep(2)
  except ProcessLookupError:break
 (ROOT/'docs/final-experience/after').mkdir(parents=True,exist_ok=True)
start_hash=fingerprint();progress=[]
def run(command,label):
 print('START',label,flush=True);begin=time.monotonic();subprocess.run([sys.executable,*command],cwd=ROOT,check=True,env=os.environ.copy());progress.append({'step':label,'seconds':round(time.monotonic()-begin,2)});print('DONE',label,flush=True)
def served(root,label,command):
 env={**os.environ,'VYUHA_DB':str(Path('/tmp/vyuha-final-polish-qa')/label/'qa.db')};server=subprocess.Popen([sys.executable,'-m','uvicorn','server.main:app','--host','127.0.0.1','--port','18103','--no-access-log'],cwd=root,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  for _ in range(100):
   try:urlopen('http://127.0.0.1:18103/api/v1/health');break
   except Exception:time.sleep(.1)
  run(command,label+' extra evidence')
 finally:server.terminate();server.wait(timeout=10)
run(['tools/final-experience/browser.py','--url','http://127.0.0.1:18101','--serve-root',str(args.baseline_root),'--output','docs/final-experience/baseline','--label','e07fb6a','--suite','matrix','--repeat','3'],'baseline matrix')
served(args.baseline_root,'e07fb6a',['tools/final-experience/closeup.py','--url','http://127.0.0.1:18103','--output','docs/final-experience/baseline'])
run(['tools/final-experience/browser.py','--url','http://127.0.0.1:18102','--serve-root',str(ROOT),'--output','docs/final-experience/after','--label','candidate-final','--suite','all','--repeat','3'],'candidate live drills + matrix')
served(ROOT,'candidate-final',['tools/final-experience/closeup.py','--url','http://127.0.0.1:18103','--output','docs/final-experience/after'])
served(ROOT,'candidate-layout',['tools/final-experience/layout.py','--url','http://127.0.0.1:18103','--output','docs/final-experience/after/layout'])
assert start_hash==fingerprint(),'Application source changed during measurements'
Path(ROOT/'docs/final-experience/run-receipt.json').write_text(json.dumps({'base':'e07fb6a07916ad4f0fa48e88a484534b040decfa','runtime_source_sha256':start_hash,'completed_at_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'progress':progress},indent=2)+'\n')
print('ALL EVIDENCE COMPLETE',flush=True)
