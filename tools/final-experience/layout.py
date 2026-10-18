#!/usr/bin/env python3
"""Live action/geometry checks against an isolated running production build."""
import argparse,json,re
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
p=argparse.ArgumentParser();p.add_argument('--url',required=True);p.add_argument('--output',type=Path,required=True);args=p.parse_args();args.output.mkdir(parents=True,exist_ok=True)
results=[];errors=[]
RECTS="""()=>Object.fromEntries(['.scene-container','.sensor-workspace > .panel-header','.decision-workspace','.guided-body','.guided-status'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return[s,{x:r.x+scrollX,y:r.y+scrollY,w:r.width,h:r.height}]}))"""
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--no-sandbox','--use-angle=gl'])
 for width in [360,390,428,768,1024,1280,1440,1920]:
  c=b.new_context(viewport={'width':width,'height':720 if width==1280 else 1000},service_workers='block');pg=c.new_page();pg.on('pageerror',lambda e:errors.append(e.stack));pg.goto(args.url+'/?mode=scripted');pg.get_by_label('Drill',exact=True).select_option('scripted');pg.locator('.observation-preferences > summary').click();pg.get_by_label('Graphics quality',exact=True).select_option('medium');pg.locator('.observation-preferences > summary').click();pg.get_by_role('button',name='Begin exercise',exact=True).first.click();expect(pg.locator('.drill-page')).to_have_attribute('data-phase','running');pg.locator('.contact-item:not(.stale)').filter(has_text='T2').click();pg.wait_for_timeout(300)
  stages=[]
  def snap(stage):
   pg.wait_for_timeout(200);stages.append({'stage':stage,'rects':pg.evaluate(RECTS)});pg.evaluate('window.scrollTo(0,0)');pg.wait_for_timeout(100);pg.screenshot(path=str(args.output/f'{width}-{stage}.png'),full_page=True)
  snap('designate');pg.get_by_role('button',name=re.compile('^Designate ')).click();expect(pg.locator('.guided')).to_have_attribute('data-step','classify');snap('classify');pg.add_script_tag(path=str(Path(__file__).resolve().parents[2]/'client/node_modules/axe-core/axe.min.js'));audit=pg.evaluate("async()=>{const r=await axe.run(document.querySelector('.decision-workspace'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}));}");assert not audit,audit;pg.locator('.guided input[value="quad"]').check();pg.locator('.guided input[value="friendly"]').check();pg.get_by_role('button',name='Confirm classification',exact=True).click();expect(pg.locator('.guided')).to_have_attribute('data-step','respond');snap('respond');pg.locator('.effector-card.hold').click();expect(pg.locator('.guided')).to_have_attribute('data-step','outcome');snap('outcome')
  # All inactive panels stay out of sequential keyboard navigation/accessibility.
  if pg.locator('.guided-stage').count():
   assert pg.locator('.guided-stage[inert][aria-hidden="true"]').count()==4
  pg.get_by_role('button',name='Pause',exact=True).click();snap('paused');pg.get_by_role('button',name='Guidance',exact=True).click();snap('guidance-off')
  delta={s:{k:max(a['rects'][s][k] for a in stages)-min(a['rects'][s][k] for a in stages) for k in ['x','y','w','h']} for s in stages[0]['rects']}
  assert max(v for r in delta.values() for v in r.values())<=1,delta
  assert pg.evaluate('document.documentElement.scrollWidth<=innerWidth'), 'horizontal overflow'
  assert stages[0]['rects']['.scene-container']['h']>=250,'optical picture collapsed'
  pg.get_by_role('button',name='End exercise',exact=True).click();expect(pg.locator('.verification')).to_contain_text('Server verified',timeout=20000);results.append({'width':width,'stages':stages,'max_deltas_px':delta,'verified':True,'axe_violations':audit});c.close();print('Stable controls and verified drill:',width,flush=True)
 b.close()
assert not errors,errors
(args.output/'layout-results.json').write_text(json.dumps({'cases':results,'errors':errors},indent=2)+'\n')
