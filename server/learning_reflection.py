"""Append-only learner notes attached to immutable, verified learning evidence.

Trainee identifiers use the existing trusted-LAN identity model. These notes
are not secret from the unit administrator or anyone with database access.
Ordinary portable bundles omit them; an original server backup preserves them.
"""
import json
import re
import unicodedata
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query
from pydantic import Field, field_validator

from . import storage
from .models import StrictModel

router = APIRouter(prefix='/api/v1/learning/sessions/{session_id}/reflections',
                   tags=['Learner reflection'])
VERSION = 'reflection-v1'
PROMPT_VERSION = 'reflection-prompts-v1'
NOTE = ('Learner-authored reflection, not scored or evidence of learning gain. '
        'Uses the existing trusted-LAN trainee identity; the unit administrator can read the database. '
        'Ordinary Data transfer omits these notes; an original server backup preserves them.')


def ensure_schema(db):
    db.executescript('''
    CREATE TABLE IF NOT EXISTS learning_reflections (
        id TEXT PRIMARY KEY, request_id TEXT NOT NULL, session_id TEXT NOT NULL,
        trainee TEXT NOT NULL, review_hash TEXT NOT NULL, version TEXT NOT NULL,
        prompt_version TEXT NOT NULL, observed_cue TEXT NOT NULL,
        remaining_uncertainty TEXT NOT NULL, next_check TEXT NOT NULL,
        created_at TEXT NOT NULL, body TEXT NOT NULL,
        UNIQUE(session_id,request_id));
    CREATE INDEX IF NOT EXISTS learning_reflections_session
        ON learning_reflections(session_id,created_at,id);
    ''')


class ReflectionRequest(StrictModel):
    request_id: str = Field(min_length=8, max_length=80, pattern=r'^[A-Za-z0-9_-]+$')
    trainee: str = Field(min_length=1, max_length=24, pattern=r'^[A-Za-z0-9_-]+$')
    review_hash: str = Field(pattern=r'^[a-f0-9]{64}$')
    observed_cue: str = Field(min_length=1, max_length=800)
    remaining_uncertainty: str = Field(max_length=800)
    next_check: str = Field(min_length=1, max_length=800)

    @field_validator('observed_cue', 'remaining_uncertainty', 'next_check', mode='before')
    @classmethod
    def plain_multiline_text(cls, value):
        if isinstance(value, str):
            # Check before trimming, so an invisible control at an edge cannot
            # disappear into an otherwise valid request. HTML stays plain text.
            if any(unicodedata.category(char) == 'Cc' and char not in '\n\t' for char in value):
                raise ValueError('Reflection text may contain only newline and tab control characters')
            return value.strip()
        return value


def eligible_evidence(db, session_id, trainee):
    row = db.execute('''SELECT s.status,s.scorecard,a.session_id AS learning_session,a.evidence
        FROM sessions s LEFT JOIN learning_attempts a ON a.session_id=s.id
        WHERE s.id=? AND s.trainee=?''', (session_id, trainee)).fetchone()
    if not row:
        raise HTTPException(404, 'Learning session not found for this trainee')
    from .crew import is_shared_owner
    if is_shared_owner(db, trainee):
        raise HTTPException(422, 'Shared crew cannot own individual learner reflections')
    if row['learning_session'] is None:
        raise HTTPException(404, 'Learning session not found for this trainee')
    if row['status'] != 'completed' or not row['evidence']:
        raise HTTPException(409, 'Complete server verification before reflecting')
    # Completion/import already verified this persisted evidence. An annotation
    # must not rerun an engine or reinterpret a historical curriculum catalog.
    try:
        evidence = json.loads(row['evidence'])
        if (not isinstance(json.loads(row['scorecard']), dict)
                or evidence['version'] != 'competency-evidence-v1'
                or not isinstance(evidence['original_review_hash'], str)
                or not re.fullmatch(r'[a-f0-9]{64}', evidence['original_review_hash'])):
            raise ValueError('Missing original verified learning evidence')
    except (ValueError, KeyError, TypeError) as error:
        raise HTTPException(409, 'Original learning evidence cannot be verified') from error
    return evidence['original_review_hash']


def response(db, session_id, trainee, review_hash):
    rows = db.execute('''SELECT id,request_id,session_id,trainee,review_hash,
        prompt_version,observed_cue,remaining_uncertainty,next_check,created_at
        FROM learning_reflections WHERE session_id=? ORDER BY created_at,id''',
        (session_id,)).fetchall()
    return dict(session_id=session_id, trainee=trainee, review_hash=review_hash,
                prompt_version=PROMPT_VERSION, reflections=[dict(row) for row in rows], note=NOTE)


@router.get('')
def get_reflections(session_id: str, trainee: str = Query(min_length=1, max_length=24, pattern=r'^[A-Za-z0-9_-]+$')):
    with storage.connect() as db:
        db.execute('BEGIN')
        review_hash = eligible_evidence(db, session_id, trainee)
        return response(db, session_id, trainee, review_hash)


@router.post('', status_code=201)
def append_reflection(session_id: str, req: ReflectionRequest):
    with storage.connect() as db:
        db.execute('BEGIN IMMEDIATE')
        review_hash = eligible_evidence(db, session_id, req.trainee)
        if req.review_hash != review_hash:
            raise HTTPException(409, 'Reflection review hash does not match original learning evidence')
        body = storage.dumps(req.model_dump())
        old = db.execute('SELECT body FROM learning_reflections WHERE session_id=? AND request_id=?',
                         (session_id, req.request_id)).fetchone()
        if old:
            if old['body'] != body:
                raise HTTPException(409, 'Reflection request ID is immutable')
            return response(db, session_id, req.trainee, review_hash)
        count = db.execute('SELECT COUNT(*) FROM learning_reflections WHERE session_id=?', (session_id,)).fetchone()[0]
        if count >= 20:
            raise HTTPException(422, 'This session already has 20 learner reflections')
        db.execute('''INSERT INTO learning_reflections
            (id,request_id,session_id,trainee,review_hash,version,prompt_version,
             observed_cue,remaining_uncertainty,next_check,created_at,body)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)''',
            (str(uuid.uuid4()), req.request_id, session_id, req.trainee, review_hash,
             VERSION, PROMPT_VERSION, req.observed_cue, req.remaining_uncertainty,
             req.next_check, datetime.now(timezone.utc).isoformat(), body))
        return response(db, session_id, req.trainee, review_hash)
