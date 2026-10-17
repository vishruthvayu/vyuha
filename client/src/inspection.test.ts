import test from "node:test";
import assert from "node:assert/strict";
import {
  INSPECTION_FILL,
  inspectionResolution,
  pixelsOnTarget,
} from "./InspectionPass";
import { defaultSensorConfig } from "./sensors-v2";

test("the close-up resolution is the sensor's own pixel count on target", () => {
  // 0.82 m multirotor at 500 m with EO IFOV 0.12 mrad ≈ 13.7 pixels across.
  const eo = pixelsOnTarget("multirotor", 500, "eo");
  assert.ok(
    Math.abs(eo - 0.82 / (500 * defaultSensorConfig.eo_ifov_rad)) < 1e-9,
  );
  assert.ok(eo > 13 && eo < 14.5);
  // IR has a coarser IFOV, so fewer pixels at the same range.
  assert.ok(pixelsOnTarget("multirotor", 500, "ir") < eo);
  // Twice the range, half the pixels.
  assert.ok(Math.abs(pixelsOnTarget("multirotor", 1000, "eo") * 2 - eo) < 1e-9);
  // The inset never shows more pixels across the target than the sensor has.
  for (const range of [80, 150, 300, 600, 1200]) {
    const px = pixelsOnTarget("fixed_wing", range, "eo");
    const res = inspectionResolution(px);
    assert.ok(
      res * INSPECTION_FILL <= Math.max(px, 8 * INSPECTION_FILL) + 1,
      `${range} m`,
    );
    assert.ok(res >= 8 && res <= 192);
  }
});

test("attitude cues come only from the displayed path and stay bounded", async () => {
  const { attitude } = await import("./ContactRenderer");
  const still = { velocityX: 0, velocityY: 0, velocityZ: 0, yawRate: 0 };
  for (const shape of [
    "multirotor",
    "fixed_wing",
    "bird",
    "unresolved",
  ] as const)
    assert.deepEqual(attitude({ shape, ...still }), { pitch: 0, roll: 0 });
  // A fast multirotor tilts nose-down into its travel, never past ~18°.
  const fast = attitude({ shape: "multirotor", ...still, velocityZ: 60 });
  assert.ok(fast.pitch > 0 && fast.pitch <= 0.32);
  // Turning left banks left (negative roll); bounded for every shape.
  for (const shape of ["multirotor", "fixed_wing", "bird"] as const) {
    const turn = attitude({ shape, ...still, velocityZ: 25, yawRate: 3 });
    assert.ok(turn.roll < 0 && Math.abs(turn.roll) <= 0.6);
  }
  // Climbing fixed wing pitches nose-up (negative about local X).
  assert.ok(
    attitude({ shape: "fixed_wing", ...still, velocityZ: 25, velocityY: 5 })
      .pitch < 0,
  );
});

test("after-action review markers are a hollow ring with a dark rim", async () => {
  const { reviewRing } = await import("./ContactRenderer");
  const n = 32,
    ring = reviewRing(n);
  const at = (x: number, y: number) =>
    ring.subarray((y * n + x) * 4, (y * n + x) * 4 + 4);
  assert.equal(
    at(16, 16)[3],
    0,
    "centre stays clear so the contact shows through",
  );
  assert.equal(at(0, 0)[3], 0, "corners are transparent");
  const band = at(16 + 10, 16);
  assert.deepEqual([...band], [255, 255, 255, 255]);
  const rim = at(16 + 14, 16);
  assert.ok(
    rim[3] > 0 && rim[0] === 0,
    "dark rim keeps the ring visible on light ground",
  );
});

test("behind-scenery marker is a hollow diamond and the far marker a soft round blob", async () => {
  const { obstructedDiamond, softDisc } = await import("./ContactRenderer");
  const n = 32,
    d = obstructedDiamond(n);
  const a = (x: number, y: number) => d[(y * n + x) * 4 + 3];
  assert.equal(a(16, 16), 0, "hollow centre");
  assert.equal(a(0, 0), 0, "corners outside the diamond");
  assert.equal(a(16 + 11, 16), 255, "band on the axis");
  assert.equal(a(16 + 8, 16 + 8), 0, "a square ring would be opaque here");
  const m = 16,
    disc = softDisc(m);
  const b = (x: number, y: number) => disc[(y * m + x) * 4 + 3];
  assert.equal(b(7, 7), 255, "solid core");
  assert.equal(b(0, 0), 0, "round: corners clear");
  assert.ok(b(15, 8) < b(12, 8), "soft edge");
});

test("inspection inset leaves the main sight centre clear across phone and workstation canvases", async () => {
  const { inspectionDisplaySize } = await import("./InspectionPass");
  for (const [width, height] of [[328,281],[358,281],[396,281],[700,400],[1034,433],[1440,600]]) {
    const inset = inspectionDisplaySize(width,height);
    assert.ok(width-inset-14 >= width/2+32);
    assert.ok(14+inset <= height/2-32);
    assert.ok(inset <= 168);
  }
  assert.equal(inspectionDisplaySize(1034,433),168,"desktop close-up size is retained");
});
