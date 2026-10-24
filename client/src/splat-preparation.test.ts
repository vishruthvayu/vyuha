import test from "node:test";
import assert from "node:assert/strict";
import { fbm } from "./world/terrain";
import {
  applySplatPatch,
  prepareSplat,
  type SplatKey,
} from "./world/splat-kernel";
import { SplatResources, yieldSplatTask } from "./world/splat-preparation";
import { createSplatTexture } from "./world/procedural-textures";
import { startDiagnostics, stopDiagnostics } from "./diagnostics";
import type { FacilityLayout } from "./world/layout";

// Independent pre-change loops. In particular, patching must use rasterized
// canvas bytes, NOT the pre-raster base and NOT prematurely rounded factors.
export function referenceBase({ terrain, resolution }: SplatKey) {
  const data = new Uint8ClampedArray(resolution ** 2 * 4);
  const scale = resolution / 1600;
  const grassy = terrain === "rural_forward_base" ? 0.5 : 0.62;
  for (let py = 0; py < resolution; py++)
    for (let px = 0; px < resolution; px++) {
      const x = px / scale - 800,
        z = 800 - py / scale;
      const n = fbm(x / 90 + 13, z / 90 + 5, 4);
      const m = fbm(x / 35 - 3, z / 35 + 9, 3);
      const i = (py * resolution + px) * 4;
      data[i + 2] = Math.max(
        0,
        Math.min(255, (n - grassy) * 900 + (m - 0.5) * 160),
      );
      data[i + 3] = Math.max(0, Math.min(255, (m - 0.55) * 500));
    }
  return data;
}
export function referencePatch(drawn: Uint8ClampedArray, resolution: number) {
  const scale = resolution / 1600;
  for (let py = 0; py < resolution; py++)
    for (let px = 0; px < resolution; px++) {
      const x = px / scale - 800,
        z = 800 - py / scale;
      const i = (py * resolution + px) * 4;
      const patch = fbm(x / 16 + 7, z / 16 - 2, 3);
      drawn[i + 1] *= Math.min(1, Math.max(0.25, patch * 1.6 - 0.15));
      drawn[i + 2] *= Math.min(1, Math.max(0, patch * 1.9 - 0.45));
    }
  return drawn;
}
const urban: SplatKey = { terrain: "urban_outpost", resolution: 512 };
const rural: SplatKey = { terrain: "rural_forward_base", resolution: 512 };
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

for (const terrain of ["urban_outpost", "rural_forward_base"] as const)
  for (const resolution of [512, 1024] as const)
    test(`exact original base and post-raster bytes ${terrain}/${resolution}`, async () => {
      let yields = 0;
      const result = await prepareSplat({ terrain, resolution }, async () => {
        yields++;
      });
      assert.deepEqual(result.base, referenceBase({ terrain, resolution }));
      // Includes every possible byte value at every channel, rather than only
      // the natural base (which has no green channel before surface drawing).
      const raster = Uint8ClampedArray.from(
        result.base,
        (v, i) => (v + i * 19) % 256,
      );
      const expected = referencePatch(raster.slice(), resolution);
      applySplatPatch(raster, result.patch);
      assert.deepEqual(raster, expected);
      assert.equal(yields, resolution / 8);
    });

test("cold/retried Suspense reads share one pending promise and reveal only complete pixels", async () => {
  let resume!: () => void;
  let yields = 0;
  const resources = new SplatResources(async () => {
    if (++yields === 1)
      await new Promise<void>((resolve) => {
        resume = resolve;
      });
  });
  const promise = resources.prepare(urban);
  assert.equal(yields, 1);
  assert.equal(resources.prepare(urban), promise);
  assert.throws(
    () => resources.read(urban),
    (value) => value === promise,
  );
  resume();
  const data = await promise;
  assert.equal(resources.read(urban), data);
  assert.equal(yields, 64);
  assert.equal(data.base.length, 512 ** 2 * 4);
});

test("only one key prepares at once; queued contexts snapshot mutable caller input", async () => {
  let resume!: () => void;
  let yields = 0;
  const resources = new SplatResources(async () => {
    if (++yields === 1)
      await new Promise<void>((resolve) => {
        resume = resolve;
      });
  });
  const first = resources.prepare(urban);
  const mutable = { ...rural };
  const second = resources.prepare(mutable);
  mutable.terrain = "urban_outpost";
  assert.equal(yields, 1);
  resume();
  assert.equal((await first).terrain, "urban_outpost");
  assert.equal((await second).terrain, "rural_forward_base");
  assert.equal(yields, 128);
});

test("clear cancels active/queued work; stale completion cannot replace a reused key", async () => {
  let resume!: () => void;
  let blocked = true;
  const resources = new SplatResources(async () => {
    if (blocked) {
      blocked = false;
      await new Promise<void>((resolve) => {
        resume = resolve;
      });
    }
  });
  const old = resources.prepare(urban);
  const queued = resources.prepare(rural);
  const rejected = Promise.all([
    assert.rejects(old, { name: "AbortError" }),
    assert.rejects(queued, { name: "AbortError" }),
  ]);
  resources.clear();
  const fresh = resources.prepare(urban);
  resume();
  await rejected;
  const data = await fresh;
  assert.equal(resources.read(urban), data);
  assert.notEqual(fresh, old);
});

test("aborting between chunks stops before the next chunk", async () => {
  const controller = new AbortController();
  let yields = 0;
  await assert.rejects(
    prepareSplat(
      urban,
      async () => {
        if (++yields === 2) controller.abort();
      },
      controller.signal,
    ),
    { name: "AbortError" },
  );
  assert.equal(yields, 2);
});

test("a preparation failure is stable and releases the queue", async () => {
  let once = true;
  const resources = new SplatResources(async () => {
    if (once) {
      once = false;
      throw new Error("test scheduler failure");
    }
  });
  const failed = resources.prepare(urban);
  const queued = resources.prepare(rural);
  await assert.rejects(failed, /test scheduler failure/);
  assert.throws(() => resources.read(urban), /test scheduler failure/);
  assert.equal((await queued).terrain, "rural_forward_base");
});

test("invalid workloads fail before scheduling or allocating; production keyspace is four", () => {
  let yields = 0;
  const resources = new SplatResources(async () => {
    yields++;
  });
  for (const key of [
    { ...urban, resolution: 8192 },
    { ...urban, resolution: 16 },
    { ...urban, terrain: "unknown" },
  ])
    assert.throws(() => resources.prepare(key as SplatKey), RangeError);
  assert.equal(yields, 0);
});

test("prepared texture rejects a wrong terrain/resolution/buffer before any canvas allocation", async () => {
  const data = await prepareSplat(urban, async () => {});
  const layout = { terrain: "urban_outpost" } as FacilityLayout;
  assert.throws(
    () => createSplatTexture(layout, 1024, data),
    /context mismatch/,
  );
  assert.throws(
    () =>
      createSplatTexture(
        { terrain: "rural_forward_base" } as FacilityLayout,
        512,
        data,
      ),
    /context mismatch/,
  );
  assert.throws(
    () =>
      createSplatTexture(layout, 512, {
        ...data,
        base: new Uint8ClampedArray(1),
      }),
    /context mismatch/,
  );
  assert.throws(
    () => applySplatPatch(new Uint8ClampedArray(1), data.patch),
    /buffer mismatch/,
  );
});

test("real MessageChannel yields a task and closes its ports", async () => {
  let resolved = false;
  const pending = yieldSplatTask().then(() => {
    resolved = true;
  });
  assert.equal(resolved, false);
  await pending;
  assert.equal(resolved, true);
  // Node exits cleanly after this test: no retained MessagePorts keep it alive.
  await tick();
});

test("diagnostics attribute preparation wall time and every bounded CPU chunk", async () => {
  const capture = startDiagnostics();
  try {
    await prepareSplat(urban, async () => {});
    assert.equal(
      capture.samples.filter((s) => s.kind === "world_texture_preparation")
        .length,
      1,
    );
    const chunks = capture.samples.filter(
      (s) => s.kind === "world_texture_chunk",
    );
    assert.equal(chunks.length, 64);
    const wall = capture.samples.find(
      (s) => s.kind === "world_texture_preparation",
    )!.duration_ms;
    assert.ok(wall >= Math.max(...chunks.map((s) => s.duration_ms)));
  } finally {
    stopDiagnostics();
  }
});

test("missing or blocked MessageChannel falls back to local timer tasks", async () => {
  const original = globalThis.MessageChannel;
  try {
    Object.defineProperty(globalThis, "MessageChannel", {
      configurable: true,
      value: undefined,
    });
    await yieldSplatTask();
    Object.defineProperty(globalThis, "MessageChannel", {
      configurable: true,
      value: class {
        constructor() {
          throw new Error("blocked");
        }
      },
    });
    await yieldSplatTask();
  } finally {
    Object.defineProperty(globalThis, "MessageChannel", {
      configurable: true,
      value: original,
    });
  }
});

test("replacement capture never inherits chunks from an older in-flight preparation", async () => {
  const original = startDiagnostics();
  let resume!: () => void;
  let yields = 0;
  try {
    const pending = prepareSplat(urban, async () => {
      if (++yields === 2)
        await new Promise<void>((resolve) => {
          resume = resolve;
        });
    });
    await tick();
    assert.equal(yields, 2);
    assert.equal(
      original.samples.filter((s) => s.kind === "world_texture_chunk").length,
      1,
    );
    const replacement = startDiagnostics();
    resume();
    await pending;
    assert.equal(
      original.samples.filter((s) => s.kind === "world_texture_chunk").length,
      1,
    );
    assert.equal(
      original.samples.filter((s) => s.kind === "world_texture_preparation")
        .length,
      0,
    );
    assert.equal(
      replacement.samples.filter((s) => s.kind === "world_texture_chunk")
        .length,
      0,
    );
    assert.equal(
      replacement.samples.filter((s) => s.kind === "world_texture_preparation")
        .length,
      0,
    );
  } finally {
    stopDiagnostics();
  }
});
