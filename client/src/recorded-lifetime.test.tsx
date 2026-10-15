import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import Recorded from "./Recorded";

function recording(id: string) {
  return {
    id,
    import_hash: "synthetic-example-hash",
    recording: {
      schema_version: 1,
      title: `Recording ${id}`,
      duration_ticks: 300,
      tracks: [
        {
          track_id: `${id}-1`,
          samples: [
            {
              tick: 0,
              x: 10,
              z: 20,
              altitude: 5,
              radar: true,
              thermal: true,
              rf_signal: null,
              iff: "unavailable",
            },
          ],
        },
      ],
    },
  };
}
async function mounted(
  body: (qa: {
    document: Document;
    select: (id: string) => Promise<void>;
    release: (url: string, body: unknown, status?: number) => Promise<void>;
    requests: { url: string; body: unknown }[];
    button: (name: string) => HTMLButtonElement;
    upload: () => Promise<void>;
    advance: (ticks: number) => Promise<void>;
  }) => Promise<void>,
) {
  const dom = new JSDOM('<div id="root"></div>', {
    url: "http://qa.local/recorded",
  });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  const set = (name: string, value: unknown) => {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value,
    });
  };
  for (const [name, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    sessionStorage: dom.window.sessionStorage,
    navigator: dom.window.navigator,
    IS_REACT_ACT_ENVIRONMENT: true,
  }))
    set(name, value);
  let playback: (() => void) | undefined;
  set("setInterval", (callback: () => void) => {
    playback = callback;
    return 1;
  });
  set("clearInterval", () => {
    playback = undefined;
  });
  const waiting = new Map<string, ((response: Response) => void)[]>();
  const requests: { url: string; body: unknown }[] = [];
  set("fetch", async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    requests.push({
      url,
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });
    if (url.endsWith("/recordings") && !init?.body)
      return new Response(
        JSON.stringify({
          recordings: ["A", "B"].map((id) => ({
            id,
            title: `Recording ${id}`,
          })),
        }),
      );
    return new Promise<Response>((resolve) =>
      waiting.set(url, [...(waiting.get(url) ?? []), resolve]),
    );
  });
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(dom.window.document.getElementById("root")!);
  const button = (name: string) =>
    [...dom.window.document.querySelectorAll("button")].find(
      (b) => b.textContent === name,
    )!;
  try {
    await act(async () => root.render(<Recorded />));
    await body({
      document: dom.window.document,
      requests,
      button,
      advance: async (ticks) => {
        for (let i = 0; i < ticks; i++) await act(async () => playback?.());
      },
      upload: async () => {
        const input = dom.window.document.querySelector('input[type="file"]')!;
        Object.defineProperty(input, "files", {
          configurable: true,
          value: [
            {
              size: 64,
              text: async () => JSON.stringify(recording("IMPORT").recording),
            },
          ],
        });
        await act(async () => button("Validate and import JSON").click());
      },
      select: async (id) => {
        const select = [...dom.window.document.querySelectorAll("label")]
          .find((l) => l.firstChild?.textContent === "Recorded exercise")!
          .querySelector("select")!;
        await act(async () => {
          select.value = id;
          select.dispatchEvent(
            new dom.window.Event("change", { bubbles: true }),
          );
        });
      },
      release: async (url, payload, status = 200) => {
        const resolve = waiting.get("/api/v1" + url)?.shift();
        assert.ok(resolve, `Expected pending ${url}`);
        await act(async () => {
          resolve(new Response(JSON.stringify(payload), { status }));
          await new Promise((r) => setTimeout(r, 0));
        });
      },
    });
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
}
for (const status of [200, 422]) {
  test(`Late recording A ${status === 200 ? "load" : "error"} cannot replace recording B`, () =>
    mounted(async (qa) => {
      await qa.select("A");
      await qa.select("B");
      await qa.release("/recordings/B", recording("B"));
      await qa.release(
        "/recordings/A",
        status === 200 ? recording("A") : { detail: "Old A error" },
        status,
      );
      assert.ok(qa.document.querySelector("h2")?.textContent === "Recording B");
      assert.ok(!qa.document.querySelector('[role="alert"]'));
      assert.ok(!qa.requests.some((r) => r.url.includes("/practice")));
    }));
  test(`Late practice A ${status === 200 ? "review" : "error"} cannot appear under recording B`, () =>
    mounted(async (qa) => {
      await qa.select("A");
      await qa.release("/recordings/A", recording("A"));
      await act(async () => qa.button("Save practice review").click());
      const sent = qa.requests.find((r) => r.url.endsWith("/A/practice"))!;
      assert.ok((sent.body as { request_id: string }).request_id);
      await qa.select("B");
      await qa.release("/recordings/B", recording("B"));
      await qa.release(
        "/recordings/A/practice",
        status === 200 ? { old_review: true } : { detail: "Old A error" },
        status,
      );
      assert.equal(qa.document.querySelector("h2")?.textContent, "Recording B");
      assert.ok(!qa.document.querySelector("pre"));
      assert.ok(!qa.document.querySelector('[role="alert"]'));
      assert.equal(
        qa.requests.filter((r) => r.url.endsWith("/practice")).length,
        1,
        "No hidden retry",
      );
    }));
}
test("Blank recording selection clears prior playback, decisions and review immediately", () =>
  mounted(async (qa) => {
    await qa.select("A");
    await qa.release("/recordings/A", recording("A"));
    await act(async () => qa.button("Play recording").click());
    await qa.select("");
    assert.ok(!qa.document.querySelector("h2"));
    assert.ok(!qa.button("Pause playback"));
    assert.ok(!qa.button("Save practice review"));
    assert.ok(!qa.document.querySelector("svg"));
    assert.ok(!qa.requests.some((r) => r.url.includes("/practice")));
  }));
test("Pending save freezes mutable controls and duplicate submit; retry keeps request id", () =>
  mounted(async (qa) => {
    await qa.select("A");
    await qa.release("/recordings/A", recording("A"));
    const save = qa.button("Save practice review");
    await act(async () => {
      save.click();
      save.click();
    });
    let sent = qa.requests.filter((r) => r.url.endsWith("/practice"));
    assert.equal(sent.length, 1, "Pending duplicate submits once");
    for (const label of ["Observed track", "Type", "Identity", "Response"]) {
      const select = [...qa.document.querySelectorAll("label")]
        .find((l) => l.firstChild?.textContent === label)!
        .querySelector("select")!;
      assert.equal(select.disabled, true, `${label} frozen while save pending`);
    }
    assert.equal(qa.button("Designate").disabled, true);
    assert.equal(qa.button("Play recording").disabled, true);
    await qa.release("/recordings/A/practice", { detail: "Retry safely" }, 422);
    await act(async () => qa.button("Save practice review").click());
    sent = qa.requests.filter((r) => r.url.endsWith("/practice"));
    assert.equal(sent.length, 2);
    assert.equal(
      (sent[0].body as { request_id: string }).request_id,
      (sent[1].body as { request_id: string }).request_id,
    );
    await qa.release("/recordings/A/practice", { accepted: true });
    assert.match(qa.document.querySelector("pre")!.textContent!, /accepted/);
    await act(async () => qa.button("Start new practice").click());
    await act(async () => qa.button("Save practice review").click());
    const next = qa.requests.filter((r) => r.url.endsWith("/practice")).at(-1)!;
    assert.notEqual(
      (next.body as { request_id: string }).request_id,
      (sent[0].body as { request_id: string }).request_id,
    );
  }));
for (const status of [200, 422]) {
  test(`Pending import ${status === 200 ? "success" : "error"} cannot replace selected recording B`, () =>
    mounted(async (qa) => {
      await qa.select("A");
      await qa.release("/recordings/A", recording("A"));
      await qa.upload();
      await qa.select("B");
      await qa.release("/recordings/B", recording("B"));
      await qa.release(
        "/recordings",
        status === 200 ? { id: "IMPORT" } : { detail: "Old import error" },
        status,
      );
      assert.equal(qa.document.querySelector("h2")?.textContent, "Recording B");
      assert.ok(!qa.document.querySelector('[role="alert"]'));
      assert.ok(!qa.requests.some((r) => r.url.endsWith("/recordings/IMPORT")));
    }));
}

test("Expired recorded observation disables actions and explains the missing evidence", () =>
  mounted(async (qa) => {
    await qa.select("A");
    await qa.release("/recordings/A", recording("A"));
    const select = [...qa.document.querySelectorAll("label")]
      .find((l) => l.firstChild?.textContent === "Observed track")!
      .querySelector("select")!;
    await act(async () => {
      select.value = "A-1";
      select.dispatchEvent(
        new qa.document.defaultView!.Event("change", { bubbles: true }),
      );
    });
    await act(async () => qa.button("Designate").click());
    await act(async () => qa.button("Record classification").click());
    assert.equal(qa.button("Record response").disabled, false);
    await act(async () => qa.button("Play recording").click());
    await qa.advance(31);
    assert.match(
      qa.document.querySelector('[role="status"]')!.textContent!,
      /No current recorded observation for A-1/,
    );
    for (const name of [
      "Designate",
      "Record classification",
      "Record response",
    ])
      assert.equal(
        qa.button(name).disabled,
        true,
        `${name} requires current observation`,
      );
    assert.match(qa.document.body.textContent!, /2 recorded decisions/);
    assert.ok(!qa.document.querySelector('svg [aria-label="A-1"]'));
  }));
