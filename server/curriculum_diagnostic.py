"""Read-only synthetic selection comparison; no outcome or learning simulation."""
import copy
import hashlib
import random

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from . import learning, storage

VERSION = 'curriculum-policy-diagnostic-v1'
POLICIES = ('coverage-director-v1', 'uniform-practice-v1', 'round-robin-practice-v1')


def require_officer(request: Request):
    from .auth import bearer, valid
    if not valid(bearer(request.headers)):
        raise HTTPException(401, 'Officer sign-in required', headers={'WWW-Authenticate': 'Bearer'})


router = APIRouter(prefix='/api/v1/evaluations/policy-diagnostics',
                   dependencies=[Depends(require_officer)])


def cases(data):
    ids = [c['id'] for c in data['competencies'] if c['scope'] == 'individual']
    def state(values=None, recent=()):
        result = {cid: dict(correct=0, incorrect=0, unassessable=0, assessed_sessions=0) for cid in ids}
        for cid, counts in (values or {}).items():
            result[cid].update(counts)
        return dict(competencies=result, recent_items=list(recent))
    balanced = {cid: dict(correct=4, incorrect=1, assessed_sessions=2) for cid in ids}
    uneven = copy.deepcopy(balanced)
    uneven[ids[-1]] = dict(correct=0, incorrect=0, assessed_sessions=0)
    error = copy.deepcopy(balanced)
    error[ids[2]] = dict(correct=0, incorrect=5, assessed_sessions=2)
    ambiguous = copy.deepcopy(balanced)
    ambiguous[ids[1]] = dict(correct=0, incorrect=0, unassessable=100, assessed_sessions=0)
    last_items = [i['id'] for i in data['items'] if i['pool'] == 'practice' and i['competency_id'] == ids[-1]]
    return [
        ('cold-start', state()), ('balanced-evidence', state(balanced)),
        ('one-underexposed-competency', state(uneven)),
        ('errors-at-equal-exposure', state(error)),
        ('unassessable-is-not-success', state(ambiguous)),
        ('recent-exclusion-vs-coverage', state(uneven, last_items)),
    ]


def compare(*, seed=7, trials=64):
    if type(seed) is not int or not 0 <= seed <= 4294967295:
        raise ValueError('Seed must be uint32')
    if type(trials) is not int or not 1 <= trials <= 128:
        raise ValueError('Trials must be between 1 and 128')
    data, digest = learning.catalog()
    pool = sorted([i for i in data['items'] if i['audience'] == 'individual' and i['pool'] == 'practice'], key=lambda i: i['id'])
    cids = sorted({i['competency_id'] for i in pool})
    results = []
    for name, state in cases(data):
        rows = []
        minimum = min(c['assessed_sessions'] for c in state['competencies'].values())
        least = [cid for cid, c in state['competencies'].items() if c['assessed_sessions'] == minimum]
        for policy in POLICIES:
            counts = {cid: 0 for cid in cids}
            choices = []
            repeats = 0
            for trial in range(trials):
                active_seed = (seed + trial) & 0xffffffff
                if policy == POLICIES[0]:
                    chosen, _ = learning.choose_item(data, state, learning.PrepareLearning(
                        request_id='diagnostic-only', trainee='SYNTHETIC', mode='adaptive', seed=active_seed))
                elif policy == POLICIES[1]:
                    candidates = pool.copy()
                    random.Random(active_seed).shuffle(candidates)
                    chosen = candidates[0]
                else:
                    chosen = pool[active_seed % len(pool)]
                counts[chosen['competency_id']] += 1
                choices.append(chosen['id'])
                repeats += chosen['id'] in state['recent_items'][-2:]
            rows.append(dict(policy=policy, selections=trials, competency_counts=counts,
                             least_assessed_selections=sum(counts[cid] for cid in least),
                             last_two_repeat_selections=repeats, selected_items=choices))
        results.append(dict(case=name, fixed_evidence=state, least_assessed_competencies=least, policies=rows))
    report = dict(version=VERSION, catalog_hash=digest, seed=seed, trials=trials,
                  seed_schedule='(seed + trial_index) modulo 2^32; same seed for each policy/case',
                  practice_pool=[dict(id=i['id'], competency_id=i['competency_id'], assistance=i['assistance']) for i in pool],
                  cases=results,
                  limitations=[
                      'Synthetic fixed histories, not participants or predicted learning trajectories.',
                      'Selection frequencies, coverage and recency are software properties, not learning gains or empirical fairness.',
                      'No engine, scenarios, actions, scores, profiles or preparations are written.',
                      'The two comparison baselines do not avoid repeats; their policies are disclosed, not tuned to win.',
                      'Existing Beta Director has a different task space and is not compared on incompatible item IDs.',
                      'No fitted retention, calibration, participant subgroup analysis or automatic policy replacement.',
                  ])
    report['receipt_sha256'] = hashlib.sha256(storage.dumps(report).encode()).hexdigest()
    return report


@router.get('/coverage')
def get_comparison(seed: int = Query(default=7, ge=0, le=4294967295),
                   trials: int = Query(default=64, ge=1, le=128)):
    return compare(seed=seed, trials=trials)
