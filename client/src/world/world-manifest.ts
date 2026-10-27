import type { TerrainKind } from "./terrain";

/** Presentation identity, independent from immutable simulation-engine versions.
 * No contact roster, random runtime input, network asset or sensor rule enters it. */
export function worldManifest(terrain: TerrainKind) {
  return Object.freeze({
    schema: "vyuha-presentation-world-v1",
    surfacePipeline: "metric-surface-radiance-v1",
    surfacePolicy:
      "EO Medium/High dielectric; Low/IR frozen compatibility paths",
    id: terrain === "urban_outpost" ? "logistics-quarter" : "forward-base",
    revision: terrain === "urban_outpost" ? 3 : 2,
    landscapePipeline: "bounded-landscape-identity-v1",
    landscapePolicy:
      "Static matte far scenery outside the public optics envelope; not authoritative occlusion",
    source:
      "original procedural architecture; existing locally bundled PBR assets",
    observationGeometry: "scenario terrain_boxes only",
    decorative: true,
    legacyVisuals:
      "presentation may evolve; historical observations and scores do not",
    contactOcclusion: "authoritative depth pass only",
    animation:
      "existing logical-tick radar only; no decorative moving contacts",
  });
}
