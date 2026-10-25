import * as THREE from "three";
import type { TerrainKind } from "./terrain";

export const SKY_PROBE_WIDTH = 64;
export const SKY_PROBE_HEIGHT = 32;
export const WORLD_SKY_YAW = -2.35;

type Fill = Readonly<{
  sky: string;
  ground: string;
  hemisphere: number;
  ambient: number;
  probeShare: number;
  maxProbeIrradiance: number;
  environment: number;
  sun: number;
  sunColor: string;
}>;
export type WorldLightingProfile = Readonly<{
  id: string;
  skyYaw: number;
  day: Fill;
  night: Fill;
}>;
const day = (probeShare: number): Fill =>
  Object.freeze({
    sky: "#d6e2ec",
    ground: "#5d5240",
    hemisphere: 0.55,
    ambient: 0.06,
    probeShare,
    maxProbeIrradiance: 0.6,
    environment: 0.65,
    sun: 2.6,
    sunColor: "#fff2dc",
  });
const night = (probeShare: number): Fill =>
  Object.freeze({
    sky: "#33445e",
    ground: "#0e0d0b",
    hemisphere: 0.06,
    ambient: 0.06,
    probeShare,
    maxProbeIrradiance: 0.065,
    environment: 0.25,
    sun: 0.12,
    sunColor: "#9fb4d6",
  });
const PROFILES: Readonly<Record<TerrainKind, WorldLightingProfile>> =
  Object.freeze({
    urban_outpost: Object.freeze({
      id: "urban-sky-light-v1",
      skyYaw: WORLD_SKY_YAW,
      day: day(0.62),
      night: night(0.4),
    }),
    rural_forward_base: Object.freeze({
      id: "rural-sky-light-v1",
      skyYaw: WORLD_SKY_YAW,
      day: day(0.7),
      night: night(0.45),
    }),
  });
export function worldLightingProfile(
  terrain: TerrainKind,
): WorldLightingProfile {
  return PROFILES[terrain];
}

/** Texture convention used by Three's equirectangular environment lookup.
 * Canvas rows run north to south. Visible SphereGeometry uses opposite U;
 * mirror the photographed sky when composing its environment/probe canvas. */
export function equirectangularDirection(u: number, v: number, yaw = 0) {
  const phi = (u - 0.5) * Math.PI * 2 - yaw;
  const theta = v * Math.PI;
  return new THREE.Vector3(
    Math.cos(phi) * Math.sin(theta),
    Math.cos(theta),
    Math.sin(phi) * Math.sin(theta),
  );
}

/** Display-derived, artistic diffuse lighting, NOT recovered HDR radiance.
 * 2048 samples maximum, nine RGB coefficients, no GPU readback or new asset.
 * Exact latitudinal solid-angle weights avoid oversampling the sky poles. */
export function projectSkyRadiance(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  yaw: number,
): THREE.SphericalHarmonics3 {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 4 ||
    height < 2 ||
    width > SKY_PROBE_WIDTH ||
    height > SKY_PROBE_HEIGHT ||
    pixels.length !== width * height * 4 ||
    !Number.isFinite(yaw)
  )
    throw new RangeError("Invalid bounded sky-probe image");
  const sh = new THREE.SphericalHarmonics3();
  const basis = new Array<number>(9).fill(0);
  const color = new THREE.Color();
  for (let y = 0; y < height; y++) {
    const weight =
      ((Math.cos((Math.PI * y) / height) -
        Math.cos((Math.PI * (y + 1)) / height)) *
        Math.PI *
        2) /
      width;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      color.setRGB(
        pixels[i] / 255,
        pixels[i + 1] / 255,
        pixels[i + 2] / 255,
        THREE.SRGBColorSpace,
      );
      const direction = equirectangularDirection(
        (x + 0.5) / width,
        (y + 0.5) / height,
        yaw,
      );
      THREE.SphericalHarmonics3.getBasisAt(direction, basis);
      for (let k = 0; k < 9; k++) {
        sh.coefficients[k].x += color.r * basis[k] * weight;
        sh.coefficients[k].y += color.g * basis[k] * weight;
        sh.coefficients[k].z += color.b * basis[k] * weight;
      }
    }
  }
  return sh;
}

// Conservative extrema of Three r180 getIrradianceAt's polynomial terms for
// any unit normal. xy/xz/yz <= 1/2 and x²-y² <=1. This is an analytic bound,
// rather than a sampled-direction brightness check.
const IRRADIANCE_BOUNDS = [
  0.886227, 1.023328, 1.023328, 1.023328, 0.429043, 0.429043, 0.495417,
  0.429043, 0.429043,
] as const;
export function probeIrradianceBounds(sh: THREE.SphericalHarmonics3) {
  const min = new THREE.Vector3(),
    max = new THREE.Vector3();
  for (let channel = 0; channel < 3; channel++) {
    const base =
      sh.coefficients[0].getComponent(channel) * IRRADIANCE_BOUNDS[0];
    let variation = 0;
    for (let i = 1; i < 9; i++)
      variation +=
        Math.abs(sh.coefficients[i].getComponent(channel)) *
        IRRADIANCE_BOUNDS[i];
    min.setComponent(channel, base - variation);
    max.setComponent(channel, base + variation);
  }
  return { min, max };
}
export function legacyUpwardFill(fill: Fill) {
  const sky = new THREE.Color(fill.sky);
  return new THREE.Vector3(sky.r, sky.g, sky.b)
    .multiplyScalar(fill.hemisphere)
    .addScalar(fill.ambient);
}

/** Replace only a declared fraction of the old hemi+ambient fill. PMREM's
 * existing diffuse/specular contribution stays unchanged. Shape coefficients
 * are damped if needed so irradiance cannot become negative or exceed the
 * finite per-channel budget; no speculative extra light energy is stacked. */
export function boundedSkyProbe(
  radiance: THREE.SphericalHarmonics3 | null,
  fill: Fill,
): THREE.SphericalHarmonics3 | null {
  if (
    !radiance ||
    !radiance.coefficients.every((v) => [v.x, v.y, v.z].every(Number.isFinite))
  )
    return null;
  const sh = radiance.clone();
  const bounds = probeIrradianceBounds(sh);
  for (let channel = 0; channel < 3; channel++) {
    const base =
      sh.coefficients[0].getComponent(channel) * IRRADIANCE_BOUNDS[0];
    if (!(base > 1e-8)) return null;
    const variation = bounds.max.getComponent(channel) - base;
    const scale = variation > base ? (base * 0.98) / variation : 1;
    for (let i = 1; i < 9; i++)
      sh.coefficients[i].setComponent(
        channel,
        sh.coefficients[i].getComponent(channel) * scale,
      );
  }
  const upward = sh.getIrradianceAt(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(),
  );
  const target = legacyUpwardFill(fill).multiplyScalar(fill.probeShare);
  const maximum = probeIrradianceBounds(sh).max;
  for (let channel = 0; channel < 3; channel++) {
    if (!(upward.getComponent(channel) > 1e-8)) return null;
    const gain = Math.min(
      target.getComponent(channel) / upward.getComponent(channel),
      fill.maxProbeIrradiance / maximum.getComponent(channel),
    );
    for (const coefficient of sh.coefficients)
      coefficient.setComponent(
        channel,
        coefficient.getComponent(channel) * gain,
      );
  }
  return sh;
}

/** A failed probe read preserves the old fill. Thermal/IR display materials
 * keep their existing policy and receive no added irradiance whatsoever. */
export function worldLightingState(
  profile: WorldLightingProfile,
  isNight: boolean,
  thermal: boolean,
  hasProbe: boolean,
) {
  const fill = isNight ? profile.night : profile.day;
  const share = !thermal && hasProbe ? fill.probeShare : 0;
  return {
    hemisphere: thermal ? 0 : fill.hemisphere * (1 - share),
    ambient: fill.ambient * (1 - share),
    probeIntensity: share > 0 ? 1 : 0,
    environment: fill.environment,
    sun: thermal ? 0 : fill.sun,
    sunColor: fill.sunColor,
    skyColor: fill.sky,
    groundColor: fill.ground,
  };
}

/** Snapshot scene-owned state once per Environment mount. Renderer/context
 * switches must not leave a lighting rotation/intensity behind for another view. */
export function preserveSceneLighting(
  scene: THREE.Scene,
  renderer: Pick<
    THREE.WebGLRenderer,
    "getClearColor" | "getClearAlpha" | "setClearColor"
  >,
) {
  const previous = {
    fog: scene.fog,
    environment: scene.environment,
    intensity: scene.environmentIntensity,
    rotation: scene.environmentRotation.clone(),
    color: renderer.getClearColor(new THREE.Color()).clone(),
    alpha: renderer.getClearAlpha(),
  };
  return () => {
    scene.fog = previous.fog;
    scene.environment = previous.environment;
    scene.environmentIntensity = previous.intensity;
    scene.environmentRotation.copy(previous.rotation);
    renderer.setClearColor(previous.color, previous.alpha);
  };
}
