import test from "node:test";
import assert from "node:assert/strict";
import { cockpitSurfaces, VR_SPATIAL, spatialSurface } from "./vr-layout";
test("all visible XR surfaces fit a full nine-action page without coplanar overlap at either engine presentation", () => {
  for (const acquisition of [false, true]) {
    const rects = cockpitSurfaces(9, 4, acquisition);
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i],
          b = rects[j],
          dx = Math.abs(a.x - b.x),
          dy = Math.abs(a.y - b.y);
        assert.ok(
          dx >= (a.width + b.width) / 2 || dy >= (a.height + b.height) / 2,
          `${a.id} overlaps ${b.id}`,
        );
      }
  }
  const a = spatialSurface(VR_SPATIAL.pause);
  assert.equal(a.position[2], -1.9);
  assert.notEqual(VR_SPATIAL.pause.y, VR_SPATIAL.legend.y);
  assert.throws(() => cockpitSurfaces(10, 4, true));
});
