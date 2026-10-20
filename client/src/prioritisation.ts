import type {Action,DoctrineRules,PriorityComparison,PriorityFact,PriorityReport,Track} from './types';
import type {Simulation} from './sim';
const rounded=(x:number,n:number)=>Math.round(x*10**n)/10**n;
export function priorityFact(t:Track,rules:DoctrineRules,tick:number):PriorityFact {
 const raw=Math.hypot(t.x,t.z),distance=rules.distance_precision===undefined?raw:rounded(raw,rules.distance_precision);const tti=Math.max(0,(distance-8)/t.speed),risk=(rules.risk_weights[t.kind]??1)*rules.asset_risk;
 return {track_id:t.id,tick,time_to_impact:rounded(tti,6),risk:rounded(risk,6),priority:rounded(risk/Math.max(tti,1/30),9)};
}
export function capturePriority(sim:Simulation,t:Track,a:Action){
 if(!sim.scenario.prioritisation_version||a.effector==='hold'||t.identity!=='hostile'||sim.priorityDecisions.some(d=>d.chosen.track_id===t.id))return;
 const facts=sim.state.tracks.filter(x=>x.active&&x.detected!==null&&x.identity==='hostile').map(x=>priorityFact(x,sim.scenario.doctrine!.rules,sim.state.tick));
 sim.priorityDecisions.push({tick:sim.state.tick,order:a.order??sim.events.length,chosen:facts.find(x=>x.track_id===t.id)!,available:facts.sort((a,b)=>b.priority-a.priority||a.track_id.localeCompare(b.track_id))});
}
export function evaluatePriority(sim:Simulation):PriorityReport {
 const comparisons:PriorityComparison[]=[],seen=new Set<string>();
 for(const d of sim.priorityDecisions)for(const b of d.available){const a=d.chosen,pair=[a.track_id,b.track_id].sort().join(':');if(a.track_id===b.track_id||seen.has(pair))continue;seen.add(pair);const delta=a.priority-b.priority;comparisons.push({tick:d.tick,order:d.order,chosen:a,other:b,outcome:Math.abs(delta)<1e-9?'tie':delta>0?'concordant':'inverted',expected_first:delta>=0?a.track_id:b.track_id});}
 const relevant=sim.state.tracks.filter(t=>t.identity==='hostile'&&t.detected!==null&&t.spawn<=sim.state.tick),chosen=new Set(sim.priorityDecisions.map(d=>d.chosen.track_id)),nonTies=comparisons.filter(p=>p.outcome!=='tie');
 const tau=nonTies.length?2*nonTies.filter(p=>p.outcome==='concordant').length/nonTies.length-1:null,agreement=tau===null?1:(tau+1)/2,coverage=relevant.length?relevant.filter(t=>chosen.has(t.id)).length/relevant.length:0;
 return {version:1,method:'pairwise Kendall agreement over co-observed hostile choices, multiplied by engagement coverage',tau,agreement,coverage,points:Math.round(15*agreement*coverage),points_possible:15,comparisons,choices:sim.priorityDecisions,unengaged:relevant.filter(t=>!chosen.has(t.id)).map(t=>t.id),tie_rule:'Equal priority pairs are excluded; no comparable pairs yields neutral agreement 1, still multiplied by coverage.',priority_rule:'risk_weight × asset_risk / max(time_to_impact_seconds, 1/30)',ordering_rule:'First accepted non-Hold engagement per hostile; an ineffective attempt still declares attention. Pairs counted once, at their first co-observed choice.'};
}
