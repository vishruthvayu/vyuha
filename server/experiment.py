"""Pre-specified abstract Bernoulli learner model, not human efficacy evidence."""
import copy,hashlib,json,random,statistics
from .director import SKILLS,select_director,adapt_scenario,TEMPLATES,difficulty
from .exercises import enrich

def run(config):
 if config['schema_version']!=1 or not 1<=config['learners']<=200 or not 1<=config['sessions']<=50:raise ValueError('Unsupported experiment size/version')
 if len(config['seeds'])!=config['learners'] or len(set(config['seeds']))!=config['learners']:raise ValueError('Unique pre-specified seed per learner required')
 results=[]
 for seed in config['seeds']:
  initial={s:random.Random(f'{seed}:{s}:initial').uniform(*config['initial_range']) for s in SKILLS}
  for policy in ['director','random']:
   hidden=initial.copy();beta={s:[1.0,1.0] for s in SKILLS};history=[];outcome_log=[];failures=0;threshold=None;trajectory=[];previous=None;repeats=0
   for n in range(config['sessions']):
    skills={s:dict(alpha=v[0],beta=v[1],mean=v[0]/sum(v),observations=int(sum(v)-2),updated_at=None,last_session_id=None) for s,v in beta.items()}
    profile=dict(trainee='SYNTHETIC',skills=skills,outcomes=outcome_log)
    selection_seed=int.from_bytes(hashlib.sha256(f'{seed}:{n}:selection'.encode()).digest()[:4],'big')
    decision=select_director(profile,history,selection_seed)
    if policy=='random':
     r=random.Random(selection_seed);focus=r.choice(SKILLS);template=r.choice(TEMPLATES[focus]);level=difficulty(skills[focus]['mean'])
     decision.update(focus_skill=focus,scenario_template=f'{focus}/{template}',difficulty=level,difficulty_label=['foundational','standard','challenging'][level-1],mastery_estimate=skills[focus]['mean'],observations=skills[focus]['observations'])
    scenario=enrich(adapt_scenario(decision),'army-forward-post',history=history)
    d=scenario['director_decision'];focus=d['focus_skill'];repeat=d['scenario_template']==previous;repeats+=repeat;previous=d['scenario_template']
    outcomes={}
    # Equal four-task assessments and common random uniforms in both arms.
    # This is an abstract selection experiment, not tactical-simulator learner validation.
    for s in SKILLS:
     success=random.Random(f'{seed}:{n}:{s}:assessment').random()<hidden[s]
     beta[s][0 if success else 1]+=1;failures+=not success;outcomes[s]=dict(successes=int(success),failures=int(not success))
    outcome_log.append(dict(skills=outcomes));history=[d,*history][:5]
    hidden[focus]+=config['learning_gain']*(1-hidden[focus])
    if threshold is None and min(hidden.values())>=config['threshold']:threshold=n+1
    trajectory.append(dict(session=n+1,focus=focus,template=d['scenario_template'],pattern=scenario['red_force']['tactic'],difficulty=d['difficulty'],hidden=hidden.copy(),beta_means={s:sum_v[0]/sum(sum_v) for s,sum_v in beta.items()},outcomes=outcomes))
   results.append(dict(seed=seed,policy=policy,initial_hidden=initial,final_hidden=hidden,threshold_session=threshold,cumulative_failures=failures,final_hidden_mean=statistics.mean(hidden.values()),weakest_hidden_gain=min(hidden.values())-min(initial.values()),immediate_template_repeats=repeats,trajectory=trajectory))
 summary={}
 for policy in ['director','random']:
  rows=[r for r in results if r['policy']==policy];reached=[r['threshold_session'] for r in rows if r['threshold_session'] is not None]
  summary[policy]=dict(learners=len(rows),reached_threshold=len(reached),median_sessions_among_reached=statistics.median(reached) if reached else None,mean_cumulative_failures=statistics.mean(r['cumulative_failures'] for r in rows),mean_final_hidden_performance=statistics.mean(r['final_hidden_mean'] for r in rows),mean_weakest_skill_gain=statistics.mean(r['weakest_hidden_gain'] for r in rows),mean_immediate_repeats=statistics.mean(r['immediate_template_repeats'] for r in rows))
 return dict(label='SIMULATED TRAINING EXPERIMENT — NOT HUMAN EFFICACY EVIDENCE',config=copy.deepcopy(config),method='Paired seeds, identical initial hidden probabilities, assessment uniforms and focused learning law. Production Thompson selector/template adapter/Red Force versus uniform random focus/template; identical Beta-based difficulty rule. One abstract Bernoulli assessment per canonical skill/session. Hidden competence is separate from Beta estimates. No tactical physics, human learners or empirical learning-rate calibration.',summary=summary,results=results)
