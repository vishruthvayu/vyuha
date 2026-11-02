import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { testPython } from "./test-python";
import { Simulation, score } from "./sim";
import {
  vrInspectAction,
  vrDeferAction,
  vrEngineReason,
  vrLaunchReadiness,
  vrObservationEvidence,
  vrObservationStatus,
} from "./vr-observation";
import { vrAction, vrContacts, vrRenderContacts } from "./vr";
import { ObservationVisibility } from "./visibility";
import type { Scenario, Action } from "./types";
const fixtures = JSON.parse(
  execFileSync(
    testPython(),
    [
      "-c",
      `import json
from server.acquisition import make_practice
from server.observation_missions_v3 import compile_mission
print(json.dumps([make_practice(),make_practice(night=True),compile_mission(dict(template='timed_window',site='freight_corridor')),compile_mission(dict(template='timed_window',site='open_campus',mode='assessment'))]))`,
    ],
    { cwd: "..", encoding: "utf8" },
  ),
) as Scenario[];
const at = (sim: Simulation, tick: number) => {
  while (sim.state.tick < tick) sim.step(true);
  return sim;
};
const normalize = (x: unknown): unknown =>
  typeof x === "number"
    ? Math.round(x * 1e6) / 1e6
    : Array.isArray(x)
      ? x.map(normalize)
      : x && typeof x === "object"
        ? Object.fromEntries(
            Object.entries(x).map(([k, v]) => [k, normalize(v)]),
          )
        : x;
for (const scenario of fixtures)
  test(`VR shared actions reconstruct unchanged Python evidence and score for ${scenario.engine_version}/${scenario.training_site?.id ?? "no-site"}`, () => {
    const sim = at(new Simulation(scenario), 150);
    assert.equal(vrEngineReason(scenario), null);
    const before = structuredClone(sim.snapshot()),
      request = vrInspectAction(
        before,
        "running",
        scenario,
        "T1",
        "ir",
        "xr_request_1",
      );
    assert.ok(request);
    assert.ok(sim.act({ ...request, tick: sim.state.tick }));
    assert.equal(
      vrInspectAction(
        sim.snapshot(),
        "running",
        scenario,
        "T1",
        "eo",
        "xr_request_2",
      ),
      undefined,
    );
    const q = sim.snapshot().acquisition!.pending!;
    assert.ok(q);
    assert.match(
      vrObservationEvidence(sim.snapshot(), "T2").join(" "),
      /Pending IR \/ T1/,
    );
    assert.deepEqual(before.acquisition!.requests, []);
    at(sim, q.releaseTick);
    assert.match(
      vrObservationEvidence(sim.snapshot(), "T1").join(" "),
      /RELEASED|UNAVAILABLE/,
    );
    const events: Omit<Action, "tick">[] = [];
    if (scenario.engine_version === "vyuha-0.6.0") {
      assert.equal(
        vrDeferAction(sim.snapshot(), "running", scenario, "T1", null),
        undefined,
      );
      const prior = score(sim),
        action = vrDeferAction(
          sim.snapshot(),
          "running",
          scenario,
          "T1",
          "affiliation_unresolved",
        );
      assert.ok(action);
      assert.ok(sim.act({ ...action, tick: sim.state.tick }));
      assert.deepEqual(score(sim), prior);
      events.push(action);
    }
    const designation = vrAction(
      sim.snapshot(),
      "running",
      scenario,
      "T1",
      "designate",
      null,
      null,
    );
    assert.ok(designation);
    assert.ok(sim.act({ ...designation, tick: sim.state.tick }));
    events.push(designation);
    assert.equal(
      vrAction(
        sim.snapshot(),
        "running",
        scenario,
        "T1",
        "classify",
        null,
        "neutral",
      ),
      undefined,
    );
    const classify = vrAction(
      sim.snapshot(),
      "running",
      scenario,
      "T1",
      "classify",
      "quad",
      "neutral",
    );
    assert.ok(classify);
    assert.ok(sim.act({ ...classify, tick: sim.state.tick }));
    events.push(classify);
    const hold = vrAction(
      sim.snapshot(),
      "running",
      scenario,
      "T1",
      "engage",
      "quad",
      "neutral",
      "hold",
    );
    assert.ok(hold);
    assert.ok(sim.act({ ...hold, tick: sim.state.tick }));
    events.push(hold);
    at(sim, q.releaseTick + scenario.acquisition_policy!.expiryTicks);
    assert.match(
      vrObservationEvidence(sim.snapshot(), "T1").join(" "),
      /EXPIRED/,
    );
    const py = JSON.parse(
      execFileSync(
        testPython(),
        [
          "-c",
          `import json,sys
from server.engine import replay,score
x=json.load(sys.stdin);s=replay(x['scenario'],x['actions'],x['end']);print(json.dumps(dict(events=s.events,acquisition=s.acquisition_snapshot(),score=score(s))))`,
        ],
        {
          cwd: "..",
          input: JSON.stringify({
            scenario,
            actions: sim.events,
            end: sim.state.tick,
          }),
          encoding: "utf8",
        },
      ),
    );
    assert.deepEqual(py.events, sim.events);
    assert.deepEqual(
      normalize(py.acquisition),
      normalize(sim.snapshot().acquisition),
    );
    assert.deepEqual(normalize(py.score), normalize(score(sim)));
    assert.ok(events.length >= 3);
  });
test("VR launch separates preparation, unsupported policy/version and lifecycle from headset capability", () => {
  const s = fixtures[2];
  assert.equal(vrLaunchReadiness(s, "ready", false, false).allowed, false);
  assert.match(vrLaunchReadiness(s, "ready", false, false).reason, /Prepare/);
  assert.equal(vrLaunchReadiness(s, "ready", true, false).allowed, true);
  assert.equal(vrLaunchReadiness(s, "paused", true, false).allowed, true);
  for (const phase of ["complete", "restoring"] as const)
    assert.equal(vrLaunchReadiness(s, phase, true, false).allowed, false);
  assert.match(
    vrEngineReason({ ...s, engine_version: "vyuha-9.0.0" })!,
    /No VR adapter/,
  );
  assert.match(
    vrEngineReason({ ...s, decision_policy: undefined })!,
    /uncertainty/,
  );
  assert.match(
    vrEngineReason({ ...s, acquisition_policy: undefined })!,
    /acquisition/,
  );
});
test("VR fails closed on missing/future observations and keeps Defer tied to prior observed alias without invented current geometry", () => {
  const scenario = fixtures[2],
    state = at(new Simulation(scenario), 150).snapshot();
  const altered = structuredClone(state),
    t = altered.tracks.find((t) => t.id === "T1")!;
  delete t.observation;
  Object.assign(t, { x: 99999, z: 99999, thermal: true, radar: true });
  assert.equal(
    vrInspectAction(altered, "running", scenario, "T1", "eo", "request"),
    undefined,
  );
  assert.deepEqual(
    vrRenderContacts(
      altered,
      scenario,
      "day",
      new ObservationVisibility(),
      "new",
    ).filter((x) => x.id === "T1"),
    [],
  );
  assert.ok(!vrContacts(altered).some((x) => x.id === "T1"));
  const stale = structuredClone(state),
    o = stale.tracks.find((t) => t.id === "T1")!.observation!;
  o.radar.detected = false;
  o.radar.position = null;
  o.eo.position = null;
  o.ir.position = null;
  assert.equal(
    vrAction(stale, "running", scenario, "T1", "designate", null, null),
    undefined,
  );
  assert.ok(vrDeferAction(stale, "running", scenario, "T1", "type_unresolved"));
  assert.equal(
    vrDeferAction(stale, "paused", scenario, "T1", "type_unresolved"),
    undefined,
  );
  assert.equal(
    vrDeferAction(stale, "running", fixtures[0], "T1", "type_unresolved"),
    undefined,
  );
  assert.equal(
    vrDeferAction(stale, "running", scenario, "hidden", "type_unresolved"),
    undefined,
  );
  const future = structuredClone(state);
  future.tracks[0].observation!.radar.sample_tick = state.tick + 100;
  assert.equal(
    vrInspectAction(
      future,
      "running",
      scenario,
      future.tracks[0].id,
      "eo",
      "request",
    ),
    undefined,
  );
});
test("VR evidence never publishes future or malformed result timing and selection never redirects retained results", () => {
  const sim = at(new Simulation(fixtures[2]), 150),
    a = vrInspectAction(
      sim.snapshot(),
      "running",
      fixtures[2],
      "T1",
      "eo",
      "future_fixture",
    )!;
  sim.act({ ...a, tick: 150 });
  at(sim, sim.snapshot().acquisition!.pending!.releaseTick);
  const state = sim.snapshot(),
    original = JSON.stringify(state);
  assert.match(vrObservationEvidence(state, "other").join(" "), /No released/);
  const future = structuredClone(state);
  future.acquisition!.results[0].releaseTick = state.tick + 1;
  assert.doesNotMatch(
    vrObservationEvidence(future, "T1").join(" "),
    /RELEASED|Shape/,
  );
  const malformed = structuredClone(state);
  malformed.acquisition!.results[0].sampleTick = -1;
  assert.doesNotMatch(
    vrObservationEvidence(malformed, "T1").join(" "),
    /RELEASED/,
  );
  assert.equal(JSON.stringify(state), original);
});

test("browser and XR reject malformed or future pending metadata without throwing or publishing", () => {
  const sim = at(new Simulation(fixtures[2]), 150);
  const request = vrInspectAction(
    sim.snapshot(),
    "running",
    fixtures[2],
    "T1",
    "eo",
    "valid_pending",
  );
  assert.ok(request);
  sim.act({ ...request, tick: sim.state.tick });
  const snapshot = sim.snapshot(),
    pending = snapshot.acquisition!.pending!;
  for (const change of [
    { channel: null },
    { trackId: "" },
    { acceptedTick: 151 },
    { acceptedTick: -1 },
    { sampleTick: undefined },
    { sampleTick: 149 },
    { releaseTick: 150 },
    { releaseTick: pending.sampleTick - 1 },
  ]) {
    const bad = structuredClone(snapshot);
    Object.assign(bad.acquisition!.pending!, change);
    assert.doesNotThrow(() => vrObservationEvidence(bad, "T1"));
    assert.doesNotMatch(
      vrObservationEvidence(bad, "T1").join(" "),
      /Pending|NaN/,
    );
    assert.equal(vrObservationStatus(bad), "No optical publication yet");
  }
  assert.deepEqual(snapshot.acquisition!.pending, pending);
});
