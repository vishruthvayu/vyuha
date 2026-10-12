"""Pseudonymous immutable crew archives; never restores operational role codes.
A shared outcome is not assigned to individual members or the synthetic owner.
"""
from typing import Literal
from pydantic import Field,model_validator
from .models import StrictModel
from .storage import dumps

RESULT_BASIS='Shared crew result only; no individual Beta profile or outcome ledger'

class CrewMemberRef(StrictModel):
 id:str=Field(pattern=r'^CM_[a-f0-9]{20}$')
 role:Literal['spotter','responder']

class CrewAttributionRef(StrictModel):
 timeline_order:int=Field(ge=0,le=100000)
 member_id:str=Field(pattern=r'^CM_[a-f0-9]{20}$')
 role:Literal['spotter','responder']

class SharedCrewMetadata(StrictModel):
 version:Literal[1]
 id:str=Field(pattern=r'^C_[a-f0-9]{20}$')
 name:Literal['Pseudonymous shared crew']
 members:list[CrewMemberRef]=Field(min_length=2,max_length=8)
 attribution:list[CrewAttributionRef]=Field(max_length=5000)
 result_basis:Literal['Shared crew result only; no individual Beta profile or outcome ledger']
 @model_validator(mode='after')
 def coherent(self):
  roster={m.id:m.role for m in self.members}
  if len(roster)!=len(self.members) or set(roster.values())!={'spotter','responder'}:raise ValueError('Crew roster requires distinct members and both roles')
  if len({a.timeline_order for a in self.attribution})!=len(self.attribution):raise ValueError('Duplicate crew action attribution')
  if [a.timeline_order for a in self.attribution]!=sorted(a.timeline_order for a in self.attribution):raise ValueError('Crew attribution must be ordered')
  if any(roster.get(a.member_id)!=a.role for a in self.attribution):raise ValueError('Crew attribution does not match roster role')
  return self

def ensure_schema(db):
 db.execute('CREATE TABLE IF NOT EXISTS crew_archive(session_id TEXT PRIMARY KEY,metadata TEXT NOT NULL)')

def is_crew_session(db,sid):
 ensure_schema(db)
 return bool(db.execute('SELECT 1 FROM crews WHERE session_id=? UNION ALL SELECT 1 FROM crew_archive WHERE session_id=?',(sid,sid)).fetchone())

def shared_metadata(db,sid,secret):
 from .portable import pseudonym
 archived=db.execute('SELECT metadata FROM crew_archive WHERE session_id=?',(sid,)).fetchone()
 if archived:
  import json
  return SharedCrewMetadata.model_validate_json(archived['metadata']).model_dump()
 row=db.execute('SELECT id FROM crews WHERE session_id=?',(sid,)).fetchone()
 if not row:return None
 roster=[dict(id=pseudonym(m['id'],secret,'CM_'),role=m['role']) for m in db.execute('SELECT id,role FROM crew_members WHERE crew_id=? ORDER BY id',(row['id'],))]
 attribution=[dict(timeline_order=a['timeline_order'],member_id=pseudonym(a['member_id'],secret,'CM_'),role=a['role']) for a in db.execute('SELECT timeline_order,member_id,role FROM crew_attribution WHERE session_id=? ORDER BY timeline_order',(sid,))]
 return SharedCrewMetadata(version=1,id=pseudonym(row['id'],secret,'C_'),name='Pseudonymous shared crew',members=roster,attribution=attribution,result_basis=RESULT_BASIS).model_dump()

def validate_shared(entry):
 if entry.scenario.get('version')!=2 or entry.scenario.get('director_decision') or entry.scenario.get('director_v2'):raise ValueError('Shared crew archive requires a non-individual v0.4 scenario')
 if entry.outcomes is not None:raise ValueError('Shared crew history cannot supply individual skill outcomes')
 actions={a.order:a for a in entry.events}
 if None in actions or len(actions)!=len(entry.events):raise ValueError('Crew actions require unique timeline orders')
 metadata=entry.shared_crew
 if set(actions)!={a.timeline_order for a in metadata.attribution}:raise ValueError('Crew attribution must cover every action exactly once')
 for attribution in metadata.attribution:
  action=actions[attribution.timeline_order]
  if (attribution.role=='spotter')!=(action.k=='designate'):raise ValueError('Crew action violates frozen role attribution')

def save_archive(db,sid,metadata):
 ensure_schema(db)
 db.execute('INSERT INTO crew_archive VALUES (?,?)',(sid,dumps(metadata.model_dump())))
