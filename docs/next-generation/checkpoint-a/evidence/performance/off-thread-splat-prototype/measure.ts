import { Worker } from "node:worker_threads";
import { generate, applyPatch, generateIncrementally, type SplatKey } from "./kernel.ts";
import { writeFileSync } from "node:fs";
const key: SplatKey = { terrain: "rural_forward_base", resolution: 1024 };
const trials = [];
for (let run = 0; run < 3; run++) {
  const begin = performance.now(), data = generate(key), directMs = performance.now() - begin;
  const drawn = Uint8ClampedArray.from(data.base, (value, index) => (value + index * 19) % 256);
  const patchStart = performance.now(); applyPatch(drawn, data.patch); const patchMs = performance.now() - patchStart;
  const workerStart = performance.now(), worker = new Worker(new URL("./node-worker-adapter.ts", import.meta.url));
  const received = new Promise<any>((resolve, reject) => { worker.once("message", resolve); worker.once("error", reject); });
  worker.postMessage({ ...key, id: 1 }); const response = await received; const workerTotalMs = performance.now() - workerStart;
  await worker.terminate();
  trials.push({ run, direct_kernel_ms: directMs, main_patch_ms: patchMs, fresh_node_worker_total_ms: workerTotalMs, worker_kernel_ms: response.worker_cpu_ms, noise_buffer_bytes: data.base.byteLength + data.patch.byteLength });
}
let yields = 0, maxChunk = 0, checkpoint = performance.now(); const fallbackStart = checkpoint;
await generateIncrementally(key, () => new Promise<void>((done) => { maxChunk = Math.max(maxChunk, performance.now() - checkpoint); yields++; setTimeout(() => { checkpoint = performance.now(); done(); }, 0); }));
maxChunk = Math.max(maxChunk, performance.now() - checkpoint);
const report = { method: "Exploratory Node CPU/worker microbenchmark only; TSX loader startup is included, not browser frame/FPS or XR evidence. Single process, sequential trials; no controlled hardware/thermal experiment.", node: process.version, platform: process.platform, arch: process.arch, resolution: key.resolution, trials, fallback: { wall_ms: performance.now() - fallbackStart, yielded_chunks: yields, max_chunk_wall_ms: maxChunk }, memory: { key_1024_bytes: 1024 ** 2 * 12, key_512_bytes: 512 ** 2 * 12, four_production_key_cache_bytes: 2 * (1024 ** 2 + 512 ** 2) * 12, note: "Retained CPU arrays only; canvas buffers, GPU textures, geometry, Worker runtime and transient allocations excluded." } };
writeFileSync(new URL("./measurements.json", import.meta.url), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
