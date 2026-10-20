"""Independent sensor-model invariants; full engine dispatch tested separately."""
import copy
import math

import pytest
from server.sensors_v2 import configuration, false_tracks, line_of_sight, observe_sensors, optical_observation, optical_probability, radar_probability

TRACK = dict(id="T1", kind="quad", identity="hostile", rf=True, x=0, z=300, altitude=20, active=True)
ENV = dict(night=False, fog=0, radar_status="normal", rf_available=True)


def series(track=None, environment=None, ticks=(0, 30, 60), config=None):
    memory = None
    output = []
    for tick in ticks:
        result = observe_sensors(17, tick, 0, track or TRACK, environment or ENV, memory, config)
        memory = result["memory"]
        output.append(result["observation"])
    return output, memory


def test_radar_formula_has_inverse_fourth_power_shape_and_jamming_not_fake_detection():
    track = dict(TRACK, z=3000, altitude=2, rcs_db=-15)
    config = dict(rcs_spread_db=0, radar_reliability=1)
    actual = radar_probability(1, 0, track, ENV, config)
    assert actual == pytest.approx(1e-6 ** (1 / 31), abs=1e-12)
    assert radar_probability(1, 0, dict(track, z=1500), ENV, config) > actual
    assert radar_probability(1, 0, track, dict(ENV, radar_status="jammed"), config) == pytest.approx(actual * .15)
    assert radar_probability(1, 0, track, dict(ENV, radar_status="failed"), config) == 0


def test_day_camera_really_unavailable_at_night_and_ir_remains_observable():
    day = optical_observation(17, 0, 0, TRACK, ENV, "eo")
    night = optical_observation(17, 0, 0, TRACK, dict(ENV, night=True), "eo")
    thermal = optical_observation(17, 0, 0, TRACK, dict(ENV, night=True), "ir")
    assert day["available"] and day["level"] != "none"
    assert not night["available"] and night["position"] is None
    assert thermal["available"] and thermal["level"] != "none"


def test_fog_and_optical_failures_remove_evidence_instead_of_hiding_only_labels():
    clear = [optical_observation(seed, 0, 0, dict(TRACK, z=1000), ENV, "eo")["level"] != "none" for seed in range(200)]
    fog = [optical_observation(seed, 0, 0, dict(TRACK, z=1000), dict(ENV, fog=1), "eo")["level"] != "none" for seed in range(200)]
    assert sum(clear) > 100 and sum(fog) < 10
    for sensor in ("eo", "ir"):
        failed = optical_observation(17, 0, 0, TRACK, dict(ENV, **{f"{sensor}_status": "failed"}), sensor)
        assert failed == dict(available=False, level="none", position=None, silhouette=None, sample_tick=None)


def test_dri_thresholds_are_distinct_and_rf_medium_never_becomes_a_visual_shape():
    for threshold in (1, 4, 6.4):
        assert optical_probability(threshold, threshold) == .5
    assert optical_probability(2, 1) > optical_probability(2, 4) > optical_probability(2, 6.4)
    quad = optical_observation(17, 0, 0, dict(TRACK, z=20), ENV, "eo")
    fpv = optical_observation(17, 0, 0, dict(TRACK, z=20, kind="fiber_fpv", signature_m=.6), ENV, "eo")
    assert quad["silhouette"] == fpv["silhouette"] == "multirotor"
    assert "kind" not in quad and "identity" not in quad


def test_terrain_blocks_optics_and_reduces_radar_but_above_roof_is_clear():
    environment = dict(ENV, terrain=[dict(x_min=-20, x_max=20, z_min=40, z_max=60, height=30)])
    low = dict(TRACK, z=100, altitude=20)
    assert not line_of_sight(low, environment)
    assert line_of_sight(dict(low, altitude=100), environment)
    assert optical_observation(17, 0, 0, low, environment, "eo")["position"] is None
    assert radar_probability(17, 0, low, environment) < radar_probability(17, 0, low, ENV)
    assert line_of_sight(dict(low, x=80), environment)


def test_radar_requires_three_sweeps_and_coasts_only_old_reported_geometry():
    observations, memory = series(config=dict(radar_reliability=1))
    assert [o["radar"]["state"] for o in observations] == ["tentative", "tentative", "confirmed"]
    assert [o["radar"]["detected"] for o in observations] == [False, False, True]
    last = observations[-1]["radar"]["position"]
    moved = observe_sensors(17, 70, 0, dict(TRACK, x=777), ENV, memory)
    assert moved["observation"]["radar"]["position"] == last
    assert not moved["observation"]["radar"]["fresh"]
    for tick in (90, 120, 150):
        moved = observe_sensors(17, tick, 0, dict(TRACK, z=6000), ENV, moved["memory"])
    assert moved["observation"]["radar"]["state"] == "lost"
    assert moved["observation"]["radar"]["position"] is None


def test_failure_and_discontinuous_seek_clear_confirmation_without_inventing_paints():
    _, memory = series()
    failed = observe_sensors(17, 61, 0, TRACK, dict(ENV, radar_status="failed"), memory)
    assert not failed["observation"]["radar"]["available"]
    assert failed["observation"]["radar"]["position"] is None
    restored = observe_sensors(17, 62, 0, TRACK, ENV, failed["memory"])
    assert not restored["observation"]["radar"]["detected"]
    assert len(restored["memory"]["paints"]) == 1
    for tick in (0, 600):
        seek = observe_sensors(17, tick, 0, TRACK, ENV, memory)
        assert len(seek["memory"]["paints"]) == 1 and not seek["observation"]["radar"]["detected"]


def test_radar_only_optical_only_and_completely_hidden_are_different():
    radar_only, _ = series(track=dict(TRACK, z=2000), config=dict(radar_reliability=1))
    assert radar_only[-1]["radar"]["detected"]
    assert radar_only[-1]["eo"]["level"] == radar_only[-1]["ir"]["level"] == "none"
    optical = observe_sensors(17, 0, 0, TRACK, dict(ENV, radar_status="failed"))["observation"]
    assert optical["eo"]["level"] != "none" and not optical["radar"]["detected"]
    hidden = observe_sensors(17, 0, 0, dict(TRACK, z=6000), ENV)["observation"]
    assert not hidden["radar"]["detected"] and not hidden["rf"]["detected"] and hidden["eo"]["level"] == hidden["ir"]["level"] == "none"


def test_imperfect_iff_and_rf_do_not_turn_no_reply_into_hostility():
    friendly = dict(TRACK, identity="friendly")
    cues = [observe_sensors(seed, 0, 0, friendly, ENV)["observation"]["iff"]["cue"] for seed in range(200)]
    assert "no_reply" in cues and "friendly_reply" in cues
    civil = observe_sensors(17, 0, 0, dict(TRACK, identity="neutral", registration_id="CIV-01"), ENV, config=dict(civil_beacon_probability=1))["observation"]
    assert civil["iff"]["cue"] == "registered_civil" and civil["iff"]["registration_id"] == "CIV-01"
    no_link = observe_sensors(17, 0, 0, dict(TRACK, rf=False), ENV)["observation"]
    assert not no_link["rf"]["detected"] and no_link["rf"]["band_ghz"] is None
    unavailable = observe_sensors(17, 0, 0, TRACK, dict(ENV, rf_available=False))["observation"]
    assert unavailable["iff"]["cue"] == "unavailable" and unavailable["rf"]["bearing_deg"] is None


def test_rf_has_band_and_noisy_bearing_but_never_range_or_affiliation():
    outputs = [observe_sensors(seed, 0, 0, TRACK, ENV)["observation"]["rf"] for seed in range(100)]
    assert sum(o["detected"] for o in outputs) < 100
    assert sum(o["detected"] for o in outputs) > 50
    for output in outputs:
        assert set(output) == {"available", "detected", "band_ghz", "bearing_deg"}
        if output["detected"]:
            assert output["band_ghz"] in (2.4, 5.8) and min(output["bearing_deg"], 360-output["bearing_deg"]) <= 5


def test_false_tracks_bounded_temporary_deterministic_and_separate_from_score_targets():
    config = dict(false_track_probability=.5)
    ids = []
    for tick in range(0, 600, 30):
        output = false_tracks(17, tick, ENV, config)
        assert len(output) <= 2
        assert output == false_tracks(17, tick, ENV, config)
        assert all(o["radar"]["state"] == "tentative" and not o["radar"]["detected"] for o in output)
        assert all("kind" not in o and "identity" not in o for o in output)
        ids.extend(o["track_id"] for o in output)
        assert not set(o["track_id"] for o in false_tracks(17, tick + 90, ENV, config)) & set(o["track_id"] for o in output)
    assert ids
    assert false_tracks(17, 0, dict(ENV, radar_status="failed"), config) == []


def test_configuration_bounds_and_input_immutability():
    for config in (dict(radar_pfa=0), dict(eo_ifov_rad=math.nan), dict(radar_confirm_hits=6, radar_window_sweeps=5), dict(false_track_maximum=3), dict(unknown=1)):
        with pytest.raises(ValueError):
            configuration(config)
    frozen_track, frozen_env = copy.deepcopy(TRACK), copy.deepcopy(ENV)
    _, memory = series()
    original = copy.deepcopy(memory)
    observe_sensors(17, 90, 0, TRACK, ENV, memory)
    assert TRACK == frozen_track and ENV == frozen_env and memory == original


def test_invalid_environment_cannot_silently_become_available_evidence():
    for environment in (dict(ENV, fog=math.nan), dict(ENV, fog=2), dict(ENV, rf_available="yes"), dict(ENV, eo_status="unknown")):
        with pytest.raises(ValueError):
            observe_sensors(17, 0, 0, TRACK, environment)
    with pytest.raises(ValueError):
        false_tracks(17, -1, ENV)


def test_engine_prepared_context_matches_public_sensor_contract_with_fault_changes():
    from server.engine_v2 import Simulation
    from server.raid_v2 import compose_raid
    scenario=compose_raid({'seed':17,'duration':60,'difficulty':'foundational','family':'DIRECT'})
    sim=Simulation(scenario);memory={}
    # Include first paint, confirm/coast, optical sample boundaries and faults.
    for tick in range(121):
        if tick in (40,70):
            sim.rf_override=tick==70;sim.eo_status='failed' if tick==40 else 'normal'
            sim.observe()
        env=dict(night=sim.night,fog=scenario['fog'],radar_status=sim.radar_status,rf_available=sim.rf_available,eo_status=sim.eo_status,ir_status=sim.ir_status,terrain=scenario.get('terrain_boxes',[]))
        for i,track in enumerate(sim.tracks):
            result=observe_sensors(scenario['seed'],tick,i,track,env,memory.get(track['id']),scenario.get('sensor_config'))
            assert result['observation']==track['observation']
            memory[track['id']]=result['memory']
        if tick<120:sim.step()


def test_engine_revalidates_changed_sensor_settings_each_tick_and_keeps_sessions_separate():
    from server.engine_v2 import Simulation
    from server.raid_v2 import compose_raid
    spec=compose_raid({'seed':17,'duration':60,'difficulty':'foundational','family':'DIRECT'})
    other=Simulation(copy.deepcopy(spec));sim=Simulation(copy.deepcopy(spec))
    before=copy.deepcopy(other.sensor_memory)
    sim.scenario['sensor_config']={'radar_pfa':0}
    with pytest.raises(ValueError,match='outside bounds'):sim.observe()
    assert other.sensor_memory==before
    other.observe()  # Another session never uses the invalid configuration.
