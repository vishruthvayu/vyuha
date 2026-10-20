// Attach to the already-running isolated benchmark; no new scene/GPU workload.
// CDP=<isolated browser> node observe-stability.mjs <out.json> [seconds]
import { writeFileSync } from 'node:fs';
import { connect, sleep } from './lib.mjs';
const [out, seconds = '180'] = process.argv.slice(2);
const c = await connect(process.env.CDP, '/system/benchmark');
const installedAt = new Date().toISOString();
let data;
try {
  await c.ev(`(() => {
    const start=performance.now();let last=0;
    const d=window.__stability={frames:0,maxFrameMs:0,gaps:[],longtasks:[]};
    const frame=t=>{if(last&&t-start>3000){const dt=t-last;d.frames++;d.maxFrameMs=Math.max(d.maxFrameMs,dt);if(dt>50)d.gaps.push({elapsedMs:t-start,frameMs:dt,wallTime:Date.now()})}last=t;if(t-start<${+seconds}*1000)requestAnimationFrame(frame)};
    requestAnimationFrame(frame);
    new PerformanceObserver(list=>{for(const e of list.getEntries())if(e.startTime-start>3000)d.longtasks.push({elapsedMs:e.startTime-start,durationMs:e.duration})}).observe({type:'longtask',buffered:false});
  })()`);
  for (let t=0;t<+seconds;t+=5) {
    await sleep(5000);
    let timer;
    try { data=await Promise.race([c.ev('window.__stability'),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Target closed or unresponsive')),2000)})]); }
    catch { break; }
    finally { clearTimeout(timer); }
  }
} finally {
  c.close();
  writeFileSync(out,JSON.stringify({source:'5d40a24165dff5ace27c6131318da599ad828b0d',installedAt,scope:'Partial long-run diagnostic attached after measurement start; rAF gaps and browser longtask entries; no physical display or root-cause proof.',data},null,2)+'\n');
}
