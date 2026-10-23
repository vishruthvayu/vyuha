import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Worker } from "node:worker_threads";
import { generate, generateIncrementally, applyPatch, fbm, type SplatKey } from "./kernel.ts";
import { SplatResources, type WorkerLike } from "./resource.ts";
const repo = "/Users/seemalanaveenyadav/Desktop/SIH/vyuha/work/finale/ultimate-experience/browser-vr-unified";
const procedural = readFileSync(repo + "/client/src/world/procedural-textures.ts", "utf8");
const first = procedural.indexOf("  for (let py = 0;");
const referenceBase = new Function("fbm", "resolution", "scale", "grassy", "image", "const SPLAT_SIZE=1600;" + procedural.slice(first, procedural.indexOf("  g.putImageData(image")) + ";return image.data;");
const second = procedural.indexOf("  for (let py = 0;", first + 1);
const referencePatch = new Function("fbm", "resolution", "scale", "drawn", "const SPLAT_SIZE=1600;" + procedural.slice(second, procedural.indexOf("  g.putImageData(drawn")) + ";return drawn.data;");
const urban: SplatKey = { terrain: "urban_outpost", resolution: 16 }, rural: SplatKey = { terrain: "rural_forward_base", resolution: 16 };
class FakeWorker implements WorkerLike {
  onmessage: WorkerLike["onmessage"] = null;
  onerror: WorkerLike["onerror"] = null;
  onmessageerror: WorkerLike["onmessageerror"] = null;
  request!: SplatKey & { id: number };
  terminated = false;
  postMessage(data: unknown) { this.request = data as typeof this.request; }
  terminate() { this.terminated = true; }
  succeed() { this.onmessage?.({ data: { id: this.request.id, type: "ready", result: generate(this.request) } }); }
}
test("prototype noise code is exactly the current authoritative visual kernel", () => {
  const source = readFileSync(repo + "/client/src/world/terrain.ts", "utf8");
  assert.ok(readFileSync(new URL("./kernel.ts", import.meta.url), "utf8").includes(source.slice(source.indexOf("function hash("), source.indexOf("const smooth ="))));
});
for (const terrain of ["urban_outpost", "rural_forward_base"] as const) for (const resolution of [16, 512, 1024] as const) test(`exact current-source base/patch bytes: ${terrain}/${resolution}`, () => {
  const result = generate({ terrain, resolution });
  const reference = referenceBase(fbm, resolution, resolution / 1600, terrain === "rural_forward_base" ? 0.5 : 0.62, { data: new Uint8ClampedArray(resolution * resolution * 4) });
  assert.deepEqual(result.base, reference);
  //Arbitrary raster bytes model ALL possible surface-composition outputs, not
  //merely untouched base. Canvas2D itself is deliberately NOT moved to worker.
  const drawn = Uint8ClampedArray.from(result.base, (value, index) => (value + index * 19) % 256);
  const expected = referencePatch(fbm, resolution, resolution / 1600, { data: drawn.slice() });
  applyPatch(drawn, result.patch);
  assert.deepEqual(drawn, expected);
});
test("incremental fallback preserves bytes and yields between bounded row chunks", async () => {
  let yields = 0;
  const result = await generateIncrementally(urban, async () => { yields++; });
  assert.deepEqual(result, generate(urban)); assert.equal(yields, 1);
});
test("incremental fallback aborts on a lifecycle change without returning pixels", async () => {
  const signal = new AbortController();
  await assert.rejects(generateIncrementally(urban, async () => { signal.abort(); }, signal.signal), { name: "AbortError" });
});
for (const resolution of [16, 1024] as const) test(`actual module worker transfers the same typed-array bytes/${resolution}`, async () => {
  const key: SplatKey = { ...urban, resolution };
  const worker = new Worker(new URL("./node-worker-adapter.ts", import.meta.url));
  try {
    const response = new Promise<any>((resolve, reject) => { worker.once("message", resolve); worker.once("error", reject); });
    worker.postMessage({ ...key, id: 1 });
    const result = await response;
    assert.equal(result.type, "ready"); assert.equal(result.id, 1);
    assert.deepEqual(result.result.base, generate(key).base);
    assert.deepEqual(result.result.patch, generate(key).patch);
  } finally { await worker.terminate(); }
});
test("one worker, shared promise, isolated terrain cache and suspense retries", async () => {
  const workers: FakeWorker[] = [];
  const resource = new SplatResources(() => { const worker = new FakeWorker(); workers.push(worker); return worker; });
  const a = resource.prepare(urban), b = resource.prepare(rural);
  assert.equal(resource.prepare(urban), a); assert.equal(workers.length, 1);
  let suspended: unknown; try { resource.read(urban); } catch (value) { suspended = value; }
  assert.equal(suspended, a);
  workers[0].succeed(); await a;
  assert.equal(workers[0].terminated, true); assert.equal(workers.length, 2);
  workers[1].succeed(); await b;
  assert.equal(resource.read(urban).terrain, "urban_outpost");
  assert.equal(resource.read(rural).terrain, "rural_forward_base");
  assert.equal(workers[1].terminated, true);
});
test("stale or mismatched worker result cannot populate the current context", async () => {
  const worker = new FakeWorker(), resources = new SplatResources(() => worker, 1000, async () => {});
  const job = resources.prepare(urban);
  worker.onmessage?.({ data: { id: worker.request.id + 1, type: "ready", result: generate(rural) } });
  let ready = false; job.then(() => { ready = true; }); await Promise.resolve(); assert.equal(ready, false);
  worker.onmessage?.({ data: { id: worker.request.id, type: "ready", result: generate(rural) } });
  assert.deepEqual(await job, generate(urban)); assert.equal(worker.terminated, true);
});
for (const mode of ["constructor", "post", "error", "messageerror", "malformed", "timeout"] as const) test(`worker ${mode} uses equivalent bounded fallback`, async () => {
  const worker = new FakeWorker();
  const resources = new SplatResources(() => { if (mode === "constructor") throw new Error("Worker unsupported"); return worker; }, 5, async () => {});
  if (mode === "post") worker.postMessage = () => { throw new Error("Worker posting failed"); };
  const result = resources.prepare(urban);
  if (mode === "error") worker.onerror?.();
  if (mode === "messageerror") worker.onmessageerror?.();
  if (mode === "malformed") worker.onmessage?.({ data: { id: worker.request.id, type: "ready", result: { ...urban, base: new Uint8ClampedArray(1), patch: new Float64Array(1) } } });
  assert.deepEqual(await result, generate(urban));
  if (mode !== "constructor") assert.equal(worker.terminated, true);
});
test("clear rejects active/queued work and old callbacks cannot change new resources", async () => {
  const workers: FakeWorker[] = [];
  const resource = new SplatResources(() => { const worker = new FakeWorker(); workers.push(worker); return worker; });
  const old = resource.prepare(urban), queued = resource.prepare(rural);
  const oldHandler = workers[0].onmessage!;
  const rejections = Promise.all([assert.rejects(old, { name: "AbortError" }), assert.rejects(queued, { name: "AbortError" })]);
  resource.clear(); await rejections;
  const fresh = resource.prepare(rural);
  oldHandler({ data: { id: workers[0].request.id, type: "ready", result: generate(urban) } });
  workers[1].succeed(); assert.equal((await fresh).terrain, "rural_forward_base");
});
test("unbounded input resolution is rejected before worker creation", () => {
  let created = 0; const resource = new SplatResources(() => { created++; return new FakeWorker(); });
  assert.throws(() => resource.prepare({ terrain: "urban_outpost", resolution: 8192 } as unknown as SplatKey), RangeError);
  assert.equal(created, 0);
});

test("queued context snapshots cannot be changed by mutating caller input", async () => {
  const workers: FakeWorker[] = [];
  const resource = new SplatResources(() => { const worker = new FakeWorker(); workers.push(worker); return worker; });
  const a = resource.prepare(urban), mutable = { ...rural }, b = resource.prepare(mutable);
  mutable.terrain = "urban_outpost";
  workers[0].succeed(); await a; workers[1].succeed();
  assert.equal((await b).terrain, "rural_forward_base");
});
