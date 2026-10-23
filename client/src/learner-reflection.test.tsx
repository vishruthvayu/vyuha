import test from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { JSDOM } from "jsdom";
import axe from "axe-core";
import { renderToStaticMarkup } from "react-dom/server";
import LearnerReflection from "./LearnerReflection";
import { GhostPanel } from "./Ghost";
import { makeScenario } from "./scenario";
import { replay, score } from "./sim";
import type { Record as TrainingRecord } from "./types";
const context = (sessionId = "A") => ({
  sessionId,
  trainee: "T_A",
  reviewHash: "a".repeat(64),
});
const envelope = (session = "A", reflections: unknown[] = []) => ({
  session_id: session,
  trainee: "T_A",
  review_hash: "a".repeat(64),
  prompt_version: "reflection-prompts-v1",
  reflections,
  note: "Synthetic annotation fixture",
});
const entry = (payload: Record<string, unknown>, session = "A") => ({
  ...payload,
  id: "note-" + String(payload.request_id),
  session_id: session,
  prompt_version: "reflection-prompts-v1",
  created_at: "2026-10-23T00:00:00Z",
});
async function mounted(
  body: (q: {
    document: Document;
    pending: {
      url: string;
      body: Record<string, unknown> | null;
      resolve: (value: Response) => void;
      reject: (e: Error) => void;
    }[];
    open: () => Promise<void>;
    render: (s: string) => Promise<void>;
    release: (i: number, data: unknown) => Promise<void>;
    edit: (i: number, text: string) => Promise<void>;
    save: () => Promise<void>;
  }) => Promise<void>,
) {
  const dom = new JSDOM(
      '<!doctype html><html lang="en"><head><title>Reflection QA</title></head><body><main><h1>Ghost</h1><h2>Competency evidence</h2><h3>Practice evidence</h3><div id="root"></div></main></body></html>',
      { url: "http://qa.local/", runScripts: "outside-only" },
    ),
    saved = new Map<string, PropertyDescriptor | undefined>();
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
  const render = async (s: string) => {
    await act(async () => root.render(<LearnerReflection {...context(s)} />));
  };
  const open = async () => {
    await act(async () => {
      const details = dom.window.document.querySelector("details")!;
      details.open = true;
      details.dispatchEvent(new dom.window.Event("toggle"));
      await new Promise((r) => setTimeout(r, 5));
    });
  };
  const release = async (i: number, data: unknown) => {
    assert.ok(pending[i]);
    await act(async () => {
      pending[i].resolve(new Response(JSON.stringify(data)));
      await new Promise((r) => setTimeout(r, 0));
    });
  };
  const edit = async (i: number, text: string) => {
    await act(async () => {
      const field = dom.window.document.querySelectorAll("textarea")[i];
      Object.getOwnPropertyDescriptor(
        dom.window.HTMLTextAreaElement.prototype,
        "value",
      )!.set!.call(field, text);
      field.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });
  };
  const save = async () => {
    await act(async () => {
      [...dom.window.document.querySelectorAll("button")]
        .find((b) => b.textContent === "Save reflection")!
        .click();
    });
  };
  try {
    await render("A");
    await body({
      document: dom.window.document,
      pending,
      open,
      render,
      release,
      edit,
      save,
    });
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, d] of saved) {
      if (d) Object.defineProperty(globalThis, key, d);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
}
test("reflection loads only on request and saves a source-bound optional annotation as plain text", () =>
  mounted(async (q) => {
    assert.equal(q.pending.length, 0);
    await q.open();
    assert.match(q.pending[0].url, /sessions\/A\/reflections\?trainee=T_A/);
    await q.release(0, envelope());
    await q.edit(0, "Observed <img src=x onerror=alert(1)> cue");
    await q.edit(2, "Compare another available observation");
    await q.save();
    const payload = q.pending[1].body!;
    assert.equal(payload.trainee, "T_A");
    assert.equal(payload.review_hash, "a".repeat(64));
    assert.equal(payload.remaining_uncertainty, "");
    await q.release(1, envelope("A", [entry(payload)]));
    assert.match(q.document.body.textContent ?? "", /Reflection saved/);
    assert.equal(q.document.querySelector("img"), null);
    assert.equal(q.document.querySelector("textarea")!.value, "");
    assert.equal(localStorage.length, 0);
    const view = q.document.defaultView as unknown as {
      eval: (source: string) => void;
      axe: typeof axe;
    };
    view.eval(axe.source);
    const audit = await view.axe.run(q.document, {
      rules: { "color-contrast": { enabled: false } },
    });
    assert.equal(audit.violations.length, 0, JSON.stringify(audit.violations));
  }));
test("failed network save preserves draft and retries the identical request instead of duplicating it", () =>
  mounted(async (q) => {
    await q.open();
    await q.release(0, envelope());
    await q.edit(0, "Observed cue");
    await q.edit(2, "Review uncertainty");
    await q.save();
    const first = q.pending[1].body;
    await act(async () =>
      q.pending[1].reject(new TypeError("Synthetic network loss")),
    );
    assert.equal(q.document.querySelector("textarea")!.value, "Observed cue");
    assert.equal(localStorage.length, 1);
    await q.save();
    assert.deepEqual(q.pending[2].body, first);
    await q.release(2, envelope("A", [entry(first!)]));
    assert.equal(localStorage.length, 0);
  }));
test("late save cannot contaminate another review and a lost acknowledgment is recovered from saved history", () =>
  mounted(async (q) => {
    await q.open();
    await q.release(0, envelope());
    await q.edit(0, "A cue");
    await q.edit(2, "A next check");
    await q.save();
    const payload = q.pending[1].body!;
    await q.render("B");
    await q.open();
    await q.release(2, envelope("B"));
    await q.edit(0, "B cue");
    await q.release(1, envelope("A", [entry(payload)]));
    assert.equal(q.document.querySelector("textarea")!.value, "B cue");
    assert.doesNotMatch(q.document.body.textContent ?? "", /Reflection saved/);
    await q.render("A");
    await q.open();
    await q.release(3, envelope("A", [entry(payload)]));
    assert.match(q.document.body.textContent ?? "", /Reflection saved/);
    assert.equal(q.document.querySelector("textarea")!.value, "");
    await q.render("B");
    await q.open();
    await q.release(4, envelope("B"));
    assert.equal(q.document.querySelector("textarea")!.value, "B cue");
  }));
test("foreign history and missing save acknowledgment fail closed while retaining the current draft", () =>
  mounted(async (q) => {
    await q.open();
    await q.release(0, envelope("B"));
    assert.match(q.document.body.textContent ?? "", /does not match/);
    await act(async () =>
      [...q.document.querySelectorAll("button")]
        .find((b) => b.textContent === "Reload saved reflections")!
        .click(),
    );
    await q.release(1, envelope());
    await q.edit(0, "Local cue");
    await q.edit(2, "Local next step");
    await q.save();
    await q.release(2, envelope());
    assert.match(q.document.body.textContent ?? "", /did not acknowledge/);
    assert.equal(q.document.querySelector("textarea")!.value, "Local cue");
    assert.equal(localStorage.length, 1);
  }));
test("Ghost exposes reflection only to the joined owner of verified individual learning evidence", () => {
  const scenario = makeScenario(7);
  const r: TrainingRecord = {
    id: "A",
    trainee: "T_A",
    scenario,
    events: [],
    endTick: 0,
    scorecard: score(replay(scenario, [], 0)),
    created_at: "2026-10-23T00:00:00Z",
    verified: true,
    learning: {
      context: {
        version: "learning-v1",
        catalog_hash: "a".repeat(64),
        item_id: "C01_PRACTICE_A",
        mode: "practice",
        assistance: "full",
        seed: 7,
        selection: {
          policy: "direct-item-v1",
          reason: "Synthetic",
          coverage: {},
          recent_items: [],
          candidates: ["C01_PRACTICE_A"],
        },
      },
      evidence: {
        version: "competency-evidence-v1",
        item_id: "C01_PRACTICE_A",
        mode: "practice",
        assessed: false,
        assistance: "full",
        summary: {},
        observations: [],
        original_review_hash: "a".repeat(64),
        limitation: "Practice only",
      },
    },
  };
  const before = JSON.stringify(r);
  for (const viewer of [undefined, "T_OTHER", "T_A"]) {
    const html = renderToStaticMarkup(
      <GhostPanel
        record={r}
        viewerTrainee={viewer}
        selectedId={null}
        onChoose={() => {}}
      />,
    );
    assert.equal(html.includes("Reflect on your decision"), viewer === "T_A");
  }
  assert.equal(JSON.stringify(r), before);
});
