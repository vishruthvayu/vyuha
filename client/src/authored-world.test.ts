import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  facilityLayout,
  withoutBoxes,
  placementHeight,
  SENSOR_CLEARING,
  legacyUrbanOutpost,
} from "./world/layout";
import { Batches, buildFacility } from "./world/kit";
import {
  addLogisticsArchitecture,
  isAuthoredStructure,
} from "./world/logistics-kit";
import { addStreetscape } from "./world/streetscape";
import { MATERIAL_THERMAL } from "./world/materials";
import { worldManifest } from "./world/world-manifest";

function signature() {
  const layout = facilityLayout("urban_outpost");
  const b = buildFacility(layout.placements, layout.lines);
  addLogisticsArchitecture(b, layout.placements.filter(isAuthoredStructure));
  addStreetscape(b, layout);
  const hash = createHash("sha256");
  let triangles = 0;
  const gs = b.merged();
  for (const [key, g] of gs) {
    assert.ok(key in MATERIAL_THERMAL);
    for (const attr of ["position", "normal", "uv", "color"]) {
      const a = g.getAttribute(attr);
      assert.ok(a);
      assert.ok(Array.from(a.array).every(Number.isFinite));
      hash.update(Buffer.from(a.array.buffer));
    }
    triangles += g.getAttribute("position").count / 3;
    g.dispose();
  }
  return { hash: hash.digest("hex"), triangles, batches: gs.size };
}

test("authored quarter is a complete deterministic composition with bounded merged geometry", () => {
  const l = facilityLayout("urban_outpost");
  assert.equal(l.placements.filter(isAuthoredStructure).length, 5);
  assert.ok(l.surfaces.filter((s) => s.kind === "asphalt").length >= 5);
  assert.ok(l.placements.filter((p) => p.kind === "building").length >= 12);
  assert.notDeepEqual(l, legacyUrbanOutpost());
  const a = signature();
  assert.deepEqual(a, signature());
  assert.ok(a.triangles < 200000, JSON.stringify(a));
  assert.ok(a.batches <= 16);
});

test("authored extents respect arbitrary authoritative boxes and the sensor clearing", () => {
  const l = facilityLayout("urban_outpost");
  for (const p of l.placements)
    if (Math.hypot(p.x, p.z) < SENSOR_CLEARING)
      assert.ok(placementHeight(p) <= 2);
  const terminal = l.placements.find((p) => p.kind === "terminal")!;
  // Centre lies outside this box; the wide footprint overlaps it and must be removed.
  const box = {
    x_min: terminal.x + 25,
    x_max: terminal.x + 30,
    z_min: terminal.z - 2,
    z_max: terminal.z + 2,
    height: 4,
  };
  assert.ok(!withoutBoxes(l, [box]).placements.includes(terminal));
  assert.deepEqual(l.placements, facilityLayout("urban_outpost").placements);
});

test("presentation version does not turn decorative scenery into sensor geometry", () => {
  const m = worldManifest("urban_outpost");
  assert.equal(m.revision, 2);
  assert.ok(Object.isFrozen(m));
  assert.equal(worldManifest("rural_forward_base").revision, 1);
  const scene = readFileSync(new URL("./Scene.tsx", import.meta.url), "utf8");
  assert.match(
    scene,
    /gl.clearDepth\(\);\s*camera.layers.set\(LAYER_OCCLUDERS\)/,
  );
  const world = readFileSync(
    new URL("./world/Environment.tsx", import.meta.url),
    "utf8",
  );
  assert.match(world, /addLogisticsArchitecture\(\s*facility/);
  assert.match(world, /addStreetscape\(facility, layout\)/);
  assert.match(world, /presentationWorld = worldManifest\(terrain\)/);
});

test("rural streetscape remains empty and urban markings remain one merged static facility", () => {
  const rural = new Batches();
  addStreetscape(rural, facilityLayout("rural_forward_base"));
  assert.equal(rural.merged().size, 0);
  const urban = new Batches();
  addStreetscape(urban, facilityLayout("urban_outpost"));
  const gs = urban.merged();
  assert.ok(gs.size <= 3);
  for (const g of gs.values()) g.dispose();
});
