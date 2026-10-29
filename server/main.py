import json
import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .engine import ENGINE_VERSION, make_scenario, replay, score
from pydantic import TypeAdapter

from .models import Action, Complete, CreateSession, EventBatch, Generate, InstructorCommand, ControlState
from .storage import connect, dumps, init
from .review import build_review
from .teaching import decorate_review
from .review_models import DecisionReview, GhostAAR
from .director import persist_outcomes, read_profile, recent_history, select_director, adapt_scenario
from .director_models import DirectorDecision, TrainingProfile


@asynccontextmanager
async def lifespan(app):
    init()
    try:
        yield
    finally:
        from .query_cache import clear
        clear()


app = FastAPI(title="VYUHA local training API", version="0.2.0", lifespan=lifespan)
from .hardening import BoundedJSON
app.add_middleware(BoundedJSON)
app.add_middleware(CORSMiddleware, allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"], allow_methods=["GET", "POST"], allow_headers=["Content-Type", "Authorization", "X-VYUHA-Crew-Token"])
from .auth import install as install_auth
install_auth(app)


@app.get("/api/v1/health")
def health():
    return {"status": "ok", "engine_version": ENGINE_VERSION, "storage": "sqlite", "mode": "unit" if os.environ.get("VYUHA_UNIT_MODE")=="1" else "local-demo", "unit_id":"local"}


def review_session(db, row):
    log=logged_events(db,row['id']);commands=applied_commands(db,row['id'])
    observed=row['execution_tick']
    source='completion'
    if observed is None:
        observed=json.loads(row['control_state'])['tick'] if row['control_state'] else max([e['tick'] for e in log+commands],default=0)
        source='telemetry' if row['control_state'] else 'last_recorded_event'
    review,card=build_review(json.loads(row['spec']),log,commands,row['id'],observed,source,row['end_tick'])
    stored=json.loads(row['scorecard'])
    if {k:v for k,v in card.items() if k!='engine_version'}!={k:v for k,v in stored.items() if k!='engine_version'}:
        raise ValueError('Stored score disagrees with reconstructed session')
    return review


def profile(trainee):
    # Established profiles need a consistent read snapshot, not a SQLite writer lock.
    with connect() as db:
        db.execute('BEGIN')
        from .crew import is_shared_owner
        if is_shared_owner(db,trainee):
            from .director import SKILLS
            return TrainingProfile(trainee=trainee,sessions=0,skills={s:dict(alpha=1.,beta=1.,observations=0,mean=.5,updated_at=None,last_session_id=None) for s in SKILLS},outcomes=[],unprocessed_sessions=[],version='shared-crew-not-individual').model_dump()
        ready=db.execute('SELECT COUNT(*) FROM skill_profiles WHERE trainee=?',(trainee,)).fetchone()[0]==4
        pending=db.execute("SELECT 1 FROM sessions s JOIN scenarios sc ON sc.id=s.scenario_id LEFT JOIN skill_outcomes o ON o.session_id=s.id WHERE COALESCE(json_extract(sc.spec,'$.engine_version'),'') NOT IN ('vyuha-0.5.0','vyuha-0.6.0') AND s.trainee=? AND s.status='completed' AND o.session_id IS NULL AND NOT EXISTS(SELECT 1 FROM learning_attempts la WHERE la.session_id=s.id AND json_extract(la.context,'$.mode')!='assessment') LIMIT 1",(trainee,)).fetchone()
        if ready and not pending:return read_profile(db,trainee,ensure=False)
    with connect() as db:
        db.execute('BEGIN IMMEDIATE')
        pending=db.execute("SELECT s.*,sc.spec FROM sessions s JOIN scenarios sc ON sc.id=s.scenario_id LEFT JOIN skill_outcomes o ON o.session_id=s.id WHERE COALESCE(json_extract(sc.spec,'$.engine_version'),'') NOT IN ('vyuha-0.5.0','vyuha-0.6.0') AND s.trainee=? AND s.status='completed' AND o.session_id IS NULL AND NOT EXISTS(SELECT 1 FROM learning_attempts la WHERE la.session_id=s.id AND json_extract(la.context,'$.mode')!='assessment') ORDER BY s.created_at,s.id",(trainee,)).fetchall()
        skipped=[]
        for row in pending:
            try:review=review_session(db,row)
            except (ValueError,KeyError,TypeError,HTTPException):
                skipped.append(row['id']);continue
            persist_outcomes(db,trainee,row['id'],review)
        return read_profile(db,trainee,skipped)


@app.get("/api/v1/trainees/{trainee}/profile")
def get_profile(trainee: str):
    return profile(trainee)


@app.post("/api/v1/scenarios/generate")
def generate(req: Generate):
    if req.mode == 'adaptive':
        snapshot=profile(req.trainee)
        with connect() as db:
            history=recent_history(db,req.trainee)
            scenario=adapt_scenario(select_director(snapshot,history,req.seed))
    else:
        scenario=make_scenario(req.seed,req.focus or 'recognition',req.night)
    if req.advanced:
        from .exercises import PACKS,enrich,AuthorScenario,compile_authored
        from .advanced import selected_pack
        with connect() as db:
            from .crew import is_shared_owner
            if is_shared_owner(db,req.trainee):raise HTTPException(422,'Shared crew aggregate cannot own an individual session')
            member=db.execute('SELECT unit_id FROM trainees WHERE id=?',(req.trainee,)).fetchone()
            pack=req.pack_id or selected_pack(db,member['unit_id'] if member else 'local')
        if pack not in PACKS:raise HTTPException(422,'Unknown doctrine pack')
        if req.mode=='adaptive':scenario=enrich(scenario,pack,req.tactic,history)
        else:
            p=PACKS[pack]
            try:scenario=compile_authored(AuthorScenario(name='Pack training exercise',pack_id=pack,seed=req.seed,night=req.night,mix=p['defaults']['mix'],tactic=req.tactic or 'DIRECT'))
            except ValueError as error:raise HTTPException(422,str(error)) from error
    with connect() as db:
        db.execute("INSERT OR IGNORE INTO scenarios(id,spec) VALUES (?,?)", (scenario['id'],dumps(scenario)))
    return scenario


@app.post("/api/v1/sessions", status_code=201)
def create_session(req: CreateSession):
    from .crew import is_shared_owner
    with connect() as db:
        if is_shared_owner(db,req.trainee):raise HTTPException(422,'Shared crew aggregate cannot own an individual session')
    session_id = str(uuid.uuid4())
    with connect() as db:
        db.execute("BEGIN IMMEDIATE")
        if req.learning_preparation:
            previous=db.execute('SELECT a.session_id,s.trainee,s.scenario_id,s.status,s.control_state FROM learning_attempts a JOIN sessions s ON s.id=a.session_id WHERE a.preparation_id=?',(req.learning_preparation,)).fetchone()
            if previous:
                if previous['trainee']!=req.trainee or previous['scenario_id']!=req.scenario_id:raise HTTPException(422,'Preparation belongs to another trainee or scenario')
                used=db.execute('SELECT 1 FROM chunks WHERE session_id=? UNION ALL SELECT 1 FROM instructor_commands WHERE session_id=?',(previous['session_id'],previous['session_id'])).fetchone()
                if previous['status']=='active' and not previous['control_state'] and not used:return {'id':previous['session_id']}
                raise HTTPException(409,'Learning preparation already started; restore its original session or prepare a new attempt')
        spec_row=db.execute("SELECT spec FROM scenarios WHERE id=?", (req.scenario_id,)).fetchone()
        if not spec_row:
            raise HTTPException(404, "Scenario not found")
        member=db.execute('SELECT unit_id FROM trainees WHERE id=?',(req.trainee,)).fetchone()
        if not member:
            if os.environ.get('VYUHA_UNIT_MODE')=='1':raise HTTPException(422,'Join a unit before starting training')
            db.execute("INSERT INTO trainees VALUES (?,'local',?,?)",(req.trainee,req.trainee,datetime.now(timezone.utc).isoformat()))
        db.execute("INSERT INTO sessions(id,trainee,scenario_id,created_at,unit_id) VALUES (?,?,?,?,?)", (session_id, req.trainee, req.scenario_id, datetime.now(timezone.utc).isoformat(),member['unit_id'] if member else 'local'))
        if req.learning_preparation:
            from .learning import attach
            attach(db,session_id,req.learning_preparation,req.trainee,req.scenario_id)
        decision=json.loads(spec_row['spec']).get('director_decision')
        if decision:
            if decision['trainee_id']!=req.trainee:
                raise HTTPException(422,'Adaptive scenario belongs to a different trainee')
            db.execute('INSERT INTO director_history(session_id,trainee,decision) VALUES (?,?,?)',(session_id,req.trainee,dumps(decision)))
    return {"id": session_id}


@app.post("/api/v1/sessions/{session_id}/events")
def events(session_id: str, req: EventBatch):
    payload = dumps([e.model_dump(exclude_none=True) for e in req.events])
    with connect() as db:
        db.execute("BEGIN IMMEDIATE")
        session = db.execute("SELECT status FROM sessions WHERE id=?", (session_id,)).fetchone()
        if not session:
            raise HTTPException(404, "Session not found")
        old = db.execute("SELECT payload FROM chunks WHERE session_id=? AND seq=?", (session_id, req.seq)).fetchone()
        if old:
            if old["payload"] != payload:
                raise HTTPException(409, "A sequence number cannot be reused with different events")
            return {"ack": req.seq, "duplicate": True}
        if session["status"] != "active":
            raise HTTPException(409, "Session already completed")
        if any(e.k=='inspect' for e in req.events):
            frozen=db.execute('SELECT sc.spec FROM sessions s JOIN scenarios sc ON sc.id=s.scenario_id WHERE s.id=?',(session_id,)).fetchone()
            if json.loads(frozen['spec']).get('engine_version') not in ('vyuha-0.5.0','vyuha-0.6.0'):
                raise HTTPException(422,'Observation requests require the explicit acquisition engine')
        if any(e.k=='defer' for e in req.events):
            frozen=db.execute('SELECT sc.spec FROM sessions s JOIN scenarios sc ON sc.id=s.scenario_id WHERE s.id=?',(session_id,)).fetchone()
            if json.loads(frozen['spec']).get('engine_version')!='vyuha-0.6.0':raise HTTPException(422,'Defer requires the explicit uncertainty decision engine')
        count = db.execute("SELECT COUNT(*) FROM chunks WHERE session_id=?", (session_id,)).fetchone()[0]
        if count >= 1000:
            raise HTTPException(422, "Session event limit exceeded")
        db.execute("INSERT INTO chunks(session_id,seq,payload) VALUES (?,?,?)", (session_id, req.seq, payload))
    return {"ack": req.seq, "duplicate": False}


def session_record(db, session_id):
    row = db.execute("SELECT s.*,sc.spec FROM sessions s JOIN scenarios sc ON sc.id=s.scenario_id WHERE s.id=?", (session_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Session not found")
    return row


def logged_events(db, session_id):
    chunks = db.execute("SELECT seq,payload FROM chunks WHERE session_id=? ORDER BY seq", (session_id,)).fetchall()
    if [c["seq"] for c in chunks] != list(range(len(chunks))):
        raise HTTPException(409, "Missing event batches; retry upload before completion")
    result = [e for c in chunks for e in json.loads(c["payload"])]
    if len(result) > 5000:
        raise HTTPException(422, "Session has too many events")
    return result


@app.post("/api/v1/sessions/{session_id}/complete")
def complete(session_id: str, req: Complete):
    # Expensive deterministic reconstruction is outside SQLite's writer lock.
    with connect() as db:
        row = session_record(db,session_id)
        if row['status']=='completed':return json.loads(row['scorecard'])
        log=logged_events(db,session_id);commands=applied_commands(db,session_id)
    spec=json.loads(row['spec'])
    if req.end_tick!=round(spec['duration']*30):raise HTTPException(422,'Completion must use the frozen scenario duration')
    if req.execution_tick is not None and req.execution_tick>req.end_tick:raise HTTPException(422,'Observed horizon exceeds frozen duration')
    if req.execution_tick is not None and any(e['tick']>req.execution_tick for e in log+commands):
        raise HTTPException(422,'Recorded action exceeds observed exercise horizon')
    observed=req.execution_tick if req.execution_tick is not None else json.loads(row['control_state'])['tick'] if row['control_state'] else max([e['tick'] for e in log+commands],default=0)
    source='completion' if req.execution_tick is not None else 'telemetry' if row['control_state'] else 'last_recorded_event'
    try:review,card=build_review(json.loads(row['spec']),log,commands,session_id,observed,source,req.end_tick)
    except ValueError as error:raise HTTPException(422,str(error)) from error
    with connect() as db:
        db.execute('BEGIN IMMEDIATE');latest=session_record(db,session_id)
        if latest['status']=='completed':return json.loads(latest['scorecard'])
        if logged_events(db,session_id)!=log or applied_commands(db,session_id)!=commands or req.execution_tick is None and latest['control_state']!=row['control_state']:
            raise HTTPException(409,'Session changed during scoring; retry completion')
        db.execute("UPDATE sessions SET status='completed',scorecard=?,end_tick=?,execution_tick=?,completed_at=? WHERE id=?",(dumps(card),req.end_tick,req.execution_tick,datetime.now(timezone.utc).isoformat(),session_id))
        from .learning import complete_attempt
        complete_attempt(db,session_id,review)
        persist_outcomes(db,row['trainee'],session_id,review)
        from .units import persist_stats
        persist_stats(db,session_id,review)
    return card


@app.get("/api/v1/sessions/{session_id}/aar")
def aar(session_id: str, include_review: bool = True):
    with connect() as db:
        row = session_record(db, session_id)
        if row["status"] != "completed":
            raise HTTPException(409, "Session not completed")
        log=logged_events(db,session_id);commands=applied_commands(db,session_id)
        if row["execution_tick"] is not None:
            observed=row["execution_tick"];source="completion"
        elif row["control_state"]:
            observed=json.loads(row["control_state"])["tick"];source="telemetry"
        else:
            observed=max([e["tick"] for e in log+commands],default=0);source="last_recorded_event"
        from .learning import decorate as decorate_learning
        if not include_review:
            return dict(id=row["id"],trainee=row["trainee"],unit_id=row["unit_id"],exercise_group_id=row["exercise_group_id"],scenario=json.loads(row["spec"]),events=log,commands=commands,
                        executionTick=observed,endTick=row["end_tick"],scorecard=json.loads(row["scorecard"]),created_at=row["created_at"],verified=True,**decorate_learning(db,session_id))
        try:
            review,reconstructed_card=build_review(json.loads(row["spec"]),log,commands,session_id,observed,source,row["end_tick"])
        except (ValueError,KeyError,TypeError) as error:
            raise HTTPException(422,"Stored session cannot be reconstructed for review") from error
        stored_card=json.loads(row["scorecard"])
        if {k:v for k,v in reconstructed_card.items() if k!='engine_version'}!={k:v for k,v in stored_card.items() if k!='engine_version'}:
            raise HTTPException(422,"Stored score disagrees with reconstructed session")
        return dict(id=row["id"], trainee=row["trainee"], unit_id=row["unit_id"], exercise_group_id=row["exercise_group_id"], scenario=json.loads(row["spec"]), events=log,
                    commands=commands,executionTick=observed,endTick=row["end_tick"],scorecard=json.loads(row["scorecard"]),
                    created_at=row["created_at"],verified=True,**decorate_review(db,session_id,review),**decorate_learning(db,session_id))


@app.get("/api/v1/units/{unit_id}/dashboard")
def dashboard(unit_id: str = 'local'):
    from .units import unit_dashboard
    return unit_dashboard(unit_id)


@app.get("/api/v1/contracts")
def contracts():
    return {"Action": Action.model_json_schema(), "InstructorCommand": TypeAdapter(InstructorCommand).json_schema(), "DecisionReview": DecisionReview.model_json_schema(), "GhostAAR": GhostAAR.model_json_schema(), "DirectorDecision": DirectorDecision.model_json_schema(), "TrainingProfile": TrainingProfile.model_json_schema(), "engine_version": ENGINE_VERSION}


def command_records(db, session_id, after=0):
    return [{**json.loads(r["body"]), "session_id":session_id, "seq":r["seq"], "issued_at":r["issued_at"],
             "tick":r["tick"], "order":r["timeline_order"]}
            for r in db.execute("SELECT * FROM instructor_commands WHERE session_id=? AND seq>? ORDER BY seq",(session_id,after))]


def applied_commands(db, session_id):
    return [c for c in command_records(db,session_id) if c["tick"] is not None]


def instructor_session(db, session_id):
    row = session_record(db,session_id)
    state = json.loads(row["control_state"]) if row["control_state"] else None
    fresh = row["last_seen"] and (datetime.now(timezone.utc)-datetime.fromisoformat(row["last_seen"])).total_seconds()<6
    status = "COMPLETED" if row["status"] == "completed" else "RECOVERABLE" if not fresh else "PAUSED" if state and state["paused"] else "ACTIVE"
    member=db.execute('SELECT callsign FROM trainees WHERE id=?',(row['trainee'],)).fetchone()
    return dict(id=row["id"],trainee=row["trainee"],callsign=member['callsign'] if member else row['trainee'],unit_id=row["unit_id"],exercise_group_id=row["exercise_group_id"],scenario=json.loads(row["spec"])["title"],status=status,
                last_seen=row["last_seen"],telemetry=state,commands=command_records(db,session_id))


@app.get("/api/v1/instructor/sessions")
def instructor_sessions():
    with connect() as db:
        rows = db.execute("SELECT id FROM sessions ORDER BY (status='active') DESC,created_at DESC LIMIT 100").fetchall()
        return {"sessions":[instructor_session(db,r["id"]) for r in rows]}


@app.get("/api/v1/instructor/sessions/{session_id}")
def instructor_detail(session_id:str):
    with connect() as db:
        return instructor_session(db,session_id)


@app.post("/api/v1/instructor/sessions/{session_id}/commands")
def issue_command(session_id:str, req:InstructorCommand):
    body = dumps(req.model_dump())
    with connect() as db:
        db.execute("BEGIN IMMEDIATE")
        session = session_record(db,session_id)
        if req.type in ['sensor_fault','sensor_restore'] and req.payload.sensor in ['eo','ir'] and json.loads(session['spec']).get('engine_version') not in ('vyuha-0.4.0','vyuha-0.5.0','vyuha-0.6.0'):raise HTTPException(422,'EO/IR fault controls require a finale scenario')
        old = db.execute("SELECT * FROM instructor_commands WHERE session_id=? AND command_id=?",(session_id,req.command_id)).fetchone()
        if old:
            if old["body"] != body:
                raise HTTPException(409,"Command ID cannot be reused with a different payload")
            return {"command":next(c for c in command_records(db,session_id) if c["seq"]==old["seq"]),"duplicate":True}
        if session["status"] != "active":
            raise HTTPException(409,"Session already completed")
        existing = command_records(db,session_id)
        if len(existing)>=100:
            raise HTTPException(422,"Command limit reached")
        injected = sum(6 if c["type"]=="inject_swarm" else 1 if c["type"]=="inject_contact" else 0 for c in existing)
        added = 6 if req.type=="inject_swarm" else 1 if req.type=="inject_contact" else 0
        if injected+added>64:
            raise HTTPException(422,"Injected contact limit reached")
        seq = len(existing)+1
        db.execute("INSERT INTO instructor_commands(session_id,seq,command_id,issued_at,body) VALUES (?,?,?,?,?)",
                   (session_id,seq,req.command_id,datetime.now(timezone.utc).isoformat(),body))
        return {"command":command_records(db,session_id,seq-1)[0],"duplicate":False}


@app.get("/api/v1/sessions/{session_id}/commands")
def receive_commands(session_id:str, after:int=Query(default=0,ge=0,le=100)):
    with connect() as db:
        session_record(db,session_id)
        return {"commands":command_records(db,session_id,after)}


@app.post("/api/v1/sessions/{session_id}/control-state")
def control_state(session_id:str, req:ControlState):
    with connect() as db:
        db.execute("BEGIN IMMEDIATE")
        session = session_record(db,session_id)
        if req.tick>round(json.loads(session['spec'])['duration']*30):raise HTTPException(422,'Telemetry exceeds frozen scenario duration')
        if session["status"] != "active":
            raise HTTPException(409,"Session already completed")
        if [a.seq for a in req.applied] != list(range(1,len(req.applied)+1)):
            raise HTTPException(409,"Command acknowledgements must be a contiguous prefix")
        existing = applied_commands(db,session_id)
        if len(req.applied)<len(existing):
            raise HTTPException(409,"Command history cannot be rolled back")
        previous_tick, previous_order = -1,-1
        for ack in req.applied:
            row = db.execute("SELECT * FROM instructor_commands WHERE session_id=? AND seq=?",(session_id,ack.seq)).fetchone()
            if not row or ack.tick>req.tick or ack.tick<previous_tick or ack.order<=previous_order:
                raise HTTPException(422,"Invalid command acknowledgement")
            if row["tick"] is not None and (row["tick"]!=ack.tick or row["timeline_order"]!=ack.order):
                raise HTTPException(409,"An applied command is immutable")
            db.execute("UPDATE instructor_commands SET tick=?,timeline_order=? WHERE session_id=? AND seq=?",
                       (ack.tick,ack.order,session_id,ack.seq))
            previous_tick,previous_order = ack.tick,ack.order
        db.execute('UPDATE exercise_assignments SET accepted_at=COALESCE(accepted_at,?) WHERE session_id=?',(datetime.now(timezone.utc).isoformat(),session_id))
        telemetry = req.model_dump(exclude={"applied"})
        db.execute("UPDATE sessions SET last_seen=?,control_state=? WHERE id=?",
                   (datetime.now(timezone.utc).isoformat(),dumps(telemetry),session_id))
        return {"ack":len(req.applied)}


from .units import router as unit_router
app.include_router(unit_router)

from .advanced import router as advanced_router
from . import heatmap
app.include_router(advanced_router)

from .evidence import router as evidence_router
app.include_router(evidence_router)
from .capabilities import router as capability_router
app.include_router(capability_router)
from .learning import router as learning_router
app.include_router(learning_router)
from .learning_reflection import router as learning_reflection_router
app.include_router(learning_reflection_router)
from .learning_investigation import router as learning_investigation_router
app.include_router(learning_investigation_router)
from .learning_investigation import officer_router as investigation_officer_router
app.include_router(investigation_officer_router)
from .controlled_study import router as controlled_study_router
app.include_router(controlled_study_router)
from .assessment_obligations import router as assessment_obligation_router
app.include_router(assessment_obligation_router)
from .curriculum_diagnostic import router as curriculum_diagnostic_router
app.include_router(curriculum_diagnostic_router)
from .portable import router as portable_router
app.include_router(portable_router)
from .recordings import router as recording_router
from .evaluation import router as evaluation_router
from .counterfactual import router as counterfactual_router
from .raid_api import router as raid_router
from .episode_opportunities import router as episode_opportunity_router
from .white_cell import router as white_cell_router
app.include_router(recording_router)
app.include_router(evaluation_router)
app.include_router(counterfactual_router)
app.include_router(raid_router)
app.include_router(episode_opportunity_router)
from .observation_missions import router as observation_mission_router
app.include_router(observation_mission_router)
from .observation_missions_v2 import router as uncertainty_mission_router
app.include_router(uncertainty_mission_router)
from .observation_missions_v3 import router as training_site_mission_router
app.include_router(training_site_mission_router)
from .observation_assessment import router as observation_assessment_router
app.include_router(observation_assessment_router)
from .acquisition import router as acquisition_router
app.include_router(acquisition_router)
app.include_router(white_cell_router)
from .director_v2 import router as director_v2_router
app.include_router(director_v2_router)
from .compliance import router as compliance_router
app.include_router(compliance_router)
from .crew import router as crew_router,CrewSessionBoundary
app.include_router(crew_router)
from .fusion import router as fusion_router
app.include_router(fusion_router)
from .reference_policy import router as reference_router
app.include_router(reference_router)
from .expert_run_api import router as expert_run_router
app.include_router(expert_run_router)
app.add_middleware(CrewSessionBoundary)

from .teaching import router as teaching_router
app.include_router(teaching_router)
from .streams import router as stream_router
app.include_router(stream_router)

DIST = Path(__file__).resolve().parent.parent / "client" / "dist"
if DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}")
    def frontend(path: str):
        if path.startswith("api/"):
            raise HTTPException(404, "API endpoint not found")
        target = (DIST / path).resolve()
        if DIST.resolve() not in target.parents or not target.is_file():
            target = DIST / "index.html"
        return FileResponse(target, headers={"Cache-Control": "no-cache"})
