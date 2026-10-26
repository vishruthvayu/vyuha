import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import legacy from "./fixtures/world-presentation/legacy-ground-shaders.json";
import {
  createGroundMaterial,
  setGroundMode,
  type WorldTextures,
} from "./world/materials";
import { surfaceRadiancePolicy } from "./world/surface-radiance";

function textures(maps = true): WorldTextures {
  const white = new THREE.Texture();
  const color = new THREE.Texture();
  color.colorSpace = THREE.SRGBColorSpace;
  const data = new THREE.Texture();
  data.colorSpace = THREE.NoColorSpace;
  const p = { albedo: color, ...(maps ? { normal: data, orm: data } : {}) };
  return {
    groundDry: p,
    groundMacro: color,
    laterite: p,
    gravel: p,
    grass: color,
    asphalt: p,
    concreteFloor: p,
    concreteWall: p,
    plaster: p,
    corrugated: p,
    paintedMetal: p,
    vegetation: color,
    hesco: color,
    chainLink: color,
    white,
    splat: color,
  };
}
function compiled(m: THREE.Material) {
  const lib =
    m.type === "MeshStandardMaterial"
      ? THREE.ShaderLib.standard
      : m.type === "MeshLambertMaterial"
        ? THREE.ShaderLib.lambert
        : THREE.ShaderLib.basic;
  const s = {
    vertexShader: lib.vertexShader,
    fragmentShader: lib.fragmentShader,
    uniforms: {},
  };
  m.onBeforeCompile(s as never, {} as never);
  return s;
}

test("Low and all illustrative IR ground shaders retain exact frozen programs", () => {
  for (const terrain of ["urban_outpost", "rural_forward_base"] as const)
    for (const quality of ["low", "medium", "high"] as const)
      for (const thermal of [false, true]) {
        if (!thermal && quality !== "low") continue;
        const m = createGroundMaterial(textures(), quality, terrain, thermal),
          s = compiled(m);
        const expected =
          legacy.rows[
            `${terrain}:${quality}:${thermal ? "ir" : "eo"}` as keyof typeof legacy.rows
          ];
        assert.equal(
          createHash("sha256")
            .update(s.vertexShader + "\0" + s.fragmentShader)
            .digest("hex"),
          expected.shader_sha256,
        );
        assert.equal(m.type, expected.type);
        assert.equal(m.customProgramCacheKey(), expected.program_key);
        m.dispose();
      }
});

test("Medium and High use a bounded dielectric ground model with existing linear map data", () => {
  for (const q of ["medium", "high"] as const) {
    const t = textures();
    const m = createGroundMaterial(t, q, "urban_outpost", false);
    assert.ok(m instanceof THREE.MeshStandardMaterial);
    assert.equal(m.metalness, 0);
    assert.equal(m.displacementMap, null);
    const u = m.userData.groundUniforms;
    assert.equal(u.tSurfaceORM.value, t.groundDry.orm);
    assert.equal(u.tLateriteN.value, t.laterite.normal);
    assert.deepEqual(u.uSurfaceMaps.value.toArray(), [1, 1, 1, 1]);
    assert.equal(t.groundDry.albedo.colorSpace, THREE.SRGBColorSpace);
    assert.equal(t.groundDry.orm!.colorSpace, THREE.NoColorSpace);
    const s = compiled(m);
    assert.match(s.fragmentShader, /#include <lights_physical_fragment>/);
    assert.match(
      s.fragmentShader,
      /float roughnessFactor = clamp\(surfaceRoughness, 0.62, 0.98\)/,
    );
    assert.match(s.fragmentShader, /surfaceLayers = s/);
    assert.match(
      s.fragmentShader,
      /inverseTransformDirection\(normal, viewMatrix\)/,
    );
    assert.match(s.fragmentShader, /reflectedLight.indirectDiffuse \*= mix/);
    assert.doesNotMatch(s.fragmentShader, /float fade = uNormal/);
    assert.match(s.fragmentShader, /out vec4 surfaceLayers/);
    m.dispose();
  }
});

test("missing normal and roughness data stays neutral rather than sampling white as a tilted normal", () => {
  const m = createGroundMaterial(
    textures(false),
    "medium",
    "rural_forward_base",
    false,
  );
  assert.deepEqual(
    m.userData.groundUniforms.uSurfaceMaps.value.toArray(),
    [0, 0, 0, 0],
  );
  const s = compiled(m);
  assert.match(s.fragmentShader, /: vec3\(0.0,0.0,1.0\)/);
  assert.match(s.fragmentShader, /: vec3\(1.0\)/);
  m.dispose();
});

test("sensor palette updates preserve ground resources and do not turn a crop into geometry", () => {
  const m = createGroundMaterial(textures(), "medium", "urban_outpost", true);
  const u = m.userData.groundUniforms;
  const before = m.customProgramCacheKey();
  setGroundMode(m, { night: false, thermal: "white" });
  const white = u.uHot.value.clone();
  setGroundMode(m, { night: false, thermal: "black" });
  assert.equal(u, m.userData.groundUniforms);
  assert.equal(m.customProgramCacheKey(), before);
  assert.notDeepEqual(u.uHot.value, white);
  assert.equal(m.userData.surfacePolicy.physical, false);
  m.dispose();
});

test("policy separates tiers and EO ground participates in existing shader preparation", () => {
  for (const q of ["low", "tactical", "medium", "high"] as const)
    for (const thermal of [false, true]) {
      const p = surfaceRadiancePolicy(q, thermal);
      assert.ok(Object.isFrozen(p));
      assert.equal(p.physical, !thermal && (q === "medium" || q === "high"));
      assert.ok(p.normalStrength >= 0 && p.normalStrength <= 1);
      assert.ok(p.normalNear < p.normalFar);
    }
  const source = readFileSync(
    new URL("./world/Environment.tsx", import.meta.url),
    "utf8",
  );
  const warm = source.slice(
    source.indexOf("const all = ["),
    source.indexOf("gl.compile(warm"),
  );
  assert.match(warm, /eoMaterial/);
  assert.match(warm, /thermalMaterial/);
});

test("a missing overlay normal replaces dry detail with a flat layer rather than inheriting the wrong surface", () => {
  const t = textures();
  t.laterite = { albedo: t.laterite.albedo };
  t.gravel = { albedo: t.gravel.albedo };
  const m = createGroundMaterial(t, "medium", "urban_outpost", false),
    s = compiled(m);
  assert.deepEqual(
    m.userData.groundUniforms.uSurfaceMaps.value.toArray(),
    [1, 0, 0, 1],
  );
  assert.match(s.fragmentShader, /if \(surfaceLayers.r > 0.01\) \{/);
  assert.match(
    s.fragmentShader,
    /detail = mix\(detail,layerNormal,surfaceLayers.r\)/,
  );
  assert.match(
    s.fragmentShader,
    /detail = mix\(detail,layerNormal,surfaceLayers.g\)/,
  );
  assert.equal(
    (s.fragmentShader.match(/: vec3\(0.0,0.0,1.0\)/g) ?? []).length,
    3,
  );
  m.dispose();
});
