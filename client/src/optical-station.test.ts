import test from "node:test";
import assert from "node:assert/strict";
import {
  aimPoint,
  boundedAim,
  reportedAim,
  scopedAim,
  liveManualAim,
} from "./optical-station";
const origin = { x: 70, z: -20, altitude: 14 };
test("manual pointing uses the fixed sensor origin and all compass quadrants", () => {
  for (const [azimuthDeg, dx, dz] of [
    [0, 0, 1000],
    [90, 1000, 0],
    [180, 0, -1000],
    [270, -1000, 0],
  ]) {
    const p = aimPoint(origin, { azimuthDeg, elevationDeg: 0 })!;
    assert.ok(Math.abs(p.x - origin.x - dx) < 1e-8);
    assert.ok(Math.abs(p.z - origin.z - dz) < 1e-8);
    assert.equal(p.altitude, 14);
    assert.ok(Math.abs(reportedAim(p, origin)!.azimuthDeg - azimuthDeg) < 1e-8);
  }
});
test("display pitch clamps, bearings wrap, malformed directions cannot reach the renderer", () => {
  assert.deepEqual(boundedAim({ azimuthDeg: -725, elevationDeg: 200 }), {
    azimuthDeg: 355,
    elevationDeg: 85,
  });
  assert.deepEqual(boundedAim({ azimuthDeg: 721, elevationDeg: -45 }), {
    azimuthDeg: 1,
    elevationDeg: -30,
  });
  for (const n of [NaN, Infinity, -Infinity]) {
    assert.equal(boundedAim({ azimuthDeg: n, elevationDeg: 0 }), null);
    assert.equal(aimPoint(origin, { azimuthDeg: 0, elevationDeg: n }), null);
    assert.equal(reportedAim({ ...origin, x: n }, origin), null);
  }
  assert.equal(reportedAim(origin, origin), null);
  assert.equal(reportedAim(null, origin), null);
});
test("pointing cannot carry into a different owner or worker generation", () => {
  const saved = {
    scopeId: "owner-A:session:worker-1",
    aim: { azimuthDeg: 90, elevationDeg: 12 },
  };
  assert.deepEqual(scopedAim(saved, saved.scopeId), saved.aim);
  assert.equal(scopedAim(saved, "owner-A:session:worker-2"), null);
  assert.equal(scopedAim(saved, "owner-B:session:worker-1"), null);
});

test("briefing/reference/review cannot accept a live manual view", () => {
  const aim = { azimuthDeg: 40, elevationDeg: 10 };
  assert.deepEqual(
    liveManualAim(aim, {
      briefing: false,
      referenceTruth: false,
      preset: false,
    }),
    aim,
  );
  for (const context of [
    { briefing: true, referenceTruth: false, preset: false },
    { briefing: false, referenceTruth: true, preset: false },
    { briefing: false, referenceTruth: false, preset: true },
  ])
    assert.equal(liveManualAim(aim, context), null);
});
