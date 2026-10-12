/** Opt-in finite resources and delayed seeded training effects. Uncalibrated. */
import {sensorSample} from './sensors-v2';
export type ResponseConfig={version:1;illustrative_training_assumptions:true;kinetic_ammo:number;kinetic_cooldown_ticks:number;kinetic_delay_ticks:number;kinetic_success_probability:number;jammer_channels:number;jammer_duration_ticks:number;jammer_success_probability:number};
export const defaultResponseConfig:Readonly<ResponseConfig>=Object.freeze({version:1,illustrative_training_assumptions:true,kinetic_ammo:8,kinetic_cooldown_ticks:30,kinetic_delay_ticks:15,kinetic_success_probability:.85,jammer_channels:2,jammer_duration_ticks:90,jammer_success_probability:.75});
export type ResponseStatus='hold'|'blocked_ammo'|'blocked_cooldown'|'blocked_channels'|'unavailable'|'pending'|'resolved'|'no_effect'|'target_inactive';
export type ResponseIntent={tick:number;order?:number;track:string;effector:'hold'|'kinetic'|'rf_jam'};
export type ResponseEligibility={allowed:boolean;in_range:boolean;restricted:boolean;compatible:boolean;ideal_match:boolean};
export type PublicResponseAttempt={id:string;track:string;effector:ResponseIntent['effector'];tick:number;order:number;due_tick:number|null;status:ResponseStatus;result_tick:number|null};
export type ResponseAttempt=PublicResponseAttempt&{process_valid:boolean;launch_eligible:boolean};
export type ResponseState={version:1;config:ResponseConfig;kinetic_ammo_remaining:number;kinetic_ready_tick:number;last_tick:number;attempts:ResponseAttempt[]};
export type PublicResponseState={version:1;kinetic_ammo_remaining:number;kinetic_ready_tick:number;jammer_channels_in_use:number;pending:string[];attempts:PublicResponseAttempt[]};
const bounds:Record<string,[number,number]>={kinetic_ammo:[0,200],kinetic_cooldown_ticks:[1,300],kinetic_delay_ticks:[1,300],kinetic_success_probability:[0,1],jammer_channels:[1,8],jammer_duration_ticks:[1,300],jammer_success_probability:[0,1]};
const ints=new Set(['kinetic_ammo','kinetic_cooldown_ticks','kinetic_delay_ticks','jammer_channels','jammer_duration_ticks']);
export function responseConfiguration(overrides:Partial<ResponseConfig>={}):ResponseConfig{
 if(!overrides||typeof overrides!=='object'||Object.keys(overrides).some(k=>!(k in defaultResponseConfig)))throw Error('Unknown response configuration');
 const c={...defaultResponseConfig,...overrides};if(c.version!==1||c.illustrative_training_assumptions!==true)throw Error('Unsupported response configuration');
 for(const [key,[lo,hi]] of Object.entries(bounds)){const v=c[key as keyof ResponseConfig];if(typeof v!=='number'||!Number.isFinite(v)||v<lo||v>hi||ints.has(key)&&!Number.isInteger(v))throw Error('Response parameter outside bounds: '+key);}
 return c;
}
export function createResponseState(config?:Partial<ResponseConfig>):ResponseState{const c=responseConfiguration(config);return {version:1,config:c,kinetic_ammo_remaining:c.kinetic_ammo,kinetic_ready_tick:0,last_tick:0,attempts:[]};}
export const channelCount=(state:ResponseState)=>state.attempts.filter(a=>a.effector==='rf_jam'&&a.status==='pending').length;
export function attemptResponse(state:ResponseState,action:ResponseIntent,eligibility:ResponseEligibility){
 const tick=action.tick,effector=action.effector,c=state.config;
 if(!Number.isInteger(tick)||tick<state.last_tick||!['hold','kinetic','rf_jam'].includes(effector))throw Error('Invalid response attempt');
 if(['allowed','in_range','restricted','compatible','ideal_match'].some(k=>typeof eligibility[k as keyof ResponseEligibility]!=='boolean'))throw Error('Invalid reference eligibility');
 state.last_tick=tick;
 const due=effector==='kinetic'?tick+c.kinetic_delay_ticks:effector==='rf_jam'?tick+c.jammer_duration_ticks:null;
 const a:ResponseAttempt={id:`R${state.attempts.length+1}`,track:action.track,effector,tick,order:action.order??state.attempts.length,due_tick:due,status:'pending',result_tick:null,process_valid:false,launch_eligible:eligibility.allowed&&eligibility.in_range&&!eligibility.restricted&&eligibility.compatible};
 if(!eligibility.allowed)a.status='unavailable';
 else if(effector==='hold'){a.status='hold';a.process_valid=eligibility.ideal_match&&eligibility.in_range;}
 else if(effector==='kinetic'){
  if(state.kinetic_ammo_remaining<=0)a.status='blocked_ammo';else if(tick<state.kinetic_ready_tick)a.status='blocked_cooldown';
  else {state.kinetic_ammo_remaining--;state.kinetic_ready_tick=tick+c.kinetic_cooldown_ticks;a.process_valid=a.launch_eligible&&eligibility.ideal_match;}
 }else if(channelCount(state)>=c.jammer_channels)a.status='blocked_channels';else a.process_valid=a.launch_eligible&&eligibility.ideal_match;
 if(a.status!=='pending'){a.due_tick=null;a.result_tick=tick;}state.attempts.push(a);return a;
}
export function advanceResponse(state:ResponseState,tick:number,seed:number,targetStatus:(id:string,effector:ResponseIntent['effector'])=>{active:boolean;effective:boolean}|null,resolve:(id:string)=>void){
 if(!Number.isInteger(tick)||tick<state.last_tick)throw Error('Response clock moved backwards');state.last_tick=tick;const completed:string[]=[];
 state.attempts.forEach((a,index)=>{if(a.status!=='pending'||a.due_tick!>tick)return;
 const target=targetStatus(a.track,a.effector);if(!target?.active)a.status='target_inactive';else{
 const probability=a.effector==='kinetic'?state.config.kinetic_success_probability:state.config.jammer_success_probability;
 const draw=sensorSample(seed,a.tick,index,a.effector==='kinetic'?71:72);
 if(a.launch_eligible&&target.effective&&draw<probability){resolve(a.track);a.status='resolved';}else a.status='no_effect';}
 a.result_tick=tick;completed.push(a.id);});return completed;
}
export function responseSnapshot(state:ResponseState):PublicResponseState{return {version:1,kinetic_ammo_remaining:state.kinetic_ammo_remaining,kinetic_ready_tick:state.kinetic_ready_tick,jammer_channels_in_use:channelCount(state),pending:state.attempts.filter(a=>a.status==='pending').map(a=>a.id),attempts:state.attempts.map(({id,track,effector,tick,order,due_tick,status,result_tick})=>({id,track,effector,tick,order,due_tick,status,result_tick}))};}
export function responseReport(state:ResponseState){return {...responseSnapshot(state),basis:'Illustrative seeded delayed effects; engagement points credit executable suitable process separately from stochastic resolution. Non-hostile destructive attempts fail safety regardless of result.',process_valid_attempts:state.attempts.filter(a=>a.process_valid).length,resolved_effects:state.attempts.filter(a=>a.status==='resolved').length,no_effect_results:state.attempts.filter(a=>a.status==='no_effect').length,reference_attempts:state.attempts.map(a=>({...a}))};}
