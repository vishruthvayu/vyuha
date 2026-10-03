import {capturePriority,evaluatePriority} from './prioritisation';
import type {PriorityChoice} from './types';
import type {Action,Effector,NodeScore,Scenario,ScoreCard,Snapshot,Track,AppliedCommand,InstructorCommand,TrackSpec} from './types';
export const HZ=30; export const ENGINE_VERSION='vyuha-0.2.0';
export function sample(seed:number,tick:number,id:number,sensor:number) {let x=(seed^Math.imul(tick+1,374761393)^Math.imul(id+1,668265263)^Math.imul(sensor+1,69069))>>>0;x=Math.imul(x^(x>>>13),1274126177)>>>0;return ((x^(x>>>16))>>>0)/4294967296;}
export function idealFor(t:Track) {return t.identity!=='hostile'?'hold':t.rf?'rf_jam':'kinetic';}
export function position(t:Track,tick:number) {const age=Math.max(0,(tick-t.spawn)/HZ);let radius=Math.max(0,t.distance-age*t.speed);let angle=t.bearing*Math.PI/180;
 if(t.identity!=='hostile'){radius=t.distance+Math.sin(age*.16)*14;angle+=age*(t.kind==='bird'?.028:.012);}
 return {x:Math.sin(angle)*radius,z:Math.cos(angle)*radius};}
export function inCivilZone(t:Track) {const zone=t.rules?.restricted??{enabled:true,x_lt:-30,z_gt:20};return zone.enabled&&t.x<zone.x_lt&&t.z>zone.z_gt;}
export function distance(t:Track){const value=Math.hypot(t.x,t.z),precision=t.rules?.distance_precision;return precision===undefined?value:Math.round(value*10**precision)/10**precision;}
export function engagementRule(t:Track,e:Effector){const maximum=e==='kinetic'?(t.rules?.kinetic_range??160):(t.rules?.rf_range??180),inRange=(e==='hold'&&!!t.rules?.hold_any_range)||distance(t)<=maximum,restricted=e==='kinetic'&&inCivilZone(t),allowed=(t.rules?.effectors??['hold','rf_jam','kinetic']).includes(e);return {maximum,inRange,restricted,effective:allowed&&e!=='hold'&&inRange&&!restricted&&(e!=='rf_jam'||t.rf),success:allowed&&e===idealFor(t)&&inRange&&!restricted};}
export class Simulation {
 priorityDecisions:PriorityChoice[]=[];rfOverride:boolean|null=null;scenario:Scenario; state:Snapshot;events:Action[]=[];commands:AppliedCommand[]=[];radarOverride:Snapshot['radarStatus']|null=null;
 constructor(scenario:Scenario) {this.scenario=scenario;this.state={tick:0,tracks:scenario.tracks.map(t=>({...t,...(scenario.doctrine?{rules:scenario.doctrine.rules}:{}),...position(t as Track,0),active:false,detected:null,designated:null,classification:null,declared:null,resolved:false,impact:false,radar:false,thermal:false,attempts:[]})),jammed:false,radarStatus:'normal',rfAvailable:true,night:scenario.night,paused:false,done:false,messages:[]}; this.observe();}
 observe(){const {state:s,scenario:spec}=this;const scheduled=s.tick>=spec.jamStart&&s.tick<spec.jamEnd;const failed=s.tick>=(spec.radarFailureStart??2250)&&s.tick<(spec.radarFailureEnd??2250);s.rfAvailable=this.rfOverride??!(s.tick>=(spec.rfFailureStart??2250)&&s.tick<(spec.rfFailureEnd??2250));s.radarStatus=this.radarOverride??(failed?'failed':scheduled?'jammed':'normal');s.jammed=s.radarStatus==='jammed';
 s.tracks.forEach((t,i)=>{t.active=s.tick>=t.spawn&&!t.resolved&&!t.impact;if(!t.active){t.radar=false;t.thermal=false;return;}Object.assign(t,position(t,s.tick));const d=distance(t);
 const pRadar=Math.max(.03,Math.min(.98,1-(d/195)**4-spec.fog*.15));const pThermal=Math.max(.1,.95-spec.fog*.5);
 const radarFactor=s.radarStatus==='failed'?0:s.jammed?(this.radarOverride==='jammed'?.2:0):1;t.radar=radarFactor>0&&d<(t.radar_range??190)&&sample(spec.seed,s.tick,i,0)<pRadar*radarFactor;t.thermal=d<(t.thermal_range??145)&&sample(spec.seed,s.tick,i,1)<pThermal;
 if(t.detected===null&&(t.radar||t.thermal))t.detected=s.tick;
 if(t.identity==='hostile'&&d<=8){t.impact=true;t.active=false;this.note(t.id,'Protected asset hit');}});
 s.done=s.tick>=Math.round(spec.duration*HZ);}
 note(track:string,text:string){this.state.messages.push({tick:this.state.tick,track,text});}
 step(force=false){if(this.state.done||(!force&&this.state.paused))return;this.state.tick++;this.observe();}
 act(a:Action){const s=this.state;const t=s.tracks.find(x=>x.id===a.track);if(s.done||s.paused||!t?.active||t.detected===null||a.tick!==s.tick)return false;
 if(a.k==='designate'){if(t.designated===null){t.designated=s.tick;this.note(t.id,'Contact designated');}}
 else if(a.k==='classify'){if(t.designated===null||!a.kind||!a.identity)return false;t.classification=a.kind;t.declared=a.identity;this.note(t.id,`Classified ${a.kind} / ${a.identity}`);}
 else {if(t.designated===null||!t.classification||!a.effector)return false;capturePriority(this,t,a);t.attempts.push(a.effector);const rule=engagementRule(t,a.effector);
 if(a.effector==='hold'){this.note(t.id,'Contact held; monitoring continues');}
 else if(!rule.inRange){this.note(t.id,'Outside simulated effector range');}
 else if(rule.restricted){this.note(t.id,'Restricted zone: kinetic engagement blocked');}
 else if(a.effector==='rf_jam'&&!t.rf){this.note(t.id,'No RF link: jamming had no effect');}
 else if(rule.effective){t.resolved=true;t.active=false;this.note(t.id,t.identity==='hostile'?'Threat stopped':'Non-hostile contact engaged');}}
 this.events.push({...a});return true;}
 control(command:InstructorCommand,tick=this.state.tick,order=0){
  if(this.commands.some(c=>c.seq===command.seq))return false;
  if(command.seq!==(this.commands.at(-1)?.seq??0)+1||tick!==this.state.tick||this.state.done)return false;
  const c={...command,tick,order} as AppliedCommand;this.commands.push(c);
  switch(c.type){
   case 'pause':this.state.paused=true;break;
   case 'resume':this.state.paused=false;break;
   case 'inject_contact':case 'inject_swarm':{
    const count=c.type==='inject_swarm'?6:1;const kind=c.type==='inject_contact'?c.payload.kind:'quad';
    for(let i=0;i<count;i++){const n=this.state.tracks.length;const spec:TrackSpec={id:`T${n+1}`,kind,identity:'hostile',rf:kind==='quad',spawn:tick,bearing:(c.payload.bearing+i*5+360)%360,distance:130+Math.floor(sample(this.scenario.seed,c.seq,i,7)*12),speed:kind==='quad'?2.6:3.8,altitude:kind==='quad'?20+i%3*3:10};this.state.tracks.push({...spec,...(this.scenario.doctrine?{rules:this.scenario.doctrine.rules}:{}),...position(spec as Track,tick),active:true,detected:null,designated:null,classification:null,declared:null,resolved:false,impact:false,radar:false,thermal:false,attempts:[]});this.note(spec.id,`Instructor injected ${kind}`);}break;
   }
   case 'sensor_fault':if(c.payload.sensor==='radar')this.radarOverride=c.payload.mode;else this.rfOverride=false;break;
   case 'sensor_restore':if(c.payload.sensor==='radar')this.radarOverride='normal';else this.rfOverride=true;break;
   case 'environment':this.state.night=c.payload.night;break;
  }
  this.note('INSTRUCTOR',c.type==='sensor_fault'?`${c.payload.sensor} ${c.payload.mode}`:c.type==='sensor_restore'?`${c.payload.sensor} restored`:c.type==='environment'?(c.payload.night?'Night conditions':'Day conditions'):c.type.replaceAll('_',' '));
  this.observe();return true;
 }
 snapshot():Snapshot{return structuredClone(this.state);}
}
export function replay(scenario:Scenario,events:Action[],endTick:number,commands:AppliedCommand[]=[],beforeOrder?:number){
 const sim=new Simulation(scenario);const timeline=[...events.map((a,i)=>({tick:a.tick,order:a.order??i,action:a,command:null as AppliedCommand|null})),...commands.map(c=>({tick:c.tick,order:c.order,action:null as Action|null,command:c}))].filter(e=>e.tick<endTick||(e.tick===endTick&&(beforeOrder===undefined||e.order<beforeOrder))).sort((a,b)=>a.tick-b.tick||a.order-b.order);
 let i=0;while(sim.state.tick<=endTick){while(i<timeline.length&&timeline[i].tick===sim.state.tick){const e=timeline[i++];if(e.command)sim.control(e.command,e.tick,e.order);else if(e.action)sim.act(e.action);}if(sim.state.tick===endTick||sim.state.done)break;sim.step(true);}return sim;
}
export function score(sim:Simulation):ScoreCard {
 const priority=sim.scenario.prioritisation_version?evaluatePriority(sim):null;const all=sim.state.tracks.filter(t=>sim.state.tick>=t.spawn);const threats=all.filter(t=>t.identity==='hostile');let fratricide=false;let breaches=0;
 const rows:NodeScore[]=all.map(t=>{const isThreat=t.identity==='hostile';const latency=t.detected===null||t.designated===null?null:(t.designated-t.detected)/HZ;const detect=latency===null?0:Math.round(25*Math.max(0,Math.min(1,(20-latency)/17)));
 const classify=t.classification===t.kind&&t.declared===t.identity?25:t.declared===t.identity&&t.classification!==null?12:0;
 const effective=sim.events.filter(a=>a.track===t.id&&a.k==='engage');let successful=false;const feedback:string[]=[];
 for(const a of effective){const temp={...t,...position(t,a.tick)};const rule=engagementRule(temp,a.effector!);if(rule.restricted){breaches++;feedback.push('Kinetic action attempted in the restricted zone.');}
 if(rule.effective&&!isThreat)fratricide=true;
 if(rule.success)successful=true;}
 const wrong=effective.filter(a=>a.effector!==idealFor(t)).length;const engage=successful?Math.max(0,35-wrong*7):0;
 const prioritise=isThreat?(priority?priority.points:t.resolved&&!t.impact?15:0):t.attempts.includes('hold')?15:0;
 if(latency===null)feedback.push('Designate the contact after a sensor first reveals it.');else if(latency>3)feedback.push(`Designation took ${latency.toFixed(1)} seconds after first sensor visibility.`);
 if(classify<25)feedback.push(`Reference classification: ${t.kind.replace('_',' ')} / ${t.identity}.`);
 if(!successful)feedback.push(idealFor(t)==='hold'?'Hold fire on this non-hostile contact.':t.rf?'RF-link present: RF jamming is the example-pack response.':'No RF link: use an allowed kinetic response in this example pack.');
 if(wrong)feedback.push(`${wrong} unsuitable response${wrong>1?'s':''}; review the sensor evidence.`);if(t.impact)feedback.push('This threat reached the protected asset.');
 return {id:t.id,kind:t.kind,identity:t.identity,detect,classify,prioritise,engage,total:detect+classify+prioritise+engage,detected:t.detected,designated:t.designated,ideal:idealFor(t),feedback,impact:t.impact,attempts:t.attempts};});
 const relevant=rows.filter(t=>t.identity==='hostile');const leakers=threats.filter(t=>t.impact).length;const raw=relevant.length?relevant.reduce((a,t)=>a+t.total,0)/relevant.length:0;const result=fratricide?0:Math.max(0,Math.round(raw-leakers*10));
 const recognition=rows.length?Math.round(rows.reduce((a,t)=>a+t.classify,0)/(rows.length*25)*100):0;const response=rows.length?Math.round(rows.reduce((a,t)=>a+t.engage,0)/(rows.length*35)*100):0;
 return {score:result,passed:result>=70&&!fratricide&&breaches===0,fratricide,roe_breaches:breaches,leakers,threats:threats.length,rows,skills:{recognition,response},summary:fratricide?'Non-hostile engagement: session failed.':leakers?`${leakers} threat${leakers>1?'s':''} reached the protected asset. Review response selection.`:result>=70?'Good control. Repeat with a new scenario seed.':'Review designation, classification, and response before the next drill.',engine_version:priority?'vyuha-0.3.0':ENGINE_VERSION,...(priority?{prioritisation:priority}:{})};
}
