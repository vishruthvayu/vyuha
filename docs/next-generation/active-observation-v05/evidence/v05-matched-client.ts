import { readFileSync,writeFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import { Simulation as Baseline } from '/private/tmp/vyuha-v05-baseline.ts';
import { Simulation as Optimized } from '/Users/seemalanaveenyadav/Desktop/SIH/vyuha/work/finale/ultimate-experience/browser-vr-unified/client/src/sim-v3.ts';
const input=JSON.parse(readFileSync('/private/tmp/vyuha-v05-matched-performance.json','utf8'));
const results=[];
for(const fixture of input.results){
 const raw:{baseline:number[];optimized:number[]}={baseline:[],optimized:[]};
 let expected:any;
 for(let r=0;r<5;r++){
  for(const [label,Engine] of (r%2===0?[['baseline',Baseline],['optimized',Optimized]]:[['optimized',Optimized],['baseline',Baseline]]) as [keyof typeof raw,typeof Baseline][]){
   const t=performance.now();const s=new Engine(structuredClone(fixture.scenario));
   while(s.state.tick<fixture.scenario.duration*30)s.step(true);
   raw[label].push(performance.now()-t);
   const state=s.snapshot();if(!expected)expected=state;assert.deepEqual(state,expected);
  }
 }
 const median=(a:number[])=>[...a].sort((x,y)=>x-y)[Math.floor(a.length/2)];
 const summary=Object.fromEntries(Object.entries(raw).map(([k,v])=>[k,{median_ms:median(v),range_ms:[Math.min(...v),Math.max(...v)]}]));
 results.push({contacts:fixture.contacts,scenario_sha256:fixture.scenario_sha256,raw,summary});console.log(fixture.contacts,summary);
}
writeFileSync('/private/tmp/vyuha-v05-matched-client.json',JSON.stringify({baseline_commit:input.baseline_commit,method:'Native Node/TypeScript simulation stepping, same frozen scenarios as Python matched run; alternating 5 pairs, identical final snapshots. This does not measure browser frame pacing or GPU time.',results},null,2));
