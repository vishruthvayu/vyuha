import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { testPython } from "./test-python";
import { replay, score } from "./sim";
import type { Action, Scenario, Track } from "./types";
test("authored site loss/reacquisition, requests, expiry and Defer reconstruct identically in Python and TypeScript", () => {
  const fixtures = JSON.parse(
    execFileSync(
      testPython(),
      ["client/src/fixtures/training-sites/project.py"],
      { cwd: "..", encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
    ),
  ) as {
    scenario: Scenario;
    events: Action[];
    checkpoints: {
      tick: number;
      acquisition: unknown;
      tracks: unknown;
      events: Action[];
      commands: unknown;
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
        ),
        state = sim.snapshot();
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
        `${f.scenario.training_site!.id} tick ${p.tick}`,
      );
      count++;
    }
  assert.ok(count >= 40);
  console.info(`Actual site parity checkpoints: ${count}`);
});
