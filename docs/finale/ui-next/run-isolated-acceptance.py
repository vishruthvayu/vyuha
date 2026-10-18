"""Reproducible synthetic loopback acceptance; never reads the user's database.
Run with a Python environment containing requirements.lock.txt and Playwright.
The installed Chromium executable can be supplied as VYUHA_QA_CHROMIUM.
"""
import copy, hashlib, json, os, secrets, socket, sqlite3, subprocess, sys, tempfile, time
from pathlib import Path
import httpx
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT))
from server.auth import provision
from server.durability import backup, restore
OUT=Path(__file__).parent
receipt={'source_commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'scope':'Synthetic local HTTP processes and Chromium; no physical LAN, human, scientific or full screen-reader acceptance.'}
def digest(value):return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def free_port():
 with socket.socket() as sock:
  sock.bind(('127.0.0.1',0));return sock.getsockname()[1]
processes=[]
with tempfile.TemporaryDirectory(prefix='vyuha-frozen-acceptance-') as folder:
 folder=Path(folder);key=folder/'bundle-key';key.write_bytes(secrets.token_bytes(48));key.chmod(0o600)
 def start(name,db=None):
  port=free_port();password=secrets.token_urlsafe(32);auth=folder/(name+'-auth.json');provision(password,auth)
  env={**os.environ,'VYUHA_DB':str(db or folder/(name+'.db')),'VYUHA_AUTH_FILE':str(auth),'VYUHA_BUNDLE_KEYFILE':str(key)}
  log=(folder/(name+'.log')).open('w');started=time.perf_counter()
  process=subprocess.Popen([sys.executable,'-m','uvicorn','server.main:app','--host','127.0.0.1','--port',str(port)],cwd=ROOT,env=env,stdout=log,stderr=log);processes.append((process,log))
  client=httpx.Client(base_url=f'http://127.0.0.1:{port}/api/v1',timeout=120)
  while time.perf_counter()-started<20:
   try:
    if client.get('/health').status_code==200:break
   except httpx.HTTPError:time.sleep(.05)
  else:raise RuntimeError('Server did not start')
  startup=time.perf_counter()-started
  login=client.post('/auth/login',json={'password':password});login.raise_for_status();client.headers['Authorization']='Bearer '+login.json()['token']
  return dict(process=process,client=client,origin=f'http://127.0.0.1:{port}',env=env,password=password,startup=startup)
 def call(client,path,body=None):
  response=client.get(path) if body is None else client.post(path,json=body);response.raise_for_status();return response.json()
 try:
  source=start('source');client=source['client']
  receipt['server_startup_to_health_seconds']=round(source['startup'],4)
  env={**source['env'],'VYUHA_VALIDATION_PASSWORD':source['password']}
  subprocess.run([sys.executable,'scripts/final-walkthrough.py','--url',source['origin'],'--output',str(folder/'walkthrough.json')],cwd=ROOT,env=env,check=True,stdout=subprocess.DEVNULL)
  walkthrough=json.loads((folder/'walkthrough.json').read_text());receipt['walkthrough']=walkthrough
  sid=walkthrough['session_id'];tid=walkthrough['new_trainee']
  original=call(client,f'/sessions/{sid}/aar');profile=call(client,f'/trainees/{tid}/profile');index=next(i for i,event in enumerate(original['events']) if event['k']=='engage')
  result=call(client,f'/sessions/{sid}/what-if',{'decision_index':index,'action':{**original['events'][index],'effector':'hold'}})
  assert result['kind']=='counterfactual';assert call(client,f'/sessions/{sid}/aar')==original;assert call(client,f'/trainees/{tid}/profile')==profile
  receipt['what_if_original_aar_and_profile_unchanged']=True
  denied=httpx.get(source['origin']+'/api/v1/instructor/sessions');assert denied.status_code==401
  assert client.get(f'/sessions/{sid}/command-stream',headers={'Last-Event-ID':'9'*5000}).status_code==422
  receipt['unauthenticated_officer_denied']=True;receipt['oversized_command_cursor_rejected']=True
  raid=call(client,'/raids',{'name':'SYNTHETIC ROLE QA','duration':60,'seed':62,'difficulty':'foundational','family':'DIRECT','terrain':'rural'})
  def new_crew(name):return call(client,'/crews',{'name':name,'scenario_id':raid['id'],'members':[{'callsign':'SYNTHETIC_WATCH','role':'spotter'},{'callsign':'SYNTHETIC_RESP','role':'responder'}]})
  crew=new_crew('SYNTHETIC ROLE QA');other=new_crew('SYNTHETIC ISOLATION QA');cid=crew['id']
  spotter=httpx.Client(base_url=client.base_url,headers={'X-VYUHA-Crew-Token':crew['members'][0]['code']},timeout=120)
  responder=httpx.Client(base_url=client.base_url,headers={'X-VYUHA-Crew-Token':crew['members'][1]['code']},timeout=120)
  assert spotter.get(f"/crews/{other['id']}/state").status_code==401
  call(client,f'/crews/{cid}/control',{'command_id':'synthetic-resume','type':'resume','payload':{}})
  visible=[]
  for _ in range(100):
   state=call(spotter,f'/crews/{cid}/state')
   visible=[contact for contact in state['contacts'] if contact['observation']['radar']['detected'] or any(contact['observation'][sensor]['level']!='none' for sensor in ['eo','ir'])]
   if visible:break
   time.sleep(.1)
  assert visible;track=visible[0]['id']
  assert responder.post(f'/crews/{cid}/actions',json={'request_id':'forbidden','k':'designate','track':track}).status_code==403
  for role,request,k,extra in [(spotter,'mark','designate',{}),(responder,'identify','classify',{'kind':'quad','identity':'hostile'}),(responder,'respond','engage',{'effector':'hold'})]:
   call(role,f'/crews/{cid}/actions',{'request_id':request,'k':k,'track':track,**extra})
  attribution=call(responder,f'/crews/{cid}/state')['attribution'];assert [item['role'] for item in attribution]==['spotter','responder','responder']
  member=crew['members'][0]['member_id'];rotated=call(client,f'/crews/{cid}/members/{member}/rotate',{'valid_minutes':15})
  assert spotter.get(f'/crews/{cid}/state').status_code==401
  spotter.headers['X-VYUHA-Crew-Token']=rotated['code'];assert call(spotter,f'/crews/{cid}/state')['attribution']==attribution
  call(client,f'/crews/{cid}/complete',{});shared_aar=call(client,f"/sessions/{crew['session_id']}/aar");assert shared_aar['verified']
  assert call(client,f'/trainees/{tid}/profile')==profile
  receipt['crew_http']={'role_sequence':['spotter','responder','responder'],'accepted_decisions':3,'cross_crew_denied':True,'wrong_role_denied':True,'old_code_revoked_on_rotation':True,'rotation_preserved_attribution':True,'shared_aar_verified':True,'unrelated_individual_profile_unchanged':True}
  spotter.close();responder.close()
  bundle=call(client,'/units/demo-release/bundle/export',{});destination=start('destination');dest=destination['client']
  first=call(dest,'/bundle/import',bundle);second=call(dest,'/bundle/import',bundle)
  assert first['inserted_sessions']>=1 and second['inserted_sessions']==0 and second['skipped_sessions']>=1
  changed=copy.deepcopy(bundle);changed['hmac']='0'*64
  response=dest.post('/bundle/import',json=changed);assert response.status_code in (400,422)
  receipt['signed_transfer']={'first':first,'duplicate':second,'tampered_status':response.status_code}
  source['process'].terminate();source['process'].wait(timeout=10)
  db=folder/'source.db';archive=backup(db,folder/'backup.db');restored=restore(archive,folder/'restored.db')
  with sqlite3.connect(restored) as conn:assert conn.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
  restarted=start('restarted',restored);aar=call(restarted['client'],f'/sessions/{sid}/aar');assert aar==original
  old_token=client.headers['Authorization'];assert restarted['client'].get('/instructor/sessions',headers={'Authorization':old_token}).status_code==401
  receipt['restart_and_restore']={'aar_sha256':digest(aar),'original_equals_restored':True,'old_officer_session_rejected':True,'integrity_check':'ok'}
  try:
   from playwright.sync_api import sync_playwright
   with sync_playwright() as pw:
    executable=os.environ.get('VYUHA_QA_CHROMIUM','/home/naveen/.cache/ms-playwright/chromium-1194/chrome-linux/chrome')
    browser=pw.chromium.launch(executable_path=executable,headless=True,args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':1440,'height':1000},device_scale_factor=1)
    page=context.new_page();page.goto(restarted['origin']+'/analytics');page.get_by_label('Officer password').fill(restarted['password']);page.get_by_role('button',name='Sign in',exact=True).click();page.get_by_role('heading',name='Training analytics').wait_for()
    # Production cache and offline route reload use locally bundled assets.
    page.wait_for_function("document.documentElement.dataset.offlineStatus === 'ready'",timeout=30000)
    page.reload();page.get_by_role('heading',name='Training analytics').wait_for()
    context.set_offline(True);page.reload();page.get_by_role('link',name='VYUHA home',exact=True).wait_for();assert page.get_by_role('link',name='VYUHA home',exact=True).is_visible();context.set_offline(False)
    receipt['production_offline_shell_reload']=True
    page.goto(restarted['origin']+'/transfer');page.get_by_role('heading',name='Data transfer',exact=True).wait_for()
    file=folder/'synthetic-bundle.json';file.write_text(json.dumps(bundle));page.get_by_label('Portable JSON bundle').set_input_files(str(file));page.get_by_role('button',name='Validate and import bundle',exact=True).click();page.get_by_text('Integrity verified.',exact=False).wait_for(timeout=120000)
    page.screenshot(path=str(OUT/'production-transfer-1440.png'),full_page=True)
    receipt['production_browser_signed_import']=True
    browser.close()
  except ImportError:
   receipt['production_browser']='NOT RUN: Playwright unavailable'
  receipt['passed']=True
 finally:
  for process,log in processes:
   if process.poll() is None:process.terminate();process.wait(timeout=10)
   log.close()
OUT.joinpath('ISOLATED-ACCEPTANCE.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({'passed':receipt['passed'],'source_commit':receipt['source_commit'],'receipt':str(OUT/'ISOLATED-ACCEPTANCE.json')}))
