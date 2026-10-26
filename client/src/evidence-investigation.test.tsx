import test from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { JSDOM } from "jsdom";
import axe from "axe-core";
import EvidenceInvestigation from "./EvidenceInvestigation";

const context = (sessionId = "A") => ({
  sessionId,
  trainee: "T_A",
  reviewHash: "a".repeat(64),
});
const mission = (session = "A", answers: unknown[] = []) => ({
  version: "evidence-investigation-v1",
  mission_id: `inv_${session}`,
  session_id: session,
  trainee: "T_A",
  review_hash: "a".repeat(64),
  questions: [1, 2].map((i) => ({
    id: `q_0${i}`,
    decision_id: `d_${i}`,
    track_id: "T1",
    tick: i * 30,
    order: i,
    concept: "rf_presence",
    prompt: `Report statement ${i}`,
    options: ["supported", "not_established"],
    evidence: {
      tick: i * 30,
      radar: { available: true, state: "normal", detected: true },
      rf: { available: true, signal: true, iff: "no_reply" },
      visual: { available: true, silhouette: "multirotor" },
      range_m: 500,
      night: false,
    },
  })),
  answers,
  note: "Synthetic post-exercise annotation fixture, not scored.",
});
const receipt = (body: Record<string, unknown>) => ({
  question_id: body.question_id,
  choice: body.choice,
  matches_report: true,
  explanation: "Only this report supports the conclusion.",
});

test("officer review uses protected GET only and cannot consume or alter a learner's pending draft", () =>
  mounted(async (q) => {
    await q.click("Open evidence investigation");
    await q.release(0, mission());
    await q.choose(0);
    await q.click("Record answer");
    await act(async () =>
      q.pending[1].reject(new TypeError("Synthetic lost response")),
    );
    const draftBefore = localStorage.getItem(localStorage.key(0)!);
    await q.render("A", true);
    await q.click("Review learner investigation");
    assert.match(q.pending[2].url, /\/instructor\/sessions\/A\/investigation$/);
    assert.equal(q.pending[2].body, null);
    await q.release(2, mission());
    assert.equal(q.document.querySelector("fieldset")!.disabled, true);
    assert.match(
      q.document.body.textContent!,
      /No first answer has been recorded/,
    );
    assert.doesNotMatch(
      q.document.body.textContent!,
      /Record answer|Retry exact answer/,
    );
    assert.equal(localStorage.getItem(localStorage.key(0)!), draftBefore);
    await q.click("Inspect original moment");
    assert.deepEqual(q.inspected, ["d_1"]);
    await q.render("A");
    await q.click("Open evidence investigation");
    await q.release(3, mission());
    await q.click("Retry exact answer");
    assert.deepEqual(q.pending[4].body, q.pending[1].body);
    await q.release(4, mission("A", [receipt(q.pending[4].body!)]));
  }));

test("officer missing-mission and sign-in errors never start an investigation or write a draft", () =>
  mounted(async (q) => {
    await q.render("A", true);
    await q.click("Review learner investigation");
    await q.release(
      0,
      {
        detail: "The learner has not started an investigation for this session",
      },
      404,
    );
    assert.match(q.document.body.textContent!, /learner has not started/);
    await q.click("Reload recorded investigation");
    await q.release(1, { detail: "Officer sign-in required" }, 401);
    assert.match(q.document.body.textContent!, /Officer sign-in required/);
    assert.ok(q.pending.every((request) => request.body === null));
    assert.equal(localStorage.length, 0);
  }));
async function mounted(
  body: (q: {
    document: Document;
    pending: {
      url: string;
      body: Record<string, unknown> | null;
      resolve: (r: Response) => void;
      reject: (e: Error) => void;
    }[];
    render: (s: string, readOnly?: boolean) => Promise<void>;
    click: (text: string) => Promise<void>;
    choose: (i: number) => Promise<void>;
    release: (i: number, value: unknown, status?: number) => Promise<void>;
    inspected: string[];
  }) => Promise<void>,
) {
  const dom = new JSDOM(
    '<!doctype html><html lang="en"><head><title>Investigation QA</title></head><body><main><h1>Review</h1><h2>Ghost</h2><h3>Practice evidence</h3><div id="root"></div></main></body></html>',
    { url: "http://qa.local/", runScripts: "outside-only" },
  );
  const saved = new Map<string, PropertyDescriptor | undefined>();
  const pending: {
    url: string;
    body: Record<string, unknown> | null;
    resolve: (r: Response) => void;
    reject: (e: Error) => void;
  }[] = [];
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    localStorage: dom.window.localStorage,
    sessionStorage: dom.window.sessionStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
    fetch: (url: unknown, init?: RequestInit) =>
      new Promise<Response>((resolve, reject) =>
        pending.push({
          url: String(url),
          body: init?.body ? JSON.parse(String(init.body)) : null,
          resolve,
          reject,
        }),
      ),
  })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      value,
      configurable: true,
      writable: true,
    });
  }
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(dom.window.document.getElementById("root")!);
  const inspected: string[] = [];
  const render = async (s: string, readOnly = false) => {
    await act(async () =>
      root.render(
        <EvidenceInvestigation
          {...context(s)}
          readOnly={readOnly}
          onInspectDecision={(id) => inspected.push(id)}
        />,
      ),
    );
  };
  const click = async (text: string) => {
    await act(async () => {
      const button = [...dom.window.document.querySelectorAll("button")].find(
        (b) => b.textContent === text,
      );
      assert.ok(button, `Missing button ${text}`);
      assert.equal(button.disabled, false);
      button.click();
    });
  };
  const choose = async (i: number) => {
    await act(async () =>
      (
        dom.window.document.querySelectorAll('input[type="radio"]')[
          i
        ] as HTMLInputElement
      ).click(),
    );
  };
  const release = async (i: number, value: unknown, status = 200) => {
    await act(async () => {
      pending[i].resolve(new Response(JSON.stringify(value), { status }));
      await new Promise((r) => setTimeout(r, 0));
    });
  };
  try {
    await render("A");
    await body({
      document: dom.window.document,
      pending,
      render,
      click,
      choose,
      release,
      inspected,
    });
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, value] of saved) {
      if (value) Object.defineProperty(globalThis, key, value);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
}

test("guided investigation uses explicit answers, exact replay links and accessible feedback only after recording", () =>
  mounted(async (q) => {
    assert.equal(q.pending.length, 0);
    await q.click("Open evidence investigation");
    assert.match(q.pending[0].url, /sessions\/A\/investigation\/start/);
    await q.release(0, mission());
    assert.equal(q.document.activeElement?.tagName, "H4");
    assert.equal(q.document.querySelector("input:checked"), null);
    const record = [...q.document.querySelectorAll("button")].find(
      (b) => b.textContent === "Record answer",
    )!;
    assert.equal(record.disabled, true);
    await q.click("Inspect original moment");
    assert.deepEqual(q.inspected, ["d_1"]);
    await q.choose(0);
    await q.click("Record answer");
    assert.equal(q.pending[1].body!.question_id, "q_01");
    assert.equal(q.pending[1].body!.choice, "supported");
    assert.doesNotMatch(q.document.body.textContent!, /Only this report/);
    await q.release(1, mission("A", [receipt(q.pending[1].body!)]));
    assert.match(q.document.body.textContent!, /Only this report supports/);
    assert.equal(q.document.querySelector("fieldset")!.disabled, true);
    await q.click("Next case");
    assert.match(q.document.activeElement!.textContent!, /Case 2 of 2/);
    await q.choose(1);
    await q.click("Record answer");
    await q.release(
      2,
      mission("A", [receipt(q.pending[1].body!), receipt(q.pending[2].body!)]),
    );
    assert.match(
      q.document.body.textContent!,
      /Investigation responses recorded/,
    );
    assert.equal(
      q.document.querySelector("a")!.getAttribute("href"),
      "/academy?competency=C02",
    );
    const view = q.document.defaultView as unknown as {
      eval: (s: string) => void;
      axe: typeof axe;
    };
    view.eval(axe.source);
    const audit = await view.axe.run(q.document, {
      rules: { "color-contrast": { enabled: false } },
    });
    assert.equal(audit.violations.length, 0, JSON.stringify(audit.violations));
  }));

test("lost answer acknowledgment keeps the exact request, locks choice and recovers on server read", () =>
  mounted(async (q) => {
    await q.click("Open evidence investigation");
    await q.release(0, mission());
    await q.choose(1);
    await q.click("Record answer");
    const first = q.pending[1].body;
    await act(async () =>
      q.pending[1].reject(new TypeError("Synthetic network interruption")),
    );
    assert.equal(q.document.querySelector("fieldset")!.disabled, true);
    await q.click("Retry exact answer");
    assert.deepEqual(q.pending[2].body, first);
    await act(async () =>
      q.pending[2].reject(new TypeError("Synthetic lost acknowledgment")),
    );
    await q.click("Recover saved investigation");
    assert.equal(q.pending[3].body, null);
    await q.release(3, mission("A", [receipt(first!)]));
    assert.match(q.document.body.textContent!, /Case 2 of 2/);
    await q.click("Case 1 · recorded");
    assert.match(q.document.body.textContent!, /Only this report/);
    assert.equal(
      JSON.parse(localStorage.getItem(localStorage.key(0)!)!).pending,
      undefined,
    );
  }));

test("pending answers survive review changes without late responses contaminating the new context", () =>
  mounted(async (q) => {
    await q.click("Open evidence investigation");
    await q.release(0, mission());
    await q.click("Case 2");
    await q.choose(1);
    await q.click("Record answer");
    const first = q.pending[1].body!;
    await q.render("B");
    await q.click("Open evidence investigation");
    await q.release(2, mission("B"));
    await q.release(1, mission("A", [receipt(first)]));
    assert.doesNotMatch(q.document.body.textContent!, /Only this report/);
    assert.match(q.document.body.textContent!, /Case 1 of 2/);
    await q.render("A");
    await q.click("Open evidence investigation");
    await q.release(3, mission());
    assert.match(q.document.body.textContent!, /Case 2 of 2/);
    await q.click("Retry exact answer");
    assert.deepEqual(q.pending[4].body, first);
    await q.release(4, mission("A", [receipt(first)]));
  }));

test("mismatched review or mission receipts never clear a pending answer", () =>
  mounted(async (q) => {
    await q.click("Open evidence investigation");
    await q.release(0, { ...mission(), review_hash: "b".repeat(64) });
    assert.match(
      q.document.body.textContent!,
      /does not match this original review/,
    );
    await q.click("Open evidence investigation");
    await q.release(1, mission());
    await q.choose(0);
    await q.click("Record answer");
    const first = q.pending[2].body!;
    await q.release(2, {
      ...mission("A", [receipt(first)]),
      mission_id: "another-mission",
    });
    assert.match(
      q.document.body.textContent!,
      /differs from the frozen mission/,
    );
    assert.equal(q.document.querySelector("fieldset")!.disabled, true);
    await q.click("Retry exact answer");
    assert.deepEqual(q.pending[3].body, first);
    await q.release(3, mission("A", [receipt(first)]));
  }));

test("a first answer accepted from another device wins over a conflicting local pending draft", () =>
  mounted(async (q) => {
    await q.click("Open evidence investigation");
    await q.release(0, mission());
    await q.choose(0);
    await q.click("Record answer");
    const first = q.pending[1].body!;
    await act(async () =>
      q.pending[1].reject(new TypeError("Synthetic dropped response")),
    );
    await q.click("Recover saved investigation");
    await q.release(
      2,
      mission("A", [receipt({ ...first, choice: "not_established" })]),
    );
    assert.match(
      q.document.body.textContent!,
      /server already holds a different first answer/,
    );
    await q.click("Case 1 · recorded");
    assert.equal(
      (q.document.querySelector("input:checked") as HTMLInputElement).value,
      "not_established",
    );
    assert.equal(q.pending.length, 3);
  }));

test("malformed or incomplete server answers retain the retry and never show fabricated completion", () =>
  mounted(async (q) => {
    await q.click("Open evidence investigation");
    await q.release(0, mission());
    await q.choose(0);
    await q.click("Record answer");
    await q.release(1, mission());
    assert.match(q.document.body.textContent!, /acknowledgment is incomplete/);
    assert.doesNotMatch(
      q.document.body.textContent!,
      /Investigation responses recorded/,
    );
    await q.click("Retry exact answer");
    await q.release(
      2,
      mission("A", [
        { ...receipt(q.pending[1].body!), question_id: "foreign-question" },
      ]),
    );
    assert.match(
      q.document.body.textContent!,
      /does not match this original review/,
    );
    assert.equal(q.document.querySelector("fieldset")!.disabled, true);
  }));
