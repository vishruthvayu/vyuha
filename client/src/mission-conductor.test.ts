import { testPython } from "./test-python";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  createMissionPlan,
  projectMission,
  type MissionFrame,
  type MissionScope,
  type AcceptedDecision,
} from "./mission-conductor";
const fixtures = JSON.parse(
  readFileSync(
    new URL("./fixtures/mission-conductor/cases.json", import.meta.url),
    "utf8",
  ),
);
function input(row = fixtures.cases[1]) {
  const scope = structuredClone(fixtures.scope) as MissionScope;
  const frame: MissionFrame = {
    version: "mission-frame-v1",
    scope,
    tick: row.tick,
    selectedTrackId: row.selection,
    contacts: [
      {
        scope,
        id: "T1",
        reportTick: row.reportTick,
        channels: (["radar", "eo", "ir"] as const).map((channel) => ({
          channel,
          available: !row.unavailable,
          level: row.unavailable
            ? "none"
            : channel === "radar"
              ? "detect"
              : "shape",
          sampleTick: row.sampleTick,
        })),
        iff: "no_reply",
      },
    ],
    accepted: row.actions.map(
      (action: AcceptedDecision["action"], order: number) => ({
        scope,
        tick: 30 + order,
        order,
        trackId: "T1",
        action,
        status: "accepted",
      }),
    ),
    completed: row.completed ?? false,
  };
  return {
    scope,
    options: { ...fixtures.options, assistance: row.assistance ?? "full" },
    frame,
  };
}
test("twelve episode cases match exact Python plan/projection without engine execution", () => {
  for (const row of fixtures.cases) {
    const value = input(row),
      plan = createMissionPlan(value.scope, value.options),
      before = structuredClone(value),
      result = projectMission(plan, value.frame);
    assert.equal(result.stage, row.expectedStage, row.id);
    assert.deepEqual(value, before);
    const py = spawnSync(
      testPython(),
      [
        fileURLToPath(
          new URL("./fixtures/mission-conductor/project.py", import.meta.url),
        ),
      ],
      { input: JSON.stringify(value), encoding: "utf8" },
    );
    assert.equal(py.status, 0, py.stderr);
    assert.deepEqual(
      JSON.parse(py.stdout),
      { plan, projection: result },
      row.id,
    );
    assert.equal(JSON.stringify(result).includes("ground_truth"), false);
  }
});
test("future observations/actions, mixed contexts and unknown versions fail closed", () => {
  for (const mutate of [
    (v: ReturnType<typeof input>) => (v.frame.tick = -1),
    (v: ReturnType<typeof input>) =>
      (v.frame.scope = { ...v.scope, attemptId: "OTHER" }),
    (v: ReturnType<typeof input>) =>
      (v.frame.contacts[0].scope = { ...v.scope, scenarioId: "OTHER" }),
    (v: ReturnType<typeof input>) => (v.frame.contacts[0].reportTick = 61),
    (v: ReturnType<typeof input>) =>
      (v.frame.contacts[0].channels[0].sampleTick = 61),
    (v: ReturnType<typeof input>) =>
      (v.frame.accepted = [
        {
          scope: v.scope,
          tick: 61,
          order: 0,
          trackId: "T1",
          action: "designate",
          status: "accepted",
        },
      ]),
  ]) {
    const v = input();
    mutate(v);
    assert.throws(() =>
      projectMission(createMissionPlan(v.scope, v.options), v.frame),
    );
  }
  const v = input(),
    p = createMissionPlan(v.scope, v.options);
  assert.throws(() =>
    projectMission({ ...p, version: "future" as never }, v.frame),
  );
  assert.throws(() =>
    projectMission(p, { ...v.frame, version: "future" as never }),
  );
  assert.throws(() =>
    createMissionPlan(
      { ...v.scope, engineVersion: "vyuha-0.5.0" as never },
      v.options,
    ),
  );
  assert.throws(() =>
    createMissionPlan(v.scope, { ...v.options, assistance: "mastered" }),
  );
});
test("raw truth and contradictory report channels cannot enter a learner projection", () => {
  const v = input(),
    p = createMissionPlan(v.scope, v.options);
  assert.throws(() =>
    projectMission(p, { ...v.frame, tracks: [] } as MissionFrame),
  );
  assert.throws(() =>
    projectMission(p, {
      ...v.frame,
      contacts: [{ ...v.frame.contacts[0], kind: "fiber_fpv" }],
    } as unknown as MissionFrame),
  );
  for (const change of [
    { available: false, level: "shape" },
    { channel: "radar", level: "shape" },
    { sampleTick: NaN },
    { channel: "rf" },
  ]) {
    const bad = structuredClone(v.frame);
    Object.assign(bad.contacts[0].channels[0], change);
    assert.throws(() => projectMission(p, bad));
  }
  const duplicate = structuredClone(v.frame);
  duplicate.contacts.push(duplicate.contacts[0]);
  assert.throws(() => projectMission(p, duplicate));
});
test("only accepted ordered receipts count; retries do not farm progress", () => {
  const v = input(fixtures.cases[2]),
    p = createMissionPlan(v.scope, v.options);
  const duplicate = structuredClone(v.frame);
  duplicate.accepted.push(duplicate.accepted[0]);
  assert.equal(projectMission(p, duplicate).acceptedDecisions, 1);
  const conflict = structuredClone(duplicate);
  conflict.accepted[1] = { ...conflict.accepted[1], trackId: "T2" };
  assert.throws(() => projectMission(p, conflict));
  const rejected = structuredClone(v.frame);
  rejected.accepted[0].status = "rejected" as never;
  assert.throws(() => projectMission(p, rejected));
  const unordered = structuredClone(v.frame);
  unordered.accepted.push({ ...unordered.accepted[0], tick: 29, order: 1 });
  assert.throws(() => projectMission(p, unordered));
});
test("assistance is explicit and activity is never correctness or mastery", () => {
  const v = input(),
    p = createMissionPlan(v.scope, { ...v.options, assistance: "none" }),
    result = projectMission(p, v.frame);
  assert.equal(result.task, null);
  assert.equal(result.guidanceVisible, false);
  assert.match(result.limitation, /not correctness, mastery/);
  assert.equal(Object.hasOwn(result, "score"), false);
  assert.equal(Object.hasOwn(result.contacts[0], "identity"), false);
  assert.equal(result.contacts[0].identityCue, "no_reply");
  const faded = projectMission(
    createMissionPlan(v.scope, { ...v.options, assistance: "faded" }),
    v.frame,
  );
  assert.equal(faded.task, "Inspect the available evidence.");
});
test("results are independent frozen copies and retained selection cannot disclose a hidden roster", () => {
  const v = input(),
    p = createMissionPlan(v.scope, v.options),
    result = projectMission(p, v.frame);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.contacts[0]));
  v.frame.contacts[0].iff = "friendly_reply";
  assert.equal(result.contacts[0].identityCue, "no_reply");
  const missing = projectMission(p, {
    ...v.frame,
    selectedTrackId: "T999",
    contacts: [],
  });
  assert.equal(missing.reportedContacts, 0);
  assert.equal(missing.stage, "observe");
  assert.deepEqual(missing.contacts, []);
});
