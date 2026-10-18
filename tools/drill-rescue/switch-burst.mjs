// Sensor-switch continuity: select the nearest contact, switch vision, capture a burst.
//   node switch-burst.mjs <app> <out-dir> <libraryTitle|adaptive> <waitSeconds>
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { newTab, sleep } from './drill.mjs';
const [APP, OUT, lib, wait = '10'] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const c = await newTab(1440, 900);
await c.nav(APP + '/'); await sleep(2000);
const setSelect = (label, pred) => c.ev(`(() => { const s = document.querySelector('select[aria-label=${JSON.stringify(label)}]'); if (!s) return false; const o = [...s.options].find(o => (${pred})(o)); if (!o) return false; const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, o.value); s.dispatchEvent(new Event('change', { bubbles: true })); return o.text; })()`);
if (lib === 'adaptive') { await setSelect('Drill', "o => o.value === 'adaptive'"); await sleep(800); await c.clickButton('Prepare adaptive drill'); await c.waitFor(`!!(${c.button('Start adaptive drill')})`, 30000); await c.clickButton('Start adaptive drill'); }
else { await setSelect('Drill', "o => o.value === 'library'"); await sleep(1000); await setSelect('Scenario library', `o => o.text.startsWith(${JSON.stringify(lib)})`); await sleep(1000); await c.clickButton('Begin exercise'); }
await sleep(+wait * 1000);
const pick = await c.ev(`(() => { const items = [...document.querySelectorAll('.contact-list .contact-item:not(.stale)')]; const d = i => +((i.innerText.match(/(\\d+) m/)||[0,1e9])[1]); items.sort((a,b)=>d(a)-d(b)); const b = items[0]; if (!b) return null; const r = b.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2,label:b.innerText.replace(/\\s+/g,' ')}; })()`);
console.log('pick', JSON.stringify(pick));
if (pick) await c.click(pick.x, pick.y);
await sleep(2500);
const clip = await c.ev(`(() => { const e = document.querySelector('.scene-container'); const r = e.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height, scale: 1 }; })()`);
const burst = async (tag, n = 12) => { for (let i = 0; i < n; i++) { const r = await c.send('Page.captureScreenshot', { format: 'png', clip }); writeFileSync(`${OUT}/${tag}-${String(i).padStart(2, '0')}.png`, Buffer.from(r.data, 'base64')); await sleep(40); } };
await burst('before', 3);
for (const v of ['THERMAL', 'DAY TV']) { await c.clickButton(v); await burst('after-' + v.split(' ')[0].toLowerCase(), 14); }
await c.clickButton('End exercise'); await sleep(2000);
await c.closeTab();
