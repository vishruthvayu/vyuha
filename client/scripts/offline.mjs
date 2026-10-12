import {readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {Script} from 'node:vm';
async function files(path){let result=[];for(const entry of await readdir(path,{withFileTypes:true})){const name=join(path,entry.name);if(entry.isDirectory())result.push(...await files(name));else result.push(name);}return result;}
const list=(await files('dist')).filter(f=>!f.endsWith('sw.js'));const urls=['/',...list.map(f=>'/'+f.replace(/^dist\//,''))];
const version=createHash('sha256').update(await readFile('dist/index.html')).digest('hex').slice(0,12);
const workerSource=`const CACHE='vyuha-${version}';const ASSETS=${JSON.stringify(urls)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS.map(url=>new Request(url,{cache:'reload'})))).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(url.origin!==location.origin||event.request.method!=='GET'||url.pathname.startsWith('/api/'))return;
// Online navigation always sees the deployed entry. Do not overwrite installed
// HTML: its precached hashed assets must remain coherent until a new install completes.
if(event.request.mode==='navigate'){event.respondWith(fetch(new Request(event.request,{cache:'no-store'})).catch(()=>caches.open(CACHE).then(cache=>cache.match('/index.html'))));return;}
event.respondWith(caches.open(CACHE).then(cache=>cache.match(url.pathname,{ignoreSearch:true,ignoreVary:true})).then(async cached=>cached||await caches.match(event.request)||fetch(event.request)));});`;
new Script(workerSource); // Fail the build if the emitted service worker cannot parse.
await writeFile('dist/sw.js',workerSource);
console.log(`Offline cache: ${urls.length} local assets (${version})`);
