/** Run from repository root:
 * node --import ./client/node_modules/tsx/dist/loader.mjs docs/next-generation/product-program/evidence/benchmark-graphics-preparation.ts
 * Node CPU preparation only: this does NOT create a renderer or measure GPU work. */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import * as THREE from "../../../../client/node_modules/three/build/three.module.js";
import { authoredShadowFit } from "../../../../client/src/world/authored-shadows.ts";
import { applyFacadeRadiance } from "../../../../client/src/world/facade-radiance.ts";
import { siteShadowProfile } from "../../../../client/src/world/presentation-profile.ts";
import { WORLD_SKY_YAW } from "../../../../client/src/world/world-lighting.ts";
import { testPython } from "../../../../client/src/test-python.ts";
import type { TrainingSite } from "../../../../client/src/training-site-contract.ts";
const root = fileURLToPath(new URL("../../../../", import.meta.url));
const sites = JSON.parse(execFileSync(testPython(), ["-c",
  "import json;from server.training_sites import training_site;print(json.dumps([training_site(x) for x in ('freight_corridor','open_campus')]))",
], { cwd: root, encoding: "utf8" })) as TrainingSite[];
const sky = JSON.parse(readFileSync(new URL("../../../../client/src/world/assets/sky.json", import.meta.url), "utf8"));
const sun = new THREE.Vector3().fromArray(sky.skies["sky-day"].sun.direction)
  .applyAxisAngle(new THREE.Vector3(0, 1, 0), WORLD_SKY_YAW).normalize();
const stock = new THREE.MeshStandardMaterial();
const sourceFiles = ["client/src/world/authored-shadows.ts", "client/src/world/facade-radiance.ts"];
const hash = createHash("sha256");
for (const name of sourceFiles) hash.update(name).update(readFileSync(root + name));
const keys = ["plaster", "concrete", "paint", "corrugated"] as const;
function prepare(site: TrainingSite, candidate: boolean) {
  if (candidate) authoredShadowFit(site, sun);
  else siteShadowProfile(site, "medium");
  for (const key of keys) {
    const m = stock.clone();
    if (candidate) applyFacadeRadiance(m, key, "medium");
    m.onBeforeCompile({
      uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader,
      fragmentShader: THREE.ShaderLib.standard.fragmentShader,
    } as Parameters<typeof m.onBeforeCompile>[0], {} as THREE.WebGLRenderer);
    m.dispose();
  }
}
const repetitions = 100;
function measure(site: TrainingSite, candidate: boolean) {
  const started = performance.now();
  for (let i = 0; i < repetitions; i++) prepare(site, candidate);
  return (performance.now() - started) / repetitions;
}
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return (sorted[3] + sorted[4]) / 2;
};
const results = sites.map((site) => {
  for (let i = 0; i < 100; i++) { prepare(site, false); prepare(site, true); }
  const baseline: number[] = [], candidate: number[] = [];
  for (let i = 0; i < 8; i++) {
    if (i % 2) { candidate.push(measure(site, true)); baseline.push(measure(site, false)); }
    else { baseline.push(measure(site, false)); candidate.push(measure(site, true)); }
  }
  const fit = authoredShadowFit(site, sun), old = siteShadowProfile(site, "medium");
  return { site: site.id, repetitions_per_sample: repetitions, baseline_ms: baseline, candidate_ms: candidate,
    baseline_median_ms: median(baseline), candidate_median_ms: median(candidate),
    shadow: { old_area_m2: (old.radius * 2) ** 2,
      fitted_area_m2: (fit.right - fit.left) * (fit.top - fit.bottom),
      fitted_width_m: fit.right - fit.left, fitted_height_m: fit.top - fit.bottom,
      unchanged_resolution: old.resolution },
  };
});
stock.dispose();
console.log(JSON.stringify({ schema_version: 1, measured_at: new Date().toISOString(),
  runtime: process.version, platform: process.platform, arch: process.arch,
  source_files: sourceFiles, source_hash: hash.digest("hex"),
  scope: "Alternating warmed Node CPU-only shadow-fit, four material clones and shader-string setup. No renderer, driver compile, texture upload, frame-time or GPU result. Concurrent host load not isolated.",
  results,
}, null, 2));
