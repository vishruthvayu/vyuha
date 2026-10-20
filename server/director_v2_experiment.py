"""Repeatable synthetic curriculum comparison; no database or human evidence.

The policy sees only synthetic processed successes/failures, never latent skill.
Task difficulty offsets, practice gains and decay are assumptions. This tests
selection consequences under those assumptions, not training effectiveness.
"""
import argparse
import copy
import hashlib
import json
import math
import random
import statistics
from collections import Counter

from .director import SKILLS, select_director
from .director_v2 import select_policy

REGIMES = {
    'stationary': dict(practice_gain=0.0, unpractised_decay=0.0),
    'plastic_moderate_forgetting': dict(practice_gain=.035, unpractised_decay=.002),
    'slow_learning_fast_forgetting': dict(practice_gain=.010, unpractised_decay=.006),
}
DIFFICULTY_OFFSETS = {1:.20, 2:0.0, 3:-.20}
LIMITATION = 'Synthetic model evidence only; no human learning efficacy, calibrated difficulty or operational competence claim.'


def initial_profile():
    return dict(trainee='SYNTHETIC', sessions=0, skills={s:dict(alpha=1., beta=1., observations=0, mean=.5, updated_at=None, last_session_id=None) for s in SKILLS}, outcomes=[], unprocessed_sessions=[])


def run_learner(seed, policy, regime, sessions=60):
    if policy not in {'v1_thompson', 'v2_adjusted'} or regime not in REGIMES or not 1 <= sessions <= 200:
        raise ValueError('Unsupported bounded experiment configuration')
    rng = random.Random(seed)
    ability = {s:min(.9,max(.1,base+rng.uniform(-.05,.05))) for s,base in zip(SKILLS,[.25,.65,.45,.30])}
    initial = statistics.mean(ability.values())
    profile = initial_profile()
    history, trace = [], []
    totals = Counter();focus_counts = Counter();difficulty_counts = Counter()
    previous_template = None
    config = REGIMES[regime]
    for step in range(sessions):
        policy_seed = (seed*65537+step) % 2**32
        before = copy.deepcopy(profile)
        if policy == 'v1_thompson':
            decision = select_director(profile, history, policy_seed)
        else:
            decision, _ = select_policy(profile, history, policy_seed, '0'*64)
        if profile != before:
            raise AssertionError('Selection modified its evidence snapshot')
        focus, level = decision['focus_skill'], decision['difficulty']
        probability = max(.05, min(.95, ability[focus]+DIFFICULTY_OFFSETS[level]))
        # Paired seed/step/skill random variates. No policy gets hidden skill.
        outcomes_rng = random.Random((seed<<20) ^ (step<<12) ^ (SKILLS.index(focus)*331))
        successes = sum(outcomes_rng.random() < probability for _ in range(4))
        failures = 4-successes
        counts = {s:dict(successes=0, failures=0) for s in SKILLS}
        counts[focus] = dict(successes=successes, failures=failures)
        estimate = profile['skills'][focus]
        estimate['alpha'] += successes;estimate['beta'] += failures
        estimate['observations'] += 4;estimate['mean'] = estimate['alpha']/(estimate['alpha']+estimate['beta'])
        profile['sessions'] += 1
        profile['outcomes'].append(dict(skills=counts))
        profile['outcomes'] = profile['outcomes'][-50:]
        template = decision['scenario_template']
        totals['immediate_template_repeats'] += int(template==previous_template)
        totals['successes'] += successes;totals['observations'] += 4
        focus_counts[focus] += 1;difficulty_counts[str(level)] += 1
        trace.append([focus, level, template, successes])
        history = [decision]+history[:4];previous_template = template
        # Assumed learning peaks at moderate task success; gains are hypothetical.
        gain = config['practice_gain'] * (4*probability*(1-probability)) * (1-ability[focus])
        ability[focus] = min(.95, ability[focus]+gain)
        for skill in SKILLS:
            if skill != focus:
                ability[skill] = max(.05, ability[skill]-config['unpractised_decay'])
    return dict(seed=seed, policy=policy, regime=regime, sessions=sessions, initial_latent_mastery=initial, final_latent_mastery=statistics.mean(ability.values()), standard_probe_expected_success=statistics.mean(ability.values()), training_contact_success=totals['successes']/totals['observations'], focus_counts=dict(focus_counts), difficulty_counts=dict(difficulty_counts), immediate_template_repeat_rate=totals['immediate_template_repeats']/max(1,sessions-1), trace_sha256=hashlib.sha256(json.dumps(trace,separators=(',',':')).encode()).hexdigest())


def experiment(seeds=24, sessions=60):
    if not 2 <= seeds <= 200 or not 1 <= sessions <= 200:
        raise ValueError('Experiment size outside bounded range')
    rows = [run_learner(seed,policy,regime,sessions) for regime in REGIMES for seed in range(10000,10000+seeds) for policy in ['v1_thompson','v2_adjusted']]
    summaries = {}
    for regime in REGIMES:
        paired = [(next(r for r in rows if r['regime']==regime and r['seed']==seed and r['policy']=='v1_thompson'),next(r for r in rows if r['regime']==regime and r['seed']==seed and r['policy']=='v2_adjusted')) for seed in range(10000,10000+seeds)]
        differences = [b['final_latent_mastery']-a['final_latent_mastery'] for a,b in paired]
        mean = statistics.mean(differences)
        half_width = 1.96*statistics.stdev(differences)/math.sqrt(seeds)
        summaries[regime] = dict(paired_seeds=seeds, v1={key:statistics.mean(a[key] for a,_ in paired) for key in ['final_latent_mastery','training_contact_success','immediate_template_repeat_rate']}, v2={key:statistics.mean(b[key] for _,b in paired) for key in ['final_latent_mastery','training_contact_success','immediate_template_repeat_rate']}, paired_latent_mastery_difference=mean, approximate_normal_95_interval=[mean-half_width,mean+half_width], interval_basis='Seed-level paired synthetic differences; approximate normal interval, not human efficacy')
    return dict(schema_version=1, limitation=LIMITATION, policy_inputs='Only four Beta posteriors and processed outcome/history windows; latent skill is withheld from both policies', configuration=dict(seed_start=10000,seeds=seeds,sessions=sessions,contacts_per_session=4,initial_skill_centres=[.25,.65,.45,.30],initial_jitter=.05,difficulty_success_offsets=DIFFICULTY_OFFSETS,regimes=REGIMES,learning='gain*(4*p*(1-p))*(1-ability) on practised skill; linear decay on other skills',outcome_window=50), interpretation='Training success is confounded by chosen task difficulty. Identical-standard latent probe is the synthetic learning comparison; stationary learners provide a no-learning control.', summaries=summaries, runs=rows)


def render_report(result):
    lines=['# Director v2 synthetic policy comparison', '', '**Synthetic model evidence only — no demonstrated human learning benefit.**', '', result['limitation'], '', f"Compared {result['configuration']['seeds']} paired seeds per regime, {result['configuration']['sessions']} sessions and four synthetic contact outcomes per session. Both policies see the same type of processed evidence; latent skill is withheld. No user profiles, scenarios or completed histories are written.", '', '| Synthetic regime | V1 final latent probe | V2 final latent probe | Paired V2−V1 | Approx. 95% seed interval | V1/V2 training success |', '| --- | --- | --- | --- | --- | --- |']
    for name,row in result['summaries'].items():
        low,high=row['approximate_normal_95_interval']
        lines.append(f"| {name.replace('_',' ')} | {row['v1']['final_latent_mastery']:.4f} | {row['v2']['final_latent_mastery']:.4f} | {row['paired_latent_mastery_difference']:+.4f} | [{low:+.4f}, {high:+.4f}] | {row['v1']['training_contact_success']:.4f} / {row['v2']['training_contact_success']:.4f} |")
    lines += ['', 'No positive learning advantage is established by the recorded regimes when their paired intervals include zero. Training success and learning must be interpreted separately.', '', 'The interval describes paired synthetic seed variability under the stated model. It is not a clinical, human or operational training estimate. Higher training success can follow easier tasks without better learning; the stationary regime explicitly separates those effects. Do not select only a favourable regime or convert these figures into a measured human improvement claim.', '', '## Assumptions and reproducibility', '', 'Only the selected skill receives four synthetic outcomes in a session; real VYUHA drills can generate evidence for multiple skills, so this is selector sensitivity rather than an end-to-end trainee model. Four latent skills start near 0.25/0.65/0.45/0.30 with ±0.05 seeded jitter. Foundational/standard/challenging tasks shift success probability by +0.20/0/−0.20, clipped to [0.05,0.95]. Learning and unpractised decay follow the coefficients in the JSON; these are illustrative model assumptions, not calibrated learner data. Contact Bernoulli outcomes are paired by seed, step and skill. The identical-standard probe is the mean latent ability, not an observed human test.', '', 'Run `PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -m server.director_v2_experiment --output <directory>` from the repository. The JSON records exact configuration, per-seed results, policy/focus/difficulty counts and trace hashes. Repetition tests assert determinism, bounded outcomes, unchanged policy inputs and identical stationary latent skill rather than assuming v2 wins.', '', 'Actual Raid Composer diversity/validity, full-engine parity, curriculum portability and live UI remain separate acceptance evidence. This experiment does not run the 3D simulator or substitute for a controlled human evaluation.']
    return '\n'.join(lines)+'\n'


if __name__ == '__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--output',required=True);parser.add_argument('--seeds',type=int,default=24);parser.add_argument('--sessions',type=int,default=60)
    args=parser.parse_args()
    from pathlib import Path
    destination=Path(args.output);destination.mkdir(parents=True,exist_ok=True)
    result=experiment(args.seeds,args.sessions)
    (destination/'DIRECTOR-V2-SIMULATED-EXPERIMENT.json').write_text(json.dumps(result,indent=2,sort_keys=True)+'\n')
    (destination/'DIRECTOR-V2-SIMULATED-EXPERIMENT.md').write_text(render_report(result))
    print(json.dumps(result['summaries'],indent=2))
