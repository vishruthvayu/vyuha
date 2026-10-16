// Shared drill helpers for the drill-rescue harness (outside the repository).
import { connect, sleep } from './lib.mjs';
export { sleep };
export async function newTab(w = 1440, h = 900) {
  const r = await (await fetch(`http://127.0.0.1:${process.env.CDP}/json/new?about:blank`, { method: 'PUT' })).json();
  const c = await connect(process.env.CDP, 'id:' + r.id);
  c.id = r.id;
  await c.send('Page.bringToFront');
  await c.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 700 });
  c.closeTab = async () => { c.close(); await fetch(`http://127.0.0.1:${process.env.CDP}/json/close/${r.id}`); };
  c.center = async sel => c.ev(`(() => { const e = ${sel}; if (!e) return null; e.scrollIntoView({block:'nearest'}); const r = e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
  c.clickEl = async sel => { const p = await c.center(sel); if (!p) return false; await c.click(p.x, p.y); return true; };
  c.button = text => `[...document.querySelectorAll('button')].filter(b => b.innerText.trim().startsWith(${JSON.stringify(text)}) && !b.disabled && b.offsetParent).pop()`;
  c.clickButton = async text => c.clickEl(c.button(text));
  c.waitFor = async (expr, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await c.ev(expr)) return true; await sleep(250); } return false; };
  c.snap = async file => { await c.send('Page.bringToFront'); return c.shot(file); };
  return c;
}
// Frame-interval recorder injected into the page: rAF deltas, not GPU time.
export const FRAME_PROBE = `(() => { if (window.__fp) return 'present'; const fp = window.__fp = { d: [], last: 0, on: true }; const f = t => { if (fp.last) fp.d.push(t - fp.last); fp.last = t; if (fp.on) requestAnimationFrame(f); }; requestAnimationFrame(f); return 'installed'; })()`;
export const FRAME_READ = `(() => { const d = window.__fp.d.splice(0); const s = [...d].sort((a,b)=>a-b), n = s.length; if (!n) return null; const q = p => s[Math.min(n-1, Math.floor(p*n))]; const mean = d.reduce((a,b)=>a+b,0)/n; const low = s.slice(Math.floor(n*0.99)); return { frames: n, fpsMean: +(1000/mean).toFixed(1), medianMs: +q(0.5).toFixed(2), p95Ms: +q(0.95).toFixed(2), p99Ms: +q(0.99).toFixed(2), maxMs: +s[n-1].toFixed(2), onePctLowFps: +(1000/(low.reduce((a,b)=>a+b,0)/low.length)).toFixed(1), over33: d.filter(x=>x>33.4).length, over50: d.filter(x=>x>50).length }; })()`;
