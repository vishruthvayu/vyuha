// Resource soak: a live drill with repeated vision and quality switches; reports
// JS heap and live WebGL objects before and after.
//   node soak.mjs <app> <cycles>
import { readFileSync } from 'node:fs';
import { newTab, sleep } from './drill.mjs';
const [APP, cycles = '6'] = process.argv.slice(2);
const c = await newTab(1440, 900);
await c.send('Page.addScriptToEvaluateOnNewDocument', { source: readFileSync(new URL('./gl-resources.js', import.meta.url), 'utf8') });
await c.send('HeapProfiler.enable');
const setSelect = (label, value) => c.ev(`(() => { const s = document.querySelector('select[aria-label=${JSON.stringify(label)}]'); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, ${JSON.stringify(value)}); s.dispatchEvent(new Event('change', { bubbles: true })); return s.value; })()`);
const snap = async label => { await c.send('HeapProfiler.collectGarbage'); await sleep(400); const r = await c.ev(`({ heapMB: +(performance.memory.usedJSHeapSize/1048576).toFixed(1), ...window.__glr })`); console.log(label.padEnd(26), JSON.stringify(r)); return r; };
await c.nav(APP + '/'); await sleep(1500);
await setSelect('Drill', 'adaptive'); await sleep(600);
await c.clickButton('Prepare adaptive drill'); await c.waitFor(`!!(${c.button('Start adaptive drill')})`, 30000); await c.clickButton('Start adaptive drill');
await sleep(8000);
await c.ev(`(() => { const d = document.querySelector('.observation-preferences'); if (d) d.open = true; })()`);
const first = await snap('after start');
for (let i = 0; i < +cycles; i++) {
  for (const v of ['THERMAL', 'IR NIGHT DISPLAY', 'DAY TV']) { await c.clickButton(v); await sleep(350); }
  for (const q of ['high', 'low', 'medium']) { await setSelect('Graphics quality', q); await sleep(900); }
  await c.clickEl(`document.querySelector('.contact-list .contact-item:not(.stale)')`); await sleep(400);
  if (i === 0 || i === +cycles - 1) await snap(`after cycle ${i + 1}`);
}
const last = await snap('end');
console.log('delta', JSON.stringify(Object.fromEntries(Object.keys(last).map(k => [k, +(last[k] - first[k]).toFixed(1)]))));
await c.clickButton('End exercise'); await sleep(1500);
await c.closeTab();
