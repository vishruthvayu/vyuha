import test from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { JSDOM } from "jsdom";
import axe from "axe-core";
import TrainingBridge from "./TrainingBridge";
import { LearningEvidence } from "./LearningEvidence";
import { renderToStaticMarkup } from "react-dom/server";
import {
  nextTrainingBridgeSeed,
  preferredTrainingBridgeItem,
  trainingBridgeCandidates,
  trainingBridgePaths,
} from "./training-bridge";
import type {
  LearningCatalogue,
  LearningPreparation,
  LearningReview,
} from "./learning";

const review: LearningReview = {
  context: {
    version: "learning-v1",
    catalog_hash: "a".repeat(64),
    item_id: "C02_PRACTICE_A",
    mode: "practice",
    assistance: "full",
    seed: 7,
    selection: {
      policy: "direct-item-v1",
      reason: "Frozen explicit practice",
      coverage: {},
      recent_items: [],
      candidates: ["C02_PRACTICE_A"],
    },
  },
  evidence: {
    version: "competency-evidence-v1",
    item_id: "C02_PRACTICE_A",
    mode: "practice",
    assessed: false,
    assistance: "full",
    summary: {
      C01: { correct: 1, incorrect: 0, unassessable: 0 },
      C02: { correct: 1, incorrect: 1, unassessable: 0 },
      C03: { correct: 0, incorrect: 0, unassessable: 1 },
    },
    observations: [
      {
        competency_id: "C01",
        decision_id: "D_DETECT",
        tick: 30,
        verdict: "correct",
        reason: "DETECTION_ON_TIME",
      },
      {
        competency_id: "C02",
        decision_id: "D_CLASS",
        tick: 60,
        verdict: "incorrect",
        reason: "IDENTITY_NOT_ESTABLISHED",
      },
      {
        competency_id: "C02",
        decision_id: "D_CLASS_2",
        tick: 90,
        verdict: "correct",
        reason: "SUPPORTED_CLASSIFICATION",
      },
      {
        competency_id: "C03",
        decision_id: "D_HOLD",
        tick: 120,
        verdict: "unassessable",
        reason: "INSUFFICIENT_OBSERVABLE_EVIDENCE",
      },
    ],
    original_review_hash: "b".repeat(64),
    limitation: "Scenario-bound only.",
  },
};
const item = (
  id: string,
  competency_id: string,
  assistance = "full",
  pool: "practice" | "assessment" = "practice",
) => ({
  id,
  title: id.replaceAll("_", " "),
  competency_id,
  assistance,
  pool,
  form: pool === "practice" ? null : "baseline-a",
  audience: "individual",
  objective: `Practise ${competency_id} using modeled reports.`,
  instructions: ["Compare reported evidence before deciding."],
  reflection: "What remained uncertain?",
});
const catalogue: LearningCatalogue = {
  version: "learning-v1",
  catalog_hash: "a".repeat(64),
  competencies: ["C01", "C02", "C03"].map((id) => ({
    id,
    scope: "individual",
    title: id,
    claim: "Illustrative",
    limitation: "No mastery claim",
  })),
  items: [
    item("C02_PRACTICE_A", "C02"),
    item("C02_PRACTICE_B", "C02"),
    item("C02_PRACTICE_C", "C02", "faded"),
    item("C01_PRACTICE_B", "C01"),
    item("C03_PRACTICE_B", "C03"),
    item("C02_ASSESSMENT", "C02", "none", "assessment"),
  ],
  limitation: "Illustrative",
};
function prepared(body: {
  request_id: string;
  item_id: string;
  seed: number;
}): LearningPreparation {
  const selected = catalogue.items.find((i) => i.id === body.item_id)!;
  return {
    preparation_id: body.request_id,
    scenario: { title: selected.title } as LearningPreparation["scenario"],
    context: {
      ...review.context,
      item_id: body.item_id,
      seed: body.seed,
      assistance: selected.assistance as "full" | "faded",
      selection: { ...review.context.selection, candidates: [selected.id] },
    },
  };
}
test("source paths separate uncertainty from error, preserve server votes and every original input", () => {
  const original = structuredClone(review),
    paths = trainingBridgePaths(review);
  assert.deepEqual(
    paths.map((p) => [p.competencyId, p.priority]),
    [
      ["C02", "reconsider"],
      ["C03", "seek_evidence"],
      ["C01", "extend"],
    ],
  );
  assert.equal(paths[0].cases.length, 2);
  assert.deepEqual(paths[0].counts, review.evidence!.summary.C02);
  assert.match(
    paths[1].explanation,
    /not an incorrect answer or learner deficit/,
  );
  const duplicate = structuredClone(review);
  duplicate.evidence!.observations.push({
    ...duplicate.evidence!.observations[1],
  });
  assert.equal(trainingBridgePaths(duplicate)[0].cases.length, 2);
  duplicate.evidence!.observations.at(-1)!.tick = 999;
  assert.throws(() => trainingBridgePaths(duplicate), /Conflicting/);
  assert.deepEqual(review, original);
});
test("malformed, mismatched, future contract and absent decision evidence never invent a path", () => {
  for (const mutate of [
    (r: LearningReview) => {
      r.evidence!.mode = "assessment";
    },
    (r: LearningReview) => {
      r.evidence!.version = "future-v2";
    },
    (r: LearningReview) => {
      r.evidence!.observations[0].tick = NaN;
    },
    (r: LearningReview) => {
      r.evidence!.observations[0].verdict = "mastered";
    },
    (r: LearningReview) => {
      r.evidence!.summary.C01.correct = -1;
    },
    (r: LearningReview) => {
      r.evidence!.original_review_hash = "wrong";
    },
  ]) {
    const candidate = structuredClone(review);
    mutate(candidate);
    assert.throws(() => trainingBridgePaths(candidate));
  }
  assert.deepEqual(trainingBridgePaths({ ...review, evidence: null }), []);
  assert.deepEqual(
    trainingBridgePaths({
      ...review,
      evidence: { ...review.evidence!, observations: [] },
    }),
    [],
  );
});
test("practice selection excludes assessment and crew, prefers a different item, and never promises transfer", () => {
  const candidate = structuredClone(catalogue);
  candidate.items.push({ ...item("CREW_PRACTICE", "C02"), audience: "crew" });
  const practice = trainingBridgeCandidates(candidate, "C02");
  assert.deepEqual(
    practice.map((i) => i.id),
    ["C02_PRACTICE_A", "C02_PRACTICE_B", "C02_PRACTICE_C"],
  );
  assert.equal(
    preferredTrainingBridgeItem(practice, "C02_PRACTICE_A", "reconsider")!.id,
    "C02_PRACTICE_B",
  );
  assert.equal(
    preferredTrainingBridgeItem(practice, "C02_PRACTICE_A", "extend")!.id,
    "C02_PRACTICE_C",
  );
  candidate.items.push(candidate.items[0]);
  assert.throws(() => trainingBridgeCandidates(candidate, "C02"));
  assert.equal(nextTrainingBridgeSeed(0xffffffff), 0);
  assert.throws(() => nextTrainingBridgeSeed(-1));
});
type Body = {
  request_id: string;
  item_id: string;
  seed: number;
  trainee: string;
  mode: string;
};
type Fetcher = (path: string, body?: Body) => Promise<unknown>;
async function mounted(
  fetcher: Fetcher,
  run: (q: {
    document: Document;
    inspect: string[];
    click: (name: string) => Promise<void>;
    render: (r?: LearningReview, owner?: boolean) => Promise<void>;
  }) => Promise<void>,
) {
  const dom = new JSDOM(
    '<!doctype html><html lang="en"><head><title>Rehearsal</title></head><body><main><h1>Review</h1><div id="root"></div></main></body></html>',
    { url: "http://qa.local", runScripts: "outside-only" },
  );
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    sessionStorage: dom.window.sessionStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      value,
      configurable: true,
      writable: true,
    });
  }
  const oldFetch = globalThis.fetch;
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => ({
    ok: true,
    json: async () =>
      fetcher(
        String(input),
        init?.body ? JSON.parse(String(init.body)) : undefined,
      ),
  })) as typeof fetch;
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(dom.window.document.getElementById("root")!);
  const inspect: string[] = [];
  const render = async (r = review, owner = true) => {
    await act(async () =>
      root.render(
        <>
          <h2>Ghost</h2>
          <h3>Academy evidence</h3>
          <TrainingBridge
            review={r}
            learner={
              owner
                ? { sessionId: "SOURCE_SESSION", trainee: "REAL_OWNER" }
                : undefined
            }
            onInspectDecision={(id) => inspect.push(id)}
          />
        </>,
      ),
    );
  };
  const click = async (name: string) => {
    const button = [...dom.window.document.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === name,
    );
    assert.ok(button, name);
    await act(async () => {
      button.click();
    });
  };
  try {
    await render();
    await run({ document: dom.window.document, inspect, click, render });
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = oldFetch;
    dom.window.close();
    for (const [key, value] of saved) {
      if (value) Object.defineProperty(globalThis, key, value);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
}
test("source inspection and explicit server preparation complete a real owner-scoped practice launch without changing original review", async () => {
  const sent: { path: string; body?: Body }[] = [];
  const original = structuredClone(review);
  await mounted(
    async (path, body) => {
      sent.push({ path, body });
      return path.endsWith("/catalogue") ? catalogue : prepared(body!);
    },
    async (q) => {
      assert.equal(sent.length, 0);
      assert.equal(q.document.querySelectorAll("a").length, 0);
      await q.click("Inspect original D_CLASS");
      assert.deepEqual(q.inspect, ["D_CLASS"]);
      await q.click("Find current practice episodes");
      assert.equal(q.document.querySelector("select")?.value, "C02_PRACTICE_B");
      await q.click("Prepare selected rehearsal");
      const body = sent[1].body!;
      assert.equal(body.trainee, "REAL_OWNER");
      assert.equal(body.mode, "practice");
      assert.equal(body.seed, 8);
      assert.equal(body.item_id, "C02_PRACTICE_B");
      assert.match(
        q.document.querySelector("a")!.getAttribute("href")!,
        new RegExp(encodeURIComponent(body.request_id)),
      );
      assert.match(
        q.document.body.textContent!,
        /not a held-out assessment or demonstrated transfer/,
      );
      assert.deepEqual(review, original);
    },
  );
});
test("officer view remains read-only and the structural learner interface passes axe", async () => {
  let calls = 0;
  await mounted(
    async () => {
      calls++;
      return catalogue;
    },
    async (q) => {
      const view = q.document.defaultView as unknown as {
        eval: (s: string) => void;
        axe: typeof axe;
      };
      view.eval(axe.source);
      for (const owner of [true, false]) {
        await q.render(review, owner);
        const result = await view.axe.run(q.document, {
          rules: { "color-contrast": { enabled: false } },
        });
        assert.equal(
          result.violations.length,
          0,
          JSON.stringify(result.violations),
        );
      }
      assert.match(q.document.body.textContent!, /Officer review is read-only/);
      assert.equal(q.document.querySelector("select"), null);
      assert.equal(calls, 0);
    },
  );
});
test("late preparation and catalog responses cannot become a launch in another review", async () => {
  let resolve!: (value: unknown) => void;
  let body: Body | undefined;
  await mounted(
    async (path, input) =>
      path.endsWith("/catalogue")
        ? catalogue
        : new Promise((r) => {
            resolve = r;
            body = input;
          }),
    async (q) => {
      await q.click("Find current practice episodes");
      await q.click("Prepare selected rehearsal");
      const another = structuredClone(review);
      another.evidence!.original_review_hash = "c".repeat(64);
      await q.render(another);
      await act(async () => {
        resolve(prepared(body!));
      });
      assert.equal(q.document.querySelector("a"), null);
      assert.match(
        q.document.body.textContent!,
        /Find current practice episodes/,
      );
    },
  );
});
test("network retries reuse one immutable preparation ID and reject mismatched seed/catalog receipts", async () => {
  const ids: string[] = [];
  await mounted(
    async (path, body) => {
      if (path.endsWith("/catalogue")) return catalogue;
      ids.push(body!.request_id);
      if (ids.length === 1) throw new Error("Network unavailable");
      const result = prepared(body!);
      if (ids.length === 2) result.context.seed = 999;
      return result;
    },
    async (q) => {
      await q.click("Find current practice episodes");
      await q.click("Prepare selected rehearsal");
      assert.match(q.document.body.textContent!, /Network unavailable/);
      await q.click("Prepare selected rehearsal");
      assert.equal(q.document.querySelector("a"), null);
      assert.match(q.document.body.textContent!, /Preparation differs/);
      await q.click("Prepare selected rehearsal");
      assert.equal(new Set(ids).size, 1);
      assert.ok(q.document.querySelector("a"));
    },
  );
});

test("duplicate clicks and a path change during preparation do not publish or dispatch the wrong episode", async () => {
  let resolve!: (v: unknown) => void;
  const sent: Body[] = [];
  await mounted(
    async (path, body) => {
      if (path.endsWith("/catalogue")) return catalogue;
      sent.push(body!);
      return new Promise((done) => {
        resolve = done;
      });
    },
    async (q) => {
      await q.click("Find current practice episodes");
      await q.click("Prepare selected rehearsal");
      await q.click("Prepare selected rehearsal");
      assert.equal(sent.length, 1);
      const target = [...q.document.querySelectorAll("nav button")].find((b) =>
        b.textContent?.includes("C03"),
      )!;
      await act(async () => {
        (target as HTMLButtonElement).click();
      });
      assert.equal(q.document.querySelector("select")!.value, "C03_PRACTICE_B");
      await act(async () => {
        resolve(prepared(sent[0]));
      });
      assert.equal(q.document.querySelector("a"), null);
      assert.match(q.document.body.textContent!, /evidence opportunity gap/);
    },
  );
});
test("current-catalog changes are explicit and a matching review hash cannot carry a preparation into another frozen context", async () => {
  const next = structuredClone(catalogue);
  next.catalog_hash = "d".repeat(64);
  await mounted(
    async (path, body) => {
      if (path.endsWith("/catalogue")) return next;
      const result = prepared(body!);
      result.context.catalog_hash = next.catalog_hash;
      return result;
    },
    async (q) => {
      await q.click("Find current practice episodes");
      assert.match(
        q.document.body.textContent!,
        /published catalog has changed/,
      );
      await q.click("Prepare selected rehearsal");
      assert.ok(q.document.querySelector("a"));
      const changed = structuredClone(review);
      changed.context.seed = 50;
      await q.render(changed);
      assert.equal(q.document.querySelector("a"), null);
      assert.match(
        q.document.body.textContent!,
        /Find current practice episodes/,
      );
    },
  );
});
test("long decision histories are incrementally disclosed without changing the source evidence", async () => {
  const long = structuredClone(review);
  long.evidence!.observations = Array.from({ length: 45 }, (_, i) => ({
    competency_id: "C02",
    decision_id: `D_${i}`,
    tick: i * 30,
    verdict: "incorrect",
    reason: "IDENTITY_NOT_ESTABLISHED",
  }));
  await mounted(
    async () => catalogue,
    async (q) => {
      await q.render(long);
      assert.equal(
        q.document.querySelectorAll(".training-bridge-original ol li").length,
        20,
      );
      await q.click("Show more source decisions (25 remaining)");
      assert.equal(
        q.document.querySelectorAll(".training-bridge-original ol li").length,
        40,
      );
      assert.equal(long.evidence!.observations.length, 45);
    },
  );
});

test("integrated verified review preserves investigation, reflection and original summary alongside rehearsal", () => {
  const html = renderToStaticMarkup(
    <LearningEvidence
      review={review}
      learner={{ sessionId: "SOURCE_SESSION", trainee: "REAL_OWNER" }}
      onInspectDecision={() => {}}
    />,
  );
  assert.match(html, /Build your next rehearsal from this evidence/);
  assert.match(html, /Open evidence investigation/);
  assert.match(html, /Reflect on your decision/);
  assert.match(html, /Competency evidence counts/);
  assert.match(html, /href="\/academy\?competency=C02"/);
  assert.doesNotMatch(html, /Open this rehearsal/);
  const officer = renderToStaticMarkup(
    <LearningEvidence
      review={review}
      reviewer={{ sessionId: "SOURCE_SESSION", trainee: "REAL_OWNER" }}
    />,
  );
  assert.match(officer, /Officer review is read-only/);
  assert.match(officer, /Review learner investigation/);
  assert.doesNotMatch(
    officer,
    /Find current practice episodes|Prepare selected rehearsal|Reflect on your decision/,
  );
});
