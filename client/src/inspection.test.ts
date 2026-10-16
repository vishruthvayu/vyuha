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
