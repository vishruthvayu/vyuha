import * as THREE from "three";
import type { Quality } from "../quality";
import type { WorldTextures } from "./materials";

type Shader = Parameters<THREE.Material["onBeforeCompile"]>[0];

/** Presentation policy, not an empirical reflectance/sensor calibration. Low and
 * all IR paths retain their frozen shader. No displacement or new texture assets. */
export function surfaceRadiancePolicy(quality: Quality, thermal: boolean) {
  const physical = !thermal && (quality === "medium" || quality === "high");
  return Object.freeze({
    version: "metric-surface-radiance-v1",
    physical,
    normalStrength: physical ? (quality === "high" ? 0.8 : 0.55) : 0,
    normalNear: quality === "high" ? 90 : 60,
    normalFar: quality === "high" ? 320 : 220,
    minimumRoughness: 0.62,
    maximumRoughness: 0.98,
  });
}

export function surfaceRadianceUniforms(t: WorldTextures) {
  return {
    tSurfaceORM: { value: t.groundDry.orm ?? t.white },
    tLateriteN: { value: t.laterite.normal ?? t.white },
    tGravelN: { value: t.gravel.normal ?? t.white },
    uSurfaceMaps: {
      value: new THREE.Vector4(
        t.groundDry.normal ? 1 : 0,
        t.laterite.normal ? 1 : 0,
        t.gravel.normal ? 1 : 0,
        t.groundDry.orm ? 1 : 0,
      ),
    },
    uSurfaceNormalDistance: { value: new THREE.Vector2() },
  };
}

/** Patch the standard lighting model only. Pigment, masks and metric coordinates
 * come from the existing authored ground shader, shared by all sensor views.
 * Reuse its sampled mask; no second splat lookup or extra environment target. */
export function applySurfaceRadiance(shader: Shader) {
  shader.fragmentShader = shader.fragmentShader
    .replace(
      "uniform vec3 uTint, uGrassTint;",
      `uniform vec3 uTint, uGrassTint;
      uniform sampler2D tSurfaceORM, tLateriteN, tGravelN;
      uniform vec4 uSurfaceMaps;
      uniform vec2 uSurfaceNormalDistance;`,
    )
    .replace(
      "vec3 groundAlbedo(vec2 p, out float wear)",
      "vec3 groundAlbedo(vec2 p, out float wear, out vec4 surfaceLayers)",
    )
    .replace(
      "// Only sample a layer where the splat map uses it.",
      "surfaceLayers = s;\n// Only sample a layer where the splat map uses it.",
    )
    .replace("float wearAmount;", "float wearAmount; vec4 surfaceLayers;")
    .replace(
      "groundAlbedo(vGroundWorld.xz, wearAmount)",
      "groundAlbedo(vGroundWorld.xz, wearAmount, surfaceLayers)",
    )
    .replace(
      "#include <roughnessmap_fragment>",
      `
      // ORM maps are linear data. Ground remains a dielectric, never a metal.
      vec3 surfaceORM = uSurfaceMaps.w > 0.5
        ? texture2D(tSurfaceORM, vGroundWorld.xz / 4.0).rgb : vec3(1.0);
      float surfaceRoughness = surfaceORM.g;
      surfaceRoughness = mix(surfaceRoughness, 0.94, clamp(surfaceLayers.b,0.0,1.0)*0.85);
      surfaceRoughness = mix(surfaceRoughness, 0.90, surfaceLayers.r);
      surfaceRoughness = mix(surfaceRoughness, 0.95, surfaceLayers.g);
      float roughnessFactor = clamp(surfaceRoughness, 0.62, 0.98);`,
    )
    .replace(
      "#include <normal_fragment_maps>",
      `
      float surfaceFade = uNormal * (1.0 - smoothstep(uSurfaceNormalDistance.x,
        uSurfaceNormalDistance.y, length(vGroundWorld - cameraPosition)));
      if (surfaceFade > 0.001) {
        vec3 detail = uSurfaceMaps.x > 0.5
          ? texture2D(tNearN, vGroundWorld.xz / 4.0).xyz * 2.0 - 1.0 : vec3(0.0,0.0,1.0);
        detail = mix(detail, vec3(0.0,0.0,1.0), clamp(surfaceLayers.b,0.0,1.0)*0.85);
        if (surfaceLayers.r > 0.01) {
          vec3 layerNormal = uSurfaceMaps.y > 0.5
            ? texture2D(tLateriteN,vGroundWorld.xz/2.2).xyz*2.0-1.0 : vec3(0.0,0.0,1.0);
          detail = mix(detail,layerNormal,surfaceLayers.r);
        }
        if (surfaceLayers.g > 0.01) {
          vec3 layerNormal = uSurfaceMaps.z > 0.5
            ? texture2D(tGravelN,vGroundWorld.xz/2.5).xyz*2.0-1.0 : vec3(0.0,0.0,1.0);
          detail = mix(detail,layerNormal,surfaceLayers.g);
        }
        detail = normalize(vec3(detail.xy * surfaceFade, max(0.1,detail.z)));
        // Tangent axes follow the actual geometric normal: detail cannot flatten
        // far relief or change the authoritative y=0 observation plane.
        vec3 geometric = inverseTransformDirection(normal, viewMatrix);
        vec3 tangent = normalize(vec3(geometric.y,-geometric.x,0.0));
        vec3 bitangent = normalize(cross(tangent,geometric));
        vec3 worldNormal = normalize(tangent*detail.x - bitangent*detail.y + geometric*detail.z);
        normal = normalize((viewMatrix*vec4(worldNormal,0.0)).xyz);
      }`,
    )
    .replace(
      "#include <aomap_fragment>",
      `#include <aomap_fragment>
      // Microcavity affects indirect diffuse only; no painted sun shadow or
      // made-up thermal cue. Overlay layers without AO fade to neutral.
      float surfaceAO = mix(clamp(surfaceORM.r,0.0,1.0),1.0,
        clamp(surfaceLayers.r+surfaceLayers.g+surfaceLayers.b,0.0,1.0));
      reflectedLight.indirectDiffuse *= mix(1.0,surfaceAO,0.45);`,
    );
}
