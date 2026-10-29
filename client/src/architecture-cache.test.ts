import test from "node:test";
import assert from "node:assert/strict";
import { BoxGeometry } from "three";
import { ArchitectureCache } from "./world/architecture-cache";
const bytes = (g: BoxGeometry) =>
  Object.values(g.attributes).reduce((sum, a) => sum + a.array.byteLength, 0) +
  (g.index?.array.byteLength ?? 0);
test("cached scenery gives independent mutable consumer geometry and disposes retained originals exactly once", () => {
  const raw = new BoxGeometry(),
    cache = new ArchitectureCache(),
    before = raw.getAttribute("position").getX(0);
  let builds = 0,
    disposed = 0;
  raw.addEventListener("dispose", () => disposed++);
  const build = () => {
    builds++;
    return new Map([["plaster" as const, raw]]);
  };
  const a = cache.get("public", build),
    b = cache.get("public", build);
  assert.equal(builds, 1);
  assert.notEqual(a.get("plaster"), b.get("plaster"));
  a.get("plaster")!.getAttribute("position").setX(0, 999);
  a.get("plaster")!.dispose();
  assert.equal(b.get("plaster")!.getAttribute("position").getX(0), before);
  assert.equal(raw.getAttribute("position").getX(0), before);
  assert.equal(disposed, 0);
  b.get("plaster")!.dispose();
  cache.clear();
  cache.clear();
  assert.equal(disposed, 1);
  assert.equal(cache.retainedBytes, 0);
});
test("LRU scenery memory is bounded and evicts an unused key; oversized geometry remains consumer-owned", () => {
  const exemplar = new BoxGeometry(),
    budget = bytes(exemplar) * 2;
  exemplar.dispose();
  const cache = new ArchitectureCache(budget),
    counts: Record<string, number> = {},
    disposed: Record<string, number> = {};
  const get = (key: string) => {
    const result = cache.get(key, () => {
      counts[key] = (counts[key] ?? 0) + 1;
      const g = new BoxGeometry();
      g.addEventListener(
        "dispose",
        () => (disposed[key] = (disposed[key] ?? 0) + 1),
      );
      return new Map([["plaster", g]]);
    });
    for (const g of result.values()) g.dispose();
    assert.ok(cache.retainedBytes <= budget);
  };
  get("a");
  get("b");
  get("a");
  get("c");
  assert.equal(cache.size, 2);
  assert.equal(disposed.b, 1);
  assert.equal(disposed.a, undefined);
  get("b");
  assert.equal(counts.b, 2);
  cache.clear();
  assert.equal(cache.size, 0);
  const tiny = new ArchitectureCache(0),
    raw = new BoxGeometry();
  let released = 0;
  raw.addEventListener("dispose", () => released++);
  const result = tiny.get("oversized", () => new Map([["steel", raw]]));
  assert.equal(result.get("steel"), raw);
  assert.equal(tiny.retainedBytes, 0);
  assert.equal(tiny.size, 0);
  result.get("steel")!.dispose();
  assert.equal(released, 1);
});

test("zero-byte public entries also have a bounded LRU count", () => {
  const cache = new ArchitectureCache(1000);
  for (let i = 0; i < 100; i++) cache.get(String(i), () => new Map());
  assert.equal(cache.size, 32);
  assert.equal(cache.retainedBytes, 0);
  cache.clear();
  assert.equal(cache.size, 0);
});
