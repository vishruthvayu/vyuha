"""Auditable pairwise ranking on simultaneously observed hostile contacts."""
import math

def priority_fact(t,rules,tick):
 distance=math.hypot(t['x'],t['z'])
 if rules.get('distance_precision') is not None:distance=round(distance,rules['distance_precision'])
 tti=max(0,(distance-8)/t['speed'])
 risk=rules['risk_weights'].get(t['kind'],1)*rules['asset_risk']
 return dict(track_id=t['id'],tick=tick,time_to_impact=round(tti,6),risk=round(risk,6),priority=round(risk/max(tti,1/30),9))

def capture(sim,t,a):
 if not sim.scenario.get('prioritisation_version') or a['effector']=='hold' or t['identity']!='hostile' or any(d['chosen']['track_id']==t['id'] for d in sim.priority_decisions):return
 facts=[priority_fact(x,sim.scenario['doctrine']['rules'],sim.tick) for x in sim.tracks if x['active'] and x['detected'] is not None and x['identity']=='hostile']
 chosen=next(x for x in facts if x['track_id']==t['id'])
 sim.priority_decisions.append(dict(tick=sim.tick,order=a.get('order',len(sim.events)),chosen=chosen,available=sorted(facts,key=lambda x:(-x['priority'],x['track_id']))))

def evaluate(sim):
 comparisons=[];seen=set()
 for d in sim.priority_decisions:
  a=d['chosen']
  for b in d['available']:
   pair=tuple(sorted([a['track_id'],b['track_id']]))
   if a['track_id']==b['track_id'] or pair in seen:continue
   seen.add(pair);delta=a['priority']-b['priority']
   comparisons.append(dict(tick=d['tick'],order=d['order'],chosen=a,other=b,outcome='tie' if abs(delta)<1e-9 else 'concordant' if delta>0 else 'inverted',expected_first=a['track_id'] if delta>=0 else b['track_id']))
 relevant=[t for t in sim.tracks if t['identity']=='hostile' and t['detected'] is not None and t['spawn']<=sim.tick]
 chosen={d['chosen']['track_id'] for d in sim.priority_decisions}
 non_ties=[p for p in comparisons if p['outcome']!='tie'];concordant=sum(p['outcome']=='concordant' for p in non_ties)
 tau=(2*concordant/len(non_ties)-1) if non_ties else None
 agreement=(tau+1)/2 if tau is not None else 1
 coverage=sum(t['id'] in chosen for t in relevant)/len(relevant) if relevant else 0
 points=math.floor(15*agreement*coverage+.5)
 return dict(version=1,method='pairwise Kendall agreement over co-observed hostile choices, multiplied by engagement coverage',tau=tau,agreement=agreement,coverage=coverage,points=points,points_possible=15,comparisons=comparisons,choices=sim.priority_decisions,unengaged=[t['id'] for t in relevant if t['id'] not in chosen],tie_rule='Equal priority pairs are excluded; no comparable pairs yields neutral agreement 1, still multiplied by coverage.',priority_rule='risk_weight × asset_risk / max(time_to_impact_seconds, 1/30)',ordering_rule='First accepted non-Hold engagement per hostile; an ineffective attempt still declares attention. Pairs counted once, at their first co-observed choice.')
