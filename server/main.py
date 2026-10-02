import json
import random
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .engine import ENGINE_VERSION, make_scenario, replay, score
from .models import Action, Complete, CreateSession, EventBatch, Generate
from .storage import connect, dumps, init


@asynccontextmanager
async def lifespan(app):
    init()
    yield


app = FastAPI(title="VYUHA local training API", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"], allow_methods=["GET", "POST"], allow_headers=["Content-Type"])


@app.get("/api/v1/health")
def health():
    return {"status": "ok", "engine_version": ENGINE_VERSION, "storage": "sqlite", "mode": "local-demo"}


def profile(trainee):
    with connect() as db:
        rows = db.execute("SELECT scorecard FROM sessions WHERE trainee=? AND status='completed' ORDER BY created_at", (trainee,)).fetchall()
    skills = {name: {"alpha": 1., "beta": 1.} for name in ["recognition", "response"]}
    for row in rows:
        card = json.loads(row["scorecard"])
        for name, value in card["skills"].items():
            skills[name]["alpha"] += value/100
            skills[name]["beta"] += 1-value/100
    return {"trainee": trainee, "sessions": len(rows), "skills": skills}


@app.get("/api/v1/trainees/{trainee}/profile")
def get_profile(trainee: str):
    return profile(trainee)


@app.post("/api/v1/scenarios/generate")
def generate(req: Generate):
    focus = req.focus or "recognition"
    if req.mode == "adaptive":
        skills = profile(req.trainee)["skills"]
        r = random.Random(req.seed)
        focus = min(skills, key=lambda k: r.betavariate(skills[k]["alpha"], skills[k]["beta"]))
    scenario = make_scenario(req.seed, focus, req.night)
    with connect() as db:
        db.execute("INSERT OR IGNORE INTO scenarios(id,spec) VALUES (?,?)", (scenario["id"], dumps(scenario)))
    return scenario


@app.post("/api/v1/sessions", status_code=201)
def create_session(req: CreateSession):
    session_id = str(uuid.uuid4())
    with connect() as db:
        if not db.execute("SELECT id FROM scenarios WHERE id=?", (req.scenario_id,)).fetchone():
            raise HTTPException(404, "Scenario not found")
        db.execute("INSERT INTO sessions(id,trainee,scenario_id,created_at) VALUES (?,?,?,?)", (session_id, req.trainee, req.scenario_id, datetime.now(timezone.utc).isoformat()))
    return {"id": session_id}


@app.post("/api/v1/sessions/{session_id}/events")
def events(session_id: str, req: EventBatch):
    payload = dumps([e.model_dump(exclude_none=True) for e in req.events])
    with connect() as db:
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
    with connect() as db:
        row = session_record(db, session_id)
        if row["status"] == "completed":
            return json.loads(row["scorecard"])
        log = logged_events(db, session_id)
        try:
            card = score(replay(json.loads(row["spec"]), log, req.end_tick))
        except ValueError as error:
            raise HTTPException(422, str(error)) from error
        db.execute("UPDATE sessions SET status='completed',scorecard=?,end_tick=? WHERE id=?", (dumps(card), req.end_tick, session_id))
    return card


@app.get("/api/v1/sessions/{session_id}/aar")
def aar(session_id: str):
    with connect() as db:
        row = session_record(db, session_id)
        if row["status"] != "completed":
            raise HTTPException(409, "Session not completed")
        return dict(id=row["id"], trainee=row["trainee"], scenario=json.loads(row["spec"]), events=logged_events(db, session_id),
                    endTick=row["end_tick"], scorecard=json.loads(row["scorecard"]), created_at=row["created_at"], verified=True)


@app.get("/api/v1/units/local/dashboard")
def dashboard():
    with connect() as db:
        rows = db.execute("SELECT id FROM sessions WHERE status='completed' ORDER BY created_at DESC LIMIT 100").fetchall()
        return {"sessions": [aar(r["id"]) for r in rows]}


@app.get("/api/v1/contracts")
def contracts():
    return {"Action": Action.model_json_schema(), "engine_version": ENGINE_VERSION}


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
