"""Canonical rule-grounded AAR contract. Prose is a presentation of these facts."""
from typing import Literal
from pydantic import Field
from .models import Action, StrictModel

Skill = Literal['detection', 'classification_iff', 'effector_choice', 'degraded_sensor_response']
Reason = Literal[
    'EFFECTOR_UNAVAILABLE', 'PRIORITY_INVERSION', 'PRIORITY_CORRECT', 'DETECTION_ON_TIME', 'DETECTION_LATE', 'THREAT_MISSED', 'DETECTION_PENDING', 'NO_EVIDENCE_AVAILABLE',
    'CORRECT_CLASSIFICATION', 'WRONG_TYPE', 'WRONG_CATEGORY', 'FRIENDLY_MISIDENTIFIED', 'BIRD_MISIDENTIFIED',
    'CLASSIFICATION_NOT_RECORDED', 'CORRECT_HOLD', 'CORRECT_RF_JAM', 'CORRECT_KINETIC',
    'NO_RF_JAM_INEFFECTIVE', 'FRIENDLY_ENGAGED', 'NEUTRAL_ENGAGED', 'KINETIC_OUT_OF_RANGE',
    'RF_JAM_OUT_OF_RANGE', 'KINETIC_ROE_RESTRICTED', 'WRONG_EFFECTOR', 'RESPONSE_NOT_RECORDED']


class RadarEvidence(StrictModel):
    available: bool
    state: Literal['normal', 'jammed', 'failed']
    detected: bool


class RFEvidence(StrictModel):
    available: bool
    signal: bool | None
    iff: Literal['friendly_reply', 'no_reply', 'unavailable']


class VisualEvidence(StrictModel):
    available: bool
    silhouette: Literal['bird', 'fixed_wing', 'multirotor'] | None


class Evidence(StrictModel):
    tick: int
    radar: RadarEvidence
    rf: RFEvidence
    visual: VisualEvidence
    range_m: float | None
    restricted: bool | None
    first_detectable_tick: int | None
    prior_classification: str | None
    prior_identity: str | None
    night: bool


class GroundTruth(StrictModel):
    kind: Literal['bird', 'quad', 'fixed_wing', 'fiber_fpv']
    identity: Literal['friendly', 'neutral', 'hostile']
    rf_link: bool
    spawn_tick: int


class ExpectedDecision(StrictModel):
    track_id: str | None = None
    type: Literal['designate', 'classify', 'engage', 'observe']
    kind: str | None = None
    identity: str | None = None
    effector: Literal['hold', 'rf_jam', 'kinetic'] | None = None
    basis: Literal['available_evidence', 'ground_truth_reference']


class Consequence(StrictModel):
    kind: Literal['resolved', 'asset_impact', 'remained_active', 'hold', 'no_consequence_yet']
    tick: int | None
    reason_code: Literal['THREAT_RESOLVED', 'CONTACT_RESOLVED', 'THREAT_IMPACTED_ASSET', 'NO_CONSEQUENCE_YET']
    immediate: Literal['resolved', 'remained_active', 'held', 'not_applicable']
    text: str


class ScoreEffect(StrictModel):
    scope: Literal['final_contact_node'] = 'final_contact_node'
    node: Literal['detect', 'classify', 'engage', 'prioritise']
    points_awarded: int
    points_possible: int
    session_penalty: int
    penalty_basis: Literal['observed', 'scoring_projection', 'none']
    session_failure: bool


class DecisionReview(StrictModel):
    decision_id: str
    session_id: str
    track_id: str
    tick: int
    order: int | None
    decision_kind: Literal['detection', 'classification_iff', 'engagement', 'prioritisation']
    evidence: Evidence
    ground_truth: GroundTruth
    trainee_action: Action | None
    expected_action: ExpectedDecision
    verdict: Literal['correct', 'incorrect', 'unassessable']
    reason_code: Reason
    explanation: str
    consequence: Consequence
    score_effect: ScoreEffect
    skill_tags: list[Skill]
    context_commands: list[int]


class TimelineItem(StrictModel):
    id: str
    tick: int
    order: int | None
    category: Literal['trainee_action', 'instructor_action', 'sensor_transition', 'contact_detection', 'contact_resolution', 'asset_impact', 'score_error', 'tactic_phase']
    code: str
    title: str
    track_id: str | None = None
    decision_id: str | None = None
    seek_before: bool = False


class GhostSummary(StrictModel):
    largest_loss: str | None
    strongest_decision: str | None
    mistake_counts: dict[Skill, int]
    lost_points: dict[Skill, int]
    recommended_focus: Skill | None
    no_major_errors: bool
    text: str


class ReplayMetadata(StrictModel):
    hz: int = 30
    observed_end_tick: int
    scoring_end_tick: int
    horizon_source: Literal['completion', 'telemetry', 'last_recorded_event']
    early_end: bool
    version: str = 'ghost-aar-v2.1'
    note: str


class GhostAAR(StrictModel):
    timeline: list[TimelineItem]
    decision_reviews: list[DecisionReview]
    ghost_summary: GhostSummary
    replay_metadata: ReplayMetadata
    node_averages: dict[str, float]
