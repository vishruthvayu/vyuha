import test from "node:test";
import assert from "node:assert/strict";
import {
  TimingCapture,
  distribution,
  currentCapture,
  diagnosticFrame,
} from "./diagnostics";
test("timing reports tail stalls and never substitutes median FPS", () => {
  const c = new TimingCapture(100, { commit: "test", source_hash: "hash" });
  for (const n of [16, 16, 17, 18, 1100]) c.sample("render_frame", n, 150);
  const r = c.report(200);
  assert.equal(r.summary.render_frame.p50_ms, 17);
  assert.equal(r.summary.render_frame.p99_ms, 1100);
  assert.equal(r.summary.render_frame.over_100_ms, 1);
  assert.match(r.scope, /not GPU/);
  assert.equal(r.summary.worker_delivery.samples, 0);
});
test("bounded collection preserves first samples and discloses overflow and stopped state", () => {
  const c = new TimingCapture(0, undefined, 2);
  c.sample("render_frame", 1000, 1);
  c.sample("render_frame", 16, 2);
  c.sample("render_frame", 17, 3);
  assert.equal(c.report(4).complete_sample_window, false);
  assert.equal(c.dropped, 1);
  assert.equal(c.samples[0].duration_ms, 1000);
  c.stopped = true;
  c.sample("render_frame", 100, 5);
  assert.equal(c.samples.length, 2);
});
test("optics and startup are separate and malformed timings cannot poison a report", () => {
  const c = new TimingCapture(10);
  c.phase = "startup";
  c.sample("render_frame", 20, 11);
  c.phase = "optics";
  c.sample("render_frame", 42, 12);
  for (const n of [NaN, Infinity, -1]) c.sample("render_frame", n, 13);
  c.sample("render_frame", 12, 1);
  const r = c.report(20);
  assert.equal(r.phases.startup.max_ms, 20);
  assert.equal(r.phases.optics.max_ms, 42);
  assert.equal(c.samples.length, 2);
  assert.deepEqual(distribution([]), {
    samples: 0,
    p50_ms: null,
    p95_ms: null,
    p99_ms: null,
    max_ms: null,
    over_50_ms: 0,
    over_100_ms: 0,
  });
});
test("diagnostics are off by default and report snapshots cannot mutate collected data", () => {
  assert.equal(currentCapture(), null);
  diagnosticFrame(1000);
  assert.equal(currentCapture(), null);
  const c = new TimingCapture(0);
  c.sample("resource", 10, 1);
  const r = c.report(3);
  r.samples[0].duration_ms = 1000;
  assert.equal(c.samples[0].duration_ms, 10);
  assert.deepEqual(Object.keys(r.samples[0]).sort(), [
    "duration_ms",
    "elapsed_ms",
    "kind",
    "phase",
  ]);
});

test("hidden/resumed frame gaps are disclosed rather than counted as foreground stalls", () => {
  const c = new TimingCapture(0);
  c.frame(16, 1);
  c.frame(16, 2, false);
  c.frame(10000, 10002);
  c.frame(17, 10019);
  assert.equal(c.ignored, 2);
  assert.equal(c.report(10020).summary.render_frame.max_ms, 17);
  assert.equal(c.report(10020).summary.render_frame.samples, 2);
});

test("a throttled stop timer cannot extend the bounded timing window", () => {
  const c = new TimingCapture(100);
  c.sample("render_frame",16,200);
  c.sample("render_frame",1000,240101);
  assert.equal(c.stopped,true);
  assert.equal(c.samples.length,1);
  assert.equal(c.report(999999).elapsed_ms,240000);
});
