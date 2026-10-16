import * as THREE from "three";
import type { ThermalPalette } from "../presentation";

/** Approximate thermal appearance model. Illustrative, never radiometric:
 * every surface class has an apparent-temperature index in [0, 1] for day and
 * night (sun-heated metal is warm by day and cools fastest at night, glass is
 * cool by day and shows warm interiors at night). The index is mapped through
 * the selected display palette, with variation taken from the visible texture
 * so surfaces keep structure. It encodes no sensor measurement and no contact
 * identity. */
export type ThermalClass = {
  day: number;
  night: number;
  variation: number;
  /** Solar gain by day: how much a face turned to the sun warms over a horizontal
   * one, and a face turned away cools (absorptivity over thermal mass). */
  sun?: number;
};
export const THERMAL_CLASSES = {
  sky: { day: 0.06, night: 0.03, variation: 0 },
  ground: { day: 0.5, night: 0.36, variation: 0.22 },
  terrainFar: { day: 0.44, night: 0.33, variation: 0.12 },
  asphalt: { day: 0.62, night: 0.46, variation: 0.1, sun: 0.08 },
  concrete: { day: 0.48, night: 0.41, variation: 0.14, sun: 0.1 },
  plaster: { day: 0.47, night: 0.42, variation: 0.1, sun: 0.1 },
  metalRoof: { day: 0.64, night: 0.2, variation: 0.08, sun: 0.13 },
  paintedMetal: { day: 0.56, night: 0.29, variation: 0.1, sun: 0.12 },
  steel: { day: 0.52, night: 0.26, variation: 0.05, sun: 0.1 },
  // Glass is opaque in long-wave IR: it shows reflected cold sky, not the warm
  // room behind it, so lit and unlit windows look the same and cooler than walls.
  glass: { day: 0.34, night: 0.33, variation: 0.03, sun: 0.03 },
  glassLit: { day: 0.34, night: 0.33, variation: 0.03, sun: 0.03 },
  fabric: { day: 0.53, night: 0.34, variation: 0.12, sun: 0.12 },
  vegetation: { day: 0.43, night: 0.4, variation: 0.14, sun: 0.03 },
  rubber: { day: 0.55, night: 0.33, variation: 0.06, sun: 0.08 },
  lamp: { day: 0.5, night: 0.86, variation: 0 },
  exhaust: { day: 0.9, night: 0.94, variation: 0.04 },
  engineBay: { day: 0.66, night: 0.6, variation: 0.05 },
  // Airframes (milestone 4 uses these): structure, battery bay, motors.
  airframe: { day: 0.6, night: 0.55, variation: 0.06 },
  airframeWarm: { day: 0.72, night: 0.7, variation: 0.04 },
  motor: { day: 0.93, night: 0.95, variation: 0.02 },
  feathers: { day: 0.7, night: 0.74, variation: 0.06 },
} satisfies Record<string, ThermalClass>;
export type ThermalClassName = keyof typeof THERMAL_CLASSES;

/** Three-stop gradients: cold, mid, hot. "night" is the styled IR night display. */
export const THERMAL_GRADIENTS: Record<
  ThermalPalette | "night",
  [string, string, string]
> = {
  white: ["#07090a", "#6d736e", "#ffffff"],
  black: ["#f4f6f2", "#6b716c", "#08090a"],
  amber: ["#120904", "#8c5a22", "#fff0bf"],
  night: ["#020a06", "#3b6a4d", "#e2ffe9"],
};
export function thermalColor(
  t: number,
  palette: ThermalPalette | "night",
  out = new THREE.Color(),
) {
  const [c, m, h] = THERMAL_GRADIENTS[palette].map((v) => new THREE.Color(v));
  const k = Math.min(1, Math.max(0, t));
  return k < 0.5
    ? out.copy(c).lerp(m, k / 0.5)
    : out.copy(m).lerp(h, (k - 0.5) / 0.5);
}
/** Display value of an index under the day/night display range (CPU side). */
export function displayThermal(t: number, night: boolean) {
  const [lo, hi] = night ? THERMAL_RANGE.night : THERMAL_RANGE.day;
  return Math.min(1, Math.max(0, (t - lo) / (hi - lo)));
}
export function thermalIndex(cls: ThermalClass, night: boolean) {
  return night ? cls.night : cls.day;
}
/** Index shift of a face with unit world normal `n` under the day sun `sun`
 * (unit, pointing at the sun). Horizontal faces keep the class value; faces
 * turned to the sun warm and faces turned away cool. Zero at night. Mirrors the
 * shader in `createThermalMaterial`. */
export function solarShift(
  cls: ThermalClass,
  night: boolean,
  n: THREE.Vector3,
  sun: THREE.Vector3,
) {
  if (night || !cls.sun) return 0;
  return cls.sun * (Math.max(n.dot(sun), 0) - Math.max(sun.y, 0));
}

export type ThermalUniforms = {
  uCold: { value: THREE.Color };
  uMid: { value: THREE.Color };
  uHot: { value: THREE.Color };
  uTemp: { value: number };
  uVariation: { value: number };
  /** Display range (like an imager's automatic gain): index lo → cold, hi → hot. */
  uRange: { value: THREE.Vector2 };
  /** World direction to the sun and this class's solar gain (0 at night). */
  uSunDir: { value: THREE.Vector3 };
  uSunGain: { value: number };
};
/** Fixed display ranges standing in for automatic gain control. The night scene
 * is colder and narrower, so it is stretched more. Hot engines saturate. */
export const THERMAL_RANGE = {
  day: [0.3, 0.8] as const,
  night: [0.18, 0.74] as const,
};
export function thermalUniforms(): ThermalUniforms {
  return {
    uCold: { value: new THREE.Color() },
    uMid: { value: new THREE.Color() },
    uHot: { value: new THREE.Color() },
    uTemp: { value: 0.5 },
    uVariation: { value: 0.1 },
    uRange: { value: new THREE.Vector2(0, 1) },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunGain: { value: 0 },
  };
}
export function setThermalUniforms(
  u: ThermalUniforms,
  cls: ThermalClass,
  night: boolean,
  palette: ThermalPalette | "night",
) {
  const [c, m, h] = THERMAL_GRADIENTS[palette];
  u.uCold.value.set(c);
  u.uMid.value.set(m);
  u.uHot.value.set(h);
  u.uTemp.value = thermalIndex(cls, night);
  u.uVariation.value = cls.variation;
  const [lo, hi] = night ? THERMAL_RANGE.night : THERMAL_RANGE.day;
  u.uRange.value.set(lo, hi);
  u.uSunGain.value = night ? 0 : (cls.sun ?? 0);
}
export const THERMAL_GLSL = /* glsl */ `
uniform vec3 uCold;
uniform vec3 uMid;
uniform vec3 uHot;
uniform float uTemp;
uniform float uVariation;
uniform vec2 uRange;
uniform vec3 uSunDir;
uniform float uSunGain;
vec3 thermalRamp(float t) {
  t = clamp((t - uRange.x) / max(uRange.y - uRange.x, 1e-3), 0.0, 1.0);
  return t < 0.5 ? mix(uCold, uMid, t * 2.0) : mix(uMid, uHot, t * 2.0 - 1.0);
}
`;

/** A palette-mapped twin of a surface material. Keeps the source's albedo map
 * (and vertex colour / instancing support) only to modulate the index. With a
 * sun direction, faces warm or cool by day with their angle to the sun. */
export function createThermalMaterial(
  source: THREE.Material & {
    map?: THREE.Texture | null;
    side?: THREE.Side;
    alphaTest?: number;
    transparent?: boolean;
    opacity?: number;
  },
  cls: ThermalClass,
  sun?: THREE.Vector3,
) {
  const uniforms = thermalUniforms();
  if (sun) uniforms.uSunDir.value.copy(sun).normalize();
  const material = new THREE.MeshBasicMaterial({
    map: source.map ?? null,
    side: source.side,
    alphaTest: source.alphaTest ?? 0,
    transparent: source.transparent,
    opacity: source.opacity ?? 1,
    depthWrite: source.depthWrite,
    // Keep the source's fog setting: the sky dome is unfogged.
    fog: (source as { fog?: boolean }).fog ?? true,
    // Palette colours are display values: no tone mapping.
    toneMapped: false,
  });
  material.userData.thermal = { uniforms, cls };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vThermalN;",
      )
      .replace(
        "#include <begin_vertex>",
        /* glsl */ `#include <begin_vertex>
        {
          vec3 tN = normal;
          #ifdef USE_INSTANCING
            tN = mat3( instanceMatrix ) * tN;
          #endif
          vThermalN = mat3( modelMatrix ) * tN;
        }`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>\nvarying vec3 vThermalN;\n${THERMAL_GLSL}`,
      )
      .replace(
        "#include <map_fragment>",
        /* glsl */ `
        float tLum = 0.5;
        #ifdef USE_MAP
          vec4 tTexel = texture2D( map, vMapUv );
          tLum = dot( tTexel.rgb, vec3( 0.299, 0.587, 0.114 ) );
          diffuseColor.a *= tTexel.a;
        #endif
        float tSun = 0.0;
        if ( uSunGain > 0.0 && dot( vThermalN, vThermalN ) > 1e-8 ) {
          vec3 tn = normalize( vThermalN );
          #ifdef DOUBLE_SIDED
            tn *= gl_FrontFacing ? 1.0 : -1.0;
          #endif
          tSun = uSunGain * ( max( dot( tn, uSunDir ), 0.0 ) - max( uSunDir.y, 0.0 ) );
        }
        diffuseColor.rgb = thermalRamp( uTemp + tSun + ( tLum - 0.45 ) * uVariation );
        `,
      )
      .replace("#include <color_fragment>", "");
  };
  material.customProgramCacheKey = () => "vyuha-thermal";
  return material;
}
