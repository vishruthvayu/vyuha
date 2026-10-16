import * as THREE from "three";

/** Visual terrain. The sensor model treats the ground as a flat plane at y = 0
 * plus the scenario's authoritative boxes, so the visual ground is exactly flat
 * inside FLAT_RADIUS. That radius exceeds the longest optical range (EO 1500 m,
 * IR 1200 m), so relief is always *behind* every contact a camera can draw and
 * can never hide one or suggest occlusion the sensor does not model. */
export const FLAT_RADIUS = 1700;
export const TERRAIN_RADIUS = 14000;
export type TerrainKind = "urban_outpost" | "rural_forward_base";

function hash(x: number, y: number) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** Smooth value noise in [0, 1]; deterministic for repeatable scenery. */
export function valueNoise(x: number, y: number) {
  const xi = Math.floor(x),
    yi = Math.floor(y);
  const xf = x - xi,
    yf = y - yi;
  const u = xf * xf * (3 - 2 * xf),
    v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi),
    b = hash(xi + 1, yi),
    c = hash(xi, yi + 1),
    d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x: number, y: number, octaves = 4) {
  let sum = 0,
    amp = 0.5,
    freq = 1,
    norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x * freq, y * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** Height in metres. Exactly 0 inside FLAT_RADIUS. */
export function terrainHeight(x: number, z: number, kind: TerrainKind) {
  const r = Math.hypot(x, z);
  // Small tolerance: vertices built on the flat-disc rim must be exactly flat.
  if (r <= FLAT_RADIUS + 1e-6) return 0;
  const rise = smooth(FLAT_RADIUS, FLAT_RADIUS + 2600, r);
  const n = fbm(x / 1900 + 11, z / 1900 - 7, 5);
  if (kind === "rural_forward_base") {
    // Rolling plain, then a broken ridge line on the far horizon.
    const ridge =
      smooth(6500, 11000, r) * (0.55 + 0.45 * fbm(x / 3200, z / 3200, 3));
    return rise * (n * 95 + ridge * 420);
  }
  // Urban fringe: low undulation, distant hills only on part of the horizon.
  const sector = smooth(0.35, 0.75, fbm(Math.atan2(x, z) * 1.3 + 4, 0.5, 2));
  return rise * (n * 38 + smooth(8000, 12500, r) * sector * 300);
}

/** Polar terrain mesh: a flat disc plus rings that grow outward in spacing. */
export function createTerrainGeometry(kind: TerrainKind, detail: number) {
  const radial = Math.max(48, Math.round(96 * detail));
  const rings: number[] = [0];
  const flatRings = 4;
  for (let i = 1; i <= flatRings; i++)
    rings.push((FLAT_RADIUS * i) / flatRings);
  let r = FLAT_RADIUS;
  while (r < TERRAIN_RADIUS) {
    r = Math.min(TERRAIN_RADIUS, r + Math.max(90, r * (0.11 / detail)));
    rings.push(r);
  }
  const positions: number[] = [];
  const index: number[] = [];
  positions.push(0, 0, 0);
  for (let ring = 1; ring < rings.length; ring++) {
    for (let s = 0; s < radial; s++) {
      const a = (s / radial) * Math.PI * 2;
      const x = Math.sin(a) * rings[ring],
        z = Math.cos(a) * rings[ring];
      positions.push(x, terrainHeight(x, z, kind), z);
    }
  }
  // Counter-clockwise seen from above, so faces (and normals) point up.
  for (let s = 0; s < radial; s++) index.push(0, 1 + s, 1 + ((s + 1) % radial));
  for (let ring = 1; ring < rings.length - 1; ring++) {
    const a0 = 1 + (ring - 1) * radial,
      b0 = 1 + ring * radial;
    for (let s = 0; s < radial; s++) {
      const s1 = (s + 1) % radial;
      index.push(a0 + s, b0 + s, a0 + s1, a0 + s1, b0 + s, b0 + s1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
