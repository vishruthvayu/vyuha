import { testPython } from "./test-python";
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { replay, score } from "./sim";
import { Silhouette, activeElapsed } from "./RapidID";
import { Trend } from "./Analytics";
import type { Action, AppliedCommand, Scenario, ScoreCard } from "./types";

test("all 15 tactic/pack combinations retain advanced engine, command and ranking parity at 135 checkpoints", () => {
  const result = spawnSync(
    testPython(),
    ["-m", "server.tests.stage5_fixtures"],
    { cwd: "..", encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
  );
  assert.equal(result.status, 0, result.stderr);
  const fixtures = JSON.parse(result.stdout) as {
    scenario: Scenario;
    events: Action[];
    commands: AppliedCommand[];
    checkpoints: {
      tick: number;
      radar_status: string;
      rf_available: boolean;
      tracks: unknown[];
    }[];
    scorecard: ScoreCard;
  }[];
  assert.equal(fixtures.length, 15);
  for (const f of fixtures) {
    for (const c of f.checkpoints) {
      const s = replay(
        f.scenario,
        f.events.filter((a) => a.tick <= c.tick),
        c.tick,
        f.commands.filter((a) => a.tick <= c.tick),
      ).state;
      assert.deepEqual(
        {
          tick: s.tick,
          radar_status: s.radarStatus,
          rf_available: s.rfAvailable,
          tracks: s.tracks.map(
            ({
              id,
              detected,
              resolved,
              impact,
              radar,
              thermal,
              classification,
              declared,
              attempts,
            }) => ({
              id,
              detected,
              resolved,
              impact,
              radar,
              thermal,
              classification,
              declared,
              attempts,
            }),
          ),
        },
        c,
        `${f.scenario.doctrine?.id}:${f.scenario.red_force?.tactic}:${c.tick}`,
      );
    }
    assert.deepEqual(
      score(replay(f.scenario, f.events, 2250, f.commands)),
      f.scorecard,
    );
  }
});

test("Rapid ID renders modeled silhouettes without inventing quad-versus-FPV visual discrimination", () => {
  const quad = renderToStaticMarkup(<Silhouette shape="multirotor" />);
  assert.match(quad, /multirotor thermal silhouette/);
  assert.doesNotMatch(quad, /FPV|Quadcopter/);
  assert.match(
    renderToStaticMarkup(<Silhouette shape="bird" />),
    /bird thermal silhouette/,
  );
  assert.match(
    renderToStaticMarkup(<Silhouette shape={null} />),
    /No modeled observation/,
  );
});

test("historical table displays exact persisted point values and truthful priors", () => {
  const html = renderToStaticMarkup(
    <Trend
      history={{
        points: [
          {
            sequence: 1,
            session_id: "real-session",
            kind: "Rapid ID",
            processed_at: "2026-10-03T00:00:00Z",
            means: {
              detection: 0.5,
              classification_iff: 7 / 12,
              effector_choice: 0.5,
              degraded_sensor_response: 0.5,
            },
            director_focus: null,
            director_mastery_before: null,
          },
        ],
        note: "Persisted ledger; no efficacy claim",
      }}
    />,
  );
  assert.match(html, /58.33%/);
  assert.match(html, /Beta\(1,1\)/);
  assert.match(html, /Rapid ID/);
  assert.match(html, /no efficacy claim/);
});

test("recognition monotonic clock excludes pauses, resumes saved elapsed and clamps the deadline", () => {
  assert.equal(activeElapsed(1200, null, 900000), 1200);
  assert.equal(activeElapsed(1200, 30000, 30450), 1650);
  assert.equal(activeElapsed(4800, 30000, 30450), 5000);
  assert.equal(activeElapsed(5000, null, 1), 5000);
});
