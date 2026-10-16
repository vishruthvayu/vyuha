import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  FLAT_RADIUS,
  terrainHeight,
  createTerrainGeometry,
} from "./world/terrain";
import {
  SENSOR_CLEARING,
  facilityLayout,
  placementHeight,
  withoutBoxes,
} from "./world/layout";
import {
  Batches,
  buildFacility,
  cityBlock,
  warehouse,
  type MaterialKey,
} from "./world/kit";
import { MATERIAL_THERMAL } from "./world/materials";
import {
  THERMAL_CLASSES,
  THERMAL_RANGE,
  displayThermal,
  thermalColor,
} from "./world/thermal";
import { displayVisibility } from "./world/displayVisibility";
import { nextOpticalRange } from "./world/displayVisibility";

const URBAN_BOXES = [
  { x_min: 120, x_max: 210, z_min: 300, z_max: 390, height: 28 },
  { x_min: -230, x_max: -130, z_min: -350, z_max: -240, height: 35 },
];
const RURAL_BOXES = [
  { x_min: -160, x_max: -90, z_min: 200, z_max: 260, height: 10 },
];

test("visual ground is exactly the sensor model's flat plane within optical range", () => {
  for (const kind of ["urban_outpost", "rural_forward_base"] as const) {
    for (let r = 0; r <= FLAT_RADIUS; r += 50)
      for (let a = 0; a < Math.PI * 2; a += 0.37)
        assert.equal(terrainHeight(Math.sin(a) * r, Math.cos(a) * r, kind), 0);
    // Relief exists only beyond the longest optical range (EO 1500 m).
    assert.ok(FLAT_RADIUS > nextOpticalRange());
    const far = [3000, 6000, 10000].map((r) => terrainHeight(r, r * 0.3, kind));
    assert.ok(
      far.some((h) => h > 5),
      "distant relief exists",
    );
    const g = createTerrainGeometry(kind, 1);
    const p = g.getAttribute("position");
    for (let i = 0; i < p.count; i++)
      if (Math.hypot(p.getX(i), p.getZ(i)) <= FLAT_RADIUS)
        assert.equal(p.getY(i), 0);
    // Faces point up (a reversed winding is back-face culled and leaves a hole).
    const n = g.getAttribute("normal");
    for (let i = 0; i < n.count; i += 97) assert.ok(n.getY(i) > 0.5);
    g.dispose();
  }
});

test("decorative scenery keeps clear of authoritative occluders and of the sensor's eye line", () => {
  for (const [kind, boxes] of [
    ["urban_outpost", URBAN_BOXES],
    ["rural_forward_base", RURAL_BOXES],
  ] as const) {
    const layout = withoutBoxes(facilityLayout(kind), boxes);
    for (const p of layout.placements) {
      for (const b of boxes)
        assert.ok(
          !(
            p.x > b.x_min - 12 &&
            p.x < b.x_max + 12 &&
            p.z > b.z_min - 12 &&
            p.z < b.z_max + 12
          ),
          `${p.kind} at ${p.x},${p.z} overlaps an occluder`,
        );
      if (Math.hypot(p.x, p.z) < SENSOR_CLEARING)
        assert.ok(
          placementHeight(p) <= 2,
          `${p.kind} rises above the 2 m sensor eye inside the clearing`,
        );
    }
    // Deterministic: the same layout every time.
    assert.deepEqual(facilityLayout(kind), facilityLayout(kind));
  }
});

function boundsOf(b: Batches) {
  const box = new THREE.Box3();
  for (const g of b.merged().values()) {
    g.computeBoundingBox();
    box.union(g.boundingBox!);
    g.dispose();
  }
  return box;
}

test("occluder dressing never extends outside its box (visual occlusion within sensor occlusion)", () => {
  for (const [i, b] of URBAN_BOXES.entries()) {
    const batches = new Batches();
    cityBlock(batches, b, i * 7 + 3);
    const box = boundsOf(batches);
    const eps = 0.06; // sills and glass sit up to 4 cm proud of the facade
    assert.ok(
      box.min.x >= b.x_min - 0.1 - eps && box.max.x <= b.x_max + 0.1 + eps,
    );
    assert.ok(
      box.min.z >= b.z_min - 0.1 - eps && box.max.z <= b.z_max + 0.1 + eps,
    );
    assert.ok(
      box.min.y >= -1e-6 && box.max.y <= b.height + 1e-6,
      `height ${box.max.y} > ${b.height}`,
    );
  }
  const rural = RURAL_BOXES[0];
  const batches = new Batches();
  warehouse(
    batches,
    (rural.x_min + rural.x_max) / 2,
    (rural.z_min + rural.z_max) / 2,
    rural.x_max - rural.x_min,
    rural.z_max - rural.z_min,
    rural.height,
  );
  const box = boundsOf(batches);
  assert.ok(box.max.y <= rural.height + 0.05);
  assert.ok(box.min.x >= rural.x_min - 0.1 && box.max.x <= rural.x_max + 0.1);
});

test("the facility merges into a handful of draw calls with every material thermally classified", () => {
  for (const kind of ["urban_outpost", "rural_forward_base"] as const) {
    const layout = facilityLayout(kind);
    const b = buildFacility(layout.placements, layout.lines);
    assert.ok(
      b.triangles > 20000 && b.triangles < 250000,
      `${b.triangles} triangles`,
    );
    const merged = b.merged();
    assert.ok(merged.size <= 16, `${merged.size} material batches`);
    for (const [key, g] of merged) {
      assert.ok(key in MATERIAL_THERMAL, key);
      for (const name of ["position", "normal", "uv", "color"])
        assert.ok(g.getAttribute(name), `${key} has ${name}`);
      g.dispose();
    }
  }
  for (const key of Object.keys(MATERIAL_THERMAL) as MaterialKey[])
    assert.ok(MATERIAL_THERMAL[key] in THERMAL_CLASSES);
});

test("thermal display is an illustrative, bounded mapping with hot sources saturating", () => {
  for (const night of [false, true]) {
    const [lo, hi] = night ? THERMAL_RANGE.night : THERMAL_RANGE.day;
    assert.ok(lo < hi);
    assert.equal(
      displayThermal(THERMAL_CLASSES.sky[night ? "night" : "day"], night),
      0,
    );
    assert.equal(
      displayThermal(THERMAL_CLASSES.motor[night ? "night" : "day"], night),
      1,
    );
    for (const c of Object.values(THERMAL_CLASSES)) {
      const v = displayThermal(night ? c.night : c.day, night);
      assert.ok(v >= 0 && v <= 1);
    }
  }
  // Metal roofs are warm by day and cold at night. Glass is opaque in long-wave
  // IR: a lit window shows no interior heat and reads cooler than the wall.
  assert.ok(THERMAL_CLASSES.metalRoof.day > THERMAL_CLASSES.metalRoof.night);
  assert.deepEqual(THERMAL_CLASSES.glassLit, THERMAL_CLASSES.glass);
  assert.ok(THERMAL_CLASSES.glass.night < THERMAL_CLASSES.plaster.night);
  // Black-hot inverts white-hot.
  const w = thermalColor(1, "white"),
    b = thermalColor(1, "black");
  assert.ok(w.r > 0.9 && b.r < 0.1);
});

test("display haze follows the scenario fog monotonically between clear and dense", () => {
  let previous = Infinity;
  for (let f = 0; f <= 1.0001; f += 0.05) {
    const v = displayVisibility(f);
    assert.ok(v < previous && v >= 199 && v <= 20000.01);
    previous = v;
  }
  assert.equal(displayVisibility(-1), displayVisibility(0));
  assert.equal(displayVisibility(9), displayVisibility(1));
});
