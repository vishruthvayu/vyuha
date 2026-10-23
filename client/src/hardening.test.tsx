import { testPython } from "./test-python";
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { replay, score } from "./sim";
import { recordedObservations, type Recording } from "./observations";
import { audioCue } from "./LocalAudio";
import { qualityAfterSamples, pixelRatio } from "./quality";
import { parseJSONImport } from "./import-json";
import {
  scaleScenario,
  finaleScaleScenario,
  retainedWorldScenario,
  median,
} from "./Benchmark";
import { Simulation } from "./sim";
import Evidence from "./Evidence";
import Transfer from "./Transfer";
import Evaluation from "./Evaluation";
import Recorded from "./Recorded";
import type { Action, Scenario, ScoreCard, Track } from "./types";

test("rural terrain/fog preserve score and sensor parity at 54 new checkpoints; recorded adapters match", () => {
  const r = spawnSync(testPython(), ["-m", "server.tests.hardening_fixtures"], {
    cwd: "..",
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  assert.equal(r.status, 0, r.stderr);
  const f = JSON.parse(r.stdout) as {
    rural: {
      scenario: Scenario;
      events: Action[];
      checkpoints: {
        tick: number;
        radar_status: string;
        rf_available: boolean;
        tracks: unknown[];
      }[];
      scorecard: ScoreCard;
    }[];
    recording: Recording;
    recorded_observations: unknown[];
  };
  assert.equal(f.rural.length, 6);
  for (const x of f.rural) {
    assert.equal(x.scenario.terrain_id, "rural_forward_base");
    for (const c of x.checkpoints) {
      const s = replay(
        x.scenario,
        x.events.filter((e) => e.tick <= c.tick),
        c.tick,
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
      );
    }
    assert.deepEqual(score(replay(x.scenario, x.events, 2250)), x.scorecard);
  }
  assert.deepEqual(
    [0, 29, 30, 299, 300].map((t) => recordedObservations(f.recording, t)),
    f.recorded_observations,
  );
});

test("audio range, observed-contact gate, bird exclusion and fog attenuation prevent omniscient cues", () => {
  const t = { x: 20, z: 20, active: true, detected: 0, kind: "quad" } as Track;
  const cue = audioCue(t, 0)!;
  assert.ok(cue.gain > 0 && cue.pan > 0);
  assert.ok(audioCue(t, 0.6)!.gain < cue.gain);
  assert.equal(audioCue({ ...t, detected: null }, 0), null);
  assert.equal(audioCue({ ...t, x: 80, z: 0 }, 0), null);
  assert.equal(audioCue({ ...t, kind: "bird" }, 0), null);
  assert.equal(audioCue({ ...t, active: false }, 0), null);
});

test("quality changes require sustained measured low FPS and reach tactical fallback", () => {
  assert.equal(qualityAfterSamples("high", [10, 10]), "high");
  assert.equal(qualityAfterSamples("high", [10, 10, 30]), "high");
  assert.equal(qualityAfterSamples("high", [10, 10, 10]), "medium");
  assert.equal(qualityAfterSamples("medium", [10, 10, 10]), "low");
  assert.equal(qualityAfterSamples("low", [10, 10, 10]), "tactical");
  assert.ok(pixelRatio.low < pixelRatio.high);
});

test("bounded JSON import errors reject malformed/object shape and UTF-8 byte overruns", () => {
  assert.deepEqual(parseJSONImport('{"schema_version":1}', 100), {
    schema_version: 1,
  });
  assert.throws(() => parseJSONImport("[]", 100), /object/);
  assert.throws(() => parseJSONImport("{", 100), /Invalid JSON/);
  assert.throws(() => parseJSONImport('{"x":"🌾"}', 10), /size limit/);
});

test("scale fixtures keep all contact kinds, deterministic positions and supported counts", () => {
  for (const n of [8, 25, 50, 100, 200]) {
    const s = scaleScenario(n);
    assert.equal(s.tracks.length, n);
    assert.equal(new Set(s.tracks.map((t) => t.id)).size, n);
    assert.deepEqual(s, scaleScenario(n));
    assert.ok(s.tracks.every((t) => t.spawn === 0 && t.speed > 0));
  }
  assert.throws(() => scaleScenario(1000));
  assert.equal(median([1, 5, 2, 4]), 3);
});

test("evidence/import interfaces show limitations without fabricated final validation claims", () => {
  const e = renderToStaticMarkup(<Evidence />);
  assert.match(e, /versioned validation manifest/);
  assert.doesNotMatch(e, /106 passed|130 passed/);
  const t = renderToStaticMarkup(<Transfer />);
  assert.match(t, /HMAC-SHA256/);
  assert.match(t, /Authenticated officer transfer/);
  assert.match(t, /Validate and import bundle/);
  const r = renderToStaticMarkup(<Recorded />);
  assert.match(r, /No tactical score/);
  assert.match(r, /missing ground truth remains unassessable/);
  assert.match(r, /Validate and import JSON/);
});

test("evaluation enrollment requires participant agreement and pseudonymous IDs", () => {
  const old = globalThis.localStorage;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: () => null },
  });
  try {
    const html = renderToStaticMarkup(<Evaluation />);
    assert.match(html, /Participant ID/);
    assert.match(html, /Participant has agreed/);
    assert.match(html, /disabled=""[^>]*>Create evaluation protocol/);
    assert.match(html, /No human study is conducted automatically/);
  } finally {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: old,
    });
  }
});

test("bulk transfer timeout can exceed the six-second tactical request timeout without changing request payloads", async () => {
  const { api, RECONSTRUCTION_TIMEOUT_MS } = await import("./storage");
  const oldFetch = globalThis.fetch,
    oldTimeout = AbortSignal.timeout;
  const limits: number[] = [];
  const requests: RequestInit[] = [];
  AbortSignal.timeout = (ms: number) => {
    limits.push(ms);
    return new AbortController().signal;
  };
  globalThis.fetch = async (_url, options) => {
    requests.push(options!);
    return { ok: true, json: async () => ({ accepted: true }) } as Response;
  };
  try {
    assert.deepEqual(await api("/health"), { accepted: true });
    await api("/bundle/import", { schema_version: 1 }, 120000);
    await api(
      "/sessions/synthetic/complete",
      { end_tick: 1800 },
      RECONSTRUCTION_TIMEOUT_MS,
    );
    assert.deepEqual(limits, [6000, 120000, 120000]);
    assert.equal(requests[2].method, "POST");
    assert.equal(requests[2].body, '{"end_tick":1800}');
    assert.equal(requests[0].method, "GET");
    assert.equal(requests[1].method, "POST");
    assert.equal(requests[1].body, '{"schema_version":1}');
  } finally {
    globalThis.fetch = oldFetch;
    AbortSignal.timeout = oldTimeout;
  }
});

test("Finale benchmark exercises dispatched sensor truth at every supported contact scale", () => {
  for (const n of [8, 25, 50, 100, 200]) {
    const scenario = finaleScaleScenario(n);
    const sim = new Simulation(scenario);
    assert.equal(scenario.version, 2);
    assert.equal(scenario.engine_version, "vyuha-0.4.0");
    assert.equal(sim.snapshot().tracks.length, n);
    for (let i = 0; i < 31; i++) sim.step();
    assert.ok(
      sim
        .snapshot()
        .tracks.every((t) => t.observation?.version === "vyuha-0.4.0"),
    );
    assert.equal(sim.snapshot().response?.kinetic_ammo_remaining, 8);
  }
});

test("longer Finale stress fixture keeps a full logical horizon and rejects unsupported durations", () => {
  const scenario = finaleScaleScenario(200, 180);
  assert.equal(scenario.duration, 180);
  assert.equal(scenario.tracks.length, 200);
  assert.equal(new Simulation(scenario).snapshot().done, false);
  assert.throws(() => finaleScaleScenario(200, 65));
});

test("retained benchmark keeps all 200 contacts active for the complete 180-second workload without changing the engine", () => {
  const scenario = retainedWorldScenario(200, 180, "rural_forward_base", false);
  const sim = new Simulation(scenario);
  for (let i = 0; i < 5400; i++) {
    sim.step(true);
    if (i % 900 === 899)
      assert.equal(
        sim.snapshot().tracks.filter((t) => t.active).length,
        200,
        `tick ${i + 1}`,
      );
  }
  assert.equal(sim.events.length, 0);
  assert.equal(sim.state.tick, 5400);
  assert.equal(scenario.engine_version, "vyuha-0.4.0");
});
