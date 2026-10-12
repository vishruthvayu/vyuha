"""Small trusted-LAN unit registry/analytics. Officer administration authenticated; trainee callsigns are trusted LAN identities."""
import json,uuid
from collections import Counter
from datetime import datetime,timezone,timedelta
from fastapi import APIRouter,HTTPException
from .storage import connect,dumps
from .unit_models import JoinUnit,Presence,GroupLaunch,AcceptAssignment
from .review import SKILLS

router=APIRouter(prefix='/api/v1')
def now():return datetime.now(timezone.utc).isoformat()
def cutoff():return (datetime.now(timezone.utc)-timedelta(seconds=10)).isoformat()
def unit(db,uid):
    row=db.execute('SELECT * FROM units WHERE id=?',(uid,)).fetchone()
    if not row:raise HTTPException(404,'Unit not found')
    return dict(row)
def trainee(db,tid):
    row=db.execute('SELECT * FROM trainees WHERE id=?',(tid,)).fetchone()
    if not row:raise HTTPException(404,'Trainee not found')
    return dict(row)
def identity(row):return dict(trainee_id=row['id'],unit_id=row['unit_id'],callsign=row['callsign'])
def persist_stats(db,sid,review):
    # One failed contact/reason/session, never every repeated erroneous attempt.
    failures=Counter(code for _,code in {(r['track_id'],r['reason_code']) for r in review['decision_reviews'] if r['verdict']=='incorrect'})
    db.execute('INSERT OR IGNORE INTO session_unit_stats VALUES (?,?)',(sid,dumps(dict(failures))))

@router.get('/units')
def list_units():
    with connect() as db:return {'units':[dict(r) for r in db.execute('SELECT * FROM units ORDER BY id')]}

@router.post('/units/join')
def join(req:JoinUnit):
    with connect() as db:
        db.execute('BEGIN IMMEDIATE');unit(db,req.unit_id)
        body=dumps(dict(unit_id=req.unit_id,callsign=req.callsign.lower()))
        if req.request_id:
            existing=db.execute('SELECT * FROM join_requests WHERE id=?',(req.request_id,)).fetchone()
            if existing:
                if existing['body']!=body:raise HTTPException(409,'Join request ID cannot be reused for another callsign')
                return identity(trainee(db,existing['trainee']))
        if req.trainee_id:
            row=trainee(db,req.trainee_id)
            if row['unit_id']!=req.unit_id or row['callsign'].lower()!=req.callsign.lower():raise HTTPException(409,'Saved identity does not match this unit/callsign')
            return identity(row)
        if db.execute('SELECT 1 FROM trainees WHERE unit_id=? AND callsign=? COLLATE NOCASE',(req.unit_id,req.callsign)).fetchone():raise HTTPException(409,'Callsign already registered. Resume the original browser identity or choose another callsign.')
        tid='T_'+uuid.uuid4().hex[:22]
        db.execute('INSERT INTO trainees VALUES (?,?,?,?)',(tid,req.unit_id,req.callsign,now()))
        if req.request_id:db.execute('INSERT INTO join_requests VALUES (?,?,?)',(req.request_id,body,tid))
        return identity(trainee(db,tid))

@router.post('/trainees/{tid}/presence')
def presence(tid:str,req:Presence):
    with connect() as db:
        db.execute('BEGIN IMMEDIATE');trainee(db,tid)
        if req.session_id:
            row=db.execute('SELECT trainee,status FROM sessions WHERE id=?',(req.session_id,)).fetchone()
            if not row or row['trainee']!=tid:raise HTTPException(422,'Session does not belong to this trainee')
            if row['status']=='completed':req.session_id=None
        db.execute('INSERT INTO connected_clients VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET trainee=excluded.trainee,last_seen=excluded.last_seen,session_id=excluded.session_id',(req.client_id,tid,now(),req.session_id))
    return {'connected':True}

@router.get('/trainees/{tid}/sessions')
def trainee_sessions(tid:str):
    from .main import aar
    with connect() as db:
        trainee(db,tid)
        ids=[r['id'] for r in db.execute("SELECT id FROM sessions WHERE trainee=? AND status='completed' ORDER BY created_at DESC LIMIT 100",(tid,))]
    return {'sessions':[aar(sid,include_review=False) for sid in ids]}

@router.get('/units/{uid}/trainees')
def roster(uid:str):
    with connect() as db:
        unit(db,uid)
        return {'trainees':[{**identity(r),'connected':bool(db.execute('SELECT 1 FROM connected_clients WHERE trainee=? AND last_seen>?',(r['id'],cutoff())).fetchone()),'busy':bool(db.execute("SELECT 1 FROM connected_clients c JOIN sessions s ON s.id=c.session_id WHERE c.trainee=? AND c.last_seen>? AND s.status='active'",(r['id'],cutoff())).fetchone())} for r in db.execute('SELECT * FROM trainees WHERE unit_id=? ORDER BY callsign',(uid,)).fetchall()]}


def unit_dashboard(uid):
    from .main import profile,aar,review_session,instructor_session
    with connect() as db:
        u=unit(db,uid);members=[dict(r) for r in db.execute('SELECT * FROM trainees WHERE unit_id=? ORDER BY callsign',(uid,))]
        rows=db.execute("SELECT s.*,sc.spec FROM sessions s JOIN scenarios sc ON sc.id=s.scenario_id WHERE s.unit_id=? AND s.status='completed' ORDER BY s.created_at DESC LIMIT 100",(uid,)).fetchall()
        missing=[r for r in rows if not db.execute('SELECT 1 FROM session_unit_stats WHERE session_id=?',(r['id'],)).fetchone()]
    # Legacy backfill reconstructs outside the write transaction. New completions already store these counts.
    excluded=[]
    for r in missing:
        try:
            with connect() as db:review=review_session(db,r)
            with connect() as db:persist_stats(db,r['id'],review)
        except (ValueError,KeyError,TypeError,HTTPException):excluded.append(r['id'])
    people=[]
    for m in members:
        p=profile(m['id'])
        with connect() as db:
            latest=db.execute('SELECT decision FROM director_history WHERE trainee=? ORDER BY rowid DESC LIMIT 1',(m['id'],)).fetchone()
        people.append({**identity(m),'profile':p,'latest_adaptive_focus':json.loads(latest['decision'])['focus_skill'] if latest else None})
    means={s:sum(p['profile']['skills'][s]['mean'] for p in people)/len(people) if people else None for s in SKILLS}
    weakest=min(SKILLS,key=lambda s:means[s]) if people else None
    with connect() as db:
        active=[instructor_session(db,r['id']) for r in db.execute("SELECT id FROM sessions WHERE unit_id=? AND status='active' ORDER BY created_at DESC",(uid,))]
        live=[s for s in active if s['status'] in ['ACTIVE','PAUSED']]
        counts=Counter()
        for r in rows:
            stat=db.execute('SELECT failures FROM session_unit_stats WHERE session_id=?',(r['id'],)).fetchone()
            if stat:counts.update(json.loads(stat['failures']))
        completed=db.execute("SELECT COUNT(*) FROM sessions WHERE unit_id=? AND status='completed'",(uid,)).fetchone()[0]
        today=db.execute("SELECT COUNT(*) FROM sessions WHERE unit_id=? AND status='completed' AND substr(COALESCE(completed_at,created_at),1,10)=?",(uid,now()[:10])).fetchone()[0]
    return dict(unit=u,trainee_count=len(people),session_count=completed,active_trainees=len({s['trainee'] for s in live}),completed_today=today,day_basis='UTC',skill_means=means,weakest_skill=weakest,
                affected_trainees=sum(p['profile']['skills'][weakest]['mean']<.7 for p in people) if weakest else 0,affected_threshold=.7,trainees=people,
                failures=dict(sorted(counts.items(),key=lambda kv:(-kv[1],kv[0]))),failure_scope='latest 100 completed sessions; deduplicated contact/reason per session',excluded_reviews=excluded,
                sessions=[aar(r['id'],include_review=False) for r in rows],active_sessions=active)

@router.get('/units/{uid}/status')
def status(uid:str):
    with connect() as db:
        unit(db,uid)
        healthy=db.execute('PRAGMA quick_check').fetchone()[0]=='ok'
        connected=db.execute('SELECT COUNT(DISTINCT c.id) FROM connected_clients c JOIN trainees t ON t.id=c.trainee WHERE t.unit_id=? AND c.last_seen>?',(uid,cutoff())).fetchone()[0]
        active=db.execute("SELECT COUNT(*) FROM sessions WHERE unit_id=? AND status='active' AND last_seen>?",(uid,(datetime.now(timezone.utc)-timedelta(seconds=6)).isoformat())).fetchone()[0]
        pending=db.execute('SELECT COUNT(*) FROM exercise_assignments a JOIN exercise_groups g ON g.id=a.group_id WHERE g.unit_id=? AND a.accepted_at IS NULL',(uid,)).fetchone()[0]
    return dict(status='healthy' if healthy else 'database error',database='ok' if healthy else 'error',active_sessions=active,connected_clients=connected,pending_assignments=pending,
                pending_client_sync=None,sync_note='Client-local event queues cannot be measured while disconnected.',offline_assets='bundled; cached reload requires a browser-trusted secure origin',security='Expiring officer authentication protects commands and administration; trainee identity/session URLs still require a trusted LAN; use browser-trusted HTTPS')

@router.post('/units/{uid}/exercises',status_code=201)
def launch_group(uid:str,req:GroupLaunch):
    from .engine import make_scenario
    with connect() as db:
        db.execute('BEGIN IMMEDIATE');unit(db,uid);body=dumps(req.model_dump(exclude_none=True));old=db.execute('SELECT * FROM exercise_groups WHERE request_id=?',(req.request_id,)).fetchone()
        if old:
            if old['body']!=body or old['unit_id']!=uid:raise HTTPException(409,'Launch request ID cannot be reused')
            gid=old['id']
        else:
            if len(set(req.trainees))!=len(req.trainees):raise HTTPException(422,'Trainees must be distinct')
            for tid in req.trainees:
                m=trainee(db,tid)
                if m['unit_id']!=uid:raise HTTPException(422,'Trainee belongs to another unit')
                if not db.execute('SELECT 1 FROM connected_clients WHERE trainee=? AND last_seen>?',(tid,cutoff())).fetchone():raise HTTPException(409,'Selected trainee is disconnected')
                if db.execute("SELECT 1 FROM connected_clients c JOIN sessions s ON s.id=c.session_id WHERE c.trainee=? AND c.last_seen>? AND s.status='active'",(tid,cutoff())).fetchone():raise HTTPException(409,'Selected trainee is already training')
                if db.execute('SELECT 1 FROM exercise_assignments WHERE trainee=? AND accepted_at IS NULL',(tid,)).fetchone():raise HTTPException(409,'Selected trainee has an unstarted assignment')
            gid='G_'+uuid.uuid4().hex
            if req.scenario_id:
                row=db.execute('SELECT sc.spec FROM scenarios sc JOIN scenario_library l ON l.id=sc.id WHERE sc.id=?',(req.scenario_id,)).fetchone()
                if not row:raise HTTPException(422,'Saved library scenario not found')
                spec=json.loads(row['spec'])
            else:spec=make_scenario(req.seed,'recognition',req.night)
            db.execute('INSERT OR IGNORE INTO scenarios VALUES (?,?)',(spec['id'],dumps(spec)))
            db.execute('INSERT INTO exercise_groups VALUES (?,?,?,?,?,?)',(gid,uid,req.request_id,body,spec['id'],now()))
            for tid in req.trainees:
                sid=str(uuid.uuid4());db.execute('INSERT INTO sessions(id,trainee,scenario_id,created_at,unit_id,exercise_group_id) VALUES (?,?,?,?,?,?)',(sid,tid,spec['id'],now(),uid,gid))
                db.execute('INSERT INTO exercise_assignments VALUES (?,?,?,NULL)',(sid,gid,tid))
    return group_results(uid,gid)

@router.get('/trainees/{tid}/assignment')
def assignment(tid:str):
    with connect() as db:
        trainee(db,tid)
        r=db.execute('SELECT a.*,sc.spec FROM exercise_assignments a JOIN sessions s ON s.id=a.session_id JOIN scenarios sc ON sc.id=s.scenario_id WHERE a.trainee=? AND a.accepted_at IS NULL ORDER BY s.created_at LIMIT 1',(tid,)).fetchone()
    return {'assignment':dict(session_id=r['session_id'],exercise_group_id=r['group_id'],scenario=json.loads(r['spec'])) if r else None}

@router.post('/assignments/{sid}/accept')
def accept(sid:str,req:AcceptAssignment):
    with connect() as db:
        db.execute('BEGIN IMMEDIATE');r=db.execute('SELECT * FROM exercise_assignments WHERE session_id=?',(sid,)).fetchone()
        if not r or r['trainee']!=req.trainee_id:raise HTTPException(422,'Assignment does not belong to this trainee')
        db.execute('UPDATE exercise_assignments SET accepted_at=COALESCE(accepted_at,?) WHERE session_id=?',(now(),sid))
    return {'accepted':True}

@router.get('/units/{uid}/exercises')
def groups(uid:str):
    with connect() as db:
        unit(db,uid);ids=[r['id'] for r in db.execute('SELECT id FROM exercise_groups WHERE unit_id=? ORDER BY created_at DESC LIMIT 20',(uid,))]
    return {'groups':[group_results(uid,gid) for gid in ids]}

@router.get('/units/{uid}/exercises/{gid}')
def group_results(uid:str,gid:str):
    with connect() as db:
        g=db.execute('SELECT * FROM exercise_groups WHERE id=? AND unit_id=?',(gid,uid)).fetchone()
        if not g:raise HTTPException(404,'Exercise group not found')
        rows=db.execute('SELECT s.*,t.callsign FROM sessions s JOIN trainees t ON t.id=s.trainee WHERE exercise_group_id=? ORDER BY t.callsign',(gid,)).fetchall()
        result=[]
        for r in rows:
            card=json.loads(r['scorecard']) if r['scorecard'] else None
            hostile=[x for x in card['rows'] if x['identity']=='hostile'] if card else []
            averages={k:round(sum(x[k] for x in hostile)/len(hostile),2) if hostile else None for k in ['detect','classify','engage']}
            if card and card.get('prioritisation'):averages['prioritise']=card['prioritisation']['points']
            result.append(dict(session_id=r['id'],trainee_id=r['trainee'],callsign=r['callsign'],status=r['status'],score=card['score'] if card else None,node_averages=averages))
        return dict(exercise_group_id=gid,scenario_id=g['scenario_id'],created_at=g['created_at'],results=result)
