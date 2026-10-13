import test from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { JSDOM } from "jsdom";
import axe from "axe-core";
import { spawnSync } from "node:child_process";
import { testPython } from "./test-python";
import DecisionPath, { referenceLabel } from "./review-DecisionPath";
import { Trend } from "./Analytics";
import Analytics from "./Analytics";
import { GhostPanel } from "./Ghost";
import type {
  DecisionReview,
  GhostSkill,
  Record as TrainingRecord,
} from "./types";
const generated = spawnSync(
  testPython(),
  [
    "-c",
    `import json
from server.engine import make_scenario
from server.review import build_review
spec=make_scenario()
log=[dict(tick=1,order=0,k='designate',track='T1'),dict(tick=2,order=1,k='classify',track='T1',kind='quad',identity='hostile'),dict(tick=3,order=2,k='engage',track='T1',effector='rf_jam')]
review,card=build_review(spec,log,[],'review-visual',2250)
print(json.dumps(dict(id='review-visual',trainee='TEST',scenario=spec,events=log,commands=[],endTick=2250,scorecard=card,created_at='2026-10-13T00:00:00Z',verified=True,**review)))`,
  ],
  { cwd: "..", encoding: "utf8" },
);
assert.equal(generated.status, 0, generated.stderr);
const record = JSON.parse(generated.stdout) as TrainingRecord;
const means: Record<GhostSkill, number> = {
  detection: 0.625,
  classification_iff: 0.75,
  effector_choice: 0.5,
  degraded_sensor_response: 0.4,
};
const history = {
  prior: means,
  note: "Persisted ledger; model estimates only",
  points: [
    {
      sequence: 1,
      session_id: "one",
      kind: "tactical",
      processed_at: "2026-10-13T01:00:00Z",
      means,
      director_focus: null,
      director_mastery_before: null,
    },
  ],
  sessions: [
    {
      id: "one",
      title: "First",
      pack: "legacy",
      seed: 1,
      observed_tick: 30,
      score: 41,
      nodes: { detect: 10, classify: 15, prioritise: 5, engage: 11 },
      leakers: 1,
      roe_breaches: 0,
      failures: {},
    },
    {
      id: "two",
      title: "Second",
      pack: "legacy",
      seed: 2,
      observed_tick: 60,
      score: 77,
      nodes: { detect: 20, classify: 20, prioritise: 10, engage: 27 },
      leakers: 0,
      roe_breaches: 0,
      failures: {},
    },
  ],
};
async function mounted(
  body: (
    root: import("react-dom/client").Root,
    document: Document,
    dom: JSDOM,
  ) => Promise<void>,
  fetcher?: typeof fetch,
) {
  const dom = new JSDOM(
    '<!doctype html><html lang="en"><head><title>VYUHA review test</title></head><body><div id="root"></div></body></html>',
    { url: "http://qa.local", runScripts: "outside-only" },
  );
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    localStorage: dom.window.localStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
    ...(fetcher ? { fetch: fetcher } : {}),
  })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    });
  }
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(dom.window.document.getElementById("root")!);
  try {
    await body(root, dom.window.document, dom);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
}
test("Decision path filters authoritative stages, preserves linear alternative and opens the exact recorded replay moment", async () => {
  const before = structuredClone(record);
  let chosen: DecisionReview | null = null;
  await mounted(async (root, document) => {
    await act(async () =>
      root.render(
        <DecisionPath
          record={record}
          track="T1"
          onReview={(r) => {
            chosen = r;
          }}
        />,
      ),
    );
    assert.equal(document.querySelectorAll("ol.review-path > li").length, 4);
    const respond = document.querySelectorAll<HTMLButtonElement>(
      ".review-node-control",
    )[3];
    respond.focus();
    assert.equal(document.activeElement, respond);
    await act(async () => respond.click());
    assert.equal(respond.getAttribute("aria-pressed"), "true");
    assert.equal(
      document.querySelectorAll(".review-branches > details").length,
      record.decision_reviews!.filter(
        (r) => r.track_id === "T1" && r.decision_kind === "engagement",
      ).length,
    );
    const jump = [...document.querySelectorAll("button")].find(
      (b) => b.textContent === "Open this moment in replay",
    )!;
    await act(async () => jump.click());
    assert.equal(
      (chosen as DecisionReview | null)?.decision_kind,
      "engagement",
    );
    assert.equal((chosen as DecisionReview | null)?.tick, 3);
    assert.match(
      document.querySelector(".review-linear-alternative")!.textContent!,
      /Detect.*Classify.*Timely response.*Respond/s,
    );
    assert.match(
      document.body.textContent!,
      /shared across attempts|not a separate per-action award/,
    );
  });
  assert.deepEqual(record, before);
});
test("Trend plot supports labelled series filtering while retaining exact historical values and priors in a linear table", async () => {
  await mounted(async (root, document) => {
    await act(async () => root.render(<Trend history={history} />));
    assert.equal(document.querySelectorAll("svg polyline").length, 4);
    assert.match(document.querySelector("table")!.textContent!, /62.50%/);
    assert.match(document.querySelector("table")!.textContent!, /50.00%/);
    await act(async () =>
      document
        .querySelector<HTMLInputElement>('input[type="checkbox"]')!
        .click(),
    );
    assert.equal(document.querySelectorAll("svg polyline").length, 3);
    assert.match(document.querySelector("table")!.textContent!, /62.50%/);
    assert.match(
      document.querySelector("figcaption")!.textContent!,
      /not calibrated readiness/,
    );
  });
});
test("Analytics starts with persisted overview and opens comparison/family details through native pressed controls", async () => {
  await mounted(
    async (root, document) => {
      await act(async () => root.render(<Analytics />));
      assert.match(
        document.querySelector(".analytics-overview")!.textContent!,
        /77\/100/,
      );
      assert.ok(!document.querySelector('select[value="one"]'));
      const button = (text: string) =>
        [...document.querySelectorAll("button")].find(
          (b) => b.textContent === text,
        )!;
      await act(async () => button("Session comparison").click());
      assert.equal(
        button("Session comparison").getAttribute("aria-pressed"),
        "true",
      );
      assert.ok(!document.querySelector(".analytics-overview"));
      assert.match(
        document.querySelector("table")!.textContent!,
        /Observed difference B − A/,
      );
      assert.match(
        document.querySelector(".analytics-detail")!.textContent!,
        /do not establish that training caused improvement/,
      );
      await act(async () => button("Scenario × skill").click());
      assert.ok(document.querySelector("#scenario-skill"));
    },
    async (input) => {
      const url = String(input);
      if (url.endsWith("/units"))
        return new Response(
          JSON.stringify({ units: [{ id: "local", name: "Local" }] }),
        );
      if (url.endsWith("/trainees"))
        return new Response(
          JSON.stringify({
            trainees: [
              { unit_id: "local", trainee_id: "person", callsign: "TEST" },
            ],
          }),
        );
      if (url.includes("skill-heatmap"))
        return new Response(
          JSON.stringify({
            unit_id: "local",
            trainee_id: null,
            included_sessions: 2,
            excluded_sessions: 0,
            note: "Recorded family outcomes",
            skills: [],
            rows: [],
          }),
        );
      return new Response(JSON.stringify(history));
    },
  );
});
test("Populated decision path, Ghost actions and accessible trend pass structural axe checks", async () => {
  await mounted(async (root, document, dom) => {
    await act(async () =>
      root.render(
        <main>
          <h1>Post-exercise evidence</h1>
          <DecisionPath record={record} track="T1" onReview={() => {}} />
          <GhostPanel
            record={record}
            selectedId={record.decision_reviews![0].decision_id}
            onChoose={() => {}}
          />
          <Trend history={history} />
        </main>,
      ),
    );
    dom.window.eval(axe.source);
    const result = await (dom.window as unknown as { axe: typeof axe }).axe.run(
      document.documentElement,
      { rules: { "color-contrast": { enabled: false } } },
    );
    assert.equal(
      result.violations.length,
      0,
      JSON.stringify(
        result.violations.map((v) => ({
          id: v.id,
          targets: v.nodes.map((n) => n.target),
        })),
      ),
    );
  });
});

test("Prioritization reference names the actual expected contact instead of presenting only its effector", () => {
  const review = {
    decision_kind: "prioritisation",
    expected_action: { track_id: "T2", type: "engage", effector: "kinetic" },
  } as DecisionReview;
  assert.equal(referenceLabel(review), "Prioritize T2 · Kinetic");
  assert.equal(
    referenceLabel({
      ...review,
      expected_action: { ...review.expected_action, track_id: undefined },
    }),
    "No reference contact established · Kinetic",
  );
});
