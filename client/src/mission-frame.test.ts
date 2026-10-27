import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { testPython } from "./test-python";
import { Simulation } from "./sim";
import { reportedContacts } from "./observed-contacts";
import { missionFromReports, missionTaskFromReports } from "./mission-frame";
import type { Scenario } from "./types";

const scenario = JSON.parse(
  execFileSync(
    testPython(),
    [
      "-c",
      "import json;from server.tests.response_fixtures import fixtures;print(json.dumps(fixtures()[0]['scenario']))",
    ],
    { cwd: "..", encoding: "utf8" },
  ),
) as Scenario;
test("mission adapter integrates real v0.4 reported samples and accepted ordered decisions without changing engine state", () => {
  const sim = new Simulation(scenario);
  for (let i = 0; i < 60; i++) sim.step();
  const state = sim.snapshot(),
    observations = reportedContacts(state).flatMap((t) =>
      t.observation ? [t.observation] : [],
    );
  assert.ok(observations.length > 0);
  assert.ok(observations.every((o) => o.tick === state.tick));
  const input = {
    scope: {
      attemptId: "real-worker-attempt",
      scenarioId: scenario.id,
      engineVersion: "vyuha-0.4.0" as const,
    },
    tick: state.tick,
    selected: observations[0].track_id,
    observations,
    accepted: sim.events,
    durationTicks: scenario.duration * 30,
    worldId: scenario.terrain_id!,
    assistance: "full" as const,
    completed: false,
  };
  const before = JSON.stringify(state);
  const projection = missionFromReports(input);
  assert.equal(projection.reportedContacts, observations.length);
  for (const selected of [
    ...observations.map((o) => o.track_id),
    null,
    "unreported",
  ]) {
    for (const assistance of ["full", "faded", "none"] as const) {
      assert.equal(
        missionTaskFromReports({ ...input, selected, assistance }),
        missionFromReports({ ...input, selected, assistance }).task,
      );
    }
  }
  assert.equal(JSON.stringify(sim.snapshot()), before);
  assert.equal(JSON.stringify(projection).includes('"ground_truth"'), false);
  assert.ok(
    sim.act({
      k: "designate",
      track: observations[0].track_id,
      tick: state.tick,
      order: 0,
    }),
  );
  const next = missionFromReports({ ...input, accepted: sim.events });
  assert.equal(next.acceptedDecisions, 1);
  assert.equal(
    missionTaskFromReports({ ...input, accepted: sim.events }),
    next.task,
  );
  assert.equal(
    next.contacts.find((t) => t.id === input.selected)?.designated,
    true,
  );
});
test("adapter strips injected canonical fields and independent assessment suppresses teaching prompts", () => {
  const sim = new Simulation(scenario);
  for (let i = 0; i < 60; i++) sim.step();
  const state = sim.snapshot();
  const observations = reportedContacts(state).flatMap((t) =>
    t.observation ? [t.observation] : [],
  );
  const input = {
    scope: {
      attemptId: "assessment",
      scenarioId: scenario.id,
      engineVersion: "vyuha-0.4.0" as const,
    },
    tick: state.tick,
    selected: observations[0].track_id,
    observations,
    accepted: [],
    durationTicks: scenario.duration * 30,
    worldId: scenario.terrain_id!,
    assistance: "none" as const,
    completed: false,
  };
  const clean = missionFromReports(input),
    injected = missionFromReports({
      ...input,
      observations: observations.map((o) => ({
        ...o,
        kind: "fiber_fpv",
        identity: "hostile",
        ground_truth: { answer: "classified" },
      })),
    });
  assert.deepEqual(clean, injected);
  assert.equal(clean.task, null);
  assert.equal(clean.guidanceVisible, false);
  assert.throws(() =>
    missionFromReports({
      ...input,
      observations: observations.map((o) => ({ ...o, tick: state.tick + 1 })),
    }),
  );
  assert.throws(() =>
    missionFromReports({
      ...input,
      accepted: [
        { k: "designate", track: observations[0].track_id, tick: state.tick },
      ],
    }),
  );
});
