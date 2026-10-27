import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React, { act } from "react";
import { JSDOM } from "jsdom";
import axe from "axe-core";
import EpisodeOpportunities, {
  type OpportunityInspection,
} from "./EpisodeOpportunities";
import {
  readEpisodeOpportunities,
  opportunityStateLabel,
  type EpisodeOpportunities as Result,
} from "./episode-opportunities";
import type { Scenario } from "./types";
const fixture = JSON.parse(
  readFileSync(
    new URL(
      "./fixtures/episode-opportunities/frozen-report-v1.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as { scenario: Scenario; result: Result };
const fresh = () => structuredClone(fixture);

test("real unchanged-engine report fixture has exact bounded intervals and frozen copies without modifying source", () => {
  const f = fresh(),
    before = structuredClone(f),
    r = readEpisodeOpportunities(f.result, f.scenario);
  assert.equal(r.scenario_id, f.scenario.id);
  assert.notEqual(r, f.result);
  assert.ok(
    Object.isFrozen(r) && Object.isFrozen(r.contacts[0].channels.eo.intervals),
  );
  assert.deepEqual(f, before);
  assert.equal(r.actions_applied, 0);
  assert.equal(r.commands_applied, 0);
  assert.match(opportunityStateLabel("no_reply"), /identity unresolved/);
  assert.doesNotMatch(opportunityStateLabel("not_detected"), /hostile/i);
});

test("foreign, future, truncated, overlapping and manipulated report receipts fail closed", () => {
  const mutations: ((f: ReturnType<typeof fresh>) => void)[] = [
    (f) => {
      f.result.version = "future" as Result["version"];
    },
    (f) => {
      f.result.scenario_id = "raid_" + "a".repeat(24);
    },
    (f) => {
      f.result.raid_fingerprint = "b".repeat(24);
    },
    (f) => {
      f.scenario.id = "another-source";
    },
    (f) => {
      f.result.actions_applied = 1 as 0;
    },
    (f) => {
      f.result.commands_applied = 1 as 0;
    },
    (f) => {
      f.result.horizon.end_tick_exclusive++;
    },
    (f) => {
      f.result.contacts.pop();
    },
    (f) => {
      f.result.contacts[1].track_id = f.result.contacts[0].track_id;
    },
    (f) => {
      f.result.segment_count++;
    },
    (f) => {
      f.result.contacts[0].channels.eo.intervals[0].first_tick++;
    },
    (f) => {
      f.result.contacts[0].channels.eo.intervals[0].end_tick_exclusive++;
    },
    (f) => {
      f.result.contacts[0].channels.eo.intervals[0].state = "correct";
    },
    (f) => {
      f.result.contacts[0].channels.eo.state_ticks.inactive++;
    },
    (f) => {
      f.result.contacts[0].channels.rf.intervals[0].first_sample_tick = 1;
    },
    (f) => {
      f.result.contacts[0].channels.radar.intervals[0].last_sample_tick = 99999;
    },
    (f) => {
      Object.assign(f.result, { hidden_truth: true });
    },
    (f) => {
      delete (
        f.result.contacts[0].channels as Partial<
          Result["contacts"][number]["channels"]
        >
      ).ir;
    },
  ];
  for (const mutate of mutations) {
    const f = fresh();
    mutate(f);
    assert.throws(() => readEpisodeOpportunities(f.result, f.scenario));
  }
});

type Pending = { resolve: (response: Response) => void };
async function mounted(
  run: (q: {
    document: Document;
    click: (name: string) => Promise<void>;
    render: (props?: { scenario?: Scenario; stale?: boolean }) => Promise<void>;
    requests: { url: string; body: Record<string, unknown> }[];
    inspections: OpportunityInspection[];
    defer: () => void;
    release: (result?: Result, status?: number) => Promise<void>;
  }) => Promise<void>,
) {
  const dom = new JSDOM(
    '<!doctype html><html lang="en"><head><title>Author opportunity rehearsal</title></head><body><main><h1>Authoring</h1><h2>Compiled source</h2><div id="root"></div></main></body></html>',
    { url: "http://qa.local", runScripts: "outside-only" },
  );
  const saved = new Map<string, PropertyDescriptor | undefined>(),
    requests: { url: string; body: Record<string, unknown> }[] = [],
    inspections: OpportunityInspection[] = [];
  let deferred = false,
    waiting: Pending | undefined;
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    localStorage: dom.window.localStorage,
    sessionStorage: dom.window.sessionStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async (url: unknown, init: RequestInit) => {
      requests.push({ url: String(url), body: JSON.parse(String(init.body)) });
      if (deferred)
        return new Promise<Response>((resolve) => {
          waiting = { resolve };
        });
      return new Response(JSON.stringify(fixture.result), { status: 200 });
    },
  })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      value,
      configurable: true,
      writable: true,
    });
  }
  const { createRoot } = await import("react-dom/client"),
    root = createRoot(dom.window.document.getElementById("root")!);
  const render = async ({
    scenario = fixture.scenario,
    stale = false,
  }: { scenario?: Scenario; stale?: boolean } = {}) =>
    act(async () =>
      root.render(
        <EpisodeOpportunities
          scenario={scenario}
          stale={stale}
          onInspect={(m) => inspections.push(m)}
        />,
      ),
    );
  const click = async (name: string) => {
    const b = [...dom.window.document.querySelectorAll("button")].find(
      (b) => b.textContent!.trim() === name,
    );
    assert.ok(b, name);
    await act(async () => b.click());
  };
  try {
    await render();
    await run({
      document: dom.window.document,
      click,
      render,
      requests,
      inspections,
      defer: () => {
        deferred = true;
      },
      release: async (result = fixture.result, status = 200) => {
        assert.ok(waiting);
        await act(async () =>
          waiting!.resolve(
            new Response(
              JSON.stringify(
                status === 200
                  ? result
                  : { detail: "Bounded rehearsal unavailable" },
              ),
              { status },
            ),
          ),
        );
      },
    });
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [k, v] of saved) {
      if (v) Object.defineProperty(globalThis, k, v);
      else Reflect.deleteProperty(globalThis, k);
    }
  }
}

test("explicit author reconstruction retains complete source scope and an interval seeks the reference world without simulation actions", () =>
  mounted(async (q) => {
    assert.equal(q.requests.length, 0);
    await q.click("Reconstruct modeled reports");
    assert.equal(q.requests.length, 1);
    assert.equal(q.requests[0].url, "/api/v1/raids/opportunities");
    assert.deepEqual(q.requests[0].body.scenario, fixture.scenario);
    assert.equal(q.requests[0].body.expected_scenario_id, fixture.scenario.id);
    assert.match(q.document.body.textContent!, /AUTHOR COUNTERFACTUAL/);
    await q.click("EO");
    const legend = q.document.querySelector(
      'ul[aria-label="EO chart legend"]',
    )!;
    assert.ok(legend);
    assert.match(legend.textContent!, /Outside active interval/);
    assert.match(legend.textContent!, /Detection only/);
    assert.equal(
      legend.querySelectorAll("svg[aria-hidden=true]").length,
      legend.children.length,
    );
    const interval = fixture.result.contacts[0].channels.eo.intervals[0];
    await q.click(
      `Inspect reference at ${(interval.first_tick / 30).toFixed(2)}s`,
    );
    assert.deepEqual(q.inspections, [
      {
        scenarioId: fixture.scenario.id,
        trackId: fixture.scenario.tracks[0].id,
        tick: interval.first_tick,
      },
    ]);
    assert.doesNotMatch(
      q.document.body.textContent!,
      /mastery|field.tested|acquisition passed/i,
    );
  }));

test("late responses cannot be displayed in a changed frozen source or stale preview; duplicate clicks do not dispatch duplicate work", () =>
  mounted(async (q) => {
    q.defer();
    await q.click("Reconstruct modeled reports");
    await q.click("Reconstructing modeled reports…");
    assert.equal(q.requests.length, 1);
    await q.render({ stale: true });
    await q.release();
    assert.match(q.document.body.textContent!, /Compile a new frozen preview/);
    assert.equal(
      q.document.querySelectorAll(".opportunity-timeline").length,
      0,
    );
    await q.render();
    await q.click("Reconstruct modeled reports");
    const other = structuredClone(fixture.scenario);
    other.id = "raid_" + "c".repeat(24);
    await q.render({ scenario: other });
    await q.release();
    assert.equal(
      q.document.querySelectorAll(".opportunity-timeline").length,
      0,
    );
  }));

test("server rejection leaves source untouched and shows no partial intervals; unsupported workloads do not dispatch", () =>
  mounted(async (q) => {
    q.defer();
    await q.click("Reconstruct modeled reports");
    await q.release(undefined, 422);
    assert.match(
      q.document.body.textContent!,
      /Bounded rehearsal unavailable.*No partial timeline/s,
    );
    assert.equal(
      q.document.querySelectorAll(".opportunity-timeline").length,
      0,
    );
    const tooLarge = structuredClone(fixture.scenario);
    tooLarge.tracks = Array.from({ length: 21 }, (_, i) => ({
      ...tooLarge.tracks[0],
      id: `T${i + 1}`,
    }));
    await q.render({ scenario: tooLarge });
    await q.click("Reconstruct modeled reports");
    assert.equal(q.requests.length, 1);
  }));

test("native interval controls and the visual report chart pass structural accessibility", () =>
  mounted(async (q) => {
    await q.click("Reconstruct modeled reports");
    const view = q.document.defaultView as unknown as {
      eval: (s: string) => void;
      axe: typeof axe;
    };
    view.eval(axe.source);
    const result = await view.axe.run(q.document, {
      rules: { "color-contrast": { enabled: false } },
    });
    assert.equal(
      result.violations.length,
      0,
      JSON.stringify(result.violations),
    );
    assert.ok(q.document.querySelector('svg[role="img"][aria-label]'));
    assert.ok(q.document.querySelector("select"));
  }));
