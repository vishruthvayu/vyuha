"""Authoritative integrated v0.4 fixtures, generated from ordinary engine APIs.

The scripted actions are deliberate reference-policy test inputs, not a human
training efficacy claim or an implemented expert assistant.
"""
import copy
import json
from server.raid_v2 import RaidRequest, compose_raid, FAMILIES
from server.engine_v2 import Simulation, score, replay, observed_position
from server.engine_v1_0_1 import ideal, distance

FIELDS = ("id", "x", "z", "altitude", "active", "detected", "designated", "resolved", "impact", "radar", "thermal", "classification", "declared", "attempts", "observation")
CHECKPOINTS = (0, 90, 180, 210, 240, 270, 300, 330, 360, 420, 480, 510, 540, 600, 900, 1200, 1800)


def projection(sim):
    return copy.deepcopy(dict(tick=sim.tick, radar_status=sim.radar_status, rf_available=sim.rf_available, night=sim.night,
                              paused=sim.paused, tracks=[{k: t[k] for k in FIELDS} for t in sim.tracks], false_contacts=sim.false_contacts,
                              events=sim.events, commands=sim.commands, scorecard=score(sim)))


def fixtures():
    outputs = []
    for seed_index, seed in enumerate((7, 482913)):
        for family_index, family in enumerate(FAMILIES):
            for night in (False, True):
                urban = (seed_index + family_index + int(night)) % 2 == 0
                fog = .65 if (family_index + int(night)) % 2 else 0
                scenario = compose_raid(RaidRequest(seed=seed, family=family, duration=60, contacts=6, difficulty="challenging", night=night, fog=fog, terrain="urban" if urban else "rural"))
                # Preserve the pre-response v0.4 immediate contract separately
                # from the opt-in finite-resource response parity fixtures.
                scenario.pop('response_model', None)
                # Explicit static geometry is a frozen input to both engines.
                scenario["terrain_boxes"] = [dict(x_min=-80, x_max=80, z_min=450, z_max=550, height=32)] if urban else [dict(x_min=300, x_max=360, z_min=600, z_max=680, height=12)]
                scenario["sensor_config"] = dict(false_track_probability=.3)
                sim = Simulation(scenario)
                order = 0
                checkpoints = []
                commands = {
                    180: [("sensor_fault", dict(sensor="eo", mode="failed"))],
                    210: [("sensor_fault", dict(sensor="ir", mode="failed"))],
                    240: [("inject_contact", dict(kind="fiber_fpv", bearing=45))],
                    270: [("sensor_restore", dict(sensor="eo")), ("sensor_fault", dict(sensor="radar", mode="jammed"))],
                    300: [("sensor_restore", dict(sensor="radar"))],
                    330: [("sensor_restore", dict(sensor="ir")), ("sensor_fault", dict(sensor="radar", mode="failed"))],
                    360: [("environment", dict(night=not night))],
                    420: [("inject_swarm", dict(count=6, bearing=230))],
                    480: [("sensor_fault", dict(sensor="rf", mode="failed"))],
                    510: [("sensor_restore", dict(sensor="rf"))],
                    540: [("sensor_restore", dict(sensor="radar"))],
                    600: [("pause", {}), ("resume", {})],
                }
                while sim.tick <= 1800:
                    for command_type, payload in commands.get(sim.tick, []):
                        command = dict(type=command_type, payload=payload, tick=sim.tick, order=order, seq=len(sim.commands)+1,
                                       command_id=f"c{order}", session_id="fixture-session", issued_at="fixture")
                        assert sim.control(command), command
                        order += 1
                    if sim.tick % 30 == 0 and sim.tick < 1800:
                        targets = [t for t in sim.tracks if t["active"] and observed_position(t) is not None]
                        # Label all current targets first, making priority comparisons nontrivial.
                        for target in targets:
                            if target["designated"] is None:
                                action = dict(tick=sim.tick, order=order, k="designate", track=target["id"])
                                if sim.act(action):
                                    order += 1
                                    label = dict(tick=sim.tick, order=order, k="classify", track=target["id"], kind=target["kind"], identity=target["identity"])
                                    if family_index == 0 and night and target["identity"] == "friendly":
                                        label["identity"] = "hostile"  # deliberate safety-negative fixture
                                    assert sim.act(label)
                                    order += 1
                        targets.sort(key=distance, reverse=family_index % 2 == 1)
                        for target in targets:
                            if target["classification"] is None:
                                continue
                            effector = ideal(target)
                            maximum = sim.scenario["doctrine"]["rules"]["rf_range" if effector == "rf_jam" else "kinetic_range"]
                            if effector != "hold" and distance(target) > maximum:
                                continue
                            if target["attempts"] and effector == "hold":
                                continue
                            if target["kind"] == "fiber_fpv" and not target["attempts"]:
                                effector = "rf_jam"  # deliberately ineffective, then correct on next step
                            if family_index == 0 and night and target["identity"] == "friendly":
                                effector = "kinetic"
                            action = dict(tick=sim.tick, order=order, k="engage", track=target["id"], effector=effector)
                            if sim.act(action):
                                order += 1
                    if sim.tick in CHECKPOINTS:
                        checkpoints.append(projection(sim))
                    if sim.tick == 1800:
                        break
                    sim.step()
                # Also prove accepted action/command logs reconstruct the terminal state.
                rebuilt = replay(scenario, sim.events, 1800, sim.commands)
                assert projection(rebuilt) == projection(sim)
                outputs.append(dict(scenario=scenario, events=sim.events, commands=sim.commands, checkpoints=checkpoints, scorecard=score(sim)))
    return outputs


if __name__ == "__main__":
    print(json.dumps(fixtures(), separators=(",", ":")))
