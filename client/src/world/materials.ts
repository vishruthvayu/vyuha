import * as THREE from "three";
import type { ThermalPalette } from "../presentation";
import type { Quality } from "../quality";
import type { MaterialKey } from "./kit";
import { SPLAT_SIZE } from "./procedural-textures";
import {
  THERMAL_CLASSES,
  EDGE_FADE_GLSL,
  THERMAL_GLSL,
  createThermalMaterial,
  setThermalUniforms,
  thermalUniforms,
  type ThermalClassName,
} from "./thermal";
import type { TerrainKind } from "./terrain";

export type PbrSet = {
  albedo: THREE.Texture;
  normal?: THREE.Texture;
  orm?: THREE.Texture;
};
export type WorldTextures = {
  groundDry: PbrSet;
  groundMacro: THREE.Texture;
  laterite: PbrSet;
  gravel: PbrSet;
  grass: THREE.Texture;
  asphalt: PbrSet;
  concreteFloor: PbrSet;
  concreteWall: PbrSet;
  plaster: PbrSet;
  corrugated: PbrSet;
  paintedMetal: PbrSet;
  vegetation: THREE.Texture;
  hesco: THREE.Texture;
  chainLink: THREE.Texture;
  white: THREE.Texture;
  splat: THREE.Texture;
};
/** Physical tile size (m) of each texture set, matching the Poly Haven scans. */
const TILE = {
  asphalt: 3,
  concreteFloor: 3,
  concreteWall: 2.7,
  plaster: 3,
  corrugated: 2.7,
  paintedMetal: 2,
};
export type Mode = { night: boolean; thermal: ThermalPalette | "night" | null };

function pbr(
  set: PbrSet,
  tile: number,
  quality: Quality,
  params: THREE.MeshStandardMaterialParameters = {},
) {
  const material = new THREE.MeshStandardMaterial({
    map: set.albedo,
    normalMap: quality === "low" ? null : (set.normal ?? null),
    roughnessMap: set.orm ?? null,
    metalnessMap: set.orm ?? null,
    aoMap: set.orm ?? null,
    aoMapIntensity: 0.7,
    vertexColors: true,
    roughness: 1,
    metalness: set.orm ? 1 : 0,
    ...params,
  });
  // Metric UVs: scale every map with one transform (three applies the map transform).
  for (const t of [set.albedo, set.normal, set.orm])
    if (t) t.repeat.set(1 / tile, 1 / tile);
  if (material.normalMap) material.normalScale.set(0.8, 0.8);
  return material;
}

/** Which thermal class each kit material uses. */
export const MATERIAL_THERMAL: Record<MaterialKey, ThermalClassName> = {
  plaster: "plaster",
  concrete: "concrete",
  concreteFloor: "concrete",
  corrugated: "metalRoof",
  paint: "paintedMetal",
  steel: "steel",
  glass: "glass",
  glassLit: "glassLit",
  fabric: "fabric",
  hesco: "fabric",
  rubber: "rubber",
  lamp: "lamp",
  asphalt: "asphalt",
  marking: "asphalt",
  fence: "steel",
  exhaust: "exhaust",
};

export function createKitMaterials(t: WorldTextures, quality: Quality) {
  const m: Record<MaterialKey, THREE.MeshStandardMaterial> = {
    plaster: pbr(t.plaster, TILE.plaster, quality),
    concrete: pbr(t.concreteWall, TILE.concreteWall, quality),
    concreteFloor: pbr(t.concreteFloor, TILE.concreteFloor, quality),
    // Weathered galvanised sheet: mostly diffuse grey, a little metallic sheen.
    corrugated: pbr(t.corrugated, TILE.corrugated, quality, {
      metalness: 0.3,
      envMapIntensity: 0.9,
      color: new THREE.Color(1.7, 1.7, 1.65),
    }),
    paint: pbr(t.paintedMetal, TILE.paintedMetal, quality, { metalness: 0.2 }),
    steel: new THREE.MeshStandardMaterial({
      color: "#ffffff",
      vertexColors: true,
      roughness: 0.55,
      metalness: 0.55,
    }),
    glass: new THREE.MeshStandardMaterial({
      color: "#1c252b",
      vertexColors: false,
      roughness: 0.08,
      metalness: 0.2,
      envMapIntensity: 1.3,
    }),
    glassLit: new THREE.MeshStandardMaterial({
      color: "#1f282c",
      roughness: 0.1,
      metalness: 0.2,
      envMapIntensity: 1.2,
      emissive: new THREE.Color("#ffcf8f"),
      emissiveIntensity: 0,
    }),
    fabric: new THREE.MeshStandardMaterial({
      map: t.concreteFloor.albedo,
      vertexColors: true,
      roughness: 0.95,
      metalness: 0,
      // The borrowed concrete albedo is dark (~0.09); lift it to sandbag/canvas tone.
      color: new THREE.Color(2.2, 2.1, 1.9),
    }),
    hesco: new THREE.MeshStandardMaterial({
      map: t.hesco,
      roughness: 0.9,
      metalness: 0.05,
      vertexColors: true,
    }),
    rubber: new THREE.MeshStandardMaterial({
      color: "#ffffff",
      vertexColors: true,
      roughness: 0.75,
      metalness: 0,
    }),
    lamp: new THREE.MeshStandardMaterial({
      color: "#d9d6cc",
      roughness: 0.3,
      emissive: new THREE.Color("#fff1d0"),
      emissiveIntensity: 0,
    }),
    asphalt: pbr(t.asphalt, TILE.asphalt, quality, {
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
    marking: new THREE.MeshStandardMaterial({
      color: "#e8e4d4",
      vertexColors: true,
      roughness: 0.7,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    }),
    fence: new THREE.MeshStandardMaterial({
      map: t.chainLink,
      color: "#c9cdc8",
      roughness: 0.5,
      metalness: 0.6,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexColors: true,
    }),
    exhaust: new THREE.MeshStandardMaterial({
      color: "#ffffff",
      vertexColors: true,
      roughness: 0.6,
      metalness: 0.4,
    }),
  };
  m.hesco.map!.repeat.set(1 / 1.06, 1 / 1.06);
  m.fence.map!.repeat.set(2, 2);
  m.fabric.map = t.concreteFloor.albedo;
  return m;
}

/** Ground: blended PBR layers in world space. Near detail at two scales (breaks
 * repetition), a macro photo layer for large-scale variation, and splat-mapped
 * laterite tracks, gravel yards and grass from the facility layout. */
export function createGroundMaterial(
  t: WorldTextures,
  quality: Quality,
  terrain: TerrainKind,
  thermal: boolean,
) {
  const rural = terrain === "rural_forward_base";
  // Lambert, not PBR: at roughness ~1 the ground looks the same, and it skips
  // image-based lighting on the half of the screen the ground covers.
  const material: THREE.MeshLambertMaterial | THREE.MeshBasicMaterial = thermal
    ? new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false })
    : new THREE.MeshLambertMaterial({ color: "#ffffff" });
  const uniforms = {
    tNear: { value: t.groundDry.albedo },
    tNearN: { value: t.groundDry.normal ?? t.white },
    tMacro: { value: t.groundMacro },
    tLaterite: { value: t.laterite.albedo },
    tGravel: { value: t.gravel.albedo },
    tGrass: { value: t.grass },
    tAsphalt: { value: t.asphalt.albedo },
    tSplat: { value: t.splat },
    uSplatSize: { value: SPLAT_SIZE },
    uTint: {
      value: new THREE.Color(rural ? "#b49c80" : "#aaa292"),
    },
    uGrassTint: { value: new THREE.Color(rural ? "#9aa56a" : "#8c9466") },
    // Ground normal detail only on High: it covers half the screen.
    uNormal: { value: quality === "high" ? 0.9 : 0 },
    ...thermalUniforms(),
    uThermal: { value: thermal ? 1 : 0 },
  };
  material.userData.groundUniforms = uniforms;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vGroundWorld;",
      )
      .replace(
        "#include <worldpos_vertex>",
        "#include <worldpos_vertex>\nvGroundWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        /* glsl */ `#include <common>
        varying vec3 vGroundWorld;
        uniform sampler2D tNear, tNearN, tMacro, tLaterite, tGravel, tGrass, tAsphalt, tSplat;
        uniform float uSplatSize, uNormal, uThermal;
        uniform vec3 uTint, uGrassTint;
        ${THERMAL_GLSL}
        float gHash(vec2 q) { return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }
        // Smooth value noise in [0, 1].
        float gNoise(vec2 q) {
          vec2 i = floor(q), f = fract(q);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(gHash(i), gHash(i + vec2(1.0, 0.0)), f.x),
                     mix(gHash(i + vec2(0.0, 1.0)), gHash(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        vec3 groundAlbedo(vec2 p, out float wear) {
          float dist = length(vGroundWorld - cameraPosition);
          vec3 near = texture2D(tNear, p / 4.0).rgb;
          // Second scale only where tiling is visible; beyond ~400 m the macro layer dominates.
          if (dist < 420.0) near = mix(near, texture2D(tNear, p / 10.3 + vec2(0.31, 0.77)).rgb, 0.45 * (1.0 - dist / 420.0));
          // Tiled layers would repeat as a lattice from raised cameras. A smooth noise
          // field picks one of several offsets of each tile and blends between
          // neighbours, so nearby tiles differ (explicit gradients avoid mip seams).
          vec2 pr = mat2(0.8, -0.6, 0.6, 0.8) * p;
          // Large-scale variation: the 1130 m tile, offset per noise cell.
          vec2 bUv = p / 1130.0;
          vec2 bDx = dFdx(bUv), bDy = dFdy(bUv);
          float bK = gNoise(p / 650.0) * 3.0 + gNoise(pr / 1700.0) * 2.0;
          float bI = floor(bK);
          float broadA = dot(textureGrad(tMacro, bUv + sin(vec2(3.0, 7.0) * bI), bDx, bDy).rgb, vec3(0.333));
          float broadB = dot(textureGrad(tMacro, bUv + sin(vec2(3.0, 7.0) * (bI + 1.0)), bDx, bDy).rgb, vec3(0.333));
          float broad = mix(broadA, broadB, smoothstep(0.2, 0.8, fract(bK))) / 0.16;
          // Ground detail: the 26 m tile, offset the same way.
          vec2 mUv = p / 26.0;
          vec2 mDx = dFdx(mUv), mDy = dFdy(mUv);
          float mK = gNoise(p / 47.0) * 5.0 + gNoise(pr / 113.0) * 3.0;
          float mI = floor(mK), mF = fract(mK);
          float macroA = dot(textureGrad(tMacro, mUv + sin(vec2(3.0, 7.0) * mI), mDx, mDy).rgb, vec3(0.333));
          float macroB = dot(textureGrad(tMacro, mUv + sin(vec2(3.0, 7.0) * (mI + 1.0)), mDx, mDy).rgb, vec3(0.333));
          float macroL = mix(macroA, macroB, smoothstep(0.2, 0.8, mF)) / 0.16;
          // From far above, keep the tile's contrast low; the broad field carries the variation.
          float macroK = 0.55 * (1.0 - 0.45 * smoothstep(300.0, 2000.0, dist));
          vec3 base = near * mix(vec3(1.0), uTint * 1.25, 0.55);
          base *= mix(1.0, macroL, macroK) * mix(1.0, broad, 0.45);
          vec2 su = p / uSplatSize + 0.5;
          float inside = step(0.0, su.x) * step(su.x, 1.0) * step(0.0, su.y) * step(su.y, 1.0);
          vec4 s = inside > 0.5 ? texture2D(tSplat, vec2(su.x, 1.0 - su.y)) : vec4(0.0);
          // Only sample a layer where the splat map uses it.
          if (s.b > 0.01) base = mix(base, texture2D(tGrass, p / 2.0).rgb * uGrassTint * 1.35, clamp(s.b, 0.0, 1.0) * 0.85);
          if (s.r > 0.01) base = mix(base, texture2D(tLaterite, p / 2.2).rgb, s.r);
          if (s.g > 0.01) {
            vec3 grav = texture2D(tGravel, p / 2.5).rgb;
            grav = mix(vec3(dot(grav, vec3(0.333))), grav, 0.45) * vec3(0.95, 0.95, 1.0);
            base = mix(base, grav, s.g);
          }
          wear = s.a;
          base = mix(vec3(dot(base, vec3(0.299, 0.587, 0.114))), base, 0.72);
          base *= 1.0 - 0.18 * s.a;
          return base;
        }`,
      )
      .replace(
        "#include <map_fragment>",
        /* glsl */ `
        float wearAmount;
        vec3 groundColor = groundAlbedo(vGroundWorld.xz, wearAmount);
        diffuseColor.rgb *= groundColor;
        if (uThermal > 0.5) {
          float lum = dot(groundColor, vec3(0.299, 0.587, 0.114));
          diffuseColor.rgb = thermalRamp(uTemp + (lum - 0.42) * uVariation * 2.2);
        }`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        /* glsl */ `
        {
          float fade = uNormal * (1.0 - smoothstep(60.0, 260.0, length(vGroundWorld - cameraPosition)));
          if (fade > 0.001) {
            vec3 n = texture2D(tNearN, vGroundWorld.xz / 4.0).xyz * 2.0 - 1.0;
            vec3 worldN = normalize(vec3(n.x * fade, 1.0, -n.y * fade));
            normal = normalize((viewMatrix * vec4(worldN, 0.0)).xyz);
          }
        }`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        "float roughnessFactor = 0.96;",
      );
  };
  material.customProgramCacheKey = () =>
    `vyuha-ground-${quality}-${thermal ? "ir" : "eo"}`;
  return material;
}

/** Applies a display mode to the ground shader without recompiling it. */
export function setGroundMode(material: THREE.Material, mode: Mode) {
  const u = material.userData.groundUniforms;
  u.uThermal.value = mode.thermal ? 1 : 0;
  if (mode.thermal)
    setThermalUniforms(u, THERMAL_CLASSES.ground, mode.night, mode.thermal);
}

/** Vegetation cards: alpha-tested atlas, normals tilted up so cards light softly. */
export function createFoliageMaterial(t: WorldTextures) {
  const material = new THREE.MeshStandardMaterial({
    map: t.vegetation,
    alphaTest: 0.42,
    side: THREE.DoubleSide,
    roughness: 0.9,
    metalness: 0,
  });
  // Card normals are tilted up for both faces; do not flip them on back faces
  // (three flips double-sided normals, which turned the back of every card black).
  // A card seen edge-on fades out before the alpha test, so crossed and top
  // cards never show as lines through the canopy.
  material.userData.edgeFade = true;
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <normal_fragment_begin>",
        "#include <normal_fragment_begin>\nnormal = normalize( vNormal );",
      )
      .replace(
        "#include <alphatest_fragment>",
        `${EDGE_FADE_GLSL("vViewPosition")}\n#include <alphatest_fragment>`,
      );
  };
  material.customProgramCacheKey = () => "vyuha-foliage";
  return material;
}

/** Thermal twins for a set of materials, cached and updated in place. */
export class ThermalTwins {
  private twins = new Map<THREE.Material, THREE.MeshBasicMaterial>();
  private sun?: THREE.Vector3;
  /** `sun`: world direction to the day sun, for per-face solar heating. */
  constructor(sun?: THREE.Vector3) {
    this.sun = sun;
  }
  get(source: THREE.Material, cls: ThermalClassName) {
    let twin = this.twins.get(source);
    if (!twin) {
      twin = createThermalMaterial(
        source as THREE.MeshStandardMaterial,
        THERMAL_CLASSES[cls],
        this.sun,
      );
      this.twins.set(source, twin);
    }
    return twin;
  }
  update(mode: Mode) {
    if (!mode.thermal) return;
    for (const twin of this.twins.values()) {
      const { uniforms, cls } = twin.userData.thermal;
      setThermalUniforms(uniforms, cls, mode.night, mode.thermal);
    }
  }
  all() {
    return [...this.twins.values()];
  }
  dispose() {
    this.twins.forEach((m) => m.dispose());
    this.twins.clear();
  }
}
