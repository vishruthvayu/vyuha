"""Read-only officer situation pictures reconstructed from accepted inputs.

The time horizon comes from browser telemetry and is explicitly unverified.
Everything drawn inside that horizon is replayed from the issued frozen scenario,
accepted trainee history and applied command history. No score/profile write or
"live truth" assertion based solely on a browser-supplied counter is permitted.

The auth middleware protects this router's complete prefix. Cache entries never
hold mutable Simulation objects and are bounded by count, age and input content.
"""
import copy
import hashlib
import json
import math
import threading
import time
from collections import OrderedDict

from fastapi import APIRouter, HTTPException

from . import storage
from .engine import HZ, replay
from .review import evidence

router = APIRouter(prefix="/api/v1/white-cell", tags=["White Cell"])
CACHE_LIMIT = 128
CACHE_TTL = 20.0
_CACHE = OrderedDict()
_LOCK = threading.RLock()


def clear_cache():
    """Explicit test/process-local invalidation; never modifies training storage."""
    with _LOCK:
        _CACHE.clear()


def _position(value):
    if not isinstance(value, dict):
        return None
    if not all(isinstance(value.get(k), (int, float)) and not isinstance(value[k], bool) and math.isfinite(value[k]) for k in ("x", "z")):
        return None
    return {k: value[k] for k in ("x", "z", "altitude") if k in value and isinstance(value[k], (int, float)) and math.isfinite(value[k])}


def _observations(sim, track):
    """Use the new contract when present; otherwise mask the legacy booleans."""
    observation = track.get("observation")
    if observation is None:
        entries = getattr(sim, "observations", None)
        if isinstance(entries, dict):
            observation = entries.get(track["id"])
        elif isinstance(entries, list):
            observation = next((o for o in entries if o.get("track_id") == track["id"]), None)
    if isinstance(observation, dict) and "eo" in observation and "ir" in observation:
        return copy.deepcopy(observation)
    available = evidence(sim, track)
    position = {k: track[k] for k in ("x", "z", "altitude")}
    return {
        "version": 1, "tick": sim.tick, "track_id": track["id"],
        "radar": {"available": available["radar"]["available"], "state": "confirmed" if track["radar"] else "none", "detected": bool(track["radar"]), "position": copy.deepcopy(position) if track["radar"] else None, "sample_tick": sim.tick if track["radar"] else None},
        "eo": {"available": False, "level": "none", "position": None, "silhouette": None, "sample_tick": None},
        "ir": {"available": True, "level": "recognise" if track["thermal"] else "none", "position": copy.deepcopy(position) if track["thermal"] else None, "silhouette": available["visual"]["silhouette"], "sample_tick": sim.tick if track["thermal"] else None},
        "rf": copy.deepcopy(available["rf"]),
        "iff": {"available": available["rf"]["available"], "cue": available["rf"]["iff"]},
    }


def _sensor_contact(observation, track=None):
    """Render any sensor record without revealing whether it is canonical truth."""
    channels = []
    # Use reported geometry (including radar coasting), never hidden current x/z
    # when a versioned observation channel supplies an older measurement.
    for name in ("radar", "eo", "ir"):
        channel = observation.get(name, {})
        qualifies = channel.get("available", True) and (channel.get("detected") or channel.get("state") in ("tentative", "confirmed") if name == "radar" else channel.get("level", "none") != "none")
        position = _position(channel.get("position"))
        if qualifies and position:
            channels.append({"sensor": name, "position": position, "sample_tick": channel.get("sample_tick"), "state": channel.get("state", channel.get("level"))})
    if not channels:
        return None
    return {
        "id": observation["track_id"], "channels": channels,
        "position": copy.deepcopy(channels[-1]["position"]),
        "evidence": copy.deepcopy(observation),
        "trainee_classification": track.get("classification") if track else None,
        "trainee_identity": track.get("declared") if track else None,
        "designated": track.get("designated") is not None if track else False,
        "responded": bool(track.get("attempts")) if track else False,
    }


def _observed_track(sim, track):
    if not track["active"]:
        return None
    return _sensor_contact(_observations(sim, track), track)


def _build(spec, events, commands, horizon):
    sim = replay(spec, events, horizon, commands)
    spawned = [t for t in sim.tracks if t["spawn"] <= horizon]
    reference = [{
        "id": t["id"], "kind": t["kind"], "identity": t["identity"], "rf_link": t["rf"],
        "position": {k: t[k] for k in ("x", "z", "altitude")}, "active": t["active"],
        "resolved": t["resolved"], "asset_impact": t["impact"],
        "trainee_classification": t.get("classification"), "trainee_identity": t.get("declared"),
    } for t in spawned]
    observed = [o for t in spawned if (o := _observed_track(sim, t)) is not None]
    # Tentative sensor-only returns belong in the observed picture. Do not expose
    # a truth flag, false-return label, reference identity or scoring target.
    observed.extend(o for sensed in getattr(sim, "false_contacts", [])
                    if (o := _sensor_contact(sensed)) is not None)
    alerts = []
    observed_ids = {t["id"] for t in observed}
    for track in spawned:
        if not track["active"]:
            continue
        if track.get("declared") == "hostile" and track["identity"] != "hostile":
            alerts.append({"code": "NON_HOSTILE_DECLARED_HOSTILE", "track_id": track["id"], "scope": "instructor_reference", "message": "Reference non-hostile contact was declared hostile."})
        # Heuristic warning, labelled as such; not an alternate scoring rule.
        if track["identity"] == "hostile" and track.get("designated") is None and track["speed"] > 0:
            estimate = max(0, math.hypot(track["x"], track["z"]) - 8) / track["speed"]
            if estimate < 10:
                alerts.append({"code": "UNDESIGNATED_NEAR_ASSET", "track_id": track["id"], "scope": "instructor_reference", "message": "Undesignated reference threat is near the asset; radial time estimate under ten seconds.", "estimate_seconds": round(estimate, 2), "trainee_currently_observed": track["id"] in observed_ids})
    return {
        "reference": {"label": "Instructor reference truth — reconstructed", "tracks": reference},
        "observed": {"label": "Current reconstructed sensor evidence — excludes presentation hold", "tracks": observed},
        "progress": {"spawned": len(spawned), "active": sum(bool(t["active"]) for t in spawned), "first_detected": sum(t["detected"] is not None for t in spawned), "designated": sum(t["designated"] is not None for t in spawned), "classified": sum(t.get("classification") is not None for t in spawned), "responded": sum(bool(t.get("attempts")) for t in spawned), "resolved": sum(bool(t["resolved"]) for t in spawned), "impacts": sum(bool(t["impact"]) for t in spawned)},
        "alerts": alerts,
        "sensor_state": {"radar": sim.radar_status, "rf_available": sim.rf_available, "night": sim.night, "paused_by_applied_command": sim.paused},
    }


def picture(db, session_id):
    from .main import applied_commands, instructor_session, logged_events, session_record
    row = session_record(db, session_id)
    if row["status"] != "active":
        raise HTTPException(409, "White Cell live pictures are available for active sessions only; open the completed AAR instead")
    spec = json.loads(row["spec"])
    telemetry = json.loads(row["control_state"]) if row["control_state"] else None
    events, commands = logged_events(db, session_id), applied_commands(db, session_id)
    horizon = telemetry["tick"] if telemetry else max((e["tick"] for e in events + commands), default=0)
    if isinstance(horizon, bool) or not isinstance(horizon, int) or not 0 <= horizon <= round(spec["duration"] * HZ):
        raise HTTPException(422, "White Cell horizon exceeds the frozen exercise duration")
    # A newer event batch can arrive before its next telemetry POST. Replay only
    # the last observed horizon, and explicitly count newer accepted inputs.
    pending_events = sum(e["tick"] > horizon for e in events)
    pending_commands = sum(c["tick"] > horizon for c in commands)
    current_events = [e for e in events if e["tick"] <= horizon]
    current_commands = [c for c in commands if c["tick"] <= horizon]
    fingerprint = hashlib.sha256(storage.dumps({"spec": spec, "events": events, "commands": commands, "horizon": horizon}).encode()).hexdigest()
    key = (str(storage.DB_PATH.resolve()), session_id)
    now = time.monotonic()
    with _LOCK:
        for cache_key, entry in list(_CACHE.items()):
            if now - entry[0] > CACHE_TTL:
                del _CACHE[cache_key]
        entry = _CACHE.get(key)
        cached = bool(entry and entry[1] == fingerprint)
        if cached:
            _CACHE.move_to_end(key)
            body = copy.deepcopy(entry[2])
        else:
            try:
                body = _build(spec, current_events, current_commands, horizon)
            except (ValueError, KeyError, TypeError, OverflowError) as error:
                raise HTTPException(422, "Accepted inputs cannot be reconstructed for this White Cell horizon: " + str(error)[:160]) from error
            _CACHE[key] = (now, fingerprint, copy.deepcopy(body))
            _CACHE.move_to_end(key)
            while len(_CACHE) > CACHE_LIMIT:
                _CACHE.popitem(last=False)
    metadata = instructor_session(db, session_id)
    return {
        "schema_version": 1, "session_id": session_id, "trainee": row["trainee"],
        "callsign": metadata["callsign"], "unit_id": row["unit_id"], "exercise_group_id": row["exercise_group_id"],
        "status": metadata["status"], "last_seen": row["last_seen"],
        "scenario": {"id": spec["id"], "title": spec["title"], "duration_seconds": spec["duration"], "engine_version": spec.get("engine_version", "released-v1.0.1-legacy"), "world_scale_m": spec.get("world_scale_m")},
        "telemetry": {"assurance": "Client-reported counters and horizon; not independently verified wall time", "state": telemetry},
        "reconstruction": {"horizon_tick": horizon, "hz": HZ, "horizon_source": "client_control_state" if telemetry else "last_accepted_input", "assurance": "Reconstructed frozen scenario, accepted trainee actions and applied instructor commands through reported horizon", "input_fingerprint": fingerprint, "cached": cached, "newer_accepted_events": pending_events, "newer_applied_commands": pending_commands},
        **body,
    }


@router.get("")
def pictures():
    with storage.connect() as db:
        db.execute("BEGIN")
        sessions = db.execute("SELECT id FROM sessions WHERE status='active' ORDER BY created_at DESC LIMIT 100").fetchall()
        output = []
        for row in sessions:
            try:
                output.append(picture(db, row["id"]))
            except HTTPException as error:
                if error.status_code != 422:
                    raise
                output.append({"schema_version": 1, "session_id": row["id"], "status": "RECONSTRUCTION_UNAVAILABLE", "error": error.detail})
        return {"schema_version": 1, "pictures": output, "limit": 100}


@router.get("/{session_id}")
def selected_picture(session_id: str):
    with storage.connect() as db:
        db.execute("BEGIN")
        return picture(db, session_id)
