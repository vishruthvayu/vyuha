// Capture the world through /system/benchmark for given world/view/camera combos.
//   node world-shot.mjs <app> <out-dir> <combo,...>   combo = world:time:vision:camera:count[:wait]
import { mkdirSync, writeFileSync } from 'node:fs';
import { newTab, sleep } from './drill.mjs';
const [APP, OUT, combos] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const c = await newTab(1440, 900);
const errors = [];
await c.send('Runtime.enable');
c.on(m => { if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails?.exception?.description?.slice(0, 300)); if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value ?? a.description).join(' ').slice(0, 300)); });
const setSel = (label, value) => c.ev(`(() => { const s = document.querySelector('select[aria-label=${JSON.stringify(label)}]') || [...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === 'tactical') && ${JSON.stringify(label)} === 'tier') || [...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === '200') && ${JSON.stringify(label)} === 'count'); if (!s) return false; const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, ${JSON.stringify(value)}); s.dispatchEvent(new Event('change', { bubbles: true })); return s.value; })()`);
for (const combo of combos.split(',')) {
  const [world, time, vision, camera, count = '25', wait = '6', tier = 'medium'] = combo.split(':');
  await c.nav(APP + '/system/benchmark'); await sleep(1200);
  await setSel('Simulation engine', 'finale');
  await setSel('Benchmark world', `${world}:${time}`);
  await setSel('Benchmark view', vision);
  await setSel('Benchmark camera', camera);
  await setSel('count', count);
  await setSel('tier', tier);
  await sleep(500);
  await c.ev(`(() => { const e = document.querySelector('.scene-container'); e.style.height = '560px'; window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 20); })()`);
  await c.clickButton('Run ');
  await sleep(+wait * 1000);
  const clip = await c.ev(`(() => { const e = document.querySelector('.scene-container'); const r = e.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height, scale: 1 }; })()`);
  await c.send('Page.bringToFront');
  const r = await c.send('Page.captureScreenshot', { format: 'png', clip });
  const name = combo.replaceAll(':', '-');
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.data, 'base64'));
  console.log(name, await c.ev(`document.querySelector('main p:nth-of-type(2)')?.innerText ?? ''`));
}
console.log('errors', JSON.stringify(errors.slice(0, 5)));
await c.closeTab();
