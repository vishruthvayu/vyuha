// M6 acceptance captures on the built app (real browser, trusted CDP input).
//   node acceptance.mjs <app> <out-dir> guided   [--w=1440 --h=900] [--axe] [--wait=6]
//   node acceptance.mjs <app> <out-dir> library  --lib=<title prefix> [--w= --h=] [--axe] [--secs=50]
//   node acceptance.mjs <app> <out-dir> world    --combos=world:time:vision:camera:count[:wait],... [--w= --h=]
//   node acceptance.mjs <app> <out-dir> keyboard [--w=1440 --h=900]
// Writes PNGs and run.jsonl (dock text, view annotation, close-up caption, app FPS,
// rAF frame stats, axe violations, 390 layout audit, console errors) to <out-dir>.
import { mkdirSync, appendFileSync, writeFileSync } from 'node:fs';
import { newTab, sleep, FRAME_PROBE, FRAME_READ } from './drill.mjs';
import { axeRun } from './axe.mjs';

const [APP, OUT, PLAN = 'guided'] = process.argv.slice(2);
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const W = +arg('w', 1440), Hh = +arg('h', 900), phone = W < 700;
const doAxe = process.argv.includes('--axe');
mkdirSync(OUT, { recursive: true });
const log = o => { const row = { t: new Date().toISOString(), plan: PLAN, w: W, ...o }; appendFileSync(OUT + '/run.jsonl', JSON.stringify(row) + '\n'); console.log(JSON.stringify(row).slice(0, 900)); return row; };

const c = await newTab(W, Hh);
// Centre the element before clicking: 'nearest' can park it under the sticky phone header.
c.center = async sel => c.ev(`(() => { const e = ${sel}; if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
const errors = [];
await c.send('Runtime.enable'); await c.send('Log.enable');
c.on(m => {
  if (m.method === 'Runtime.exceptionThrown') errors.push({ kind: 'exception', text: (m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text)?.slice(0, 400) });
  if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning' || m.params.type === 'assert')) errors.push({ kind: 'console.' + m.params.type, text: m.params.args.map(a => a.value ?? a.description).join(' ').slice(0, 400) });
  if (m.method === 'Log.entryAdded' && (m.params.entry.level === 'error' || m.params.entry.level === 'warning')) errors.push({ kind: 'log.' + m.params.entry.source + '.' + m.params.entry.level, text: (m.params.entry.text + ' ' + (m.params.entry.url ?? '')).slice(0, 400) });
});

// ---------- helpers ----------
const J = JSON.stringify;
const setSelect = (label, pred) => c.ev(`(() => { const s = document.querySelector('select[aria-label=${J(label)}]'); if (!s) return false; const o = [...s.options].find(o => (${pred})(o)); if (!o) return false; const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, o.value); s.dispatchEvent(new Event('change', { bubbles: true })); return o.text; })()`);
const text = sel => c.ev(`document.querySelector(${J(sel)})?.innerText?.replace(/\\s+/g,' ').trim() ?? null`);
const headerBottom = `(() => { const h = document.querySelector('header'); if (!h) return 0; const p = getComputedStyle(h).position; return /sticky|fixed/.test(p) ? Math.max(0, h.getBoundingClientRect().bottom) : 0; })()`;
// Scroll so the element's top sits just below a sticky header (phone layout).
const scrollTo = async (sel, pad = 8) => c.ev(`(() => { const e = document.querySelector(${J(sel)}); if (!e) return false; const hb = ${headerBottom}; const r = e.getBoundingClientRect(); window.scrollTo(0, Math.max(0, r.top + scrollY - hb - ${pad})); return true; })()`);
const top = () => c.ev(`window.scrollTo(0, 0)`);
const shot = async name => { await c.send('Page.bringToFront'); await sleep(120); const r = await c.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.data, 'base64')); return name; };
const shotEl = async (name, sel) => { await c.send('Page.bringToFront'); const clip = await c.ev(`(() => { const e = document.querySelector(${J(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height, scale: 1 }; })()`); if (!clip) return null; const r = await c.send('Page.captureScreenshot', { format: 'png', clip }); writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.data, 'base64')); return name; };
const appFps = () => c.ev(`(() => { const s = [...document.querySelectorAll('.mission-facts span')].find(s => s.querySelector('small')?.textContent.trim() === 'RENDER'); return s ? s.innerText.replace('RENDER','').trim() : null; })()`);
const caption = () => c.ev(`(() => { const e = [...document.querySelectorAll('.scene-container .view-annotation')].find(d => d.textContent.includes('CLOSE-UP')); return e && e.style.display !== 'none' ? e.textContent : null; })()`);
const annotation = () => text('.sensor-workspace .view-annotation.top-left');
const zoom = v => c.ev(`(() => { const i = document.querySelector('input[aria-label="Display magnification"]'); if (!i) return false; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, '${v}'); i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
const shapeNow = () => c.ev(`(() => { const f = [...document.querySelectorAll('.guided .guided-fact')].find(f => f.querySelector('small')?.textContent === 'Shape'); if (f) return f.querySelector('strong').textContent; const e = document.querySelector('.guided .choice-evidence strong'); return e ? e.textContent : null; })()`);
// Layout audit: horizontal overflow, clipped text, overlapping interactive controls.
const layoutAudit = () => c.ev(`(() => {
  const vw = document.documentElement.clientWidth;
  const vis = e => { const s = getComputedStyle(e); if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const desc = e => (e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\\s+/).slice(0, 2).join('.') : '') + ' "' + (e.innerText || e.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim().slice(0, 40) + '"');
  const all = [...document.querySelectorAll('body *')].filter(e => !e.closest('svg') || e.tagName === 'svg');
  const beyond = all.filter(e => vis(e) && (e.getBoundingClientRect().right > vw + 1 || e.getBoundingClientRect().left < -1)).filter(e => { for (let p = e.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o !== 'visible') return p === document.body || p === document.documentElement; } return true; });
  const clipped = all.filter(e => vis(e) && e.children.length === 0 && (e.innerText || '').trim() && e.scrollWidth > e.clientWidth + 1 && /hidden|clip/.test(getComputedStyle(e).overflowX));
  const hb = (() => { const h = document.querySelector('header'); return h && /sticky|fixed/.test(getComputedStyle(h).position) ? h.getBoundingClientRect().bottom : 0; })();
  const inVp = e => { const r = e.getBoundingClientRect(); return r.bottom > hb && r.top < innerHeight && !e.closest('header'); };
  const onTop = (a, b, r, q) => { const x = (Math.max(r.left, q.left) + Math.min(r.right, q.right)) / 2, y = (Math.max(r.top, q.top) + Math.min(r.bottom, q.bottom)) / 2; if (y < hb) return false; const t = document.elementFromPoint(x, y); return !!t && (a.contains(t) || b.contains(t) || t.contains(a) || t.contains(b)); };
  const ia = [...document.querySelectorAll('button, a[href], input:not([type=radio]), select, summary, label.choice-card, [role=button]:not(g)')].filter(e => vis(e) && inVp(e));
  const overlaps = [];
  for (let i = 0; i < ia.length; i++) for (let j = i + 1; j < ia.length; j++) { const a = ia[i], b = ia[j]; if (a.contains(b) || b.contains(a)) continue; const r = a.getBoundingClientRect(), q = b.getBoundingClientRect(); const w = Math.min(r.right, q.right) - Math.max(r.left, q.left), h = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top); if (w > 2 && h > 2 && onTop(a, b, r, q)) overlaps.push(desc(a) + ' <> ' + desc(b) + ' ' + Math.round(w) + 'x' + Math.round(h)); }
  const tx = all.filter(e => vis(e) && inVp(e) && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()));
  const textOverlaps = [];
  for (let i = 0; i < tx.length; i++) for (let j = i + 1; j < tx.length; j++) { const a = tx[i], b = tx[j]; if (a.contains(b) || b.contains(a)) continue; const r = a.getBoundingClientRect(), q = b.getBoundingClientRect(); const w = Math.min(r.right, q.right) - Math.max(r.left, q.left), h = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top); if (w > 4 && h > 4 && onTop(a, b, r, q) && (a.innerText || '').trim() && (b.innerText || '').trim()) textOverlaps.push(desc(a) + ' <> ' + desc(b) + ' ' + Math.round(w) + 'x' + Math.round(h)); }
  return { textOverlaps: textOverlaps.slice(0, 10), docOverflowX: document.documentElement.scrollWidth - vw, beyond: beyond.slice(0, 8).map(desc), clippedCount: clipped.length, clipped: clipped.slice(0, 8).map(desc), overlaps: overlaps.slice(0, 10) };
})()`);
const record = async (label, extra = {}) => {
  const row = { step: 'state', label, fps: await appFps(), sceneH: await c.ev(`Math.round(document.querySelector('.sensor-workspace .scene-container')?.getBoundingClientRect().height ?? 0)`), rowOverflow: await c.ev(`[...document.querySelectorAll('.contact-list .contact-item')].filter(b => { const r = b.getBoundingClientRect(); return [...b.querySelectorAll('*')].some(e => { const q = e.getBoundingClientRect(); return q.height > 0 && (q.bottom > r.bottom + 1 || q.right > r.right + 1); }); }).map(b => b.innerText.replace(/\\s+/g, ' ').slice(0, 80))`), steps: await text('.guided-steps'), status: await text('.guided-status'), body: (await text('.guided-body'))?.slice(0, 300), annotation: await annotation(), closeup: await caption(), ...extra };
  if (phone) row.layout = await layoutAudit();
  if (doAxe) row.axe = await axeRun(c);
  return log(row);
};
const button = t => c.button(t);
const contactIds = () => c.ev(`[...document.querySelectorAll('.contact-list .contact-item:not(.stale)')].map(b => ({ id: b.querySelector('strong')?.firstChild?.textContent.trim(), d: +((b.innerText.match(/(\\d+) m/) || [0, 1e9])[1]), text: b.innerText.replace(/\\s+/g, ' ') })).sort((a, b) => a.d - b.d)`);
const clickContact = id => c.clickEl(`[...document.querySelectorAll('.contact-list .contact-item')].find(b => b.querySelector('strong')?.firstChild?.textContent.trim() === ${J(id)})`);
const pickTracked = async (tries = 6) => {
  const items = await contactIds();
  for (const it of items.slice(0, tries)) { await clickContact(it.id); await sleep(1100); const a = await annotation(); if (a?.includes('TRACKING')) return { ...it, annotation: a, shape: await shapeNow() }; }
  if (items[0]) { await clickContact(items[0].id); await sleep(900); return { ...items[0], annotation: await annotation(), fallback: true }; }
  return null;
};
const frames = async label => { await c.ev(`window.__fp && (window.__fp.d.length = 0)`); await sleep(4000); return log({ step: 'frames', label, ...(await c.ev(FRAME_READ)) }); };
const sceneView = () => phone ? scrollTo('.sensor-workspace') : top();
const dockView = () => phone ? scrollTo('.decision-workspace') : top();
const finish = async () => { log({ step: 'console', count: errors.length, errors }); await c.closeTab(); };

// ---------- plans ----------
if (PLAN === 'guided') {
  await c.nav(APP + '/'); await sleep(2000);
  await setSelect('Drill', "o => o.value === 'adaptive'"); await sleep(800);
  await sceneView(); await shot('00-welcome'); await record('welcome');
  await c.clickButton('Prepare adaptive drill');
  log({ step: 'prepared', ok: await c.waitFor(`!!(${button('Start adaptive drill')})`, 30000) });
  await sleep(800); await sceneView(); await shot('01-preparation'); await record('preparation');
  await c.clickButton('Start adaptive drill');
  await c.ev(FRAME_PROBE);
  await sleep(+arg('wait', 6) * 1000);
  await frames('running-idle');
  await sceneView(); await shot('02-running'); await record('select-step');
  log({ step: 'contacts', items: await contactIds() });
  const pick = await pickTracked(); log({ step: 'pick', pick });
  await sleep(600);
  if (phone) { await scrollTo('.radar-panel'); await shot('11-selection-radar'); await scrollTo('.contacts-panel'); await shot('11b-selection-list'); } else { await top(); await shot('11-selection'); }
  await record('designate-step');
  await frames('tracking');
  await sceneView(); await shot('09-eo'); log({ step: 'eo', annotation: await annotation(), closeup: await caption() });
  for (const [v, n] of [['THERMAL', '10a-thermal'], ['IR NIGHT DISPLAY', '10b-ir-night']]) { await c.clickButton(v); await sleep(1400); await sceneView(); await shot(n); log({ step: 'vision', v, annotation: await annotation(), closeup: await caption() }); }
  await c.clickButton('DAY TV'); await sleep(700);
  log({ step: 'designate', clicked: await c.clickEl(`[...document.querySelectorAll('.guided button')].find(b => b.innerText.trim().startsWith('Designate') && !b.disabled)`) });
  await sleep(900); await dockView(); await shot('12-designated'); await record('classify-step');
  const ev = await c.ev(`(() => { const t = [...document.querySelectorAll('.guided .choice-evidence')].map(e => e.innerText); return t.join(' | '); })()`);
  const kind = /Fixed-wing/.test(ev) ? 'fixed_wing' : /Bird/.test(ev) ? 'bird' : /Link: Detected/.test(ev) ? 'quad' : /Multirotor/.test(ev) ? 'fiber_fpv' : 'quad';
  const identity = /Friendly reply/.test(ev) ? 'friendly' : /Registered civil/.test(ev) || kind === 'bird' ? 'neutral' : 'hostile';
  log({ step: 'evidence', ev, kind, identity });
  const radio = v => c.clickEl(`document.querySelector('.guided input[type=radio][value=${v}]')?.closest('label')`);
  await radio(kind); await sleep(200); await radio(identity); await sleep(300);
  await dockView(); await shot('13-classification'); await record('classify-chosen');
  log({ step: 'confirm', clicked: await c.clickEl(`[...document.querySelectorAll('.guided button')].find(b => b.innerText.includes('Confirm classification') && !b.disabled)`) });
  await sleep(900); await dockView(); await shot('14-response-choices'); await record('respond-step');
  const effs = await c.ev(`[...document.querySelectorAll('.guided .effector-card')].map(b => ({ e: [...b.classList].find(x => x !== 'effector-card'), disabled: b.disabled, text: b.innerText.replace(/\\s+/g, ' ') }))`);
  const usable = e => effs.find(x => x.e === e && !x.disabled);
  const eff = identity !== 'hostile' ? 'hold' : (/Link: Detected/.test(ev) && usable('rf_jam')) ? 'rf_jam' : usable('kinetic') ? 'kinetic' : usable('rf_jam') ? 'rf_jam' : 'hold';
  log({ step: 'effectors', effs, eff });
  await c.clickEl(`document.querySelector('.guided .effector-card.${eff}:not(:disabled)')`);
  await sleep(500); await dockView(); await shot('15a-response-submitted'); await record('response-submitted');
  await sleep(4000); await dockView(); await shot('15-response-feedback'); await record('outcome-step');
  await sceneView(); await shot('15c-scene-after-response'); log({ step: 'after', annotation: await annotation() });
  log({ step: 'end', clicked: await c.clickButton('End exercise') });
  await sleep(150); await top(); await shot('16a-ending');
  await c.waitFor(`/Session saved|Saved on this device|Server verified/.test(document.body.innerText)`, 20000);
  await sleep(800); await top(); await shot('16-completed'); await record('complete', { notice: await c.ev(`[...document.querySelectorAll('[role=status], .notice, .toast')].map(e => e.innerText.trim()).filter(Boolean).join(' | ').slice(0, 300)`) });
  await c.ev(`document.querySelector('#review-replay')?.scrollIntoView({ block: 'start' })`); await sleep(2500);
  if (phone) await scrollTo('#review-replay'); else await c.ev(`(() => { const e = document.querySelector('#review-replay'); window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 70); })()`);
  await sleep(1500); await shot('17-aar-replay'); await record('aar-replay', { footnote: await text('.replay-camera-controls + .footnote') });
  log({ step: 'aar-jump', ok: await c.clickButton('Jump to selected decision') }); await sleep(2000);
  if (phone) await scrollTo('#review-replay'); else await c.ev(`(() => { const e = document.querySelector('#review-replay'); window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 70); })()`);
  for (const p of ['OVERVIEW', 'OBSERVER', 'FOLLOW TARGET']) { const ok = await c.clickButton(p); await sleep(2500); if (phone) await scrollTo('#review-replay'); await shot('17-aar-' + p.split(' ')[0].toLowerCase()); log({ step: 'aar', p, ok, tick: await text('.replay-panel .panel-header .mono'), footnote: await text('.replay-camera-controls + .footnote') }); }
  await finish();
}

if (PLAN === 'library') {
  const lib = arg('lib', ''); const secs = +arg('secs', 50);
  await c.nav(APP + '/'); await sleep(2000);
  await setSelect('Drill', "o => o.value === 'library'"); await sleep(1000);
  log({ lib: await setSelect('Scenario library', `o => o.text.startsWith(${J(lib)})`) }); await sleep(1200);
  await sceneView(); await shot('00-ready'); await record('ready');
  await c.clickButton('Begin exercise');
  await c.ev(FRAME_PROBE);
  await sleep(+arg('wait', 7) * 1000);
  const night = await c.ev(`/NIGHT/.test(document.querySelector('.sensor-workspace .view-annotation.bottom-right')?.innerText ?? '')`);
  await frames('running-idle');
  // Sensor buttons by position: THERMAL, DAY TV, then IR NIGHT DISPLAY (v2) or NIGHT VISION (legacy v1).
  const vis = i => c.clickEl(`document.querySelectorAll('.sensor-workspace .panel-header .segmented button')[${i}]`);
  await vis(1); await sleep(1400);
  await sceneView(); await shot('01-env-dayTV'); await record('env-dayTV', { night, unavailable: await text('.view-unavailable') });
  for (const [i, n] of [[0, '02-env-thermal'], [2, '03-env-irnight']]) { await vis(i); await sleep(1400); await sceneView(); await shot(n); log({ step: 'vision', i, annotation: await annotation() }); }
  const base = night ? 0 : 1;
  await vis(base); await sleep(800);
  const seen = new Set(), got = {}; const t0 = Date.now(); let n = 0;
  while ((Date.now() - t0) / 1000 < secs) {
    const items = await contactIds();
    if (!items.length) { await sleep(1500); continue; }
    for (const it of items) {
      if ((Date.now() - t0) / 1000 > secs) break;
      await clickContact(it.id); await sleep(1000);
      const a = await annotation(), cap = await caption(), shp = await shapeNow();
      log({ step: 'probe', id: it.id, d: it.d, shape: shp, annotation: a, closeup: cap });
      const key = (shp ?? 'x').toLowerCase().replace(/[^a-z]+/g, '-');
      if (a?.includes('TRACKING') && !seen.has(it.id)) { seen.add(it.id); await sceneView(); await shot(`10-trk-${it.id}-${key}`); if (n++ === 0) await record('tracked', { id: it.id }); }
      if (cap && !got[it.id]) {
        got[it.id] = key; const tag = `20-cu-${it.id}-${key}`;
        await sceneView(); await shot(`${tag}-1x`); log({ step: 'closeup', tag, cap });
        await zoom(6); await sleep(1300); await sceneView(); await shot(`${tag}-6x`); log({ step: 'closeup', tag: tag + '-6x', cap: await caption() });
        await vis(night ? 2 : 0); await sleep(1300); await sceneView(); await shot(`${tag}-ir-6x`); log({ step: 'closeup', tag: tag + '-ir-6x', cap: await caption() });
        await vis(base); await zoom(1); await sleep(700);
      }
    }
    await sleep(800);
  }
  log({ step: 'closeups', got, tracked: [...seen] });
  await frames('end');
  log({ step: 'end', clicked: await c.clickButton('End exercise') }); await sleep(3000);
  await finish();
}

if (PLAN === 'aar') {
  // Latest saved exercise in the after-action review; replay presets at several seek points.
  const replayTop = async () => { if (phone) await scrollTo('#review-replay'); else await c.ev(`(() => { const e = document.querySelector('#review-replay'); if (e) window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 64); })()`); await sleep(400); };
  await c.nav(APP + '/?view=aar'); await sleep(3000);
  if (!(await c.ev(`!!document.querySelector('#review-replay')`))) { await c.clickEl(`document.querySelector('.aar-history-list button')`); await sleep(3500); }
  await top(); await shot('16-verdict'); await record('aar-verdict', { title: await text('.page h2') });
  const seek = f => c.ev(`(() => { const s = document.querySelector('.replay-panel input[type=range]'); if (!s) return null; const v = Math.round(+s.min + (+s.max - +s.min) * ${f}); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(s, String(v)); s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); return v; })()`);
  for (const f of (arg('seek', '0,0.3,0.7')).split(',').map(Number)) {
    log({ step: 'seek', f, v: await seek(f) }); await sleep(1500);
    for (const p of ['OVERVIEW', 'OBSERVER']) { const ok = await c.clickButton(p); await sleep(2200); await replayTop(); await shot(`17-aar-${p.toLowerCase()}-${f}`); log({ step: 'aar', f, p, ok, tick: await text('.replay-panel .panel-header .mono'), footnote: await text('.replay-camera-controls + .footnote') }); }
  }
  log({ step: 'aar-jump', ok: await c.clickButton('Jump to selected decision') }); await sleep(2000);
  for (const p of ['OVERVIEW', 'OBSERVER', 'FOLLOW TARGET']) { const ok = await c.clickButton(p); await sleep(2500); await replayTop(); await shot('17-aar-jump-' + p.split(' ')[0].toLowerCase()); log({ step: 'aar', p, ok, tick: await text('.replay-panel .panel-header .mono'), footnote: await text('.replay-camera-controls + .footnote') }); }
  await finish();
}

if (PLAN === 'focusscan') {
  // Phone: walk focus backwards through a running drill; flag controls whose centre ends under the sticky header.
  await c.nav(APP + '/'); await sleep(2000);
  await setSelect('Drill', "o => o.value === 'library'"); await sleep(1000);
  await setSelect('Scenario library', `o => o.text.startsWith(${J(arg('lib', 'Rural forward base day'))})`); await sleep(1000);
  await c.clickButton('Begin exercise'); await sleep(6000);
  // Start point only (programmatic): the evidence aside at the bottom of the drill page.
  await c.ev(`document.querySelector('.decision-evidence')?.focus()`); await sleep(300);
  const seen = []; let obscured = [];
  for (let i = 0; i < 160; i++) {
    await c.key('Tab', 8); await sleep(70);
    const a = await c.ev(`(() => { const e = document.activeElement; if (!e || e === document.body) return null; const h = document.querySelector('header'); const hb = h && /sticky|fixed/.test(getComputedStyle(h).position) ? h.getBoundingClientRect().bottom : 0; const r = e.getBoundingClientRect(); const cy = r.top + r.height / 2; const top = document.elementFromPoint(r.left + r.width / 2, Math.max(0, cy)); return { name: (e.getAttribute('aria-label') || e.innerText || e.value || e.tagName).replace(/\\s+/g, ' ').trim().slice(0, 50), inHeader: !!e.closest('header'), top: Math.round(r.top), bottom: Math.round(r.bottom), hb: Math.round(hb), hidden: !e.closest('header') && !e.classList.contains('skip-link') && cy < hb, coveredBy: top && !e.contains(top) && !top.contains(e) ? (top.closest('header') ? 'header' : top.tagName) : null }; })()`);
    if (!a) continue; seen.push(a); if (a.hidden || a.coveredBy === 'header') { obscured.push(a); if (obscured.length <= 3 || a.name === 'End exercise') await shot(`f-obscured-${obscured.length}-${a.name.replace(/[^a-z0-9]+/gi, '-').slice(0, 30)}`); }
    if (a.name.startsWith('Skip to') || seen.length > 150) break;
  }
  log({ step: 'focusscan', visited: seen.length, obscuredCount: obscured.length, obscured: obscured.slice(0, 20) });
  await c.ev(`document.activeElement?.blur()`); await c.clickButton('End exercise'); await sleep(3000);
  await finish();
}

if (PLAN === 'world') {
  const setSel = (label, value) => c.ev(`(() => { const s = document.querySelector('select[aria-label=${J(label)}]') || [...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === 'tactical') && ${J(label)} === 'tier') || [...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === '200') && ${J(label)} === 'count'); if (!s) return false; const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, ${J(value)}); s.dispatchEvent(new Event('change', { bubbles: true })); return s.value; })()`);
  for (const combo of arg('combos', 'urban_outpost:day:day:trainee:25').split(',')) {
    const [world, time, vision, camera, count = '25', wait = '6', tier = 'medium'] = combo.split(':');
    await c.nav(APP + '/system/benchmark'); await sleep(1200);
    const set = { engine: await setSel('Simulation engine', 'finale'), world: await setSel('Benchmark world', `${world}:${time}`), view: await setSel('Benchmark view', vision), camera: await setSel('Benchmark camera', camera), count: await setSel('count', count), tier: await setSel('tier', tier) };
    await sleep(500);
    if (!phone) await c.ev(`(() => { const e = document.querySelector('.scene-container'); if (e) e.style.height = '560px'; })()`);
    await c.clickButton('Run ');
    await sleep(+wait * 1000);
    await c.ev(`document.querySelector('.scene-container')?.scrollIntoView({ block: 'center' })`); await sleep(400);
    const name = combo.replaceAll(':', '-');
    await shot(name);
    log({ step: 'world', combo, set, info: await c.ev(`document.querySelector('main p:nth-of-type(2)')?.innerText ?? ''`) });
  }
  await finish();
}

if (PLAN === 'keyboard') {
  // Keyboard only after the page has loaded: Tab / Shift+Tab / Enter / Space / arrows.
  const active = () => c.ev(`(() => { const e = document.activeElement; if (!e || e === document.body) return { tag: 'body' }; const s = getComputedStyle(e); const lab = e.closest('label'); const ring = (el) => { const cs = getComputedStyle(el); return { outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 ? cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor : null, shadow: cs.boxShadow !== 'none' ? cs.boxShadow.slice(0, 80) : null }; }; const r = e.getBoundingClientRect(); return { tag: e.tagName.toLowerCase(), role: e.getAttribute('role'), type: e.type, name: (e.getAttribute('aria-label') || e.innerText || e.value || '').replace(/\\s+/g, ' ').trim().slice(0, 60), cls: typeof e.className === 'string' ? e.className.slice(0, 50) : (e.className?.baseVal ?? ''), focusVisible: e.matches(':focus-visible'), ring: ring(e), labelRing: lab ? ring(lab) : null, inView: r.bottom > 0 && r.top < innerHeight, rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] }; })()`);
  const tabUntil = async (pred, max = 120, shift = false, label = '') => {
    for (let i = 1; i <= max; i++) { await c.key('Tab', shift ? 8 : 0); await sleep(60); const a = await active(); if (await c.ev(`(() => { const e = document.activeElement; return !!(${pred})(e); })()`)) { log({ step: 'tab', label, presses: i, shift, active: a }); return a; } }
    log({ step: 'tab', label, presses: max, shift, found: false, active: await active() }); return null;
  };
  const press = async (k, label) => { await c.key(k); await sleep(250); log({ step: 'key', key: k, label, active: await active() }); };
  await c.nav(APP + '/'); await sleep(2000);
  // Drill picker: keyboard on the <select> (arrow keys change a closed select on Linux).
  await tabUntil(`e => e.matches('select[aria-label="Drill"]')`, 60, false, 'drill select');
  log({ step: 'drill-select', value: await c.ev(`document.querySelector('select[aria-label="Drill"]').value`) });
  for (let i = 0; i < 3 && (await c.ev(`document.querySelector('select[aria-label="Drill"]').value`)) !== 'adaptive'; i++) { await c.key('ArrowDown'); await sleep(300); }
  log({ step: 'drill-select', value: await c.ev(`document.querySelector('select[aria-label="Drill"]').value`) });
  await tabUntil(`e => e.tagName === 'BUTTON' && e.innerText.trim().startsWith('Prepare adaptive drill')`, 60, false, 'prepare');
  await press('Enter', 'prepare');
  await c.waitFor(`!!(${button('Start adaptive drill')})`, 30000); await sleep(500);
  log({ step: 'after-prepare', active: await active() });
  let a = await tabUntil(`e => e.tagName === 'BUTTON' && e.innerText.trim().startsWith('Start adaptive drill')`, 80, false, 'start');
  if (!a) a = await tabUntil(`e => e.tagName === 'BUTTON' && e.innerText.trim().startsWith('Start adaptive drill')`, 80, true, 'start (shift)');
  await press('Enter', 'start');
  await sleep(9000);
  log({ step: 'after-start', active: await active() });
  // Select a contact from the track list with the keyboard.
  a = await tabUntil(`e => e.classList.contains('contact-item') && !e.classList.contains('stale')`, 120, false, 'contact item');
  if (!a) a = await tabUntil(`e => e.classList.contains('contact-item') && !e.classList.contains('stale')`, 120, true, 'contact item (shift)');
  await shot('k01-focus-contact');
  await press('Enter', 'select contact');
  log({ step: 'selected', guided: await text('.guided-steps'), target: await text('.guided-target') });
  // Radar contacts are SVG role=button; check they are reachable as well (Shift+Tab back).
  const radarReach = await tabUntil(`e => e.getAttribute && e.getAttribute('role') === 'button' && e.closest('svg')`, 40, true, 'radar contact (shift)');
  if (radarReach) await shot('k01b-focus-radar');
  a = await tabUntil(`e => e.tagName === 'BUTTON' && e.innerText.trim().startsWith('Designate')`, 150, false, 'designate');
  await shot('k02-focus-designate');
  await press('Enter', 'designate'); await sleep(800);
  log({ step: 'after-designate', active: await active(), steps: await text('.guided-steps'), status: await text('.guided-status') });
  a = await tabUntil(`e => e.type === 'radio' && e.closest('.guided')`, 60, false, 'type radio');
  if (!a) a = await tabUntil(`e => e.type === 'radio' && e.closest('.guided')`, 60, true, 'type radio (shift)');
  await press('Space', 'check first type');
  await press('ArrowRight', 'type next'); await press('ArrowRight', 'type next'); await press('ArrowLeft', 'type back');
  await shot('k03-focus-type-radio');
  await tabUntil(`e => e.type === 'radio' && e.closest('.guided') && e.value === 'hostile' || (e.type === 'radio' && ['friendly','neutral'].includes(e.value))`, 10, false, 'identity radio');
  await press('Space', 'check identity');
  log({ step: 'chosen', checked: await c.ev(`[...document.querySelectorAll('.guided input[type=radio]:checked')].map(i => i.value)`) });
  a = await tabUntil(`e => e.tagName === 'BUTTON' && e.innerText.includes('Confirm classification')`, 10, false, 'confirm');
  await shot('k04-focus-confirm');
  await press('Enter', 'confirm'); await sleep(900);
  log({ step: 'after-confirm', active: await active(), steps: await text('.guided-steps'), status: await text('.guided-status') });
  a = await tabUntil(`e => e.classList.contains('effector-card') && !e.disabled`, 60, false, 'effector');
  if (!a) a = await tabUntil(`e => e.classList.contains('effector-card') && !e.disabled`, 60, true, 'effector (shift)');
  if (a?.cls?.includes('hold')) { await c.key('Tab'); await sleep(80); const b = await active(); log({ step: 'tab', label: 'next effector', active: b }); if (!b.cls?.includes('effector-card')) { await c.key('Tab', 8); await sleep(80); } }
  log({ step: 'effector-focused', active: await active() });
  await shot('k05-focus-effector');
  await press('Enter', 'respond'); await sleep(3500);
  log({ step: 'after-respond', active: await active(), steps: await text('.guided-steps'), status: await text('.guided-status'), body: await text('.guided-body') });
  await shot('k06-outcome');
  a = await tabUntil(`e => e.tagName === 'BUTTON' && e.innerText.trim() === 'End exercise'`, 150, true, 'end exercise (shift)');
  await shot('k07-focus-end');
  await press('Enter', 'end'); await sleep(3000);
  log({ step: 'after-end', heading: await c.ev(`document.querySelector('h1')?.innerText`), active: await active() });
  await finish();
}
