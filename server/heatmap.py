"""Presentation aggregation of the existing, persisted four-skill ledger."""
import json
from fastapi import HTTPException
from .storage import connect
from .review import SKILLS
from .advanced import router
FAMILIES=['DIRECT','SATURATION','DECOY_THEN_STRIKE','STAGGERED_WAVES','LOW_APPROACH','SPLIT_SWARM','PROBE_AND_RETREAT','BLIND_SECTOR','LEGACY','RAPID_ID']

@router.get('/units/{uid}/skill-heatmap')
def skill_heatmap(uid:str,trainee:str|None=None):
 from .main import profile
 with connect() as db:
  if not db.execute('SELECT 1 FROM units WHERE id=?',(uid,)).fetchone():raise HTTPException(404,'Unit not found')
  from .crew import is_shared_owner
  members=[r['id'] for r in db.execute('SELECT id FROM trainees WHERE unit_id=?',(uid,)) if not is_shared_owner(db,r['id'])]
 if trainee is not None and trainee not in members:raise HTTPException(404,'Trainee not in this unit')
 # Use the existing idempotent legacy backfill, never a second outcome evaluator.
 for tid in ([trainee] if trainee is not None else members):profile(tid)
 with connect() as db:
  rows=db.execute('''SELECT o.*,s.status,sc.spec,rs.result AS rapid_result
   FROM skill_outcomes o JOIN trainees t ON t.id=o.trainee
   LEFT JOIN sessions s ON s.id=o.session_id
   LEFT JOIN scenarios sc ON sc.id=s.scenario_id
   LEFT JOIN rapid_sessions rs ON rs.id=o.session_id
   WHERE t.unit_id=? AND (? IS NULL OR o.trainee=?) ORDER BY o.processed_at,o.rowid''',(uid,trainee,trainee)).fetchall()
 cells={f:{k:dict(successes=0,failures=0,sessions=0) for k in SKILLS} for f in FAMILIES}
 counts={f:0 for f in FAMILIES};excluded=0
 for row in rows:
  if row['trainee'] not in members:excluded+=1;continue
  if row['version']=='rapid-id-v1' and row['rapid_result'] is not None:family='RAPID_ID'
  elif row['status']=='completed' and row['spec']:
   tactic=(json.loads(row['spec']).get('red_force') or {}).get('tactic')
   family=tactic if tactic in FAMILIES[:-2] else 'LEGACY'
  else:excluded+=1;continue
  counts[family]+=1
  outcomes=json.loads(row['outcomes'])
  for skill in SKILLS:
   # Rapid ID contributes only classification, matching the existing contract.
   if family=='RAPID_ID' and skill!='classification_iff':continue
   v=outcomes.get(skill,{});a=v.get('successes',0);b=v.get('failures',0)
   c=cells[family][skill];c['successes']+=a;c['failures']+=b;c['sessions']+=int(a+b>0)
 for group in cells.values():
  for c in group.values():
   n=c['successes']+c['failures'];c.update(observations=n,estimate=(1+c['successes'])/(2+n) if n else None)
 return dict(schema_version=1,unit_id=uid,trainee_id=trainee,skills=SKILLS,rows=[dict(family=f,sessions=counts[f],cells=cells[f]) for f in FAMILIES],included_sessions=sum(counts.values()),excluded_sessions=excluded,note='Within-family pooled Beta(1,1) estimates from persisted skill outcomes, not mean trainee mastery. Zero observations have no displayed estimate. Legacy sessions without tactic metadata are grouped as LEGACY. Different scenarios, versions and conditions are not controlled comparisons or evidence of efficacy.')
