"""Local, officer-operated protocol infrastructure. No synthetic human outcomes."""
import hashlib
import json
import random
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException
from typing import Literal
from pydantic import Field, field_validator
from . import storage
from .models import StrictModel
from .learning import PrepareLearning, catalog, prepare_in_transaction

router=APIRouter(prefix='/api/v1/evaluations/controlled',tags=['Controlled pilot infrastructure'])
PHASES=['baseline','practice1','practice2','practice3','immediate','retention','transfer']
FORMS=dict(baseline='baseline-a',immediate='immediate-b',retention='retention-c',transfer='transfer-d')

def now():return datetime.now(timezone.utc)
def ensure_schema(db):
    db.executescript('''
    CREATE TABLE IF NOT EXISTS controlled_studies(id TEXT PRIMARY KEY,request_id TEXT UNIQUE NOT NULL,body TEXT NOT NULL,protocol TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS controlled_participants(id TEXT PRIMARY KEY,study_id TEXT NOT NULL,label TEXT NOT NULL,trainee TEXT NOT NULL,arm TEXT NOT NULL,consented_at TEXT NOT NULL,UNIQUE(study_id,label),UNIQUE(study_id,trainee));
    CREATE TABLE IF NOT EXISTS controlled_attempts(participant_id TEXT NOT NULL,phase TEXT NOT NULL,preparation_id TEXT NOT NULL UNIQUE,PRIMARY KEY(participant_id,phase));
    CREATE TABLE IF NOT EXISTS controlled_dispositions(
        seq INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT UNIQUE NOT NULL,
        request_id TEXT UNIQUE NOT NULL,participant_id TEXT NOT NULL,
        body TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS controlled_dispositions_participant ON controlled_dispositions(participant_id,seq);
    ''')


def analysis_contract():
    """Hash-covered defaults for new protocols; never retrofit historical v1 rows."""
    return dict(
        version='controlled-analysis-v1',
        estimand='Descriptive within-participant competency evidence change after full versus faded guidance; not a causal learning-effect estimate.',
        population='All consented allocated participants remain in the disposition report, including missing phases and terminal dispositions.',
        primary=dict(phases=['baseline','immediate'],measure='correct / (correct + incorrect) for the registered competency, immediate minus baseline; undefined when either denominator is zero',denominator='One competency/contact/session vote from server-reconstructed evidence; unassessable observations reported separately.'),
        secondary=[dict(phases=['baseline',phase],measure='The same descriptive change; report available pair counts and missing pair counts separately.') for phase in ['retention','transfer']],
        allocation='Seeded permuted blocks of two compare full versus faded guidance only, not adaptive versus baseline policy.',
        exclusions=['Phase incomplete or not server verified: outcome missing, never scored as zero.',
                    'Observed execution ticks below the frozen exposure minimum: retain evidence but exclude that phase from registered exposure-qualified summaries.',
                    'Undefined assessed denominator: report unassessable and missing rate; do not impute a correct rate.',
                    'A terminal disposition blocks new preparation and new session creation. Already-created sessions may finish; their evidence is retained and labeled with the disposition.'],
        missing_data='No imputation, last-observation carry-forward, silent replacement or exclusion based on poor score. Available eligible paired phases only; publish missingness and dispositions by arm.',
        terminal_dispositions='withdrawn and dropout are append-only officer records. Neither permits reactivation; no training evidence is erased or reinterpreted.',
        reporting='Participant counts, phase coverage, exposure exclusions and descriptive arm summaries only. No p-value, causal efficacy, calibrated mastery or operational certification is implied.',
        power='Intended sample is an enrollment ceiling, not a power calculation. Empirical form equivalence and participant evaluation remain external requirements.')


def dispositions_for(db, participant):
    return [dict(id=r['id'],**json.loads(r['body']),recorded_at=r['created_at']) for r in db.execute('SELECT id,body,created_at FROM controlled_dispositions WHERE participant_id=? ORDER BY seq',(participant,))]


def assert_participant_active(db, participant):
    if db.execute('SELECT 1 FROM controlled_dispositions WHERE participant_id=? LIMIT 1',(participant,)).fetchone():
        raise HTTPException(409,'Participant has a terminal disposition; new protocol preparation and session creation are disabled. Existing sessions and evidence are preserved.')


def assert_preparation_launchable(db, preparation):
    # Called inside create_session's write transaction. Existing-session recovery
    # returns before attach; a withdrawal must not erase an in-flight exercise.
    row=db.execute('SELECT participant_id FROM controlled_attempts WHERE preparation_id=?',(preparation,)).fetchone()
    if row:assert_participant_active(db,row['participant_id'])


class DispositionRequest(StrictModel):
    request_id:str=Field(min_length=8,max_length=80,pattern=r'^[A-Za-z0-9_-]+$')
    disposition:Literal['withdrawn','dropout']
    reason:str=Field(min_length=1,max_length=400)

    @field_validator('reason')
    @classmethod
    def useful_reason(cls,value):
        value=value.strip()
        if not value or any(ord(c)<32 or ord(c)==127 for c in value):
            raise ValueError('Use a nonempty single-line reason without control characters')
        return value

class ProtocolRequest(StrictModel):
    request_id:str=Field(min_length=8,max_length=80,pattern=r'^[A-Za-z0-9_-]+$')
    seed:int=Field(default=62147,ge=0,le=4294967295)
    retention_hours:int=Field(default=24,ge=1,le=720)
    transfer_question:str=Field(min_length=15,max_length=400)
    intended_sample:int=Field(ge=2,le=200)
    competency:str=Field(default="C02",pattern=r"^C0[1-5]$")

class EnrolRequest(StrictModel):
    participant:str=Field(pattern=r'^P[0-9]{2,4}$')
    trainee:str=Field(min_length=1,max_length=24,pattern=r'^[A-Za-z0-9_-]+$')
    consent:bool

@router.post('',status_code=201)
def create(req:ProtocolRequest):
    _,digest=catalog();body=storage.dumps(req.model_dump())
    with storage.connect() as db:
        db.execute('BEGIN IMMEDIATE')
        old=db.execute('SELECT * FROM controlled_studies WHERE request_id=?',(req.request_id,)).fetchone()
        if old:
            if old['body']!=body:raise HTTPException(409,'Protocol request is immutable')
            return dict(id=old['id'],protocol=json.loads(old['protocol']))
        protocol=dict(version='controlled-pilot-v2',analysis_contract=analysis_contract(),seed_schedule='Practice uses (registered seed + practice ordinal) modulo 2^32; assessment uses registered seed.',catalog_hash=digest,**req.model_dump(exclude={'request_id'}),allocation='Seeded permuted blocks of two; full versus faded practice guidance',primary_outcome='Descriptive immediate-minus-baseline correct proportion for the registered competency, with assessable denominators, incorrect/unassessable counts and original score reported separately',secondary_outcomes=['Delayed retention observations','Novel semantic transfer-form observations'],phases=PHASES,forms=FORMS,practice_count=3,minimum_observed_ticks=1620,limitations=['Pilot infrastructure only; no participants or human efficacy are implied.','Structural form balance does not establish empirical equivalence.','Allocation is not blinded; local trainee identifiers are not strong research identity.','Facilitator must obtain appropriate consent/review before enrolling people. No operational certification.'])
        protocol['protocol_hash']=hashlib.sha256(storage.dumps(protocol).encode()).hexdigest()
        sid='study_'+uuid.uuid4().hex
        db.execute('INSERT INTO controlled_studies VALUES (?,?,?,?,?)',(sid,req.request_id,body,storage.dumps(protocol),now().isoformat()))
    return dict(id=sid,protocol=protocol)

@router.post('/{study}/participants',status_code=201)
def enrol(study:str,req:EnrolRequest):
    if not req.consent:raise HTTPException(422,'Explicit consent confirmation is required before enrollment')
    from .crew import is_shared_owner
    with storage.connect() as db:
        db.execute('BEGIN IMMEDIATE')
        s=db.execute('SELECT protocol FROM controlled_studies WHERE id=?',(study,)).fetchone()
        if not s:raise HTTPException(404,'Protocol not found')
        p=json.loads(s['protocol'])
        if is_shared_owner(db,req.trainee) or not db.execute('SELECT 1 FROM trainees WHERE id=?',(req.trainee,)).fetchone():raise HTTPException(422,'Use a joined individual trainee')
        old=db.execute('SELECT * FROM controlled_participants WHERE study_id=? AND (label=? OR trainee=?)',(study,req.participant,req.trainee)).fetchone()
        if old:
            if old['label']!=req.participant or old['trainee']!=req.trainee:raise HTTPException(409,'Participant label or trainee already allocated')
            return dict(id=old['id'],participant=old['label'],arm=old['arm'])
        index=db.execute('SELECT COUNT(*) FROM controlled_participants WHERE study_id=?',(study,)).fetchone()[0]
        if index>=p['intended_sample']:raise HTTPException(422,'Frozen intended sample limit reached')
        arms=['full','faded'];random.Random(p['seed']+index//2).shuffle(arms);arm=arms[index%2]
        pid='participant_'+uuid.uuid4().hex
        db.execute('INSERT INTO controlled_participants VALUES (?,?,?,?,?,?)',(pid,study,req.participant,req.trainee,arm,now().isoformat()))
    return dict(id=pid,participant=req.participant,arm=arm)


@router.post('/{study}/participants/{participant}/dispositions',status_code=201)
def record_disposition(study:str,participant:str,req:DispositionRequest):
    body=storage.dumps(req.model_dump())
    with storage.connect() as db:
        db.execute('BEGIN IMMEDIATE')
        if not db.execute('SELECT 1 FROM controlled_participants WHERE id=? AND study_id=?',(participant,study)).fetchone():
            raise HTTPException(404,'Participant not found')
        old=db.execute('SELECT * FROM controlled_dispositions WHERE request_id=?',(req.request_id,)).fetchone()
        if old:
            if old['participant_id']!=participant or old['body']!=body:
                raise HTTPException(409,'Disposition request ID is immutable')
            return dict(id=old['id'],**json.loads(old['body']),recorded_at=old['created_at'])
        if db.execute('SELECT COUNT(*) FROM controlled_dispositions WHERE participant_id=?',(participant,)).fetchone()[0]>=100:
            raise HTTPException(422,'Participant disposition history limit reached')
        did='disposition_'+uuid.uuid4().hex;recorded=now().isoformat()
        db.execute('INSERT INTO controlled_dispositions(id,request_id,participant_id,body,created_at) VALUES (?,?,?,?,?)',(did,req.request_id,participant,body,recorded))
    return dict(id=did,**req.model_dump(),recorded_at=recorded)

@router.post('/{study}/participants/{participant}/{phase}/prepare',status_code=201)
def prepare_phase(study:str,participant:str,phase:str):
    if phase not in PHASES:raise HTTPException(422,'Unknown registered phase')
    with storage.connect() as db:
        db.execute('BEGIN IMMEDIATE')
        row=db.execute('SELECT p.*,s.protocol FROM controlled_participants p JOIN controlled_studies s ON s.id=p.study_id WHERE p.id=? AND p.study_id=?',(participant,study)).fetchone()
        if not row:raise HTTPException(404,'Participant not found')
        assert_participant_active(db,participant)
        protocol=json.loads(row['protocol'])
        if protocol['catalog_hash']!=catalog()[1]:raise HTTPException(409,'Frozen protocol catalog unavailable; do not reinterpret participants')
        prior=db.execute("SELECT c.phase,s.status,s.completed_at,s.execution_tick FROM controlled_attempts c LEFT JOIN learning_attempts a ON a.preparation_id=c.preparation_id LEFT JOIN sessions s ON s.id=a.session_id WHERE c.participant_id=?",(participant,)).fetchall()
        done={r['phase']:r for r in prior if r['status']=='completed'}
        needed=PHASES[:PHASES.index(phase)]
        if any(p not in done for p in needed):raise HTTPException(409,'Complete preceding registered phases first')
        if any(done[p]['execution_tick'] is None or done[p]['execution_tick']<protocol['minimum_observed_ticks'] for p in needed):raise HTTPException(409,'A preceding attempt ended before the registered exposure minimum; retain it as ineligible, do not silently replace its evidence')
        if phase in ['retention','transfer']:
            due=datetime.fromisoformat(done['immediate']['completed_at'])+timedelta(hours=protocol['retention_hours'])
            if now()<due:raise HTTPException(409,'Retention interval has not elapsed; due '+due.isoformat())
        data,_=catalog();practice=phase.startswith('practice')
        # Arms differ only in scaffolding; paired A/B items have the same compiler blueprint.
        candidates=[i for i in data['items'] if i['audience']=='individual' and i['pool']=='practice' and i['competency_id']==protocol['competency'] and i['assistance']==row['arm']]
        item=sorted(candidates,key=lambda i:i['id'])[(int(phase[-1])-1)%len(candidates)] if practice else None
        req=PrepareLearning(request_id='protocol_'+hashlib.sha256((participant+':'+phase).encode()).hexdigest()[:32],trainee=row['trainee'],mode='practice' if practice else 'assessment',form=None if practice else FORMS[phase],item_id=item['id'] if item else protocol['competency']+'_'+FORMS[phase].upper()+'_A',seed=(protocol['seed']+(int(phase[-1]) if practice else 0)) % 4294967296)
        result=prepare_in_transaction(db,req)
        db.execute('INSERT OR IGNORE INTO controlled_attempts VALUES (?,?,?)',(participant,phase,result['preparation_id']))
    return result

@router.get('/{study}')
def report(study:str):
    with storage.connect() as db:
        row=db.execute('SELECT * FROM controlled_studies WHERE id=?',(study,)).fetchone()
        if not row:raise HTTPException(404,'Protocol not found')
        participants=[]
        for p in db.execute('SELECT * FROM controlled_participants WHERE study_id=? ORDER BY consented_at,id',(study,)):
            attempts=[]
            for a in db.execute('SELECT c.phase,s.id,s.status,s.completed_at,s.scorecard,s.execution_tick,l.evidence FROM controlled_attempts c LEFT JOIN learning_attempts l ON l.preparation_id=c.preparation_id LEFT JOIN sessions s ON s.id=l.session_id WHERE c.participant_id=?',(p['id'],)):
                attempts.append(dict(phase=a['phase'],session_id=a['id'],status=a['status'] or 'prepared',completed_at=a['completed_at'],observed_ticks=a['execution_tick'],exposure_eligible=a['status']=='completed' and a['execution_tick'] is not None and a['execution_tick']>=json.loads(row['protocol'])['minimum_observed_ticks'],scorecard=json.loads(a['scorecard']) if a['scorecard'] else None,evidence=json.loads(a['evidence']) if a['evidence'] else None))
            dispositions=dispositions_for(db,p['id'])
            participants.append(dict(id=p['id'],trainee=p['trainee'],participant=p['label'],arm=p['arm'],consented_at=p['consented_at'],lifecycle_status=dispositions[-1]['disposition'] if dispositions else 'active',dispositions=dispositions,attempts=attempts))
    return dict(id=study,protocol=json.loads(row['protocol']),participants=participants,note='Missing outcomes remain missing. No human learning gain, causal effect or readiness is inferred.')
