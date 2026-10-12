import copy
import json
from types import SimpleNamespace

import pytest

from server import storage, white_cell
from server.engine import Simulation, make_scenario, replay
from server.tests.test_api import client


@pytest.fixture(autouse=True)
def fresh_picture_cache():
    white_cell.clear_cache()
    yield
    white_cell.clear_cache()


def active_session(client, trainee="WHITE-01", *, distance=20, kind="quad", identity="hostile"):
    spec = client.post("/api/v1/scenarios/generate", json={"trainee": trainee, "night": False, "seed": sum(ord(c) for c in trainee + kind + identity) + round(distance * 100)}).json()
    spec["tracks"] = [dict(id="T1", kind=kind, identity=identity, rf=kind == "quad", spawn=0, bearing=30, distance=distance, speed=0.5, altitude=20)]
    with storage.connect() as db:
        db.execute("UPDATE scenarios SET spec=? WHERE id=?", (storage.dumps(spec), spec["id"]))
    sid = client.post("/api/v1/sessions", json={"scenario_id": spec["id"], "trainee": trainee}).json()["id"]
    return spec, sid


def report(client, sid, sim, *, applied=None):
    response = client.post("/api/v1/sessions/" + sid + "/control-state", json={"tick": sim.tick, "paused": sim.paused, "active_contacts": sum(t["active"] for t in sim.tracks), "radar_status": sim.radar_status, "rf_available": sim.rf_available, "night": sim.night, "applied": applied or []})
    assert response.status_code == 200, response.text


def snapshot_database():
    with storage.connect() as db:
        tables = [r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
        return {name: [tuple(r) for r in db.execute('SELECT * FROM "' + name + '" ORDER BY rowid')] for name in tables}


def test_white_cell_requires_server_officer_auth_not_a_ui_only_gate(client):
    _, sid = active_session(client)
    token = client.headers.pop("Authorization")
    assert client.get("/api/v1/white-cell").status_code == 401
    assert client.get("/api/v1/white-cell/" + sid).status_code == 401
    client.headers["Authorization"] = token
    assert client.get("/api/v1/white-cell").status_code == 200


def test_reference_and_observed_are_separate_and_hidden_contact_has_no_observed_geometry(client):
    spec, sid = active_session(client, distance=300)
    report(client, sid, Simulation(spec))
    response = client.get("/api/v1/white-cell/" + sid)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["reference"]["tracks"][0]["identity"] == "hostile"
    assert body["reference"]["tracks"][0]["kind"] == "quad"
    assert body["observed"]["tracks"] == []
    assert body["reconstruction"]["horizon_tick"] == 0
    assert body["reconstruction"]["horizon_source"] == "client_control_state"
    assert "Client-reported" in body["telemetry"]["assurance"]


def test_observed_contact_has_only_cues_and_trainee_declarations_not_reference_identity(client):
    spec, sid = active_session(client)
    report(client, sid, Simulation(spec))
    observed = client.get("/api/v1/white-cell/" + sid).json()["observed"]["tracks"][0]
    assert "kind" not in observed and "identity" not in observed and "rf_link" not in observed
    assert observed["trainee_classification"] is None and observed["trainee_identity"] is None
    assert observed["channels"]
    assert observed["evidence"]["ir"]["silhouette"] == "multirotor"
    assert "kind" not in observed["evidence"] and "identity" not in observed["evidence"]


def test_observed_versioned_radar_uses_reported_coasted_position_not_hidden_current_truth():
    reported = dict(x=10, z=700, altitude=20)
    observation = dict(version="sensor-v2", tick=70, track_id="T1", radar=dict(available=True, detected=True, position=reported, sample_tick=60, state="confirmed"), eo=dict(available=False, level="none", position=None), ir=dict(available=True, level="none", position=None), rf=dict(available=True, detected=False), iff=dict(available=True, cue="no_reply"))
    track = dict(id="T1", active=True, x=999, z=999, altitude=50, kind="fiber_fpv", identity="hostile", classification=None, declared=None, designated=None, attempts=[], observation=observation)
    original = copy.deepcopy(track)
    result = white_cell._observed_track(SimpleNamespace(tick=70), track)
    assert result["position"] == reported and result["position"]["x"] != track["x"]
    assert result["channels"][0]["sample_tick"] == 60
    assert "kind" not in result and "identity" not in result
    assert track == original


def test_session_specific_replay_and_cache_cannot_cross_trainee_boundaries(client):
    a, sid_a = active_session(client, "WHITE-A", distance=25)
    b, sid_b = active_session(client, "WHITE-B", distance=65, kind="bird", identity="neutral")
    report(client, sid_a, Simulation(a)); report(client, sid_b, Simulation(b))
    entries = client.get("/api/v1/white-cell").json()["pictures"]
    assert {p["session_id"] for p in entries} == {sid_a, sid_b}
    lookup = {p["session_id"]: p for p in entries}
    assert lookup[sid_a]["trainee"] == "WHITE-A" and lookup[sid_b]["trainee"] == "WHITE-B"
    assert lookup[sid_a]["reference"]["tracks"][0]["kind"] == "quad"
    assert lookup[sid_b]["reference"]["tracks"][0]["kind"] == "bird"
    assert lookup[sid_a]["reference"]["tracks"][0]["position"] != lookup[sid_b]["reference"]["tracks"][0]["position"]


def test_same_tick_new_accepted_actions_invalidate_picture_and_do_not_duplicate_history(client):
    spec, sid = active_session(client)
    report(client, sid, Simulation(spec))
    first = client.get("/api/v1/white-cell/" + sid).json()
    again = client.get("/api/v1/white-cell/" + sid).json()
    assert again["reconstruction"]["cached"]
    events = [dict(tick=0, order=0, k="designate", track="T1"), dict(tick=0, order=1, k="classify", track="T1", kind="quad", identity="hostile")]
    assert client.post("/api/v1/sessions/" + sid + "/events", json={"seq": 0, "events": events}).status_code == 200
    second = client.get("/api/v1/white-cell/" + sid).json()
    assert not second["reconstruction"]["cached"]
    assert second["reconstruction"]["input_fingerprint"] != first["reconstruction"]["input_fingerprint"]
    assert second["progress"]["designated"] == 1 and second["progress"]["classified"] == 1
    assert second["observed"]["tracks"][0]["trainee_classification"] == "quad"


def test_newer_inputs_are_counted_but_not_replayed_past_last_reported_horizon(client):
    spec, sid = active_session(client)
    report(client, sid, Simulation(spec))
    actions = [dict(tick=10, order=0, k="designate", track="T1")]
    assert client.post("/api/v1/sessions/" + sid + "/events", json={"seq": 0, "events": actions}).status_code == 200
    before = client.get("/api/v1/white-cell/" + sid).json()
    assert before["reconstruction"]["horizon_tick"] == 0
    assert before["reconstruction"]["newer_accepted_events"] == 1
    assert before["progress"]["designated"] == 0
    report(client, sid, replay(spec, actions, 10))
    after = client.get("/api/v1/white-cell/" + sid).json()
    assert after["reconstruction"]["horizon_tick"] == 10
    assert after["reconstruction"]["newer_accepted_events"] == 0
    assert after["progress"]["designated"] == 1


def test_applied_command_reconstruction_invalidates_cache_and_never_uses_unapplied_receipt(client):
    spec, sid = active_session(client)
    sim = Simulation(spec); report(client, sid, sim)
    original = client.get("/api/v1/white-cell/" + sid).json()
    response = client.post("/api/v1/instructor/sessions/" + sid + "/commands", json={"command_id": "white-fault-01", "type": "sensor_fault", "payload": {"sensor": "rf", "mode": "failed"}})
    assert response.status_code == 200
    command = response.json()["command"]
    pending = client.get("/api/v1/white-cell/" + sid).json()
    assert pending["sensor_state"]["rf_available"] is True
    assert sim.control({**command, "tick": 0, "order": 0})
    report(client, sid, sim, applied=[dict(seq=command["seq"], tick=0, order=0)])
    applied = client.get("/api/v1/white-cell/" + sid).json()
    assert applied["sensor_state"]["rf_available"] is False
    assert applied["reconstruction"]["input_fingerprint"] != original["reconstruction"]["input_fingerprint"]


def test_completed_history_is_excluded_and_picture_endpoints_never_write_scores_or_profiles(client):
    spec, sid = active_session(client)
    report(client, sid, Simulation(spec))
    before = snapshot_database()
    for _ in range(3):
        assert client.get("/api/v1/white-cell").status_code == 200
        assert client.get("/api/v1/white-cell/" + sid).status_code == 200
    assert snapshot_database() == before
    assert client.post("/api/v1/sessions/" + sid + "/complete", json={"execution_tick": 0}).status_code == 200
    history = snapshot_database()
    assert client.get("/api/v1/white-cell/" + sid).status_code == 409
    assert client.get("/api/v1/white-cell").json()["pictures"] == []
    assert snapshot_database() == history


def test_cache_returns_defensive_copies_and_has_bounded_size_and_ttl(client, monkeypatch):
    monkeypatch.setattr(white_cell, "CACHE_LIMIT", 2)
    for i in range(3):
        spec, sid = active_session(client, "BOUND-" + str(i))
        report(client, sid, Simulation(spec))
        assert client.get("/api/v1/white-cell/" + sid).status_code == 200
    assert len(white_cell._CACHE) == 2
    with storage.connect() as db:
        body = white_cell.picture(db, sid)
        body["reference"]["tracks"][0]["kind"] = "MUTATED_RETURN"
        assert white_cell.picture(db, sid)["reference"]["tracks"][0]["kind"] == "quad"
    monkeypatch.setattr(white_cell, "CACHE_TTL", -1)
    assert not client.get("/api/v1/white-cell/" + sid).json()["reconstruction"]["cached"]


def test_cache_is_keyed_by_database_identity(client, monkeypatch, tmp_path):
    spec, sid = active_session(client)
    report(client, sid, Simulation(spec))
    assert client.get("/api/v1/white-cell/" + sid).status_code == 200
    first = storage.DB_PATH
    alternate = tmp_path / "alternate.db"
    from server.durability import backup
    backup(first, alternate)
    monkeypatch.setattr(storage, "DB_PATH", alternate)
    with storage.connect() as db:
        assert not white_cell.picture(db, sid)["reconstruction"]["cached"]
    assert len(white_cell._CACHE) == 2


def test_impossible_accepted_actions_fail_explicitly_and_do_not_poison_other_pictures(client):
    spec, sid = active_session(client)
    _, good = active_session(client, "VALID-OTHER")
    report(client, sid, Simulation(spec))
    assert client.post("/api/v1/sessions/" + sid + "/events", json={"seq": 0, "events": [dict(tick=0, k="designate", track="T9")]}).status_code == 200
    response = client.get("/api/v1/white-cell/" + sid)
    assert response.status_code == 422 and "reconstruct" in response.text
    entries = client.get("/api/v1/white-cell").json()["pictures"]
    lookup = {p["session_id"]: p for p in entries}
    assert lookup[sid]["status"] == "RECONSTRUCTION_UNAVAILABLE"
    assert "reference" in lookup[good]


def test_invalid_telemetry_horizon_and_unknown_engine_fail_closed(client):
    spec, sid = active_session(client)
    report(client, sid, Simulation(spec))
    with storage.connect() as db:
        state = json.loads(db.execute("SELECT control_state FROM sessions WHERE id=?", (sid,)).fetchone()[0]); state["tick"] = 999999
        db.execute("UPDATE sessions SET control_state=? WHERE id=?", (storage.dumps(state), sid))
    assert client.get("/api/v1/white-cell/" + sid).status_code == 422
    with storage.connect() as db:
        state["tick"] = 0; db.execute("UPDATE sessions SET control_state=? WHERE id=?", (storage.dumps(state), sid))
        spec["engine_version"] = "UNKNOWN-FUTURE"; db.execute("UPDATE scenarios SET spec=? WHERE id=?", (storage.dumps(spec), spec["id"]))
    assert client.get("/api/v1/white-cell/" + sid).status_code == 422


def test_tentative_sensor_only_returns_are_observed_without_reference_truth_or_score_targets(monkeypatch):
    sensed = dict(track_id="C1-0", tick=90, radar=dict(available=True, state="tentative", detected=False, position=dict(x=80, z=900), sample_tick=60))
    sim = SimpleNamespace(tracks=[], false_contacts=[sensed], radar_status="normal", rf_available=True, night=False, paused=False)
    monkeypatch.setattr(white_cell, "replay", lambda *_: sim)
    before = copy.deepcopy(sensed)
    picture = white_cell._build({}, [], [], 90)
    assert picture["reference"]["tracks"] == []
    assert picture["progress"]["spawned"] == 0
    assert len(picture["observed"]["tracks"]) == 1
    observed = picture["observed"]["tracks"][0]
    assert observed["position"] == sensed["radar"]["position"]
    assert observed["channels"][0]["state"] == "tentative"
    assert not {"kind", "identity", "false_return", "is_false", "reference"} & observed.keys()
    assert observed["trainee_identity"] is None and observed["trainee_classification"] is None
    assert sensed == before


def test_versioned_raid_picture_replays_real_sensor_contract_and_preserves_storage(client):
    response = client.post('/api/v1/raids', json=dict(seed=62, family='DIRECT', duration=90, difficulty='foundational'))
    assert response.status_code == 201, response.text
    spec = response.json()
    sid = client.post('/api/v1/sessions', json=dict(scenario_id=spec['id'], trainee='WHITE-V2')).json()['id']
    horizon = min(t['spawn'] for t in spec['tracks']) + 90
    sim = replay(spec, [], horizon)
    report(client, sid, sim)
    before = snapshot_database()
    result = client.get('/api/v1/white-cell/' + sid)
    assert result.status_code == 200, result.text
    body = result.json()
    assert body['scenario']['engine_version'] == 'vyuha-0.4.0'
    assert len(body['reference']['tracks']) == sum(t['spawn'] <= horizon for t in sim.tracks)
    assert body['observed']['tracks']
    sources = {t['id']: t['observation'] for t in sim.tracks}
    sources.update({o['track_id']: o for o in sim.false_contacts})
    for contact in body['observed']['tracks']:
        assert not {'identity', 'kind', 'false_return'} & contact.keys()
        for channel in contact['channels']:
            assert channel['position'] == sources[contact['id']][channel['sensor']]['position']
    assert snapshot_database() == before
