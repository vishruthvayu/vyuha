"""Applied and unacknowledged teaching annotations survive immutable transfer."""
import copy
import pytest
from server import storage
from server.portable import sign
from server.portable_teaching import ensure_schema, export_notes
from server.tests.test_api import client
from server.tests.test_crew import shared, visible
from server.tests.test_hardening import KEY
from server.tests.test_mission_crew_cohort import snapshot
from server.tests.test_portable_browser import browser_json
from server.tests.test_portable_crew import beta_state


@pytest.fixture
def annotated_bundle(shared, monkeypatch):
    monkeypatch.setenv('VYUHA_BUNDLE_SECRET', KEY)
    c = shared['client']; sid = shared['issued']['session_id']
    track = visible(shared)
    assert shared['act'](0, 'teaching-mark', 'designate', track).status_code == 200
    shared['control']('pause')
    with storage.connect() as db:
        ensure_schema(db)
        pause = db.execute("SELECT seq FROM instructor_commands WHERE session_id=? AND json_extract(body,'$.type')='pause'", (sid,)).fetchone()[0]
        db.execute('INSERT INTO instructor_notes VALUES (?,?,?)', (sid, pause, 'Explain uncertain evidence before responding.'))
        # A pending teaching pause after an unacknowledged ordinary control:
        # archive keeps no fictitious tick and need not invent the missing queue.
        db.execute('INSERT INTO instructor_commands(session_id,seq,command_id,issued_at,body) VALUES (?,?,?,?,?)', (sid, pause+1, 'pending-control', '2026-10-12T00:00:00+00:00', storage.dumps(dict(command_id='pending-control', type='resume', payload={}))))
        db.execute('INSERT INTO instructor_commands(session_id,seq,command_id,issued_at,body) VALUES (?,?,?,?,?)', (sid, pause+2, 'pending-explanation', '2026-10-12T00:00:01+00:00', storage.dumps(dict(command_id='pending-explanation', type='pause', payload={}))))
        db.execute('INSERT INTO instructor_notes VALUES (?,?,?)', (sid, pause+2, 'Issued before completion; never applied.'))
        # Finish from last accepted state without acknowledging pending commands.
        db.execute("UPDATE sessions SET status='completed' WHERE id=?", (sid,))
    # Existing completed Crew completion won't reconstruct a missing card; obtain
    # authoritative card from immutable accepted events, not pending instructions.
    from server.review import build_review
    from server.main import logged_events, applied_commands
    with storage.connect() as db:
        row = db.execute('SELECT * FROM crews WHERE session_id=?', (sid,)).fetchone()
        review, card = build_review(shared['scenario'], logged_events(db, sid), applied_commands(db, sid), sid, row['tick'], 'completion', 1800)
        db.execute('UPDATE sessions SET scorecard=?,end_tick=1800,execution_tick=?,completed_at=? WHERE id=?', (storage.dumps(card), row['tick'], '2026-10-12T00:01:00+00:00', sid))
    before = snapshot()
    r = c.post('/api/v1/units/local/bundle/export', json={})
    assert r.status_code == 200, r.text
    assert snapshot() == before
    return browser_json(r.json())


def test_teaching_notes_roundtrip_preserves_pending_state_and_score_without_credit(client, annotated_bundle, monkeypatch, tmp_path):
    bundle = annotated_bundle; entry = bundle['payload']['sessions'][0]
    assert len(entry['teaching_notes']) == 2
    assert 'pending_command' not in entry['teaching_notes'][0]
    assert entry['teaching_notes'][1]['pending_command']['command_id'] == 'pending-explanation'
    sid = entry['id']; before = snapshot()
    assert client.post('/api/v1/bundle/import', json=bundle).json()['skipped_sessions'] == 1
    assert snapshot() == before
    monkeypatch.setattr(storage, 'DB_PATH', tmp_path/'notes-recipient.db'); storage.init()
    r = client.post('/api/v1/bundle/import', json=bundle)
    assert r.status_code == 200, r.text
    before = snapshot()
    with storage.connect() as db:
        assert export_notes(db, sid) == entry['teaching_notes']
        pending = db.execute("SELECT * FROM instructor_commands WHERE session_id=? AND command_id='pending-explanation'", (sid,)).fetchone()
        assert pending['tick'] is None and pending['timeline_order'] is None
        assert not db.execute("SELECT 1 FROM instructor_commands WHERE command_id='pending-control'").fetchone()
    assert client.get('/api/v1/sessions/'+sid+'/aar').json()['scorecard'] == entry['scorecard']
    assert client.post('/api/v1/bundle/import', json=bundle).json()['skipped_sessions'] == 1
    forwarded = client.post('/api/v1/units/'+bundle['payload']['unit']['id']+'/bundle/export', json={}).json()
    assert browser_json(forwarded)['payload'] == bundle['payload']
    assert snapshot() == before and beta_state() == ([], [])


@pytest.mark.parametrize('mutation', ['duplicate', 'nonpause', 'unbound', 'control_text', 'blank', 'whitespace', 'extra', 'pending_tick', 'pending_conflict', 'pending_id'])
def test_invalid_signed_teaching_metadata_is_atomic(client, annotated_bundle, mutation):
    p = copy.deepcopy(annotated_bundle['payload']); entry = p['sessions'][0]; notes = entry['teaching_notes']
    if mutation == 'duplicate': notes.insert(0, copy.deepcopy(notes[0]))
    elif mutation == 'nonpause': notes[0]['command_seq'] = 1
    elif mutation == 'unbound': notes[0]['command_seq'] = 99
    elif mutation == 'control_text': notes[0]['text'] = 'bad\x00text'
    elif mutation == 'blank': notes[0]['text'] = ''
    elif mutation == 'whitespace': notes[0]['text'] = ' padded '
    elif mutation == 'extra': notes[0]['issuer_secret'] = 'forbidden'
    elif mutation == 'pending_tick': notes[1]['pending_command']['tick'] = 30
    elif mutation == 'pending_conflict': notes[1]['command_seq'] = notes[0]['command_seq']
    else: notes[1]['pending_command']['command_id'] = entry['commands'][0]['command_id']
    before = snapshot(); r = client.post('/api/v1/bundle/import', json=sign(p, KEY.encode()))
    assert r.status_code == 422, r.text
    assert snapshot() == before


@pytest.mark.parametrize('mutation', ['changed', 'removed', 'pending_issued_at'])
def test_valid_changed_teaching_history_cannot_overwrite_existing_record(client, annotated_bundle, mutation):
    p = copy.deepcopy(annotated_bundle['payload']); notes = p['sessions'][0]['teaching_notes']
    if mutation == 'changed': notes[0]['text'] = 'Different readable explanation'
    elif mutation == 'removed': notes.clear()
    else: notes[1]['pending_command']['issued_at'] = '2026-10-12T01:00:00+00:00'
    before = snapshot(); r = client.post('/api/v1/bundle/import', json=sign(p, KEY.encode()))
    assert r.status_code == 409, r.text
    assert snapshot() == before
