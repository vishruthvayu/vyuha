#!/usr/bin/env python3
"""Real legacy drill, fixed 400px optical canvas: isolate close-up render cost.
No actions/observations are injected. Reuse browser.py's GL probe/stat conventions.
"""
import argparse,json,statistics,time
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('--url',required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--repeat',type=int,default=3);args=p.parse_args();args.output.mkdir(parents=True,exist_ok=True);rows=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,args=['--no-sandbox','--use-angle=gl'])
 for rep in range(args.repeat):
  for vision in ['THERMAL','DAY TV']:
   ctx=b.new_context(viewport={'width':1440,'height':1000},service_workers='block');ctx.add_init_script((ROOT/'tools/drill-rescue/gl-probe.js').read_text());ctx.add_init_script((ROOT/'tools/drill-rescue/gpu-timer.js').read_text());pg=ctx.new_page();pg.goto(args.url+'/?mode=scripted');pg.get_by_label('Drill',exact=True).select_option('scripted');pg.get_by_label('Conditions',exact=True).select_option('day');pg.locator('.observation-preferences > summary').click();pg.get_by_label('Graphics quality',exact=True).select_option('medium');pg.locator('.observation-preferences > summary').click();pg.get_by_role('button',name='Begin exercise',exact=True).first.click();pg.locator('.contact-item:not(.stale)').filter(has_text='T2').click();pg.get_by_role('button',name=vision,exact=True).click()
   pg.add_style_tag(content='.drill-page {height:auto !important;overflow:visible !important} .scene-container {height:400px !important;flex:none !important}')
   pg.locator('.scene-container').scroll_into_view_if_needed();pg.wait_for_timeout(2500);pg.wait_for_function("[...document.querySelectorAll('.view-annotation')].some(x=>x.textContent.includes('PX ACROSS TARGET')&&getComputedStyle(x).display!=='none')")
   cdp=ctx.new_cdp_session(pg);cdp.send('Performance.enable');get=lambda:{m['name']:m['value'] for m in cdp.send('Performance.getMetrics')['metrics']};before=get();pg.evaluate('__gl.frames.length=0;__gt.ms.length=0');start=time.monotonic();pg.wait_for_timeout(12000);elapsed=time.monotonic()-start;after=get();gpu=pg.evaluate('({available:!!__gt.ext,values:__gt.ms})');raw=pg.evaluate('__gl.frames');frames=[f for f in raw if f[0]>0];dt=sorted(f[0] for f in frames);mean=lambda i:statistics.mean(f[i] for f in frames)
   pg.screenshot(path=str(args.output/f'closeup-{rep}-{vision.replace(" ","-")}.png'),full_page=True)
   rows.append({'repeat':rep,'vision':vision,'scope':'Fixed-size diagnostic canvas in a live legacy worker drill; pin Medium, no Auto','frames':len(frames),'mean_fps':len(frames)*1000/sum(dt),'p95_ms':dt[int(.95*len(dt))],'p99_ms':dt[int(.99*len(dt))],'max_ms':max(dt),'gpu_timer_available':gpu['available'],'gpu_mean_ms':statistics.mean(gpu['values']) if gpu['values'] else None,'gpu_p95_ms':sorted(gpu['values'])[int(.95*len(gpu['values']))] if gpu['values'] else None,'gpu_samples':len(gpu['values']),'canvas':pg.locator('.scene-container canvas').evaluate('(c)=>({width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight})'),'mean_draw_calls':mean(1),'mean_triangles':mean(2),'script_ms_per_second':(after['ScriptDuration']-before['ScriptDuration'])*1000/elapsed,'task_ms_per_second':(after['TaskDuration']-before['TaskDuration'])*1000/elapsed,'caption':pg.locator('.scene-container').inner_text()[-800:]});ctx.close();print('Close-up',rep,vision,flush=True)
 b.close()
(args.output/'closeup-results.json').write_text(json.dumps(rows,indent=2)+'\n')
