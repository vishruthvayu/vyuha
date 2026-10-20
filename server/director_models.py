"""Canonical individual Director/profile contracts; no client-side selection."""
from typing import Literal
from .models import StrictModel
from .review_models import Skill

class SkillOutcome(StrictModel):
    successes: int
    failures: int

class SkillEstimate(StrictModel):
    alpha: float
    beta: float
    observations: int
    mean: float
    updated_at: str | None
    last_session_id: str | None

class TrainingProfile(StrictModel):
    trainee: str
    sessions: int
    skills: dict[Skill, SkillEstimate]
    outcomes: list[dict]
    unprocessed_sessions: list[str]
    prior_alpha: float = 1.0
    prior_beta: float = 1.0
    version: str = 'director-v1'

class AntiRote(StrictModel):
    rejected_candidates: int
    fallback: bool
    history_window: int = 5

class DirectorDecision(StrictModel):
    mode: Literal['individual'] = 'individual'
    trainee_id: str
    director_seed: int
    focus_skill: Skill
    mastery_estimate: float
    observations: int
    difficulty: Literal[1, 2, 3]
    difficulty_label: Literal['foundational', 'standard', 'challenging']
    target_success: float = 0.7
    target_kind: str = 'heuristic, not calibrated'
    reason_code: Literal['INITIAL_ASSESSMENT', 'LOWEST_SAMPLED_MASTERY']
    reason: str
    recent_successes: int
    recent_failures: int
    scenario_template: str
    scenario_seed: int
    scenario_features: list[str]
    fingerprint: str
    anti_rote: AntiRote
    debug_samples: dict[Skill, float]
    profile_snapshot: dict[Skill, SkillEstimate]
