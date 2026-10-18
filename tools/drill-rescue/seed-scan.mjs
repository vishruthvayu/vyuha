import { newTab, sleep } from './drill.mjs';
const APP = process.argv[2];
const c = await newTab();
await c.nav(APP + '/?mode=adaptive'); await sleep(2000);
for (let i = 0; i < 12; i++) {
  await c.clickButton('New seed'); await sleep(400);
  await c.clickButton('Prepare adaptive drill');
  await c.waitFor(`!!(${c.button('Start adaptive drill')})`, 30000);
  const sub = await c.ev(`[...document.querySelectorAll('small, p, span')].map(e=>e.innerText).find(t=>/Urban outpost|Rural forward base/.test(t))`);
  const seed = await c.ev(`document.querySelector('main').innerText.match(/SEED\\s*(\\d+)/i)?.[1]`);
  console.log(i, seed, sub);
}
await c.closeTab();
