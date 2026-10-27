import * as THREE from "three";
import type { Quality } from "../quality";
import {
  FLAT_RADIUS,
  TERRAIN_RADIUS,
  terrainHeight,
  fbm,
  type TerrainKind,
} from "./terrain";

/** Original, illustrative far-world composition. No scenario roster, observations,
 * canonical truth, clock or random runtime input enters this presentation layer. */
export type LandscapeIdentity = Readonly<{
  version: "landscape-identity-v1";
  id: "urban-escarpment" | "rural-folded-ridges";
  terrain: TerrainKind;
  opticalClearance: number;
  innerRadius: number;
  outerRadius: number;
  radialSegments: number;
  bands: number;
  reliefBudget: number;
}>;
export const LANDSCAPE_CLEARANCE_M = 120;
const TOPOLOGY = {
  low: { radialSegments: 96, bands: 16 },
  medium: { radialSegments: 160, bands: 24 },
  high: { radialSegments: 240, bands: 32 },
} as const;

/** The polygon's closest point, not just each sampled vertex, must remain
 * beyond the optical envelope. Long-range/offset configurations retain that
 * bound; we never clamp an unsupported envelope into a decorative mountain. */
export function landscapeIdentity(
  terrain: TerrainKind,
  quality: Quality,
  flatRadius = FLAT_RADIUS,
): LandscapeIdentity | null {
  if (!(terrain === "urban_outpost" || terrain === "rural_forward_base"))
    throw new RangeError("Unsupported landscape identity");
  if (
    !Number.isFinite(flatRadius) ||
    flatRadius < FLAT_RADIUS ||
    flatRadius > TERRAIN_RADIUS
  )
    throw new RangeError("Unsupported landscape optical clearance");
  if (quality === "tactical") return null;
  if (!Object.hasOwn(TOPOLOGY, quality))
    throw new RangeError("Unsupported landscape quality");
  const topology = TOPOLOGY[quality];
  const innerRadius = Math.max(
    terrain === "urban_outpost" ? 2400 : 2200,
    (flatRadius + LANDSCAPE_CLEARANCE_M) /
      Math.cos(Math.PI / topology.radialSegments),
  );
  if (TERRAIN_RADIUS - innerRadius < 800) return null;
  return Object.freeze({
    version: "landscape-identity-v1",
    id:
      terrain === "urban_outpost" ? "urban-escarpment" : "rural-folded-ridges",
    terrain,
    opticalClearance: flatRadius,
    innerRadius,
    outerRadius: TERRAIN_RADIUS,
    ...topology,
    reliefBudget: terrain === "urban_outpost" ? 720 : 980,
  });
}
const smooth = (lo: number, hi: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
};
const gaussian = (x: number, centre: number, width: number) =>
  Math.exp(-(((x - centre) / width) ** 2));

/** Added relief only. The near seam and outer edge resolve back into the
 * existing terrain. Broad forms establish place; bounded higher harmonics break
 * the crest without a noisy row of triangular spikes or arbitrary new assets. */
export function landscapeRelief(
  x: number,
  z: number,
  identity: LandscapeIdentity,
) {
  if (![x, z].every(Number.isFinite))
    throw new RangeError("Landscape coordinates must be finite");
  const radius = Math.hypot(x, z);
  if (
    radius <= identity.innerRadius + 1e-6 ||
    radius >= identity.outerRadius - 1e-6
  )
    return 0;
  const u =
    (radius - identity.innerRadius) /
    (identity.outerRadius - identity.innerRadius);
  const a = Math.atan2(x, z);
  const edge = smooth(0, 0.08, u) * (1 - smooth(0.9, 1, u));
  const rangeScale = Math.min(
    1,
    (identity.outerRadius - identity.innerRadius) / 7500,
  );
  let form: number;
  if (identity.terrain === "urban_outpost") {
    const near = gaussian(u, 0.19 + 0.025 * Math.sin(a * 3 + 0.5), 0.095);
    const far = gaussian(u, 0.57 + 0.04 * Math.sin(a * 2 - 1.3), 0.19);
    const escarpment =
      0.22 +
      0.78 * smooth(-0.6, 0.75, Math.sin(a * 2 - 0.3) + 0.28 * Math.sin(a * 5));
    const crown =
      0.8 + 0.12 * Math.sin(a * 7 + u * 11) + 0.08 * Math.sin(a * 13 - u * 8);
    form = (near * 0.62 + far) * escarpment * crown;
  } else {
    const near = gaussian(u, 0.24 + 0.05 * Math.sin(a * 3), 0.14);
    const far = gaussian(u, 0.66 + 0.035 * Math.cos(a * 4), 0.18);
    const folds =
      0.65 +
      0.2 * Math.sin(a * 3 + 0.8) +
      0.1 * Math.sin(a * 7 - 0.2) +
      0.05 * Math.cos(a * 11);
    form = (near * 0.68 + far) * folds;
  }
  const fracture = 0.88 + 0.12 * fbm(x / 380 + 19, z / 380 - 13, 3);
  return (
    identity.reliefBudget *
    Math.min(1, Math.max(0, form)) *
    fracture *
    edge *
    rangeScale
  );
}

/** A single static batch, using existing light/fog and thermal-twin policy.
 * Unlike a sky card it has actual depth and remains correctly behind the
 * complete optically permitted volume. Parent owns disposal and mode switching. */
export function buildLandscapeIdentity(
  terrain: TerrainKind,
  quality: Quality,
  flatRadius = FLAT_RADIUS,
) {
  const identity = landscapeIdentity(terrain, quality, flatRadius);
  if (!identity) return null;
  const { radialSegments, bands, innerRadius, outerRadius } = identity;
  const positions: number[] = [],
    indices: number[] = [];
  const color = new THREE.Color(),
    rock = new THREE.Color(terrain === "urban_outpost" ? "#777b75" : "#777c69");
  const earth = new THREE.Color(
    terrain === "urban_outpost" ? "#626b55" : "#4b6550",
  );
  const colors: number[] = [];
  for (let band = 0; band <= bands; band++) {
    // Concentrate topology in the near folds. The outer horizon needs fewer
    // radial samples; angular spacing is identical in every band for watertightness.
    const u = Math.pow(band / bands, 1.25);
    const radius = innerRadius + u * (outerRadius - innerRadius);
    for (let step = 0; step <= radialSegments; step++) {
      // Duplicate seam uses exactly the same coordinates, not sin(2π) drift.
      const a = ((step % radialSegments) / radialSegments) * Math.PI * 2;
      const x = Math.sin(a) * radius,
        z = Math.cos(a) * radius;
      const relief = landscapeRelief(x, z, identity);
      const y = terrainHeight(x, z, terrain, flatRadius) + relief + 0.12;
      positions.push(x, y, z);
      const bare = smooth(
        0.25,
        0.8,
        relief / Math.max(1, identity.reliefBudget),
      );
      const shade = 0.88 + 0.12 * fbm(x / 210, z / 210, 2);
      color.copy(earth).lerp(rock, bare).multiplyScalar(shade);
      colors.push(color.r, color.g, color.b);
    }
  }
  const stride = radialSegments + 1;
  for (let band = 0; band < bands; band++) {
    const start = band * stride,
      next = start + stride;
    for (let step = 0; step < radialSegments; step++)
      indices.push(
        start + step,
        next + step,
        start + step + 1,
        start + step + 1,
        next + step,
        next + step + 1,
      );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  // Make the duplicated meridian smooth; never average unrelated vertices.
  const normals = geometry.getAttribute("normal");
  const n = new THREE.Vector3(),
    end = new THREE.Vector3();
  for (let band = 0; band <= bands; band++) {
    const first = band * stride,
      last = first + radialSegments;
    n.fromBufferAttribute(normals, first);
    end.fromBufferAttribute(normals, last);
    n.add(end).normalize();
    normals.setXYZ(first, n.x, n.y, n.z);
    normals.setXYZ(last, n.x, n.y, n.z);
  }
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.name = identity.id;
  const material = new THREE.MeshLambertMaterial({
    color: "#ffffff",
    vertexColors: true,
    fog: true,
  });
  material.name = "landscape-identity-matte";
  material.userData.presentationOnly = true;
  return { geometry, material, identity };
}
