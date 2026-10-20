// Real-browser responsive regression for the footer action hidden by a fixed height.
// CDP=<isolated browser> node mobile-controls.mjs <app> <out-dir>
import { mkdirSync, writeFileSync } from 'node:fs';
import { newTab, sleep } from './drill.mjs';
const [app, out] = process.argv.slice(2);
mkdirSync(out, {recursive:true});
const c = await newTab(390,844);
const checks=[];
try {
  await c.nav(app+'/');
  if (!await c.clickButton('Prepare adaptive drill')) throw new Error('Preparation control unavailable');
  if (!await c.waitFor(`!!(${c.button('Start adaptive drill')})`,30000)) throw new Error('Preparation did not complete');
  await c.clickButton('Start adaptive drill'); await sleep(6000);
  for (const width of [360,390,428,768,1024,1280,1440,1920]) {
    await c.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<700});
    await sleep(500);
    const selector = `[...document.querySelectorAll('.scene-toolbar button')].find(b=>b.innerText.includes('2D fallback'))`;
    const point=await c.center(selector); if(!point) throw new Error('Missing fallback at '+width);
    const geometry=await c.ev(`(()=>{const b=${selector}, p=b.parentElement, r=b.getBoundingClientRect(), q=p.getBoundingClientRect(), t=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {within:r.top>=q.top&&r.bottom<=q.bottom+1,uncovered:!!t&&b.contains(t),documentOverflow:document.documentElement.scrollWidth>innerWidth,toolbarHeight:q.height}})()`);
    if(!geometry.within||!geometry.uncovered||geometry.documentOverflow) throw new Error(JSON.stringify({width,...geometry}));
    await c.snap(`${out}/controls-${width}.png`);
    await c.click(point.x,point.y); await sleep(300);
    if(!await c.ev(`!!document.querySelector('.scene-toolbar button[aria-pressed="true"]')`)) throw new Error('2D toggle not applied at '+width);
    if(!await c.clickButton('Use 3D view')) throw new Error('3D recovery control unavailable at '+width);
    await sleep(300);
    checks.push({width,...geometry,fallbackAndRecovery:'PASS'});
  }
  await c.clickButton('End exercise'); await sleep(2000);
  writeFileSync(out+'/receipt.json',JSON.stringify({checks},null,2)+'\n');
} finally { await c.closeTab(); }
