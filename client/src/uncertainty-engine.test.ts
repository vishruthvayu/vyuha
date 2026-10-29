import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { testPython } from "./test-python";
import { replay, score } from "./sim";
import type { Action, AppliedCommand, Scenario, Track } from "./types";
test("v0.6 Python/TypeScript agree at 45 real uncertainty, publication, fault and cancellation checkpoints", () => {
  const fixtures = JSON.parse(
    execFileSync(
      testPython(),
      ["client/src/fixtures/uncertainty-engine/project.py"],
      { cwd: "..", encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
    ),
  ) as {
    scenario: Scenario;
    events: Action[];
    commands: AppliedCommand[];
    early_end: number | null;
    checkpoints: {
      tick: number;
      acquisition: unknown;
      tracks: unknown;
      events: Action[];
      commands: AppliedCommand[];
      score: unknown;
    }[];
  }[];
  let count = 0;
  for (const f of fixtures)
    for (const p of f.checkpoints) {
      const sim = replay(
        f.scenario,
        f.events.filter((a) => a.tick <= p.tick),
        p.tick,
        f.commands.filter((c) => c.tick <= p.tick),
        undefined,
        f.early_end ?? undefined,
      );
      const state = sim.snapshot();
      assert.deepEqual(
        {
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
              ].map((k) => [k, t[k as keyof Track]]),
            ),
          ),
          events: sim.events,
          commands: sim.commands,
          score: score(sim),
        },
        p,
        `${f.scenario.observation_mission?.template} tick ${p.tick}`,
      );
      count++;
    }
  assert.equal(count, 45);
});

import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { transpileModule, ModuleKind } from "typescript";
import { Simulation } from "./sim";
import { FixedStepClock } from "./clock";
import { vrAction } from "./vr";
import type { Snapshot } from "./types";
test("real worker restores unclassified Defer, preserves request ownership and rejects duplicate/stale/paused/end actions", () => {
  const scenario = JSON.parse(
    execFileSync(
      testPython(),
      [
        "-c",
        "import json;from server.observation_missions_v2 import compile_mission;print(json.dumps(compile_mission({})))",
      ],
      { cwd: "..", encoding: "utf8" },
    ),
  ) as Scenario;
  const messages: {
    type: string;
    request_id?: number;
    action?: Action;
    events?: Action[];
    state?: Snapshot;
    scope?: string;
  }[] = [];
  const context = {
    onmessage: null as unknown as (e: { data: object }) => void,
    performance: { now: () => 0 },
    postMessage: (m: (typeof messages)[number]) => messages.push(m),
    setInterval: () => 1,
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
  const a = {
    k: "defer",
    track: "T1",
    decision_version: "uncertainty-decisions-v1",
    reason: "affiliation_unresolved",
  };
  send({ type: "init", scope: "A", scenario, events: [], tick: 150 });
  send({ type: "action", scope: "A", request_id: 1, action: a });
  assert.equal(messages.find((m) => m.request_id === 1)?.type, "rejected");
  send({ type: "play", scope: "A" });
  send({ type: "action", scope: "A", request_id: 2, action: a });
  const accepted = messages.find((m) => m.request_id === 2)!;
  assert.equal(accepted.type, "accepted");
  assert.equal(accepted.action?.reason, "affiliation_unresolved");
  assert.equal(accepted.action?.order, 0);
  send({ type: "action", scope: "A", request_id: 3, action: a });
  assert.equal(messages.find((m) => m.request_id === 3)?.type, "rejected");
  send({
    type: "init",
    scope: "B",
    scenario,
    events: [accepted.action],
    tick: 150,
  });
  assert.equal(messages.at(-1)?.state?.tracks[0].classification, null);
  const count = messages.length;
  send({ type: "action", scope: "A", request_id: 4, action: a });
  assert.equal(messages.length, count);
  send({ type: "finish", scope: "B" });
  const log = messages.filter((m) => m.type === "finalized").at(-1)!.events!;
  assert.equal(JSON.stringify(log), JSON.stringify([accepted.action]));
  send({ type: "action", scope: "B", request_id: 5, action: a });
  assert.equal(messages.find((m) => m.request_id === 5)?.type, "rejected");
  assert.equal(
    vrAction(
      replay(scenario, [], 150).snapshot(),
      "running",
      scenario,
      "T1",
      "designate",
      "quad",
      "hostile",
    ),
    undefined,
    "new acquisition/action contract is not silently admitted to XR",
  );
});
