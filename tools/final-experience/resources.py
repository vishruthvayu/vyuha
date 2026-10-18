#!/usr/bin/env python3
"""Live finite-resource/delayed-response controls and geometry. Disposable QA only."""
import argparse,json,os,re,sys
from pathlib import Path
from urllib.request import Request,urlopen
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))
from server.response_v2 import configuration
p=argparse.ArgumentParser();p.add_argument('--url',required=True);p.add_argument('--output',type=Path,required=True);args=p.parse_args();args.output.mkdir(parents=True,exist_ok=True)
def api(path,body=None,token=None):
 with urlopen(Request(args.url+'/api/v1'+path,data=json.dumps(body).encode() if body is not None else None,headers={'Content-Type':'application/json',**({'Authorization':'Bearer '+token} if token else {})}),timeout=30) as r:return json.load(r)
token=api('/auth/login',{'password':os.environ['VYUHA_QA_PASSWORD']})['token'];spec=api('/raids',{'name':'Finite resource control QA','seed':482913,'duration':90,'family':'DIRECT','terrain':'urban','night':False,'mix':['hostile_quad','friendly_uav','no_rf_fpv'],'response_model':configuration({'jammer_channels':1,'jammer_duration_ticks':300,'kinetic_cooldown_ticks':150})},token)
rects="""()=>Object.fromEntries(['.scene-container','.decision-workspace','.guided-body','.guided-respond'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return[s,{x:r.x+scrollX,y:r.y+scrollY,w:r.width,h:r.height}]}))"""
rows=[];errors=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,args=['--no-sandbox','--use-angle=gl'])
 for width in [390,1024,1440]:
  ctx=b.new_context(viewport={'width':width,'height':1000},service_workers='block');pg=ctx.new_page();pg.on('pageerror',lambda e:errors.append(e.stack));pg.goto(args.url);pg.get_by_label('Drill',exact=True).select_option('library');pg.get_by_label('Scenario library',exact=True).select_option(spec['id']);pg.locator('.observation-preferences > summary').click();pg.get_by_label('Graphics quality',exact=True).select_option('medium');pg.locator('.observation-preferences > summary').click();pg.get_by_role('button',name='Begin exercise',exact=True).first.click();pg.locator('.contact-item:not(.stale)').first.click();pg.get_by_role('button',name=re.compile('^Designate ')).click();pg.locator('.guided input[value="quad"]').check();pg.locator('.guided input[value="hostile"]').check();pg.get_by_role('button',name='Confirm classification',exact=True).click();expect(pg.locator('.guided')).to_have_attribute('data-step','respond');pg.wait_for_timeout(200)
  samples=[]
  def snap(stage):
   pg.wait_for_timeout(150);samples.append({'stage':stage,'rects':pg.evaluate(rects),'text':pg.locator('.guided').inner_text()});pg.evaluate('window.scrollTo(0,0)');pg.wait_for_timeout(100);pg.screenshot(path=str(args.output/f'{width}-{stage}.png'),full_page=True)
  snap('ready');pg.locator('.effector-card.rf_jam').click();expect(pg.locator('.guided')).to_have_attribute('data-step','outcome');snap('pending');pg.get_by_role('button',name='Respond again',exact=True).click();expect(pg.locator('.effector-card.rf_jam')).to_contain_text('0/1 channels free');snap('busy');pg.locator('.effector-card.kinetic').click();expect(pg.locator('.guided')).to_have_attribute('data-step','outcome');pg.get_by_role('button',name='Respond again',exact=True).click();snap('reload');pg.wait_for_timeout(11000);snap('finished')
  delta={s:{k:max(a['rects'][s][k] for a in samples)-min(a['rects'][s][k] for a in samples) for k in ['x','y','w','h']} for s in samples[0]['rects']};rows.append({'width':width,'samples':samples,'delta_px':delta});(args.output/'resource-results.json').write_text(json.dumps({'cases':rows,'errors':errors},indent=2)+'\n');assert max(v for d in delta.values() for v in d.values())<=1,delta
  pg.get_by_role('button',name='End exercise',exact=True).click();expect(pg.locator('.verification')).to_contain_text('Server verified',timeout=20000);rows[-1]['server_verified']=True;rows[-1]['review_url']=pg.url;(args.output/'resource-results.json').write_text(json.dumps({'cases':rows,'errors':errors},indent=2)+'\n');ctx.close();print('Finite-resource controls verified',width,flush=True)
 b.close()
assert not errors,errors
