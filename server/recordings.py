"""Validated bounded observation playback with unscored response practice."""
import json,uuid
from fastapi import APIRouter,HTTPException
from pydantic import Field
from .models import StrictModel,Action
from .observations import Recording,RecordedSource,recording_hash
from .storage import connect,dumps
router=APIRouter(prefix='/api/v1')

@router.post('/recordings',status_code=201)
def import_recording(req:Recording):
 digest=recording_hash(req);rid='rec_'+digest[:24];spec=req.model_dump()
 with connect() as db:db.execute('INSERT OR IGNORE INTO recordings VALUES (?,?)',(rid,dumps(spec)))
 return dict(id=rid,source_type='recorded',import_hash=digest,schema_version=1,recording=spec,scoring='Response practice only. No synthetic impacts, effector outcomes, tactical score or skill updates. Reference classification only where supplied; imported ground truth is unverified.')

@router.get('/recordings')
def recordings():
 with connect() as db:return {'recordings':[dict(id=r['id'],title=json.loads(r['spec'])['title']) for r in db.execute('SELECT * FROM recordings ORDER BY rowid DESC')]}

@router.get('/recordings/{rid}')
def recording(rid:str):
 with connect() as db:r=db.execute('SELECT spec FROM recordings WHERE id=?',(rid,)).fetchone()
 if not r:raise HTTPException(404,'Recording not found')
 req=Recording.model_validate_json(r['spec'])
 return dict(id=rid,source_type='recorded',import_hash=recording_hash(req),schema_version=1,recording=req.model_dump())

class RecordedPractice(StrictModel):
 request_id:str=Field(min_length=8,max_length=80,pattern=r'^[A-Za-z0-9_-]+$')
 trainee_id:str=Field(min_length=1,max_length=24,pattern=r'^[A-Za-z0-9_-]+$')
 actions:list[Action]=Field(max_length=500)

@router.post('/recordings/{rid}/practice')
def practice(rid:str,req:RecordedPractice):
 source=RecordedSource(Recording.model_validate(recording(rid)['recording']));designated=set();classified=set();reviews=[];order=-1;tick=-1
 for a in req.actions:
  if a.tick<tick or (a.order is not None and a.order<=order):raise HTTPException(422,'Recorded decisions must be ordered')
  tick=a.tick;order=a.order if a.order is not None else order+1
  try:sample=next(((t,s) for t,s in source.samples_at(a.tick) if t.track_id==a.track),None)
  except ValueError as e:raise HTTPException(422,str(e)) from e
  if sample is None or not (sample[1].radar or sample[1].thermal):raise HTTPException(422,'Decision has no current recorded observation')
  t,s=sample
  if a.k=='designate':designated.add(a.track)
  elif a.track not in designated:raise HTTPException(422,'Designate before classification or response')
  elif a.k=='classify':classified.add(a.track)
  elif a.track not in classified:raise HTTPException(422,'Classify before response')
  truth=t.ground_truth;correct=(a.kind==truth.kind and a.identity==truth.identity) if truth and a.k=='classify' else None
  reviews.append(dict(action=a.model_dump(exclude_none=True),sample=s.model_dump(),reference=truth.model_dump() if truth and a.k=='classify' else None,classification_correct=correct,consequence='Response recorded; effectiveness and impacts are not modeled for recorded playback.'))
 result=dict(recording_id=rid,source_type='recorded',import_hash=recording_hash(source.recording),reviews=reviews,tactical_score=None,profile_updated=False,note='Unscored recorded response practice. Supplied reference labels are unverified; missing ground truth is unassessable.')
 body=dumps(dict(recording_id=rid,**req.model_dump()))
 with connect() as db:
  db.execute('BEGIN IMMEDIATE');old=db.execute('SELECT * FROM recorded_practice WHERE request_id=?',(req.request_id,)).fetchone()
  if old:
   if old['body']!=body:raise HTTPException(409,'Practice request ID cannot change')
   return json.loads(old['result'])
  db.execute('INSERT INTO recorded_practice VALUES (?,?,?)',(req.request_id,body,dumps(result)))
 return result
