import test from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { JSDOM } from "jsdom";
import AssessmentDiagnostics from "./AssessmentDiagnostics";

const report = (seed = 7) => ({
  status: "SATISFIED",
  item_id: "C01_BASELINE-A_A",
  seed,
  version: "observation-obligation-pilot-v1",
  engine_version: "vyuha-0.4.0",
  observed_frames: 7200,
  catalog_hash: "a".repeat(64),
  scenario_sha256: "b".repeat(64),
  projected_observation_sha256: "c".repeat(64),
  first_qualifying_window: { track_id: "T1", start_tick: 60, end_tick: 74 },
  visible_ambiguous_identity_frames: 42,
  stale_channel_samples: 8,
  limitation:
    "Synthetic diagnostic only; not human solvability or learning benefit.",
});

async function mounted(
  body: (qa: {
    document: Document;
    requests: { url: string; init?: RequestInit }[];
    run: () => Promise<void>;
    input: (value: string) => Promise<void>;
    release: (value: unknown, status?: number) => Promise<void>;
    render: (key: string) => Promise<void>;
  }) => Promise<void>,
) {
  const dom = new JSDOM(
    '<!doctype html><html lang="en"><head><title>Diagnostic</title></head><body><div id="root"></div></body></html>',
    { url: "http://qa.local/evaluation" },
  );
  const saved = new Map<string, PropertyDescriptor | undefined>();
  const pending: ((response: Response) => void)[] = [];
  const requests: { url: string; init?: RequestInit }[] = [];
  for (const [name, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    localStorage: dom.window.localStorage,
    sessionStorage: dom.window.sessionStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async (url: unknown, init?: RequestInit) => {
      requests.push({ url: String(url), init });
      return new Promise<Response>((resolve) => pending.push(resolve));
    },
  })) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value,
    });
  }
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(dom.window.document.getElementById("root")!);
  const render = async (key: string) => {
    await act(async () => root.render(<AssessmentDiagnostics key={key} />));
  };
  try {
    await render("A");
    await body({
      document: dom.window.document,
      requests,
      render,
      run: async () => {
        await act(async () =>
          dom.window.document.querySelector("button")!.click(),
        );
      },
      input: async (value: string) => {
        const field = dom.window.document.querySelector("input")!;
        await act(async () => {
          Object.getOwnPropertyDescriptor(
            dom.window.HTMLInputElement.prototype,
            "value",
          )!.set!.call(field, value);
          field.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
        });
      },
      release: async (value: unknown, status = 200) => {
        assert.ok(pending.length);
        await act(async () => {
          pending.shift()!(new Response(JSON.stringify(value), { status }));
          await new Promise((done) => setTimeout(done, 0));
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

test("explicit read-only run renders provenance and narrow limitations", () =>
  mounted(async (qa) => {
    assert.equal(qa.requests.length, 0);
    assert.match(qa.document.body.textContent ?? "", /does not grade/);
    await qa.run();
    await qa.run();
    assert.equal(qa.requests.length, 1, "busy button cannot submit twice");
    assert.equal(
      qa.requests[0].url,
      "/api/v1/evaluations/assessment-diagnostics/c01?seed=7",
    );
    assert.equal(qa.requests[0].init?.method, "GET");
    assert.equal(qa.requests[0].init?.body, undefined);
    await qa.release(report());
    assert.match(
      qa.document.body.textContent ?? "",
      /Proposed opportunity present/,
    );
    assert.match(qa.document.body.textContent ?? "", /ticks 60–74/);
    assert.match(
      qa.document.body.textContent ?? "",
      new RegExp("b".repeat(64)),
    );
    assert.match(qa.document.body.textContent ?? "", /not human solvability/);
  }));

test("invalid seed prevents execution and seed change discards late result", () =>
  mounted(async (qa) => {
    await qa.input("4294967296");
    await qa.run();
    assert.equal(qa.requests.length, 0);
    assert.ok(qa.document.querySelector('[aria-invalid="true"]'));
    await qa.input("7");
    await qa.run();
    await qa.input("8");
    await qa.run();
    await qa.release(report(7));
    assert.equal(
      qa.document.querySelector('[aria-label="Assessment diagnostic result"]'),
      null,
    );
    await qa.release(report(8));
    assert.match(
      qa.document.querySelector('[aria-label="Assessment diagnostic result"]')!
        .textContent ?? "",
      /seed 8/,
    );
  }));

test("context remount discards late success and error without automatic requests", async () => {
  for (const status of [200, 409])
    await mounted(async (qa) => {
      await qa.run();
      await qa.render("B");
      await qa.release(
        status === 200 ? report() : { detail: "Old context conflict" },
        status,
      );
      assert.equal(
        qa.document.querySelector(
          '[aria-label="Assessment diagnostic result"]',
        ),
        null,
      );
      assert.doesNotMatch(
        qa.document.body.textContent ?? "",
        /Old context conflict/,
      );
      assert.equal(qa.requests.length, 1);
    });
});

test("officer authorization failures are visible and can be retried", () =>
  mounted(async (qa) => {
    await qa.run();
    await qa.release({ detail: "Officer sign-in required" }, 401);
    assert.match(
      qa.document.querySelector('[role="alert"]')!.textContent ?? "",
      /Officer sign-in required/,
    );
    await qa.run();
    await qa.release(report());
    assert.equal(qa.document.querySelector('[role="alert"]'), null);
    assert.ok(
      qa.document.querySelector('[aria-label="Assessment diagnostic result"]'),
    );
  }));

test("DOM exposes named region, labeled seed and semantic controls", () =>
  mounted(async (qa) => {
    const field = qa.document.querySelector("input")!;
    assert.ok(field.closest("label")?.textContent?.includes("Diagnostic seed"));
    assert.ok(
      qa.document.querySelector(
        'section[aria-labelledby="assessment-diagnostic-title"]',
      ),
    );
    assert.equal(qa.document.querySelector("button")!.disabled, false);
    assert.equal(qa.document.querySelectorAll("button").length, 1);
  }));
