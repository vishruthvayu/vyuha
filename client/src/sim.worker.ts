import {Simulation,replay} from './sim';
import type {Action,Scenario} from './types';
let sim:Simulation|null=null;let paused=true;let timer:ReturnType<typeof setInterval>|null=null;
function publish(){if(sim)postMessage({type:'snapshot',state:sim.snapshot()});}
onmessage=(e:MessageEvent<{type:string;scenario?:Scenario;action?:Action;events?:Action[];tick?:number}>)=>{const m=e.data;
 if(m.type==='init'&&m.scenario){if(timer)clearInterval(timer);sim=m.events?replay(m.scenario,m.events,m.tick??0):new Simulation(m.scenario);paused=true;publish();timer=setInterval(()=>{if(!sim||paused||sim.state.done)return;sim.step();if(sim.state.tick%3===0||sim.state.done)publish();if(sim.state.done){paused=true;postMessage({type:'finalized',events:sim.events});}},1000/30);}
 else if(m.type==='play')paused=false;else if(m.type==='pause')paused=true;
 else if(m.type==='finish'&&sim){paused=true;postMessage({type:'finalized',events:sim.events});}
 else if(m.type==='action'&&sim&&m.action){const a={...m.action,tick:sim.state.tick};if(sim.act(a))postMessage({type:'accepted',action:a});publish();}};
