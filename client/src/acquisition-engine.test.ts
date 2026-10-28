import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { testPython } from "./test-python";
import { Simulation, replay, score } from "./sim";
import type { Scenario, Action, AppliedCommand } from "./types";
import type { Simulation as AcquisitionSimulation } from "./sim-v3";
type Point = {
  tick: number;
  acquisition: unknown;
  tracks: unknown;
  events: Action[];
  commands: AppliedCommand[];
  score: unknown;
};
type Fixture = {
  scenario: Scenario;
  checkpoints: Point[];
  events: Action[];
  commands: AppliedCommand[];
  rejected: boolean[];
  early_end: number | null;
};
function projection(sim: Simulation) {
  const state = sim.snapshot();
  return {
    tick: state.tick,
    acquisition: state.acquisition,
    tracks: state.tracks.map((t) =>
      Object.fromEntries(
        [
          "id",
          "active",
          "detected",
          "designated",
          "classification",
          "declared",
          "thermal",
          "radar",
          "observation",
        ].map((k) => [k, t[k as keyof typeof t]]),
      ),
    ),
    events: sim.events,
    commands: sim.commands,
    score: score(sim),
  };
}
function fixtures() {
  const result = spawnSync(
    testPython(),
    [
      fileURLToPath(
        new URL("./fixtures/acquisition-engine/project.py", import.meta.url),
      ),
    ],
    {
      cwd: "..",
      encoding: "utf8",
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout) as Fixture[];
}
test("active engine has actual Python/TypeScript request/sample/release/decision parity for day, night, fault and cancellation", () => {
  for (const f of fixtures()) {
    const sim = new Simulation(f.scenario) as AcquisitionSimulation;
    let i = 0;
    const actions = f.events.map((action) => ({
      tick: action.tick,
      order: action.order!,
      action,
      command: null as AppliedCommand | null,
    }));
    const timeline = [
      ...actions,
      ...f.commands.map((command) => ({
        tick: command.tick,
        order: command.order,
        action: null as Action | null,
        command,
      })),
    ].sort((a, b) => a.tick - b.tick || a.order - b.order);
    for (let tick = 0; tick <= 240; tick++) {
      while (i < timeline.length && timeline[i].tick === tick) {
        const e = timeline[i++];
        assert.ok(
          e.command
            ? sim.control(e.command, tick, e.order)
            : sim.act(e.action!),
        );
      }
      if (tick === 151)
        assert.equal(
          sim.act({
            tick,
            order: sim.nextOrder,
            k: "inspect",
            track: "T1",
            channel: "ir",
            request_id: "parity_ir",
          }),
          false,
        );
      if (tick === 152)
        assert.equal(
          sim.act({
            tick,
            order: sim.nextOrder,
            k: "inspect",
            track: "T1",
            channel: "eo",
            request_id: "busy_eo",
          }),
          false,
        );
      if (tick === f.early_end) sim.endAcquisition();
      const expected = f.checkpoints.find((p) => p.tick === tick);
      if (expected)
        assert.deepEqual(
          projection(sim),
          expected,
          `${f.scenario.night}:${f.commands.length}:${f.early_end}:${tick}`,
        );
      if (tick < 240) sim.step(true);
    }
    const restored = replay(
      f.scenario,
      f.events,
      240,
      f.commands,
      undefined,
      f.early_end ?? undefined,
    );
    assert.deepEqual(
      projection(restored),
      projection(sim),
      "restore retains sparse global orders and immutable acquisition evidence",
    );
    const decision = f.events.find((e) => e.k === "classify");
    if (decision) {
      const before = replay(
        f.scenario,
        f.events,
        decision.tick,
        f.commands,
        decision.order,
      );
      assert.equal(
        before.events.some((e) => e.order === decision.order),
        false,
      );
      assert.ok(before.snapshot().acquisition!.results.length);
    }
  }
});
test("active engine fails closed for malformed policy/unknown channels and old engines never accept inspect", () => {
  const f = fixtures()[0],
    spec = structuredClone(f.scenario);
  assert.throws(
    () =>
      new Simulation({
        ...spec,
        acquisition_policy: { ...spec.acquisition_policy!, dwellTicks: 0 },
      }),
  );
  assert.throws(
    () =>
      new Simulation({
        ...spec,
        acquisition_policy: { ...spec.acquisition_policy!, cadenceTicks: 4 },
      }),
  );
  const legacy = { ...spec, engine_version: "vyuha-0.4.0" };
  delete legacy.acquisition_policy;
  const old = new Simulation(legacy);
  while (old.state.tick < 150) old.step(true);
  assert.equal(
    old.act({
      tick: 150,
      order: 0,
      k: "inspect",
      track: "T1",
      channel: "ir",
      request_id: "forbidden",
    }),
    false,
  );
  const sim = new Simulation(spec) as AcquisitionSimulation;
  while (sim.state.tick < 150) sim.step(true);
  assert.equal(
    sim.act({
      tick: 150,
      order: 0,
      k: "inspect",
      track: "T999",
      channel: "ir",
      request_id: "hidden",
    }),
    false,
  );
  assert.equal(sim.events.length, 0);
  assert.equal(sim.nextOrder, 0);
  const before = structuredClone(spec);
  assert.ok(
    sim.act({
      tick: 150,
      order: 0,
      k: "inspect",
      track: "T1",
      channel: "ir",
      request_id: "valid",
    }),
  );
  assert.equal(
    sim.snapshot().acquisition!.samples.length,
    0,
    "pending sampled truth is never published",
  );
  assert.deepEqual(spec, before, "frozen scenario untouched");
});

import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { transpileModule, ModuleKind } from "typescript";
import { FixedStepClock } from "./clock";
import type { Snapshot } from "./types";
test("worker restores pending acquisition, respects release order gaps, correlates duplicates and cancels exactly once", () => {
  const scenario = fixtures()[0].scenario;
  let now = 0,
    interval = () => {};
  const messages: {
    type: string;
    state?: Snapshot;
    action?: Action;
    request_id?: number;
    events?: Action[];
  }[] = [];
  const context = {
    onmessage: null as unknown as (e: { data: object }) => void,
    performance: { now: () => now },
    postMessage: (m: (typeof messages)[number]) => messages.push(m),
    setInterval: (f: () => void) => {
      interval = f;
      return 1;
    },
    clearInterval: () => {},
    exports: {},
    require: (path: string) =>
      path === "./sim"
        ? { Simulation, replay }
        : path === "./clock"
          ? { FixedStepClock }
          : undefined,
  };
  runInNewContext(
    transpileModule(
      readFileSync(new URL("./sim.worker.ts", import.meta.url), "utf8"),
      { compilerOptions: { module: ModuleKind.CommonJS } },
    ).outputText,
    context,
  );
  const send = (data: object) => context.onmessage({ data });
  const event: Action = {
    tick: 150,
    order: 0,
    k: "inspect",
    track: "T1",
    channel: "ir",
    request_id: "restored_ir",
  };
  send({
    type: "init",
    scope: "restored",
    scenario,
    events: [event],
    tick: 160,
  });
  assert.equal(messages.at(-1)!.state!.acquisition!.pending!.releaseTick, 186);
  assert.equal(messages.at(-1)!.state!.acquisition!.samples.length, 0);
  send({ type: "play", scope: "restored" });
  for (let i = 0; i < 30; i++) {
    now += 34;
    interval();
  }
  assert.equal(
    messages.at(-1)!.state!.acquisition!.results[0].releasedOrder,
    1,
  );
  send({
    type: "action",
    scope: "restored",
    request_id: 44,
    action: {
      k: "inspect",
      track: "T1",
      channel: "ir",
      request_id: "restored_ir",
    },
  });
  assert.equal(messages.find((m) => m.request_id === 44)!.type, "rejected");
  send({
    type: "action",
    scope: "restored",
    request_id: 45,
    action: { k: "designate", track: "T1" },
  });
  assert.equal(messages.find((m) => m.request_id === 45)!.action!.order, 2);
  send({ type: "init", scope: "early", scenario, events: [event], tick: 160 });
  send({ type: "finish", scope: "early" });
  const finalSnapshot = messages
    .filter((m) => m.type === "snapshot")
    .at(-1)!.state!;
  assert.equal(finalSnapshot.acquisition!.pending, null);
  assert.equal(finalSnapshot.acquisition!.events.at(-1)!.kind, "cancelled");
  assert.equal(finalSnapshot.acquisition!.events.at(-1)!.order, 1);
  const n = messages.filter((m) => m.type === "finalized").length;
  send({ type: "finish", scope: "early" });
  assert.equal(messages.filter((m) => m.type === "finalized").length, n);
});

test("review cursor can precede a known future completion boundary without cancelling or crashing", () => {
  const f = fixtures()[0];
  assert.throws(
    () =>
      replay(f.scenario, [], 0, [], undefined, f.scenario.duration * 30 + 1),
    /completion horizon/,
  );
  const snapshot = replay(
    f.scenario,
    f.events,
    0,
    f.commands,
    undefined,
    160,
  ).snapshot();
  assert.equal(snapshot.tick, 0);
  assert.equal(snapshot.acquisition!.ended, false);
  const atEnd = replay(
    f.scenario,
    f.events.filter((a) => a.tick <= 160),
    160,
    [],
    undefined,
    160,
  ).snapshot();
  assert.equal(atEnd.acquisition!.ended, true);
});
