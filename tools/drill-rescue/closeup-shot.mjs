// Capture the sensor-limited close-up of a resolved contact in a live drill.
//   node closeup-shot.mjs <app> <out-dir> [waitSeconds]
import { mkdirSync, writeFileSync } from 'node:fs';
import { newTab, sleep } from './drill.mjs';
const [APP, OUT, wait = '14'] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const c = await newTab(1440, 900);
const setSelect = (label, pred) => c.ev(`(() => { const s = document.querySelector('select[aria-label=${JSON.stringify(label)}]'); const o = [...s.options].find(o => (${pred})(o)); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, o.value); s.dispatchEvent(new Event('change', { bubbles: true })); return o.text; })()`);
const shot = async (name) => { await c.send('Page.bringToFront'); const clip = await c.ev(`(() => { const e = document.querySelector('.scene-container'); const r = e.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height, scale: 1 }; })()`); const r = await c.send('Page.captureScreenshot', { format: 'png', clip }); writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.data, 'base64')); };
const caption = () => c.ev(`(() => { const e = [...document.querySelectorAll('.scene-container .view-annotation')].find(d => d.textContent.includes('CLOSE-UP')); return e && e.style.display !== 'none' ? e.textContent : null; })()`);
const zoom = v => c.ev(`(() => { const i = document.querySelector('input[aria-label="Display magnification"]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, '${v}'); i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
await c.nav(APP + '/'); await sleep(1500);
await setSelect('Drill', "o => o.value === 'adaptive'"); await sleep(600);
await c.clickButton('Prepare adaptive drill'); await c.waitFor(`!!(${c.button('Start adaptive drill')})`, 30000); await c.clickButton('Start adaptive drill');
await sleep(+wait * 1000);
let got = 0;
for (let attempt = 0; attempt < 40 && got < 4; attempt++) {
  // nearest current contact
  await c.clickEl(`(() => { const items = [...document.querySelectorAll('.contact-list .contact-item:not(.stale)')]; const d = i => +((i.innerText.match(/(\\d+) m/)||[0,1e9])[1]); items.sort((a,b)=>d(a)-d(b)); return items[${attempt} % Math.max(1, Math.min(3, items.length))]; })()`);
  await sleep(900);
  const cap = await caption();
  if (!cap) continue;
  console.log('caption', cap);
  await shot(`closeup-${got}-1x`);
  await zoom(6); await sleep(1200); await shot(`closeup-${got}-6x`); console.log('6x', await caption());
  await c.clickButton('THERMAL'); await sleep(1200); await shot(`closeup-${got}-thermal-6x`); console.log('thermal', await caption());
  await c.clickButton('DAY TV'); await zoom(1); await sleep(600);
  got++;
  await sleep(1500);
}
await c.clickButton('End exercise'); await sleep(1500);
await c.closeTab();
