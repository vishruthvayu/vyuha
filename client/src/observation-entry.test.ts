import test from "node:test";
import assert from "node:assert/strict";
import {
  observationEntry,
  observationEntryKey,
  loadObservationMission,
} from "./observation-entry";
import type { Scenario } from "./types";
test("mission admission keeps old Academy tickets isolated and fails closed on ambiguous or malformed launches", () => {
  assert.equal(
    observationEntry("?learning=frozen&mission_template=night_switch").entry,
    null,
  );
  for (const q of [
    "?mission_template=unknown",
    "?observation_mission=../../private",
    "?mission_template=night_switch&mission_mode=adaptive",
    "?mission_template=night_switch&seed=Infinity",
    "?mission_template=night_switch&seed=",
    "?mission_template=night_switch&seed=4294967296",
    "?mission_template=night_switch&seed=1&seed=2",
    "?observation_mission=raid_aaaaaaaaaaaaaaaaaaaaaaaa&mission_template=night_switch",
  ])
    assert.ok(observationEntry(q).error, q);
  assert.deepEqual(
    observationEntry(
      "?mission_template=timed_window&mission_mode=assessment&seed=0",
    ).entry,
    { kind: "preset", template: "timed_window", mode: "assessment", seed: 0 },
  );
  assert.equal(
    observationEntryKey("?mission_template=night_switch&view=aar"),
    observationEntryKey("?mission_template=night_switch"),
  );
  assert.notEqual(
    observationEntryKey("?mission_template=night_switch"),
    observationEntryKey("?mission_template=civil_restraint"),
  );
});
test("published mission admission never recompiles and verifies returned ownership and contract before preparing", async () => {
  const id = "raid_" + "a".repeat(24),
    calls: unknown[] = [];
  const spec = {
    id,
    engine_version: "vyuha-0.5.0",
    observation_mission: {
      version: "observation-mission-v1",
      assessment_version: "evidence-assessment-v1",
    },
  } as Scenario;
  const request = async (path: string, body?: unknown) => {
    calls.push([path, body]);
    return spec;
  };
  assert.equal(
    await loadObservationMission({ kind: "published", id }, request),
    spec,
  );
  assert.deepEqual(calls, [[`/observation-missions/${id}`, undefined]]);
  await assert.rejects(
    loadObservationMission(
      { kind: "published", id: "raid_" + "b".repeat(24) },
      request,
    ),
    /does not match/,
  );
  await assert.rejects(
    loadObservationMission({ kind: "published", id }, async () => ({
      ...spec,
      engine_version: "vyuha-0.4.0",
    })),
    /unsupported/,
  );
});
test("preset preparation preserves seed zero and independent assessment mode; changed returned criteria are rejected", async () => {
  const entry = {
    kind: "preset",
    template: "civil_restraint",
    mode: "assessment",
    seed: 0,
  } as const;
  const spec = {
    id: "raid_" + "c".repeat(24),
    seed: 0,
    engine_version: "vyuha-0.5.0",
    observation_mission: {
      version: "observation-mission-v1",
      assessment_version: "evidence-assessment-v1",
      template: entry.template,
      mode: entry.mode,
    },
  } as Scenario;
  await loadObservationMission(entry, async (path, body) => {
    assert.equal(path, "/observation-missions/prepare");
    assert.deepEqual(body, {
      template: entry.template,
      mode: entry.mode,
      seed: 0,
    });
    return spec;
  });
  await assert.rejects(
    loadObservationMission(entry, async () => ({ ...spec, seed: 1 })),
    /does not match/,
  );
});

test("v2 admission is explicit and cannot reinterpret a frozen v1 mission as the new decision alphabet", async () => {
  const parsed = observationEntry(
    "?mission_template=night_switch&mission_version=2&seed=0",
  );
  assert.equal(parsed.entry?.version, 2);
  assert.ok(
    observationEntry("?mission_template=night_switch&mission_version=4").error,
  );
  assert.ok(
    observationEntry(
      "?mission_template=night_switch&mission_version=2&mission_version=1",
    ).error,
  );
  const spec = {
    id: "raid_" + "a".repeat(24),
    seed: 0,
    engine_version: "vyuha-0.6.0",
    observation_mission: {
      version: "observation-mission-v2",
      assessment_version: "evidence-assessment-v2",
      template: "night_switch",
      mode: "practice",
    },
  } as Scenario;
  const paths: string[] = [];
  await loadObservationMission(parsed.entry!, async (path) => {
    paths.push(path);
    return spec;
  });
  assert.deepEqual(paths, ["/observation-missions-v2/prepare"]);
  await assert.rejects(
    loadObservationMission(
      { ...parsed.entry!, version: undefined },
      async () => spec,
    ),
    /unsupported frozen contract/,
  );
});
