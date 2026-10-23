// TEMPORARY PROTOTYPE: exact unchanged noise functions copied from terrain.ts.
// Production should extract these into one pure module shared with terrain.ts.
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

export type SplatKey = { terrain: "urban_outpost" | "rural_forward_base"; resolution: 16 | 512 | 1024 };
export type SplatData = SplatKey & { base: Uint8ClampedArray; patch: Float64Array };
export function validateKey(key: SplatKey) {
  if (!["urban_outpost", "rural_forward_base"].includes(key.terrain) || ![16, 512, 1024].includes(key.resolution)) throw new RangeError("Unsupported bounded splat workload");
}
export function allocate(key: SplatKey): SplatData {
  validateKey(key);
  return { ...key, base: new Uint8ClampedArray(key.resolution ** 2 * 4), patch: new Float64Array(key.resolution ** 2) };
}
export function fillRows(data: SplatData, start: number, end: number) {
  const { resolution, base, patch } = data;
  const scale = resolution / 1600;
  const grassy = data.terrain === "rural_forward_base" ? 0.5 : 0.62;
  for (let py = start; py < end; py++) for (let px = 0; px < resolution; px++) {
    const x = px / scale - 1600 / 2, z = 1600 / 2 - py / scale;
    const n = fbm(x / 90 + 13, z / 90 + 5, 4);
    const m = fbm(x / 35 - 3, z / 35 + 9, 3);
    const pixel = py * resolution + px, i = pixel * 4;
    base[i + 2] = Math.max(0, Math.min(255, (n - grassy) * 900 + (m - 0.5) * 160));
    base[i + 3] = Math.max(0, Math.min(255, (m - 0.55) * 500));
    patch[pixel] = fbm(x / 16 + 7, z / 16 - 2, 3);
  }
}
export function generate(key: SplatKey): SplatData {
  const data = allocate(key); fillRows(data, 0, key.resolution); return data;
}
export async function generateIncrementally(key: SplatKey, yieldControl: () => Promise<void>, signal?: AbortSignal): Promise<SplatData> {
  if (signal?.aborted) throw new DOMException("Splat preparation cancelled", "AbortError");
  const data = allocate(key);
  for (let row = 0; row < key.resolution; row += 8) {
    if (signal?.aborted) throw new DOMException("Splat preparation cancelled", "AbortError");
    fillRows(data, row, Math.min(row + 8, key.resolution));
    if (row + 8 < key.resolution) await yieldControl();
  }
  return data;
}
// Run this only after the ORIGINAL Canvas2D surface drawing has completed.
// The existing canvas/image pipeline, rounding and premultiplication stay intact.
export function applyPatch(drawn: Uint8ClampedArray, patch: Float64Array) {
  if (drawn.length !== patch.length * 4) throw new RangeError("Splat buffer mismatch");
  for (let pixel = 0; pixel < patch.length; pixel++) {
    const i = pixel * 4;
    drawn[i + 1] *= Math.min(1, Math.max(0.25, patch[pixel] * 1.6 - 0.15));
    drawn[i + 2] *= Math.min(1, Math.max(0, patch[pixel] * 1.9 - 0.45));
  }
}
