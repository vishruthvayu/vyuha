"""Inspectable procedural curriculum; existing four Beta profiles are read only.

This bounded heuristic is a research policy, not demonstrated human efficacy.
Retention uses processed-session gaps rather than invented elapsed time. Frozen
selection snapshots preserve the evidence and coefficients used for each drill.
"""
import copy
import json
import hashlib
import hmac
import math
import random
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import Field, model_validator

from . import storage
from .director import PRIOR, SKILLS, difficulty, select_director
from .director_models import DirectorDecision, SkillEstimate, SkillOutcome
from .review_models import Skill
from .models import StrictModel
from .raid_v2 import FAMILIES, compose_raid, raid_id

VERSION = 'director-v2.1'
router = APIRouter(prefix='/api/v1/director-v2', tags=['Procedural Director'])
WEIGHTS = dict(uncertainty=.35, recent_learning_progress=.20, retention_gap=.20)
FOCUS_FAMILIES = {
    'detection': ['LOW_APPROACH', 'BLIND_SECTOR', 'STAGGERED_WAVES'],
    'classification_iff': ['DECOY_THEN_STRIKE', 'PROBE_AND_RETREAT', 'STAGGERED_WAVES'],
    'effector_choice': ['DIRECT', 'SATURATION', 'SPLIT_SWARM'],
    'degraded_sensor_response': ['BLIND_SECTOR', 'PROBE_AND_RETREAT', 'LOW_APPROACH'],
}


class Prepare(StrictModel):
    trainee: str = Field(min_length=1, max_length=24, pattern=r'^[A-Za-z0-9_-]+$')
    seed: int = Field(default=482913, ge=0, le=4294967295)
    duration: int = Field(default=90, ge=60, le=180)
    @model_validator(mode='after')
    def nonblank(self):
        if not self.trainee.strip():
            raise ValueError('Trainee cannot be blank')
        return self


class PolicyWeights(StrictModel):
    uncertainty: Literal[.35] = .35
    recent_learning_progress: Literal[.20] = .20
    retention_gap: Literal[.20] = .20


class SkillEvidence(StrictModel):
    beta_standard_deviation: float = Field(ge=0, le=.5, allow_inf_nan=False)
    recent_successes: int = Field(ge=0)
    recent_failures: int = Field(ge=0)
    recent_smoothed_rate: float = Field(ge=0, le=1, allow_inf_nan=False)
    previous_smoothed_rate: float = Field(ge=0, le=1, allow_inf_nan=False)
    learning_progress: float = Field(ge=-1, le=1, allow_inf_nan=False)
    last_evidence_gap_sessions: int = Field(ge=0, le=50)
    retention_gap: float = Field(ge=0, le=1, allow_inf_nan=False)


class BaselineComparison(StrictModel):
    focus_skill: Skill
    difficulty_label: Literal['foundational', 'standard', 'challenging']
    scenario_template: str = Field(max_length=80)


class SelectionSnapshot(StrictModel):
    sessions: int = Field(ge=0)
    skills: dict[Skill, SkillEstimate]
    outcomes: list[dict[Skill, SkillOutcome]] = Field(max_length=50)

    @model_validator(mode='after')
    def evidence_only(self):
        if set(self.skills) != set(SKILLS):
            raise ValueError('Selection snapshot requires exactly four skills')
        for estimate in self.skills.values():
            if estimate.last_session_id is not None or estimate.updated_at is not None:
                raise ValueError('Selection snapshot must not contain session identifiers or dates')
            if not all(math.isfinite(v) for v in [estimate.alpha, estimate.beta, estimate.mean]) or min(estimate.alpha, estimate.beta) < PRIOR or estimate.observations != estimate.alpha+estimate.beta-2*PRIOR or abs(estimate.mean-estimate.alpha/(estimate.alpha+estimate.beta))>1e-12:
                raise ValueError('Invalid selection posterior')
        for outcome in self.outcomes:
            if set(outcome) != set(SKILLS) or any(min(v.successes, v.failures) < 0 for v in outcome.values()):
                raise ValueError('Invalid selection outcome')
        return self


class DirectorV2Metadata(StrictModel):
    version: Literal['director-v2.1'] = VERSION
    policy: Literal['adjusted_seeded_thompson'] = 'adjusted_seeded_thompson'
    owner_binding: str = Field(pattern=r'^[a-f0-9]{64}$')
    basis: str = Field(max_length=240)
    weights: PolicyWeights
    raw_samples: dict[Skill, float]
    adjusted_samples: dict[Skill, float]
    skill_evidence: dict[Skill, SkillEvidence]
    baseline_comparison: BaselineComparison
    family: Literal['DIRECT','SATURATION','DECOY_THEN_STRIKE','STAGGERED_WAVES','LOW_APPROACH','SPLIT_SWARM','PROBE_AND_RETREAT','BLIND_SECTOR']
    recent_families: list[str] = Field(max_length=5)
    family_candidates: list[str] = Field(min_length=1, max_length=8)
    recent_signatures: list[list[str]] = Field(max_length=5)
    selection_snapshot: SelectionSnapshot
    limitations: list[str] = Field(max_length=10)

    @model_validator(mode='after')
    def bounded_samples(self):
        for samples in [self.raw_samples, self.adjusted_samples]:
            if set(samples) != set(SKILLS) or any(not math.isfinite(v) or not 0 <= v <= 1 for v in samples.values()):
                raise ValueError('Invalid four-skill policy samples')
        if set(self.skill_evidence) != set(SKILLS):
            raise ValueError('Invalid four-skill policy evidence')
        if any(f not in FAMILIES for f in self.recent_families+self.family_candidates):
            raise ValueError('Unknown curriculum family')
        return self


def owner_binding(db, trainee):
    # An installation-local random nonce prevents a dictionary attack on callsigns.
    # This opaque link survives pseudonymous transfer; it is not a public ID hash.
    nonce = db.execute('SELECT nonce FROM transfer_origin WHERE singleton=1').fetchone()['nonce']
    return hmac.new(bytes.fromhex(nonce), ('director-owner:'+trainee).encode(), hashlib.sha256).hexdigest()


def selection_snapshot(profile):
    skills = copy.deepcopy(profile['skills'])
    for estimate in skills.values():
        estimate.update(updated_at=None, last_session_id=None)
    return dict(sessions=profile['sessions'], skills=skills,
                outcomes=[copy.deepcopy(o['skills']) for o in profile['outcomes']])


def snapshot(db, trainee):
    """Missing prior rows are represented in memory; never call ensure_profile."""
    rows = {r['skill']: r for r in db.execute('SELECT * FROM skill_profiles WHERE trainee=?', (trainee,))}
    skills = {}
    for skill in SKILLS:
        row = rows.get(skill)
        alpha, beta = (float(row['alpha']), float(row['beta'])) if row else (PRIOR, PRIOR)
        if not math.isfinite(alpha) or not math.isfinite(beta) or alpha < PRIOR or beta < PRIOR:
            raise ValueError('Stored skill evidence has an invalid Beta posterior')
        skills[skill] = dict(alpha=alpha, beta=beta, observations=int(alpha+beta-2*PRIOR), mean=alpha/(alpha+beta), updated_at=row['updated_at'] if row else None, last_session_id=row['last_session_id'] if row else None)
    outcomes = [dict(session_id=r['session_id'], skills=json.loads(r['outcomes']), processed_at=r['processed_at'], version=r['version']) for r in db.execute('SELECT * FROM skill_outcomes WHERE trainee=? ORDER BY processed_at DESC,session_id DESC LIMIT 50', (trainee,))]
    outcomes.reverse()
    history = [json.loads(r['decision']) for r in db.execute('SELECT decision FROM director_history WHERE trainee=? ORDER BY rowid DESC LIMIT 5', (trainee,))]
    signatures = [json.loads(r['spec'])['raid']['signature'] for r in db.execute("SELECT sc.spec FROM sessions se JOIN scenarios sc ON sc.id=se.scenario_id WHERE se.trainee=? AND json_extract(sc.spec,'$.director_v2.version')=? ORDER BY se.rowid DESC LIMIT 5", (trainee, VERSION))]
    return dict(trainee=trainee, sessions=db.execute('SELECT COUNT(*) FROM skill_outcomes WHERE trainee=?', (trainee,)).fetchone()[0], skills=skills, outcomes=outcomes, unprocessed_sessions=[]), history, signatures


def _counts(outcomes, skill):
    successes = failures = 0
    for row in outcomes:
        result = row['skills'].get(skill, {})
        success, failure = result.get('successes', 0), result.get('failures', 0)
        if type(success) is not int or type(failure) is not int or min(success, failure) < 0:
            raise ValueError('Stored outcome counts are invalid')
        successes += success
        failures += failure
    return successes, failures


def select_policy(profile, history, seed, binding):
    """Pure deterministic policy. It does not observe hidden simulation truth."""
    baseline = select_director(profile, history, seed)
    raw = baseline['debug_samples']
    evidence, adjusted = {}, {}
    outcomes = profile['outcomes']
    for skill in SKILLS:
        estimate = profile['skills'][skill]
        a, b = estimate['alpha'], estimate['beta']
        sigma = math.sqrt(a*b/((a+b)**2*(a+b+1)))
        recent = _counts(outcomes[-3:], skill)
        previous = _counts(outcomes[-6:-3], skill)
        recent_rate = (1+recent[0])/(2+sum(recent))
        previous_rate = (1+previous[0])/(2+sum(previous))
        progress = recent_rate-previous_rate if sum(recent) and sum(previous) else 0.0
        gap = 0
        for row in reversed(outcomes):
            if sum(_counts([row], skill)):
                break
            gap += 1
        retention = min(gap, 10)/10 if estimate['observations'] else 0.0
        adjusted[skill] = max(0.0, raw[skill]-WEIGHTS['uncertainty']*sigma-WEIGHTS['recent_learning_progress']*max(progress, 0)-WEIGHTS['retention_gap']*retention)
        evidence[skill] = dict(beta_standard_deviation=sigma, recent_successes=recent[0], recent_failures=recent[1], recent_smoothed_rate=recent_rate, previous_smoothed_rate=previous_rate, learning_progress=progress, last_evidence_gap_sessions=gap, retention_gap=retention)
    focus = min(SKILLS, key=lambda skill: adjusted[skill])
    chosen = profile['skills'][focus]
    chosen_evidence = evidence[focus]
    effective = .7*chosen['mean']+.3*chosen_evidence['recent_smoothed_rate']-.35*chosen_evidence['beta_standard_deviation']-.20*chosen_evidence['retention_gap']
    level = difficulty(effective)
    rng = random.Random(seed ^ 0xD1EC70)
    candidates = copy.copy(FOCUS_FAMILIES[focus])
    rng.shuffle(candidates)
    recent_families = [h['scenario_template'].split('/')[1] for h in history if h.get('scenario_template', '').startswith('v2/') and len(h['scenario_template'].split('/')) >= 3]
    allowed = [f for f in candidates if f not in recent_families[:2]]
    family = allowed[0] if allowed else max(candidates, key=lambda f: recent_families.index(f) if f in recent_families else 99)
    scenario_seed = rng.randrange(2**32)
    success, failure = _counts(outcomes[-5:], focus)
    fresh = all(s['observations'] == 0 for s in profile['skills'].values())
    decision = dict(trainee_id=profile['trainee'], director_seed=seed, focus_skill=focus, mastery_estimate=chosen['mean'], observations=chosen['observations'], difficulty=level, difficulty_label=['foundational', 'standard', 'challenging'][level-1], reason_code='INITIAL_ASSESSMENT' if fresh else 'LOWEST_SAMPLED_MASTERY', reason='Initial procedural assessment from unchanged Beta priors. ' if fresh else 'Procedural Director uses adjusted seeded mastery draws. ', recent_successes=success, recent_failures=failure, scenario_template=f'v2/{family}/{focus}', scenario_seed=scenario_seed, anti_rote=dict(rejected_candidates=len(candidates)-len(allowed), fallback=not allowed), debug_samples=adjusted, profile_snapshot=copy.deepcopy(profile['skills']))
    decision['reason'] += 'Selection combines current deficiency, Beta uncertainty, positive recent learning progress and processed-session retention gaps. Difficulty is a conservative heuristic; no measured human learning benefit or calibrated 70% target is claimed.'
    metadata = dict(version=VERSION, owner_binding=binding, policy='adjusted_seeded_thompson', basis='Accepted processed outcomes only; retention is an ordinal processed-session gap, not elapsed-time forgetting', weights=copy.copy(WEIGHTS), raw_samples=copy.copy(raw), adjusted_samples=adjusted, skill_evidence=evidence, baseline_comparison=dict(focus_skill=baseline['focus_skill'], difficulty_label=baseline['difficulty_label'], scenario_template=baseline['scenario_template']), family=family, recent_families=recent_families, family_candidates=candidates, recent_signatures=[], selection_snapshot=selection_snapshot(profile), limitations=['Research heuristic, not calibrated human learning efficacy', 'No neural policy or military competence certification', 'Positive learning progress uses two three-session windows; cold history has zero progress', 'Beta posteriors and completion outcomes are unchanged'])
    return decision, metadata


def prepare_scenario(profile, history, signatures, seed, duration, binding):
    decision, metadata = select_policy(profile, history, seed, binding)
    from .response_v2 import configuration
    scenario = compose_raid(dict(response_model=configuration(), seed=decision['scenario_seed'], duration=duration, fusion=dict(version='fusion-1',mode='training',exercise='normal',bias_seed=seed), focus=decision['focus_skill'], difficulty=decision['difficulty_label'], family=metadata['family'], recent_signatures=signatures, night=decision['focus_skill']=='degraded_sensor_response', fog=.35 if decision['difficulty']==3 else .15, name=f"Procedural {decision['focus_skill'].replace('_',' ')}"))
    features = [f"{scenario['raid']['family']} raid family", f"{len(scenario['tracks'])} frozen mixed contacts", f"{len(scenario['raid']['waves'])} coordinated waves", f"{scenario['duration']} second issued exercise", 'Seeded anti-repeat procedural signature', 'Illustrative metre-scale research parameters']
    decision.update(scenario_features=features, fingerprint=scenario['raid']['fingerprint'])
    scenario['director_decision'] = DirectorDecision(**decision).model_dump()
    metadata['recent_signatures'] = copy.deepcopy(signatures)
    scenario['director_v2'] = DirectorV2Metadata(**metadata).model_dump()
    scenario['id'] = raid_id(scenario)
    return scenario


@router.post('/prepare')
def prepare(request: Prepare):
    with storage.connect() as db:
        db.execute('BEGIN IMMEDIATE')
        try:
            from .crew import is_shared_owner
            if is_shared_owner(db,request.trainee):raise ValueError('Shared crew aggregate cannot receive an individual curriculum')
            profile, history, signatures = snapshot(db, request.trainee)
            scenario = prepare_scenario(profile, history, signatures, request.seed, request.duration, owner_binding(db, request.trainee))
        except (ValueError, KeyError, TypeError, OverflowError) as error:
            raise HTTPException(422, 'Procedural preparation unavailable: '+str(error)[:160]) from error
        db.execute('INSERT OR IGNORE INTO scenarios(id,spec) VALUES (?,?)', (scenario['id'], storage.dumps(scenario)))
    return scenario
