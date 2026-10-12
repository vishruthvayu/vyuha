"""One authoritative logical exercise with hashed role capabilities.

The server advances a bounded clock when crew/instructor clients poll. A stopped
server resumes paused at its last durable checkpoint; outage time is never added.
This is simulated crew coordination, not individual competence certification.
"""
import copy
import hashlib
import json
import math
import re
import secrets
import threading
import time
import uuid
from collections import OrderedDict
from datetime import datetime,timezone
from contextlib import contextmanager
from typing import Literal
from fastapi import APIRouter,HTTPException,Request
from pydantic import Field,model_validator
from starlette.responses import JSONResponse
from . import storage,auth
from .models import StrictModel,InstructorCommand,Action
from .engine import HZ,replay
from .engine_v2 import observed_position
from .review import build_review

router=APIRouter(prefix='/api/v1/crews',tags=['Shared Crew'])
_LOCK=threading.RLock()
_CACHE=OrderedDict()
CACHE_LIMIT=64

def ensure_schema(db):
    db.executescript('''
      CREATE TABLE IF NOT EXISTS crews(id TEXT PRIMARY KEY,session_id TEXT UNIQUE NOT NULL,name TEXT NOT NULL,tick INTEGER NOT NULL DEFAULT 0,next_order INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS crew_members(crew_id TEXT NOT NULL,id TEXT PRIMARY KEY,callsign TEXT NOT NULL,role TEXT NOT NULL,token_hash TEXT UNIQUE NOT NULL);
      CREATE TABLE IF NOT EXISTS crew_receipts(crew_id TEXT NOT NULL,request_id TEXT NOT NULL,body TEXT NOT NULL,receipt TEXT NOT NULL,PRIMARY KEY(crew_id,request_id));
      CREATE TABLE IF NOT EXISTS crew_attribution(session_id TEXT NOT NULL,timeline_order INTEGER NOT NULL,member_id TEXT NOT NULL,role TEXT NOT NULL,PRIMARY KEY(session_id,timeline_order));
    ''')

def is_shared_session(db,sid):
    if db.execute('SELECT 1 FROM crews WHERE session_id=?',(sid,)).fetchone():return True
    archived=db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='crew_archive'").fetchone()
    return bool(archived and db.execute('SELECT 1 FROM crew_archive WHERE session_id=?',(sid,)).fetchone())

def is_shared_owner(db,trainee):
    return any(is_shared_session(db,row['id']) for row in db.execute('SELECT id FROM sessions WHERE trainee=?',(trainee,)))

class Member(StrictModel):
    callsign:str=Field(min_length=1,max_length=24,pattern=r'^[A-Za-z0-9_-]+$')
    role:Literal['spotter','responder']
class CreateCrew(StrictModel):
    name:str=Field(min_length=1,max_length=80)
    scenario_id:str=Field(min_length=1,max_length=100)
    members:list[Member]=Field(min_length=2,max_length=8)
    @model_validator(mode='after')
    def distinct(self):
        if set(m.role for m in self.members)!={'spotter','responder'} or len({m.callsign.lower() for m in self.members})!=len(self.members):
            raise ValueError('Provide distinct callsigns and both crew roles')
        return self
class CrewAction(StrictModel):
    request_id:str=Field(min_length=1,max_length=80,pattern=r'^[A-Za-z0-9_-]+$')
    k:Literal['designate','classify','engage']
    track:str=Field(pattern=r'^T[1-9][0-9]{0,2}$')
    kind:Literal['bird','quad','fixed_wing','fiber_fpv']|None=None
    identity:Literal['hostile','friendly','neutral']|None=None
    effector:Literal['hold','rf_jam','kinetic']|None=None
    @model_validator(mode='after')
    def valid_action(self):
        Action(tick=0,order=0,**self.model_dump(exclude={'request_id'},exclude_none=True))
        return self


@contextmanager
def transaction(cid):
    key=(str(storage.DB_PATH.resolve()),cid)
    with _LOCK:
        previous=copy.deepcopy(_CACHE.get(key))
        try:
            with storage.connect() as db:
                db.execute('BEGIN IMMEDIATE')
                yield db
        except BaseException:
            # Include context-manager COMMIT failures, not only body failures.
            if previous is None:_CACHE.pop(key,None)
            else:_CACHE[key]=previous
            raise


def clock():return time.monotonic()

def now():return datetime.now(timezone.utc).isoformat()
def member(db,cid,request):
    token=request.headers.get('x-vyuha-crew-token','')
    row=db.execute('SELECT * FROM crew_members WHERE crew_id=? AND token_hash=?',(cid,hashlib.sha256(token.encode()).hexdigest())).fetchone() if token else None
    if row is None:raise HTTPException(401,'A valid crew role code is required')
    return row

def crew(db,cid):
    row=db.execute('SELECT c.*,s.status,sc.spec FROM crews c JOIN sessions s ON s.id=c.session_id JOIN scenarios sc ON sc.id=s.scenario_id WHERE c.id=?',(cid,)).fetchone()
    if row is None:raise HTTPException(404,'Crew not found')
    return row

def runtime(db,row):
    key=(str(storage.DB_PATH.resolve()),row['id'])
    if key not in _CACHE:
        from .main import logged_events,applied_commands
        sim=replay(json.loads(row['spec']),logged_events(db,row['session_id']),row['tick'],applied_commands(db,row['session_id']))
        # Cache eviction/process restart pauses; no invented elapsed-time catch-up.
        sim.paused=True
        _CACHE[key]=dict(sim=sim,anchor=clock(),order=row['next_order'],note='Recovered at durable checkpoint; instructor must resume.')
        while len(_CACHE)>CACHE_LIMIT:_CACHE.popitem(last=False)
    _CACHE.move_to_end(key)
    rt=_CACHE[key];sim=rt['sim'];stamp=clock()
    elapsed=max(0,stamp-rt['anchor'])
    if not sim.paused and row['status']=='active':
        steps=min(30,math.floor(elapsed*HZ))
        if elapsed>1:rt['note']='Server polling stalled; catch-up capped at one logical second. Exercise time may lag wall time.'
        for _ in range(steps):sim.step()
        rt['anchor']=stamp if elapsed>1 else rt['anchor']+steps/HZ
    else:rt['anchor']=stamp
    # The same queue used by the officer console is applied once by the server.
    pending=db.execute('SELECT * FROM instructor_commands WHERE session_id=? AND tick IS NULL ORDER BY seq',(row['session_id'],)).fetchall()
    for entry in pending:
        if sim.tick>=sim.scenario['duration']*HZ:break
        c=dict(json.loads(entry['body']),seq=entry['seq'],tick=sim.tick,order=rt['order'],issued_at=entry['issued_at'],session_id=row['session_id'])
        if not sim.control(c):raise HTTPException(409,'Crew command history cannot be applied')
        db.execute('UPDATE instructor_commands SET tick=?,timeline_order=? WHERE session_id=? AND seq=?',(sim.tick,rt['order'],row['session_id'],entry['seq']))
        rt['order']+=1;rt['anchor']=stamp
    checkpoint(db,row,rt)
    return rt

def checkpoint(db,row,rt):
    sim=rt['sim']
    db.execute('UPDATE crews SET tick=?,next_order=? WHERE id=?',(sim.tick,rt['order'],row['id']))
    telemetry=dict(tick=sim.tick,paused=sim.paused,active_contacts=sum(t['active'] for t in sim.tracks),radar_status=sim.radar_status,rf_available=sim.rf_available,night=sim.night)
    db.execute('UPDATE sessions SET control_state=?,last_seen=? WHERE id=?',(storage.dumps(telemetry),now(),row['session_id']))

def picture(db,row,rt,actor):
    sim=rt['sim'];observed=[]
    for t in sim.tracks:
        p=observed_position(t) if t['active'] else None
        if p:
            observed.append(dict(id=t['id'],position=p,observation=copy.deepcopy(t['observation']),designated=t['designated'],classification=t['classification'],declared=t['declared']))
    roster=[dict(id=m['id'],callsign=m['callsign'],role=m['role']) for m in db.execute('SELECT * FROM crew_members WHERE crew_id=? ORDER BY id',(row['id'],))]
    attribution=[dict(r) for r in db.execute('SELECT a.timeline_order,a.member_id,a.role,m.callsign FROM crew_attribution a JOIN crew_members m ON m.id=a.member_id WHERE a.session_id=? ORDER BY a.timeline_order',(row['session_id'],))]
    card=db.execute('SELECT scorecard FROM sessions WHERE id=?',(row['session_id'],)).fetchone()['scorecard']
    return dict(id=row['id'],name=row['name'],session_id=row['session_id'],role=actor['role'],member_id=actor['id'],tick=sim.tick,duration=sim.scenario['duration'],paused=sim.paused,done=sim.tick>=sim.scenario['duration']*HZ,status=row['status'],contacts=observed,roster=roster,attribution=attribution,scorecard=json.loads(card) if card else None,clock_note=rt['note'],note='Single server-owned simulation. Role codes are LAN capabilities; use trusted HTTPS. Shared score is not copied into individual skill profiles.')

@router.post('',status_code=201)
def create(req:CreateCrew):
    cid='crew_'+uuid.uuid4().hex[:20];sid=str(uuid.uuid4());tid='CREW_'+uuid.uuid4().hex[:18]
    with transaction(cid) as db:
        spec=db.execute('SELECT spec FROM scenarios WHERE id=?',(req.scenario_id,)).fetchone()
        if not spec:raise HTTPException(404,'Scenario not found')
        scenario=json.loads(spec['spec'])
        if scenario.get('engine_version')!='vyuha-0.4.0' or scenario.get('director_decision'):raise HTTPException(422,'Crew Mode needs a shared v0.4 library raid, not an individual Director exercise')
        db.execute("INSERT INTO trainees VALUES (?,'local',?,?)",(tid,tid,now()))
        db.execute("INSERT INTO sessions(id,trainee,scenario_id,created_at,unit_id) VALUES (?,?,?,?,'local')",(sid,tid,req.scenario_id,now()))
        db.execute('INSERT INTO crews(id,session_id,name) VALUES (?,?,?)',(cid,sid,req.name))
        codes=[]
        for m in req.members:
            code=secrets.token_urlsafe(32);mid='M_'+uuid.uuid4().hex[:16]
            db.execute('INSERT INTO crew_members VALUES (?,?,?,?,?)',(cid,mid,m.callsign,m.role,hashlib.sha256(code.encode()).hexdigest()))
            codes.append(dict(member_id=mid,callsign=m.callsign,role=m.role,code=code))
    return dict(id=cid,session_id=sid,members=codes,note='Save these role codes; only hashes are stored. Share each code with its assigned crew member.')

@router.get('/catalogue')
def catalogue():
    with storage.connect() as db:
        items=[]
        for row in db.execute('SELECT sc.id,sc.spec FROM scenarios sc JOIN scenario_library lib ON lib.id=sc.id ORDER BY lib.created_at DESC'):
            spec=json.loads(row['spec'])
            if spec.get('engine_version')=='vyuha-0.4.0' and not spec.get('director_decision'):
                items.append(dict(id=row['id'],title=spec['title'],engine_version=spec['engine_version']))
    return dict(scenarios=items)

@router.get('/{cid}/state')
def state(cid:str,request:Request):
    with transaction(cid) as db:
        row=crew(db,cid);actor=member(db,cid,request)
        return picture(db,row,runtime(db,row),actor)

@router.post('/{cid}/actions')
def action(cid:str,req:CrewAction,request:Request):
    with transaction(cid) as db:
        row=crew(db,cid);actor=member(db,cid,request)
        body=storage.dumps(dict(member_id=actor['id'],**req.model_dump()))
        existing=db.execute('SELECT * FROM crew_receipts WHERE crew_id=? AND request_id=?',(cid,req.request_id)).fetchone()
        if existing:
            if existing['body']!=body:raise HTTPException(409,'Crew request ID cannot change owner or action')
            return json.loads(existing['receipt'])
        if row['status']!='active':raise HTTPException(409,'Crew exercise completed')
        count=db.execute('SELECT COUNT(*) FROM crew_attribution WHERE session_id=?',(row['session_id'],)).fetchone()[0]
        if count>=5000:raise HTTPException(422,'Crew accepted-action limit reached; complete this exercise')
        if (actor['role']=='spotter')!=(req.k=='designate'):raise HTTPException(403,'This decision belongs to the other crew role')
        rt=runtime(db,row);sim=rt['sim']
        if sim.paused:raise HTTPException(409,'Instructor must resume the crew exercise')
        a=Action(**dict(tick=sim.tick,order=rt['order'],**req.model_dump(exclude={'request_id'},exclude_none=True))).model_dump(exclude_none=True)
        if not sim.act(a):raise HTTPException(422,'Action is impossible in the current shared state')
        seq=db.execute('SELECT COALESCE(MAX(seq),-1)+1 FROM chunks WHERE session_id=?',(row['session_id'],)).fetchone()[0]
        db.execute('INSERT INTO chunks VALUES (?,?,?)',(row['session_id'],seq,storage.dumps([a])))
        db.execute('INSERT INTO crew_attribution VALUES (?,?,?,?)',(row['session_id'],rt['order'],actor['id'],actor['role']))
        rt['order']+=1;checkpoint(db,row,rt)
        receipt=dict(accepted=True,action=a,member_id=actor['id'],role=actor['role'])
        db.execute('INSERT INTO crew_receipts VALUES (?,?,?,?)',(cid,req.request_id,body,storage.dumps(receipt)))
        return receipt

@router.post('/{cid}/control')
def control(cid:str,req:InstructorCommand):
    # Reuse the original immutable command-ID/sequence queue and let the authority apply it.
    from .main import issue_command
    with storage.connect() as db:row=crew(db,cid)
    result=issue_command(row['session_id'],req)
    with transaction(cid) as db:
        runtime(db,crew(db,cid))
    return result

@router.post('/{cid}/complete')
def complete(cid:str):
    from .main import logged_events,applied_commands
    from .units import persist_stats
    with transaction(cid) as db:
        row=crew(db,cid)
        if row['status']=='completed':return json.loads(db.execute('SELECT scorecard FROM sessions WHERE id=?',(row['session_id'],)).fetchone()['scorecard'])
        rt=runtime(db,row);sim=rt['sim'];observed=sim.tick
        review,card=build_review(sim.scenario,logged_events(db,row['session_id']),applied_commands(db,row['session_id']),row['session_id'],observed,'completion',sim.scenario['duration']*HZ)
        db.execute("UPDATE sessions SET status='completed',scorecard=?,end_tick=?,execution_tick=?,completed_at=? WHERE id=?",(storage.dumps(card),sim.scenario['duration']*HZ,observed,now(),row['session_id']))
        sim.paused=True;persist_stats(db,row['session_id'],review)
        return card

class CrewSessionBoundary:
    def __init__(self,app):self.app=app
    async def __call__(self,scope,receive,send):
        if scope['type']=='http':
            match=re.fullmatch(r'/api/v1/sessions/([^/]+)/(events|complete|control-state|commands|aar|what-if|fusion-exposures|fusion-review|reference-policy)',scope['path'])
            if match:
                with storage.connect() as db:
                    found=db.execute('SELECT id FROM crews WHERE session_id=?',(match[1],)).fetchone()
                    archived=db.execute('SELECT 1 FROM crew_archive WHERE session_id=?',(match[1],)).fetchone()
                    if archived:
                        headers={k.decode().lower():v.decode() for k,v in scope.get('headers',[])}
                        if not auth.valid(auth.bearer(headers)):
                            return await JSONResponse({'detail':'Officer sign-in required for archived shared result'},status_code=401)(scope,receive,send)
                        if match[2] in ['events','complete','control-state']:
                            return await JSONResponse({'detail':'Archived shared results have no runtime input permissions'},status_code=403)(scope,receive,send)
                    if found:
                        headers={k.decode().lower():v.decode() for k,v in scope.get('headers',[])}
                        if match[2] in ['events','complete','control-state']:
                            return await JSONResponse({'detail':'Crew inputs must use the server-owned role endpoints'},status_code=403)(scope,receive,send)
                        if not auth.valid(auth.bearer(headers)):
                            token=headers.get('x-vyuha-crew-token','')
                            accepted=db.execute('SELECT 1 FROM crew_members WHERE crew_id=? AND token_hash=?',(found['id'],hashlib.sha256(token.encode()).hexdigest())).fetchone() if token else None
                            if not accepted:return await JSONResponse({'detail':'Crew membership or officer sign-in required'},status_code=401)(scope,receive,send)
        return await self.app(scope,receive,send)
