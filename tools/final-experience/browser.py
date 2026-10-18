#!/usr/bin/env python3
"""Before/after browser evidence. Uses an isolated server/database; never bypasses auth.
VYUHA_QA_PASSWORD must match that disposable server's provisioned officer password.
Run --suite live, matrix, or all; identical fixtures/settings for each source.
"""
import argparse, atexit, hashlib, json, os, re, statistics, time, subprocess, sys
from pathlib import Path
from urllib.request import Request,urlopen
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('--url',required=True);p.add_argument('--serve-root',type=Path);p.add_argument('--output',type=Path,required=True);p.add_argument('--label',required=True);p.add_argument('--suite',choices=['live','matrix','all'],default='all');p.add_argument('--seconds',type=int,default=15);p.add_argument('--width',type=int,default=1440);p.add_argument('--throttle',type=float,default=1);p.add_argument('--repeat',type=int,default=1);args=p.parse_args();args.output.mkdir(parents=True,exist_ok=True)
def api(path,body=None,token=None):
 req=Request(args.url+'/api/v1'+path,data=json.dumps(body).encode() if body is not None else None,headers={'Content-Type':'application/json',**({'Authorization':'Bearer '+token} if token else {})})
 with urlopen(req,timeout=45) as r:return json.load(r)
if args.serve_root:
 from urllib.parse import urlparse
 db=Path('/tmp/vyuha-final-polish-qa')/args.label/'qa.db';db.parent.mkdir(parents=True,exist_ok=True)
 env={**os.environ,'VYUHA_DB':str(db)};env.pop('VYUHA_UNIT_MODE',None)
 subprocess.run([sys.executable,'-c',"import os;from server.auth import provision,credential_path;provision(os.environ['VYUHA_QA_PASSWORD']) if not credential_path().exists() else None"],cwd=args.serve_root,env=env,check=True)
 serverlog=(args.output/'server.log').open('w')
 server=subprocess.Popen([sys.executable,'-m','uvicorn','server.main:app','--host','127.0.0.1','--port',str(urlparse(args.url).port),'--no-access-log'],cwd=args.serve_root,env=env,stdout=serverlog,stderr=serverlog)
 atexit.register(server.terminate)
 for _ in range(100):
  try:api('/health');break
  except Exception:time.sleep(.1)
 else:raise RuntimeError('QA server did not start')
def quantile(v,q):return sorted(v)[min(len(v)-1,int(q*len(v)))] if v else None
PROBE=(ROOT/'tools/drill-rescue/gl-probe.js').read_text()
READ="""()=>{const frames=__gl.frames.splice(0);return {frames,renderer:(()=>{const gl=document.querySelector('canvas')?.getContext('webgl2');const ext=gl?.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'not exposed';})()};}"""
RECTS="""()=>{const out={};for(const s of ['.scene-container','.sensor-workspace > .panel-header','.decision-workspace','.guided-classify','.guided-respond','.guided-status']){const e=document.querySelector(s);if(e){const r=e.getBoundingClientRect();out[s]={x:r.x+scrollX,y:r.y+scrollY,w:r.width,h:r.height};}}return out;}"""
results={'label':args.label,'scope':'Headless Chromium on this host; browser frame intervals and WebGL workload, not physical headset or reference-device certification.','cpu_throttle':args.throttle,'cases':[],'page_errors':[]}
def shot(page,name):page.screenshot(path=str(args.output/(name+'.png')),full_page=True)
def metrics(cdp):return {m['name']:m['value'] for m in cdp.send('Performance.getMetrics')['metrics']}
def measure(page,cdp,seconds):
 page.evaluate('()=>{__gl.frames.length=0;}');before=metrics(cdp);start=time.monotonic();page.wait_for_timeout(seconds*1000);elapsed=time.monotonic()-start;after=metrics(cdp);raw=page.evaluate(READ);frames=[f for f in raw['frames'] if f[0]>0];dt=[f[0] for f in frames];draw=[f[1] for f in frames];tri=[f[2] for f in frames]
 return {'seconds':round(elapsed,3),'frames':len(dt),'mean_fps':round(len(dt)*1000/sum(dt),2) if dt else None,'median_ms':quantile(dt,.5),'p95_ms':quantile(dt,.95),'p99_ms':quantile(dt,.99),'max_ms':max(dt,default=None),'over_33ms':sum(x>33.4 for x in dt),'over_50ms':sum(x>50 for x in dt),'mean_draw_calls':statistics.mean(draw) if draw else 0,'mean_triangles':statistics.mean(tri) if tri else 0,'script_ms_per_second':(after.get('ScriptDuration',0)-before.get('ScriptDuration',0))*1000/elapsed,'task_ms_per_second':(after.get('TaskDuration',0)-before.get('TaskDuration',0))*1000/elapsed,'layout_count':after.get('LayoutCount',0)-before.get('LayoutCount',0),'heap_end_bytes':after.get('JSHeapUsedSize'),'renderer':raw['renderer']}
def context(browser):
 ctx=browser.new_context(viewport={'width':args.width,'height':1000},device_scale_factor=1,service_workers='block');ctx.add_init_script(PROBE);page=ctx.new_page();page.on('pageerror',lambda e:results['page_errors'].append(e.stack));cdp=ctx.new_cdp_session(page);cdp.send('Performance.enable');cdp.send('Emulation.setCPUThrottlingRate',{'rate':args.throttle});return ctx,page,cdp
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--use-angle=gl']);results['browser']=browser.version
 if args.suite in ['live','all']:
  token=api('/auth/login',{'password':os.environ['VYUHA_QA_PASSWORD']})['token']
  for world,night in [('urban',False),('rural',True)]:
   name='Polish QA '+world+(' night' if night else ' day');existing=api('/scenario-library')['scenarios'];spec=next((s for s in existing if s['title']==name),None)
   if not spec:spec=api('/raids',{'schema_version':2,'name':name,'seed':482913,'terrain':world,'night':night,'duration':90,'fog':.15,'family':'DIRECT','mix':['hostile_quad','friendly_uav','bird','no_rf_fpv','fixed_wing','hostile_quad']},token)
   ctx,page,cdp=context(browser);page.goto(args.url+'/?mode=library');page.get_by_label('Drill',exact=True).select_option('library');page.get_by_label('Scenario library',exact=True).select_option(spec['id']);page.wait_for_timeout(2500)
   page.locator('.observation-preferences > summary').click();page.get_by_label('Graphics quality',exact=True).select_option('medium');page.locator('.observation-preferences > summary').click()
   page.get_by_role('button',name='Begin exercise',exact=True).first.click();expect(page.locator('.drill-page')).to_have_attribute('data-phase','running');page.wait_for_timeout(6000)
   # Choose from current visible reports, never inject hidden state or actions.
   contacts=page.locator('.contact-item:not(.stale)');expect(contacts.first).to_be_visible(timeout=20000);contacts.first.click();page.wait_for_timeout(600)
   layouts=[{'stage':'selected','rects':page.evaluate(RECTS)}];shot(page,world+'-01-selected');detail={}
   # Switch every optics mode through trusted browser input.
   for view in ['THERMAL','DAY TV','IR NIGHT DISPLAY']:
    page.get_by_role('button',name=view,exact=True).click();page.wait_for_timeout(1800);detail[view]=measure(page,cdp,5);shot(page,world+'-'+view.replace(' ','-'))
   page.get_by_role('button',name='DAY TV',exact=True).click()
   page.get_by_role('button',name=re.compile('^Designate ')).click();expect(page.locator('.guided')).to_have_attribute('data-step','classify');page.wait_for_timeout(300);layouts.append({'stage':'classify','rects':page.evaluate(RECTS)});shot(page,world+'-02-classify')
   page.locator('.guided input[value="quad"]').check();page.locator('.guided input[value="neutral"]').check();page.get_by_role('button',name='Confirm classification',exact=True).click();expect(page.locator('.guided')).to_have_attribute('data-step','respond');page.wait_for_timeout(300);layouts.append({'stage':'respond','rects':page.evaluate(RECTS)});shot(page,world+'-03-respond')
   page.locator('.effector-card.hold').click();expect(page.locator('.guided')).to_have_attribute('data-step','outcome');page.wait_for_timeout(300);layouts.append({'stage':'outcome','rects':page.evaluate(RECTS)});shot(page,world+'-04-outcome')
   page.get_by_role('button',name='Pause',exact=True).click();expect(page.locator('.drill-page')).to_have_attribute('data-phase','paused');page.wait_for_timeout(400);layouts.append({'stage':'paused','rects':page.evaluate(RECTS)})
   page.get_by_role('button',name='Resume',exact=True).first.click();expect(page.locator('.drill-page')).to_have_attribute('data-phase','running')
   # Actual completion through the unchanged worker and server, without fast-forwarding.
   expect(page.locator('.verification')).to_contain_text('Server verified',timeout=125000);shot(page,world+'-05-verified-review')
   url=page.url;sid=re.search(r'[?&]session=([^&]+)',url).group(1);record=api('/sessions/'+sid+'/aar');assert record['verified'] and {'designate','classify','engage'}<={e['k'] for e in record['events']}
   results['cases'].append({'type':'live','world':world,'night':night,'scenario_id':spec['id'],'scenario_sha256':hashlib.sha256(json.dumps(spec,sort_keys=True).encode()).hexdigest(),'measurements':detail,'layouts':layouts,'verified_session':sid,'event_count':len(record['events']),'history_schema':record.get('scenario',{}).get('engine_version')});ctx.close()
   (args.output/('results-'+args.suite+'.json')).write_text(json.dumps(results,indent=2)+'\n');print('Verified live drill:',world,flush=True)
 if args.suite in ['matrix','all']:
  for repeat in range(args.repeat):
   for world,view,count in [('urban_outpost:day','day',8),('rural_forward_base:night','thermal',100),('urban_outpost:day','day',200),('rural_forward_base:night','thermal',200)]:
    if args.throttle>1 and count!=200:continue
    ctx,page,cdp=context(browser);page.goto(args.url+'/system/benchmark');page.get_by_label('Simulation engine',exact=True).select_option('finale');page.get_by_label('Benchmark world',exact=True).select_option(world);page.get_by_label('Benchmark view',exact=True).select_option(view);page.get_by_label('Benchmark camera',exact=True).select_option('trainee')
    page.get_by_label('Contacts').select_option(str(count));page.get_by_label('Graphics tier').select_option('medium');page.get_by_role('button',name=re.compile('^Run .*check')).click();page.wait_for_timeout(5000 if args.throttle>1 else 2500);m=measure(page,cdp,args.seconds);shot(page,f'matrix-{repeat}-{world.split(":")[0]}-{count}');results['cases'].append({'type':'matrix','repeat':repeat,'world':world,'view':view,'contacts':count,'quality':'medium','measurement':m});ctx.close();print('Measured:',repeat,world,count,flush=True)
 assert not results['page_errors'],results['page_errors'];browser.close()
results['completed_at_utc']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime());(args.output/('results-'+args.suite+'.json')).write_text(json.dumps(results,indent=2)+'\n')
print(args.output/('results-'+args.suite+'.json'))
