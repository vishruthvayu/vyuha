import test from "node:test";
import assert from "node:assert/strict";
import {
  buildLandscapeIdentity,
  landscapeIdentity,
  landscapeRelief,
  LANDSCAPE_CLEARANCE_M,
} from "./world/landscape-identity";
import {
  terrainHeight,
  TERRAIN_RADIUS,
  type TerrainKind,
} from "./world/terrain";
import type { Quality } from "./quality";

const terrains: TerrainKind[] = ["urban_outpost", "rural_forward_base"];
const qualities: Quality[] = ["low", "medium", "high"];

test("landscape identity is bounded original presentation with distinct urban/rural profiles", () => {
  const urban = landscapeIdentity("urban_outpost", "medium")!;
  const rural = landscapeIdentity("rural_forward_base", "medium")!;
  assert.ok(Object.isFrozen(urban));
  assert.equal(urban.version, "landscape-identity-v1");
  assert.equal(urban.id, "urban-escarpment");
  assert.equal(rural.id, "rural-folded-ridges");
  const samples = (identity: typeof urban) =>
    [0, 0.3, 1.2, 2, 3, 4.2, 5.6].map((a) =>
      landscapeRelief(Math.sin(a) * 6400, Math.cos(a) * 6400, identity),
    );
  assert.notDeepEqual(samples(urban), samples(rural));
  assert.deepEqual(urban, landscapeIdentity("urban_outpost", "medium"));
  assert.ok(!("tracks" in urban) && !("seed" in urban) && !("tick" in urban));
});

test("complete inner polygon edges retain optical clearance for every quality and configured origin", () => {
  for (const terrain of terrains)
    for (const quality of qualities)
      for (const origin of [
        { x: 0, z: 0 },
        { x: 300, z: 400 },
        { x: -700, z: -2400 },
      ]) {
        const opticalRange = origin.x === -700 ? 10000 : 1500;
        const flatRadius = Math.max(
          1700,
          Math.hypot(origin.x, origin.z) + opticalRange + 200,
        );
        const built = buildLandscapeIdentity(terrain, quality, flatRadius)!;
        assert.ok(built);
        const { identity, geometry, material } = built;
        const innerClosest =
          identity.innerRadius * Math.cos(Math.PI / identity.radialSegments);
        assert.ok(innerClosest >= flatRadius + LANDSCAPE_CLEARANCE_M - 1e-8);
        const p = geometry.getAttribute("position");
        for (let i = 0; i < p.count; i++) {
          assert.ok(
            Math.hypot(p.getX(i) - origin.x, p.getZ(i) - origin.z) >=
              opticalRange + 319.99,
          );
          assert.ok(Math.hypot(p.getX(i), p.getZ(i)) <= TERRAIN_RADIUS + 0.002);
          assert.ok(
            p.getY(i) >=
              terrainHeight(p.getX(i), p.getZ(i), terrain, flatRadius) - 0.01,
          );
        }
        geometry.dispose();
        material.dispose();
      }
});

test("no relief is manufactured within optical volume or beyond the local world boundary", () => {
  for (const terrain of terrains) {
    const identity = landscapeIdentity(terrain, "high")!;
    for (let angle = 0; angle < Math.PI * 2; angle += 0.07) {
      for (const r of [
        0,
        1200,
        1700,
        identity.innerRadius,
        identity.outerRadius,
        20000,
      ])
        assert.equal(
          landscapeRelief(Math.sin(angle) * r, Math.cos(angle) * r, identity),
          0,
        );
      for (
        let r = identity.innerRadius + 100;
        r < identity.outerRadius;
        r += 173
      ) {
        const h = landscapeRelief(
          Math.sin(angle) * r,
          Math.cos(angle) * r,
          identity,
        );
        assert.ok(h >= 0 && h <= identity.reliefBudget, `${terrain} ${h}`);
      }
    }
  }
});

test("tactical and exhausted valid envelopes omit scenery; invalid inputs fail without a safety clamp", () => {
  assert.equal(buildLandscapeIdentity("urban_outpost", "tactical"), null);
  for (const quality of qualities) {
    assert.equal(buildLandscapeIdentity("urban_outpost", quality, 13500), null);
    assert.equal(
      buildLandscapeIdentity("rural_forward_base", quality, 14000),
      null,
    );
    for (const radius of [NaN, Infinity, -Infinity, -1, 1699, 14001])
      assert.throws(
        () => landscapeIdentity("urban_outpost", quality, radius),
        RangeError,
      );
  }
  assert.throws(
    () => landscapeIdentity("urban_outpost", "unknown" as Quality),
    RangeError,
  );
  assert.throws(
    () => landscapeIdentity("urban_outpost", "toString" as Quality),
    RangeError,
  );
  assert.throws(
    () => landscapeIdentity("unknown" as TerrainKind, "medium"),
    RangeError,
  );
  assert.throws(
    () =>
      landscapeRelief(NaN, 0, landscapeIdentity("urban_outpost", "medium")!),
    RangeError,
  );
});

test("one finite indexed batch has deterministic bytes, smooth closed seam and bounded memory/topology", () => {
  for (const terrain of terrains)
    for (const quality of qualities) {
      const a = buildLandscapeIdentity(terrain, quality)!;
      const b = buildLandscapeIdentity(terrain, quality)!;
      const { geometry: g, material: m, identity } = a;
      assert.equal(g.groups.length, 0);
      assert.ok(g.index);
      assert.equal(
        g.index.count / 3,
        identity.radialSegments * identity.bands * 2,
      );
      assert.ok(g.index.count / 3 <= 15360);
      assert.equal(
        g.getAttribute("position").count,
        (identity.radialSegments + 1) * (identity.bands + 1),
      );
      let bytes = g.index.array.byteLength;
      for (const name of ["position", "normal", "color"]) {
        const values = g.getAttribute(name).array;
        assert.deepEqual(values, b.geometry.getAttribute(name).array);
        assert.ok([...values].every(Number.isFinite));
        bytes += values.byteLength;
        const attribute = g.getAttribute(name),
          stride = identity.radialSegments + 1;
        for (let band = 0; band <= identity.bands; band++) {
          const first = band * stride,
            last = first + identity.radialSegments;
          assert.deepEqual(
            [
              attribute.getX(first),
              attribute.getY(first),
              attribute.getZ(first),
            ],
            [attribute.getX(last), attribute.getY(last), attribute.getZ(last)],
          );
        }
      }
      assert.ok(bytes < 400000);
      assert.equal(m.type, "MeshLambertMaterial");
      assert.equal(m.vertexColors, true);
      assert.equal(m.fog, true);
      assert.equal(m.map, null);
      assert.equal(m.transparent, false);
      g.dispose();
      m.dispose();
      b.geometry.dispose();
      b.material.dispose();
    }
});

test("triangle winding faces upward and far material has no emissive or contact identity channel", () => {
  const { geometry, material } = buildLandscapeIdentity(
    "rural_forward_base",
    "high",
  )!;
  const p = geometry.getAttribute("position"),
    ids = geometry.index!;
  for (let i = 0; i < ids.count; i += 3) {
    const a = ids.getX(i),
      b = ids.getX(i + 1),
      c = ids.getX(i + 2);
    const normalY =
      (p.getZ(b) - p.getZ(a)) * (p.getX(c) - p.getX(a)) -
      (p.getX(b) - p.getX(a)) * (p.getZ(c) - p.getZ(a));
    assert.ok(normalY > 0);
  }
  assert.equal(material.emissive.getHex(), 0);
  assert.equal(material.userData.presentationOnly, true);
  assert.deepEqual(Object.keys(material.userData), ["presentationOnly"]);
  geometry.dispose();
  material.dispose();
});
