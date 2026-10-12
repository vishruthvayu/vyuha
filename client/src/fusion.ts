/** Evidence-only training heuristic. Normalized scores are not calibrated probabilities. */
import type {SensorObservation} from './sensors-v2';
export const FUSION_VERSION = 'fusion-1';
export const FUSION_KINDS = ['bird','quad','fixed_wing','fiber_fpv'] as const;
export type FusionKind = typeof FUSION_KINDS[number];
export type FusionConfig = {version:typeof FUSION_VERSION;mode:'training'|'assessment';exercise:'normal'|'rf_overweight';bias_seed:number};
export type OperatorPrior = {kind?:FusionKind|null;identity?:'friendly'|'neutral'|'hostile'|null};
export type FusionContext = {session_id:string;scenario_id:string;before_order?:number};
export type CueContribution = {cue:string;reason:string;weights:number[]};
export type FusionEvidence = {tick:number;track_id:string;radar:string;optical:{channel:'eo'|'ir';level:string;shape:string|null;sample_tick:number|null}[];rf:'signal'|'no_signal'|'unavailable';iff:string};
export type FusionAdvice = {version:typeof FUSION_VERSION;exposure_id:string;evidence:FusionEvidence;prior:OperatorPrior;config:FusionConfig;context:FusionContext;hypotheses:{kind:FusionKind;score:number}[];uncertainty:number;identity:'friendly_cue'|'registered_civil_cue'|'unresolved';recommendation:'observe'|'verify_identity'|'hold';contributions:CueContribution[];bias_injected:boolean;limitations:string[]};
export const defaultFusionConfig:Readonly<FusionConfig> = Object.freeze({version:FUSION_VERSION,mode:'training',exercise:'normal',bias_seed:0});
const q = (n:number) => Math.floor(n*1e6+.5)/1e6;
function integer(n:unknown,max=5400):n is number{return typeof n==='number'&&Number.isInteger(n)&&n>=0&&n<=max;}
export function fusionConfiguration(input:Partial<FusionConfig> = {}):FusionConfig {
  for(const key of Object.keys(input)) if(!['version','mode','exercise','bias_seed'].includes(key)) throw Error('Unknown fusion config');
  const c={...defaultFusionConfig,...input};
  if(c.version!==FUSION_VERSION||!['training','assessment'].includes(c.mode)||!['normal','rf_overweight'].includes(c.exercise)||!integer(c.bias_seed,4294967295)) throw Error('Invalid fusion config');
  return c;
}
export function sanitizeFusionEvidence(input:SensorObservation):FusionEvidence {
  if(!input||input.version!=='vyuha-0.4.0'||!integer(input.tick)||typeof input.track_id!=='string'||!/^[-A-Za-z0-9_]{1,64}$/.test(input.track_id)) throw Error('Invalid observation envelope');
  const optical:FusionEvidence['optical']=[];
  for(const channel of ['eo','ir'] as const){
    const o=input[channel];
    if(o?.available===true&&['detect','recognise','identify'].includes(o.level)&&integer(o.sample_tick)&&input.tick-o.sample_tick>=0&&input.tick-o.sample_tick<=6){
      const shape=o.level==='detect'?null:['bird','fixed_wing','multirotor'].includes(o.silhouette??'')?o.silhouette:null;
      optical.push({channel,level:o.level,shape,sample_tick:o.sample_tick});
    }
  }
  const r=input.radar;
  const radar=r?.available===true&&integer(r.sample_tick)&&input.tick-r.sample_tick>=0&&input.tick-r.sample_tick<=90&&['tentative','confirmed','lost'].includes(r.state)?r.state:'none';
  const rf=input.rf?.available===true?(input.rf.detected===true?'signal':'no_signal'):'unavailable';
  const iff=input.iff?.available===true&&['friendly_reply','registered_civil','no_reply'].includes(input.iff.cue)?input.iff.cue:'unavailable';
  return {tick:input.tick,track_id:input.track_id,radar,optical,rf,iff};
}
function sanitizePrior(p:OperatorPrior):OperatorPrior {
  if(p.kind!=null&&!FUSION_KINDS.includes(p.kind)||p.identity!=null&&!['friendly','neutral','hostile'].includes(p.identity)) throw Error('Invalid operator prior');
  return {kind:p.kind??null,identity:p.identity??null};
}
// Stable non-cryptographic receipt identifier. Server MUST reconstruct and compare payload;
// this checksum is neither a signature nor authorization proof.
function hash(s:string){let h=2166136261;for(let i=0;i<s.length;i++){h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;}return h.toString(16).padStart(8,'0');}
export function fusionAdvice(observation:SensorObservation,prior:OperatorPrior={},config:Partial<FusionConfig>={},context:FusionContext={session_id:'local',scenario_id:'local'}):FusionAdvice|null {
  const c=fusionConfiguration(config);
  if(c.mode==='assessment') return null;
  if(![context.session_id,context.scenario_id].every(v=>typeof v==='string'&&/^[-A-Za-z0-9_.:]{1,100}$/.test(v))) throw Error('Invalid fusion context');
  const boundary=context.before_order??0;
  if(!integer(boundary,100001)) throw Error('Invalid fusion boundary');
  context={session_id:context.session_id,scenario_id:context.scenario_id,before_order:boundary};
  const evidence=sanitizeFusionEvidence(observation), operator=sanitizePrior(prior), contributions:CueContribution[]=[];
  const add=(cue:string,reason:string,weights:number[])=>contributions.push({cue,reason,weights});
  // EO and IR report the same shape hypothesis; correlated shapes contribute once.
  const shapes=[...new Set(evidence.optical.map(o=>o.shape).filter(Boolean))];
  if(shapes.length===1){
    const shape=shapes[0];
    add('optical_shape',`Observed ${shape} silhouette; EO/IR are counted once.`,shape==='bird'?[2,-.5,-.5,-.5]:shape==='fixed_wing'?[-.5,-.5,2,-.5]:[-.5,1,-.5,1]);
  }else if(shapes.length>1) add('optical_conflict','EO/IR shapes disagree; retain uncertainty.',[0,0,0,0]);
  else if(evidence.optical.length) add('optical_detection','Detection alone does not identify type.',[0,0,0,0]);
  if(evidence.rf==='signal') add('rf_signal','An RF emission is observed; association and control medium remain uncertain.',[-.15,.4,.15,-.15]);
  if(evidence.rf==='no_signal') add('rf_silence','No emission detected; silence does not prove fiber control or hostile intent.',[0,-.05,0,.05]);
  if(evidence.radar!=='none') add('radar_track','Radar track lifecycle supports observation, not affiliation or type.',[0,0,0,0]);
  if(operator.kind) add('operator_prior','Operator label is a weak prior, not independent sensor evidence.',FUSION_KINDS.map(k=>k===operator.kind? .2:0));
  const bias=c.exercise==='rf_overweight';
  if(bias) add('exercise_bias','Synthetic automation-bias exercise overweights an assumed RF-controlled quad; challenge the recommendation.',[0,3+(c.bias_seed%3)*.1,0,0]);
  const raw=FUSION_KINDS.map((_,i)=>Math.max(.05,1+contributions.reduce((n,part)=>n+part.weights[i],0)));
  const total=raw.reduce((a,b)=>a+b,0), probabilities=raw.map(v=>v/total);
  const hypotheses=FUSION_KINDS.map((kind,i)=>({kind,score:q(probabilities[i])})).sort((a,b)=>b.score-a.score||FUSION_KINDS.indexOf(a.kind)-FUSION_KINDS.indexOf(b.kind));
  const identity=evidence.iff==='friendly_reply'?'friendly_cue':evidence.iff==='registered_civil'?'registered_civil_cue':'unresolved';
  const visible=evidence.optical.length>0||evidence.radar==='confirmed';
  const recommendation=identity!=='unresolved'?'hold':visible?'verify_identity':'observe';
  const payload=JSON.stringify([FUSION_VERSION,context.session_id,context.scenario_id,boundary,c.mode,c.exercise,c.bias_seed,evidence,operator]);
  return {version:FUSION_VERSION,exposure_id:`fusion-${hash(payload)}`,evidence,prior:operator,config:c,context:{...context},hypotheses,uncertainty:q(-probabilities.reduce((s,p)=>s+p*Math.log(p),0)/Math.log(4)),identity,recommendation,contributions,bias_injected:bias,limitations:['Illustrative heuristic scores, not calibrated posterior probabilities.','RF silence and absent IFF reply do not establish hostile intent.','Optical shape cannot identify RF-control medium.','Advice is training-only; decisions remain with the operator.']};
}
/** Proper multiclass quadratic score: 0 ideal, 2 maximally incorrect; no calibration claim. */
export function brierScore(distribution:Record<FusionKind,number>,reference:FusionKind){
  const values=FUSION_KINDS.map(k=>distribution[k]);
  if(Object.keys(distribution).length!==4||Object.keys(distribution).some(k=>!FUSION_KINDS.includes(k as FusionKind))||!FUSION_KINDS.includes(reference)||!values.every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1)||Math.abs(values.reduce((a,b)=>a+b,0)-1)>1e-6) throw Error('Invalid confidence distribution');
  return q(FUSION_KINDS.reduce((sum,k)=>sum+(distribution[k]-(k===reference?1:0))**2,0));
}
export type RelianceReview = {exposure_id:string;relation:'aligned'|'overrode'|'unassessable';bias_injected:boolean;note:string};
export function reviewReliance(advice:FusionAdvice,decision:{tick:number;track:string;kind?:FusionKind|null},maxAgeTicks=90):RelianceReview {
  const assessable=decision.track===advice.evidence.track_id&&decision.tick>=advice.evidence.tick&&decision.tick-advice.evidence.tick<=maxAgeTicks&&decision.kind!=null;
  return {exposure_id:advice.exposure_id,relation:!assessable?'unassessable':decision.kind===advice.hypotheses[0].kind?'aligned':'overrode',bias_injected:advice.bias_injected,note:'Alignment is an observed comparison, not proof of cognitive reliance or decision correctness.'};
}
