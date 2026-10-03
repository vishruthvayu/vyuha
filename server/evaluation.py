"""Consent-gated pseudonymous informal evaluation protocol; no efficacy claim."""
import json,uuid
from datetime import datetime,timezone
from fastapi import APIRouter,HTTPException
from pydantic import Field
from .models import StrictModel
from .advanced import RapidStart,start_rapid,rapid_get
from .storage import connect,dumps
router=APIRouter(prefix='/api/v1')
class PilotStart(StrictModel):
 request_id:str=Field(min_length=8,max_length=80,pattern=r'^[A-Za-z0-9_-]+$')
 trainee_id:str=Field(min_length=1,max_length=24,pattern=r'^[A-Za-z0-9_-]+$')
 participant:str=Field(pattern=r'^P[0-9]{2,4}$')
 consent:bool
 drills:int=Field(default=3,ge=3,le=5)
 seed:int=Field(default=62147,ge=0,le=4294967295)

@router.post('/evaluations',status_code=201)
def create(req:PilotStart):
 if not req.consent:raise HTTPException(422,'Participant agreement is required; do not enroll automatically')
 body=dumps(req.model_dump());eid='E_'+uuid.uuid4().hex
 with connect() as db:
  if not db.execute('SELECT 1 FROM trainees WHERE id=?',(req.trainee_id,)).fetchone():raise HTTPException(422,'Join a unit before an evaluation')
  db.execute('BEGIN IMMEDIATE');old=db.execute('SELECT id,body FROM evaluations WHERE request_id=?',(req.request_id,)).fetchone()
  if old:
   if old['body']!=body:raise HTTPException(409,'Evaluation request ID cannot change')
   eid=old['id']
  else:db.execute('INSERT INTO evaluations VALUES (?,?,?,?,?)',(eid,req.request_id,body,datetime.now(timezone.utc).isoformat(),None))
 # Existing Rapid ID's immutable start request recovers safely across a crash.
 start_rapid(RapidStart(request_id=eid+'-pre',trainee_id=req.trainee_id,seed=req.seed,rounds=15))
 return view(eid)

@router.get('/evaluations/{eid}')
def view(eid:str):
 with connect() as db:
  r=db.execute('SELECT * FROM evaluations WHERE id=?',(eid,)).fetchone()
  if not r:raise HTTPException(404,'Evaluation not found')
  req=PilotStart.model_validate_json(r['body'])
  rapid={row['request_id'].split('-')[-1]:json.loads(row['result']) if row['result'] else None for row in db.execute('SELECT * FROM rapid_sessions WHERE request_id IN (?,?)',(eid+'-pre',eid+'-post'))}
  ids={row['request_id'].split('-')[-1]:row['id'] for row in db.execute('SELECT id,request_id FROM rapid_sessions WHERE request_id IN (?,?)',(eid+'-pre',eid+'-post'))}
  pre_row=db.execute('SELECT o.processed_at FROM skill_outcomes o JOIN rapid_sessions rs ON rs.id=o.session_id WHERE rs.request_id=?',(eid+'-pre',)).fetchone()
  # Count only drills created after the pre-test completed and before post-test starts.
  drills=[dict(row) for row in db.execute("SELECT s.id,s.scorecard,st.failures FROM sessions s JOIN director_history h ON h.session_id=s.id LEFT JOIN session_unit_stats st ON st.session_id=s.id WHERE s.trainee=? AND s.status='completed' AND s.created_at>=? AND (? IS NULL OR s.completed_at<=?) ORDER BY s.created_at",(req.trainee_id,pre_row['processed_at'] if pre_row else '9999',r['post_started'],r['post_started']))]
 for d in drills:d['failures']=json.loads(d['failures']) if d['failures'] else {};d['score']=json.loads(d.pop('scorecard'))['score']
 pre,post=rapid.get('pre'),rapid.get('post');delta=None
 if pre and post:delta=dict(accuracy_percentage_points=100*(post['accuracy']-pre['accuracy']),median_response_ms=post['median_response_ms']-pre['median_response_ms'],friendly_false_hostile=post['friendly_false_hostile']-pre['friendly_false_hostile'],bird_confusion=post['bird_confusion']-pre['bird_confusion'])
 return dict(id=eid,trainee_id=req.trainee_id,participant=req.participant,drills_required=req.drills,drills=drills,pre=pre,post=post,session_ids=ids,observed_difference=delta,protocol='15-round pre → 3–5 adaptive drills → balanced, non-identical 15-round post',note='Informal evaluation tooling. No human efficacy or military validation. Differences are descriptive; response times are client-reported active time.')

@router.post('/evaluations/{eid}/post')
def post(eid:str):
 state=view(eid)
 if not state['pre'] or len(state['drills'])<state['drills_required']:raise HTTPException(409,'Complete pre-test and the required adaptive drills before post-test')
 with connect() as db:
  r=db.execute('SELECT body FROM evaluations WHERE id=?',(eid,)).fetchone();req=PilotStart.model_validate_json(r['body'])
  db.execute('UPDATE evaluations SET post_started=COALESCE(post_started,?) WHERE id=?',(datetime.now(timezone.utc).isoformat(),eid))
 start_rapid(RapidStart(request_id=eid+'-post',trainee_id=req.trainee_id,seed=req.seed^0x9E3779B9,rounds=15))
 return view(eid)
