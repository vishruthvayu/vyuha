import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import sky from "./world/assets/sky.json";
import {
  SKY_PROBE_WIDTH,
  SKY_PROBE_HEIGHT,
  WORLD_SKY_YAW,
  equirectangularDirection,
  projectSkyRadiance,
  boundedSkyProbe,
  probeIrradianceBounds,
  legacyUpwardFill,
  worldLightingProfile,
  worldLightingState,
  preserveSceneLighting,
} from "./world/world-lighting";

const width = SKY_PROBE_WIDTH,
  height = SKY_PROBE_HEIGHT;
function pixels(sample: (direction: THREE.Vector3) => THREE.Color) {
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const c = sample(
        equirectangularDirection((x + 0.5) / width, (y + 0.5) / height),
      )
        .clone()
        .convertLinearToSRGB();
      out.set([c.r * 255, c.g * 255, c.b * 255, 255], (y * width + x) * 4);
    }
  return out;
}
const constant = pixels(() => new THREE.Color().setRGB(0.4, 0.4, 0.4));
const close = (actual: number, expected: number, tolerance = 1e-6) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} differs from ${expected}`,
  );
const axes = [
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, -1, 0),
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(0, 0, -1),
];

test("constant environment produces analytic pi-times-radiance diffuse irradiance", () => {
  const sh = projectSkyRadiance(constant, width, height, 0);
  const decoded = new THREE.Color().setRGB(
    constant[0] / 255,
    constant[1] / 255,
    constant[2] / 255,
    THREE.SRGBColorSpace,
  );
  for (const normal of axes) {
    const e = sh.getIrradianceAt(normal, new THREE.Vector3());
    close(e.x, decoded.r * Math.PI, 0.003);
    close(e.y, decoded.g * Math.PI, 0.003);
    close(e.z, decoded.b * Math.PI, 0.003);
  }
});

test("directional environment reproduces the cosine-convolved linear field", () => {
  const image = pixels((d) =>
    new THREE.Color().setRGB(0.4 + 0.2 * d.x, 0.4, 0.4),
  );
  const sh = projectSkyRadiance(image, width, height, 0);
  for (const normal of axes) {
    const e = sh.getIrradianceAt(normal, new THREE.Vector3());
    close(e.x, 0.4 * Math.PI + ((2 * Math.PI) / 3) * 0.2 * normal.x, 0.009);
  }
});

test("yaw rotates the irradiance field without changing its energy", () => {
  const image = pixels((d) =>
    new THREE.Color().setRGB(0.4 + 0.2 * d.x, 0.3 + 0.1 * d.z, 0.4),
  );
  const original = projectSkyRadiance(image, width, height, 0);
  const rotated = projectSkyRadiance(image, width, height, Math.PI / 2);
  const periodic = projectSkyRadiance(image, width, height, Math.PI * 2);
  const rotation = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    Math.PI / 2,
  );
  for (const normal of axes) {
    const a = original.getIrradianceAt(normal, new THREE.Vector3());
    const b = rotated.getIrradianceAt(
      normal.clone().applyQuaternion(rotation),
      new THREE.Vector3(),
    );
    close(a.distanceTo(b), 0);
    close(
      a.distanceTo(periodic.getIrradianceAt(normal, new THREE.Vector3())),
      0,
    );
  }
});

test("mirrored environment coordinates agree with both photographed sky sun metadata", () => {
  for (const entry of Object.values(sky.skies)) {
    const direction = equirectangularDirection(1 - entry.sun.u, entry.sun.v);
    close(
      direction.distanceTo(new THREE.Vector3().fromArray(entry.sun.direction)),
      0,
      0.00008,
    );
    const visibleRotated = new THREE.Vector3()
      .fromArray(entry.sun.direction)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), WORLD_SKY_YAW);
    close(
      equirectangularDirection(
        1 - entry.sun.u,
        entry.sun.v,
        WORLD_SKY_YAW,
      ).distanceTo(visibleRotated),
      0,
      0.00008,
    );
  }
});

test("sample work is bounded and rejects non-finite dimensions/yaw", () => {
  for (const [w, h, yaw] of [
    [128, 32, 0],
    [64, 64, 0],
    [0, 0, 0],
    [4.5, 2, 0],
    [64, 32, NaN],
  ])
    assert.throws(() => projectSkyRadiance(constant, w, h, yaw), RangeError);
  assert.throws(
    () => projectSkyRadiance(new Uint8ClampedArray(4), width, height, 0),
    RangeError,
  );
});

test("authored probes replace a declared fill share and leave existing PMREM intensity unchanged", () => {
  const raw = projectSkyRadiance(constant, width, height, 0);
  for (const terrain of ["urban_outpost", "rural_forward_base"] as const)
    for (const isNight of [false, true]) {
      const profile = worldLightingProfile(terrain),
        fill = isNight ? profile.night : profile.day;
      const probe = boundedSkyProbe(raw, fill)!;
      const state = worldLightingState(profile, isNight, false, true);
      const reconstructed = probe
        .getIrradianceAt(new THREE.Vector3(0, 1, 0), new THREE.Vector3())
        .add(legacyUpwardFill(fill).multiplyScalar(1 - fill.probeShare));
      close(reconstructed.distanceTo(legacyUpwardFill(fill)), 0);
      close(state.hemisphere / fill.hemisphere, 1 - fill.probeShare);
      close(state.ambient / fill.ambient, 1 - fill.probeShare);
      assert.equal(state.environment, isNight ? 0.25 : 0.65);
      assert.equal(state.probeIntensity, 1);
    }
});

test("extreme directional fields stay nonnegative and inside analytic irradiance budget", () => {
  const image = pixels((d) =>
    new THREE.Color().setRGB(
      d.x > 0.8 ? 1 : 0.001,
      d.y > 0.8 ? 1 : 0.001,
      d.z > 0.8 ? 1 : 0.001,
    ),
  );
  const raw = projectSkyRadiance(image, width, height, WORLD_SKY_YAW);
  for (const terrain of ["urban_outpost", "rural_forward_base"] as const)
    for (const fill of [
      worldLightingProfile(terrain).day,
      worldLightingProfile(terrain).night,
    ]) {
      const bounded = boundedSkyProbe(raw, fill)!;
      const limits = probeIrradianceBounds(bounded);
      for (const n of [0, 1, 2]) {
        assert.ok(limits.min.getComponent(n) >= -1e-12);
        assert.ok(
          limits.max.getComponent(n) <= fill.maxProbeIrradiance + 1e-12,
        );
      }
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 32; x++) {
          const e = bounded.getIrradianceAt(
            equirectangularDirection(x / 32, (y + 0.5) / 16),
            new THREE.Vector3(),
          );
          for (const value of [e.x, e.y, e.z])
            assert.ok(
              value >= -1e-12 && value <= fill.maxProbeIrradiance + 1e-12,
            );
        }
    }
});

test("fallback and thermal/IR modes retain original light policy with no probe contribution", () => {
  for (const isNight of [false, true]) {
    const profile = worldLightingProfile("urban_outpost"),
      fill = isNight ? profile.night : profile.day;
    const fallback = worldLightingState(profile, isNight, false, false);
    assert.equal(fallback.hemisphere, fill.hemisphere);
    assert.equal(fallback.ambient, 0.06);
    assert.equal(fallback.probeIntensity, 0);
    for (const hasProbe of [false, true]) {
      const thermal = worldLightingState(profile, isNight, true, hasProbe);
      assert.equal(thermal.probeIntensity, 0);
      assert.equal(thermal.hemisphere, 0);
      assert.equal(thermal.sun, 0);
      assert.equal(thermal.ambient, 0.06);
      assert.equal(thermal.environment, fill.environment);
    }
  }
  assert.equal(
    boundedSkyProbe(null, worldLightingProfile("urban_outpost").day),
    null,
  );
  assert.equal(
    boundedSkyProbe(
      new THREE.SphericalHarmonics3(),
      worldLightingProfile("urban_outpost").day,
    ),
    null,
  );
  const invalid = new THREE.SphericalHarmonics3();
  invalid.coefficients[0].x = NaN;
  assert.equal(
    boundedSkyProbe(invalid, worldLightingProfile("urban_outpost").day),
    null,
  );
});

test("profile caches are immutable and projected/probe values have independent ownership", () => {
  const profile = worldLightingProfile("urban_outpost");
  assert.equal(worldLightingProfile("urban_outpost"), profile);
  assert.ok(
    Object.isFrozen(profile) &&
      Object.isFrozen(profile.day) &&
      Object.isFrozen(profile.night),
  );
  assert.equal(Reflect.set(profile.day, "probeShare", 1000), false);
  const raw = projectSkyRadiance(constant, width, height, 0);
  const reference = raw.toArray();
  const a = boundedSkyProbe(raw, profile.day)!,
    b = boundedSkyProbe(raw, profile.day)!;
  assert.deepEqual(a.toArray(), b.toArray());
  a.zero();
  assert.notDeepEqual(a.toArray(), b.toArray());
  assert.deepEqual(raw.toArray(), reference);
  assert.deepEqual(
    projectSkyRadiance(constant, width, height, 0).toArray(),
    reference,
  );
});

test("scene cleanup restores prior fog, environment, intensity, rotation and clear state", () => {
  const scene = new THREE.Scene();
  const fog = new THREE.FogExp2("#123456", 0.1),
    environment = new THREE.Texture();
  scene.fog = fog;
  scene.environment = environment;
  scene.environmentIntensity = 0.17;
  scene.environmentRotation.set(0.1, 0.2, 0.3);
  let clear = new THREE.Color("#102030"),
    alpha = 0.4;
  const renderer = {
    getClearColor: (target: THREE.Color) => target.copy(clear),
    getClearAlpha: () => alpha,
    setClearColor: (color: THREE.ColorRepresentation, nextAlpha = 1) => {
      clear = new THREE.Color(color);
      alpha = nextAlpha;
    },
  };
  const restore = preserveSceneLighting(scene, renderer);
  scene.fog = null;
  scene.environment = new THREE.Texture();
  scene.environmentIntensity = 3;
  scene.environmentRotation.set(0, WORLD_SKY_YAW, 0);
  renderer.setClearColor("white", 1);
  restore();
  assert.equal(scene.fog, fog);
  assert.equal(scene.environment, environment);
  assert.equal(scene.environmentIntensity, 0.17);
  assert.deepEqual(scene.environmentRotation.toArray(), [0.1, 0.2, 0.3, "XYZ"]);
  assert.equal(clear.getHexString(), "102030");
  assert.equal(alpha, 0.4);
  environment.dispose();
});
