import { currentCapture, diagnosticSpan } from "../diagnostics";
import { fbm, type TerrainKind } from "./terrain";

export type SplatKey = { terrain: TerrainKind; resolution: 512 | 1024 };
export type SplatData = SplatKey & {
  base: Uint8ClampedArray;
  patch: Float64Array;
};
export const SPLAT_SIZE = 1600;

export function validateSplatKey(key: SplatKey) {
  if (
    !["urban_outpost", "rural_forward_base"].includes(key.terrain) ||
    ![512, 1024].includes(key.resolution)
  )
    throw new RangeError("Unsupported bounded splat workload");
}

/** Every sample and Uint8ClampedArray rounding matches the synchronous map.
 * Patch values stay Float64 until applied AFTER Canvas2D surface composition. */
export function fillSplatRows(data: SplatData, start: number, end: number) {
  const { resolution, base, patch } = data;
  const scale = resolution / SPLAT_SIZE;
  const grassy = data.terrain === "rural_forward_base" ? 0.5 : 0.62;
  for (let py = start; py < end; py++)
    for (let px = 0; px < resolution; px++) {
      const x = px / scale - SPLAT_SIZE / 2,
        z = SPLAT_SIZE / 2 - py / scale;
      const n = fbm(x / 90 + 13, z / 90 + 5, 4);
      const m = fbm(x / 35 - 3, z / 35 + 9, 3);
      const pixel = py * resolution + px,
        i = pixel * 4;
      base[i + 2] = Math.max(
        0,
        Math.min(255, (n - grassy) * 900 + (m - 0.5) * 160),
      );
      base[i + 3] = Math.max(0, Math.min(255, (m - 0.55) * 500));
      patch[pixel] = fbm(x / 16 + 7, z / 16 - 2, 3);
    }
}

export async function prepareSplat(
  key: SplatKey,
  yieldControl: () => Promise<void>,
  signal?: AbortSignal,
): Promise<SplatData> {
  validateSplatKey(key);
  const cancelled = () => {
    if (signal?.aborted)
      throw new DOMException("Splat preparation cancelled", "AbortError");
  };
  cancelled();
  // This span includes task scheduling/yields; chunk samples measure CPU only.
  // Capture ownership is fixed when this queued job actually starts. A later
  // capture must never inherit chunks from an already-running preparation.
  const owner = currentCapture();
  const finish = diagnosticSpan("world_texture_preparation");
  try {
    const data: SplatData = {
      ...key,
      base: new Uint8ClampedArray(key.resolution ** 2 * 4),
      patch: new Float64Array(key.resolution ** 2),
    };
    // Yield before the first chunk, too: even a cold Suspense read returns quickly.
    for (let row = 0; row < key.resolution; row += 8) {
      await yieldControl();
      cancelled();
      const finishChunk =
        owner && currentCapture() === owner
          ? diagnosticSpan("world_texture_chunk")
          : () => {};
      try {
        fillSplatRows(data, row, Math.min(row + 8, key.resolution));
      } finally {
        finishChunk();
      }
    }
    return data;
  } finally {
    finish();
  }
}

export function applySplatPatch(drawn: Uint8ClampedArray, patch: Float64Array) {
  if (drawn.length !== patch.length * 4)
    throw new RangeError("Splat buffer mismatch");
  for (let pixel = 0; pixel < patch.length; pixel++) {
    const i = pixel * 4;
    drawn[i + 1] *= Math.min(1, Math.max(0.25, patch[pixel] * 1.6 - 0.15));
    drawn[i + 2] *= Math.min(1, Math.max(0, patch[pixel] * 1.9 - 0.45));
  }
}
