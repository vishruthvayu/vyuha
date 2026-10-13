import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ObservationVisibility,
  OBSERVATION_HOLD_TICKS,
  opticalRenderShape,
  type Vision,
} from "./visibility";
import { Scene } from "./Scene";
import { cameraPose } from "./presentation";
import { makeScenario } from "./scenario";
import { Simulation } from "./sim";
import type { Snapshot, Track } from "./types";
import { observeSensors, type SensorObservation } from "./sensors-v2";

const base = new Simulation(makeScenario(7)).snapshot();
const t: Track = {
  ...base.tracks[0],
  active: true,
  radar: false,
  thermal: false,
  detected: null,
  x: 40,
  z: 80,
};
const state = (tick: number, track: Partial<Track> = {}): Snapshot => ({
  ...base,
  tick,
  tracks: [{ ...t, ...track }],
});
const key = { key: "scenario:session-A" };

test("all live geometric views hide never-observed and radar-only contacts", () => {
  for (const vision of ["day", "night", "thermal"] as Vision[]) {
    const v = new ObservationVisibility();
    assert.deepEqual(v.tracks(state(0), vision, key), []);
    assert.deepEqual(
      v.tracks(state(3, { radar: true, detected: 0 }), vision, key),
      [],
    );
    assert.deepEqual(
      v.tracks(
        state(6, { radar: false, detected: 0, designated: 1 }),
        vision,
        key,
      ),
      [],
    );
  }
});

test("current optical observation permits geometry without historical detection assumptions", () => {
  const v = new ObservationVisibility();
  const observed = v.tracks(
    state(0, { thermal: true, detected: null }),
    "thermal",
    key,
  );
  assert.equal(observed.length, 1);
  assert.equal(observed[0].id, t.id);
});

test("bounded hold freezes observed geometry and never follows hidden current coordinates", () => {
  const v = new ObservationVisibility();
  v.tracks(state(0, { thermal: true }), "thermal", key);
  const held = v.tracks(
    state(3, { x: 999, z: 999, bearing: 120, radar: true }),
    "thermal",
    key,
  );
  assert.equal(held[0].x, 40);
  assert.equal(held[0].z, 80);
  assert.equal(held[0].bearing, t.bearing);
  assert.equal(
    v.tracks(state(OBSERVATION_HOLD_TICKS), "thermal", key).length,
    1,
  );
  assert.deepEqual(
    v.tracks(state(OBSERVATION_HOLD_TICKS + 1), "thermal", key),
    [],
  );
});

test("failure, inactive or absent contacts clear held observations immediately", () => {
  for (const cause of ["failure", "inactive", "absent"]) {
    const v = new ObservationVisibility();
    v.tracks(state(0, { thermal: true }), "thermal", key);
    const next =
      cause === "inactive"
        ? state(1, { active: false })
        : cause === "absent"
          ? { ...state(1), tracks: [] }
          : state(1);
    assert.deepEqual(
      v.tracks(next, "thermal", {
        ...key,
        opticalAvailable: cause !== "failure",
      }),
      [],
    );
    assert.deepEqual(v.tracks(state(2), "thermal", key), []);
  }
});

test("session/scenario key, backward seek, long jump and channel changes cannot carry memory", () => {
  const cases: [number, Vision, string][] = [
    [3, "thermal", "scenario:session-B"],
    [-1, "thermal", key.key],
    [60, "thermal", key.key],
    [3, "day", key.key],
  ];
  for (const [tick, vision, context] of cases) {
    const v = new ObservationVisibility();
    v.tracks(state(0, { thermal: true }), "thermal", key);
    assert.deepEqual(v.tracks(state(tick), vision, { key: context }), []);
  }
});

test("a reset at tick zero clears a same-tick prior observation even before a new key arrives", () => {
  const v = new ObservationVisibility();
  v.tracks(state(0, { thermal: true }), "thermal", key);
  assert.deepEqual(v.tracks(state(0), "thermal", key), []);
});

test("follow and overview framing use only observed geometry", () => {
  const v = new ObservationVisibility();
  const tracks = v.tracks(
    state(0, { radar: true, distance: 9999 }),
    "day",
    key,
  );
  const follow = cameraPose("follow", tracks, t.id);
  assert.equal(follow.effective, "overview");
  assert.equal(follow.fallback, true);
  assert.deepEqual(follow, cameraPose("follow", [], null));
});

test("reference truth is explicit, labelled and does not seed trainee visibility memory", () => {
  const v = new ObservationVisibility();
  assert.equal(
    v.tracks(state(0), "day", { ...key, groundTruth: true }).length,
    1,
  );
  assert.deepEqual(v.tracks(state(1), "day", key), []);
  assert.deepEqual(
    v.tracks(state(2, { active: false }), "day", { ...key, groundTruth: true }),
    [],
  );
  const props = {
    state: state(0),
    vision: "day" as const,
    selected: t.id,
    onFps: () => {},
    fallback: <p>Fallback</p>,
  };
  assert.doesNotMatch(
    renderToStaticMarkup(<Scene {...props} />),
    /REFERENCE TRUTH/,
  );
  assert.match(
    renderToStaticMarkup(<Scene {...props} groundTruth />),
    /REFERENCE TRUTH/,
  );
});

test("presentation gating never changes snapshots or scoring inputs", () => {
  const snapshot = state(0, { thermal: true });
  const before = JSON.stringify(snapshot);
  const tracks = new ObservationVisibility().tracks(snapshot, "thermal", key);
  tracks[0].x = 900;
  tracks[0].attempts.push("kinetic");
  assert.equal(JSON.stringify(snapshot), before);
});

const sensorObservation = (): SensorObservation =>
  observeSensors(17, 0, 0, { ...t, x: 20, z: 100 }, { night: false, fog: 0 })
    .observation;
function withObservation(observation: SensorObservation, tick = 0): Snapshot {
  return {
    ...state(tick),
    tracks: [{ ...t, thermal: true, x: 999, z: 999, observation } as Track],
  };
}

test("v0.4 DAY TV uses EO while thermal and infrared-styled night use IR", () => {
  const observation = sensorObservation();
  observation.eo = {
    available: false,
    level: "none",
    silhouette: null,
    position: null,
    sample_tick: null,
  };
  observation.ir = {
    available: true,
    level: "recognise",
    silhouette: "multirotor",
    position: { x: 20, z: 100, altitude: 18 },
    sample_tick: 0,
  };
  for (const vision of ["thermal", "night"] as const) {
    const visible = new ObservationVisibility().tracks(
      withObservation(observation),
      vision,
      key,
    );
    assert.equal(visible.length, 1);
    assert.equal(visible[0].x, 20);
    assert.equal(visible[0].altitude, 18);
  }
  assert.deepEqual(
    new ObservationVisibility().tracks(
      withObservation(observation),
      "day",
      key,
    ),
    [],
  );
});

test("v0.4 detection does not expose bird/quad/fixed-wing truth geometry before recognition", () => {
  const observation = sensorObservation();
  observation.eo = {
    available: true,
    level: "detect",
    silhouette: null,
    position: { x: 20, z: 100, altitude: 18 },
    sample_tick: 0,
  };
  for (const kind of ["bird", "quad", "fixed_wing", "fiber_fpv"] as const) {
    const snapshot = withObservation(observation);
    snapshot.tracks[0].kind = kind;
    const visible = new ObservationVisibility().tracks(snapshot, "day", key);
    assert.equal(opticalRenderShape(visible[0]), "unresolved");
  }
  observation.eo.level = "recognise";
  observation.eo.silhouette = "multirotor";
  const misleadingTruth = withObservation(observation);
  misleadingTruth.tracks[0].kind = "bird";
  assert.equal(
    opticalRenderShape(
      new ObservationVisibility().tracks(misleadingTruth, "day", key)[0],
    ),
    "multirotor",
  );
});

test("v0.4 unavailable channel clears held geometry immediately despite legacy thermal flag", () => {
  const v = new ObservationVisibility(),
    observation = sensorObservation();
  assert.equal(v.tracks(withObservation(observation), "day", key).length, 1);
  observation.eo = {
    available: false,
    level: "none",
    silhouette: null,
    position: null,
    sample_tick: null,
  };
  assert.deepEqual(v.tracks(withObservation(observation, 3), "day", key), []);
  observation.eo.available = true;
  assert.deepEqual(v.tracks(withObservation(observation, 4), "day", key), []);
});

test("v0.4 reference truth intentionally bypasses observation masking and is opt-in", () => {
  const observation = sensorObservation();
  observation.eo = {
    available: false,
    level: "none",
    silhouette: null,
    position: null,
    sample_tick: null,
  };
  const snapshot = withObservation(observation);
  assert.equal(
    new ObservationVisibility().tracks(snapshot, "day", {
      ...key,
      groundTruth: true,
    })[0].x,
    999,
  );
  assert.deepEqual(
    new ObservationVisibility().tracks(snapshot, "day", key),
    [],
  );
});
