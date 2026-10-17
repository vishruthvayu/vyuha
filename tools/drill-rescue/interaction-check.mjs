// Trusted input -> two-rAF completion timing in a live production drill.
// This measures UI/frame scheduling, not physical display or camera-slew completion.
// CDP=<isolated browser> node interaction-check.mjs <app> <out-dir>
import { mkdirSync, writeFileSync } from 'node:fs';
import { newTab, sleep } from './drill.mjs';
const [app, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const c = await newTab(1440, 900);
try {
  await c.nav(app + '/');
  await c.clickButton('Prepare adaptive drill');
  if (!await c.waitFor(`!!(${c.button('Start adaptive drill')})`, 30000)) throw Error('Preparation failed');
  await c.clickButton('Start adaptive drill'); await sleep(8000);
  await c.ev(`(() => {
    window.__interactionSamples=[];
    document.addEventListener('pointerdown', event => {
      const b=event.target.closest('.contact-item,.sensor-workspace .panel-header button');
      if(!b)return;
      const kind=b.matches('.contact-item')?'selection':'sensor';
      const target=b.innerText.trim();const start=performance.now();
      requestAnimationFrame(()=>requestAnimationFrame(()=>window.__interactionSamples.push({
        kind,target,trusted:event.isTrusted,twoFrameMs:+(performance.now()-start).toFixed(2),
        selected:document.querySelector('.contact-item[aria-pressed="true"] strong')?.textContent,
        view:document.querySelector('.scene-container')?.className
      })));
    },true);
  })()`);
  const ids = await c.ev(`[...document.querySelectorAll('.contact-item:not(.stale) strong')].map(e=>e.firstChild.textContent.trim())`);
  for (const id of [...ids, ...ids].slice(0, 8)) {
    if (!await c.clickEl(`[...document.querySelectorAll('.contact-item:not(.stale)')].find(e=>e.querySelector('strong')?.firstChild.textContent.trim()===${JSON.stringify(id)})`)) continue;
    await sleep(400);
  }
  for (let i=0;i<4;i++) for (const name of ['THERMAL','IR NIGHT DISPLAY','DAY TV']) {
    if (!await c.clickButton(name)) throw Error('Missing sensor '+name);
    await sleep(400);
  }
  const samples = await c.ev('window.__interactionSamples');
  const summary = Object.fromEntries(['selection','sensor'].map(kind=>{
    const a=samples.filter(s=>s.kind===kind).map(s=>s.twoFrameMs).sort((a,b)=>a-b);
    return [kind,{samples:a.length,medianMs:a.length%2?a[Math.floor(a.length/2)]:(a[a.length/2-1]+a[a.length/2])/2,maxMs:a.at(-1)}];
  }));
  if (summary.selection.samples<2 || summary.sensor.samples!==12 || samples.some(s=>!s.trusted)) throw Error('Incomplete trusted input timing');
  await c.snap(out+'/after-switches.png');
  writeFileSync(out+'/receipt.json',JSON.stringify({source:'5d40a24165dff5ace27c6131318da599ad828b0d',scope:'Pointerdown to two requestAnimationFrame callbacks; UI scheduling only, not physical display or completed camera slew.',summary,samples},null,2)+'\n');
  console.log(summary);
  await c.clickButton('End exercise');
} finally { await c.closeTab(); }
