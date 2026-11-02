import { authoredFinishEnabled } from "./world/authored-finish-policy";
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import * as THREE from "three";
import { testPython } from "./test-python";
import type { TrainingSite } from "./training-site-contract";
import { authoredShadowFit } from "./world/authored-shadows";
import {
  applyFacadeRadiance,
  facadeRadiancePolicy,
} from "./world/facade-radiance";
import { createThermalMaterial, THERMAL_CLASSES } from "./world/thermal";
import { siteShadowProfile } from "./world/presentation-profile";
import sky from "./world/assets/sky.json";
import { WORLD_SKY_YAW } from "./world/world-lighting";

const sites = JSON.parse(
  execFileSync(
    testPython(),
    [
      "-c",
      "import json;from server.training_sites import training_site;print(json.dumps([training_site(x) for x in ('freight_corridor','open_campus')]))",
    ],
    { cwd: "..", encoding: "utf8" },
  ),
) as TrainingSite[];
const sun = new THREE.Vector3()
  .fromArray(sky.skies["sky-day"].sun.direction)
  .applyAxisAngle(new THREE.Vector3(0, 1, 0), WORLD_SKY_YAW)
  .normalize();

test("same-build presentation ablation requires an explicit baseline and defaults to the authored finish", () => {
  assert.equal(authoredFinishEnabled("?authoredFinish=baseline"), false);
  for (const search of [
    "",
    "?authoredFinish=next",
    "?authoredFinish=0",
    "?quality=low",
  ])
    assert.equal(authoredFinishEnabled(search), true);
});

test("fitted daylight shadow camera encloses authored volumes and projected receivers at unchanged map cost", () => {
  for (const site of sites) {
    const frozen = JSON.stringify(site);
    const fit = authoredShadowFit(site, sun);
    const camera = new THREE.OrthographicCamera(
      fit.left,
      fit.right,
      fit.top,
      fit.bottom,
      fit.near,
      fit.far,
    );
    camera.position.copy(fit.position);
    camera.lookAt(fit.target);
    camera.updateMatrixWorld(true);
    const check = (p: THREE.Vector3) => {
      const clip = p.clone().project(camera);
      assert.ok(
        [clip.x, clip.y, clip.z].every((n) => n > -1 && n < 1),
        JSON.stringify({ p, clip }),
      );
    };
    for (const b of site.structures)
      for (const x of [b.x_min, b.x_max])
        for (const z of [b.z_min, b.z_max])
          for (const y of [0, b.height]) {
            check(new THREE.Vector3(x, y, z));
            check(
              new THREE.Vector3(
                x - (sun.x * y) / sun.y,
                0,
                z - (sun.z * y) / sun.y,
              ),
            );
          }
    for (const x of [-410, 410])
      for (const z of [-320, 590]) check(new THREE.Vector3(x, 48, z));
    const old = siteShadowProfile(site, "medium");
    const areaRatio =
      ((fit.right - fit.left) * (fit.top - fit.bottom)) / (old.radius * 2) ** 2;
    assert.ok(areaRatio < 0.9);
    assert.equal(JSON.stringify(site), frozen);
    console.info(
      JSON.stringify({
        site: site.id,
        map: old.resolution,
        oldArea: (old.radius * 2) ** 2,
        fittedArea: (fit.right - fit.left) * (fit.top - fit.bottom),
        areaRatio,
        width: fit.right - fit.left,
        height: fit.top - fit.bottom,
        near: fit.near,
        far: fit.far,
      }),
    );
  }
  assert.throws(
    () => authoredShadowFit(sites[0], new THREE.Vector3(0, 0, 1)),
    RangeError,
  );
  assert.throws(
    () => authoredShadowFit(sites[0], new THREE.Vector3(NaN, 1, 0)),
    RangeError,
  );
});

function compile(material: THREE.Material) {
  const shader = {
    uniforms: {},
    vertexShader: THREE.ShaderLib.standard.vertexShader,
    fragmentShader: THREE.ShaderLib.standard.fragmentShader,
  };
  material.onBeforeCompile(
    shader as Parameters<THREE.Material["onBeforeCompile"]>[0],
    {} as THREE.WebGLRenderer,
  );
  return shader;
}
test("authored mineral finish patches installed Standard chunks without geometry, visibility or new texture samples", () => {
  const material = new THREE.MeshStandardMaterial();
  const params = {
    transparent: material.transparent,
    depthWrite: material.depthWrite,
    opacity: material.opacity,
  };
  applyFacadeRadiance(material, "plaster", "medium");
  const shader = compile(material);
  for (const value of [
    "vFacadePosition",
    "facadeWeather",
    "roughnessFactor = clamp",
  ])
    assert.ok((shader.vertexShader + shader.fragmentShader).includes(value));
  assert.ok("uFacadeFinish" in shader.uniforms);
  assert.equal(
    (shader.fragmentShader.match(/texture2D/g) ?? []).length,
    (THREE.ShaderLib.standard.fragmentShader.match(/texture2D/g) ?? []).length,
  );
  assert.equal(
    (shader.vertexShader.match(/#include <project_vertex>/g) ?? []).length,
    1,
  );
  assert.equal(
    (shader.fragmentShader.match(/#include <roughnessmap_fragment>/g) ?? [])
      .length,
    1,
  );
  assert.deepEqual(
    {
      transparent: material.transparent,
      depthWrite: material.depthWrite,
      opacity: material.opacity,
    },
    params,
  );
  assert.equal(
    material.customProgramCacheKey(),
    "vyuha-authored-facade-radiance-v1",
  );
  material.dispose();
});

test("quality fallback, undecorated materials and thermal shader stay frozen", () => {
  for (const quality of ["low", "tactical"] as const)
    assert.equal(facadeRadiancePolicy("plaster", quality), null);
  for (const key of ["glass", "lamp", "fence", "marking", "asphalt"] as const)
    assert.equal(facadeRadiancePolicy(key, "high"), null);
  const source = new THREE.MeshStandardMaterial();
  const before = compile(
    createThermalMaterial(source, THERMAL_CLASSES.plaster, sun),
  );
  applyFacadeRadiance(source, "plaster", "high");
  const after = compile(
    createThermalMaterial(source, THERMAL_CLASSES.plaster, sun),
  );
  assert.equal(after.vertexShader, before.vertexShader);
  assert.equal(after.fragmentShader, before.fragmentShader);
  assert.equal(after.fragmentShader.includes("facadeWeather"), false);
  const low = new THREE.MeshStandardMaterial();
  applyFacadeRadiance(low, "plaster", "low");
  assert.equal(
    compile(low).fragmentShader,
    THREE.ShaderLib.standard.fragmentShader,
  );
  source.dispose();
  low.dispose();
});

test("incompatible future shader chunks keep the complete stock shader instead of partially patching GLSL", () => {
  const material = applyFacadeRadiance(
    new THREE.MeshStandardMaterial(),
    "plaster",
    "medium",
  );
  const shader = {
    uniforms: {},
    vertexShader: THREE.ShaderLib.standard.vertexShader,
    fragmentShader: THREE.ShaderLib.standard.fragmentShader.replace(
      "#include <roughnessmap_fragment>",
      "// future roughness",
    ),
  };
  const before = { ...shader };
  material.onBeforeCompile(
    shader as Parameters<THREE.Material["onBeforeCompile"]>[0],
    {} as THREE.WebGLRenderer,
  );
  assert.deepEqual(shader, before);
  assert.deepEqual(shader.uniforms, {});
  assert.equal(
    material.userData.facadeRadianceFallback,
    "unsupported-shader-chunks",
  );
  material.dispose();
});
