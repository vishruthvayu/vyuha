import test from "node:test";
import assert from "node:assert/strict";
import {
  foundations,
  contactShadeData,
  createContactShading,
} from "./world/contact-shading";
import { facilityLayout } from "./world/layout";
import { FLAT_RADIUS } from "./world/terrain";

test("contact shading only uses static foundations on flat visual ground, at one draw batch per world", () => {
  for (const world of ["urban_outpost", "rural_forward_base"] as const) {
    const layout = facilityLayout(world),
      places = foundations(layout);
    assert.ok(places.length > 10);
    for (const p of places) {
      assert.ok(Number.isFinite(p.rx) && p.rx > 0 && p.rz > 0);
      assert.ok(Math.hypot(p.x, p.z) + Math.hypot(p.rx, p.rz) <= FLAT_RADIUS);
    }
    const shade = createContactShading(layout);
    assert.equal(shade.mesh.count, places.length);
    assert.equal(shade.mesh.material.depthWrite, false);
    assert.equal(shade.mesh.layers.mask, 1);
    shade.dispose();
  }
  const alpha = contactShadeData(16);
  assert.equal(alpha.length, 16 * 16 * 4);
  assert.ok(alpha[(8 * 16 + 8) * 4 + 3] > alpha[3]);
  assert.equal(alpha[0], 16);
});
