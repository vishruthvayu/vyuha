// Full trainee drill against a running build, capturing every stage.
//   node baseline-drill.mjs <app-url> <out-dir> [adaptive|scripted] [--seed]
import { mkdirSync, appendFileSync, writeFileSync } from 'node:fs';
import { newTab, sleep, FRAME_PROBE, FRAME_READ } from './drill.mjs';
const [APP, OUT, mode = 'adaptive'] = process.argv.slice(2);
const newSeed = process.argv.includes('--seed');
const libTitle = (process.argv.find(a => a.startsWith('--lib=')) || '').slice(6);
const short = process.argv.includes('--short');
mkdirSync(OUT, { recursive: true });
const log = o => { const row = { t: new Date().toISOString(), ...o }; appendFileSync(OUT + '/drill.jsonl', JSON.stringify(row) + '\n'); console.log(JSON.stringify(row).slice(0, 600)); };
const c = await newTab(1440, 900);
const consoleErrors = [];
await c.send('Runtime.enable');
c.on(m => { if (m.method === 'Runtime.exceptionThrown') consoleErrors.push(m.params.exceptionDetails?.exception?.description?.slice(0, 300)); if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) consoleErrors.push(m.params.type + ': ' + m.params.args.map(a => a.value ?? a.description).join(' ').slice(0, 300)); });
const sceneClip = async () => c.ev(`(() => { const e = document.querySelector('.scene-container'); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height }; })()`);
const shot = async (name, clip) => { await c.send('Page.bringToFront'); const r = await c.send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { ...clip, scale: 1 } } : {}) }); writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.data, 'base64')); };
const text = sel => c.ev(`document.querySelector(${JSON.stringify(sel)})?.innerText?.replace(/\\s+/g,' ').trim() ?? null`);
const frames = async label => { const f = await c.ev(FRAME_READ); log({ step: 'frames', label, ...f }); return f; };
const decision = async label => log({ step: 'decision', label, next: await text('.next-guidance'), heading: await text('.action-heading'), buttons: await c.ev(`[...document.querySelectorAll('.decision-primary button, .decision-primary select')].map(b => (b.innerText||b.value||'').trim().replace(/\\s+/g,' ') + (b.disabled ? '[disabled' + (b.title ? ': ' + b.title : '') + ']' : ''))`) });

await c.nav(`${APP}/?mode=${mode}`); await sleep(2000);
const setSelect = (label, pred) => c.ev(`(() => { const s = document.querySelector('select[aria-label=${JSON.stringify(label)}]'); if (!s) return false; const o = [...s.options].find(o => (${pred})(o)); if (!o) return false; const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, o.value); s.dispatchEvent(new Event('change', { bubbles: true })); return o.text; })()`);
if (mode === 'library') { log({ step: 'drill', set: await setSelect('Drill', "o => o.value === 'library'") }); await sleep(1200); log({ step: 'library', set: await setSelect('Scenario library', `o => o.text.startsWith(${JSON.stringify(libTitle)})`) }); await sleep(1200); }
if (newSeed) { await c.clickButton('New seed'); await sleep(800); }
if (mode === 'adaptive') { await c.clickButton('Prepare adaptive drill'); await c.waitFor(`!!(${c.button('Start adaptive drill')})`, 30000); }
await sleep(800);
await shot('01-preparation');
log({ step: 'prepared', subtitle: await text('.exercise-title, .training-title, h1 + p, header small') });
await c.ev(FRAME_PROBE);
await (mode === 'adaptive' ? c.clickButton('Start adaptive drill') : c.clickButton('Begin exercise'));
if (process.argv.includes('--wait')) await sleep(+process.argv[process.argv.indexOf('--wait') + 1] * 1000);
await sleep(1500); await c.ev(`window.__fp.d.length = 0`);
await sleep(6000);
await frames('idle-6s');
const clip = await sceneClip();
await shot('02-active-overview'); await shot('02b-scene', clip);
log({ step: 'scenario', head: await c.ev(`document.querySelector('main')?.innerText.slice(0, 260).replace(/\\s+/g,' ')`), contacts: await text('.contact-list') });
// choose the nearest currently reported contact
const pick = await c.ev(`(() => { const items = [...document.querySelectorAll('.contact-list .contact-item:not(.stale)')]; const d = i => +((i.innerText.match(/(\\d+) m/)||[0,1e9])[1]); items.sort((a,b)=>d(a)-d(b)); const b = items[0]; if (!b) return null; b.scrollIntoView({block:'nearest'}); const r = b.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2,label:b.innerText.replace(/\\s+/g,' ')}; })()`);
log({ step: 'select', pick });
if (pick) { await c.click(pick.x, pick.y); }
await sleep(1500); await c.ev(`window.__fp.d.length = 0`);
await shot('03-selected', clip);
await decision('after-select');
// tracking burst at 1x
for (let i = 0; i < 16; i++) { await shot(`04-burst1x-${String(i).padStart(2, '0')}`, clip); await sleep(60); }
await frames('tracking-1x');
// display magnification 6x through the real control
await c.ev(`(() => { const d = document.querySelector('.observation-preferences'); if (d) d.open = true; })()`); await sleep(200);
await c.ev(`(() => { const i = document.querySelector('input[aria-label="Display magnification"]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, '6'); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); document.querySelector('.observation-preferences').open = false; })()`);
await sleep(1500); await c.ev(`window.__fp.d.length = 0`);
await shot('05-zoom6', clip);
for (let i = 0; i < 16; i++) { await shot(`06-burst6x-${String(i).padStart(2, '0')}`, clip); await sleep(60); }
await frames('tracking-6x');
for (const [label, name] of [['THERMAL', '07-thermal'], ['IR NIGHT DISPLAY', '08-irnight'], ['DAY TV', '09-day']]) {
  await c.clickButton(label); await sleep(1600); await shot(name, clip); await frames('vision-' + label);
}
await c.ev(`(() => { const i = document.querySelector('input[aria-label="Display magnification"]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, '1'); i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
await sleep(800);
// designate -> classify -> respond, as a trainee would
const dock = await c.ev(`(() => { const e = document.querySelector('.decision-primary'); const r = e.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height }; })()`);
log({ step: 'designate', clicked: await c.clickButton('Designate') });
await sleep(700); await decision('after-designate'); await shot('10-designated'); 
await c.ev(`window.scrollTo(0,0)`);
log({ step: 'classify', clicked: await c.clickButton('Confirm ID') });
await sleep(700); await decision('after-classify'); await shot('11-classified');
log({ step: 'respond', clicked: await c.clickButton('RF jammer') });
await sleep(500); await decision('after-respond'); await shot('12-response');
await sleep(4000); await decision('after-respond-4s'); await shot('13-response-4s');
log({ step: 'log', exerciseLog: await c.ev(`[...document.querySelectorAll('.exercise-log, .event-log, [class*="log"]')].map(e=>e.innerText.slice(0,400).replace(/\\s+/g,' ')).join(' || ').slice(0, 900)`) });
// complete
log({ step: 'end', clicked: await c.clickButton('End exercise') });
await sleep(1500);
const confirm = await c.ev(`[...document.querySelectorAll('dialog button, [role="dialog"] button, [role="alertdialog"] button')].map(b=>b.innerText.trim())`);
log({ step: 'end-dialog', confirm });
for (const label of ['End exercise', 'End now', 'Confirm', 'End']) { if (await c.ev(`!!([...document.querySelectorAll('dialog button, [role="dialog"] button, [role="alertdialog"] button')].find(b=>b.innerText.trim().startsWith(${JSON.stringify(label)}) && !b.disabled))`)) { await c.clickEl(`[...document.querySelectorAll('dialog button, [role="dialog"] button, [role="alertdialog"] button')].find(b=>b.innerText.trim().startsWith(${JSON.stringify(label)}))`); break; } }
await sleep(5000);
await shot('14-complete');
log({ step: 'complete', head: await c.ev(`document.querySelector('main')?.innerText.slice(0, 600).replace(/\\s+/g,' ')`), url: await c.ev('location.href') });
log({ step: 'console', errors: consoleErrors.slice(0, 30) });
await c.closeTab();
