// Open the newest exercise in the AAR and capture the replay presets.
//   node aar-shot.mjs <app> <out-dir> [seekFraction]
import { mkdirSync, writeFileSync } from 'node:fs';
import { newTab, sleep } from './drill.mjs';
const [APP, OUT, frac = '0.35', title = 'Procedural detection'] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const c = await newTab(1440, 900);
await c.nav(APP + '/'); await sleep(2000); await c.clickEl(`[...document.querySelectorAll('header a, header button, nav a, nav button')].find(e => e.innerText.trim().startsWith('Review'))`); await sleep(2500);
const shot = async (name, sel) => { await c.send('Page.bringToFront'); const clip = sel ? await c.ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; e.scrollIntoView({block:'center'}); const r = e.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height, scale: 1 }; })()`) : null; await sleep(300); const r = await c.send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip } : {}) }); writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.data, 'base64')); };
await c.clickEl(`[...document.querySelectorAll('button, a, [role=button]')].find(e => e.innerText.trim().startsWith(${JSON.stringify(title)}))`); await sleep(3500);
// seek the replay slider part-way so contacts are airborne
await c.ev(`(() => { const s = document.querySelector('input[type=range][aria-label*="eplay" i], .replay-panel input[type=range], input[type=range]'); if (!s) return false; const v = Math.round(+s.min + (+s.max - +s.min) * ${frac}); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(s, String(v)); s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); return v; })()`);
await sleep(1500);
await shot('aar-page');
for (const p of ['OVERVIEW', 'OBSERVER', 'FOLLOW TARGET']) {
  if (p !== 'OVERVIEW') await c.ev(`(() => { const b = document.querySelector('.contact-item, .replay-contacts button, [data-track]'); })()`);
  const ok = await c.clickButton(p); await sleep(2200);
  console.log(p, ok, await c.ev(`document.querySelector('.replay-camera-controls + .footnote')?.innerText`));
  await shot('aar-' + p.split(' ')[0].toLowerCase(), '.replay-scene');
}
await c.closeTab();
