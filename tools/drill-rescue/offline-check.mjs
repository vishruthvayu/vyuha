// Isolated browser offline shell/asset check, not physical WAN-off acceptance.
// CDP=<isolated browser> node offline-check.mjs <app> <out-dir>
import { mkdirSync, writeFileSync } from 'node:fs';
import { newTab, sleep } from './drill.mjs';
const [app, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const c = await newTab(1440, 900);
try {
  await c.send('Network.enable');
  await c.nav(app + '/system/benchmark');
  const installed = await c.ev(`(async()=>{const reg=await navigator.serviceWorker.ready;await reg.update();return {scope:reg.scope,active:reg.active?.state}})()`);
  await sleep(1500);
  const assets = await c.ev(`(async()=>{
    const source=await (await fetch('/sw.js',{cache:'no-store'})).text();
    const name=source.split("const CACHE='")[1].split("'")[0];
    const urls=JSON.parse(source.split('const ASSETS=')[1].split(';')[0]);
    const cache=await caches.open(name);const missing=[];
    for(const url of urls)if(!await cache.match(url))missing.push(url);
    return {cache:name,expected:urls.length,missing};
  })()`);
  if (assets.missing.length) throw Error('Missing cached assets: '+assets.missing.join(', '));
  await c.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await c.nav(app + '/system/benchmark');
  const ready = await c.waitFor(`!!document.querySelector('.scene-container canvas')`, 15000);
  const title = await c.ev(`document.title`);
  if (!ready) throw Error('Offline renderer shell failed');
  await c.snap(out+'/offline-shell.png');
  writeFileSync(out+'/receipt.json', JSON.stringify({ installed, assets, offlineReload: ready, title, scope: 'Cached application shell and renderer assets in CDP offline mode; backend-dependent workflows and physical WAN-off not certified.' }, null, 2)+'\n');
} finally {
  await c.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }).catch(()=>{});
  await c.closeTab();
}
