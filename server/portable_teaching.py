"""Immutable teaching text outside scoring; pending pauses never enter replay."""
import json
from datetime import datetime,timezone
from pydantic import Field, field_validator
from .models import StrictModel
from .storage import dumps


class PendingTeachingPause(StrictModel):
    command_id: str = Field(min_length=1, max_length=64, pattern=r'^[A-Za-z0-9_-]+$')
    issued_at: str = Field(min_length=1, max_length=40)

    @field_validator("issued_at")
    @classmethod
    def utc_timestamp(cls,value):
        try:parsed=datetime.fromisoformat(value)
        except ValueError:raise ValueError("Pending pause issue time must be an ISO timestamp")
        if parsed.tzinfo is None or parsed.utcoffset()!=timezone.utc.utcoffset(parsed):
            raise ValueError("Pending pause issue time must include UTC timezone")
        return value


class TeachingNote(StrictModel):
    command_seq: int = Field(ge=1, le=100)
    text: str = Field(min_length=1, max_length=1000)
    pending_command: PendingTeachingPause | None = None

    @field_validator('text')
    @classmethod
    def readable(cls, value):
        if value != value.strip() or not value or any(ord(c) < 32 and c not in '\n\t' for c in value):
            raise ValueError('Teaching note must be trimmed readable text')
        return value


def ensure_schema(db):
    db.execute('CREATE TABLE IF NOT EXISTS instructor_notes(session_id TEXT NOT NULL,command_seq INTEGER NOT NULL,text TEXT NOT NULL,PRIMARY KEY(session_id,command_seq))')


def export_notes(db, sid):
    if not db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='instructor_notes'").fetchone():
        return []
    notes = []
    for row in db.execute('SELECT * FROM instructor_notes WHERE session_id=? ORDER BY command_seq', (sid,)):
        command = db.execute('SELECT * FROM instructor_commands WHERE session_id=? AND seq=?', (sid, row['command_seq'])).fetchone()
        if command is None or json.loads(command['body'])['type'] != 'pause':
            raise ValueError('Teaching note has no recorded pause command')
        note = dict(command_seq=row['command_seq'], text=row['text'])
        if command['tick'] is None:
            body = json.loads(command['body'])
            if body['payload'] != {} or command['timeline_order'] is not None:
                raise ValueError('Pending teaching pause has invalid payload or logical order')
            note['pending_command'] = dict(command_id=body['command_id'], issued_at=command['issued_at'])
        notes.append(note)
    return notes


def validate_notes(entry):
    orders = [note.command_seq for note in entry.teaching_notes]
    if orders != sorted(set(orders)):
        raise ValueError('Teaching notes require unique ordered command sequences')
    commands = {command['seq']: command for command in entry.commands}
    ids = {command['command_id'] for command in entry.commands}
    last = max(commands, default=0)
    for note in entry.teaching_notes:
        if note.pending_command:
            if note.command_seq <= last or note.pending_command.command_id in ids:
                raise ValueError('Pending teaching pause conflicts with applied command history')
            ids.add(note.pending_command.command_id)
        else:
            command = commands.get(note.command_seq)
            if command is None or command['type'] != 'pause':
                raise ValueError('Teaching note must bind an exported accepted pause command')


def notes_match(db, entry):
    try:
        return export_notes(db, entry.id) == [note.model_dump(exclude_none=True) for note in entry.teaching_notes]
    except ValueError:
        return False


def insert_notes(db, entry):
    if not entry.teaching_notes:
        return
    ensure_schema(db)
    for note in entry.teaching_notes:
        if note.pending_command:
            command = note.pending_command
            body = dict(command_id=command.command_id, type='pause', payload={})
            db.execute('INSERT INTO instructor_commands(session_id,seq,command_id,issued_at,body) VALUES (?,?,?,?,?)', (entry.id, note.command_seq, command.command_id, command.issued_at, dumps(body)))
        db.execute('INSERT INTO instructor_notes VALUES (?,?,?)', (entry.id, note.command_seq, note.text))
