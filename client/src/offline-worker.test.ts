import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
const script = await readFile(
  new URL("../scripts/offline.mjs", import.meta.url),
  "utf8",
);
const source = script.slice(
  script.indexOf("const workerSource=`") + 20,
  script.indexOf("`;\nnew Script"),
);
function fixture(online: boolean) {
  const installed = "installed coherent old entry";
  const writes: string[] = [];
  let network = 0;
  const handlers = new Map<string, (event: unknown) => void>();
  const response = { marker: "current network entry" };
  const cache = {
    match: async (path: string) =>
      path === "/index.html" ? installed : undefined,
    addAll: async () => {
      writes.push("install");
    },
  };
  runInNewContext(
    source
      .replace("${version}", "test-cache")
      .replace(
        "${JSON.stringify(urls)}",
        '["/","/index.html","/assets/old.js"]',
      ),
    {
      self: {
        addEventListener: (name: string, fn: (event: unknown) => void) =>
          handlers.set(name, fn),
        clients: { claim: async () => {} },
        skipWaiting: async () => {},
      },
      caches: { open: async () => cache, match: async () => undefined },
      location: { origin: "http://unit.local" },
      URL,
      Request: class {
        constructor(
          public value: unknown,
          public options: unknown,
        ) {}
      },
      fetch: async () => {
        network++;
        if (!online) throw new Error("offline");
        return response;
      },
    },
  );
  return {
    request: async (path: string, mode = "navigate", method = "GET") => {
      let reply: Promise<unknown> | undefined;
      handlers.get("fetch")!({
        request: { url: "http://unit.local" + path, mode, method },
        respondWith: (p: Promise<unknown>) => {
          reply = p;
        },
      });
      return reply ? await reply : undefined;
    },
    writes,
    network: () => network,
    installed,
    response,
  };
}
test("online navigation requests current entry without overwriting coherent installed assets", async () => {
  const f = fixture(true);
  assert.deepEqual(await f.request("/crew"), f.response);
  assert.equal(f.network(), 1);
  assert.deepEqual(f.writes, []);
});
test("offline navigation falls back to its own atomically installed entry, including deep links", async () => {
  const f = fixture(false);
  assert.equal(await f.request("/?view=aar"), f.installed);
  assert.equal(await f.request("/instructor"), f.installed);
});
test("API and mutations always bypass service-worker caching", async () => {
  const f = fixture(false);
  assert.equal(await f.request("/api/v1/system/evidence"), undefined);
  assert.equal(await f.request("/crew", "navigate", "POST"), undefined);
  assert.equal(f.network(), 0);
});
