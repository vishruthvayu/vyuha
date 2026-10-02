import type {Action,Effector,NodeScore,Scenario,ScoreCard,Snapshot,Track} from './types';
export const HZ=30; export const ENGINE_VERSION='vyuha-0.1.0';
export function sample(seed:number,tick:number,id:number,sensor:number) {let x=(seed^Math.imul(tick+1,374761393)^Math.imul(id+1,668265263)^Math.imul(sensor+1,69069))>>>0;x=Math.imul(x^(x>>>13),1274126177)>>>0;return ((x^(x>>>16))>>>0)/4294967296;}
export function idealFor(t:Track) {return t.identity!=='hostile'?'hold':t.rf?'rf_jam':'kinetic';}
export function position(t:Track,tick:number) {const age=Math.max(0,(tick-t.spawn)/HZ);let radius=Math.max(0,t.distance-age*t.speed);let angle=t.bearing*Math.PI/180;
 if(t.identity!=='hostile'){radius=t.distance+Math.sin(age*.16)*14;angle+=age*(t.kind==='bird'?.028:.012);}
 return {x:Math.sin(angle)*radius,z:Math.cos(angle)*radius};}
export function inCivilZone(t:Track) {return t.x < -30 && t.z>20;}
export class Simulation {
 scenario:Scenario; state:Snapshot;events:Action[]=[];
 constructor(scenario:Scenario) {this.scenario=scenario;this.state={tick:0,tracks:scenario.tracks.map(t=>({...t,...position(t as Track,0),active:false,detected:null,designated:null,classification:null,declared:null,resolved:false,impact:false,radar:false,thermal:false,attempts:[]})),jammed:false,done:false,messages:[]}; this.observe();}
 observe(){const {state:s,scenario:spec}=this;s.jammed=s.tick>=spec.jamStart&&s.tick<spec.jamEnd;
 s.tracks.forEach((t,i)=>{t.active=s.tick>=t.spawn&&!t.resolved&&!t.impact;if(!t.active){t.radar=false;t.thermal=false;return;}Object.assign(t,position(t,s.tick));const d=Math.hypot(t.x,t.z);
 const pRadar=Math.max(.03,Math.min(.98,1-(d/195)**4-spec.fog*.15));const pThermal=Math.max(.1,.95-spec.fog*.5);
 t.radar=!s.jammed&&d<190&&sample(spec.seed,s.tick,i,0)<pRadar;t.thermal=d<145&&sample(spec.seed,s.tick,i,1)<pThermal;
 if(t.detected===null&&(t.radar||t.thermal))t.detected=s.tick;
 if(t.identity==='hostile'&&d<=8){t.impact=true;t.active=false;this.note(t.id,'Protected asset hit');}});
 s.done=s.tick>=Math.round(spec.duration*HZ);}
 note(track:string,text:string){this.state.messages.push({tick:this.state.tick,track,text});}
 step(){if(this.state.done)return;this.state.tick++;this.observe();}
 act(a:Action){const s=this.state;const t=s.tracks.find(x=>x.id===a.track);if(s.done||!t?.active||t.detected===null||a.tick!==s.tick)return false;
 if(a.k==='designate'){if(t.designated===null){t.designated=s.tick;this.note(t.id,'Contact designated');}}
 else if(a.k==='classify'){if(t.designated===null||!a.kind||!a.identity)return false;t.classification=a.kind;t.declared=a.identity;this.note(t.id,`Classified ${a.kind} / ${a.identity}`);}
 else {if(t.designated===null||!t.classification||!a.effector)return false;t.attempts.push(a.effector);const d=Math.hypot(t.x,t.z);
 if(a.effector==='hold'){this.note(t.id,'Contact held; monitoring continues');}
 else if(d>(a.effector==='kinetic'?160:180)){this.note(t.id,'Outside simulated effector range');}
 else if(a.effector==='kinetic'&&inCivilZone(t)){this.note(t.id,'Restricted zone: kinetic engagement blocked');}
 else if(a.effector==='rf_jam'&&!t.rf){this.note(t.id,'No RF link: jamming had no effect');}
 else{t.resolved=true;t.active=false;this.note(t.id,t.identity==='hostile'?'Threat stopped':'Non-hostile contact engaged');}}
 this.events.push({...a});return true;}
 snapshot():Snapshot{return structuredClone(this.state);}
}
export function replay(scenario:Scenario,events:Action[],endTick:number){const sim=new Simulation(scenario);let i=0;while(sim.state.tick<=endTick){while(i<events.length&&events[i].tick===sim.state.tick)sim.act(events[i++]);if(sim.state.tick===endTick||sim.state.done)break;sim.step();}return sim;}
export function score(sim:Simulation):ScoreCard {
 const all=sim.state.tracks.filter(t=>sim.state.tick>=t.spawn);const threats=all.filter(t=>t.identity==='hostile');let fratricide=false;let breaches=0;
 const rows:NodeScore[]=all.map(t=>{const isThreat=t.identity==='hostile';const latency=t.detected===null||t.designated===null?null:(t.designated-t.detected)/HZ;const detect=latency===null?0:Math.round(25*Math.max(0,Math.min(1,(20-latency)/17)));
 const classify=t.classification===t.kind&&t.declared===t.identity?25:t.declared===t.identity&&t.classification!==null?12:0;
 const effective=sim.events.filter(a=>a.track===t.id&&a.k==='engage');let successful=false;const feedback:string[]=[];
 for(const a of effective){const temp={...t,...position(t,a.tick)};const d=Math.hypot(temp.x,temp.z);if(a.effector==='kinetic'&&inCivilZone(temp)){breaches++;feedback.push('Kinetic action attempted in the restricted zone.');}
 if(a.effector!=='hold'&&d<=(a.effector==='kinetic'?160:180)&&!(a.effector==='kinetic'&&inCivilZone(temp))&&(a.effector!=='rf_jam'||t.rf)&&!isThreat)fratricide=true;
 if(a.effector===idealFor(t)&&d<=(a.effector==='kinetic'?160:180)&&!(a.effector==='kinetic'&&inCivilZone(temp)))successful=true;}
 const wrong=effective.filter(a=>a.effector!==idealFor(t)).length;const engage=successful?Math.max(0,35-wrong*7):0;
 const prioritise=isThreat?(t.resolved&&!t.impact?15:0):t.attempts.includes('hold')?15:0;
 if(latency===null)feedback.push('Designate the contact after a sensor first reveals it.');else if(latency>3)feedback.push(`Designation took ${latency.toFixed(1)} seconds after first sensor visibility.`);
 if(classify<25)feedback.push(`Reference classification: ${t.kind.replace('_',' ')} / ${t.identity}.`);
 if(!successful)feedback.push(idealFor(t)==='hold'?'Hold fire on this non-hostile contact.':t.rf?'RF-link present: RF jamming is the example-pack response.':'No RF link: use an allowed kinetic response in this example pack.');
 if(wrong)feedback.push(`${wrong} unsuitable response${wrong>1?'s':''}; review the sensor evidence.`);if(t.impact)feedback.push('This threat reached the protected asset.');
 return {id:t.id,kind:t.kind,identity:t.identity,detect,classify,prioritise,engage,total:detect+classify+prioritise+engage,detected:t.detected,designated:t.designated,ideal:idealFor(t),feedback,impact:t.impact,attempts:t.attempts};});
 const relevant=rows.filter(t=>t.identity==='hostile');const leakers=threats.filter(t=>t.impact).length;const raw=relevant.length?relevant.reduce((a,t)=>a+t.total,0)/relevant.length:0;const result=fratricide?0:Math.max(0,Math.round(raw-leakers*10));
 const recognition=rows.length?Math.round(rows.reduce((a,t)=>a+t.classify,0)/(rows.length*25)*100):0;const response=rows.length?Math.round(rows.reduce((a,t)=>a+t.engage,0)/(rows.length*35)*100):0;
 return {score:result,passed:result>=70&&!fratricide&&breaches===0,fratricide,roe_breaches:breaches,leakers,threats:threats.length,rows,skills:{recognition,response},summary:fratricide?'Non-hostile engagement: session failed.':leakers?`${leakers} threat${leakers>1?'s':''} reached the protected asset. Review response selection.`:result>=70?'Good control. Repeat with a new scenario seed.':'Review designation, classification, and response before the next drill.',engine_version:ENGINE_VERSION};
}
