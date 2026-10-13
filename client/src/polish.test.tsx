import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import {
  controlReason,
  nextStep,
  commandState,
  instructorReason,
  cameraPose,
  palettes,
  sensorLabels,
} from "./presentation";
import { tourStops, tourTransition } from "./CapabilityTour";
import { HeatmapTable, type Heatmap } from "./SkillHeatmap";
import { SensorBadges } from "./SensorBadges";
import { makeScenario } from "./scenario";
import { replay, Simulation, score } from "./sim";
import { pixelRatio } from "./quality";
import type { InstructorCommand, InstructorSession, GhostSkill } from "./types";
const track = new Simulation(makeScenario(7)).snapshot().tracks[0];
const cmd: InstructorCommand = {
  command_id: "stable-request-id",
  session_id: "session",
  seq: 1,
  issued_at: "2026-10-04T00:00:00Z",
  type: "sensor_fault",
  payload: { sensor: "radar", mode: "jammed" },
  tick: null,
  order: null,
};
test("disabled reasons follow real phase, selection, designation, classification and frozen effectors", () => {
  assert.match(controlReason("designate", "paused", track)!, /paused/);
  assert.match(controlReason("classify", "running")!, /Select/);
  assert.match(
    controlReason("classify", "running", {
      ...track,
      active: true,
      designated: null,
    })!,
    /Designate/,
  );
  assert.match(
    controlReason("respond", "running", {
      ...track,
      active: true,
      designated: 2,
    })!,
    /classification/,
  );
  assert.match(
    controlReason(
      "respond",
      "running",
      { ...track, active: true, designated: 2, classification: "quad" },
      false,
    )!,
    /frozen/,
  );
  assert.equal(
    controlReason("respond", "running", {
      ...track,
      active: true,
      designated: 2,
      classification: "quad",
    }),
    undefined,
  );
  assert.match(
    controlReason("designate", "running", { ...track, active: false })!,
    /no longer/,
  );
});
test("NEXT guidance changes only with current decision state", () => {
  assert.match(nextStep("running"), /Select/);
  assert.match(
    nextStep("running", { ...track, active: true, designated: null }),
    /designate/,
  );
  assert.match(
    nextStep("running", {
      ...track,
      active: true,
      designated: 1,
      classification: null,
    }),
    /classify/,
  );
  assert.match(
    nextStep("running", {
      ...track,
      active: true,
      designated: 1,
      classification: "quad",
    }),
    /response/,
  );
});
test("commands require real server receipt and application tick, including tick zero", () => {
  assert.equal(commandState(undefined, "ACTIVE").state, "READY");
  assert.equal(commandState(undefined, "ACTIVE", "sending").state, "SENDING");
  assert.equal(commandState(cmd, "ACTIVE").state, "ACKNOWLEDGED");
  assert.equal(
    commandState({ ...cmd, tick: 0, order: 0 }, "ACTIVE").state,
    "APPLIED",
  );
  assert.equal(
    commandState({ ...cmd, tick: 942, order: 2 }, "COMPLETED").detail,
    "T+31.40s · order 2",
  );
});
test("failed transport, stale and ended command messages do not invent application", () => {
  assert.match(
    commandState(undefined, "ACTIVE", "failed").detail,
    /unconfirmed/,
  );
  assert.equal(commandState(cmd, "ACTIVE", "failed").state, "ACKNOWLEDGED");
  assert.equal(commandState(cmd, "RECOVERABLE").state, "TIMED OUT");
  assert.match(commandState(cmd, "RECOVERABLE").detail, /unconfirmed/);
  assert.equal(commandState(cmd, "COMPLETED").state, "FAILED");
  assert.equal(
    commandState({ ...cmd, tick: 2 }, "RECOVERABLE", "failed").state,
    "APPLIED",
  );
  assert.match(
    instructorReason({ status: "COMPLETED" } as InstructorSession)!,
    /completed/,
  );
  assert.match(
    instructorReason({ status: "ACTIVE" } as InstructorSession, false, true)!,
    /original ID/,
  );
});
test("tour start, previous, skip, completion persistence and replay are independent of training", () => {
  const writes: string[][] = [];
  const storage = { setItem: (k: string, v: string) => writes.push([k, v]) };
  assert.equal(tourStops.length, 6);
  let step = tourTransition(null, "start", storage);
  assert.equal(step, 0);
  assert.equal(tourTransition(step, "previous", storage), 0);
  assert.equal(tourTransition(step, "skip", storage), null);
  assert.deepEqual(writes, []);
  for (let i = 0; i < 6; i++) step = tourTransition(step, "next", storage);
  assert.equal(step, null);
  assert.deepEqual(writes, [["tour_completed", "true"]]);
  assert.equal(tourTransition(null, "start", storage), 0);
  assert.equal(
    tourTransition(5, "next", {
      setItem: () => {
        throw new Error("Storage unavailable");
      },
    }),
    null,
  );
});
test("camera presets safely handle absent and ended contacts without mutation", () => {
  const tracks = [{ ...track, active: true }];
  const frozen = JSON.stringify(tracks);
  assert.equal(cameraPose("follow", tracks, null).effective, "overview");
  assert.equal(cameraPose("observer", tracks, track.id).effective, "observer");
  assert.equal(cameraPose("follow", tracks, track.id).effective, "follow");
  assert.equal(
    cameraPose("follow", [{ ...track, active: false }], track.id).fallback,
    true,
  );
  assert.deepEqual(
    cameraPose("overview", tracks, null),
    cameraPose("overview", [{ ...tracks[0], x: 0, z: 0 }], null),
  );
  assert.equal(JSON.stringify(tracks), frozen);
});
test("timeline boundary and score stay identical across every camera preset", () => {
  const spec = makeScenario(7);
  const t = new Simulation(spec)
    .snapshot()
    .tracks.find((t) => t.active && t.detected !== null)!;
  const events = [
    { tick: 0, order: 0, k: "designate" as const, track: t.id },
    {
      tick: 0,
      order: 1,
      k: "classify" as const,
      track: t.id,
      kind: t.kind,
      identity: t.identity,
    },
  ];
  const before = replay(spec, events, 0, [], 1);
  const original = JSON.stringify(before.snapshot()),
    card = score(before);
  for (const p of ["overview", "observer", "follow"] as const)
    cameraPose(p, before.snapshot().tracks, t.id);
  assert.equal(JSON.stringify(before.snapshot()), original);
  assert.deepEqual(score(before), card);
  assert.equal(
    before.snapshot().tracks.find((x) => x.id === t.id)!.classification,
    null,
  );
});
test("heatmap displays actual Beta estimate and counts, without meaningful zero-sample 50%", () => {
  const skills: GhostSkill[] = [
    "detection",
    "classification_iff",
    "effector_choice",
    "degraded_sensor_response",
  ];
  const zero = {
    successes: 0,
    failures: 0,
    observations: 0,
    estimate: null,
    sessions: 0,
  };
  const data: Heatmap = {
    unit_id: "u",
    trainee_id: null,
    included_sessions: 2,
    excluded_sessions: 0,
    note: "Persisted outcomes",
    skills,
    rows: [
      {
        family: "DECOY_THEN_STRIKE",
        sessions: 2,
        cells: {
          detection: zero,
          classification_iff: zero,
          effector_choice: {
            successes: 9,
            failures: 5,
            observations: 14,
            estimate: 10 / 16,
            sessions: 2,
          },
          degraded_sensor_response: zero,
        },
      },
    ],
  };
  const html = renderToStaticMarkup(<HeatmapTable data={data} />);
  assert.match(html, /62.5%/);
  assert.match(html, /n=14/);
  assert.match(html, /Successes: 9/);
  assert.match(html, /Failures: 5/);
  assert.match(html, /No evidence/);
  assert.match(html, /n=0/);
  assert.doesNotMatch(html, /50.0%/);
});
test("sensor labels, palettes and quality tiers remain presentation settings", () => {
  assert.deepEqual(sensorLabels({ radarStatus: "normal", rfAvailable: true }), {
    radar: "NORMAL",
    rf: "NORMAL",
  });
  assert.deepEqual(
    sensorLabels({ radarStatus: "jammed", rfAvailable: false }),
    { radar: "DEGRADED", rf: "OFFLINE" },
  );
  const html = renderToStaticMarkup(
    <SensorBadges state={{ radarStatus: "failed", rfAvailable: false }} />,
  );
  assert.match(html, /RADAR/);
  assert.match(html, /RF/);
  assert.match(html, /OFFLINE/);
  assert.equal(Object.keys(palettes).length, 3);
  assert.equal(pixelRatio.low, 0.75);
  assert.equal(pixelRatio.medium, 1);
  const sim = new Simulation(makeScenario(7));
  const before = JSON.stringify(sim.snapshot());
  for (const p of Object.values(palettes)) assert.ok(p.hot);
  assert.equal(JSON.stringify(sim.snapshot()), before);
});
