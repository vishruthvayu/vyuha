// 180 s, 200-contact stability run on /system/benchmark: heap and fps over time.
import { readFileSync, writeFileSync } from 'node:fs';
import { newTab, sleep } from './drill.mjs';
const [APP, OUT, world = 'urban_outpost:day', vision = 'day', tier = 'medium'] = process.argv.slice(2);
const c = await newTab(1440, 900);
await c.send('Page.addScriptToEvaluateOnNewDocument', { source: readFileSync(new URL('./gl-resources.js', import.meta.url), 'utf8') });
const setSel = (pred, value) => c.ev(`(() => { const s = [...document.querySelectorAll('select')].find(${pred}); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, ${JSON.stringify(value)}); s.dispatchEvent(new Event('change', { bubbles: true })); return s.value; })()`);
await c.nav(APP + '/system/benchmark'); await sleep(1500);
await setSel(`s => s.getAttribute('aria-label') === 'Simulation engine'`, 'finale');
await setSel(`s => s.getAttribute('aria-label') === 'Measurement duration'`, '180');
await setSel(`s => s.getAttribute('aria-label') === 'Benchmark world'`, world);
await setSel(`s => s.getAttribute('aria-label') === 'Benchmark view'`, vision);
await setSel(`s => [...s.options].some(o => o.value === '200')`, '200');
await setSel(`s => [...s.options].some(o => o.value === 'tactical') && [...s.options].some(o => o.value === 'high')`, tier);
await sleep(600);
await c.clickButton('Run ');
const marks = []; const began = Date.now();
for (let sample = 0; sample < 13; sample++) { await sleep(15000); marks.push({ t: +((Date.now() - began) / 1000).toFixed(2), ...(await c.ev(`({ heapMB: +(performance.memory.usedJSHeapSize/1048576).toFixed(1), ...window.__glr })`)) }); }
const report = await c.ev(`JSON.parse(document.querySelector('#benchmark-report').textContent)`);
const fps = report.fps_samples; const sorted = [...fps].sort((a, b) => a - b);
const summary = { world, vision, tier, contacts: 200, seconds: report.seconds, simulation_tick: report.simulation_tick, median_render_fps: report.median_render_fps, min_fps_sample: sorted[0], p05_fps: sorted[Math.floor(sorted.length * 0.05)], median_sim_tick_ms: report.median_sim_tick_ms, p95_sim_tick_ms: report.p95_sim_tick_ms, heap_first_mb: +(report.heap_samples[0]?.used_js_heap_bytes / 1048576).toFixed(1), heap_last_mb: +(report.heap_samples.at(-1)?.used_js_heap_bytes / 1048576).toFixed(1), resources: marks };
writeFileSync(OUT, JSON.stringify(summary, null, 1));
console.log(JSON.stringify({ ...summary, resources: [marks[0], marks.at(-1)] }));
await c.closeTab();
