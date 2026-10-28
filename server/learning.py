"""Versioned competency evidence and curriculum preparation above frozen engines.

Practice never writes individual skill outcomes. Assessments use disjoint forms;
only completed, server-reconstructed decisions support competency observations.
This is evidence coverage, not calibrated mastery or demonstrated human efficacy.
"""
import hashlib
import json
import random
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal
from fastapi import APIRouter, HTTPException
from pydantic import Field
from . import storage
from .models import StrictModel
from .raid_v2 import compose_raid
from .learning_catalogs import catalog_by_hash, current_catalog

router = APIRouter(prefix='/api/v1/learning', tags=['Curriculum and competency evidence'])
CATALOG = Path(__file__).parent/'config/learning-v1.json'
CONTRACT = 'competency-evidence-v1'


def catalog():
    return current_catalog(CATALOG)


def ensure_schema(db):
    db.executescript('''
    CREATE TABLE IF NOT EXISTS learning_preparations (
        id TEXT PRIMARY KEY, trainee TEXT NOT NULL, body TEXT NOT NULL,
        context TEXT NOT NULL, scenario_id TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS learning_attempts (
        session_id TEXT PRIMARY KEY, preparation_id TEXT UNIQUE,
        context TEXT NOT NULL, evidence TEXT);
    CREATE INDEX IF NOT EXISTS learning_preparations_owner ON learning_preparations(trainee);
    ''')


class Coverage(StrictModel):
    correct: int = Field(ge=0,le=10000000)
    incorrect: int = Field(ge=0,le=10000000)
    unassessable: int = Field(ge=0,le=10000000)
    assessed_sessions: int = Field(ge=0,le=10000)


class Selection(StrictModel):
    policy: Literal['direct-item-v1','coverage-director-v1']
    coverage: dict[str,Coverage] = Field(max_length=6)
    recent_items: list[str] = Field(max_length=8)
    candidates: list[str] = Field(min_length=1,max_length=60)
    reason: str = Field(min_length=1,max_length=400)


class LearningContext(StrictModel):
    version: Literal['learning-v1'] = 'learning-v1'
    catalog_hash: str = Field(pattern=r'^[a-f0-9]{64}$')
    item_id: str = Field(pattern=r'^[A-Z0-9_-]{3,64}$')
    mode: Literal['practice','assessment','adaptive']
    assistance: Literal['full','faded','none']
    seed: int = Field(ge=0,le=4294967295)
    selection: Selection


class PrepareLearning(StrictModel):
    request_id: str = Field(min_length=8,max_length=80,pattern=r'^[A-Za-z0-9_-]+$')
    trainee: str = Field(min_length=1,max_length=24,pattern=r'^[A-Za-z0-9_-]+$')
    mode: Literal['practice','assessment','adaptive'] = 'practice'
    item_id: str | None = Field(default=None,pattern=r'^[A-Z0-9_-]{3,64}$')
    form: Literal['baseline-a','immediate-b','retention-c','transfer-d'] | None = None
    seed: int = Field(default=62147,ge=0,le=4294967295)


def item_for(context):
    ctx = context if isinstance(context,LearningContext) else LearningContext.model_validate(context)
    data, _ = catalog_by_hash(ctx.catalog_hash, ctx.version)
    item = next((x for x in data['items'] if x['id']==ctx.item_id),None)
    if not item or item['audience']!='individual':
        raise ValueError('Unknown individual curriculum item')
    if (ctx.mode=='assessment') != (item['pool']=='assessment'):
        raise ValueError('Practice and assessment pools cannot be exchanged')
    if ctx.assistance != ('none' if ctx.mode=='assessment' else item['assistance']):
        raise ValueError('Assistance disagrees with frozen item mode')
    eligible=[i for i in data['items'] if i['audience']=='individual' and i['pool']==item['pool'] and (ctx.mode!='assessment' or i['form']==item['form'])]
    ids={i['id'] for i in eligible}
    if not ctx.selection.candidates or len(set(ctx.selection.candidates))!=len(ctx.selection.candidates) or not set(ctx.selection.candidates)<=ids or ctx.item_id not in ctx.selection.candidates:raise ValueError('Invalid frozen selection candidates')
    if set(ctx.selection.coverage)!={c['id'] for c in data['competencies'] if c['scope']=='individual'}:raise ValueError('Invalid competency coverage snapshot')
    if (ctx.mode=='adaptive')!=(ctx.selection.policy=='coverage-director-v1'):raise ValueError('Selection policy disagrees with learning mode')
    if any(i not in {x['id'] for x in data['items'] if x['audience']=='individual'} for i in ctx.selection.recent_items):raise ValueError('Unknown recent learning item')
    return item



def episode_briefing(context, preparation_id, scenario_id):
    """Public lesson prose from the exact frozen catalog, never current content.

    This is an additive presentation projection. No new context/scenario/DB
    field is stored, and it cannot change launch or evaluation semantics.
    """
    ctx = context if isinstance(context, LearningContext) else LearningContext.model_validate(context)
    item = item_for(ctx)
    def public_text(value, maximum):
        if type(value) is not str or not value.strip() or len(value) > maximum:
            raise ValueError('Invalid public episode briefing text')
        return value
    if (type(preparation_id) is not str or not 8 <= len(preparation_id) <= 80
            or type(scenario_id) is not str or not 1 <= len(scenario_id) <= 100):
        raise ValueError('Invalid episode briefing scope')
    instructions = item.get('instructions')
    if type(instructions) is not list or not 1 <= len(instructions) <= 12:
        raise ValueError('Invalid public episode instructions')
    competency = item.get('competency_id')
    if competency not in {'C01', 'C02', 'C03', 'C04', 'C05'}:
        raise ValueError('Unsupported public episode competency')
    return dict(version='episode-briefing-v1', preparation_id=preparation_id,
                scenario_id=scenario_id, catalog_version=ctx.version,
                catalog_hash=ctx.catalog_hash, item_id=ctx.item_id,
                competency_id=competency, mode=ctx.mode, assistance=ctx.assistance,
                title=public_text(item.get('title'), 240),
                objective=public_text(item.get('objective'), 1000),
                instructions=[public_text(line, 1000) for line in instructions])


def preparation_response(preparation_id, scenario, context, **extra):
    """Missing/unresolvable prose never reinterprets a historical preparation.

    Returning null leaves the client its explicit generic fallback. Existing
    authoritative attach/compile validation still governs whether it can run.
    """
    try:
        briefing = episode_briefing(context, preparation_id, scenario.get('id') if type(scenario) is dict else None)
    except ValueError:
        briefing = None
    return dict(preparation_id=preparation_id, scenario=scenario, context=context,
                briefing=briefing, **extra)


def compile_item(context):
    ctx = context if isinstance(context,LearningContext) else LearningContext.model_validate(context)
    item = item_for(ctx)
    return compose_raid({**item['scenario'], 'seed': ctx.seed, 'name': item['title'], **({'fusion':{'mode':'assessment'}} if ctx.mode=='assessment' else {})})


def is_practice(db, sid):
    # The first active-observation engine is practice-only, never retroactive mastery.
    row=db.execute('SELECT sc.spec FROM sessions s JOIN scenarios sc ON sc.id=s.scenario_id WHERE s.id=?',(sid,)).fetchone()
    if row and json.loads(row['spec']).get('engine_version')=='vyuha-0.5.0':return True
    if not db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='learning_attempts'").fetchone():return False
    row=db.execute('SELECT context FROM learning_attempts WHERE session_id=?',(sid,)).fetchone()
    return bool(row and json.loads(row['context'])['mode']!='assessment')


def evidence_for(review, context):
    """Pure projection; never edits review, score, action history or Beta profiles."""
    ctx=LearningContext.model_validate(context);item=item_for(ctx);data,_=catalog_by_hash(ctx.catalog_hash, ctx.version)
    observations=[];seen=set()
    for comp in data['competencies']:
        if comp['scope']!='individual':continue
        for decision in review['decision_reviews']:
            if decision['decision_kind'] not in comp['decision_kinds']:continue
            expected=decision['expected_action'];evidence=decision['evidence']
            if comp.get('effector')=='hold' and expected.get('effector')!='hold':continue
            if comp.get('effector')=='active' and expected.get('effector') not in ['rf_jam','kinetic']:continue
            if comp.get('requires_degraded') and 'degraded_sensor_response' not in decision['skill_tags']:continue
            key=(comp['id'],decision['decision_id'])
            if key in seen:continue
            seen.add(key)
            observable=expected['basis']=='available_evidence'
            if decision['decision_kind']=='detection':observable=evidence['first_detectable_tick'] is not None
            verdict=decision['verdict'] if observable else 'unassessable'
            observations.append(dict(competency_id=comp['id'],decision_id=decision['decision_id'],
                                     track_id=decision['track_id'],tick=decision['tick'],verdict=verdict,
                                     reason=decision['reason_code'] if observable else 'INSUFFICIENT_OBSERVABLE_EVIDENCE'))
    summary={c['id']:dict(correct=0,incorrect=0,unassessable=0) for c in data['competencies'] if c['scope']=='individual'}
    # At most one vote per contact/competency/session. Any observable error
    # wins over later corrections; repeated accepted actions cannot farm credit.
    votes={}
    rank={'unassessable':0,'correct':1,'incorrect':2}
    for row in observations:
        key=(row['competency_id'],row['track_id'])
        if key not in votes or rank[row['verdict']]>rank[votes[key]]:votes[key]=row['verdict']
    for (cid,_),verdict in votes.items():summary[cid][verdict]+=1
    return dict(version=CONTRACT,item_id=item['id'],mode=ctx.mode,assistance=ctx.assistance,
                assessed=ctx.mode=='assessment',observations=observations,summary=summary,
                original_review_hash=hashlib.sha256(storage.dumps(review['decision_reviews']).encode()).hexdigest(),
                limitation='Scenario-bound evidence only. No validated proficiency, operational readiness or human learning gain is inferred.')


def attach(db, sid, preparation, trainee, scenario_id):
    row=db.execute('SELECT * FROM learning_preparations WHERE id=?',(preparation,)).fetchone()
    if not row:raise HTTPException(404,'Learning preparation not found')
    if row['trainee']!=trainee or row['scenario_id']!=scenario_id:
        raise HTTPException(422,'Learning preparation belongs to another trainee or scenario')
    from .controlled_study import assert_preparation_launchable
    assert_preparation_launchable(db,preparation)
    item_for(json.loads(row['context']))
    db.execute('INSERT INTO learning_attempts(session_id,preparation_id,context) VALUES (?,?,?)',(sid,preparation,row['context']))


def complete_attempt(db, sid, review):
    row=db.execute('SELECT context,evidence FROM learning_attempts WHERE session_id=?',(sid,)).fetchone()
    if not row:return
    result=storage.dumps(evidence_for(review,json.loads(row['context'])))
    if row['evidence'] is not None and row['evidence']!=result:
        raise ValueError('Completed competency evidence is immutable')
    db.execute('UPDATE learning_attempts SET evidence=? WHERE session_id=? AND evidence IS NULL',(result,sid))


def decorate(db, sid):
    row=db.execute('SELECT context,evidence FROM learning_attempts WHERE session_id=?',(sid,)).fetchone()
    return {'learning':dict(context=json.loads(row['context']),evidence=json.loads(row['evidence']) if row['evidence'] else None)} if row else {}


def coverage(db, trainee):
    data,_=catalog()
    result={c['id']:dict(correct=0,incorrect=0,unassessable=0,assessed_sessions=0) for c in data['competencies'] if c['scope']=='individual'}
    rows=db.execute("SELECT a.context,a.evidence,s.id FROM learning_attempts a JOIN sessions s ON s.id=a.session_id WHERE s.trainee=? AND s.status='completed' ORDER BY s.created_at,s.id",(trainee,)).fetchall()
    practice=assessed=0;recent=[];lessons=set()
    for row in rows:
        context=json.loads(row['context']);recent.append(context['item_id'])
        if not row['evidence']:continue
        evidence=json.loads(row['evidence'])
        if context['mode']!='assessment':
            practice+=1
            if any(o['verdict']=='correct' and o['competency_id']==item_for(context)['competency_id'] for o in evidence['observations']):lessons.add(context['item_id'])
            continue
        assessed+=1
        for key,counts in evidence['summary'].items():
            for label in ['correct','incorrect','unassessable']:result[key][label]+=counts[label]
            if counts['correct']+counts['incorrect']>0:result[key]['assessed_sessions']+=1
    return dict(competencies=result,assessed_attempts=assessed,practice_attempts=practice,
                practiced_items=sorted(lessons),recent_items=recent[-8:],
                limitation='Evidence counts are not a calibrated mastery probability. Crew and practice never count as individual assessment.')


def choose_item(data, state, req):
    pool=[i for i in data['items'] if i['audience']=='individual' and i['pool']==('assessment' if req.mode=='assessment' else 'practice')]
    if req.mode=='assessment':
        if not req.form:raise ValueError('Choose an explicit assessment form')
        pool=[i for i in pool if i['form']==req.form]
    elif req.form:raise ValueError('Assessment form cannot be used for practice')
    if req.item_id:
        pool=[i for i in pool if i['id']==req.item_id]
        if not pool:raise ValueError('Item is outside this practice/assessment pool')
    if not pool:raise ValueError('No eligible curriculum item')
    rng=random.Random(req.seed)
    candidates=sorted(pool,key=lambda i:i['id']);rng.shuffle(candidates)
    if req.mode=='adaptive':
        # Coverage then observed error rate; no hidden scenario/live truth or fitted efficacy claim.
        def priority(item):
            c=state['competencies'][item['competency_id']]
            n=c['correct']+c['incorrect']
            return (c['assessed_sessions'], (c['correct']+1)/(n+2), item['id'] in state['recent_items'])
        fresh=[i for i in candidates if i['id'] not in state['recent_items'][-2:]]
        candidates=fresh or candidates
        chosen=min(candidates,key=priority)
        policy='coverage-director-v1';reason='Coverage-first curriculum selection; observed uncertainty/error breaks ties. Recent items are avoided when alternatives exist. This heuristic has no demonstrated learning efficacy.'
    else:
        fresh=[i for i in candidates if i['id'] not in state['recent_items']]
        chosen=(fresh or candidates)[0];policy='direct-item-v1';reason='Explicit practice item or balanced assessment form; seeded semantic variant. Practice and assessment pools are disjoint.'
    return chosen,dict(policy=policy,coverage=state['competencies'],recent_items=state['recent_items'],candidates=[i['id'] for i in candidates],reason=reason)


@router.get('/catalogue')
def public_catalogue():
    data,digest=catalog()
    # No roster, seed, answer key or hidden scenario truth in the learner catalog.
    public_fields=['id','title','competency_id','pool','form','assistance','audience','objective','instructions','reflection']
    return dict(version='learning-v1',catalog_hash=digest,competencies=data['competencies'],
                items=[{k:item[k] for k in public_fields} for item in data['items']],
                limitation='Illustrative training curriculum. Completion is not operational certification or proof of improved human learning.')


@router.get('/trainees/{trainee}/progress')
def progress(trainee:str):
    from .crew import is_shared_owner
    with storage.connect() as db:
        if is_shared_owner(db,trainee):raise HTTPException(422,'Crew aggregates cannot own individual competency evidence')
        return coverage(db,trainee)


def prepare_in_transaction(db, req:PrepareLearning):
    """Prepare against an existing transaction so protocol lifecycle cannot race."""
    from .crew import is_shared_owner
    body=storage.dumps(req.model_dump())
    if is_shared_owner(db,req.trainee):raise HTTPException(422,'Shared crew cannot prepare an individual curriculum')
    if not db.execute('SELECT 1 FROM trainees WHERE id=?',(req.trainee,)).fetchone():raise HTTPException(422,'Join a unit before preparing a learning item')
    old=db.execute('SELECT * FROM learning_preparations WHERE id=?',(req.request_id,)).fetchone()
    if old:
        if old['body']!=body:raise HTTPException(409,'Preparation request ID is immutable')
        spec=json.loads(db.execute('SELECT spec FROM scenarios WHERE id=?',(old['scenario_id'],)).fetchone()['spec'])
        return preparation_response(old['id'],spec,json.loads(old['context']))
    if db.execute('SELECT COUNT(*) FROM learning_preparations WHERE trainee=?',(req.trainee,)).fetchone()[0]>=1000:raise HTTPException(422,'Curriculum preparation limit reached')
    data,digest=catalog()
    state=coverage(db,req.trainee)
    try:
        item,selection=choose_item(data,state,req)
        ctx=LearningContext(catalog_hash=digest,item_id=item['id'],mode=req.mode,assistance='none' if req.mode=='assessment' else item['assistance'],seed=req.seed,selection=selection).model_dump()
        spec=compile_item(ctx)
    except ValueError as error:raise HTTPException(422,str(error)) from error
    db.execute('INSERT OR IGNORE INTO scenarios VALUES (?,?)',(spec['id'],storage.dumps(spec)))
    db.execute('INSERT INTO learning_preparations VALUES (?,?,?,?,?,?)',(req.request_id,req.trainee,body,storage.dumps(ctx),spec['id'],datetime.now(timezone.utc).isoformat()))
    return preparation_response(req.request_id,spec,ctx)


@router.post('/prepare',status_code=201)
def prepare(req:PrepareLearning):
    with storage.connect() as db:
        db.execute('BEGIN IMMEDIATE')
        return prepare_in_transaction(db,req)

@router.get('/preparations/{preparation}')
def get_preparation(preparation:str,trainee:str):
    with storage.connect() as db:
        row=db.execute('SELECT * FROM learning_preparations WHERE id=? AND trainee=?',(preparation,trainee)).fetchone()
        if not row:raise HTTPException(404,'Learning preparation not found for this trainee')
        spec=json.loads(db.execute('SELECT spec FROM scenarios WHERE id=?',(row['scenario_id'],)).fetchone()['spec'])
        used=db.execute('SELECT session_id FROM learning_attempts WHERE preparation_id=?',(preparation,)).fetchone()
    return preparation_response(preparation,spec,json.loads(row['context']),session_id=used['session_id'] if used else None)
