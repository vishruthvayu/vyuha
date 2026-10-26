"""Synthetic post-exercise reasoning contracts, not participant learning data."""
import hashlib
import json

import pytest

from server import learning_investigation as inquiry, main, storage
from server.durability import backup, restore
from server.tests.test_api import client
from server.tests.test_hardening import KEY
from server.tests.test_learning import finished, joined, launch, prepared


def path(sid):
    return f'/api/v1/learning/sessions/{sid}/investigation'


def complete(client, mode='practice'):
    tid = joined(client)
    prep = prepared(client, tid, mode, **({'form': 'baseline-a'} if mode == 'assessment' else {}))
    sid, review = finished(client, prep, tid)
    body = dict(request_id='investigation-start-01', trainee=tid,
                review_hash=review['learning']['evidence']['original_review_hash'])
    return tid, sid, review, body


def start(client, sid, body):
    result = client.post(path(sid) + '/start', json=body)
    assert result.status_code == 201, result.text
    return result.json()


def answer_body(body, mission, index=0, choice='supported'):
    return dict(body, request_id=f'answer-request-{index:02d}', mission_id=mission['mission_id'],
                question_id=mission['questions'][index]['id'], choice=choice)


def original_rows():
    with storage.connect() as db:
        tables = [r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
                  if not r[0].startswith('learning_investigation')]
        return {name: [tuple(r) for r in db.execute(f'SELECT * FROM "{name}" ORDER BY rowid')] for name in tables}


@pytest.mark.parametrize('mode', ['practice', 'assessment'])
def test_report_bound_answers_leave_all_original_history_and_profiles_unchanged(client, mode):
    tid, sid, review, body = complete(client, mode)
    before = original_rows()
    client.headers.clear()  # Explicit existing trusted-LAN identity, not a new authentication claim.
    assert client.get(path(sid), params={'trainee': tid}).status_code == 404
    mission = start(client, sid, body)
    assert 2 <= len(mission['questions']) <= 4 and mission['answers'] == []
    by_id = {r['decision_id']: r for r in review['decision_reviews']}
    for q in mission['questions']:
        report = by_id[q['decision_id']]['evidence']
        assert q['tick'] == report['tick'] == q['evidence']['tick']
        assert set(q['evidence']) == {'tick', 'radar', 'rf', 'visual', 'range_m', 'night'}
        assert q['evidence'] == {k: report[k] for k in q['evidence']}
        assert 'expected_choice' not in q and 'explanation' not in q
    for i, q in enumerate(mission['questions']):
        result = client.post(path(sid) + '/answers', json=answer_body(body, mission, i))
        assert result.status_code == 201, result.text
        returned = result.json()
        assert len(returned['answers']) == i + 1
        assert len({a['question_id'] for a in returned['answers']}) == i + 1
        assert all('explanation' in a for a in returned['answers'])
    assert client.get(path(sid), params={'trainee': tid}).json() == returned
    assert original_rows() == before
    assert client.get(f'/api/v1/sessions/{sid}/aar').json() == review
    assert 'not active evidence acquisition' in returned['note']


def test_retries_lost_ack_request_reuse_and_first_answer_are_immutable(client):
    tid, sid, _, body = complete(client)
    mission = start(client, sid, body)
    assert start(client, sid, body) == mission
    assert start(client, sid, dict(body, request_id='another-start-id')) == mission
    req = answer_body(body, mission)
    saved = client.post(path(sid) + '/answers', json=req)
    assert saved.status_code == 201, saved.text
    assert client.post(path(sid) + '/answers', json=req).json() == saved.json()
    assert client.get(path(sid), params={'trainee': tid}).json() == saved.json()
    assert client.post(path(sid) + '/answers', json=dict(req, request_id='same-choice-new-id')).json() == saved.json()
    for changed in [dict(req, choice='not_established'),
                    dict(req, request_id='changed-answer-new-id', choice='not_established'),
                    dict(req, question_id=mission['questions'][1]['id'])]:
        assert client.post(path(sid) + '/answers', json=changed).status_code == 409
    assert client.post(path(sid) + '/start', json=dict(body, request_id=req['request_id'])).status_code == 409
    assert client.get(path(sid), params={'trainee': tid}).json() == saved.json()


def test_owner_pending_nonlearning_and_shared_crew_rejected_before_reconstruction(client, monkeypatch):
    tid, sid, _, body = complete(client)
    other = joined(client, 'OTHER')
    def forbidden(*args, **kwargs):
        raise AssertionError('Ineligible requests must not reconstruct reports')
    monkeypatch.setattr(main, 'aar', forbidden)
    assert client.post(path(sid) + '/start', json=dict(body, trainee=other)).status_code == 404
    assert client.get(path(sid), params={'trainee': other}).status_code == 404
    prep = prepared(client, tid, rid='another-preparation')
    active = launch(client, prep, tid)
    assert client.post(path(active) + '/start', json=body).status_code == 409
    spec = client.post('/api/v1/scenarios/generate', json={}).json()
    ordinary = client.post('/api/v1/sessions', json={'scenario_id': spec['id'], 'trainee': tid}).json()['id']
    assert client.post(path(ordinary) + '/start', json=body).status_code == 404
    spec = client.post('/api/v1/raids', json=dict(name='Inquiry isolation', duration=60, seed=62,
        difficulty='foundational', family='DIRECT', terrain='rural')).json()
    crew = client.post('/api/v1/crews', json=dict(name='Inquiry isolation', scenario_id=spec['id'],
        members=[dict(callsign='WATCH', role='spotter'), dict(callsign='RESP', role='responder')]))
    assert crew.status_code == 201, crew.text
    crew_sid = crew.json()['session_id']
    with storage.connect() as db:
        owner = db.execute('SELECT trainee FROM sessions WHERE id=?', (crew_sid,)).fetchone()[0]
    assert client.post(path(crew_sid) + '/start', json=dict(body, trainee=owner)).status_code == 422
    with storage.connect() as db:
        assert db.execute('SELECT COUNT(*) FROM learning_investigations').fetchone()[0] == 0


def test_mission_and_feedback_are_frozen_and_hash_tampering_fails_closed(client, monkeypatch):
    tid, sid, _, body = complete(client)
    mission = start(client, sid, body)
    def forbidden(*args, **kwargs):
        raise AssertionError('Stored missions must not reconstruct or reinterpret their prompt policy')
    monkeypatch.setattr(main, 'aar', forbidden)
    monkeypatch.setattr(inquiry, 'build_questions', forbidden)
    assert start(client, sid, dict(body, request_id='frozen-prompt-policy')) == mission
    result = client.post(path(sid) + '/answers', json=answer_body(body, mission))
    assert result.status_code == 201
    with storage.connect() as db:
        db.execute("UPDATE learning_investigations SET spec=spec || ' '")
    assert client.get(path(sid), params={'trainee': tid}).status_code == 409
    assert client.post(path(sid) + '/start', json=body).status_code == 409
    assert client.post(path(sid) + '/answers', json=answer_body(body, mission, 1)).status_code == 409


def test_wrong_hash_mission_question_unknown_versions_and_shape_fail_closed(client):
    tid, sid, _, body = complete(client)
    assert client.post(path(sid) + '/start', json=dict(body, review_hash='0'*64)).status_code == 409
    for extra in [{'version': 'v0.5'}, {'score': 100}, {'request_id': 'short'}, {'trainee': 'bad\nheader'}]:
        assert client.post(path(sid) + '/start', json=dict(body, **extra)).status_code == 422
    mission = start(client, sid, body)
    req = answer_body(body, mission)
    for extra, code in [({'review_hash': '0'*64}, 409), ({'mission_id': 'unknown'}, 404),
                        ({'question_id': 'unknown'}, 404), ({'choice': 'hostile'}, 422),
                        ({'matches_report': True}, 422)]:
        assert client.post(path(sid) + '/answers', json=dict(req, **extra)).status_code == code
    with storage.connect() as db:
        db.execute("UPDATE learning_investigations SET version='future-v2'")
    assert client.get(path(sid), params={'trainee': tid}).status_code == 409


def test_question_rules_preserve_absence_unavailability_shape_and_no_reply_limits():
    ev = dict(tick=30, radar=dict(available=True, state='normal', detected=True),
              rf=dict(available=True, signal=True, iff='no_reply'),
              visual=dict(available=True, silhouette='multirotor'), range_m=500., night=False,
              prior_identity='hostile', ground_truth='DO-NOT-COPY')
    decision = dict(decision_id='D1', track_id='T1', tick=35, order=7, evidence=ev)
    questions = inquiry.build_questions([decision])
    assert any(q['expected_choice'] == 'supported' for q in questions)
    assert any(q['concept'] == 'iff_hostility' and q['expected_choice'] == 'not_established' for q in questions)
    assert any(q['concept'] == 'multirotor_type' and q['expected_choice'] == 'not_established' for q in questions)
    assert all(q['order'] is None and q['tick'] == 30 for q in questions)
    assert 'DO-NOT-COPY' not in json.dumps(questions) and 'prior_identity' not in json.dumps(questions)
    unavailable = dict(ev, radar=dict(available=False, state='failed', detected=False),
                       rf=dict(available=False, signal=None, iff='unavailable'),
                       visual=dict(available=False, silhouette=None))
    assert all(q['expected_choice'] == 'not_established' for q in inquiry.build_questions([dict(decision, evidence=unavailable)]))
    with pytest.raises(Exception) as error:
        inquiry.build_questions([])
    assert error.value.status_code == 422


def test_backup_restore_keeps_frozen_mission_ordinary_transfer_omits_annotations(client, monkeypatch, tmp_path):
    tid, sid, review, body = complete(client)
    mission = start(client, sid, body)
    saved = client.post(path(sid) + '/answers', json=answer_body(body, mission)).json()
    snapshot = backup(storage.DB_PATH, tmp_path/'investigation-backup.db')
    restored = restore(snapshot, tmp_path/'investigation-restored.db')
    monkeypatch.setattr(storage, 'DB_PATH', restored)
    storage.init()
    assert client.get(path(sid), params={'trainee': tid}).json() == saved
    assert client.get(f'/api/v1/sessions/{sid}/aar').json() == review
    monkeypatch.setenv('VYUHA_BUNDLE_SECRET', KEY)
    exported = client.post('/api/v1/units/local/bundle/export', json={})
    assert exported.status_code == 200, exported.text
    bundle = exported.json()
    assert mission['mission_id'] not in json.dumps(bundle)
    assert 'learning_investigations' not in json.dumps(bundle)
    monkeypatch.setattr(storage, 'DB_PATH', tmp_path/'recipient.db')
    storage.init()
    imported = client.post('/api/v1/bundle/import', json=bundle)
    assert imported.status_code == 200, imported.text
    imported_tid = bundle['payload']['sessions'][0]['trainee']
    assert client.get(path(sid), params={'trainee': imported_tid}).status_code == 404
    assert client.get(f'/api/v1/sessions/{sid}/aar').json()['scorecard'] == review['scorecard']


def test_corrupt_reconstructed_review_cannot_freeze_new_mission(client, monkeypatch):
    _, sid, review, body = complete(client)
    review['decision_reviews'][0]['evidence']['rf']['signal'] = None
    monkeypatch.setattr(main, 'aar', lambda *_: review)
    assert client.post(path(sid) + '/start', json=body).status_code == 409
    with storage.connect() as db:
        assert db.execute('SELECT COUNT(*) FROM learning_investigations').fetchone()[0] == 0


def test_officer_get_is_authenticated_read_only_and_does_not_start_a_missing_mission(client):
    tid, sid, _, body = complete(client)
    url = f'/api/v1/instructor/sessions/{sid}/investigation'
    auth = client.headers['Authorization']
    assert client.get(url).status_code == 404
    with storage.connect() as db:
        assert db.execute('SELECT COUNT(*) FROM learning_investigations').fetchone()[0] == 0
    mission = start(client, sid, body)
    saved = client.post(path(sid) + '/answers', json=answer_body(body, mission)).json()
    before = original_rows()
    assert client.get(url).json() == saved
    assert client.post(url, json=answer_body(body, mission, 1)).status_code == 405
    client.headers.clear()
    assert client.get(url).status_code == 401
    client.headers['Authorization'] = 'Bearer invalid-token'
    assert client.get(url).status_code == 401
    client.headers['Authorization'] = auth
    assert client.get(url).json() == saved
    assert original_rows() == before
    with storage.connect() as db:
        assert db.execute('SELECT COUNT(*) FROM learning_investigation_answers').fetchone()[0] == 1
