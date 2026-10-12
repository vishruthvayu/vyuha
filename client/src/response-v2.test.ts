import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {testPython} from './test-python';
import {responseConfiguration,createResponseState,attemptResponse,advanceResponse,responseSnapshot,type ResponseState,type ResponseConfig} from './response-v2';
import {Simulation,replay,score} from './sim';
import type {Action,AppliedCommand,Scenario} from './types';
import type {Simulation as FinaleSimulation} from './sim-v2';
const e={allowed:true,in_range:true,restricted:false,compatible:true,ideal_match:true};
const intent=(tick=0,effector:'kinetic'|'rf_jam'|'hold'='kinetic',track='T1')=>({tick,effector,track});
function advance(s:ResponseState,tick:number,seed=7,active=true,effective=true){const resolved:string[]=[];const done=advanceResponse(s,tick,seed,()=>({active,effective}),id=>resolved.push(id));return {done,resolved};}
test('response configuration bounded and fresh resources independent',()=>{
 for(const change of [{kinetic_ammo:-1},{jammer_channels:9},{jammer_duration_ticks:0},{kinetic_delay_ticks:1.5},{kinetic_success_probability:NaN},{extra:3}])assert.throws(()=>responseConfiguration(change as Partial<ResponseConfig>));
 const c={kinetic_ammo:2},s=createResponseState(c);c.kinetic_ammo=99;assert.equal(s.kinetic_ammo_remaining,2);assert.deepEqual(createResponseState().attempts,[]);
});
test('kinetic ammo and cooldown enforced; effect waits for logical delay',()=>{
 const s=createResponseState({kinetic_ammo:2,kinetic_cooldown_ticks:10,kinetic_delay_ticks:5,kinetic_success_probability:1});
 const a=attemptResponse(s,intent(),e);assert.equal(a.status,'pending');assert.equal(s.kinetic_ammo_remaining,1);
 assert.deepEqual(advance(s,4),{done:[],resolved:[]});assert.deepEqual(advance(s,5),{done:['R1'],resolved:['T1']});
 assert.equal(attemptResponse(s,intent(5,'kinetic','T2'),e).status,'blocked_cooldown');assert.equal(attemptResponse(s,intent(10,'kinetic','T2'),e).status,'pending');
 assert.equal(attemptResponse(s,intent(11,'kinetic','T3'),e).status,'blocked_ammo');assert.equal(s.kinetic_ammo_remaining,0);
});
test('jammer channels release after failed or inactive dwell expiry',()=>{
 const s=createResponseState({jammer_channels:1,jammer_duration_ticks:10,jammer_success_probability:0});const a=attemptResponse(s,intent(0,'rf_jam'),e);
 assert.equal(responseSnapshot(s).jammer_channels_in_use,1);assert.equal(attemptResponse(s,intent(1,'rf_jam','T2'),e).status,'blocked_channels');
 assert.deepEqual(advance(s,9),{done:[],resolved:[]});advance(s,10);assert.equal(a.status,'no_effect');
 const b=attemptResponse(s,intent(10,'rf_jam','T2'),e);advance(s,20,7,false);assert.equal(b.status,'target_inactive');assert.equal(responseSnapshot(s).jammer_channels_in_use,0);
});
test('public pending ledger masks hidden compatibility and process validity',()=>{
 const a=createResponseState(),b=createResponseState();attemptResponse(a,intent(0,'rf_jam'),e);attemptResponse(b,intent(0,'rf_jam'),{...e,compatible:false,ideal_match:false});
 assert.deepEqual(responseSnapshot(a),responseSnapshot(b));assert.doesNotMatch(JSON.stringify(responseSnapshot(a)),/process_valid|launch_eligible|config/);
});
test('due constraints rechecked and seeded failures reproducible without resource refunds',()=>{
 const s=createResponseState({kinetic_success_probability:1});attemptResponse(s,intent(),e);advance(s,15,7,true,false);assert.equal(s.attempts[0].status,'no_effect');assert.equal(s.kinetic_ammo_remaining,7);assert.throws(()=>advance(s,14));assert.deepEqual(advance(s,16),{done:[],resolved:[]});
 let count=0;for(let seed=0;seed<200;seed++){const a=createResponseState({kinetic_success_probability:.5}),b=createResponseState({kinetic_success_probability:.5});attemptResponse(a,intent(),e);attemptResponse(b,intent(),e);advance(a,15,seed);advance(b,15,seed);assert.deepEqual(a,b);count+=a.attempts[0].status==='resolved'?1:0;}assert.ok(count>75&&count<125);
});
test('dispatched Python/TS response/sensor/action/score parity at288 checkpoints',()=>{
 const root=resolve(import.meta.dirname,'../..');const fixtures=JSON.parse(execFileSync(testPython(),['-m','server.tests.response_fixtures'],{cwd:root,encoding:'utf8',maxBuffer:12000000,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}})) as {scenario:Scenario;events:Action[];commands:AppliedCommand[];checkpoints:unknown[]}[];
 let checked=0;
 for(const f of fixtures){
  const sim=new Simulation(f.scenario) as unknown as FinaleSimulation;const timeline=[...f.events.map(a=>({tick:a.tick,order:a.order!,action:a,command:null as AppliedCommand|null})),...f.commands.map(c=>({tick:c.tick,order:c.order,action:null as Action|null,command:c}))].sort((a,b)=>a.tick-b.tick||a.order-b.order);let cursor=0;
  for(const value of f.checkpoints){const expected=value as {tick:number};while(sim.state.tick<=expected.tick){while(timeline[cursor]?.tick===sim.state.tick){const input=timeline[cursor++];if(input.action)assert.ok(sim.act(input.action));else assert.ok(sim.control(input.command!,input.tick,input.order));}if(sim.state.tick===expected.tick)break;sim.step();}
   const fields=['id','active','resolved','impact','detected','designated','classification','declared','attempts','observation'];const projection={tick:sim.state.tick,tracks:sim.state.tracks.map(t=>Object.fromEntries(fields.map(k=>[k,t[k as keyof typeof t]]))),response:responseSnapshot(sim.responseState!),events:sim.events,commands:sim.commands,scorecard:score(sim)};
   assert.deepEqual(projection,value,`seed${f.scenario.seed} at tick${sim.state.tick}`);checked++;
  }
  const rebuilt=replay(f.scenario,f.events,120,f.commands);assert.deepEqual(score(rebuilt),score(sim));
 }
 assert.equal(fixtures.length,18);assert.equal(checked,288);
});
