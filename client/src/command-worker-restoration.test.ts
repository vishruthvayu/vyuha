import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {transpileModule,ModuleKind} from 'typescript';
import {Simulation,replay} from './sim';
import {FixedStepClock} from './clock';
import {makeScenario} from './scenario';
import {reportedContacts} from './observed-contacts';
import type {Action,AppliedCommand,Scenario,Snapshot} from './types';

type WorkerReply = {type:string;request_id?:number;reason?:string;scope?:string;scenario_id?:string;initialized?:boolean;state?:Snapshot;events?:Action[];commands?:AppliedCommand[];action?:Action};
function workerFixture() {
 const messages:WorkerReply[]=[];
 const context={
  onmessage:null as unknown as (event:{data:object})=>void,
  performance:{now:()=>0}, postMessage:(message:WorkerReply)=>messages.push(message),
  setInterval:()=>1,clearInterval:()=>{},exports:{},
  require:(path:string)=>path==='./sim'?{Simulation,replay}:path==='./clock'?{FixedStepClock}:undefined,
 };
 const source=readFileSync(new URL('./sim.worker.ts',import.meta.url),'utf8');
 runInNewContext(transpileModule(source,{compilerOptions:{module:ModuleKind.CommonJS}}).outputText,context);
 return {messages,send:(data:object)=>context.onmessage({data})};
}
const scenario=JSON.parse(readFileSync(new URL('./command-restoration-scenario.json',import.meta.url),'utf8')) as Scenario;
const command:AppliedCommand={command_id:'environment',session_id:'RESTORED',seq:1,issued_at:'2026-10-14T00:00:00Z',type:'environment',payload:{night:false},tick:30,order:0};
const observed=reportedContacts(replay(scenario,[],90,[command]).snapshot()).find(track=>track.detected!==null)!;
const action:Action={k:'designate',track:observed.id,tick:90,order:1};

test('worker restoration publishes owned initialization with exact frozen tick/actions/commands and rejects stale intents',()=>{
 const {messages,send}=workerFixture();
 const expected=replay(scenario,[action],990,[command]);
 send({type:'init',scope:'old-run',scenario:makeScenario(7)});
 send({type:'init',scope:'restore-run',scenario,events:[action],commands:[command],tick:990});
 const initialized=messages.at(-1)!;
 assert.equal(initialized.type,'snapshot');assert.equal(initialized.initialized,true);
 assert.equal(initialized.scope,'restore-run');assert.equal(initialized.scenario_id,scenario.id);
 assert.deepEqual(initialized.state,expected.snapshot());
 const count=messages.length;
 for(const type of ['play','pause','finish','control','action'])send({type,scope:'old-run',command,action});
 send({type:'finish'});
 assert.equal(messages.length,count,'Stale and unscoped training messages cannot affect restored execution');
 send({type:'play',scope:'restore-run'});
 assert.equal(messages.at(-1)!.initialized,false);
 send({type:'finish',scope:'restore-run'});
 const final=messages.at(-1)!;
 assert.equal(final.type,'finalized');assert.equal(final.scope,'restore-run');assert.equal(final.scenario_id,scenario.id);
 assert.deepEqual(final.events,[action]);assert.deepEqual(final.commands,[command]);
});

test('all accepted/control/finalized worker replies retain ownership while Benchmark supports the original unscoped protocol',()=>{
 const {messages,send}=workerFixture();
 send({type:'init',scope:'training',scenario,events:[],tick:990});
 send({type:'play',scope:'training'});
 const snapshot=messages.at(-1)!.state!;
 const current=reportedContacts(snapshot).find(track=>track.detected!==null&&!track.designated)!;
 assert.ok(current);
 send({type:'action',scope:'training',action:{k:'designate',track:current.id,tick:0}});
 assert.ok(messages.some(m=>m.type==='accepted'&&m.scope==='training'&&m.scenario_id===scenario.id));
 send({type:'control',scope:'training',command:{...command,command_id:'new',seq:1,type:'sensor_fault',payload:{sensor:'radar',mode:'failed'}}});
 assert.ok(messages.some(m=>m.type==='controlled'&&m.scope==='training'&&m.scenario_id===scenario.id));
 send({type:'init',scenario:makeScenario(7),benchmark:true});send({type:'play'});send({type:'finish'});
 assert.equal(messages.at(-1)!.type,'finalized');assert.equal(messages.at(-1)!.scope,undefined);
});

test('restoring an already-ended saved horizon finalizes once with its original evidence rather than remaining running',()=>{
 const {messages,send}=workerFixture();
 send({type:'init',scope:'ended-recovery',scenario,events:[action],commands:[command],tick:scenario.duration*30});
 assert.equal(messages.at(-1)!.state!.done,true);
 send({type:'play',scope:'ended-recovery'});
 const final=messages.at(-1)!;assert.equal(final.type,'finalized');assert.deepEqual(final.events,[action]);assert.deepEqual(final.commands,[command]);
 send({type:'play',scope:'ended-recovery'});send({type:'finish',scope:'ended-recovery'});
 assert.equal(messages.filter(message=>message.type==='finalized').length,1);
});

test('worker receipts correlate rapid decisions and reject paused/ended intents without changing authoritative evidence',()=>{
 const {messages,send}=workerFixture();
 const replies=()=>messages.filter(m=>m.type==='accepted'||m.type==='rejected');
 send({type:'init',scope:'decisions',scenario,events:[],tick:990});
 const current=reportedContacts(messages.at(-1)!.state!).find(t=>t.detected!==null&&!t.designated)!;
 assert.ok(current);
 const designate={k:'designate',track:current.id,tick:0};
 send({type:'action',scope:'decisions',request_id:10,action:designate});
 assert.equal(replies().at(-1)?.type,'rejected');
 assert.equal(replies().at(-1)?.request_id,10);
 assert.equal(replies().at(-1)?.reason,'paused');
 send({type:'play',scope:'decisions'});
 send({type:'action',scope:'decisions',request_id:11,action:designate});
 assert.equal(replies().at(-1)?.type,'accepted');
 assert.equal(replies().at(-1)?.request_id,11);
 for(const [request_id,kind,identity] of [[12,'quad','neutral'],[13,'bird','friendly']] as const)
  send({type:'action',scope:'decisions',request_id,action:{k:'classify',track:current.id,tick:0,kind,identity}});
 const rapid=replies().filter(m=>m.request_id===12||m.request_id===13);
 assert.deepEqual(rapid.map(m=>[m.request_id,m.action?.kind]),[[12,'quad'],[13,'bird']]);
 send({type:'action',scope:'decisions',request_id:14,action:{k:'classify',track:'UNKNOWN',tick:0,kind:'fixed_wing',identity:'hostile'}});
 assert.equal(replies().at(-1)?.type,'rejected');
 assert.equal(replies().at(-1)?.request_id,14);
 const count=messages.length;
 send({type:'action',scope:'old-scope',request_id:15,action:designate});
 assert.equal(messages.length,count,'Stale scope cannot affect the current run');
 send({type:'finish',scope:'decisions'});
 const events=messages.find(m=>m.type==='finalized')!.events!;
 assert.deepEqual(JSON.parse(JSON.stringify(events)),[
  {k:'designate',track:current.id,tick:990,order:0},
  {k:'classify',track:current.id,tick:990,kind:'quad',identity:'neutral',order:1},
  {k:'classify',track:current.id,tick:990,kind:'bird',identity:'friendly',order:2},
 ],'Only accepted authoritative actions are saved, with unchanged order and no receipt metadata');
 send({type:'action',scope:'decisions',request_id:16,action:designate});
 assert.equal(replies().at(-1)?.type,'rejected');
 assert.equal(replies().at(-1)?.request_id,16);
 assert.equal(replies().at(-1)?.reason,'ended');
});
