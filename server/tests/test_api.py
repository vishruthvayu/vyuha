import pytest
from fastapi.testclient import TestClient
from server import storage
from server.main import app
from server.engine import Simulation, ideal, score, civil


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(storage, "DB_PATH", tmp_path / "sessions.db")
    with TestClient(app) as client:
        yield client


def session(client):
    spec = client.post("/api/v1/scenarios/generate", json={}).json()
    sid = client.post("/api/v1/sessions", json={"scenario_id": spec["id"]}).json()["id"]
    return spec, sid


def expert(spec):
    sim = Simulation(spec)
    while sim.tick < 2250:
        for t in sim.tracks:
            if not t["active"] or t["detected"] is None:
                continue
            if t["designated"] is None:
                sim.act(dict(tick=sim.tick, k="designate", track=t["id"]))
                sim.act(dict(tick=sim.tick, k="classify", track=t["id"], kind=t["kind"], identity=t["identity"]))
            effector = ideal(t)
            if "hold" in t["attempts"] or (effector == "kinetic" and civil(t)):
                continue
            sim.act(dict(tick=sim.tick, k="engage", track=t["id"], effector=effector))
        sim.step()
    return sim


def test_full_session_is_verified_and_persists(client):
    spec, sid = session(client)
    sim = expert(spec)
    assert score(sim)["score"] == 100
    assert client.post(f"/api/v1/sessions/{sid}/events", json={"seq": 0, "events": sim.events}).status_code == 200
    result = client.post(f"/api/v1/sessions/{sid}/complete", json={"end_tick": 2250})
    assert result.status_code == 200
    assert result.json() == score(sim)
    assert client.get(f"/api/v1/sessions/{sid}/aar").json()["verified"]
    assert len(client.get("/api/v1/units/local/dashboard").json()["sessions"]) == 1
    assert client.get("/api/v1/trainees/CADET-01/profile").json()["sessions"] == 1
    assert client.post(f"/api/v1/sessions/{sid}/complete", json={}).json() == score(sim)


def test_duplicate_batches_are_idempotent_but_mutations_rejected(client):
    _, sid = session(client)
    body = {"seq": 0, "events": []}
    assert not client.post(f"/api/v1/sessions/{sid}/events", json=body).json()["duplicate"]
    assert client.post(f"/api/v1/sessions/{sid}/events", json=body).json()["duplicate"]
    body["events"] = [dict(tick=10, k="designate", track="T1")]
    assert client.post(f"/api/v1/sessions/{sid}/events", json=body).status_code == 409


def test_pre_spawn_action_and_forged_telemetry_are_rejected(client):
    _, sid = session(client)
    assert client.post(f"/api/v1/sessions/{sid}/events", json={"seq": 0, "events": [dict(tick=0, k="designate", track="T5")]}).status_code == 200
    assert client.post(f"/api/v1/sessions/{sid}/complete", json={}).status_code == 422
    assert client.post(f"/api/v1/sessions/{sid}/events", json={"seq": 1, "events": [dict(tick=1, k="designate", track="T1", score=100)]}).status_code == 422


def test_missing_batches_and_early_completion_are_rejected(client):
    _, sid = session(client)
    client.post(f"/api/v1/sessions/{sid}/events", json={"seq": 1, "events": []})
    assert client.post(f"/api/v1/sessions/{sid}/complete", json={}).status_code == 409
    assert client.post(f"/api/v1/sessions/{sid}/complete", json={"end_tick": 10}).status_code == 422


def test_unplayed_session_scores_zero(client):
    _, sid = session(client)
    result = client.post(f"/api/v1/sessions/{sid}/complete", json={}).json()
    assert result["score"] == 0
    assert result["leakers"] > 0
