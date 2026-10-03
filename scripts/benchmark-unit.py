#!/usr/bin/env python3
"""Measured localhost HTTP concurrency; disposable database, not a learner study."""
import json, math, os, socket, statistics, subprocess, sys, tempfile, time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Barrier, Lock
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import httpx
from server.tests.test_director import expert
from server.engine import score
from server.director import session_outcomes
ROOT=Path(__file__).resolve().parents[1]


def benchmark(count, advanced=False):
 with tempfile.TemporaryDirectory(prefix='vyuha-unit-load-') as directory:
  with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
  env={**os.environ,'VYUHA_DB':str(Path(directory)/'load.db'),'VYUHA_UNIT_MODE':'1'}
  process=subprocess.Popen([sys.executable,'-m','uvicorn','server.main:app','--host','127.0.0.1','--port',str(port),'--no-access-log'],cwd=ROOT,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  base=f'http://127.0.0.1:{port}/api/v1';samples={};payload_sizes=[];lock=Lock();barrier=Barrier(count)
  try:
   with httpx.Client(base_url=base,timeout=60) as c:
    for attempt in range(100):
     try:
      if c.get('/health').is_success:break
     except httpx.TransportError:pass
     time.sleep(.1)
    else:raise RuntimeError('Benchmark server failed to start')
   initial_bytes=sum(p.stat().st_size for p in Path(directory).glob('load.db*'))
   def run(index):
    with httpx.Client(base_url=base,timeout=60) as c:
     def req(method,path,body=None,label=None):
      started=time.perf_counter();r=c.request(method,path,json=body);elapsed=(time.perf_counter()-started)*1000
      r.raise_for_status()
      if label:
       with lock:samples.setdefault(label,[]).append(elapsed)
      return r.json()
     who=req('POST','/units/join',{'callsign':f'LOAD-{index}'})['trainee_id']
     for round_index in range(3):
      spec=req('POST','/scenarios/generate',{'seed':900+index+round_index*20,'mode':'adaptive','trainee':who,'advanced':advanced},'scenario_generation')
      sid=req('POST','/sessions',{'scenario_id':spec['id'],'trainee':who})['id'];sim=expert(spec)
      barrier.wait(timeout=60)
      for seq,offset in enumerate(range(0,len(sim.events),3)):
       body={'seq':seq,'events':sim.events[offset:offset+3]}
       req('POST',f'/sessions/{sid}/events',body,'event_upload')
       assert req('POST',f'/sessions/{sid}/events',body)['duplicate']
       assert req('GET',f'/sessions/{sid}/commands',label='command_poll')['commands']==[]
      command=req('POST',f'/instructor/sessions/{sid}/commands',{'command_id':f'load-{round_index}','type':'sensor_restore','payload':{'sensor':'radar'}},'command_issue')['command']
      stream=req('GET',f'/sessions/{sid}/commands',label='command_response')['commands']
      assert stream==[command] and command['session_id']==sid
      req('POST',f'/sessions/{sid}/control-state',{'tick':2250,'paused':True,'active_contacts':0,'radar_status':'normal','rf_available':True,'night':spec['night'],'applied':[]})
      req('GET','/instructor/sessions',label='active_list')
      req('GET','/units/local/dashboard',label='dashboard')
      card=req('POST',f'/sessions/{sid}/complete',{'execution_tick':2250},'completion')
      assert card==score(sim)
      assert req('POST',f'/sessions/{sid}/complete',{})==card
      aar=req('GET',f'/sessions/{sid}/aar',label='aar');
      with lock:payload_sizes.append(len(json.dumps(aar,separators=(',',':')).encode()))
      p=req('GET',f'/trainees/{who}/profile')
      assert aar['verified'] and aar['trainee']==who and aar['scenario']==spec
      assert p['sessions']==round_index+1 and len(p['outcomes'])==round_index+1
     return sid
   with ThreadPoolExecutor(max_workers=count) as pool:ids=list(pool.map(run,range(count)))
   assert len(set(ids))==count
   with httpx.Client(base_url=base,timeout=60) as c:assert c.get('/units/local/status').json()['database']=='ok'
   try:rss=round(int(subprocess.check_output(['ps','-o','rss=','-p',str(process.pid)],text=True).strip())/1024,2)
   except (OSError,subprocess.SubprocessError):rss=None
   return {'database_growth_bytes':sum(p.stat().st_size for p in Path(directory).glob('load.db*'))-initial_bytes,'replay_payload_bytes':{'median':statistics.median(payload_sizes),'max':max(payload_sizes)},'concurrent_clients':count,'completed_sessions':count*3,'server_rss_mib_after_workload':rss,'http_ms':{k:{'n':len(v),'median':round(statistics.median(v),2),'p95':round(sorted(v)[math.ceil(.95*len(v))-1],2),'max':round(max(v),2)} for k,v in samples.items()}}
  finally:
   process.terminate();process.wait(timeout=10)

if __name__=='__main__':
 print(json.dumps({'method':'Loopback HTTP, fresh SQLite per scale, 3 rounds/client, simultaneous barriers before uploads; medians include request contention, no WAN/device latency; empty polls plus one queued neutral command response/client/round; queued command intentionally not applied; RSS null if unavailable; CPU not measured.','results':[benchmark(n) for n in [1,3,6]]},indent=2))
