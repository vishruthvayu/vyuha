import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {transpileModule,ModuleKind} from 'typescript';
import {Simulation,replay} from './sim';
import {FixedStepClock} from './clock';
import {makeScenario} from './scenario';
import type {Snapshot} from './types';
type Reply={type:string;scope?:string;tick_ms?:number[];tick?:number;state?:Snapshot};
function fixture(){
 let now=0,interval=()=>{};const messages:Reply[]=[];
 const context={onmessage:null as unknown as (e:{data:object})=>void,performance:{now:()=>now},postMessage:(m:Reply)=>messages.push(m),setInterval:(callback:()=>void)=>{interval=callback;return 1;},clearInterval:()=>{},exports:{},require:(path:string)=>path==='./sim'?{Simulation,replay}:path==='./clock'?{FixedStepClock}:undefined};
 runInNewContext(transpileModule(readFileSync(new URL('./sim.worker.ts',import.meta.url),'utf8'),{compilerOptions:{module:ModuleKind.CommonJS}}).outputText,context);
 return {messages,send:(data:object)=>context.onmessage({data}),advance:(n:number)=>{for(let i=0;i<n;i++){now+=34;interval();}}};
}
test('benchmark pause flushes a partial timing batch before its owned stop acknowledgment',()=>{
 const f=fixture();f.send({type:'init',scope:'run-A',benchmark:true,scenario:makeScenario(7)});f.send({type:'play',scope:'run-A'});f.advance(7);
 assert.equal(f.messages.filter(m=>m.type==='benchmark').length,0);
 f.send({type:'pause',scope:'run-A'});
 const stop=f.messages.at(-1)!;assert.equal(stop.type,'benchmark-stopped');assert.equal(stop.scope,'run-A');
 const timings=f.messages.filter(m=>m.type==='benchmark').flatMap(m=>m.tick_ms!);
 assert.equal(timings.length,stop.tick);assert.ok(timings.length>0&&timings.length<30);
 f.send({type:'pause',scope:'run-A'});assert.equal(f.messages.filter(m=>m.type==='benchmark').flatMap(m=>m.tick_ms!).length,timings.length);
});
test('repeated benchmark initialization rejects old stop intents and accounts for every delivered step',()=>{
 const f=fixture();f.send({type:'init',scope:'old',benchmark:true,scenario:makeScenario(7)});f.send({type:'play',scope:'old'});f.advance(35);f.send({type:'pause',scope:'old'});
 const oldStop=f.messages.at(-1)!;assert.equal(f.messages.filter(m=>m.type==='benchmark'&&m.scope==='old').flatMap(m=>m.tick_ms!).length,oldStop.tick);
 f.send({type:'init',scope:'new',benchmark:true,scenario:makeScenario(7)});f.send({type:'play',scope:'new'});f.advance(4);
 const count=f.messages.length;f.send({type:'pause',scope:'old'});assert.equal(f.messages.length,count);
 f.send({type:'pause',scope:'new'});const stop=f.messages.at(-1)!;assert.equal(stop.scope,'new');assert.equal(f.messages.filter(m=>m.type==='benchmark'&&m.scope==='new').flatMap(m=>m.tick_ms!).length,stop.tick);
});
test('ordinary training never emits benchmark timing or stop messages',()=>{
 const f=fixture();f.send({type:'init',scope:'training',scenario:makeScenario(7)});f.send({type:'play',scope:'training'});f.advance(7);f.send({type:'pause',scope:'training'});f.send({type:'finish',scope:'training'});
 assert.equal(f.messages.some(m=>m.type.startsWith('benchmark')),false);assert.equal(f.messages.at(-1)!.type,'finalized');
});
