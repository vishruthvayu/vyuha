"""Transfer only exposure requests; independently reconstruct every receipt."""
import json
from fastapi import HTTPException
from .fusion import Exposure,ensure_schema,reconstruct_boundaries,validate_exposure
from .storage import dumps

def export_exposures(db,sid):
 ensure_schema(db)
 rows=db.execute('SELECT body FROM fusion_exposures WHERE session_id=? ORDER BY rowid',(sid,)).fetchall()
 if len(rows)>2000:raise HTTPException(422,'Session exceeds 2000 portable fusion exposures')
 return [Exposure.model_validate_json(r['body']).model_dump(exclude_none=True) for r in rows]

def prepare_exposures(entry):
 exposures=entry.fusion_exposures
 if len({e.exposure_id for e in exposures})!=len(exposures):raise ValueError('Duplicate portable fusion exposure IDs')
 events=[e.model_dump(exclude_none=True) for e in entry.events]
 boundaries=reconstruct_boundaries(entry.scenario,events,entry.commands,exposures)
 return [(e,validate_exposure(entry.scenario,events,entry.commands,entry.id,e,entry.execution_tick,_boundary=boundaries[(e.tick,e.before_order)])) for e in exposures]

def verify_existing_exposures(db,entry,receipts):
 ensure_schema(db)
 existing={r['exposure_id']:r for r in db.execute('SELECT * FROM fusion_exposures WHERE session_id=?',(entry.id,))}
 if set(existing)!={e.exposure_id for e,_ in receipts}:raise HTTPException(409,'Canonical fusion exposure set conflicts; import rolled back')
 for e,receipt in receipts:
  row=existing[e.exposure_id]
  if json.loads(row['body'])!=e.model_dump(exclude_none=True) or json.loads(row['receipt'])!=receipt:raise HTTPException(409,'Canonical fusion receipt conflicts; import rolled back')

def insert_exposures(db,entry,receipts):
 ensure_schema(db)
 for e,receipt in receipts:
  db.execute('INSERT INTO fusion_exposures VALUES (?,?,?,?)',(entry.id,e.exposure_id,dumps(e.model_dump(exclude_none=True)),dumps(receipt)))
