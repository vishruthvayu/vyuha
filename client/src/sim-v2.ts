/** v0.4 combines analytic meter-scale motion with separate observed sensor evidence. */
import * as legacy from './sim_v1_0_1';
import {evaluatePriority} from './prioritisation_v1_0_1';
import {raidPosition as position} from './raid-v2';
import {observeSensors,falseTracks,type SensorMemory} from './sensors-v2';
import {createResponseState,attemptResponse,advanceResponse,responseSnapshot,responseReport,type ResponseState,type ResponseConfig,type PublicResponseState} from './response-v2';
import type {Action,AppliedCommand,InstructorCommand,Scenario,Track,Snapshot,NodeScore,ScoreCard} from './types';
const {HZ,idealFor,inCivilZone,engagementRule}=legacy;
export const ENGINE_VERSION='vyuha-0.4.0';
type ResponseScenario=Scenario&{response_model?:Partial<ResponseConfig>};
type ResponseSnapshot=Snapshot&{response?:PublicResponseState};
export function observedPosition(t:Track){const o=t.observation;return o?.ir.position??o?.eo.position??o?.radar.position??null;}
function capturePriority(sim:Simulation,t:Track,a:Action){
 if(a.effector==='hold'||t.declared!=='hostile'||sim.priorityDecisions.some(d=>d.chosen.track_id===t.id))return;
 const rules=sim.scenario.doctrine!.rules;
 const facts=sim.state.tracks.flatMap(track=>{const pos=observedPosition(track);if(!track.active||track.declared!=='hostile'||!pos)return [];
 const d=Math.hypot(pos.x,pos.z),tti=Math.max(0,(d-8)/Math.max(track.speed,.01)),risk=(rules.risk_weights[track.classification??'']??1)*rules.asset_risk;return [{track_id:track.id,tick:sim.state.tick,time_to_impact:Math.round(tti*1e6)/1e6,risk:Math.round(risk*1e6)/1e6,priority:Math.round(risk/Math.max(tti,1/30)*1e9)/1e9}];});
 const chosen=facts.find(f=>f.track_id===t.id);if(chosen)sim.priorityDecisions.push({tick:sim.state.tick,order:a.order??sim.events.length,chosen,available:facts.sort((a,b)=>b.priority-a.priority||a.track_id.localeCompare(b.track_id))});
}
export class Simulation extends legacy.Simulation {
 declare responseState:ResponseState|null;
 declare sensorMemory:Map<string,SensorMemory>;declare eoStatus:'normal'|'failed';declare irStatus:'normal'|'failed';
 observe(){const model=(this.scenario as ResponseScenario).response_model;if(this.responseState===undefined)this.responseState=model!==undefined&&model!==null?createResponseState(model):null;this.sensorMemory??=new Map();this.eoStatus??='normal';this.irStatus??='normal';const s=this.state,spec=this.scenario,end=spec.duration*HZ;
 s.radarStatus=this.radarOverride??(s.tick>=(spec.radarFailureStart??end)&&s.tick<(spec.radarFailureEnd??end)?'failed':s.tick>=spec.jamStart&&s.tick<spec.jamEnd?'jammed':'normal');s.jammed=s.radarStatus==='jammed';
 s.rfAvailable=this.rfOverride??!(s.tick>=(spec.rfFailureStart??end)&&s.tick<(spec.rfFailureEnd??end));
 const env={night:s.night,fog:spec.fog,radar_status:s.radarStatus,rf_available:s.rfAvailable,eo_status:this.eoStatus,ir_status:this.irStatus,terrain:spec.terrain_boxes??[]};
 if(this.responseState){
  s.tracks.forEach(t=>{t.active=s.tick>=t.spawn&&s.tick<(t.expires_tick??end+1)&&!t.resolved&&!t.impact;if(t.active||s.tick===0)Object.assign(t,position(t,s.tick));});
  advanceResponse(this.responseState,s.tick,spec.seed,(id,effector)=>{const t=s.tracks.find(t=>t.id===id);return t?{active:t.active,effective:engagementRule(t,effector).effective}:null;},id=>{const t=s.tracks.find(t=>t.id===id)!;t.resolved=true;t.active=false;});
  (s as ResponseSnapshot).response=responseSnapshot(this.responseState);
 }
 s.tracks.forEach((t,i)=>{t.active=s.tick>=t.spawn&&s.tick<(t.expires_tick??end+1)&&!t.resolved&&!t.impact;if(t.active||s.tick===0)Object.assign(t,position(t,s.tick));if(t.active&&t.identity==='hostile'&&legacy.distance(t)<=8){t.impact=true;t.active=false;this.note(t.id,'Protected asset hit');}
 const result=observeSensors(spec.seed,s.tick,i,t,env,this.sensorMemory.get(t.id),spec.sensor_config);t.observation=result.observation;this.sensorMemory.set(t.id,result.memory);t.radar=t.observation.radar.detected;t.thermal=t.observation.ir.level!=='none'||t.observation.eo.level!=='none';if(t.detected===null&&(t.radar||t.thermal))t.detected=s.tick;});
 s.falseContacts=falseTracks(spec.seed,s.tick,env,spec.sensor_config);s.done=s.tick>=end;
 }
 act(a:Action){const s=this.state,t=s.tracks.find(t=>t.id===a.track);if(s.done||s.paused||!t?.active||t.detected===null||a.tick!==s.tick)return false;
 if(a.k==='designate'){if(!observedPosition(t))return false;if(t.designated===null)t.designated=s.tick;}
 else if(a.k==='classify'){if(t.designated===null||!a.kind||!a.identity)return false;t.classification=a.kind;t.declared=a.identity;}
 else if(a.k==='engage'){if(t.designated===null||!t.classification||!a.effector)return false;t.attempts.push(a.effector);
  if(this.responseState){const rule=engagementRule(t,a.effector);const receipt=attemptResponse(this.responseState,{tick:a.tick,order:a.order??this.events.length,track:a.track,effector:a.effector},{allowed:(t.rules?.effectors??['hold','rf_jam','kinetic']).includes(a.effector),in_range:rule.inRange,restricted:rule.restricted,compatible:a.effector!=='rf_jam'||t.rf,ideal_match:a.effector===idealFor(t)});if(receipt.status==='pending')capturePriority(this,t,a);(s as ResponseSnapshot).response=responseSnapshot(this.responseState);}
  else {capturePriority(this,t,a);if(engagementRule(t,a.effector).effective){t.resolved=true;t.active=false;}}}
 else return false;this.events.push({...a});this.note(t.id,a.k==='engage'?`Response ${a.effector}`:a.k==='classify'?`Classified ${a.kind} / ${a.identity}`:'Contact designated');return true;
 }
 control(command:InstructorCommand,tick=this.state.tick,order=0){const s=this.state;if(this.commands.some(c=>c.seq===command.seq)||command.seq!==(this.commands.at(-1)?.seq??0)+1||tick!==s.tick||s.done)return false;
 const c={...command,tick,order} as AppliedCommand;
 switch(c.type){
 case 'pause':s.paused=true;break;case 'resume':s.paused=false;break;
 case 'sensor_fault':case 'sensor_restore':{const mode=c.type==='sensor_restore'?'normal':c.payload.mode;switch(c.payload.sensor){case 'radar':this.radarOverride=mode;break;case 'rf':this.rfOverride=mode==='normal';break;case 'eo':this.eoStatus=mode==='normal'?'normal':'failed';break;case 'ir':this.irStatus=mode==='normal'?'normal':'failed';break;}break;}
 case 'environment':s.night=c.payload.night;break;
 case 'inject_contact':case 'inject_swarm':{const count=c.type==='inject_swarm'?6:1,kind=c.type==='inject_swarm'?'quad':c.payload.kind;for(let i=0;i<count;i++){const track={id:`T${s.tracks.length+1}`,kind,identity:'hostile' as const,rf:kind==='quad',spawn:tick,bearing:(c.payload.bearing+i*5)%360,distance:800+i*25,speed:kind==='quad'?15:28,altitude:kind==='quad'?20:8};s.tracks.push({...track,...position(track,tick),active:true,detected:null,designated:null,classification:null,declared:null,resolved:false,impact:false,radar:false,thermal:false,attempts:[],rules:this.scenario.doctrine!.rules});}break;}
 }
 this.commands.push(c);this.note('INSTRUCTOR',c.type);this.observe();return true;
 }
}
export function replay(scenario:Scenario,events:Action[],endTick:number,commands:AppliedCommand[]=[],beforeOrder?:number){
 const sim=new Simulation(scenario);const timeline=[...events.map((a,i)=>({tick:a.tick,order:a.order??i,action:a,command:null as AppliedCommand|null})),...commands.map(c=>({tick:c.tick,order:c.order,action:null as Action|null,command:c}))].filter(e=>e.tick<endTick||(e.tick===endTick&&(beforeOrder===undefined||e.order<beforeOrder))).sort((a,b)=>a.tick-b.tick||a.order-b.order);
 let i=0;while(sim.state.tick<=endTick){while(i<timeline.length&&timeline[i].tick===sim.state.tick){const e=timeline[i++];if(e.command&&!sim.control(e.command,e.tick,e.order))throw new Error(`Invalid command at tick ${sim.state.tick}`);else if(e.action&&!sim.act(e.action))throw new Error(`Invalid action at tick ${sim.state.tick}`);}if(sim.state.tick===endTick||sim.state.done)break;sim.step(true);}return sim;
}
export function score(sim:Simulation):ScoreCard {
 const priority=sim.scenario.prioritisation_version?evaluatePriority(sim):null;const all=sim.state.tracks.filter(t=>sim.state.tick>=t.spawn);const threats=all.filter(t=>t.identity==='hostile');let fratricide=false;let breaches=0;
 const rows:NodeScore[]=all.map(t=>{const isThreat=t.identity==='hostile';const latency=t.detected===null||t.designated===null?null:(t.designated-t.detected)/HZ;const detect=latency===null?0:Math.round(25*Math.max(0,Math.min(1,(20-latency)/17)));
 const classify=t.classification===t.kind&&t.declared===t.identity?25:t.declared===t.identity&&t.classification!==null?12:0;
 const effective=sim.events.filter(a=>a.track===t.id&&a.k==='engage');let successful=false;const feedback:string[]=[];
 const responseActions=sim.responseState?.attempts.filter(r=>r.track===t.id)??[];let actionIndex=0;
 for(const a of effective){const temp={...t,...position(t,a.tick)};const rule=engagementRule(temp,a.effector!);if(rule.restricted){breaches++;feedback.push('Kinetic action attempted in the restricted zone.');}
 if(sim.responseState){if(a.effector!=='hold'&&!isThreat)fratricide=true;if(responseActions[actionIndex].process_valid)successful=true;}else{if(rule.effective&&!isThreat)fratricide=true;if(rule.success)successful=true;}actionIndex++;}
 if(sim.responseState&&effective.length){const valid=responseActions.filter(r=>r.process_valid).length,resolved=responseActions.filter(r=>r.status==='resolved').length;feedback.push(`Response process/outcome: ${valid} suitable executable attempts; ${resolved} delayed effects resolved.`);if(!isThreat&&effective.some(a=>a.effector!=='hold'))feedback.push('Non-hostile destructive response attempted: safety fails regardless of stochastic effect or available resources.');}
 const wrong=effective.filter(a=>a.effector!==idealFor(t)).length;const engage=successful?Math.max(0,35-wrong*7):0;
 const prioritise=isThreat?(priority?priority.points:t.resolved&&!t.impact?15:0):t.attempts.includes('hold')?15:0;
 if(latency===null)feedback.push('Designate the contact after a sensor first reveals it.');else if(latency>3)feedback.push(`Designation took ${latency.toFixed(1)} seconds after first sensor visibility.`);
 if(classify<25)feedback.push(`Reference classification: ${t.kind.replace('_',' ')} / ${t.identity}.`);
 if(!successful)feedback.push(idealFor(t)==='hold'?'Hold fire on this non-hostile contact.':t.rf?'RF-link present: RF jamming is the example-pack response.':'No RF link: use an allowed kinetic response in this example pack.');
 if(wrong)feedback.push(`${wrong} unsuitable response${wrong>1?'s':''}; review the sensor evidence.`);if(t.impact)feedback.push('This threat reached the protected asset.');
 return {id:t.id,kind:t.kind,identity:t.identity,detect,classify,prioritise,engage,total:detect+classify+prioritise+engage,detected:t.detected,designated:t.designated,ideal:idealFor(t),feedback,impact:t.impact,attempts:t.attempts};});
 const relevant=rows.filter(t=>t.identity==='hostile');const leakers=threats.filter(t=>t.impact).length;const raw=relevant.length?relevant.reduce((a,t)=>a+t.total,0)/relevant.length:0;const result=fratricide?0:Math.max(0,Math.round(raw-leakers*10));
 const recognition=rows.length?Math.round(rows.reduce((a,t)=>a+t.classify,0)/(rows.length*25)*100):0;const response=rows.length?Math.round(rows.reduce((a,t)=>a+t.engage,0)/(rows.length*35)*100):0;
 return {score:result,passed:result>=70&&!fratricide&&breaches===0,fratricide,roe_breaches:breaches,leakers,threats:threats.length,rows,skills:{recognition,response},summary:fratricide?'Non-hostile engagement: session failed.':leakers?`${leakers} threat${leakers>1?'s':''} reached the protected asset. Review response selection.`:result>=70?'Good control. Repeat with a new scenario seed.':'Review designation, classification, and response before the next drill.',engine_version:ENGINE_VERSION,...(priority?{prioritisation:priority}:{}),...(sim.responseState?{response_model:responseReport(sim.responseState)}:{})};
}
