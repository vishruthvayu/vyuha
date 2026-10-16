// Test harness (outside the repository under test): small DevTools-protocol
// client used by the rc.2 retest scripts. Input goes through Chrome's own
// input pipeline (Input.dispatchMouseEvent / dispatchKeyEvent), i.e. the page
// receives genuine trusted pointer and keyboard events.
import { writeFileSync, appendFileSync } from 'node:fs';

export const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function connect(port, match) {
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const pages = list.filter(t => t.type === 'page');
  const t = match ? (match.startsWith('id:') ? pages.find(p => p.id.startsWith(match.slice(3))) : pages.find(p => p.url.includes(match))) : pages[0];
  if (!t) throw new Error(`no page target on ${port}` + (match ? ` matching ${match}` : ''));
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', () => rej(new Error('ws error'))); });
  let seq = 0; const pending = new Map(); const listeners = [];
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id) { const p = pending.get(m.id); if (p) { pending.delete(m.id); m.error ? p.reject(new Error(m.error.message + ' ' + (m.error.data ?? ''))) : p.resolve(m.result); } }
    else for (const l of [...listeners]) l(m);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
  const on = fn => { listeners.push(fn); return () => listeners.splice(listeners.indexOf(fn), 1); };
  const once = (method, timeout = 20000) => new Promise((resolve, reject) => { const off = on(m => { if (m.method === method) { off(); clearTimeout(t); resolve(m.params); } }); const t = setTimeout(() => { off(); reject(new Error('timeout ' + method)); }, timeout); });
  const ev = async expression => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true }); if (r.exceptionDetails) throw new Error('JS: ' + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)); return r.result.value; };
  const move = async (x, y) => { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); };
  const click = async (x, y) => { await move(x, y); await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }); };
  const KEYS = { Enter: [13, 'Enter', '\r'], Escape: [27, 'Escape'], Tab: [9, 'Tab'], Space: [32, 'Space', ' '], Backspace: [8, 'Backspace'], ArrowUp: [38, 'ArrowUp'], ArrowDown: [40, 'ArrowDown'], ArrowLeft: [37, 'ArrowLeft'], ArrowRight: [39, 'ArrowRight'], Home: [36, 'Home'], End: [35, 'End'] };
  const key = async (name, modifiers = 0) => {
    let [vk, code, text] = KEYS[name] ?? [name.toUpperCase().charCodeAt(0), /[a-z]/i.test(name) ? 'Key' + name.toUpperCase() : /\d/.test(name) ? 'Digit' + name : '', name];
    const k = name === 'Space' ? ' ' : name;
    if (modifiers) text = undefined;
    await send('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers, ...(text ? { text } : {}) });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers });
  };
  const type = text => send('Input.insertText', { text });
  const shot = async (file, clip) => { const r = await send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { ...clip, scale: 1 } } : {}) }); writeFileSync(file, Buffer.from(r.data, 'base64')); return file; };
  const nav = async url => { const loaded = once('Page.loadEventFired', 30000).catch(() => null); await send('Page.navigate', { url }); await loaded; await sleep(700); };
  const reload = async () => { const loaded = once('Page.loadEventFired', 30000).catch(() => null); await send('Page.reload'); await loaded; await sleep(700); };
  await send('Page.enable');
  return { send, ev, on, once, move, click, key, type, shot, nav, reload, ws, close: () => ws.close() };
}

export function tracer(file) {
  const t0 = Date.now();
  return o => { const row = { t: new Date().toISOString(), wall_s: +((Date.now() - t0) / 1000).toFixed(2), ...o }; if (file) appendFileSync(file, JSON.stringify(row) + '\n'); console.log(JSON.stringify(row).slice(0, 900)); return row; };
}

// WCAG 2.x relative luminance / contrast ratio, evaluated inside the page.
export const CONTRAST_FN = `
const __lum = c => { const [r, g, b] = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const __rgba = s => { const m = s.match(/rgba?\\(([^)]+)\\)/); if (!m) return [0, 0, 0, 0]; const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
const __over = (fg, bg) => [0, 1, 2].map(i => fg[i] * fg[3] + bg[i] * (1 - fg[3]));
const __bgOf = el => { let stack = []; for (let n = el; n; n = n.parentElement) { const c = __rgba(getComputedStyle(n).backgroundColor); if (c[3] > 0) { stack.push(c); if (c[3] >= 1) break; } } let out = [255, 255, 255]; for (const c of stack.reverse()) out = __over(c, out); return out; };
const __mix = (a, b, t) => a.map((v, i) => v * t + b[i] * (1 - t));
// An element drawn with opacity < 1 is blended, text and background alike, with whatever lies behind it.
const __contrast = el => { const cs = getComputedStyle(el); let bg = __bgOf(el); const fgc = __rgba(cs.color); const op = isNaN(+cs.opacity) ? 1 : +cs.opacity; let fg = __over(fgc, bg); if (op < 1) { const behind = __bgOf(el.parentElement || el); fg = __mix(fg, behind, op); bg = __mix(bg, behind, op); } const a = __lum(fg), b = __lum(bg); return { ratio: +((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2), color: cs.color, background: 'rgb(' + bg.map(Math.round).join(', ') + ')', opacity: cs.opacity }; };
`;
