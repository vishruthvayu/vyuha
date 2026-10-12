import {Simulation,replay} from './sim';
import type {Action,AppliedCommand,InstructorCommand,Scenario} from './types';
import {FixedStepClock} from './clock';
let sim:Simulation|null=null;
let localPaused=true;
let ended=false;
let order=0;
let benchmark=false;let tickTimes:number[]=[];
let hidden=false;
const clock=new FixedStepClock();
let timer:ReturnType<typeof setInterval>|null=null;
function publish(){if(sim)postMessage({type:'snapshot',state:sim.snapshot(),paused:localPaused||sim.state.paused});}
function finish(){if(!sim||ended)return;ended=true;localPaused=true;publish();postMessage({type:'finalized',events:sim.events,commands:sim.commands});}
onmessage=(e:MessageEvent<{type:string;scenario?:Scenario;action?:Action;events?:Action[];commands?:AppliedCommand[];command?:InstructorCommand;tick?:number;benchmark?:boolean;hidden?:boolean}>)=>{
 const m=e.data;
 if(m.type==='init'&&m.scenario){
  benchmark=m.benchmark??false;tickTimes=[];
  if(timer)clearInterval(timer);
  sim=m.events?replay(m.scenario,m.events,m.tick??0,m.commands??[]):new Simulation(m.scenario);
  order=Math.max(-1,...sim.events.map(a=>a.order??-1),...sim.commands.map(c=>c.order))+1;
  localPaused=true;ended=false;clock.reset(performance.now());publish();
  timer=setInterval(()=>{
   const step=clock.advance(performance.now(),!!sim&&!localPaused&&!hidden&&!sim.state.paused&&!sim.state.done&&!ended);
   if(step.throttled)postMessage({type:'clock-status',status:'throttled',dropped_ms:step.droppedMs,note:'Browser timer stalled. At most five logical steps were caught up; excess wall time was discarded. Exercise time may lag wall time.'});
   for(let i=0;i<step.ticks&&sim&&!sim.state.done&&!ended;i++){
    const started=benchmark?performance.now():0;sim.step();
    if(benchmark){tickTimes.push(performance.now()-started);if(tickTimes.length>=30){postMessage({type:'benchmark',tick_ms:tickTimes});tickTimes=[];}}
    if(sim.state.tick%3===0||sim.state.done)publish();if(sim.state.done)finish();
   }
  },1000/30);
 }else if(m.type==='play'){localPaused=false;clock.reset(performance.now());publish();}
 else if(m.type==='pause'){localPaused=true;clock.reset(performance.now());publish();}
 else if(m.type==='visibility'){hidden=m.hidden===true;clock.reset(performance.now());postMessage({type:'clock-status',status:hidden?'hidden':'visible',note:hidden?'Exercise logical time is suspended while this browser tab is hidden.':'Tab visible. Logical time resumes without accumulating hidden wall time.'});}
 else if(m.type==='finish')finish();
 else if(m.type==='control'&&sim&&m.command&&!ended){
  if(sim.control(m.command,sim.state.tick,order)){order++;if(m.command.type==='resume')localPaused=false;if(m.command.type==='pause'||m.command.type==='resume')clock.reset(performance.now());postMessage({type:'controlled',commands:sim.commands});}publish();
 }else if(m.type==='action'&&sim&&m.action&&!localPaused&&!ended){
  const a={...m.action,tick:sim.state.tick,order};if(sim.act(a)){order++;postMessage({type:'accepted',action:a});}publish();
 }
};
