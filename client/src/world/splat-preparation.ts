import {
  prepareSplat,
  validateSplatKey,
  type SplatData,
  type SplatKey,
} from "./splat-kernel";

type Entry = {
  key: SplatKey;
  controller: AbortController;
  promise: Promise<SplatData>;
  resolve: (data: SplatData) => void;
  reject: (reason: unknown) => void;
  status: "pending" | "ready" | "failed";
  value?: SplatData;
  error?: unknown;
};

/** Yield a browser task, allowing input/paint between chunks. MessageChannel
 * avoids the nested-timer 4ms clamp; all ports close after each task. No Worker,
 * network, idle-callback dependency or background-only execution is required. */
export function yieldSplatTask(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof MessageChannel === "undefined") {
      setTimeout(resolve, 0);
      return;
    }
    let channel: MessageChannel | undefined;
    try {
      channel = new MessageChannel();
      const ports = channel;
      ports.port1.onmessage = () => {
        ports.port1.close();
        ports.port2.close();
        resolve();
      };
      ports.port2.postMessage(null);
    } catch {
      channel?.port1.close();
      channel?.port2.close();
      setTimeout(resolve, 0);
    }
  });
}

/** CPU-only finite cache: two terrains × two resolutions, at most 30 MiB.
 * One preparation runs at a time; Suspense retries share its stable promise.
 * Final CanvasTextures remain renderer-owned and are never shared here. */
export class SplatResources {
  private entries = new Map<string, Entry>();
  private queue: Entry[] = [];
  private active: Entry | undefined;

  constructor(private yieldControl: () => Promise<void> = yieldSplatTask) {}

  prepare(key: SplatKey): Promise<SplatData> {
    validateSplatKey(key);
    const name = `${key.terrain}:${key.resolution}`;
    const old = this.entries.get(name);
    if (old) return old.promise;
    // Snapshot caller input: queued context may outlive a layout/tier change.
    const snapshot = { terrain: key.terrain, resolution: key.resolution };
    let resolve!: Entry["resolve"], reject!: Entry["reject"];
    const promise = new Promise<SplatData>((ok, fail) => {
      resolve = ok;
      reject = fail;
    });
    // Abandoned Suspense renders need not retain a rejection handler on clear.
    void promise.catch(() => {});
    const entry: Entry = {
      key: snapshot,
      controller: new AbortController(),
      promise,
      resolve,
      reject,
      status: "pending",
    };
    this.entries.set(name, entry);
    this.queue.push(entry);
    this.advance();
    return promise;
  }

  read(key: SplatKey): SplatData {
    this.prepare(key);
    const entry = this.entries.get(`${key.terrain}:${key.resolution}`)!;
    if (entry.status === "failed") throw entry.error;
    if (entry.status === "pending") throw entry.promise;
    return entry.value!;
  }

  /** Explicit module/application teardown only; never clear on React unmount,
   * since a suspended render can be abandoned before any effect commits. */
  clear() {
    for (const entry of this.entries.values()) {
      if (entry.status !== "pending") continue;
      entry.controller.abort();
      entry.reject(new DOMException("Splat cache cleared", "AbortError"));
    }
    this.active = undefined;
    this.queue = [];
    this.entries.clear();
  }

  private advance() {
    if (this.active) return;
    const entry = this.queue.shift();
    if (!entry) return;
    this.active = entry;
    prepareSplat(entry.key, this.yieldControl, entry.controller.signal).then(
      (value) => {
        if (this.active !== entry) return;
        entry.status = "ready";
        entry.value = value;
        entry.resolve(value);
        this.active = undefined;
        this.advance();
      },
      (error: unknown) => {
        if (this.active !== entry) return;
        entry.status = "failed";
        entry.error = error;
        entry.reject(error);
        this.active = undefined;
        this.advance();
      },
    );
  }
}

export const splatResources = new SplatResources();
if (import.meta.hot) import.meta.hot.dispose(() => splatResources.clear());
