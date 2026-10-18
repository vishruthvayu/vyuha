// Browser layout regression for wrapped last-report rows in a constrained roster.
// Uses clearly labelled synthetic DOM rows; does not modify application state.
// CDP=<isolated browser> node contact-layout.mjs <app> <out-dir>
import { mkdirSync, writeFileSync } from 'node:fs';
import { newTab, sleep } from './drill.mjs';
const [app, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const c = await newTab(1440, 900);
const checks = [];
try {
  await c.nav(app + '/');
  await c.clickButton('Prepare adaptive drill');
  if (!await c.waitFor(`!!(${c.button('Start adaptive drill')})`, 30000)) throw Error('Preparation failed');
  await c.clickButton('Start adaptive drill');
  await sleep(6000);
  await c.ev(`(() => {
    const list = document.querySelector('.contact-list');
    const row = list?.querySelector('.contact-item');
    if (!row) throw Error('No contact row');
    const fixture = list.cloneNode(false);
    fixture.dataset.fixture = 'wrapped-last-report';
    for (let i=0; i<8; i++) {
      const item = row.cloneNode(true); item.classList.add('stale');
      item.querySelector('strong').textContent = 'T'+i+' · SYNTHETIC LAYOUT CHECK';
      item.querySelector('small').textContent = 'Last reported 286 m · No current observation · T+25.5s';
      fixture.append(item);
    }
    list.replaceWith(fixture);
  })()`);
  for (const width of [360, 390, 428, 768, 1024, 1280, 1440, 1920]) {
    await c.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 700 });
    await sleep(150);
    await c.ev(`document.querySelector('[data-fixture]')?.scrollIntoView({block:'center'})`);
    const result = await c.ev(`(() => {
      const rows = [...document.querySelectorAll('[data-fixture] .contact-item')];
      const overflowing = rows.filter(row => { const r=row.getBoundingClientRect();return [...row.querySelectorAll('*')].some(e=>{const q=e.getBoundingClientRect();return q.height>0&&(q.bottom>r.bottom+1||q.right>r.right+1)}) });
      return { rows: rows.length, overflowing: overflowing.length, documentOverflow: Math.max(0, document.documentElement.scrollWidth-document.documentElement.clientWidth) };
    })()`);
    checks.push({ width, ...result });
    if (result.rows !== 8 || result.overflowing || result.documentOverflow) throw Error(JSON.stringify(checks.at(-1)));
    if (width === 390 || width === 1440) await c.snap(out+'/synthetic-rows-'+width+'.png');
  }
  writeFileSync(out+'/receipt.json', JSON.stringify({ fixture: 'synthetic layout only', checks }, null, 2)+'\n');
  await c.clickButton('End exercise');
} finally { await c.closeTab(); }
