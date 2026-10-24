import test from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { JSDOM } from "jsdom";
import axe from "axe-core";
import AssessmentGeneration from "./AssessmentGeneration";

const report = (exhausted = false) => ({
  receipt_sha256: "a".repeat(64),
  receipt: {
    version: "c01-generation-receipt-v1",
    item_id: "C01_BASELINE-A_A",
    mode: "assessment",
    study_mode: "not-enrolled",
    requested_seed: 7,
    max_attempts: 2,
    disposition: exhausted ? "generation-exhausted" : "valid-ambiguous",
    attempted_count: 2,
    accepted_count: exhausted ? 0 : 1,
    rejected_count: exhausted ? 2 : 1,
    frozen_inputs: {
      catalog_hash: "b".repeat(64),
      content_version: "learning-v1",
    },
    attempts: [
      {
        attempt: 1,
        requested_seed: 7,
        disposition: "invalid",
        rejection_reasons: ["COMPILER_CONSTRAINT_REJECTED"],
        parameter_assignment: null,
        scenario_sha256: null,
      },
      {
        attempt: 2,
        requested_seed: 2654435776,
        disposition: exhausted ? "invalid" : "valid-ambiguous",
        rejection_reasons: exhausted
          ? ["NO_TIME_VALID_WINDOW_PASSIVE_RUN"]
          : [],
        parameter_assignment: exhausted
          ? null
          : {
              requested_seed: 2654435776,
              compiled_seed: 2654435776,
              duration_seconds: 60,
              terrain: "urban",
              night: false,
              fog: 0.1,
              family: "DIRECT",
              focus: "detection",
              difficulty: "standard",
              compiler_rejected_candidates: 0,
            },
        scenario_sha256: exhausted ? null : "c".repeat(64),
      },
    ],
    limitation:
      "Passive synthetic diagnostic only; human solvability is not established.",
  },
  preview: null,
});

async function mounted(
  body: (qa: {
    document: Document;
    requests: { url: string; init?: RequestInit }[];
    exports: { name: string; blob: Blob }[];
    run: () => Promise<void>;
    release: (value: unknown, status?: number) => Promise<void>;
    render: (key: string) => Promise<void>;
    audit: () => Promise<void>;
  }) => Promise<void>,
) {
  const dom = new JSDOM(
    '<!doctype html><html lang="en"><head><title>Assessment generation</title></head><body><div id="root"></div></body></html>',
    { url: "http://qa.local/evaluation", runScripts: "outside-only" },
  );
  const saved = new Map<string, PropertyDescriptor | undefined>();
  const pending: ((response: Response) => void)[] = [];
  const requests: { url: string; init?: RequestInit }[] = [];
  const exports: { name: string; blob: Blob }[] = [];
  const originalCreate = URL.createObjectURL;
  let exportBlob: Blob;
  URL.createObjectURL = (blob) => {
    exportBlob = blob as Blob;
    return "blob:receipt";
  };
  dom.window.HTMLAnchorElement.prototype.click = function () {
    exports.push({ name: this.download, blob: exportBlob });
  };
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
    await act(async () =>
      root.render(
        <main>
          <AssessmentGeneration key={key} />
        </main>,
      ),
    );
  };
  try {
    await render("A");
    await body({
      document: dom.window.document,
      requests,
      exports,
      render,
      run: async () => {
        await act(async () => {
          const button = dom.window.document.querySelector("button")!;
          button.click();
          button.click();
        });
      },
      release: async (value, status = 200) => {
        assert.ok(pending.length);
        await act(async () => {
          pending.shift()!(new Response(JSON.stringify(value), { status }));
          await new Promise((done) => setTimeout(done, 0));
        });
      },
      audit: async () => {
        dom.window.eval(axe.source);
        const audit = await (
          dom.window as unknown as { axe: typeof axe }
        ).axe.run(dom.window.document, {
          rules: { "color-contrast": { enabled: false } },
        });
        assert.equal(
          audit.violations.length,
          0,
          JSON.stringify(audit.violations),
        );
      },
    });
  } finally {
    await act(async () => root.unmount());
    URL.createObjectURL = originalCreate;
    dom.window.close();
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
}

test("collapsed explicit generation guards double submit, shows exact receipt, exports JSON and passes axe", () =>
  mounted(async (qa) => {
    const details = qa.document.querySelector("details")!;
    assert.equal(details.open, false);
    assert.equal(qa.requests.length, 0);
    details.open = true;
    assert.equal(
      qa.requests.length,
      0,
      "opening the disclosure must not run the diagnostic",
    );
    assert.match(qa.document.body.textContent ?? "", /No training allocation/);
    await qa.run();
    assert.equal(qa.requests.length, 1);
    assert.equal(
      qa.requests[0].url,
      "/api/v1/evaluations/assessment-diagnostics/c01/generation?seed=7&max_attempts=2",
    );
    assert.equal(qa.requests[0].init?.method, "GET");
    assert.equal(qa.requests[0].init?.body, undefined);
    const response = report();
    await qa.release(response);
    const text =
      qa.document.querySelector('[aria-label="Assessment generation result"]')!
        .textContent ?? "";
    assert.match(
      text,
      /Accepted: 1 · Rejected: 1 · Exhausted requests: 0 · Attempted: 2\/2/,
    );
    assert.match(text, /requested seed 2654435776, compiled seed 2654435776/);
    assert.match(text, /DIRECT · detection · standard/);
    assert.match(text, new RegExp("a".repeat(64)));
    await act(async () =>
      Array.from(qa.document.querySelectorAll("button"))
        .find((button) => button.textContent?.includes("Export"))!
        .click(),
    );
    assert.equal(qa.exports[0].name, "VYUHA-assessment-generation-seed7.json");
    assert.deepEqual(JSON.parse(await qa.exports[0].blob.text()), response);
    await qa.audit();
  }));

test("exhaustion shows zero accepted and separate failures without claiming unsolvability", () =>
  mounted(async (qa) => {
    await qa.run();
    await qa.release(report(true));
    const text =
      qa.document.querySelector('[aria-label="Assessment generation result"]')!
        .textContent ?? "";
    assert.match(text, /generation-exhausted/);
    assert.match(text, /Accepted: 0 · Rejected: 2 · Exhausted requests: 1/);
    assert.match(text, /COMPILER_CONSTRAINT_REJECTED/);
    assert.match(text, /NO_TIME_VALID_WINDOW_PASSIVE_RUN/);
    assert.doesNotMatch(
      text,
      /Accepted frozen parameters|Accepted scenario SHA-256/,
    );
    assert.match(text, /human solvability is not established/);
  }));

test("authorization and contract errors remain retryable; remount discards late success and failure", () =>
  mounted(async (qa) => {
    await qa.run();
    await qa.release({ detail: "Officer sign-in required" }, 401);
    assert.match(
      qa.document.querySelector('[role="alert"]')!.textContent ?? "",
      /Officer sign-in required/,
    );
    await qa.run();
    const wrong = report();
    wrong.receipt.requested_seed = 8;
    await qa.release(wrong);
    assert.match(
      qa.document.querySelector('[role="alert"]')!.textContent ?? "",
      /Unexpected assessment generation contract/,
    );
    await qa.run();
    await qa.render("B");
    await qa.release(report());
    assert.equal(
      qa.document.querySelector('[aria-label="Assessment generation result"]'),
      null,
    );
    await qa.run();
    await qa.render("C");
    await qa.release({ detail: "Old context conflict" }, 409);
    assert.equal(qa.document.querySelector('[role="alert"]'), null);
    assert.equal(qa.requests.length, 4, "remounts must not initiate requests");
    await qa.run();
    await qa.release(report());
    assert.ok(
      qa.document.querySelector('[aria-label="Assessment generation result"]'),
    );
  }));
