import { generateIncrementally, validateKey, type SplatData, type SplatKey } from "./kernel.ts";
export type WorkerLike = { onmessage: ((event: { data: unknown }) => void) | null; onerror: (() => void) | null; onmessageerror: (() => void) | null; postMessage: (message: unknown) => void; terminate: () => void };
type Reply = { type?: string; id?: number; result?: SplatData };
type Entry = { key: SplatKey; promise: Promise<SplatData>; status: "pending" | "ready" | "failed"; value?: SplatData; error?: unknown; resolve: (value: SplatData) => void; reject: (reason: unknown) => void };
// Production keys are a finite four: two terrains x 512/1024. At most30 MiB CPU
// buffers in cache, ONE live worker, no GPU handles, no layout/sensor/truth data.
export class SplatResources {
  private entries = new Map<string, Entry>();
  private queue: Entry[] = [];
  private active: { entry: Entry; cancel: () => void } | null = null;
  private nextId = 0;
  constructor(private makeWorker: () => WorkerLike, private timeoutMs = 15000, private yieldControl = () => new Promise<void>((done) => setTimeout(done, 0))) {}
  prepare(key: SplatKey): Promise<SplatData> {
    validateKey(key);
    key = { terrain: key.terrain, resolution: key.resolution };
    const name = `${key.terrain}:${key.resolution}`;
    const old = this.entries.get(name);
    if (old) return old.promise;
    //16px is test-only and does not expand the production four-key contract.
    if (this.entries.size >= 6) throw new RangeError("Splat cache capacity exceeded");
    let resolve!: Entry["resolve"], reject!: Entry["reject"];
    const promise = new Promise<SplatData>((ok, fail) => { resolve = ok; reject = fail; });
    const entry: Entry = { key, promise, resolve, reject, status: "pending" };
    this.entries.set(name, entry); this.queue.push(entry); this.advance(); return promise;
  }
  read(key: SplatKey): SplatData {
    this.prepare(key);
    const entry = this.entries.get(`${key.terrain}:${key.resolution}`)!;
    if (!entry) throw new Error("Splat cache unavailable");
    if (entry.status === "failed") throw entry.error;
    if (entry.status === "pending") throw entry.promise;
    return entry.value!;
  }
  clear() {
    this.active?.cancel();
    for (const entry of this.queue) entry.reject(new DOMException("Splat cache cleared", "AbortError"));
    this.active = null; this.queue = []; this.entries.clear();
  }
  private advance() {
    if (this.active || !this.queue.length) return;
    const entry = this.queue.shift()!, id = ++this.nextId;
    let worker: WorkerLike | undefined, timer: ReturnType<typeof setTimeout> | undefined, fallingBack = false, settled = false;
    const controller = new AbortController();
    const cleanupWorker = () => {
      if (timer !== undefined) clearTimeout(timer);
      if (worker) { worker.onmessage = null; worker.onerror = null; worker.onmessageerror = null; worker.terminate(); worker = undefined; }
    };
    const settle = (value?: SplatData, error?: unknown) => {
      if (settled) return;
      settled = true; cleanupWorker();
      if (error) { entry.status = "failed"; entry.error = error; entry.reject(error); }
      else { entry.status = "ready"; entry.value = value; entry.resolve(value!); }
      this.active = null; this.advance();
    };
    this.active = { entry, cancel: () => {
      if (settled) return;
      settled = true; controller.abort(); cleanupWorker();
      entry.reject(new DOMException("Splat cache cleared", "AbortError"));
    } };
    const fallback = () => {
      if (settled || fallingBack) return;
      fallingBack = true; cleanupWorker();
      generateIncrementally(entry.key, this.yieldControl, controller.signal).then((data) => settle(data), (error) => settle(undefined, error));
    };
    try {
      worker = this.makeWorker();
      worker.onmessage = ({ data }) => {
        if (settled || fallingBack) return;
        const reply = data as Reply;
        if (!reply || reply.id !== id) return; //stale reply may not affect new context
        const result = reply.result;
        if (reply.type !== "ready" || !result || result.terrain !== entry.key.terrain || result.resolution !== entry.key.resolution || !(result.base instanceof Uint8ClampedArray) || !(result.patch instanceof Float64Array) || result.base.length !== entry.key.resolution ** 2 * 4 || result.patch.length !== entry.key.resolution ** 2) { fallback(); return; }
        settle(result);
      };
      worker.onerror = fallback; worker.onmessageerror = fallback;
      timer = setTimeout(fallback, this.timeoutMs);
      worker.postMessage({ ...entry.key, id });
    } catch { fallback(); }
  }
}
// Bundler emits a local module Worker; no emulator, network service or new dep.
export const createBrowserSplatResources = () => new SplatResources(() => {
  const worker = new Worker(new URL("./splat.worker.ts", import.meta.url), { type: "module" });
  const adapter: WorkerLike = {
    onmessage: null, onerror: null, onmessageerror: null,
    postMessage: (message) => worker.postMessage(message),
    terminate: () => { worker.onmessage = null; worker.onerror = null; worker.onmessageerror = null; worker.terminate(); },
  };
  worker.onmessage = (event) => adapter.onmessage?.({ data: event.data });
  worker.onerror = (event) => { event.preventDefault(); adapter.onerror?.(); };
  worker.onmessageerror = () => adapter.onmessageerror?.();
  return adapter;
});
