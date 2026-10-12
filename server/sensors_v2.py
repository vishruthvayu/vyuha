"""Deterministic v0.4 training sensors; no operational calibration claim.

Shared assumptions/references live in config/sensors-v2.json. Observations are a
separate contract: canonical kind, affiliation and RF-link truth never appear in
them. Radar position coasts from its last paint, not current hidden coordinates.
EO/IR have no observation hold; rendering may separately hold frozen samples.
"""
import copy
import json
import math
from pathlib import Path

SPEC = json.loads((Path(__file__).parent / "config/sensors-v2.json").read_text())
VERSION = SPEC["version"]
DEFAULT_CONFIG = SPEC["parameters"]
RCS_DB = {"bird": -25, "fiber_fpv": -20, "quad": -15, "fixed_wing": -10, "loitering": -8, "loitering_munition": -8}
SIGNATURE_M = {"bird": .35, "fiber_fpv": .45, "quad": .6, "fixed_wing": 1.5, "loitering": 1.5, "loitering_munition": 1.5}
BOUNDS = {
    "radar_reference_range_m": (100, 10000), "radar_reference_rcs_db": (-60, 20),
    "radar_reference_snr": (0, 10000), "radar_max_range_m": (100, 20000), "radar_pfa": (1e-9, .01),
    "radar_reliability": (0, 1), "radar_jam_factor": (0, 1), "radar_occlusion_factor": (0, 1),
    "radar_confirm_hits": (1, 8), "radar_window_sweeps": (1, 8), "radar_loss_sweeps": (1, 8),
    "radar_sweep_ticks": (3, 90), "rcs_spread_db": (0, 12),
    "eo_ifov_rad": (1e-6, .01), "ir_ifov_rad": (1e-6, .01),
    "eo_max_range_m": (50, 10000), "ir_max_range_m": (50, 10000), "optical_reliability": (0, 1),
    "optical_sample_ticks": (1, 30), "clear_visibility_m": (100, 100000), "dense_visibility_m": (50, 10000),
    "ir_fog_factor": (.1, 2), "rf_tx_dbm": (-20, 40), "rf_gain_db": (-10, 30),
    "rf_sensitivity_dbm": (-130, -30), "rf_path_exponent": (1.5, 5), "rf_shadow_db": (0, 20),
    "rf_reliability": (0, 1), "rf_max_range_m": (50, 15000), "rf_bearing_error_deg": (0, 30),
    "iff_reply_probability": (0, 1), "civil_beacon_probability": (0, 1), "iff_max_range_m": (50, 10000),
    "false_track_probability": (0, .5), "false_track_lifetime_sweeps": (1, 3), "false_track_maximum": (0, 2),
}
INTEGER_CONFIG = {"radar_confirm_hits", "radar_window_sweeps", "radar_loss_sweeps", "radar_sweep_ticks", "optical_sample_ticks", "false_track_lifetime_sweeps", "false_track_maximum"}


def sample(seed, tick, index, sensor):
    """Frozen uint32 legacy sampler, independently mirrored without engine import."""
    x = (seed ^ ((tick + 1) * 374761393) ^ ((index + 1) * 668265263) ^ ((sensor + 1) * 69069)) & 0xFFFFFFFF
    x = ((x ^ (x >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((x ^ (x >> 16)) & 0xFFFFFFFF) / 4294967296


def configuration(overrides=None):
    result = dict(DEFAULT_CONFIG)
    if overrides:
        for key, value in overrides.items():
            if key not in BOUNDS or isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
                raise ValueError(f"Invalid sensor parameter: {key}")
            low, high = BOUNDS[key]
            if not low <= value <= high or key in INTEGER_CONFIG and value != math.floor(value):
                raise ValueError(f"Sensor parameter outside bounds: {key}")
            result[key] = value
    if result["radar_confirm_hits"] > result["radar_window_sweeps"] or result["dense_visibility_m"] > result["clear_visibility_m"]:
        raise ValueError("Inconsistent sensor parameters")
    return result


def q(value):
    return math.floor(value * 1e6 + .5) / 1e6


def validate_environment(environment):
    fog = environment.get("fog", 0)
    if isinstance(fog, bool) or not isinstance(fog, (int, float)) or not math.isfinite(fog) or not 0 <= fog <= 1:
        raise ValueError("Fog must be finite and within 0..1")
    for name in ("night", "rf_available", "iff_available"):
        if name in environment and not isinstance(environment[name], bool):
            raise ValueError(f"{name} must be boolean")
    for name, allowed in (("radar_status", ("normal", "jammed", "failed")), ("eo_status", ("normal", "degraded", "failed")), ("ir_status", ("normal", "degraded", "failed"))):
        if name in environment and environment[name] not in allowed:
            raise ValueError(f"Unknown {name}")
    if "sensor_origin" in environment and not all(math.isfinite(environment["sensor_origin"][axis]) for axis in ("x", "z", "altitude")):
        raise ValueError("Sensor origin must be finite")


def position(track):
    return {"x": q(track["x"]), "z": q(track["z"]), "altitude": q(track["altitude"])}


def line_of_sight(track, environment):
    """Segment/AABB intersection. Static boxes and sensor origin are frozen data."""
    validate_environment(environment)
    origin = environment.get("sensor_origin", {"x": 0, "z": 0, "altitude": 2})
    boxes = environment.get("terrain", [])
    if len(boxes) > 128:
        raise ValueError("At most 128 terrain boxes")
    for box in boxes:
        lower, upper = 0.0, 1.0
        for axis, lo, hi in (("x", box["x_min"], box["x_max"]), ("z", box["z_min"], box["z_max"]), ("altitude", 0, box["height"])):
            if not math.isfinite(lo) or not math.isfinite(hi) or lo > hi:
                raise ValueError("Invalid terrain box")
            start, delta = origin[axis], track[axis] - origin[axis]
            if abs(delta) < 1e-12:
                if start < lo or start > hi:
                    lower, upper = 1, 0
                    break
            else:
                a, b = (lo - start) / delta, (hi - start) / delta
                lower, upper = max(lower, min(a, b)), min(upper, max(a, b))
                if lower > upper:
                    break
        if lower <= upper and upper > 1e-8 and lower < 1 - 1e-8:
            return False
    return True


def range_m(track, environment):
    origin = environment.get("sensor_origin", {"x": 0, "z": 0, "altitude": 2})
    return math.hypot(track["x"] - origin["x"], track["z"] - origin["z"], track["altitude"] - origin["altitude"])


def radar_probability(seed, index, track, environment, config=None):
    validate_environment(environment)
    c = configuration(config)
    if environment.get("radar_status", "normal") == "failed":
        return 0.0
    distance = max(1, range_m(track, environment))
    if distance > c["radar_max_range_m"]:
        return 0.0
    rcs = track.get("rcs_db", RCS_DB.get(track["kind"], -15)) + (sample(seed, 0, index, 30) * 2 - 1) * c["rcs_spread_db"]
    fog = min(1, max(0, environment.get("fog", 0)))
    snr = c["radar_reference_snr"] * 10 ** ((rcs - c["radar_reference_rcs_db"]) / 10) * (c["radar_reference_range_m"] / distance) ** 4 * (1 - .15 * fog)
    if not line_of_sight(track, environment):
        snr *= c["radar_occlusion_factor"]
    # Single-look exponential target / square-law detector shape, not full DSP.
    probability = c["radar_pfa"] ** (1 / (1 + snr)) * c["radar_reliability"]
    if environment.get("radar_status") == "jammed":
        probability *= c["radar_jam_factor"]
    return probability


def optical_probability(line_pairs, threshold):
    ratio = max(0, min(100, line_pairs / threshold))
    power = ratio ** (2.7 + .7 * ratio)
    return power / (1 + power)


def optical_observation(seed, tick, index, track, environment, channel, config=None):
    validate_environment(environment)
    c = configuration(config)
    available = environment.get(f"{channel}_status", "normal") != "failed" and (channel != "eo" or not environment.get("night", False))
    result = {"available": available, "level": "none", "position": None, "silhouette": None, "sample_tick": None}
    if not available or not track.get("active", True) or not line_of_sight(track, environment):
        return result
    distance = max(1, range_m(track, environment))
    if distance > c[f"{channel}_max_range_m"]:
        return result
    fog = min(1, max(0, environment.get("fog", 0)))
    visibility = c["clear_visibility_m"] * (1 - fog) ** 3 + c["dense_visibility_m"] * (1 - (1 - fog) ** 3)
    transmission = math.exp(-3.912 * distance / visibility * (c["ir_fog_factor"] if channel == "ir" else 1))
    dimension = track.get("signature_m", SIGNATURE_M.get(track["kind"], .6))
    line_pairs = dimension / (2 * distance * c[f"{channel}_ifov_rad"]) * transmission
    sample_tick = tick // int(c["optical_sample_ticks"]) * int(c["optical_sample_ticks"])
    draw = sample(seed, sample_tick, index, 32 if channel == "eo" else 33)
    reliability = c["optical_reliability"] * (.35 if environment.get(f"{channel}_status") == "degraded" else 1)
    for level, threshold in (("identify", 6.4), ("recognise", 4), ("detect", 1)):
        if draw < optical_probability(line_pairs, threshold) * reliability:
            result.update(level=level, position=position(track), sample_tick=sample_tick)
            if level in ("recognise", "identify"):
                result["silhouette"] = "bird" if track["kind"] == "bird" else "fixed_wing" if track["kind"] in ("fixed_wing", "loitering", "loitering_munition") else "multirotor"
            break
    return result


def observe_sensors(seed, tick, index, track, environment, memory=None, config=None):
    validate_environment(environment)
    if not isinstance(tick, int) or tick < 0 or not isinstance(index, int) or index < 0:
        raise ValueError("Sensor tick/index must be nonnegative integers")
    for axis in ("x", "z", "altitude"):
        if not math.isfinite(track[axis]):
            raise ValueError("Sensor positions must be finite")
    c = configuration(config)
    key = f"{seed}:{index}:{track['id']}"
    if memory is None or memory.get("key") != key or tick < memory["tick"]:
        memory = {"key": key, "tick": tick, "sweep": None, "paints": [], "misses": 0, "confirmed": False, "position": None, "sample_tick": None, "radar_status": None}
    else:
        memory = copy.deepcopy(memory)
    memory["tick"] = tick
    active = track.get("active", True)
    radar_status = environment.get("radar_status", "normal")
    if radar_status not in ("normal", "jammed", "failed"):
        raise ValueError("Unknown radar status")
    sweep = tick // int(c["radar_sweep_ticks"])
    radar = {"available": radar_status != "failed", "state": "none", "detected": False, "fresh": False, "position": None, "sample_tick": None}
    if not active or radar_status == "failed":
        memory.update(sweep=None, paints=[], misses=0, confirmed=False, position=None, sample_tick=None)
    else:
        if memory["sweep"] != sweep:
            # No inventing paints skipped during a discontinuous seek.
            if memory["sweep"] is not None and sweep - memory["sweep"] > 1:
                memory.update(paints=[], misses=0, confirmed=False, position=None, sample_tick=None)
            sweep_tick = sweep * int(c["radar_sweep_ticks"])
            hit = sample(seed, sweep_tick, index, 31) < radar_probability(seed, index, track, environment, c)
            memory["paints"] = (memory["paints"] + [hit])[-int(c["radar_window_sweeps"]):]
            memory["misses"] = 0 if hit else memory["misses"] + 1
            if hit:
                memory.update(position=position(track), sample_tick=tick)
            lost = memory["confirmed"] and memory["misses"] >= c["radar_loss_sweeps"]
            memory["confirmed"] = not lost and (memory["confirmed"] or sum(memory["paints"]) >= c["radar_confirm_hits"])
            memory["sweep"] = sweep
            memory["last_state"] = "lost" if lost else "confirmed" if memory["confirmed"] else "tentative" if hit else "none"
        radar.update(state=memory.get("last_state", "none"), detected=memory["confirmed"], fresh=memory["sample_tick"] == tick,
                     position=copy.deepcopy(memory["position"]) if memory["confirmed"] or memory.get("last_state") == "tentative" else None,
                     sample_tick=memory["sample_tick"])
    memory["radar_status"] = radar_status
    eo = optical_observation(seed, tick, index, track, environment, "eo", c)
    ir = optical_observation(seed, tick, index, track, environment, "ir", c)
    distance = range_m(track, environment)
    rf_available = environment.get("rf_available", True)
    rf = {"available": rf_available, "detected": False, "band_ghz": None, "bearing_deg": None}
    sample_tick = sweep * int(c["radar_sweep_ticks"])
    if active and rf_available and track.get("rf", False) and distance <= c["rf_max_range_m"]:
        band = track.get("rf_band_ghz", 5.8 if sample(seed, 0, index, 34) >= .5 else 2.4)
        if band not in (2.4, 5.8):
            raise ValueError("RF band must be 2.4 or 5.8 GHz")
        wavelength = 299792458 / (band * 1e9)
        path_loss = 20 * math.log10(4 * math.pi / wavelength) + 10 * c["rf_path_exponent"] * math.log10(max(1, distance))
        shadow = (sample(seed, sample_tick, index, 34) * 2 - 1) * c["rf_shadow_db"]
        margin = c["rf_tx_dbm"] + c["rf_gain_db"] - path_loss + shadow - c["rf_sensitivity_dbm"]
        probability = c["rf_reliability"] / (1 + math.exp(-max(-50, min(50, margin / 4))))
        if sample(seed, sample_tick, index, 35) < probability:
            origin = environment.get("sensor_origin", {"x": 0, "z": 0, "altitude": 2})
            bearing = math.degrees(math.atan2(track["x"] - origin["x"], track["z"] - origin["z"]))
            rf.update(detected=True, band_ghz=band, bearing_deg=q((bearing + (sample(seed, sample_tick, index, 36) * 2 - 1) * c["rf_bearing_error_deg"] + 360) % 360))
    iff_available = rf_available and environment.get("iff_available", True)
    iff = {"available": iff_available, "cue": "no_reply" if iff_available else "unavailable", "registration_id": None}
    if active and iff_available and distance <= c["iff_max_range_m"]:
        if track["identity"] == "friendly" and sample(seed, sample_tick, index, 37) < c["iff_reply_probability"]:
            iff["cue"] = "friendly_reply"
        elif track["identity"] == "neutral" and track.get("registration_id") and sample(seed, sample_tick, index, 38) < c["civil_beacon_probability"]:
            iff.update(cue="registered_civil", registration_id=str(track["registration_id"])[:32])
    observation = {"version": VERSION, "tick": tick, "track_id": track["id"], "radar": radar, "eo": eo, "ir": ir, "rf": rf, "iff": iff}
    return {"observation": observation, "memory": memory}


def false_tracks(seed, tick, environment, config=None):
    """Bounded tentative clutter. No canonical kind/identity, no scoring targets."""
    validate_environment(environment)
    if not isinstance(tick, int) or tick < 0:
        raise ValueError("Sensor tick must be a nonnegative integer")
    c = configuration(config)
    if environment.get("radar_status") == "failed":
        return []
    sweep = tick // int(c["radar_sweep_ticks"])
    candidates = []
    for born in range(max(0, sweep - int(c["false_track_lifetime_sweeps"]) + 1), sweep + 1):
        for slot in range(int(c["false_track_maximum"])):
            if sample(seed, born, 900 + slot, 39) >= c["false_track_probability"]:
                continue
            angle = sample(seed, born, 900 + slot, 40) * math.pi * 2
            minimum = min(300, c["radar_max_range_m"] * .2)
            distance = minimum + sample(seed, born, 900 + slot, 41) * min(3000, c["radar_max_range_m"] - minimum)
            candidates.append({"track_id": f"C{born}-{slot}", "tick": tick, "radar": {"available": True, "state": "tentative", "detected": False, "fresh": sweep == born, "position": {"x": q(math.sin(angle) * distance), "z": q(math.cos(angle) * distance), "altitude": 0}, "sample_tick": born * int(c["radar_sweep_ticks"])}})
    return candidates[-int(c["false_track_maximum"]):] if c["false_track_maximum"] else []
