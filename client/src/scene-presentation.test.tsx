import test from "node:test";
import assert from "node:assert/strict";
import { Color, PerspectiveCamera, Vector3 } from "three";
import {
  terrainPresentationBounds,
  terrainMaterialState,
  buildingSurfaceColors,
  buildingVertexColors,
  roadPaint,
  sceneCameraPose,
  sceneReviewEnvelope,
} from "./scene-presentation";
import { cameraPose, type CameraPreset } from "./presentation";
import { ObservationVisibility, opticalRenderShape } from "./visibility";
import { makeScenario } from "./scenario";
import { replay, score } from "./sim";
import type { Track, Snapshot } from "./types";
const scenario = makeScenario();
const base = replay(scenario, [], 30).snapshot().tracks[0];
function track(id: string, x: number, z: number, altitude: number): Track {
  return {
    ...base,
    id,
    x,
    z,
    altitude,
    distance: Math.hypot(x, z),
    active: true,
  };
}
test("Terrain presentation keeps every frozen bound/height exact and never adds a protruding roof volume", () => {
  const boxes = [
    { x_min: -18, x_max: 21, z_min: 45, z_max: 67, height: 12 },
    { x_min: 12.25, x_max: 14.75, z_min: -5, z_max: 8.5, height: 3.75 },
  ];
  const original = structuredClone(boxes);
  const visual = terrainPresentationBounds(boxes);
  for (const [index, b] of visual.entries())
    assert.deepEqual(
      {
        x_min: b.x - b.w / 2,
        x_max: b.x + b.w / 2,
        z_min: b.z - b.d / 2,
        z_max: b.z + b.d / 2,
        height: b.h,
      },
      boxes[index],
    );
  assert.deepEqual(boxes, original);
  assert.deepEqual(terrainPresentationBounds([]), []);
});
test("Terrain translucency requires explicit reference truth; a live preset cannot make occluders transparent", () => {
  for (const preset of [undefined, "overview", "observer", "follow"] as const)
    assert.deepEqual(terrainMaterialState(false, preset), {
      transparent: false,
      opacity: 1,
      depthWrite: true,
    });
  assert.deepEqual(terrainMaterialState(true, "overview"), {
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  assert.deepEqual(terrainMaterialState(true, undefined), {
    transparent: false,
    opacity: 1,
    depthWrite: true,
  });
});
test("Roof/material detail uses bounded24-vertex colors rather than extra terrain geometry", () => {
  const colors = buildingSurfaceColors(0, "day", true),
    attribute = buildingVertexColors(colors);
  assert.equal(attribute.length, 72);
  const roof = new Color(colors.roof);
  for (let index = 24; index < 36; index += 3) {
    assert.ok(Math.abs(attribute[index] - roof.r) < 1e-7);
    assert.ok(Math.abs(attribute[index + 1] - roof.g) < 1e-7);
    assert.ok(Math.abs(attribute[index + 2] - roof.b) < 1e-7);
  }
  assert.ok(
    [...attribute].every(
      (value) => Number.isFinite(value) && value >= 0 && value <= 1,
    ),
  );
  for (const quality of ["medium", "high"] as const) {
    const paint = roadPaint(true, quality);
    assert.equal(paint.length, 2);
    assert.ok(
      paint.every(
        (p) =>
          p.size[0] === 0.22 && p.size[1] === 8000 && p.position[1] === 0.055,
      ),
    );
  }
  assert.deepEqual(roadPaint(true, "low"), []);
  assert.deepEqual(roadPaint(false, "tactical"), []);
});
test("Every live camera preset and reference follow/observer preserves existing cameraPose semantics exactly", () => {
  const points = [track("seen", 45, 120, 20), track("ended", -300, 500, 30)];
  points[1].active = false;
  const before = structuredClone(points);
  for (const preset of ["overview", "observer", "follow"] as CameraPreset[])
    for (const selected of [null, "seen", "missing", "ended"]) {
      assert.deepEqual(
        sceneCameraPose(preset, points, selected, false, 0.5),
        cameraPose(preset, points, selected),
      );
      if (preset !== "overview")
        assert.deepEqual(
          sceneCameraPose(preset, points, selected, true, 1.5),
          cameraPose(preset, points, selected),
        );
    }
  assert.deepEqual(points, before);
});
test("Explicit after-review overview fits only its supplied active scope at desktop/mobile aspects without altering records or scores", () => {
  const points = [
    track("A", -100, 600, 10),
    track("B", 120, 1100, 90),
    { ...track("ended", 9000, 9000, 900), active: false },
  ];
  const before = structuredClone(points);
  for (const aspect of [0.42, 0.9, 1.8, 3.2]) {
    const pose = sceneCameraPose("overview", points, null, true, aspect);
    assert.deepEqual(pose.aim, [10, 50, 850]);
    const camera = new PerspectiveCamera(52, aspect, 0.1, 20000);
    camera.position.set(...pose.position);
    camera.lookAt(new Vector3(...pose.aim));
    camera.updateMatrixWorld();
    for (const t of points.filter((t) => t.active)) {
      const projected = new Vector3(t.x, t.altitude, t.z).project(camera);
      assert.ok(
        Math.abs(projected.x) < 1 &&
          Math.abs(projected.y) < 1 &&
          projected.z < 1,
      );
    }
  }
  assert.deepEqual(points, before);
  const engine = replay(scenario, [], 30),
    originalScore = score(engine);
  sceneCameraPose("overview", engine.snapshot().tracks, null, true);
  assert.deepEqual(score(engine), originalScore);
  assert.deepEqual(
    sceneCameraPose("overview", [], null, true),
    cameraPose("overview", [], null),
  );
});
test("Camera scope still follows observation visibility and detection-only glyph uncertainty; hidden truth cannot enter live framing", () => {
  const visible = {
    ...track("visible", 10, 90, 20),
    thermal: true,
    detected: 0,
  };
  const hidden = {
    ...track("hidden", 9000, 7000, 600),
    thermal: false,
    radar: true,
    detected: 0,
  };
  const state = {
    tick: 1,
    tracks: [visible, hidden],
    jammed: false,
    radarStatus: "normal",
    rfAvailable: true,
    night: false,
    paused: false,
    done: false,
    messages: [],
  } as Snapshot;
  const before = structuredClone(state);
  const scoped = new ObservationVisibility().tracks(state, "day", {
    key: "scope",
  });
  assert.equal(scoped.length, 1);
  for (const preset of ["overview", "follow", "observer"] as const)
    assert.deepEqual(
      sceneCameraPose(preset, scoped, "hidden", false),
      cameraPose(preset, scoped, null),
    );
  assert.equal(
    opticalRenderShape({
      ...visible,
      visual_level: "detect",
      visual_shape: null,
    }),
    "unresolved",
  );
  assert.deepEqual(state, before);
});

test("Review fitting retains all live/observer/follow range boundaries and avoids portrait clipping only for explicit overview truth", () => {
  const points = [track("left", -8000, 0, 20), track("right", 8000, 5000, 500)];
  const original = { far: 20000, fogNear: 8000, fogFar: 18000 };
  for (const preset of [undefined, "overview", "observer", "follow"] as const) {
    assert.deepEqual(
      sceneReviewEnvelope(points, null, false, preset, 0.42, original),
      original,
    );
    if (preset !== "overview")
      assert.deepEqual(
        sceneReviewEnvelope(points, null, true, preset, 0.42, original),
        original,
      );
  }
  for (const aspect of [0.42, 1.8]) {
    const pose = sceneCameraPose("overview", points, null, true, aspect);
    const bounds = sceneReviewEnvelope(
      points,
      null,
      true,
      "overview",
      aspect,
      original,
    );
    const camera = new PerspectiveCamera(52, aspect, 0.1, bounds.far);
    camera.position.set(...pose.position);
    camera.lookAt(new Vector3(...pose.aim));
    camera.updateMatrixWorld();
    for (const t of points) {
      const distance = Math.hypot(
        t.x - pose.position[0],
        t.altitude - pose.position[1],
        t.z - pose.position[2],
      );
      assert.ok(
        distance < bounds.far &&
          distance < bounds.fogNear &&
          distance < bounds.fogFar,
      );
      const projected = new Vector3(t.x, t.altitude, t.z).project(camera);
      assert.ok(
        Math.abs(projected.x) < 1 &&
          Math.abs(projected.y) < 1 &&
          projected.z < 1,
      );
    }
  }
  assert.deepEqual(original, { far: 20000, fogNear: 8000, fogFar: 18000 });
});
