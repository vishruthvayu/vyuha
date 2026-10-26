"""Frozen post-exercise evidence reasoning, separate from original scored actions.

No acquisition, real sensor control, pre-decision belief inference or mastery
measurement is implemented. Missions use only whitelisted reconstructed reports.
"""
import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import Field

from . import storage
from .learning_reflection import eligible_evidence
from .models import StrictModel
from .review_models import RadarEvidence, RFEvidence, VisualEvidence

VERSION = 'evidence-investigation-v1'
CHOICES = ['supported', 'not_established']
MAX_QUESTIONS = 4
MAX_REQUESTS = 64
NOTE = ('Post-exercise report reasoning only, not active evidence acquisition, pre-decision thinking, '
        'scored training performance or proof of learning gain. Uses the existing trusted-LAN trainee '
        'identity; the unit administrator can read the database. Ordinary Data transfer omits these '
        'annotations; an original server backup preserves them.')
router = APIRouter(prefix='/api/v1/learning/sessions/{session_id}/investigation',
                   tags=['Post-exercise evidence investigation'])
officer_router = APIRouter(prefix='/api/v1/instructor/sessions/{session_id}/investigation',
                           tags=['Officer evidence investigation review'])


def ensure_schema(db):
    db.executescript('''
    CREATE TABLE IF NOT EXISTS learning_investigations (
        session_id TEXT PRIMARY KEY, mission_id TEXT NOT NULL UNIQUE,
        trainee TEXT NOT NULL, review_hash TEXT NOT NULL, version TEXT NOT NULL,
        spec TEXT NOT NULL, spec_hash TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS learning_investigation_answers (
        mission_id TEXT NOT NULL, question_id TEXT NOT NULL,
        choice TEXT NOT NULL, created_at TEXT NOT NULL,
        PRIMARY KEY(mission_id,question_id));
    CREATE TABLE IF NOT EXISTS learning_investigation_requests (
        session_id TEXT NOT NULL, request_id TEXT NOT NULL, body TEXT NOT NULL,
        PRIMARY KEY(session_id,request_id));
    ''')


class StartInvestigation(StrictModel):
    request_id: str = Field(min_length=8, max_length=80, pattern=r'^[A-Za-z0-9_-]+$')
    trainee: str = Field(min_length=1, max_length=24, pattern=r'^[A-Za-z0-9_-]+$')
    review_hash: str = Field(pattern=r'^[a-f0-9]{64}$')


class InvestigationAnswer(StartInvestigation):
    mission_id: str = Field(min_length=1, max_length=80, pattern=r'^[A-Za-z0-9_-]+$')
    question_id: str = Field(min_length=1, max_length=80, pattern=r'^[A-Za-z0-9_-]+$')
    choice: Literal['supported', 'not_established']


class ReportMoment(StrictModel):
    tick: int = Field(ge=0, le=5400)
    radar: RadarEvidence
    rf: RFEvidence
    visual: VisualEvidence
    range_m: float | None = Field(ge=0, allow_inf_nan=False)
    night: bool


class Question(StrictModel):
    id: str
    decision_id: str
    track_id: str
    tick: int = Field(ge=0, le=5400)
    order: int | None = Field(default=None, ge=0, le=100000)
    concept: Literal['rf_presence', 'radar_presence', 'iff_hostility', 'multirotor_type', 'hostile_intent']
    prompt: str
    evidence: ReportMoment
    options: list[Literal['supported', 'not_established']]


class PrivateQuestion(Question):
    expected_choice: Literal['supported', 'not_established']
    explanation: str


def safe_evidence(raw):
    """Explicit allowlist: never copy reference truth, declarations or responses."""
    try:
        return ReportMoment.model_validate(dict(
            tick=raw['tick'],
            radar={key: raw['radar'][key] for key in ['available', 'state', 'detected']},
            rf={key: raw['rf'][key] for key in ['available', 'signal', 'iff']},
            visual={key: raw['visual'][key] for key in ['available', 'silhouette']},
            range_m=raw['range_m'], night=raw['night'])).model_dump()
    except (KeyError, TypeError, ValueError) as error:
        raise HTTPException(409, 'Original report moment cannot be verified') from error


def build_questions(decisions):
    """Rules test report claims, not identity labels or post-review references."""
    candidates = []
    for decision in decisions[:6000]:
        ev = safe_evidence(decision['evidence'])
        base = dict(decision_id=decision['decision_id'], track_id=decision['track_id'],
                    tick=ev['tick'], order=decision.get('order') if decision['tick'] == ev['tick'] else None,
                    evidence=ev, options=CHOICES)
        signal = ev['rf']['available'] and ev['rf']['signal'] is True
        radar = ev['radar']['available'] and ev['radar']['detected']
        candidates.append(dict(base, concept='rf_presence',
            prompt='A simulated RF control-link signal was reported at this evidence moment.',
            expected_choice='supported' if signal else 'not_established',
            explanation='The available RF report explicitly records a detected signal. It does not establish aircraft type or hostile intent.' if signal else
                'No available RF report records a detected signal here. Unavailability or no detection does not prove that a physical link was absent.'))
        if ev['rf']['iff'] == 'no_reply':
            candidates.append(dict(base, concept='iff_hostility',
                prompt='The missing IFF reply establishes that this contact is hostile.',
                expected_choice='not_established',
                explanation='No IFF reply does not establish hostility. Missing, unavailable or unanswered identity evidence cannot be converted into a hostile identity.'))
        if ev['visual']['available'] and ev['visual']['silhouette'] == 'multirotor':
            candidates.append(dict(base, concept='multirotor_type',
                prompt='This multirotor silhouette uniquely distinguishes a radio-linked quadcopter from a no-RF multirotor.',
                expected_choice='not_established',
                explanation='The modeled multirotor silhouette is shared by quadcopters and no-RF multirotors. Shape alone does not establish the control link.'))
        candidates.append(dict(base, concept='radar_presence',
            prompt='A working radar report detected this contact at this evidence moment.',
            expected_choice='supported' if radar else 'not_established',
            explanation='The available radar report explicitly records detection. That observation does not identify type or intent.' if radar else
                'The radar report does not establish detection at this moment. Sensor unavailability or no detection is not proof of an empty sky.'))
        candidates.append(dict(base, concept='hostile_intent',
            prompt='The reported RF control-link evidence alone establishes hostile intent.',
            expected_choice='not_established',
            explanation='A radio-link report, whether detected, missing or unavailable, does not establish hostile intent. The question concerns these reports, not later reference truth.'))
    if not candidates:
        raise HTTPException(422, 'This recorded interval has no usable decision evidence for an investigation')
    # A positive report and an insufficiency case are selected when available.
    # Further cards cover distinct concepts rather than repeating many samples.
    chosen = []
    for verdict in ['supported', 'not_established']:
        row = next((q for q in candidates if q['expected_choice'] == verdict), None)
        if row is not None:
            chosen.append(row)
    for row in candidates:
        if len(chosen) >= MAX_QUESTIONS:
            break
        if row['concept'] not in {q['concept'] for q in chosen}:
            chosen.append(row)
    return [PrivateQuestion.model_validate(dict(q, id=f'q_{i + 1:02d}')).model_dump()
            for i, q in enumerate(chosen)]


def check_hash(actual, requested):
    if actual != requested:
        raise HTTPException(409, 'Investigation review hash does not match original learning evidence')


def load_mission(db, session_id, trainee, review_hash):
    row = db.execute('SELECT * FROM learning_investigations WHERE session_id=?', (session_id,)).fetchone()
    if row is None:
        return None
    try:
        if (row['version'] != VERSION or row['trainee'] != trainee or row['review_hash'] != review_hash
                or hashlib.sha256(row['spec'].encode()).hexdigest() != row['spec_hash']):
            raise ValueError('Stored mission binding changed')
        spec = json.loads(row['spec'])
        if (spec['version'] != VERSION or spec['session_id'] != session_id or spec['trainee'] != trainee
                or spec['review_hash'] != review_hash or spec['mission_id'] != row['mission_id']
                or not 2 <= len(spec['questions']) <= MAX_QUESTIONS):
            raise ValueError('Unknown stored mission contract')
        questions = [PrivateQuestion.model_validate(q).model_dump() for q in spec['questions']]
        if len({q['id'] for q in questions}) != len(questions):
            raise ValueError('Duplicate question')
    except (KeyError, TypeError, ValueError) as error:
        raise HTTPException(409, 'Stored investigation cannot be verified; do not regenerate it') from error
    return spec


def response(db, spec):
    questions = [Question.model_validate({k: v for k, v in q.items()
                  if k not in ['expected_choice', 'explanation']}).model_dump() for q in spec['questions']]
    by_id = {q['id']: q for q in spec['questions']}
    answers = []
    for row in db.execute('SELECT question_id,choice FROM learning_investigation_answers WHERE mission_id=? ORDER BY rowid',
                          (spec['mission_id'],)):
        if row['question_id'] not in by_id or row['choice'] not in CHOICES:
            raise HTTPException(409, 'Stored investigation answer cannot be verified')
        q = by_id[row['question_id']]
        answers.append(dict(question_id=row['question_id'], choice=row['choice'],
                            matches_report=row['choice'] == q['expected_choice'], explanation=q['explanation']))
    has_positive = any(q['expected_choice'] == 'supported' for q in spec['questions'])
    contrast = ('This session supplies both a positive report and an insufficient-inference example.' if has_positive else
                'This session has no positive report example; these questions practice recognizing insufficient information only.')
    return dict(version=VERSION, mission_id=spec['mission_id'], session_id=spec['session_id'],
                trainee=spec['trainee'], review_hash=spec['review_hash'], questions=questions,
                answers=answers, note=NOTE + ' ' + contrast)


def existing_request(db, session_id, request_id, body):
    old = db.execute('SELECT body FROM learning_investigation_requests WHERE session_id=? AND request_id=?',
                     (session_id, request_id)).fetchone()
    if old and old['body'] != body:
        raise HTTPException(409, 'Investigation request ID is immutable')
    return old is not None


def remember_request(db, session_id, request_id, body):
    if db.execute('SELECT COUNT(*) FROM learning_investigation_requests WHERE session_id=?', (session_id,)).fetchone()[0] >= MAX_REQUESTS:
        raise HTTPException(422, 'Investigation request limit reached; retry an existing request ID')
    db.execute('INSERT INTO learning_investigation_requests VALUES (?,?,?)', (session_id, request_id, body))


@router.get('')
def get_investigation(session_id: str, trainee: str = Query(min_length=1, max_length=24, pattern=r'^[A-Za-z0-9_-]+$')):
    with storage.connect() as db:
        db.execute('BEGIN')
        review_hash = eligible_evidence(db, session_id, trainee)
        spec = load_mission(db, session_id, trainee, review_hash)
        if spec is None:
            raise HTTPException(404, 'No investigation has been started for this session')
        return response(db, spec)


@officer_router.get('')
def officer_investigation(session_id: str):
    """Read only. The instructor path is protected by the existing auth middleware."""
    with storage.connect() as db:
        db.execute('BEGIN')
        owner = db.execute('SELECT trainee FROM sessions WHERE id=?', (session_id,)).fetchone()
        if owner is None:
            raise HTTPException(404, 'Learning session not found')
        actual = eligible_evidence(db, session_id, owner['trainee'])
        spec = load_mission(db, session_id, owner['trainee'], actual)
        if spec is None:
            raise HTTPException(404, 'The learner has not started an investigation for this session')
        return response(db, spec)


@router.post('/start', status_code=201)
def start_investigation(session_id: str, req: StartInvestigation):
    body = storage.dumps(req.model_dump())
    # Reconstruct only on first start, outside a writer transaction. Ownership
    # and persisted-evidence checks happen before loading any detailed review.
    with storage.connect() as db:
        actual = eligible_evidence(db, session_id, req.trainee)
        check_hash(actual, req.review_hash)
        old = load_mission(db, session_id, req.trainee, actual)
        if old is not None:
            existing_request(db, session_id, req.request_id, body)
    spec = None
    if old is None:
        from .main import aar
        review = aar(session_id)
        if (review.get('verified') is not True or review.get('id') != session_id
                or review.get('trainee') != req.trainee
                or hashlib.sha256(storage.dumps(review.get('decision_reviews')).encode()).hexdigest() != actual):
            raise HTTPException(409, 'Reconstructed investigation evidence does not match the original review')
        questions = build_questions(review['decision_reviews'])
        spec = dict(version=VERSION, mission_id='inv_' + uuid.uuid4().hex, session_id=session_id,
                    trainee=req.trainee, review_hash=actual, questions=questions)
    with storage.connect() as db:
        db.execute('BEGIN IMMEDIATE')
        actual = eligible_evidence(db, session_id, req.trainee)
        check_hash(actual, req.review_hash)
        frozen = load_mission(db, session_id, req.trainee, actual)
        duplicate = existing_request(db, session_id, req.request_id, body)
        if frozen is None:
            if spec is None or duplicate:
                raise HTTPException(409, 'Investigation start state changed')
            raw = storage.dumps(spec)
            db.execute('INSERT INTO learning_investigations VALUES (?,?,?,?,?,?,?,?)',
                       (session_id, spec['mission_id'], req.trainee, actual, VERSION, raw,
                        hashlib.sha256(raw.encode()).hexdigest(), datetime.now(timezone.utc).isoformat()))
            frozen = spec
        if not duplicate:
            remember_request(db, session_id, req.request_id, body)
        return response(db, frozen)


@router.post('/answers', status_code=201)
def answer_investigation(session_id: str, req: InvestigationAnswer):
    body = storage.dumps(req.model_dump())
    with storage.connect() as db:
        db.execute('BEGIN IMMEDIATE')
        actual = eligible_evidence(db, session_id, req.trainee)
        check_hash(actual, req.review_hash)
        spec = load_mission(db, session_id, req.trainee, actual)
        if spec is None or spec['mission_id'] != req.mission_id:
            raise HTTPException(404, 'Investigation mission not found')
        duplicate = existing_request(db, session_id, req.request_id, body)
        if req.question_id not in {q['id'] for q in spec['questions']}:
            raise HTTPException(404, 'Investigation question not found')
        old = db.execute('SELECT choice FROM learning_investigation_answers WHERE mission_id=? AND question_id=?',
                         (req.mission_id, req.question_id)).fetchone()
        if old and old['choice'] != req.choice:
            raise HTTPException(409, 'The first investigation answer is immutable')
        if not old:
            db.execute('INSERT INTO learning_investigation_answers VALUES (?,?,?,?)',
                       (req.mission_id, req.question_id, req.choice, datetime.now(timezone.utc).isoformat()))
        if not duplicate:
            remember_request(db, session_id, req.request_id, body)
        return response(db, spec)
