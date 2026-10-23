import test from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { JSDOM } from "jsdom";
import CurriculumPolicyDiagnostic from "./CurriculumPolicyDiagnostic";
const report = () => ({
  version: "curriculum-policy-diagnostic-v1",
  catalog_hash: "a".repeat(64),
  receipt_sha256: "b".repeat(64),
  trials: 64,
  cases: Array.from({ length: 6 }, (_, n) => ({
    case: `case-${n}`,
    least_assessed_competencies: ["C05"],
    policies: [
      {
        policy: "coverage-director-v1",
        selections: 64,
        least_assessed_selections: n === 5 ? 0 : 64,
        last_two_repeat_selections: 0,
        competency_counts: { C01: 0, C05: 64 },
      },
    ],
  })),
  limitations: [
    "Synthetic fixed histories, not participants or learning gains.",
  ],
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
    await act(async () =>
      root.render(<CurriculumPolicyDiagnostic key={key} />),
    );
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

test("explicit policy comparison shows complete denominators and scoped synthetic claims", () =>
  mounted(async (qa) => {
    assert.equal(qa.requests.length, 0);
    await qa.run();
    await qa.run();
    assert.equal(qa.requests.length, 1);
    assert.equal(
      qa.requests[0].url,
      "/api/v1/evaluations/policy-diagnostics/coverage",
    );
    await qa.release(report());
    assert.equal(qa.document.querySelectorAll("tbody tr").length, 6);
    assert.match(qa.document.body.textContent ?? "", /0\/64/);
    assert.match(qa.document.body.textContent ?? "", /not learning scores/);
    assert.ok(qa.document.querySelector('[role="region"][tabindex="0"]'));
    const axe = await import("axe-core");
    const result = await axe.default.run(
      qa.document.querySelector("section")!,
      { rules: { "color-contrast": { enabled: false } } },
    );
    assert.deepEqual(
      result.violations.map((v) => v.id),
      [],
    );
  }));
test("authorization failure and invalid contract retain retry, stale context ignored", () =>
  mounted(async (qa) => {
    await qa.run();
    await qa.release({ detail: "Officer sign-in required" }, 401);
    assert.match(
      qa.document.querySelector('[role="alert"]')?.textContent ?? "",
      /Officer sign-in/,
    );
    await qa.run();
    await qa.release({ ...report(), version: "wrong" });
    assert.match(
      qa.document.querySelector('[role="alert"]')?.textContent ?? "",
      /Unexpected/,
    );
    await qa.run();
    await qa.render("B");
    await qa.release(report());
    assert.equal(
      qa.document.querySelector('[aria-label="Curriculum policy comparison"]'),
      null,
    );
    await qa.run();
    await qa.release(report());
    assert.ok(
      qa.document.querySelector('[aria-label="Curriculum policy comparison"]'),
    );
  }));
