"""Pseudonymous HMAC transfer, validated reconstruction and atomic deduplicated import.

HMAC detects modifications by parties without the shared key. It is not identity,
non-repudiation, trusted telemetry, or proof that a donor's training data is authentic.
"""
import copy,hashlib,hmac,json,os,re,math
from pathlib import Path
from typing import Literal
from fastapi import APIRouter,HTTPException
from pydantic import Field,model_validator
from .models import StrictModel,Action
from .engine import make_scenario
from .review import build_review
from .director import persist_skill_results,session_outcomes
from .storage import connect,dumps
from .observations import Recording
router=APIRouter(prefix='/api/v1')

class SnapshotTrack(StrictModel):
 id:str=Field(pattern=r'^T[1-9][0-9]{0,2}$')
 kind:Literal['bird','quad','fixed_wing','fiber_fpv']
 identity:Literal['hostile','friendly','neutral']
 rf:bool
 spawn:int=Field(ge=0,le=2250)
 bearing:float=Field(ge=-360,le=720,allow_inf_nan=False)
 distance:float=Field(ge=0,le=2000,allow_inf_nan=False)
 speed:float=Field(gt=0,le=50,allow_inf_nan=False)
 altitude:float=Field(ge=0,le=500,allow_inf_nan=False)
 radar_range:float|None=Field(default=None,gt=0,le=2000,allow_inf_nan=False)
 thermal_range:float|None=Field(default=None,gt=0,le=2000,allow_inf_nan=False)

class Snapshot(StrictModel):
 version:Literal[1]
 id:str=Field(min_length=1,max_length=100,pattern=r'^[A-Za-z0-9_-]+$')
 seed:int=Field(ge=0,le=4294967295)
 title:str=Field(min_length=1,max_length=100)
 duration:Literal[75]
 night:bool
 fog:float=Field(ge=0,le=1,allow_inf_nan=False)
 jamStart:int=Field(ge=0,le=2250)
 jamEnd:int=Field(ge=0,le=2250)
 focus:str=Field(max_length=40)
 tracks:list[SnapshotTrack]=Field(min_length=1,max_length=200)
 director_decision:dict|None=None
 doctrine:dict|None=None
 red_force:dict|None=None
 prioritisation_version:Literal[1]|None=None
 terrain:Literal['urban','rural']|None=None
 terrain_id:Literal['urban_outpost','rural_forward_base']|None=None
 terrain_version:Literal[1]|None=None
 authoring:dict|None=None
 difficulty_label:Literal['foundational','standard','challenging']|None=None
 radarFailureStart:int|None=Field(default=None,ge=0,le=2250)
 radarFailureEnd:int|None=Field(default=None,ge=0,le=2250)
 rfFailureStart:int|None=Field(default=None,ge=0,le=2250)
 rfFailureEnd:int|None=Field(default=None,ge=0,le=2250)
 @model_validator(mode='after')
 def unique(self):
  if len({t.id for t in self.tracks})!=len(self.tracks):raise ValueError('Duplicate scenario tracks')
  if self.prioritisation_version and not self.doctrine:raise ValueError('Advanced score requires doctrine snapshot')
  if self.doctrine:
   p=self.doctrine
   if p.get('version')!=1 or p.get('id') not in ['army-forward-post','capf-border-post','critical-infrastructure']:raise ValueError('Unsupported pack version')
   rules=p.get('rules',{})
   for k in ['rf_range','kinetic_range']:
    v=rules.get(k)
    if not isinstance(v,(int,float)) or isinstance(v,bool) or not 1<=v<=2000:raise ValueError('Invalid pack effector range')
   if not rules.get('effectors') or not set(rules['effectors'])<={'hold','rf_jam','kinetic'}:raise ValueError('Unsupported effectors')
   zone=rules.get('restricted',{})
   if type(zone.get('enabled')) is not bool or any(type(zone.get(k)) not in [int,float] or abs(zone[k])>2000 for k in ['x_lt','z_gt']):raise ValueError('Invalid restricted sector')
   weights=rules.get('risk_weights',{})
   if not weights or not set(weights)<={'bird','quad','fixed_wing','fiber_fpv'} or any(type(v) not in [int,float] or not 0<=v<=10 for v in weights.values()):raise ValueError('Invalid risk weights')
   if type(rules.get('asset_risk')) not in [int,float] or not 0<rules['asset_risk']<=10:raise ValueError('Invalid asset risk')
   if rules.get('distance_precision',9)!=9:raise ValueError('Unsupported distance precision')
   if p.get('rubric')!=dict(detect=25,classify=25,prioritise=15,engage=35):raise ValueError('Unsupported rubric')
  if self.director_decision:
   from .director_models import DirectorDecision
   DirectorDecision.model_validate(self.director_decision)
  return self

class UnitRef(StrictModel):
 id:str=Field(pattern=r'^U_[a-f0-9]{20}$')
 name:str=Field(min_length=1,max_length=80)

class TacticalEntry(StrictModel):
 id:str=Field(min_length=8,max_length=64,pattern=r'^[A-Za-z0-9_-]+$')
 trainee:str=Field(pattern=r'^P_[a-f0-9]{20}$')
 created_at:str=Field(max_length=40)
 processed_at:str=Field(max_length=40)
 scenario:dict
 events:list[Action]=Field(max_length=5000)
 commands:list[dict]=Field(max_length=100)
 execution_tick:int=Field(ge=0,le=2250)
 end_tick:Literal[2250]
 scorecard:dict
 outcomes:dict

class RapidEntry(StrictModel):
 id:str=Field(pattern=r'^R_[a-f0-9]{32}$')
 trainee:str=Field(pattern=r'^P_[a-f0-9]{20}$')
 seed:int=Field(ge=0,le=4294967295)
 created_at:str=Field(max_length=40)
 processed_at:str=Field(max_length=40)
 answers:list[dict]=Field(min_length=10,max_length=20)
 result:dict

class Payload(StrictModel):
 schema_version:Literal[1]
 engine_versions:list[Literal['vyuha-0.1.0','vyuha-0.2.0','vyuha-0.3.0']]=Field(max_length=3)
 unit:UnitRef
 sessions:list[TacticalEntry]=Field(max_length=200)
 rapid:list[RapidEntry]=Field(max_length=100)
 profiles:dict
 recordings:list[dict]=Field(max_length=20)
 note:Literal['Pseudonymous transfer. HMAC integrity is not identity or training authenticity.']

class Envelope(StrictModel):
 algorithm:Literal['HMAC-SHA256']
 payload:dict
 hmac:str=Field(pattern=r'^[a-f0-9]{64}$')

def key():
 value=os.environ.get('VYUHA_BUNDLE_SECRET')
 path=os.environ.get('VYUHA_BUNDLE_KEYFILE')
 try:secret=value.encode() if value else Path(path).read_bytes() if path else b''
 except OSError:raise HTTPException(503,'Configured bundle key file is unavailable')
 if len(secret)<32:raise HTTPException(503,'Configure a local shared bundle key of at least 32 bytes; see scripts/bundle-key.py. Never commit or include it in bundles.')
 return secret

def digest(payload,secret):return hmac.new(secret,dumps(payload).encode(),hashlib.sha256).hexdigest()
def sign(payload,secret):return dict(algorithm='HMAC-SHA256',payload=payload,hmac=digest(payload,secret))
def pseudonym(value,secret,prefix):
 # Imported anonymous IDs stay stable when forwarded; fresh installations cannot
 # accidentally pool their default unit or local-demo trainee identifiers.
 if re.fullmatch(re.escape(prefix)+r'[a-f0-9]{20}',value):return value
 with connect() as db:origin=db.execute('SELECT nonce FROM transfer_origin WHERE singleton=1').fetchone()['nonce']
 return prefix+hmac.new(secret,(origin+':'+value).encode(),hashlib.sha256).hexdigest()[:20]

def export_scenario(spec,secret):
 s=copy.deepcopy(spec)
 if s.get('director_decision'):
  d=s['director_decision'];tid=d['trainee_id']
  if not re.fullmatch(r'P_[a-f0-9]{20}',tid):d['trainee_id']=pseudonym(tid,secret,'P_')
 if s.get('authoring'):
  s['authoring']['created_by']='LOCAL-INSTRUCTOR'
  s['authoring']['request']['created_by']='LOCAL-INSTRUCTOR'
 return s

@router.post('/units/{uid}/bundle/export')
def export(uid:str):
 secret=key()
 from .main import profile,aar
 with connect() as db:
  u=db.execute('SELECT * FROM units WHERE id=?',(uid,)).fetchone()
  if not u:raise HTTPException(404,'Unit not found')
  trainees=[r['id'] for r in db.execute('SELECT id FROM trainees WHERE unit_id=?',(uid,))]
 for tid in trainees:profile(tid)
 entries=[];rapids=[];profiles={};versions=set()
 with connect() as db:
  rows=db.execute("SELECT * FROM sessions WHERE unit_id=? AND status='completed' ORDER BY created_at,id",(uid,)).fetchall()
  rr=db.execute('SELECT r.* FROM rapid_sessions r JOIN trainees t ON t.id=r.trainee WHERE t.unit_id=? AND r.result IS NOT NULL ORDER BY r.created_at,r.id',(uid,)).fetchall()
  if len(rows)>200 or len(rr)>100:raise HTTPException(422,'Unit exceeds portable bundle limits: 200 tactical and 100 recognition sessions; no partial history is silently exported')
  for r in rows:
   a=aar(r['id']);o=db.execute('SELECT outcomes,processed_at FROM skill_outcomes WHERE session_id=?',(r['id'],)).fetchone()
   if not o:raise HTTPException(422,'Session has no reconstructable skill outcomes')
   versions.add(a['scorecard']['engine_version'])
   entries.append(dict(id=r['id'],trainee=pseudonym(r['trainee'],secret,'P_'),created_at=r['created_at'],processed_at=o['processed_at'],scenario=export_scenario(a['scenario'],secret),events=a['events'],commands=a['commands'],execution_tick=a['executionTick'],end_tick=a['endTick'],scorecard=a['scorecard'],outcomes=json.loads(o['outcomes'])))
  for r in rr:
   o=db.execute('SELECT processed_at FROM skill_outcomes WHERE session_id=?',(r['id'],)).fetchone()
   if not o:raise HTTPException(422,'Recognition ledger missing')
   body=json.loads(r['body']);answers=[json.loads(a['result']) for a in db.execute('SELECT result FROM rapid_answers WHERE session_id=? ORDER BY round_index',(r['id'],))]
   rapids.append(dict(id=r['id'],trainee=pseudonym(r['trainee'],secret,'P_'),seed=body['seed'],created_at=r['created_at'],processed_at=o['processed_at'],answers=answers,result=json.loads(r['result'])))
  for tid in trainees:profiles[pseudonym(tid,secret,'P_')]={r['skill']:dict(alpha=r['alpha'],beta=r['beta']) for r in db.execute('SELECT * FROM skill_profiles WHERE trainee=?',(tid,))}
  recordings=[dict(id=r['id'],recording=json.loads(r['spec'])) for r in db.execute('SELECT * FROM recordings LIMIT 21')]
 if len(recordings)>20:raise HTTPException(422,'Export exceeds 20 recordings')
 payload=dict(schema_version=1,engine_versions=sorted(versions),unit=dict(id=pseudonym(uid,secret,'U_'),name=u['name']),sessions=entries,rapid=rapids,profiles=profiles,recordings=recordings,note='Pseudonymous transfer. HMAC integrity is not identity or training authenticity.')
 Payload.model_validate(payload)
 if len(dumps(payload).encode())>7*1024*1024:raise HTTPException(422,'Portable payload exceeds 7 MiB; export is bounded')
 return sign(payload,secret)

def validate_rapid(entry):
 from .advanced import make_rapid,RapidAnswer,rapid_metrics
 rounds=make_rapid(entry.seed,len(entry.answers));answers=[];prior=0
 for i,(a,r) in enumerate(zip(entry.answers,rounds)):
  req=RapidAnswer.model_validate({k:a[k] for k in ['round_index','answer','round_start_ms','response_time_ms']})
  if req.round_index!=i or req.round_start_ms<prior or req.answer is None and req.response_time_ms!=5000:raise ValueError('Invalid recognition clock/sequence')
  prior=req.round_start_ms+req.response_time_ms
  expected=dict(**req.model_dump(),correct_answer=r['correct_answer'],correct=req.answer==r['correct_answer'] and req.response_time_ms<5000,evidence=r['evidence'],flight=r['flight'],briefing=r['briefing'],snapshot_tick=r['snapshot_tick'],explanation='Reference uses the modeled silhouette, RF/IFF and exercise identity briefing; no IFF reply alone is not proof of hostility.')
  if a!=expected:raise ValueError('Recognition answer reference disagrees with seeded evidence')
  answers.append(expected)
 if entry.result!=rapid_metrics(answers):raise ValueError('Recognition summary disagrees with rounds')
 return rounds

@router.post('/bundle/import')
def import_bundle(req:Envelope):
 if not hmac.compare_digest(req.hmac,digest(req.payload,key())):raise HTTPException(422,'Bundle integrity check failed; no data imported')
 try:
  p=Payload.model_validate(req.payload);ids=[e.id for e in p.sessions]+[e.id for e in p.rapid]
  if len(ids)!=len(set(ids)):raise ValueError('Duplicate canonical session IDs inside bundle')
  from .review import SKILLS
  if len(p.profiles)>1000:raise ValueError('Too many profile snapshots')
  for tid,skills in p.profiles.items():
   if not re.fullmatch(r'P_[a-f0-9]{20}',tid) or set(skills)!=set(SKILLS):raise ValueError('Invalid anonymous profile snapshot')
   for values in skills.values():
    if set(values)!={'alpha','beta'} or any(type(v) not in [int,float] or not math.isfinite(v) or not 1<=v<=10000000 for v in values.values()):raise ValueError('Invalid Beta snapshot')
  if any(e.trainee not in p.profiles for e in p.sessions+p.rapid):raise ValueError('Session owner absent from profiles')
  prepared=[];rapid_prepared=[]
  from datetime import datetime
  for e in p.sessions+p.rapid:
   for stamp in [e.created_at,e.processed_at]:
    if datetime.fromisoformat(stamp).tzinfo is None:raise ValueError('Portable timestamps require an ISO timezone')
  for e in p.sessions:
   if e.scorecard.get('engine_version') not in p.engine_versions:raise ValueError('Scorecard engine version is unsupported or undeclared')
   Snapshot.model_validate(e.scenario)
   from .models import InstructorCommand
   from pydantic import TypeAdapter
   prev=0
   for c in e.commands:
    TypeAdapter(InstructorCommand).validate_python({k:c[k] for k in ['command_id','type','payload']})
    if set(c)-{'session_id','seq','issued_at','tick','order','command_id','type','payload'} or c['session_id']!=e.id or type(c['tick']) is not int or not 0<=c['tick']<=2250 or c['seq']!=prev+1 or type(c['order']) is not int:raise ValueError('Malformed command timeline')
    prev=c['seq']
   if any(a.tick>e.execution_tick for a in e.events) or any(c['tick']>e.execution_tick for c in e.commands):raise ValueError('Action exceeds observed horizon')
   review,card=build_review(e.scenario,[a.model_dump(exclude_none=True) for a in e.events],e.commands,e.id,e.execution_tick,'completion',e.end_tick)
   if {k:v for k,v in card.items() if k!='engine_version'}!={k:v for k,v in e.scorecard.items() if k!='engine_version'}:raise ValueError('Stored score disagrees with reconstruction')
   if session_outcomes(review)!=e.outcomes:raise ValueError('Skill outcomes disagree with reconstructed Ghost')
   prepared.append((e,review))
  for e in p.rapid:rapid_prepared.append((e,validate_rapid(e)))
  from .observations import recording_hash
  for r in p.recordings:
   recording=Recording.model_validate(r['recording'])
   if r['id']!='rec_'+recording_hash(recording)[:24]:raise ValueError('Recording hash mismatch')
 except (ValueError,KeyError,TypeError,OverflowError) as e:raise HTTPException(422,'Invalid portable history: '+str(e)[:300]) from e
 inserted=skipped=0
 from .units import persist_stats
 from .review import SKILLS
 with connect() as db:
  db.execute('BEGIN IMMEDIATE')
  aliases={pseudonym(r['id'],key(),'P_'):r['id'] for r in db.execute('SELECT id FROM trainees')}
  unit_aliases={pseudonym(r['id'],key(),'U_'):r['id'] for r in db.execute('SELECT id FROM units')}
  unit_id=unit_aliases.get(p.unit.id,p.unit.id)
  old_unit=db.execute('SELECT name FROM units WHERE id=?',(unit_id,)).fetchone()
  if old_unit and old_unit['name']!=p.unit.name:raise HTTPException(409,'Unit metadata conflicts; import rolled back')
  db.execute('INSERT OR IGNORE INTO units VALUES (?,?)',(unit_id,p.unit.name))
  affected=set()
  from .director import ensure_profile
  for anonymous in p.profiles:
   tid=aliases.get(anonymous,anonymous)
   old_member=db.execute('SELECT unit_id FROM trainees WHERE id=?',(tid,)).fetchone()
   if old_member and old_member['unit_id']!=unit_id:raise HTTPException(409,'Profile belongs to an incompatible unit; import rolled back')
   db.execute('INSERT OR IGNORE INTO trainees VALUES (?,?,?,?)',(tid,unit_id,tid,'bundle-import'))
   ensure_profile(db,tid)
  for e in p.sessions+p.rapid:e.trainee=aliases.get(e.trainee,e.trainee)
  def member(e):
   old=db.execute('SELECT unit_id FROM trainees WHERE id=?',(e.trainee,)).fetchone()
   if old and old['unit_id']!=unit_id:raise HTTPException(409,'Pseudonymous trainee belongs to an incompatible unit; import rolled back')
   db.execute('INSERT OR IGNORE INTO trainees VALUES (?,?,?,?)',(e.trainee,unit_id,e.trainee,e.created_at));affected.add(e.trainee)
  for e,review in prepared:
   old=db.execute('SELECT * FROM sessions WHERE id=?',(e.id,)).fetchone()
   oldspec=db.execute('SELECT spec FROM scenarios WHERE id=?',(e.scenario['id'],)).fetchone()
   if oldspec and export_scenario(json.loads(oldspec['spec']),key())!=e.scenario:raise HTTPException(409,'Scenario ID conflicts; import rolled back')
   if old:
    from .main import logged_events,applied_commands
    o=db.execute('SELECT outcomes,processed_at FROM skill_outcomes WHERE session_id=?',(e.id,)).fetchone()
    if old['trainee']!=e.trainee or old['unit_id']!=unit_id or old['status']!='completed' or old['scenario_id']!=e.scenario['id'] or json.loads(old['scorecard'])!=e.scorecard or logged_events(db,e.id)!=[a.model_dump(exclude_none=True) for a in e.events] or applied_commands(db,e.id)!=e.commands or not o or json.loads(o['outcomes'])!=e.outcomes or old['execution_tick']!=e.execution_tick:raise HTTPException(409,'Canonical session ID conflicts; import rolled back')
    skipped+=1;continue
   member(e);db.execute('INSERT OR IGNORE INTO scenarios VALUES (?,?)',(e.scenario['id'],dumps(e.scenario)))
   db.execute("INSERT INTO sessions(id,trainee,scenario_id,created_at,status,scorecard,end_tick,unit_id,execution_tick,completed_at) VALUES (?,?,?,?,'completed',?,?,?,?,?)",(e.id,e.trainee,e.scenario['id'],e.created_at,dumps(e.scorecard),2250,unit_id,e.execution_tick,e.created_at))
   log=[a.model_dump(exclude_none=True) for a in e.events]
   for seq,offset in enumerate(range(0,len(log),2000)):db.execute('INSERT INTO chunks VALUES (?,?,?)',(e.id,seq,dumps(log[offset:offset+2000])))
   for c in e.commands:db.execute('INSERT INTO instructor_commands VALUES (?,?,?,?,?,?,?)',(e.id,c['seq'],c['command_id'],c['issued_at'],dumps({k:c[k] for k in ['command_id','type','payload']}),c['tick'],c['order']))
   persist_skill_results(db,e.trainee,e.id,e.outcomes,'director-v1');db.execute('UPDATE skill_outcomes SET processed_at=? WHERE session_id=?',(e.processed_at,e.id));persist_stats(db,e.id,review)
   if e.scenario.get('director_decision'):
    d={**e.scenario['director_decision'],'trainee_id':e.trainee};db.execute('INSERT INTO director_history VALUES (?,?,?)',(e.id,e.trainee,dumps(d)))
   inserted+=1
  for e,rounds in rapid_prepared:
   old=db.execute('SELECT * FROM rapid_sessions WHERE id=?',(e.id,)).fetchone()
   if old:
    answers=[json.loads(r['result']) for r in db.execute('SELECT result FROM rapid_answers WHERE session_id=? ORDER BY round_index',(e.id,))]
    if old['trainee']!=e.trainee or json.loads(old['body'])['seed']!=e.seed or json.loads(old['result'] or 'null')!=e.result or answers!=e.answers:raise HTTPException(409,'Recognition session ID conflicts; import rolled back')
    skipped+=1;continue
   member(e);body=dict(request_id='bundle-'+e.id,trainee_id=e.trainee,seed=e.seed,rounds=len(rounds));db.execute('INSERT INTO rapid_sessions VALUES (?,?,?,?,?,?,?)',(e.id,body['request_id'],e.trainee,dumps(body),dumps(rounds),e.created_at,dumps(e.result)))
   for i,a in enumerate(e.answers):db.execute('INSERT INTO rapid_answers VALUES (?,?,?,?)',(e.id,i,dumps({k:a[k] for k in ['round_index','answer','round_start_ms','response_time_ms']}),dumps(a)))
   outcomes={s:dict(successes=e.result['correct'] if s=='classification_iff' else 0,failures=e.result['rounds']-e.result['correct'] if s=='classification_iff' else 0) for s in SKILLS};persist_skill_results(db,e.trainee,e.id,outcomes,'rapid-id-v1');db.execute('UPDATE skill_outcomes SET processed_at=? WHERE session_id=?',(e.processed_at,e.id));inserted+=1
  for tid in affected:
   for skill in SKILLS:
    rows=db.execute('SELECT * FROM skill_outcomes WHERE trainee=? ORDER BY processed_at,rowid',(tid,)).fetchall()
    relevant=[r for r in rows if sum(json.loads(r['outcomes'])[skill].values())]
    if relevant:
     latest=relevant[-1];db.execute('UPDATE skill_profiles SET updated_at=?,last_session_id=? WHERE trainee=? AND skill=?',(latest['processed_at'],latest['session_id'],tid,skill))
  for r in p.recordings:db.execute('INSERT OR IGNORE INTO recordings VALUES (?,?)',(r['id'],dumps(r['recording'])))
 return dict(inserted_sessions=inserted,skipped_sessions=skipped,recordings=len(p.recordings),profile_basis='Rebuilt only from validated imported outcome ledger; supplied profile snapshots are informational.',integrity='HMAC verified with local shared key; donor identity/authenticity not attested')
