import test from "node:test";
import assert from "node:assert/strict";
import {
  sceneryObstacles,
  segmentHits,
  SceneryObstruction,
} from "./world/obstruction";
import type { AuthoredStructure } from "./world/logistics-kit";
import type { FacilityLayout } from "./world/layout";
function obstacles(p: AuthoredStructure) {
  const l: FacilityLayout = {
    terrain: "urban_outpost",
    placements: [p],
    surfaces: [],
    lines: [],
    compound: [],
  };
  return sceneryObstacles(l);
}
for (const kind of ["terminal", "logisticsShed"] as const)
  test(`${kind} preserves the behind-scenery marker through rotated solid cores`, () => {
    for (const rot of [0, 0.37, Math.PI / 2, Math.PI]) {
      const p = { kind, x: 100, z: 0, rot, w: 48, d: 24, h: 15 };
      const os = obstacles(p);
      assert.equal(os.length, 1);
      const o = new SceneryObstruction();
      o.set(os);
      o.update({ x: 0, y: 2, z: 0 }, (visit) => {
        visit("behind", 200, 4, 0);
        visit("above", 200, 200, 0);
        visit("before", 20, 2, 0);
        visit("beside", 200, 2, 150);
      });
      assert.ok(o.blocked.has("behind"));
      assert.deepEqual([...o.blocked], ["behind"]);
    }
  });
test("water-tower support space stays open while the raised tank retains a marker", () => {
  const [o] = obstacles({
    kind: "waterTower",
    x: 100,
    z: 0,
    rot: 0,
    w: 16,
    d: 16,
    h: 32,
  });
  assert.ok(o);
  assert.ok(!segmentHits(o, 0, 2, 0, 200, 2, 0));
  assert.ok(segmentHits(o, 0, 28, 0, 200, 28, 0));
  assert.ok(!segmentHits(o, 0, 40, 0, 200, 40, 0));
});
