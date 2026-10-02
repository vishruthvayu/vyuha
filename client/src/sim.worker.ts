import {Simulation,replay} from './sim';
import type {Action,AppliedCommand,InstructorCommand,Scenario} from './types';
let sim:Simulation|null=null;
let localPaused=true;
let ended=false;
let order=0;
let timer:ReturnType<typeof setInterval>|null=null;
function publish(){if(sim)postMessage({type:'snapshot',state:sim.snapshot(),paused:localPaused||sim.state.paused});}
function finish(){if(!sim||ended)return;ended=true;localPaused=true;publish();postMessage({type:'finalized',events:sim.events,commands:sim.commands});}
onmessage=(e:MessageEvent<{type:string;scenario?:Scenario;action?:Action;events?:Action[];commands?:AppliedCommand[];command?:InstructorCommand;tick?:number}>)=>{
 const m=e.data;
 if(m.type==='init'&&m.scenario){
  if(timer)clearInterval(timer);
  sim=m.events?replay(m.scenario,m.events,m.tick??0,m.commands??[]):new Simulation(m.scenario);
  order=Math.max(-1,...sim.events.map(a=>a.order??-1),...sim.commands.map(c=>c.order))+1;
  localPaused=true;ended=false;publish();
  timer=setInterval(()=>{if(!sim||localPaused||sim.state.paused||sim.state.done||ended)return;sim.step();if(sim.state.tick%3===0||sim.state.done)publish();if(sim.state.done)finish();},1000/30);
 }else if(m.type==='play'){localPaused=false;publish();}
 else if(m.type==='pause'){localPaused=true;publish();}
 else if(m.type==='finish')finish();
 else if(m.type==='control'&&sim&&m.command&&!ended){
  if(sim.control(m.command,sim.state.tick,order)){order++;if(m.command.type==='resume')localPaused=false;postMessage({type:'controlled',commands:sim.commands});}publish();
 }else if(m.type==='action'&&sim&&m.action&&!localPaused&&!ended){
  const a={...m.action,tick:sim.state.tick,order};if(sim.act(a)){order++;postMessage({type:'accepted',action:a});}publish();
 }
};
