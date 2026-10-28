import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { testPython } from "./test-python";
import {
  OpticalTaskScheduler,
  type OpticalPolicy,
  type OpticalReading,
  type OpticalRequest,
} from "./optical-task-scheduler";
const fixtures = JSON.parse(
  readFileSync(
    new URL("./fixtures/optical-task-scheduler/cases.json", import.meta.url),
    "utf8",
  ),
) as {
  cases: {
    id: string;
    policy: OpticalPolicy;
    readings?: Record<string, OpticalReading>;
    steps: {
      kind: string;
      tick: number;
      request: OpticalRequest;
      observed: { trackId: string; reportTick: number }[];
    }[];
    expected: unknown;
  }[];
};
for (const row of fixtures.cases)
  test(`optical scheduling parity: ${row.id}`, () => {
    const calls: { trackId: string; channel: string; tick: number }[] = [];
    const scheduler = new OpticalTaskScheduler(
      row.policy,
      (trackId, channel, tick) => {
        calls.push({ trackId, channel, tick });
        return (
          row.readings?.[`${channel}:${tick}`] ?? {
            available: true,
            level: "none",
          }
        );
      },
    );
    const before = structuredClone(row),
      replies: unknown[] = [];
    for (const step of row.steps) {
      if (step.kind === "request")
        replies.push(scheduler.request(step.tick, step.request, step.observed));
      else if (step.kind === "end") scheduler.end(step.tick);
      else if (step.kind === "available")
        replies.push(scheduler.availableResults(step.tick));
      else scheduler.advance(step.tick);
    }
    const actual = { replies, state: scheduler.snapshot(), calls };
    assert.deepEqual(actual, row.expected);
    assert.deepEqual(row, before);
    const py = spawnSync(
      testPython(),
      [
        fileURLToPath(
          new URL(
            "./fixtures/optical-task-scheduler/project.py",
            import.meta.url,
          ),
        ),
      ],
      { input: JSON.stringify(row), encoding: "utf8" },
    );
    assert.equal(py.status, 0, py.stderr);
    assert.deepEqual(JSON.parse(py.stdout), actual);
  });
test("invalid policies, future report prefixes and extra truth fail closed without mutating the scheduler", () => {
  const p = fixtures.cases[0].policy;
  for (const delta of [
    { dwellTicks: 0 },
    { version: "future" },
    { cadenceTicks: true },
    { maxRequests: 129 },
  ])
    assert.throws(
      () =>
        new OpticalTaskScheduler({ ...p, ...delta } as OpticalPolicy, () => ({
          available: true,
          level: "none",
        })),
    );
  const scheduler = new OpticalTaskScheduler(p, () => ({
    available: false,
    level: "identify",
  }));
  const initial = scheduler.snapshot();
  for (const [request, observed] of [
    [{ id: "q", trackId: "T1", channel: "rf" }, []],
    [{ id: "q", trackId: "T1", channel: "eo", truth: true }, []],
    [
      { id: "q", trackId: "T1", channel: "eo" },
      [{ trackId: "T1", reportTick: 99 }],
    ],
  ]) {
    assert.throws(() =>
      scheduler.request(
        0,
        request as OpticalRequest,
        observed as { trackId: string; reportTick: number }[],
      ),
    );
    assert.deepEqual(scheduler.snapshot(), initial);
  }
  scheduler.request(0, { id: "q", trackId: "T1", channel: "eo" }, [
    { trackId: "T1", reportTick: 0 },
  ]);
  const before = scheduler.snapshot();
  assert.throws(() => scheduler.advance(8));
  assert.deepEqual(scheduler.snapshot(), before);
});
test("returned queries/results and policy never alias internal state; logical time cannot rewind", () => {
  const p = structuredClone(fixtures.cases[0].policy),
    scheduler = new OpticalTaskScheduler(p, () => ({
      available: true,
      level: "detect",
    }));
  p.dwellTicks = 100;
  const q = scheduler.request(0, { id: "q", trackId: "T1", channel: "eo" }, [
    { trackId: "T1", reportTick: 0 },
  ]);
  q.query!.trackId = "foreign";
  assert.equal(scheduler.snapshot().pending!.trackId, "T1");
  const results = scheduler.availableResults(8);
  results[0].reading.level = "identify";
  assert.equal(scheduler.snapshot().results[0].reading.level, "detect");
  assert.throws(() => scheduler.advance(7));
  assert.throws(() => scheduler.advance(8.5));
  assert.equal(scheduler.policy.dwellTicks, 4);
});
