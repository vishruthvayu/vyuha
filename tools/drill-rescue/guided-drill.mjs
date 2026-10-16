// Guided drill on the rescue build: capture each decision step.
//   node guided-drill.mjs <app> <out-dir> [adaptive|library] [--lib=Title] [--wait N] [--w=1440 --h=900]
import { mkdirSync, appendFileSync, writeFileSync } from 'node:fs';
import { newTab, sleep, FRAME_PROBE, FRAME_READ } from './drill.mjs';
import { axeRun } from './axe.mjs';
const doAxe = process.argv.includes('--axe');
const [APP, OUT, mode = 'adaptive'] = process.argv.slice(2);
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const libTitle = arg('lib', ''); const W = +arg('w', 1440), Hh = +arg('h', 900); const wait = +arg('wait', 6);
const kindChoice = arg('kind', 'quad'), idChoice = arg('identity', 'hostile'), eff = arg('effector', 'rf_jam');
mkdirSync(OUT, { recursive: true });
const log = o => { const row = { t: new Date().toISOString(), ...o }; appendFileSync(OUT + '/drill.jsonl', JSON.stringify(row) + '\n'); console.log(JSON.stringify(row).slice(0, 700)); };
const c = await newTab(W, Hh);
const errors = [];
await c.send('Runtime.enable');
c.on(m => { if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails?.exception?.description?.slice(0, 300)); if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value ?? a.description).join(' ').slice(0, 300)); });
const shot = async (name, sel) => { await c.send('Page.bringToFront'); const clip = sel ? await c.ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height, scale: 1 }; })()`) : null; const r = await c.send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip, captureBeyondViewport: true } : {}) }); writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.data, 'base64')); };
const text = sel => c.ev(`document.querySelector(${JSON.stringify(sel)})?.innerText?.replace(/\\s+/g,' ').trim() ?? null`);
const dock = async label => { if (doAxe) log({ step: 'axe', label, violations: await axeRun(c) }); log({ step: 'dock', label, steps: await text('.guided-steps'), status: await text('.guided-status'), body: (await text('.guided-body'))?.slice(0, 400), annotation: await text('.view-annotation.top-left') }); };
const setSelect = (label, pred) => c.ev(`(() => { const s = document.querySelector('select[aria-label=${JSON.stringify(label)}]'); if (!s) return false; const o = [...s.options].find(o => (${pred})(o)); if (!o) return false; const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, o.value); s.dispatchEvent(new Event('change', { bubbles: true })); return o.text; })()`);
await c.nav(APP + '/'); await sleep(2000);
if (mode === 'library') { await setSelect('Drill', "o => o.value === 'library'"); await sleep(1000); log({ lib: await setSelect('Scenario library', `o => o.text.startsWith(${JSON.stringify(libTitle)})`) }); await sleep(1000); await c.clickButton('Begin exercise'); }
else { await setSelect('Drill', "o => o.value === 'adaptive'"); await sleep(800); await c.clickButton('Prepare adaptive drill'); await c.waitFor(`!!(${c.button('Start adaptive drill')})`, 30000); await shot('01-preparation'); await c.clickButton('Start adaptive drill'); }
await c.ev(FRAME_PROBE);
await sleep(wait * 1000);
await c.ev(`window.__fp.d.length = 0`); await sleep(4000); log({ step: 'frames', label: 'idle', ...(await c.ev(FRAME_READ)) });
await shot('02-running'); await dock('running-no-selection');
const pick = await c.ev(`(() => { const items = [...document.querySelectorAll('.contact-list .contact-item:not(.stale)')]; const d = i => +((i.innerText.match(/(\\d+) m/)||[0,1e9])[1]); items.sort((a,b)=>d(a)-d(b)); const b = items[0]; if (!b) return null; b.scrollIntoView({block:'nearest'}); const r = b.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2,label:b.innerText.replace(/\\s+/g,' ')}; })()`);
log({ step: 'select', pick });
if (pick) await c.click(pick.x, pick.y);
await sleep(1200); await c.ev(`window.__fp.d.length = 0`);
await shot('03-selected'); await dock('selected');
for (let i = 0; i < 12; i++) { await shot(`04-burst-${String(i).padStart(2, '0')}`, '.scene-container'); await sleep(60); }
log({ step: 'frames', label: 'tracking', ...(await c.ev(FRAME_READ)) });
log({ step: 'designate', clicked: await c.clickEl(`[...document.querySelectorAll('.guided button')].find(b => b.innerText.trim().startsWith('Designate') && !b.disabled)`) });
await sleep(150); await dock('designate-submitted');
await sleep(600); await shot('05-designated'); await dock('after-designate');
await c.ev(`window.scrollTo(0,0)`);
const radio = v => c.clickEl(`document.querySelector('.guided input[type=radio][value=${v}]')?.closest('label')`);
log({ step: 'kind', clicked: await radio(kindChoice) }); await sleep(200);
log({ step: 'identity', clicked: await radio(idChoice) }); await sleep(300);
await shot('06-classify-chosen'); await shot('06b-dock', '.decision-workspace'); await dock('classify-chosen');
log({ step: 'confirm', clicked: await c.clickEl(`[...document.querySelectorAll('.guided button')].find(b => b.innerText.includes('Confirm classification') && !b.disabled)`) });
await sleep(700); await shot('07-respond'); await shot('07b-dock', '.decision-workspace'); await dock('respond');
log({ step: 'respond', clicked: await c.clickEl(`document.querySelector('.guided .effector-card.${eff}:not(:disabled)')`) });
await sleep(400); await shot('08-response-submitted'); await dock('response-submitted');
await sleep(3500); await shot('09-response-3s'); await dock('response-3s');
for (const v of ['THERMAL', 'IR NIGHT DISPLAY', 'DAY TV']) { await c.clickButton(v); await sleep(1300); await shot('10-vision-' + v.split(' ')[0].toLowerCase(), '.scene-container'); }
log({ step: 'end', clicked: await c.clickButton('End exercise') });
await sleep(5000); await shot('11-complete');
log({ step: 'console', errors });
await c.closeTab();
