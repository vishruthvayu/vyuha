import {Simulation,replay} from './sim';
import type {Action,AppliedCommand,InstructorCommand,Scenario} from './types';
import {FixedStepClock} from './clock';
let sim:Simulation|null=null;
let scope:string|undefined;
let scenarioId:string|undefined;
// Scope belongs to an initialization, not only a session: repeated restoration
// of the same session must not adopt messages from its previous worker state.
function emit(message:object){postMessage({...message,scope,scenario_id:scenarioId});}
let localPaused=true;
let ended=false;
let order=0;
let benchmark=false;let tickTimes:number[]=[];
let hidden=false;
const clock=new FixedStepClock();
let timer:ReturnType<typeof setInterval>|null=null;
function nextOrder(){return (sim as Simulation&{nextOrder?:number}|null)?.nextOrder??order;}
function publish(initialized=false){if(sim)emit({type:'snapshot',state:sim.snapshot(),paused:localPaused||sim.state.paused,initialized});}
function flushBenchmark(){if(benchmark&&tickTimes.length){emit({type:'benchmark',tick_ms:tickTimes});tickTimes=[];}}
function stoppedBenchmark(){if(benchmark&&sim)emit({type:'benchmark-stopped',tick:sim.state.tick});}
function finish(){if(!sim||ended)return;ended=true;localPaused=true;(sim as Simulation&{endAcquisition?:()=>void}).endAcquisition?.();flushBenchmark();publish();stoppedBenchmark();emit({type:'finalized',events:sim.events,commands:sim.commands});}
onmessage=(e:MessageEvent<{type:string;scope?:string;request_id?:number;scenario?:Scenario;action?:Action;events?:Action[];commands?:AppliedCommand[];command?:InstructorCommand;tick?:number;benchmark?:boolean;hidden?:boolean}>)=>{
 const m=e.data;
 // Benchmark retains its unscoped worker protocol. Training initialization is
 // scoped; late actions, commands and finish intents cannot cross ownership.
 if(m.type!=='init'&&m.type!=='visibility'&&scope!==undefined&&m.scope!==scope)return;
 if(m.type==='init'&&m.scenario){
  scope=m.scope;scenarioId=m.scenario.id;
  benchmark=m.benchmark??false;tickTimes=[];
  if(timer)clearInterval(timer);
  sim=m.events?replay(m.scenario,m.events,m.tick??0,m.commands??[]):new Simulation(m.scenario);
  order=Math.max(-1,...sim.events.map(a=>a.order??-1),...sim.commands.map(c=>c.order))+1;
  localPaused=true;ended=false;clock.reset(performance.now());publish(true);
  timer=setInterval(()=>{
   const step=clock.advance(performance.now(),!!sim&&!localPaused&&!hidden&&!sim.state.paused&&!sim.state.done&&!ended);
   if(step.throttled)emit({type:'clock-status',status:'throttled',dropped_ms:step.droppedMs,note:'Browser timer stalled. At most five logical steps were caught up; excess wall time was discarded. Exercise time may lag wall time.'});
   for(let i=0;i<step.ticks&&sim&&!sim.state.done&&!ended;i++){
    const started=benchmark?performance.now():0;sim.step();
    if(benchmark){tickTimes.push(performance.now()-started);if(tickTimes.length>=30){emit({type:'benchmark',tick_ms:tickTimes});tickTimes=[];}}
    if(sim.state.tick%3===0||sim.state.done)publish();if(sim.state.done)finish();
   }
  },1000/30);
 }else if(m.type==='play'){localPaused=false;clock.reset(performance.now());if(sim?.state.done)finish();else publish();}
 else if(m.type==='pause'){localPaused=true;clock.reset(performance.now());flushBenchmark();publish();stoppedBenchmark();}
 else if(m.type==='visibility'){hidden=m.hidden===true;clock.reset(performance.now());emit({type:'clock-status',status:hidden?'hidden':'visible',note:hidden?'Exercise logical time is suspended while this browser tab is hidden.':'Tab visible. Logical time resumes without accumulating hidden wall time.'});}
 else if(m.type==='finish')finish();
 else if(m.type==='control'&&sim&&m.command&&!ended){
  if(sim.control(m.command,sim.state.tick,nextOrder())){order=Math.max(order+1,nextOrder());if(m.command.type==='resume')localPaused=false;if(m.command.type==='pause'||m.command.type==='resume')clock.reset(performance.now());emit({type:'controlled',commands:sim.commands});}publish();
 }else if(m.type==='action'&&sim&&m.action){
  // Request correlation belongs to transport metadata, never authoritative events.
  const a={...m.action,tick:sim.state.tick,order:nextOrder()};
  const reason=ended||sim.state.done?'ended':localPaused||sim.state.paused?'paused':undefined;
  if(!reason&&sim.act(a)){order=Math.max(order+1,nextOrder());emit({type:'accepted',action:a,request_id:m.request_id});}
  else emit({type:'rejected',action:a,request_id:m.request_id,reason:reason??'state_changed'});
  publish();
 }
};
