import test from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { JSDOM } from "jsdom";
import AdvancedAAR from "./AdvancedAAR";
import FusionReview from "./FusionReview";
import { makeScenario } from "./scenario";
import { replay, score } from "./sim";
import type { Record as TrainingRecord } from "./types";
const scenario = makeScenario();
const record: TrainingRecord = {
  id: "old-session",
  trainee: "TEST",
  scenario,
  events: [{ k: "engage", track: "T1", tick: 30, effector: "hold" }],
  endTick: 60,
  scorecard: score(replay(scenario, [], 60)),
  created_at: "2026-10-13T00:00:00Z",
  verified: true,
};
async function mounted(
  run: (
    root: import("react-dom/client").Root,
    document: Document,
  ) => Promise<void>,
  fetcher: typeof fetch,
) {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://qa.local" });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    localStorage: dom.window.localStorage,
    fetch: fetcher,
    IS_REACT_ACT_ENVIRONMENT: true,
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
    await run(root, dom.window.document);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
}
for (const status of [200, 422]) {
  test(`What-if ignores late ${status} response after session changes`, async () => {
    let release: () => void = () => {};
    await mounted(
      async (root, document) => {
        await act(async () => root.render(<AdvancedAAR record={record} />));
        const button = [...document.querySelectorAll("button")].find((b) =>
          b.textContent?.includes("Run hypothetical"),
        )!;
        await act(async () => button.click());
        await act(async () =>
          root.render(
            <AdvancedAAR record={{ ...record, id: "new-session" }} />,
          ),
        );
        await act(async () => {
          release();
          await new Promise((r) => setTimeout(r, 10));
        });
        assert.doesNotMatch(
          document.body.textContent!,
          /old branch|old rejection|Hypothetical simulated result/,
        );
        assert.ok(
          [...document.querySelectorAll("button")].some(
            (b) => b.textContent?.includes("Run hypothetical") && !b.disabled,
          ),
        );
      },
      async () => {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return new Response(
          JSON.stringify(
            status === 200
              ? {
                  original_score: record.scorecard,
                  hypothetical_score: record.scorecard,
                  delta: 0,
                  rejected_later_actions: [],
                  reference_policy: {
                    action: "hold",
                    confidence: "old branch",
                    cues: [],
                  },
                  note: "old branch",
                }
              : { detail: "old rejection" },
          ),
          { status },
        );
      },
    );
  });
  test(`Fusion review ignores late ${status} receipt response after session changes`, async () => {
    let release: () => void = () => {};
    const fusionRecord = {
      ...record,
      scenario: {
        ...scenario,
        fusion: {
          mode: "training",
          exercise: "baseline",
        } as unknown as NonNullable<typeof scenario.fusion>,
      },
    };
    await mounted(
      async (root, document) => {
        await act(async () =>
          root.render(<FusionReview record={fusionRecord} />),
        );
        await act(async () =>
          root.render(
            <FusionReview record={{ ...fusionRecord, id: "new-session" }} />,
          ),
        );
        await act(async () => {
          release();
          await new Promise((r) => setTimeout(r, 10));
        });
        assert.match(document.body.textContent!, /new receipt scope/);
        assert.doesNotMatch(
          document.body.textContent!,
          /old receipt scope|old rejection/,
        );
      },
      async (input) => {
        if (String(input).includes("old-session"))
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        const old = String(input).includes("old-session");
        return new Response(
          JSON.stringify(
            old && status === 422
              ? { detail: "old rejection" }
              : {
                  exposures: [],
                  confidence_diagnostic: {
                    count: 0,
                    mean_brier: null,
                    scope: old ? "old receipt scope" : "new receipt scope",
                  },
                  limitations: [],
                },
          ),
          { status: old ? status : 200 },
        );
      },
    );
  });
}

test("Analytics ignores previous-unit failures and avoids an invented default trainee request", async () => {
  const { default: Analytics } = await import("./Analytics");
  const releases: (() => void)[] = [];
  const requests: string[] = [];
  await mounted(
    async (root, document) => {
      await act(async () => root.render(<Analytics />));
      const unitSelect = [...document.querySelectorAll("label")]
        .find((l) => l.textContent?.startsWith("Unit"))!
        .querySelector("select")!;
      await act(async () => {
        unitSelect.value = "next";
        unitSelect.dispatchEvent(new window.Event("change", { bubbles: true }));
      });
      await act(async () => {
        releases.forEach((release) => release());
        await new Promise((r) => setTimeout(r, 10));
      });
      assert.doesNotMatch(document.body.textContent!, /previous unit failure/);
      assert.ok(
        !requests.some((url) => url.includes("CADET-01")),
        "No default callsign is invented before roster is known",
      );
      const traineeSelect = [...document.querySelectorAll("label")]
        .find((l) => l.textContent?.startsWith("Trainee"))!
        .querySelector("select")!;
      assert.equal(traineeSelect.value, "next-person");
      assert.match(document.body.textContent!, /next unit evidence/);
    },
    async (input) => {
      const url = String(input);
      requests.push(url);
      if (url.endsWith("/units"))
        return new Response(
          JSON.stringify({
            units: [
              { id: "local", name: "Local" },
              { id: "next", name: "Next" },
            ],
          }),
        );
      if (
        (url.includes("/local/") && url.endsWith("/analytics")) ||
        url.includes("/local-person/analytics")
      ) {
        await new Promise<void>((resolve) => releases.push(resolve));
        return new Response(
          JSON.stringify({ detail: "previous unit failure" }),
          { status: 422 },
        );
      }
      if (url.endsWith("/trainees"))
        return new Response(
          JSON.stringify({
            trainees: [
              {
                unit_id: url.includes("/next/") ? "next" : "local",
                trainee_id: url.includes("/next/")
                  ? "next-person"
                  : "local-person",
                callsign: "B",
              },
            ],
          }),
        );
      if (url.includes("skill-heatmap"))
        return new Response(
          JSON.stringify({
            unit_id: "next",
            trainee_id: null,
            included_sessions: 0,
            excluded_sessions: 0,
            note: "next unit evidence",
            skills: [],
            rows: [],
          }),
        );
      return new Response(
        JSON.stringify({
          prior: {},
          points: [],
          sessions: [],
          note: "next unit evidence",
        }),
      );
    },
  );
});

test("Reference comparison rejects a successful response belonging to another session", async () => {
  const { default: ExpertComparison } = await import("./ExpertComparison");
  await mounted(
    async (root, document) => {
      await act(async () => root.render(<ExpertComparison record={record} />));
      assert.match(
        document.querySelector('[role="alert"]')!.textContent!,
        /does not belong to this session/,
      );
      assert.doesNotMatch(document.body.textContent!, /foreign policy/);
    },
    async () =>
      new Response(
        JSON.stringify({
          session_id: "foreign-session",
          summary: {
            agreements: 0,
            recorded_responses: 0,
            interpretation: "foreign policy",
          },
          entries: [],
          limitations: [],
        }),
      ),
  );
});
