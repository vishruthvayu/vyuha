import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as THREE from "three";
import {
  addLogisticsArchitecture,
  buildLogisticsArchitecture,
  isAuthoredStructure,
  type AuthoredStructure,
} from "./world/logistics-kit";
import { Batches } from "./world/kit";
import { MATERIAL_THERMAL } from "./world/materials";

function fixture(kind: AuthoredStructure["kind"], rot = 0): AuthoredStructure {
  return {
    kind,
    x: 45,
    z: -63,
    rot,
    w: 32,
    d: 22,
    h: kind === "waterTower" ? 24 : 12,
  };
}

const authoredComposition: AuthoredStructure[] = [
  { kind: "terminal", x: -64, z: 58, rot: Math.PI, w: 68, d: 22, h: 15 },
  { kind: "logisticsShed", x: 76, z: 80, rot: Math.PI, w: 46, d: 54, h: 14 },
  { kind: "waterTower", x: -126, z: 122, rot: 0, w: 16, d: 16, h: 32 },
];

test("authored logistics kit stays inside declared metric bounds, including roof plant", () => {
  for (const kind of ["terminal", "logisticsShed", "waterTower"] as const) {
    for (const rot of [0, 0.37, Math.PI / 2]) {
      const p = fixture(kind, rot);
      const batches = buildLogisticsArchitecture([p]).merged();
      const inverse = new THREE.Matrix4().makeRotationY(-rot);
      for (const g of batches.values()) {
        const pos = g.getAttribute("position");
        for (let i = 0; i < pos.count; i++) {
          const v = new THREE.Vector3(
            pos.getX(i) - p.x,
            pos.getY(i),
            pos.getZ(i) - p.z,
          ).applyMatrix4(inverse);
          assert.ok(Math.abs(v.x) <= p.w / 2 + 1.001, `${kind} x ${v.x}`);
          assert.ok(Math.abs(v.z) <= p.d / 2 + 1.001, `${kind} z ${v.z}`);
          assert.ok(v.y >= -0.001 && v.y <= p.h + 0.001, `${kind} y ${v.y}`);
        }
        g.dispose();
      }
    }
  }
});

test("all authored surfaces have finite metric UVs, normalized normals, and thermal classes", () => {
  const batches = buildLogisticsArchitecture([
    fixture("terminal"),
    fixture("logisticsShed"),
    fixture("waterTower"),
  ]).merged();
  for (const [key, g] of batches) {
    assert.ok(key in MATERIAL_THERMAL);
    for (const attr of ["position", "normal", "uv", "color"]) {
      const a = g.getAttribute(attr);
      assert.ok(a);
      for (const n of a.array) assert.ok(Number.isFinite(n), `${key}/${attr}`);
    }
    const normals = g.getAttribute("normal");
    for (let i = 0; i < normals.count; i++) {
      const n = Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i));
      assert.ok(Math.abs(n - 1) < 0.0001, `${key} normal ${n}`);
    }
    g.dispose();
  }
});

test("authored geometry is deterministic and six buildings remain within the static geometry budget", () => {
  const inputs = authoredComposition;
  const hashes = () => {
    const b = buildLogisticsArchitecture([...inputs, ...inputs]);
    assert.ok(
      b.triangles < 30000 && b.triangles > 1000,
      `${b.triangles} triangles`,
    );
    const result = [...b.merged()].map(([key, g]) => {
      const hash = createHash("sha256");
      for (const attr of ["position", "normal", "uv", "color"])
        hash.update(Buffer.from(g.getAttribute(attr).array.buffer));
      g.dispose();
      return [key, hash.digest("hex")];
    });
    assert.ok(result.length <= 9, `${result.length} batches`);
    return result;
  };
  assert.deepEqual(hashes(), hashes());
});

test("shed roof has real rising planes spanning each clerestory tooth", () => {
  const p = { ...fixture("logisticsShed"), x: 0, z: 0, rot: 0 };
  const geometries = buildLogisticsArchitecture([p]).merged();
  const roof = geometries.get("corrugated")!;
  const vertices = roof.getAttribute("position");
  const normals = roof.getAttribute("normal");
  let count = 0;
  const heights = new Set<string>();
  for (let i = 0; i < vertices.count; i++) {
    if (normals.getY(i) < 0.5 || Math.abs(normals.getX(i)) < 0.01) continue;
    count++;
    heights.add(vertices.getY(i).toFixed(3));
    assert.ok(normals.getX(i) < 0, "roof rises toward +x");
    assert.ok(Math.abs(vertices.getZ(i)) <= p.d / 2 + 0.001);
  }
  assert.equal(count, Math.max(2, Math.ceil(p.w / 9)) * 6);
  assert.deepEqual(
    [...heights].sort(),
    [(p.h * 0.72).toFixed(3), p.h.toFixed(3)].sort(),
  );
  for (const g of geometries.values()) g.dispose();
});

test("invalid authored envelopes fail before geometry allocation", () => {
  for (const patch of [
    { w: NaN },
    { d: 0 },
    { h: 2 },
    { h: Infinity },
    { w: 1000 },
    { x: Infinity },
  ])
    assert.throws(
      () => buildLogisticsArchitecture([{ ...fixture("terminal"), ...patch }]),
      RangeError,
    );
});

test("authored objects append to an existing batch and preserve shared material merging", () => {
  const b = new Batches();
  addLogisticsArchitecture(b, [fixture("terminal")]);
  const before = b.triangles;
  addLogisticsArchitecture(b, [fixture("logisticsShed")]);
  assert.ok(b.triangles > before);
  for (const g of b.merged().values()) g.dispose();
  assert.ok(isAuthoredStructure(fixture("waterTower")));
  assert.equal(isAuthoredStructure({ kind: "building" }), false);
});
