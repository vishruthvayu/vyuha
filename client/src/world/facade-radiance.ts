import * as THREE from "three";
import type { Quality } from "../quality";
import type { MaterialKey } from "./kit";

/** Original metric surface finish. This is visual art direction, never material
 * temperature or measured sensor evidence. Low, tactical and thermal retain
 * their previous materials. Existing licensed maps and geometry stay intact. */
export function facadeRadiancePolicy(key: MaterialKey, quality: Quality) {
  if (quality !== "medium" && quality !== "high") return null;
  const mineral = key === "plaster" || key === "concrete";
  if (!mineral && key !== "corrugated" && key !== "paint") return null;
  return {
    version: "authored-facade-radiance-v1",
    stain: mineral ? 0.19 : 0.1,
    roughnessMin: mineral ? 0.72 : key === "paint" ? 0.48 : 0.42,
    roughnessMax: mineral ? 0.98 : 0.88,
    macro: mineral ? 0.14 : 0.09,
  } as const;
}

/** Apply after cloning: Three Material.clone deliberately omits onBeforeCompile.
 * One stock Standard lighting program with four uniform finish parameters. No
 * extra texture, target, light, displacement, alpha or depth modification. */
export function applyFacadeRadiance(
  material: THREE.MeshStandardMaterial,
  key: MaterialKey,
  quality: Quality,
) {
  const policy = facadeRadiancePolicy(key, quality);
  if (!policy) return material;
  const finish = new THREE.Vector4(
    policy.stain,
    policy.roughnessMin,
    policy.roughnessMax,
    policy.macro,
  );
  material.onBeforeCompile = (shader) => {
    // Three shader chunks are versioned implementation hooks. A future shader
    // variant must retain its working stock material if the required anchors
    // differ, rather than receive a partial, invalid GLSL patch.
    if (
      !["#include <common>", "#include <project_vertex>"].every((chunk) =>
        shader.vertexShader.includes(chunk),
      ) ||
      ![
        "#include <common>",
        "#include <color_fragment>",
        "#include <roughnessmap_fragment>",
      ].every((chunk) => shader.fragmentShader.includes(chunk))
    ) {
      material.userData.facadeRadianceFallback = "unsupported-shader-chunks";
      return;
    }
    shader.uniforms.uFacadeFinish = { value: finish };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vFacadePosition;",
      )
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
        vec4 facadePosition = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          facadePosition = instanceMatrix * facadePosition;
        #endif
        vFacadePosition = (modelMatrix * facadePosition).xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vFacadePosition;
        uniform vec4 uFacadeFinish;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        // Broad mineral/paint variation breaks repeated scan tiles. Runoff is
        // metric and softens as a pixel covers a larger patch of the surface.
        float facadeMacro = 0.5 + 0.5 * sin(vFacadePosition.x * 0.17
          + sin(vFacadePosition.z * 0.11)) * sin(vFacadePosition.z * 0.13
          + vFacadePosition.y * 0.09);
        float facadeFade = 1.0 - smoothstep(0.35, 1.3, length(fwidth(vFacadePosition)));
        float facadeRunoff = 0.5 + 0.5 * sin((vFacadePosition.x + vFacadePosition.z) * 1.25
          + sin((vFacadePosition.x - vFacadePosition.z) * 0.19) * 2.0);
        facadeRunoff *= facadeRunoff;
        facadeRunoff *= facadeRunoff;
        float facadeWeather = uFacadeFinish.x * ((1.0 - smoothstep(0.2, 3.5,
          vFacadePosition.y)) + facadeRunoff * 0.4 * facadeFade);
        diffuseColor.rgb *= (1.0 + (facadeMacro - 0.5) * uFacadeFinish.w)
          * (1.0 - facadeWeather);`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + facadeMacro * 0.08
          + facadeWeather * 0.14, uFacadeFinish.y, uFacadeFinish.z);`,
      );
  };
  material.customProgramCacheKey = () => "vyuha-authored-facade-radiance-v1";
  material.userData.facadeRadiance = { ...policy };
  return material;
}
