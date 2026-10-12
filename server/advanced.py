"""Exercise library, recognition practice and ledger-based historical analytics.

Officer mutations and unit administration require expiring bearer authentication.
Trainee identity still relies on trusted LAN capabilities.
"""
import copy,json,statistics,uuid,os
from collections import Counter
from datetime import datetime,timezone
from typing import Literal
from fastapi import APIRouter,HTTPException
from pydantic import Field
from .models import StrictModel
from .storage import connect,dumps
from .exercises import PACKS,PRESETS,AuthorScenario,compile_authored
from .engine import Simulation,rng
from .review import SKILLS,evidence
from .director import persist_skill_results

router=APIRouter(prefix='/api/v1')
def now():return datetime.now(timezone.utc).isoformat()
def selected_pack(db,uid):
 row=db.execute('SELECT pack_id FROM unit_preferences WHERE unit_id=?',(uid,)).fetchone()
 return row['pack_id'] if row else 'army-forward-post'

class PackChoice(StrictModel):
 pack_id:Literal['army-forward-post','capf-border-post','critical-infrastructure']

@router.get('/doctrine-packs')
def packs():return {'packs':list(PACKS.values()),'note':'Illustrative training configurations; not official doctrine.'}

@router.get('/units/{uid}/doctrine')
def pack_for_unit(uid:str):
 with connect() as db:
  if not db.execute('SELECT 1 FROM units WHERE id=?',(uid,)).fetchone():raise HTTPException(404,'Unit not found')
  return copy.deepcopy(PACKS[selected_pack(db,uid)])

@router.post('/units/{uid}/doctrine')
def set_pack(uid:str,req:PackChoice):
 with connect() as db:
  if not db.execute('SELECT 1 FROM units WHERE id=?',(uid,)).fetchone():raise HTTPException(404,'Unit not found')
  db.execute('INSERT INTO unit_preferences VALUES (?,?) ON CONFLICT(unit_id) DO UPDATE SET pack_id=excluded.pack_id',(uid,req.pack_id))
 return copy.deepcopy(PACKS[req.pack_id])

@router.post('/scenario-library/preview')
def preview(req:AuthorScenario):return compile_authored(req)

@router.post('/scenario-library',status_code=201)
def save_scenario(req:AuthorScenario):
 s=compile_authored(req)
 with connect() as db:
  db.execute('BEGIN IMMEDIATE')
  db.execute('INSERT OR IGNORE INTO scenarios VALUES (?,?)',(s['id'],dumps(s)))
  db.execute('INSERT OR IGNORE INTO scenario_library VALUES (?,?,?)',(s['id'],now(),dumps(req.model_dump())))
 return s

@router.get('/scenario-library')
def library():
 with connect() as db:
  return {'scenarios':[json.loads(r['spec']) for r in db.execute('SELECT sc.spec FROM scenario_library l JOIN scenarios sc ON sc.id=l.id ORDER BY l.created_at DESC,l.id')]}

@router.get('/scenarios/{sid}')
def frozen_scenario(sid:str):
 with connect() as db:r=db.execute('SELECT spec FROM scenarios WHERE id=?',(sid,)).fetchone()
 if not r:raise HTTPException(404,'Original scenario not found; cannot replace its frozen rules')
 return json.loads(r['spec'])

class RapidStart(StrictModel):
 request_id:str=Field(min_length=8,max_length=80)
 trainee_id:str=Field(min_length=1,max_length=24,pattern=r'^[A-Za-z0-9_-]+$')
 seed:int=Field(default=482913,ge=0,le=4294967295)
 rounds:int=Field(default=15,ge=10,le=20)

class RapidAnswer(StrictModel):
 round_index:int=Field(ge=0,le=19)
 answer:Literal['bird','friendly_uav','hostile_quad','no_rf_fpv','fixed_wing']|None
 round_start_ms:int=Field(ge=0,le=1000000)
 response_time_ms:int=Field(ge=0,le=5000)

def make_rapid(seed,count):
 r=rng(seed);items=list(PRESETS);rounds=[]
 for block in range((count+4)//5):
  order=items[:]
  for i in range(4,0,-1):j=int(r()*(i+1));order[i],order[j]=order[j],order[i]
  for label in order:
   if len(rounds)==count:break
   kind,identity,rf=PRESETS[label]
   spec=dict(id='T1',kind=kind,identity=identity,rf=rf,spawn=0,bearing=int(r()*360),distance=80,speed=.65 if kind=='bird' else 3.8 if kind=='fiber_fpv' else 2.5,altitude=10 if kind=='fiber_fpv' else 22)
   s=dict(version=1,id='rapid',seed=(seed+len(rounds))%2**32,title='Recognition observation',duration=75,night=True,fog=.15,jamStart=2250,jamEnd=2250,tracks=[spec])
   sim=Simulation(s)
   while not sim.tracks[0]['thermal']:sim.step()
   ev=evidence(sim,sim.tracks[0]);ev.pop('prior_classification');ev.pop('prior_identity')
   rounds.append(dict(index=len(rounds),correct_answer=label,time_limit_ms=5000,snapshot_tick=sim.tick,evidence=ev,
    flight='irregular orbit' if kind=='bird' else 'steady crossing' if identity=='friendly' else 'steady approach',
    briefing='Exercise control identifies this as friendly traffic; confirm the visual/RF evidence.' if identity=='friendly' else 'Exercise control has confirmed this approaching UAV as hostile; identify its type and RF link.' if identity=='hostile' else 'Identity remains unclassified; use the observed silhouette and flight. IFF no reply alone is not hostility.',
    visual_type=kind))
 return rounds

def rapid_view(db,row):
 rounds=json.loads(row['rounds']);answers=[json.loads(r['result']) for r in db.execute('SELECT result FROM rapid_answers WHERE session_id=? ORDER BY round_index',(row['id'],))];idx=len(answers)
 current={k:v for k,v in rounds[idx].items() if k not in ['correct_answer','visual_type']} if idx<len(rounds) else None
 # No canonical labels or future answer key are sent before a decision.
 return dict(id=row['id'],trainee_id=row['trainee'],round_count=len(rounds),current=current,reviews=answers,result=json.loads(row['result']) if row['result'] else None,timing_basis='Client active monotonic time; pauses excluded. Timing is not server-attested.')

@router.post('/rapid-id',status_code=201)
def start_rapid(req:RapidStart):
 rounds=make_rapid(req.seed,req.rounds);body=dumps(req.model_dump())
 with connect() as db:
  db.execute('BEGIN IMMEDIATE')
  if not db.execute('SELECT 1 FROM trainees WHERE id=?',(req.trainee_id,)).fetchone():
   if os.environ.get('VYUHA_UNIT_MODE')=='1':raise HTTPException(422,'Join a unit before Rapid ID')
   db.execute('INSERT INTO trainees VALUES (?,?,?,?)',(req.trainee_id,'local',req.trainee_id,now()))
  old=db.execute('SELECT * FROM rapid_sessions WHERE request_id=?',(req.request_id,)).fetchone()
  if old:
   if old['body']!=body:raise HTTPException(409,'Rapid start ID cannot be reused with different settings')
   return rapid_view(db,old)
  sid='R_'+uuid.uuid4().hex
  db.execute('INSERT INTO rapid_sessions VALUES (?,?,?,?,?,?,NULL)',(sid,req.request_id,req.trainee_id,body,dumps(rounds),now()))
  return rapid_view(db,db.execute('SELECT * FROM rapid_sessions WHERE id=?',(sid,)).fetchone())

@router.get('/rapid-id/{sid}')
def rapid_get(sid:str):
 with connect() as db:
  row=db.execute('SELECT * FROM rapid_sessions WHERE id=?',(sid,)).fetchone()
  if not row:raise HTTPException(404,'Rapid session not found')
  return rapid_view(db,row)

def rapid_metrics(answers):
 success=sum(a['correct'] for a in answers);errors=Counter(f"{a['correct_answer']} → {a['answer'] or 'timeout'}" for a in answers if not a['correct'])
 summary=dict(rounds=len(answers),correct=success,accuracy=success/len(answers),median_response_ms=statistics.median(a['response_time_ms'] for a in answers),friendly_false_hostile=sum(a['correct_answer']=='friendly_uav' and a['answer'] in ['hostile_quad','no_rf_fpv','fixed_wing'] for a in answers),bird_confusion=sum(not a['correct'] and (a['correct_answer']=='bird' or a['answer']=='bird') for a in answers),error_counts=dict(errors),most_common_error=errors.most_common(1)[0][0] if errors else None,profile_mapping='One classification_iff success per correct round; failure per incorrect/timeout round. Other skills receive zero observations.',verified=True)
 return summary

@router.post('/rapid-id/{sid}/answers')
def answer_rapid(sid:str,req:RapidAnswer):
 body=dumps(req.model_dump())
 with connect() as db:
  db.execute('BEGIN IMMEDIATE');row=db.execute('SELECT * FROM rapid_sessions WHERE id=?',(sid,)).fetchone()
  if not row:raise HTTPException(404,'Rapid session not found')
  old=db.execute('SELECT body FROM rapid_answers WHERE session_id=? AND round_index=?',(sid,req.round_index)).fetchone()
  if old:
   if old['body']!=body:raise HTTPException(409,'An answered round is immutable')
   return rapid_view(db,row)
  rounds=json.loads(row['rounds']);count=db.execute('SELECT COUNT(*) FROM rapid_answers WHERE session_id=?',(sid,)).fetchone()[0]
  if req.round_index!=count or count>=len(rounds):raise HTTPException(409,'Answer the current round in sequence')
  previous=db.execute('SELECT body FROM rapid_answers WHERE session_id=? ORDER BY round_index DESC LIMIT 1',(sid,)).fetchone()
  if previous:
   prev=json.loads(previous['body'])
   if req.round_start_ms<prev['round_start_ms']+prev['response_time_ms']:raise HTTPException(422,'Active monotonic round clock cannot go backwards')
  if req.answer is None and req.response_time_ms!=5000:raise HTTPException(422,'A timeout must use the five-second deadline')
  round=rounds[count];correct=req.answer==round['correct_answer'] and req.response_time_ms<5000
  result=dict(**req.model_dump(),correct_answer=round['correct_answer'],correct=correct,evidence=round['evidence'],flight=round['flight'],briefing=round['briefing'],snapshot_tick=round['snapshot_tick'],explanation='Reference uses the modeled silhouette, RF/IFF and exercise identity briefing; no IFF reply alone is not proof of hostility.')
  db.execute('INSERT INTO rapid_answers VALUES (?,?,?,?)',(sid,count,body,dumps(result)))
  if count+1==len(rounds):
   answers=[json.loads(r['result']) for r in db.execute('SELECT result FROM rapid_answers WHERE session_id=? ORDER BY round_index',(sid,))]
   summary=rapid_metrics(answers);success=summary['correct']
   outcomes={s:dict(successes=success if s=='classification_iff' else 0,failures=len(answers)-success if s=='classification_iff' else 0) for s in SKILLS}
   persist_skill_results(db,row['trainee'],sid,outcomes,'rapid-id-v1');db.execute('UPDATE rapid_sessions SET result=? WHERE id=?',(dumps(summary),sid))
   row=db.execute('SELECT * FROM rapid_sessions WHERE id=?',(sid,)).fetchone()
  return rapid_view(db,row)

def trend(rows,trainees):
 state={t:{s:[1.0,1.0] for s in SKILLS} for t in trainees};points=[]
 for n,row in enumerate(rows):
  t=row['trainee'];outcomes=json.loads(row['outcomes'])
  for skill,v in outcomes.items():state[t][skill][0]+=v['successes'];state[t][skill][1]+=v['failures']
  means={s:sum(v[s][0]/sum(v[s]) for v in state.values())/len(state) for s in SKILLS}
  points.append(dict(sequence=n+1,session_id=row['session_id'],trainee=t,processed_at=row['processed_at'],kind='Rapid ID' if row['version']=='rapid-id-v1' else 'Tactical',means=means,outcomes=outcomes))
 return points

@router.get('/trainees/{tid}/analytics')
def trainee_analytics(tid:str):
 from .main import profile
 profile(tid)
 with connect() as db:
  rows=db.execute('SELECT * FROM skill_outcomes WHERE trainee=? ORDER BY processed_at,rowid',(tid,)).fetchall()
  points=trend(rows,[tid]);decisions={r['session_id']:json.loads(r['decision']) for r in db.execute('SELECT * FROM director_history WHERE trainee=?',(tid,))}
  sessions=[]
  for r in db.execute("SELECT s.*,sc.spec FROM sessions s JOIN scenarios sc ON sc.id=s.scenario_id WHERE trainee=? AND status='completed' ORDER BY completed_at,created_at,s.id",(tid,)):
   card=json.loads(r['scorecard']);spec=json.loads(r['spec']);hostiles=[x for x in card['rows'] if x['identity']=='hostile']
   failures=db.execute('SELECT failures FROM session_unit_stats WHERE session_id=?',(r['id'],)).fetchone()
   sessions.append(dict(id=r['id'],title=spec['title'],pack=(spec.get('doctrine') or {}).get('id','legacy'),seed=spec['seed'],observed_tick=r['execution_tick'],score=card['score'],nodes={k:round(sum(x[k] for x in hostiles)/len(hostiles),2) if hostiles else 0 for k in ['detect','classify','prioritise','engage']},leakers=card['leakers'],roe_breaches=card['roe_breaches'],failures=json.loads(failures['failures']) if failures else {}))
  for point in points:
   d=decisions.get(point['session_id']);point['director_focus']=d['focus_skill'] if d else None;point['director_mastery_before']=d['mastery_estimate'] if d else None
 return dict(trainee_id=tid,prior={s:.5 for s in SKILLS},points=points,sessions=sessions,note='Persisted Beta(1,1) ledger estimates by processing sequence. Session comparisons show observed differences, not training causation. Different scenarios/conditions are not controlled comparisons.')

@router.get('/units/{uid}/analytics')
def unit_analytics(uid:str):
 from .main import profile
 with connect() as db:
  if not db.execute('SELECT 1 FROM units WHERE id=?',(uid,)).fetchone():raise HTTPException(404,'Unit not found')
  trainees=[r['id'] for r in db.execute('SELECT id FROM trainees WHERE unit_id=?',(uid,))]
 for tid in trainees:profile(tid)
 with connect() as db:rows=db.execute('SELECT o.* FROM skill_outcomes o JOIN trainees t ON t.id=o.trainee WHERE t.unit_id=? ORDER BY o.processed_at,o.rowid',(uid,)).fetchall()
 return dict(unit_id=uid,trainee_count=len(trainees),prior={s:.5 for s in SKILLS},points=trend(rows,trainees),note='Retrospective mean of current registered cohort, including priors for trainees without observations; sequence windows, not calendar trends or efficacy evidence.')
