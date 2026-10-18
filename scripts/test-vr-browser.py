#!/usr/bin/env python3
"""Reproducible desktop + emulated WebXR integration checks, using a temporary database.
Run after `cd client && npm ci && npm run build` with Playwright installed in the Python environment.
No headset evidence is claimed. IWER is injected by this test only, never into the application build.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
from urllib.request import urlopen
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--output',type=Path,default=ROOT/'docs/vr/evidence')
args=p.parse_args();args.output.mkdir(parents=True,exist_ok=True)
checks=[];errors=[];emulator_errors=[];started=time.monotonic()
def checked(name):
 checks.append(name);print('PASS:',name,flush=True)
def fingerprint():
 h=hashlib.sha256()
 paths=[]
 for folder in ['server','client/src','client/public','client/scripts','scripts']:
  paths.extend(p for p in (ROOT/folder).rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.suffix in ['.py','.sh','.ts','.tsx','.css','.svg','.json','.mjs','.html'])
 paths.extend([ROOT/'client/package.json',ROOT/'client/package-lock.json',ROOT/'client/vite.config.ts'])
 for path in sorted(paths):
  h.update(str(path.relative_to(ROOT)).encode());h.update(path.read_bytes())
 return h.hexdigest()
def xr_frames(page):
 # Wait for actual XR frames: fixed millisecond sleeps can lose a press/release
 # when software stereo rendering runs slowly or a session has just restarted.
 page.evaluate("""async()=>{const s=__vrqa.activeSession;if(!s)return;await new Promise(resolve=>{const done=()=>{s.removeEventListener('end',done);resolve();};s.addEventListener('end',done,{once:true});s.requestAnimationFrame(()=>s.requestAnimationFrame(done));});} """)
def click_controller(page,x,y,hand='right'):
 page.evaluate('([x,y,hand])=>{const c=__vrqa.controllers[hand];c.position.set(x,y,0);c.quaternion.set(0,0,0,1);}',[x,y,hand])
 xr_frames(page)
 page.evaluate("hand=>__vrqa.controllers[hand].updateButtonValue('trigger',1)",hand)
 xr_frames(page)
 page.evaluate("hand=>__vrqa.controllers[hand].updateButtonValue('trigger',0)",hand)
 page.wait_for_timeout(180)
def action(page,id):return page.locator(f'[data-vr-action="{id}"]')
def open_cockpit(page,url):
 page.goto(url)
 page.get_by_role('button',name='Open VR cockpit',exact=True).click()
 page.locator('.vr-canvas canvas').wait_for();page.wait_for_timeout(800)
def exercise_clock(page):return page.locator('.mission-facts b').inner_text()

source_sha256=fingerprint()
with tempfile.TemporaryDirectory(prefix='vyuha-vr-') as tmp:
 with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
 url=f'http://127.0.0.1:{port}'
 env={**os.environ,'VYUHA_DB':str(Path(tmp)/'qa.db')};env.pop('VYUHA_UNIT_MODE',None)
 server=subprocess.Popen([sys.executable,'-m','uvicorn','server.main:app','--host','127.0.0.1','--port',str(port)],cwd=ROOT,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  for _ in range(100):
   try:
    with urlopen(url+'/api/v1/health',timeout=1) as response:assert response.status==200
    break
   except Exception:time.sleep(.1)
  else:raise RuntimeError('Disposable test server did not start')
  with sync_playwright() as pw:
   browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
   def context(emulate=False):
    ctx=browser.new_context(viewport={'width':1440,'height':1100},device_scale_factor=1,service_workers='block')
    if emulate:
     init=(ROOT/'client/node_modules/iwer/build/iwer.min.js').read_text()+''';
window.__vrqa=new IWER.XRDevice(IWER.metaQuest3);
__vrqa.installRuntime({forceInstall:true});__vrqa.controlMode='programmatic';__vrqa.stereoEnabled=true;
window.__vrRequests=[];window.__denyNext=false;
const originalRequest=navigator.xr.requestSession.bind(navigator.xr);
navigator.xr.requestSession=(...args)=>{__vrRequests.push(args);if(__denyNext){__denyNext=false;return Promise.reject(new DOMException('QA permission denied','NotAllowedError'));}return originalRequest(...args);};
'''
     ctx.add_init_script(script=init)
    pg=ctx.new_page()
    def page_error(error):
     # IWER 2.6.0's onDeviceFrame accesses a null layer after an actual WebGL
     # context loss. Record this pinned upstream limitation explicitly; every
     # application error and error outside that exact stage remains a failure.
     stack=error.stack or str(error)
     if getattr(pg,'qa_context_loss',False) and str(error)=="Cannot read properties of null (reading '0')" and 'onDeviceFrame' in stack:
      emulator_errors.append({'stage':'emulated WebGL context loss','message':str(error),'stack':stack})
     else:errors.append({'message':str(error),'stack':stack})
    pg.on('pageerror',page_error)
    return ctx,pg
   ctx,page=context()
   open_cockpit(page,url)
   expect(page.get_by_role('button',name='Enter VR',exact=True)).to_be_disabled()
   expect(page.locator('.vr-heading')).to_contain_text('Desktop preview is available')
   checked('Desktop without headset: truthful capability state and disabled entry')
   action(page,'start-pause').click();expect(action(page,'start-pause')).to_have_text('Pause exercise')
   page.locator('.vr-desktop-controls button',has_text='T2').click()
   action(page,'designate').click();expect(action(page,'designate')).to_be_disabled()
   action(page,'classify').click();expect(action(page,'hold')).to_be_enabled()
   action(page,'hold').click();expect(action(page,'confirm')).to_be_enabled()
   action(page,'cancel').click();expect(action(page,'confirm')).to_be_disabled()
   action(page,'hold').click();action(page,'confirm').click()
   expect(page.locator('.log-message').first).to_contain_text('held')
   action(page,'start-pause').click();expect(action(page,'start-pause')).to_have_text('Resume exercise')
   page.locator('.vr-workspace').screenshot(path=str(args.output/'desktop-preview.png'))
   checked('Desktop cockpit: begin, select, designate, classify, arm, cancel, confirm and pause')
   page.get_by_role('button',name='Close cockpit',exact=True).click()
   expect(page.locator('.vr-workspace')).to_have_count(0);expect(page.locator('.scene-container canvas').first).to_be_visible()
   page.get_by_role('button',name='End exercise',exact=True).click()
   expect(page.locator('.verification')).to_contain_text('Server verified',timeout=15000)
   checked('Closing preview restores ordinary renderer; decisions saved and server verified')
   ctx.close()

   ctx,page=context(True)
   open_cockpit(page,url)
   expect(page.get_by_role('button',name='Enter VR',exact=True)).to_be_enabled()
   page.evaluate('__denyNext=true')
   page.get_by_role('button',name='Enter VR',exact=True).click()
   expect(page.locator('.vr-workspace [role="alert"]')).to_contain_text('QA permission denied')
   assert page.evaluate('!__vrqa.activeSession')
   checked('Emulated permission denial is recoverable and creates no live session')
   page.get_by_role('button',name='Enter VR',exact=True).click()
   expect(page.locator('.vr-heading')).to_contain_text('Headset session active')
   assert page.evaluate("__vrqa.inputSources.length===2 && __vrRequests.at(-1)[0]==='immersive-vr' && __vrRequests.at(-1)[1].requiredFeatures.includes('local')")
   views=page.evaluate("async()=>{const s=__vrqa.activeSession,r=await s.requestReferenceSpace('local');return await new Promise(resolve=>s.requestAnimationFrame((time,frame)=>resolve(frame.getViewerPose(r).views.length)));}")
   assert views==2
   checked('Emulated XR frame contains separate left-eye and right-eye views')
   click_controller(page,.98,1.37)
   expect(action(page,'start-pause')).to_have_text('Pause exercise')
   click_controller(page,-.98,1.3,'left')
   expect(page.locator('.vr-desktop-controls [aria-pressed="true"]')).to_have_count(1)
   click_controller(page,0,1.83);expect(action(page,'designate')).to_be_disabled()
   click_controller(page,0,1.68);expect(action(page,'kind')).to_contain_text('Fixed-wing')
   click_controller(page,0,1.53);expect(action(page,'identity')).to_contain_text('friendly')
   click_controller(page,0,1.38);expect(action(page,'hold')).to_be_enabled()
   click_controller(page,0,1.23);expect(action(page,'confirm')).to_be_enabled()
   page.wait_for_timeout(8200);expect(action(page,'confirm')).to_be_disabled()
   click_controller(page,0,1.23);click_controller(page,0,.78)
   expect(page.locator('.log-message').first).to_contain_text('held')
   checked('Both emulated controllers raycast scene buttons; selection, type, identity, classification and response reach worker')
   checked('Pending response expires after eight seconds and requires a separate confirmation')
   page.evaluate('__vrqa.quaternion.set(0,.08,0,Math.sqrt(1-.08*.08))')
   page.wait_for_timeout(300)
   page.screenshot(path=str(args.output/'emulated-stereo.png'))
   page.evaluate('__vrqa.quaternion.set(0,0,0,1)')
   page.evaluate("__vrqa.updateVisibilityState('visible-blurred')")
   expect(action(page,'start-pause')).to_have_text('Resume exercise')
   page.wait_for_timeout(400)  # Allow the worker's pause acknowledgement to replace an in-flight snapshot.
   old=exercise_clock(page);page.wait_for_timeout(1300);assert exercise_clock(page)==old,(old,exercise_clock(page))
   page.evaluate("__vrqa.updateVisibilityState('visible')")
   expect(action(page,'start-pause')).to_have_text('Resume exercise')
   checked('Emulated visibility loss pauses simulation; visible again never auto-resumes')
   click_controller(page,.98,1.37);expect(action(page,'start-pause')).to_have_text('Pause exercise')
   # Exercise the in-scene exit button and re-enter, then the headset/system end event.
   click_controller(page,.98,.92);expect(page.locator('.vr-heading')).not_to_contain_text('Headset session active')
   expect(action(page,'start-pause')).to_have_text('Resume exercise')
   page.get_by_role('button',name='Enter VR',exact=True).click();expect(page.locator('.vr-heading')).to_contain_text('Headset session active')
   click_controller(page,.98,1.37);expect(action(page,'start-pause')).to_have_text('Pause exercise')
   page.evaluate('__vrqa.activeSession.end()')
   expect(page.locator('.vr-heading')).not_to_contain_text('Headset session active');expect(action(page,'start-pause')).to_have_text('Resume exercise')
   checked('Controller exit and headset/system exit pause training; re-entry works')
   page.get_by_role('button',name='Enter VR',exact=True).click();expect(page.locator('.vr-heading')).to_contain_text('Headset session active')
   click_controller(page,.98,1.37);expect(action(page,'start-pause')).to_have_text('Pause exercise')
   print('Waiting for ordinary 75-second worker completion in emulated VR…',flush=True)
   expect(page.locator('.verification')).to_contain_text('Server verified',timeout=100000)
   page.wait_for_function('!__vrqa.activeSession')
   page.screenshot(path=str(args.output/'verified-review.png'))
   checked('Natural full-duration VR exercise ends session, opens debrief and is independently server verified')
   ctx.close()

   ctx,page=context(True);open_cockpit(page,url)
   page.get_by_role('button',name='Enter VR',exact=True).click();expect(page.locator('.vr-heading')).to_contain_text('Headset session active')
   click_controller(page,.98,1.37);expect(action(page,'start-pause')).to_have_text('Pause exercise')
   page.qa_context_loss=True
   page.evaluate("__vrqa.appCanvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()")
   expect(action(page,'start-pause')).to_have_text('Resume exercise');page.wait_for_function('!__vrqa.activeSession')
   page.get_by_role('button',name='Close cockpit',exact=True).click()
   checked('Graphics context loss exits immersive mode and pauses the drill')
   ctx.close();browser.close()
  with urlopen(url+'/api/v1/units/local/dashboard') as response:records=json.load(response)['sessions']
  assert len(records)==2 and all(r['verified'] for r in records)
  for r in records:
   assert {'designate','classify','engage'}<={e['k'] for e in r['events']}
  assert not errors,errors
  assert fingerprint()==source_sha256,'Source changed during browser validation; rerun against a fixed tree'
  result={'scope':'Automated headless Chromium + IWER 2.6.0 Meta Quest 3 emulation; temporary SQLite DB; not a physical headset, comfort or device-performance test.','source_sha256':source_sha256,'timestamp_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'checks':checks,'page_errors':errors,'known_emulator_limitations':emulator_errors,'verified_sessions':[{'id':r['id'],'events':len(r['events']),'execution_tick':r.get('executionTick'),'score':r['scorecard']['score']} for r in records],'elapsed_seconds':round(time.monotonic()-started,2),'physical_headset':'NOT TESTED'}
  (args.output/'browser-results.json').write_text(json.dumps(result,indent=2)+'\n')
  print(json.dumps(result,indent=2))
 finally:
  server.terminate()
  try:server.wait(timeout=5)
  except subprocess.TimeoutExpired:server.kill();server.wait()
