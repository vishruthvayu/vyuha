import test from "node:test";
import assert from "node:assert/strict";
import {
  observeSensors,
  type SensorObservation,
  type SensorMemory,
} from "./sensors-v2";
import {
  captureInquiryMoment,
  compareInquiryMoments,
  type InquiryMoment,
} from "./inquiry-evidence";
const context = { scopeId: "session:A", trackId: "T1", tick: 100 };
const observation = (): SensorObservation => ({
  version: "vyuha-0.4.0",
  tick: 100,
  track_id: "T1",
  eo: {
    available: true,
    level: "recognise",
    silhouette: "multirotor",
    sample_tick: 99,
    position: { x: 1, z: 2, altitude: 3 },
  },
  ir: {
    available: true,
    level: "detect",
    silhouette: null,
    sample_tick: 99,
    position: { x: 1, z: 2, altitude: 3 },
  },
  radar: {
    available: true,
    state: "confirmed",
    detected: true,
    fresh: false,
    sample_tick: 90,
    position: { x: 1, z: 2, altitude: 3 },
  },
  rf: { available: true, detected: false, band_ghz: null, bearing_deg: null },
  iff: { available: true, cue: "no_reply", registration_id: null },
});
function capture(o = observation(), c = context): InquiryMoment {
  const result = captureInquiryMoment(c, o);
  assert.equal(result.status, "captured");
  if (result.status !== "captured") throw Error("Expected capture");
  return result.moment;
}
test("Capture preserves separate report, sample and capture times without canonical truth or raw positions", () => {
  const o = Object.assign(observation(), {
    kind: "secret",
    identity: "secret",
    ground_truth: { hostile: true },
  });
  const frozen = JSON.stringify(o);
  const m = capture(o, { ...context, tick: 110 });
  assert.equal(m.capturedTick, 110);
  assert.equal(m.reportTick, 100);
  assert.equal(m.readings[0].sampleTick, 99);
  assert.equal(m.readings[0].ageTicks, 11);
  assert.equal(m.readings[0].reportAgeTicks, 10);
  assert.equal(m.readings[2].ageTicks, 20);
  assert.equal(m.readings[3].sampleTick, null);
  assert.equal(m.readings[4].sampleTick, null);
  assert.doesNotMatch(
    JSON.stringify(m),
    /secret|ground_truth|position|band_ghz|registration_id/,
  );
  assert.equal(JSON.stringify(o), frozen);
});
test("Capture rejects future, wrong-contact, missing and invalid envelopes before inspecting payloads", () => {
  assert.equal(captureInquiryMoment(context, null).status, "missing");
  assert.equal(
    captureInquiryMoment(context, { ...observation(), tick: 101 }).status,
    "future",
  );
  assert.equal(
    captureInquiryMoment(context, { ...observation(), track_id: "T2" }).status,
    "out_of_scope",
  );
  assert.equal(
    captureInquiryMoment(context, { ...observation(), tick: NaN }).status,
    "invalid",
  );
  assert.equal(
    captureInquiryMoment({ ...context, scopeId: "" }, observation()).status,
    "invalid",
  );
  assert.equal(
    captureInquiryMoment({ ...context, tick: -1 }, observation()).status,
    "invalid",
  );
});
test("Future/invalid channel samples are withheld without poisoning usable channels", () => {
  const o = observation();
  o.eo.sample_tick = 101;
  o.ir.sample_tick = -1;
  const m = capture(o);
  assert.equal(m.readings[0].status, "invalid");
  assert.equal(m.readings[1].status, "invalid");
  assert.doesNotMatch(
    JSON.stringify(m.readings.slice(0, 2)),
    /multirotor|recognise|detect/,
  );
  assert.equal(m.readings[2].status, "reported");
});
test("Unavailable channels never disclose contradictory carried payloads; absence is distinct", () => {
  const o = observation();
  o.eo.available = false;
  o.rf.available = false;
  o.rf.detected = true;
  o.iff.available = false;
  o.iff.cue = "friendly_reply";
  o.ir.level = "none";
  const m = capture(o);
  assert.equal(m.readings[0].status, "unavailable");
  assert.equal(m.readings[1].status, "not_detected");
  assert.equal(m.readings[3].status, "unavailable");
  assert.equal(m.readings[4].status, "unavailable");
  assert.doesNotMatch(
    JSON.stringify(m),
    /Friendly reply|Emission detected|multirotor/,
  );
});
test("Missing sample time stays undated and detection cannot inherit a silhouette", () => {
  const o = observation();
  o.eo.sample_tick = null;
  o.radar.sample_tick = null;
  o.ir.silhouette = "multirotor";
  const m = capture(o);
  assert.equal(m.readings[0].status, "undated");
  assert.equal(m.readings[0].sampleTick, null);
  assert.equal(m.readings[2].status, "undated");
  assert.doesNotMatch(JSON.stringify(m.readings), /multirotor/);
});
test("Capture is immutable after input mutation and deeply frozen", () => {
  const o = observation();
  const m = capture(o);
  o.eo.silhouette = "bird";
  assert.match(m.readings[0].detail, /multirotor/);
  assert.ok(Object.isFrozen(m));
  assert.ok(Object.isFrozen(m.readings));
  assert.ok(m.readings.every(Object.isFrozen));
});
test("Comparison refuses cross-attempt/contact captures and sorts click order chronologically", () => {
  const a = capture();
  const b = capture(observation(), { ...context, tick: 120 });
  assert.equal(
    compareInquiryMoments(a, { ...b, scopeId: "session:B" }).status,
    "out_of_scope",
  );
  assert.equal(
    compareInquiryMoments(a, { ...b, trackId: "T2" }).status,
    "out_of_scope",
  );
  const forward = compareInquiryMoments(a, b);
  assert.deepEqual(compareInquiryMoments(b, a), forward);
  assert.equal(forward.elapsedTicks, 20);
  assert.ok(forward.channels.every((r) => r.change === "same_report"));
});
test("New sample dates alone do not become new independent confirmation", () => {
  const a = capture();
  const o = observation();
  o.tick = 110;
  o.eo.sample_tick = 108;
  o.ir.sample_tick = 108;
  const b = capture(o, { ...context, tick: 110 });
  const result = compareInquiryMoments(a, b);
  assert.ok(result.channels.every((r) => r.change === "same_report"));
  assert.match(result.prompts.join(" "), /not independent/);
});
test("Changed cues are compared without inferring a label or a scoring outcome", () => {
  const a = capture();
  const o = observation();
  o.iff.cue = "friendly_reply";
  o.eo.level = "identify";
  const result = compareInquiryMoments(a, capture(o));
  assert.equal(
    result.channels.find((r) => r.channel === "iff")?.change,
    "changed_report",
  );
  assert.equal(
    result.channels.find((r) => r.channel === "eo")?.change,
    "changed_report",
  );
  assert.doesNotMatch(
    JSON.stringify(result),
    /expected_action|weapon|score|certainty|probability/,
  );
});
test("Undated/invalid evidence remains incomparable and negative cues retain caution", () => {
  const a = capture();
  const o = observation();
  o.eo.sample_tick = null;
  o.ir.sample_tick = 101;
  const result = compareInquiryMoments(a, capture(o));
  assert.equal(result.channels[0].change, "not_comparable");
  assert.equal(result.channels[1].change, "not_comparable");
  assert.match(result.prompts.join(" "), /does not establish hostile intent/);
});
test("Optical recognition/identification cannot disclose a shape without a finite observed position", () => {
  for (const level of ["recognise", "identify"] as const)
    for (const position of [
      null,
      { x: NaN, z: 2, altitude: 3 },
      { x: 1, z: Infinity, altitude: 3 },
      { x: 1, z: 2, altitude: -Infinity },
    ]) {
      const o = observation();
      o.eo.level = level;
      o.eo.position = position;
      const row = capture(o).readings[0];
      assert.equal(row.status, "invalid");
      assert.doesNotMatch(JSON.stringify(row), /multirotor|recognise|identify/);
    }
});
test("Optical detection also requires a finite observed position, and recognition requires a valid silhouette", () => {
  const o = observation();
  o.ir.position = null;
  assert.equal(capture(o).readings[1].status, "invalid");
  o.eo.silhouette = null;
  assert.equal(capture(o).readings[0].status, "invalid");
  // Availability is authoritative for suppression even when discarded payloads contradict it.
  o.eo.available = false;
  assert.equal(capture(o).readings[0].status, "unavailable");
});
test("Radar cannot claim confirmation from a missing/nonfinite position or a contradictory detected flag", () => {
  for (const position of [
    null,
    { x: NaN, z: 2, altitude: 3 },
    { x: 1, z: 2, altitude: Infinity },
  ]) {
    const o = observation();
    o.radar.position = position;
    assert.equal(capture(o).readings[2].status, "invalid");
  }
  const o = observation();
  o.radar.detected = false;
  assert.equal(capture(o).readings[2].status, "invalid");
  o.radar.available = false;
  assert.equal(capture(o).readings[2].status, "unavailable");
});
test("Radar lifecycle/freshness contradictions remain invalid while a legitimate lost sample stays historical", () => {
  const o = observation();
  o.radar.state = "tentative";
  assert.equal(capture(o).readings[2].status, "invalid");
  o.radar.detected = false;
  assert.equal(capture(o).readings[2].value, "tentative");
  o.radar.state = "lost";
  o.radar.position = null;
  const lost = capture(o).readings[2];
  assert.equal(lost.status, "reported");
  assert.equal(lost.value, "lost");
  assert.equal(lost.ageTicks, 10);
  o.radar.fresh = true;
  assert.equal(capture(o).readings[2].status, "invalid");
});

test("Current modeled sensor reports remain valid through radar lifecycle, optical loss and availability transitions", () => {
  for (const kind of ["bird", "quad", "fixed_wing"] as const) {
    let memory: SensorMemory | null = null;
    const target = {
      id: "T1",
      kind,
      identity: "neutral",
      rf: true,
      active: true,
      x: 50,
      z: 300,
      altitude: 20,
    };
    for (let at = 0; at <= 240; at++) {
      const environment = {
        night: at >= 60 && at < 120,
        fog: at >= 120 && at < 180 ? 1 : 0,
        radar_status:
          at >= 180 && at < 210 ? ("failed" as const) : ("normal" as const),
        eo_status: at >= 210 ? ("failed" as const) : ("normal" as const),
        ir_status: at >= 225 ? ("failed" as const) : ("normal" as const),
        rf_available: at < 210,
      };
      const report = observeSensors(42, at, 0, target, environment, memory);
      memory = report.memory;
      const moment = capture(report.observation, { ...context, tick: at });
      assert.ok(
        moment.readings.every((r) => r.status !== "invalid"),
        `${kind} tick ${at}: ${JSON.stringify(moment.readings)}`,
      );
    }
  }
});
