"""Officer teaching annotations tied to immutable pause commands, outside scoring."""
import json
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import Field, field_validator
from . import storage
from .models import StrictModel

router=APIRouter(prefix='/api/v1/instructor',tags=['Teaching'])

class TeachingPause(StrictModel):
    request_id:str=Field(min_length=1,max_length=64,pattern=r'^[A-Za-z0-9_-]+$')
    text:str=Field(min_length=1,max_length=1000)

    @field_validator('text')
    @classmethod
    def meaningful_text(cls,value):
        if not value.strip() or any(ord(c)<32 and c not in '\n\t' for c in value):
            raise ValueError('Provide a readable teaching explanation')
        return value.strip()

def ensure_schema(db):
    db.execute('''CREATE TABLE IF NOT EXISTS instructor_notes (
        session_id TEXT NOT NULL, command_seq INTEGER NOT NULL, text TEXT NOT NULL,
        PRIMARY KEY(session_id,command_seq))''')

def notes(db,sid):
    return [dict(command_seq=r['command_seq'],text=r['text'],issued_at=r['issued_at'],tick=r['tick'],order=r['timeline_order'],status='applied' if r['tick'] is not None else 'not applied before completion' if r['session_status']=='completed' else 'awaiting application')
            for r in db.execute('''SELECT n.*,c.issued_at,c.tick,c.timeline_order,s.status AS session_status FROM instructor_notes n
                JOIN instructor_commands c ON c.session_id=n.session_id AND c.seq=n.command_seq
                JOIN sessions s ON s.id=n.session_id WHERE n.session_id=? ORDER BY n.command_seq''',(sid,))]

def decorate_review(db,sid,review):
    recorded=notes(db,sid)
    if not recorded:return review
    # Never edit the cached/reconstructed input report or append fabricated logical ticks.
    import copy
    result=copy.deepcopy(review)
    for entry in recorded:
        if entry['tick'] is None:continue
        event=next((e for e in result['timeline'] if e['category']=='instructor_action' and e['tick']==entry['tick'] and e['order']==entry['order']),None)
        if event:event['title']+=' · Teaching note: '+entry['text']
    result['teaching_notes']=recorded
    return result

@router.get('/sessions/{sid}/teaching-notes')
def teaching_notes(sid:str):
    from .main import session_record
    with storage.connect() as db:
        session_record(db,sid)
        return {'notes':notes(db,sid)}

@router.post('/sessions/{sid}/teaching-pauses')
def teaching_pause(sid:str,req:TeachingPause):
    from .main import session_record,command_records
    command={'command_id':req.request_id,'type':'pause','payload':{}}
    with storage.connect() as db:
        db.execute('BEGIN IMMEDIATE')
        row=session_record(db,sid)
        old=db.execute('SELECT * FROM instructor_commands WHERE session_id=? AND command_id=?',(sid,req.request_id)).fetchone()
        if old:
            note=db.execute('SELECT text FROM instructor_notes WHERE session_id=? AND command_seq=?',(sid,old['seq'])).fetchone()
            if old['body']!=storage.dumps(command) or not note or note['text']!=req.text:
                raise HTTPException(409,'Teaching request ID cannot be reused with another command or explanation')
            seq=old['seq'];duplicate=True
        else:
            if row['status']!='active':raise HTTPException(409,'Completed evidence cannot acquire a new teaching annotation')
            seq=db.execute('SELECT count(*) FROM instructor_commands WHERE session_id=?',(sid,)).fetchone()[0]+1
            if seq>100:raise HTTPException(422,'Command limit reached')
            db.execute('INSERT INTO instructor_commands(session_id,seq,command_id,issued_at,body) VALUES (?,?,?,?,?)',(sid,seq,req.request_id,datetime.now(timezone.utc).isoformat(),storage.dumps(command)))
            db.execute('INSERT INTO instructor_notes VALUES (?,?,?)',(sid,seq,req.text));duplicate=False
        result={'command':command_records(db,sid,seq-1)[0],'duplicate':duplicate,'notes':notes(db,sid)}
        crew=db.execute('SELECT id FROM crews WHERE session_id=?',(sid,)).fetchone()
    # Server-owned shared exercises consume the ordinary queue through their authority.
    if crew:
        from .crew import transaction,runtime,crew as shared
        with transaction(crew['id']) as db:runtime(db,shared(db,crew['id']))
    return result
