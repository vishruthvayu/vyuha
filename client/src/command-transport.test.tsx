import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { useCommandTransport } from "./useCommandTransport";
import type { InstructorCommand } from "./types";
async function harness(streamAvailable: boolean) {
  const savedFetch = globalThis.fetch;
  const saved = new Map(
    ["document", "window", "IS_REACT_ACT_ENVIRONMENT"].map((k) => [
      k,
      Object.getOwnPropertyDescriptor(globalThis, k),
    ]),
  );
  const dom = new JSDOM('<div id="root"></div>', { url: "http://unit.local/" });
  Object.defineProperty(globalThis, "document", {
    value: dom.window.document,
    configurable: true,
  });
  Object.defineProperty(globalThis, "window", {
    value: dom.window,
    configurable: true,
  });
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
    value: true,
    configurable: true,
  });
  let heartbeat = 0,
    polls = 0,
    streams = 0,
    aborted = 0,
    id = "A",
    after = 0,
    closed = false;
  const accepted: string[] = [];
  let push: ReadableStreamDefaultController<Uint8Array> | undefined;
  globalThis.fetch = (async (url, init) => {
    if (String(url).includes("command-stream")) {
      streams++;
      if (!streamAvailable) throw new Error("stream unavailable");
      const body = new ReadableStream<Uint8Array>({
        start(c) {
          push = c;
          c.enqueue(
            new TextEncoder().encode(
              'event: update\ndata: {"commands":[]}\n\n',
            ),
          );
          init?.signal?.addEventListener(
            "abort",
            () => {
              aborted++;
              c.error(new DOMException("aborted", "AbortError"));
            },
            { once: true },
          );
        },
      });
      return new Response(body, {
        headers: { "Content-Type": "text/event-stream" },
      });
    }
    polls++;
    return new Response(
      JSON.stringify({
        commands: after ? [] : [{ seq: 1, type: "pause", payload: {} }],
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;
  function Fixture() {
    useCommandTransport({
      enabled: true,
      phase: "running",
      current: () => ({ id, after, active: true }),
      accept: (commands: InstructorCommand[], sid: string) => {
        for (const c of commands) {
          accepted.push(sid);
          after = c.seq;
        }
      },
      heartbeat: async () => {
        heartbeat++;
      },
      unavailable: () => {},
    });
    return <div>Transport fixture</div>;
  }
  const root = createRoot(dom.window.document.getElementById("root")!);
  await act(async () => {
    root.render(<Fixture />);
    await new Promise((r) => setTimeout(r, 25));
  });
  return {
    read: () => ({
      heartbeat,
      polls,
      streams,
      aborted,
      accepted: [...accepted],
    }),
    change: async () => {
      id = "B";
      await act(async () => root.render(<Fixture />));
    },
    push: () =>
      push?.enqueue(
        new TextEncoder().encode(
          'event: update\ndata: {"commands":[{"seq":2,"type":"pause","payload":{}}]}\n\n',
        ),
      ),
    close: async () => {
      if (closed) return;
      closed = true;
      await act(async () => root.unmount());
      await new Promise((r) => setTimeout(r, 25));
      globalThis.fetch = savedFetch;
      for (const [key, descriptor] of saved) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
      dom.window.close();
    },
  };
}
test("quiet SSE still sends independent telemetry heartbeats and cleanup stops all activity", async () => {
  const h = await harness(true);
  try {
    await new Promise((r) => setTimeout(r, 1150));
    const before = h.read();
    assert.ok(before.heartbeat >= 2);
    assert.equal(before.polls, 0);
    assert.equal(before.streams, 1);
    await h.close();
    const end = h.read();
    await new Promise((r) => setTimeout(r, 600));
    assert.equal(h.read().heartbeat, end.heartbeat);
    assert.equal(h.read().aborted, 1);
  } finally {
    await h.close();
  }
});
test("stream failure falls back to ordinary GET receipts while keeping telemetry active", async () => {
  const h = await harness(false);
  try {
    await new Promise((r) => setTimeout(r, 1150));
    const r = h.read();
    assert.ok(r.heartbeat >= 2 && r.polls >= 2);
    assert.deepEqual(r.accepted, ["A"]);
  } finally {
    await h.close();
  }
});
test("late command frame from an old session cannot act on the newly selected session", async () => {
  const h = await harness(true);
  try {
    await h.change();
    h.push();
    await new Promise((r) => setTimeout(r, 25));
    assert.deepEqual(h.read().accepted, []);
  } finally {
    await h.close();
  }
});
