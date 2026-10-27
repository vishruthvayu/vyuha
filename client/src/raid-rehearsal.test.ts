import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { testPython } from "./test-python";
import {
  buildRaidRehearsal,
  initialRaidRoster,
  rosterMix,
  referenceTrackAt,
  waveSeek,
} from "./raid-rehearsal";
import { raidPosition } from "./raid-v2";
import type { Scenario } from "./types";

export const rehearsalFixture: Scenario = {
  version: 2,
  engine_version: "vyuha-0.4.0",
  id: "raid-fixture",
  seed: 27,
  title: "Controlled waves",
  duration: 90,
  night: false,
  fog: 0.15,
  jamStart: -1,
  jamEnd: -1,
  focus: "effector_choice",
  tracks: [
    {
      id: "T1",
      kind: "quad",
      identity: "hostile",
      rf: true,
      spawn: 60,
      bearing: 90,
      distance: 900,
      speed: 15,
      altitude: 40,
      motion: {
        version: 1,
        primitive: "weave",
        phase_s: 8,
        lateral_m: 25,
        period_s: 12,
        turn_deg: 0,
      },
    },
    {
      id: "T2",
      kind: "bird",
      identity: "neutral",
      rf: false,
      spawn: 900,
      bearing: 0,
      distance: 1700,
      speed: 12,
      altitude: 60,
      expires_tick: 1800,
      motion: {
        version: 1,
        primitive: "orbit_then_dash",
        phase_s: 90,
        lateral_m: 0,
        period_s: 20,
        turn_deg: 70,
      },
    },
  ],
  raid: {
    version: 2,
    family: "STAGGERED_WAVES",
    fingerprint: "fixture",
    signature: [],
    validation: {},
    waves: [
      { tick: 60, role: "first_wave", contacts: ["T1"] },
      { tick: 900, role: "second_wave", contacts: ["T2"] },
    ],
  },
};

test("reference rehearsal is immutable, uses admitted analytic motion and seeks independently of prior ticks", () => {
  const scenario = structuredClone(rehearsalFixture),
    original = JSON.stringify(scenario);
  const model = buildRaidRehearsal(scenario);
  assert.equal(model.version, "raid-reference-rehearsal-v1");
  assert.equal(model.endTick, 2700);
  assert.equal(model.paths.length, 2);
  for (const path of model.paths)
    for (const point of path.points)
      assert.deepEqual(
        { x: point.x, z: point.z },
        raidPosition(path.track, point.tick),
      );
  const at = referenceTrackAt(scenario.tracks[0], 500);
  for (const tick of [1000, 0, 600, 2700, 1])
    referenceTrackAt(scenario.tracks[0], tick);
  assert.deepEqual(referenceTrackAt(scenario.tracks[0], 500), at);
  assert.equal(referenceTrackAt(scenario.tracks[0], 59).scheduled, false);
  assert.equal(referenceTrackAt(scenario.tracks[0], 60).scheduled, true);
  assert.equal(referenceTrackAt(scenario.tracks[1], 1800).scheduled, false);
  assert.equal(referenceTrackAt(scenario.tracks[0], 2700).nearAsset, true);
  assert.equal(JSON.stringify(scenario), original);
});

test("roster compilation preserves exact requested profiles and fails invalid/oversized/hostile-free drafts", () => {
  assert.deepEqual(rosterMix(initialRaidRoster), [
    "hostile_quad",
    "hostile_quad",
    "no_rf_fpv",
    "fixed_wing",
    "bird",
    "friendly_uav",
    "civil_uav",
  ]);
  for (const hostile_quad of [-1, 0.5, 201, NaN])
    assert.throws(() => rosterMix({ ...initialRaidRoster, hostile_quad }));
  assert.throws(
    () => rosterMix({ ...initialRaidRoster, hostile_quad: 200 }),
    /200 contacts/,
  );
  assert.throws(
    () =>
      rosterMix({
        hostile_quad: 0,
        no_rf_fpv: 0,
        fixed_wing: 0,
        bird: 2,
        friendly_uav: 0,
        civil_uav: 0,
      }),
    /hostile/,
  );
  assert.throws(
    () =>
      rosterMix({
        hostile_quad: 1,
        no_rf_fpv: 0,
        fixed_wing: 0,
        bird: 0,
        friendly_uav: 0,
        civil_uav: 0,
      }),
    /at least two/,
  );
});

test("rehearsal rejects future/unlinked/unsupported or malformed geometry instead of inventing a view", () => {
  for (const mutate of [
    (s: Scenario) => {
      s.engine_version = "vyuha-0.3.0";
    },
    (s: Scenario) => {
      s.tracks[1].id = s.tracks[0].id;
    },
    (s: Scenario) => {
      s.tracks[0].spawn = 3000;
    },
    (s: Scenario) => {
      s.tracks[0].motion!.period_s = 0;
    },
    (s: Scenario) => {
      s.tracks[0].motion!.lateral_m = Infinity;
    },
    (s: Scenario) => {
      s.raid!.waves[0].contacts = ["T99"];
    },
    (s: Scenario) => {
      s.raid!.waves[0].tick = -1;
    },
    (s: Scenario) => {
      s.tracks[0].expires_tick = 20;
    },
  ]) {
    const s = structuredClone(rehearsalFixture);
    mutate(s);
    assert.throws(() => buildRaidRehearsal(s));
  }
});

test("wave navigation is strict, sorted, duplicate-safe and does not silently wrap", () => {
  assert.equal(waveSeek([900, 60, 900], 60, 1), 900);
  assert.equal(waveSeek([900, 60, 900], 900, -1), 60);
  assert.equal(waveSeek([60, 900], 900, 1), 900);
  assert.equal(waveSeek([], 90, -1), 90);
});

test("new authoring request fields round-trip through the unchanged Python admission schema", () => {
  const request = {
    schema_version: 2,
    seed: 482913,
    duration: 180,
    difficulty: "challenging",
    focus: "classification_iff",
    family: "BLIND_SECTOR",
    weak_sector_deg: 123,
    mix: rosterMix(initialRaidRoster),
  };
  const run = spawnSync(
    testPython(),
    [
      "-c",
      "import json,sys; from server.raid_v2 import RaidRequest; print(json.dumps(RaidRequest(**json.loads(sys.stdin.read())).model_dump()))",
    ],
    {
      cwd: "..",
      input: JSON.stringify(request),
      encoding: "utf8",
      timeout: 15000,
      maxBuffer: 1024 * 1024,
    },
  );
  assert.equal(run.status, 0, run.stderr || String(run.error));
  const admitted = JSON.parse(run.stdout);
  assert.equal(admitted.focus, request.focus);
  assert.equal(admitted.weak_sector_deg, request.weak_sector_deg);
  assert.deepEqual(admitted.mix, request.mix);
});

test("server geometric-window evidence is optional, bounded, and does not invent a continuous sensor opportunity", () => {
  const scenario = structuredClone(rehearsalFixture);
  scenario.raid!.validation = {
    response_windows: {
      T1: { first_tick: 300, last_tick: 1000, usable_ticks: 400 },
    },
  };
  assert.deepEqual(buildRaidRehearsal(scenario).paths[0].responseWindow, {
    firstTick: 300,
    lastTick: 1000,
    usableTicks: 400,
  });
  scenario.raid!.validation = {
    response_windows: {
      T1: { first_tick: 300, last_tick: 1000, usable_ticks: 10000 },
    },
  };
  assert.equal(buildRaidRehearsal(scenario).paths[0].responseWindow, null);
});
