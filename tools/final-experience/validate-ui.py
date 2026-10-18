#!/usr/bin/env python3
"""Final populated UI closure using a temporary authenticated server/database."""
import hashlib,json,os,subprocess,sys,tempfile,time
from pathlib import Path
from urllib.request import urlopen
ROOT=Path(__file__).resolve().parents[2]
with tempfile.TemporaryDirectory(prefix='vyuha-final-ui-') as tmp:
 env={**os.environ,'VYUHA_DB':str(Path(tmp)/'qa.db')};env.pop('VYUHA_AUTH_FILE',None);env.pop('VYUHA_UNIT_MODE',None)
 subprocess.run([sys.executable,'-c',"import os;from server.auth import provision;provision(os.environ['VYUHA_QA_PASSWORD'])"],cwd=ROOT,env=env,check=True)
 server=subprocess.Popen([sys.executable,'-m','uvicorn','server.main:app','--host','127.0.0.1','--port','18104','--no-access-log'],cwd=ROOT,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  for _ in range(100):
   try:urlopen('http://127.0.0.1:18104/api/v1/health');break
   except Exception:time.sleep(.1)
  for tool,out in [('resources.py','after/resources'),('layout.py','after/layout')]:
   subprocess.run([sys.executable,'tools/final-experience/'+tool,'--url','http://127.0.0.1:18104','--output','docs/final-experience/'+out],cwd=ROOT,env=env,check=True)
  rendering=json.loads((ROOT/'docs/final-experience/rendering/source.json').read_text())['files_sha256']
  assert all(hashlib.sha256((ROOT/f).read_bytes()).hexdigest()==sha for f,sha in rendering.items())
  diff=subprocess.check_output(['git','diff','e07fb6a07916ad4f0fa48e88a484534b040decfa','--','server'],cwd=ROOT,text=True);assert not diff
  (ROOT/'docs/final-experience/closure-receipt.json').write_text(json.dumps({'completed_at_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'renderer_bytes_match_measured_revision':True,'backend_diff_from_base':False,'ui_source_sha256':{f:hashlib.sha256((ROOT/f).read_bytes()).hexdigest() for f in ['client/src/GuidedDecision.tsx','client/src/premium/training.css']},'checks':['finite resources + delayed outcomes + server verification at 390/1024/1440','eight viewport live action flows + axe + server verification','zero optical/control geometry drift in recorded states','renderer code unchanged from three-repeat GPU/CPU measurements']},indent=2)+'\n')
  print('FINAL UI CLOSURE PASSED',flush=True)
 finally:server.terminate();server.wait(timeout=10)
