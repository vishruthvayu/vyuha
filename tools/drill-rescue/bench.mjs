// Renderer benchmark through the app's own Device performance check page.
//   node bench.mjs <app> <out.jsonl> <label> [counts] [tiers] [cameras] [vision] [seconds]
import { readFileSync, appendFileSync } from 'node:fs';
import { newTab, sleep } from './drill.mjs';
const [APP, OUT, label, countsArg = '8,25,50,100,200', tiersArg = 'low,medium,high', camsArg = 'trainee,overview', vision = 'thermal', secs = '20', worldArg = ''] = process.argv.slice(2);
const c = await newTab(1440, 900);
await c.send('Page.addScriptToEvaluateOnNewDocument', { source: readFileSync(new URL('./gl-probe.js', import.meta.url), 'utf8') });
await c.send('Page.addScriptToEvaluateOnNewDocument', { source: readFileSync(new URL('./gpu-timer.js', import.meta.url), 'utf8') });
const setSel = (pred, value) => c.ev(`(() => { const s = [...document.querySelectorAll('select')].find(${pred}); if (!s) return false; const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, ${JSON.stringify(value)}); s.dispatchEvent(new Event('change', { bubbles: true })); return s.value; })()`);
const READ = `(() => { const fr = window.__gl.frames.splice(0).filter(f => f[0] > 0); const d = fr.map(f => f[0]).sort((a,b)=>a-b), n = d.length; if (!n) return null; const q = p => d[Math.min(n-1, Math.floor(p*n))]; const mean = d.reduce((a,b)=>a+b,0)/n; const low = d.slice(Math.floor(n*0.99)); const withDraw = fr.filter(f => f[1] > 0); const med = a => { const s = [...a].sort((x,y)=>x-y); return s.length ? s[Math.floor(s.length/2)] : null; }; return { frames: n, fpsMean: +(1000/mean).toFixed(1), medianMs: +q(0.5).toFixed(2), p95Ms: +q(0.95).toFixed(2), p99Ms: +q(0.99).toFixed(2), maxMs: +d[n-1].toFixed(2), onePctLowFps: +(1000/(low.reduce((a,b)=>a+b,0)/low.length)).toFixed(1), over33: d.filter(x=>x>33.4).length, over50: d.filter(x=>x>50).length, drawCalls: med(withDraw.map(f=>f[1])), triangles: Math.round(med(withDraw.map(f=>f[2])) ?? 0) }; })()`;
for (const cam of camsArg.split(',')) for (const tier of tiersArg.split(',')) for (const count of countsArg.split(',')) {
  await c.nav(APP + '/system/benchmark'); await sleep(1500);
  await setSel(`s => s.getAttribute('aria-label') === 'Simulation engine'`, 'finale');
  if (worldArg) await setSel(`s => s.getAttribute('aria-label') === 'Benchmark world'`, worldArg);
  await setSel(`s => s.getAttribute('aria-label') === 'Benchmark view'`, vision);
  await setSel(`s => s.getAttribute('aria-label') === 'Benchmark camera'`, cam);
  await setSel(`s => [...s.options].some(o => o.value === '200')`, count);
  await setSel(`s => [...s.options].some(o => o.value === 'tactical') && [...s.options].some(o => o.value === 'high')`, tier);
  await sleep(1500);
  await c.ev(`window.scrollTo(0, document.querySelector('.scene-container').getBoundingClientRect().top + scrollY - 200)`);
  await c.clickButton('Run ');
  await sleep(3000); await c.ev(READ); await c.ev('window.__gt && (window.__gt.ms.length = 0)'); // discard warm-up (shader compile, uploads)
  await sleep((+secs - 3) * 1000);
  const probe = await c.ev(READ);
  const gpu = await c.ev(`(() => { const s = [...(window.__gt?.ms ?? [])].sort((a,b)=>a-b), n = s.length; return n ? { gpuFrames: n, gpuMedianMs: +s[Math.floor(n/2)].toFixed(3), gpuP90Ms: +s[Math.floor(n*0.9)].toFixed(3) } : {}; })()`);
  await sleep(1200);
  const report = await c.ev(`(() => { try { return JSON.parse(document.querySelector('#benchmark-report').textContent); } catch { return null; } })()`);
  const heap = report?.heap_samples ?? [];
  const dpr = await c.ev(`document.querySelector('.scene-container canvas')?.dataset.dpr ?? null`);
  const row = { label, t: new Date().toISOString(), world: worldArg || 'rural_forward_base:night', vision, camera: cam, tier, contacts: +count, dpr, appMedianFps: report?.median_render_fps, simMedianTickMs: report?.median_sim_tick_ms, simP95TickMs: report?.p95_sim_tick_ms, heapStartMB: heap[0]?.used_js_heap_bytes ? +(heap[0].used_js_heap_bytes / 1048576).toFixed(1) : null, heapEndMB: heap.at(-1)?.used_js_heap_bytes ? +(heap.at(-1).used_js_heap_bytes / 1048576).toFixed(1) : null, ...probe, ...gpu };
  appendFileSync(OUT, JSON.stringify(row) + '\n');
  console.log(JSON.stringify(row));
}
await c.closeTab();
