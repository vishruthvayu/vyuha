import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { observeSensors } from "./sensors-v2";
import { replay } from "./sim";
import {
  reviewObservationFrame,
  reviewObservationSnapshot,
  decisionMoment,
  evidenceAtCursor,
  reviewEpisodeMoments,
} from "./review-frame";
import type {
  Snapshot,
  Track,
  DecisionReview,
  Scenario,
  TimelineItem,
} from "./types";

function fixture(): Snapshot {
  const track = {
    id: "T1",
    spawn: 0,
    bearing: 0,
    distance: 300,
    speed: 0,
    kind: "quad",
    identity: "hostile",
    rf: true,
    x: 0,
    z: 300,
    altitude: 20,
    active: true,
  };
  const o = observeSensors(17, 90, 0, track, {
    night: false,
    fog: 0,
  }).observation;
  o.radar = {
    available: true,
    state: "confirmed",
    detected: true,
    fresh: false,
    position: { x: 1, z: 301, altitude: 20 },
    sample_tick: 60,
  };
  return {
    tick: 90,
    tracks: [
      {
        ...track,
        observation: o,
        declared: null,
        classification: null,
        detected: 0,
        designated: null,
        attempts: [],
        radar: true,
        thermal: true,
        resolved: false,
        impact: false,
      } as Track,
    ],
    falseContacts: [],
    jammed: false,
    radarStatus: "normal",
    rfAvailable: true,
    night: false,
    paused: true,
    done: false,
    messages: [{ tick: 90, track: "T1", text: "SECRET truth message" }],
  };
}
test("cursor projection uses public channels and trainee declaration, never canonical truth", () => {
  const state = fixture(),
    before = structuredClone(state),
    first = reviewObservationFrame(state);
  assert.equal(first.contacts.length, 1);
  assert.match(first.contacts[0].radar, /coasting · 1.00s old/);
  assert.equal(first.contacts[0].declaration, "Unclassified");
  assert.deepEqual(
    Object.keys(first.contacts[0]).sort(),
    ["id", "declaration", "radar", "eo", "ir", "rf", "iff"].sort(),
  );
  const changed = structuredClone(state);
  Object.assign(changed.tracks[0], {
    kind: "fiber_fpv",
    identity: "friendly",
    rf: false,
    x: 999999,
    z: -88888,
    altitude: 10000,
  });
  assert.deepEqual(reviewObservationFrame(changed), first);
  assert.doesNotMatch(
    JSON.stringify(first),
    /SECRET|999999|hostile|friendly_reply/,
  );
  assert.deepEqual(state, before);
});
test("future, mismatched and missing modern reports fail closed without truth fallback", () => {
  const state = fixture(),
    o = state.tracks[0].observation!;
  o.rf.detected = false;
  o.iff.cue = "no_reply";
  for (const key of ["eo", "ir", "radar"] as const) o[key].sample_tick = 91;
  assert.equal(reviewObservationFrame(state).contacts.length, 0);
  o.tick = 89;
  assert.equal(reviewObservationFrame(state).contacts.length, 0);
  o.tick = 90;
  o.track_id = "OTHER";
  assert.equal(reviewObservationFrame(state).contacts.length, 0);
  delete state.tracks[0].observation;
  assert.equal(reviewObservationFrame(state).contacts.length, 0);
});
test("unavailable channels cannot expose contacts; no IFF reply is never hostile evidence", () => {
  const state = fixture(),
    o = state.tracks[0].observation!;
  o.iff.cue = "no_reply";
  assert.match(
    reviewObservationFrame(state).contacts[0].iff,
    /identity remains uncertain/,
  );
  for (const key of ["eo", "ir", "rf", "iff", "radar"] as const)
    o[key].available = false;
  assert.equal(reviewObservationFrame(state).contacts.length, 0);
});
test("legacy reports disclose absent provenance and never synthesize RF or IFF truth", () => {
  const state = fixture();
  delete state.falseContacts;
  delete state.tracks[0].observation;
  const frame = reviewObservationFrame(state);
  assert.equal(frame.modern, false);
  assert.match(frame.contacts[0].ir, /sample time unavailable/);
  assert.equal(frame.contacts[0].rf, "Not recorded");
  assert.equal(frame.contacts[0].iff, "Not recorded");
  state.tracks[0].radar = false;
  state.tracks[0].thermal = false;
  assert.equal(reviewObservationFrame(state).contacts.length, 0);
});
test("decision alignment includes the same-tick action boundary and absent actions", () => {
  const review = {
    tick: 90,
    order: 2,
    track_id: "T1",
    trainee_action: { k: "classify" },
    evidence: { tick: 90 },
  } as DecisionReview;
  assert.deepEqual(decisionMoment(review), {
    tick: 90,
    beforeOrder: 2,
    track: "T1",
  });
  assert.equal(evidenceAtCursor(review, 90, 2), true);
  assert.equal(evidenceAtCursor(review, 90, 3), false);
  assert.equal(evidenceAtCursor(review, 90), false);
  assert.equal(evidenceAtCursor(review, 91, 2), false);
  assert.equal(
    evidenceAtCursor({ ...review, trainee_action: null }, 90),
    false,
  );
});
test("real frozen v0.4 reconstruction supplies current observation timestamps without changing scores/history", () => {
  const scenario = JSON.parse(
    readFileSync(
      new URL("./command-restoration-scenario.json", import.meta.url),
      "utf8",
    ),
  ) as Scenario;
  const before = structuredClone(scenario),
    sim = replay(scenario, [], 120),
    state = sim.snapshot();
  const frame = reviewObservationFrame(state);
  assert.equal(frame.modern, true);
  assert.equal(frame.tick, 120);
  assert.ok(frame.contacts.length > 0);
  assert.deepEqual(
    reviewObservationFrame(replay(scenario, [], 120).snapshot()),
    frame,
  );
  assert.deepEqual(scenario, before);
  assert.deepEqual(sim.events, []);
});

test("missing-action review time never masquerades as its first-observation evidence time", () => {
  const review = {
    tick: 1800,
    order: null,
    track_id: "T1",
    trainee_action: null,
    evidence: { tick: 60 },
  } as unknown as DecisionReview;
  assert.equal(evidenceAtCursor(review, 1800), false);
  assert.equal(evidenceAtCursor(review, 60), false);
  const omitted = {
    ...review,
    tick: 60,
    trainee_action: { k: "designate" },
    order: undefined,
  } as unknown as DecisionReview;
  assert.equal(evidenceAtCursor(omitted, 60), false);
});
test("investigation chapters preserve exact source boundaries without inventing order or outcomes", () => {
  const review = {
    tick: 90,
    order: 2,
    track_id: "T1",
    trainee_action: { k: "designate" },
    evidence: { tick: 90, first_detectable_tick: 60 },
    consequence: { kind: "resolved", tick: 120 },
  } as DecisionReview;
  const event = (
    tick: number,
    category: TimelineItem["category"],
    order: number | null,
    seek_before = false,
  ): TimelineItem => ({
    id: category,
    tick,
    category,
    order,
    seek_before,
    track_id: "T1",
    decision_id: null,
    code: "QA",
    title: "QA",
  });
  const timeline = [
    event(60, "contact_detection", 1),
    event(120, "contact_resolution", 4),
  ];
  const before = structuredClone({ review, timeline });
  const chapters = reviewEpisodeMoments(review, timeline, 120);
  assert.deepEqual(
    chapters.map((c) => c.point),
    [
      { tick: 60, beforeOrder: 2 },
      { tick: 90, beforeOrder: 2 },
      { tick: 120, beforeOrder: 5 },
    ],
  );
  assert.deepEqual({ review, timeline }, before);
  assert.equal(reviewEpisodeMoments(review, timeline, 119)[2].point, null);
  const missing = { ...review, tick: 1800, order: null, trainee_action: null };
  assert.deepEqual(reviewEpisodeMoments(missing, [], 1800)[1].point, {
    tick: 90,
    beforeOrder: undefined,
  });
  assert.deepEqual(reviewEpisodeMoments(review, [], 120)[0].point, {
    tick: 60,
    beforeOrder: undefined,
  });
  for (const first of [null, -1, 121])
    assert.equal(
      reviewEpisodeMoments(
        {
          ...review,
          evidence: { ...review.evidence, first_detectable_tick: first },
        },
        timeline,
        120,
      )[0].point,
      null,
    );
  for (const kind of ["hold", "remained_active", "no_consequence_yet"] as const)
    assert.equal(
      reviewEpisodeMoments(
        { ...review, consequence: { ...review.consequence, kind } },
        timeline,
        120,
      )[2].point,
      null,
    );
  const same = {
    ...review,
    consequence: {
      ...review.consequence,
      kind: "asset_impact" as const,
      tick: 90,
    },
  };
  assert.deepEqual(
    reviewEpisodeMoments(same, [event(90, "asset_impact", 3, true)], 90)[2]
      .point,
    { tick: 90, beforeOrder: 3 },
  );
});
test("modeled renderer receives no future optical geometry, broken legacy fallback or invalid clutter", () => {
  const state = fixture(),
    o = state.tracks[0].observation!;
  o.eo.sample_tick = 91;
  o.ir.sample_tick = 91;
  o.radar.sample_tick = 91;
  const valid = {
    track_id: "C1",
    tick: 90,
    radar: { ...o.radar, sample_tick: 60 },
  };
  state.falseContacts = [
    valid,
    { ...valid, tick: 91 },
    { ...valid, radar: { ...valid.radar, sample_tick: -1 } },
  ];
  state.tracks.push({
    ...state.tracks[0],
    id: "HIDDEN",
    observation: undefined,
  });
  state.rfAvailable = false;
  o.iff.cue = "friendly_reply";
  const before = structuredClone(state),
    render = reviewObservationSnapshot(state);
  assert.equal(render.tracks.length, 1);
  assert.equal(render.tracks[0].thermal, false);
  for (const key of ["eo", "ir"] as const) {
    assert.equal(render.tracks[0].observation![key].available, false);
    assert.equal(render.tracks[0].observation![key].position, null);
  }
  assert.equal(render.tracks[0].observation!.iff.available, false);
  assert.equal(render.falseContacts!.length, 1);
  assert.deepEqual(render.messages, []);
  assert.deepEqual(state, before);
});
