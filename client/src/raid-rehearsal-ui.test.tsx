import test from "node:test";
import assert from "node:assert/strict";
import { act } from "react";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import axe from "axe-core";
import RaidStudio from "./RaidStudio";
import { RaidRehearsal } from "./RaidRehearsal";
import type { Scenario } from "./types";

const scenario: Scenario = {
  version: 2,
  engine_version: "vyuha-0.4.0",
  id: "raid-ui-fixture",
  seed: 27,
  title: "Controlled waves",
  duration: 90,
  night: false,
  fog: 0.15,
  jamStart: -1,
  jamEnd: -1,
  focus: "effector_choice",
  tracks: [
    {
      id: "T1",
      kind: "quad",
      identity: "hostile",
      rf: true,
      spawn: 60,
      bearing: 90,
      distance: 900,
      speed: 15,
      altitude: 40,
      motion: {
        version: 1,
        primitive: "weave",
        phase_s: 8,
        lateral_m: 25,
        period_s: 12,
        turn_deg: 0,
      },
    },
    {
      id: "T2",
      kind: "bird",
      identity: "neutral",
      rf: false,
      spawn: 900,
      bearing: 0,
      distance: 1700,
      speed: 12,
      altitude: 60,
      expires_tick: 1800,
      motion: {
        version: 1,
        primitive: "orbit_then_dash",
        phase_s: 90,
        lateral_m: 0,
        period_s: 20,
        turn_deg: 70,
      },
    },
  ],
  raid: {
    version: 2,
    family: "STAGGERED_WAVES",
    fingerprint: "fixture",
    signature: [],
    validation: {},
    waves: [
      { tick: 60, role: "first_wave", contacts: ["T1"] },
      { tick: 900, role: "second_wave", contacts: ["T2"] },
    ],
  },
};
async function mounted(
  component: React.ReactNode,
  run: (q: {
    document: Document;
    render: (component: React.ReactNode) => Promise<void>;
    requests: Record<string, unknown>[];
    click: (name: string) => Promise<void>;
    change: (label: string, value: string) => Promise<void>;
  }) => Promise<void>,
  compiled?: Scenario,
  opportunityResult?: unknown,
) {
  const dom = new JSDOM(
    '<!doctype html><html lang="en"><head><title>Raid Studio</title></head><body><main><h1>Authoring</h1><h2>Compiled reference</h2><div id="root"></div></main></body></html>',
    { url: "http://qa.local", runScripts: "outside-only" },
  );
  const saved = new Map<string, PropertyDescriptor | undefined>(),
    requests: Record<string, unknown>[] = [];
  for (const [name, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    localStorage: dom.window.localStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async (url: unknown, init: RequestInit) => {
      const request = JSON.parse(String(init.body));
      requests.push(request);
      return new Response(
        JSON.stringify(
          String(url).endsWith("/raids/opportunities")
            ? opportunityResult
            : {
                ...(compiled ?? scenario),
                title: request.name ?? (compiled ?? scenario).title,
              },
        ),
      );
    },
  })) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, {
      value,
      configurable: true,
      writable: true,
    });
  }
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(dom.window.document.getElementById("root")!);
  const click = async (name: string) => {
    const button = [...dom.window.document.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === name,
    );
    assert.ok(button, name);
    await act(async () => button.click());
  };
  const change = async (label: string, value: string) => {
    const element = [...dom.window.document.querySelectorAll("label")]
      .find((l) => l.textContent?.trim().startsWith(label))
      ?.querySelector("input, select") as
      HTMLInputElement | HTMLSelectElement | null;
    assert.ok(element, label);
    const proto =
      element.tagName === "SELECT"
        ? dom.window.HTMLSelectElement.prototype
        : dom.window.HTMLInputElement.prototype;
    await act(async () => {
      Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(
        element,
        value,
      );
      element.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
      element.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
  };
  try {
    await act(async () => root.render(component));
    await run({
      document: dom.window.document,
      requests,
      click,
      change,
      render: async (next) => {
        await act(async () => root.render(next));
      },
    });
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [name, value] of saved) {
      if (value) Object.defineProperty(globalThis, name, value);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
}

test("reference author can scrub waves and inspect a roster subject without any API mutation or trainee action", () =>
  mounted(<RaidRehearsal scenario={scenario} />, async (q) => {
    assert.match(q.document.body.textContent!, /AUTHOR REFERENCE/);
    await q.click("Next wave");
    assert.match(q.document.querySelector("output")!.textContent!, /2.00/);
    await q.click("Next wave");
    assert.match(q.document.querySelector("output")!.textContent!, /30.00/);
    await q.click("Previous wave");
    assert.match(q.document.querySelector("output")!.textContent!, /2.00/);
    const roster = [
      ...q.document.querySelectorAll(".raid-reference-roster button"),
    ];
    await act(async () => (roster[1] as HTMLButtonElement).click());
    assert.equal(roster[1].getAttribute("aria-pressed"), "true");
    assert.match(
      q.document.querySelector(".raid-reference-properties")!.textContent!,
      /T2 · author reference.*Bird \/ neutral/s,
    );
    assert.match(q.document.querySelector("output")!.textContent!, /2.00/);
    await q.click("Jump to spawn");
    assert.match(q.document.querySelector("output")!.textContent!, /30.00/);
    assert.equal(q.requests.length, 0);
    await q.click("Beginning");
    assert.match(
      q.document.querySelector(".raid-reference-properties")!.textContent!,
      /Not yet scheduled/,
    );
  }));

test("admitted objective, exact roster and weak-sector choices reach preview unchanged; changing them marks the reference stale", () =>
  mounted(<RaidStudio />, async (q) => {
    await q.change("Training objective", "classification_iff");
    await q.change("Raid family", "BLIND_SECTOR");
    await q.change("Weak-sector bearing", "123");
    const exact = [...q.document.querySelectorAll("label")]
      .find((l) => l.textContent!.includes("Set an exact roster"))!
      .querySelector("input")!;
    await act(async () => exact.click());
    await q.change("RF-linked hostile quad", "3");
    await q.click("Preview raid");
    assert.equal(q.requests.length, 1);
    assert.equal(q.requests[0].focus, "classification_iff");
    assert.equal(q.requests[0].weak_sector_deg, 123);
    assert.deepEqual(q.requests[0].mix, [
      "hostile_quad",
      "hostile_quad",
      "hostile_quad",
      "no_rf_fpv",
      "fixed_wing",
      "bird",
      "friendly_uav",
      "civil_uav",
    ]);
    assert.ok(q.document.querySelector(".raid-rehearsal"));
    await q.change("Weak-sector bearing", "12");
    assert.match(
      q.document.querySelector(".composer-stale")!.textContent!,
      /previous configuration/,
    );
    await q.change("Weak-sector bearing", "360");
    await q.click("Compile and save frozen raid");
    assert.equal(q.requests.length, 1);
    assert.match(
      q.document.querySelector('[role="alert"]')!.textContent!,
      /not including, 360/,
    );
  }));

test("rehearsal semantics pass structural axe and unsupported historical source remains untouched", () =>
  mounted(<RaidRehearsal scenario={scenario} />, async (q) => {
    const view = q.document.defaultView as unknown as {
      eval: (s: string) => void;
      axe: typeof axe;
    };
    view.eval(axe.source);
    await q.click("Next wave");
    const marker = q.document.querySelector('svg [role="button"]')!;
    await act(async () =>
      marker.dispatchEvent(
        new q.document.defaultView!.KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
        }),
      ),
    );
    assert.match(
      q.document.querySelector(".raid-reference-properties")!.textContent!,
      /T1 · author reference/,
    );
    assert.match(q.document.querySelector("output")!.textContent!, /2.00/);
    const results = await view.axe.run(q.document, {
      rules: { "color-contrast": { enabled: false } },
    });
    assert.equal(
      results.violations.length,
      0,
      JSON.stringify(results.violations),
    );
    assert.match(
      q.document.querySelector("svg")!.getAttribute("aria-label")!,
      /reference/,
    );
    assert.equal(q.requests.length, 0);
  }));

test("old or malformed compiled raids use an explicit unavailable fallback", () =>
  mounted(
    <RaidRehearsal scenario={{ ...scenario, engine_version: "vyuha-0.3.0" }} />,
    async (q) => {
      assert.match(
        q.document.querySelector(".raid-rehearsal-unavailable")!.textContent!,
        /Reference rehearsal unavailable.*original compiled result is retained/,
      );
      assert.equal(q.document.querySelector("svg"), null);
      assert.equal(q.requests.length, 0);
    },
  ));

test("compiled sensor intervals seek the real Studio reference world and cannot become trainee actions", async () => {
  const fixture = JSON.parse(
    readFileSync(
      new URL(
        "./fixtures/episode-opportunities/frozen-report-v1.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as {
    scenario: Scenario;
    result: {
      contacts: {
        channels: {
          eo: { intervals: { state: string; first_tick: number }[] };
        };
      }[];
    };
  };
  await mounted(
    <RaidStudio />,
    async (q) => {
      await q.click("Preview raid");
      await q.click("Reconstruct modeled reports");
      await q.click("EO");
      const interval = fixture.result.contacts[0].channels.eo.intervals.find(
        (w) => w.state !== "inactive" && w.state !== "none",
      );
      assert.ok(interval);
      const name = `Inspect reference at ${(interval.first_tick / 30).toFixed(2)}s`;
      let button = [
        ...q.document.querySelectorAll(".opportunity-intervals button"),
      ].find((b) => b.textContent?.trim() === name);
      while (!button) {
        const more = [...q.document.querySelectorAll("button")].find((b) =>
          b.textContent?.startsWith("Show more exact intervals"),
        ) as HTMLButtonElement | undefined;
        assert.ok(
          more,
          "source interval must be reachable through incremental disclosure",
        );
        await act(async () => more.click());
        button = [
          ...q.document.querySelectorAll(".opportunity-intervals button"),
        ].find((b) => b.textContent?.trim() === name);
      }
      await act(async () => (button as HTMLButtonElement).click());
      assert.match(
        q.document.querySelector(".raid-rehearsal output")!.textContent!,
        new RegExp((interval.first_tick / 30).toFixed(2).replace(".", "\\.")),
      );
      assert.match(
        q.document.querySelector(".raid-reference-properties")!.textContent!,
        /T1 · author reference/,
      );
      assert.match(
        q.document.querySelector(".raid-rehearsal [role=status]")!.textContent!,
        /Modeled report boundary/,
      );
      assert.equal(q.requests.length, 2);
      assert.equal(q.requests[1].version, "episode-opportunities-request-v1");
      assert.equal(q.requests[1].expected_scenario_id, fixture.scenario.id);
      assert.equal("actions" in q.requests[1], false);
      await q.change("Fog", "0.6");
      assert.equal(q.document.querySelector(".opportunity-intervals"), null);
      assert.match(
        q.document.body.textContent!,
        /Compile a new frozen preview/,
      );
    },
    fixture.scenario,
    fixture.result,
  );
});

test("modeled-boundary reference seeking rejects wrong scope and invalid ticks, and repeated requests retain keyboard focus", () =>
  mounted(<RaidRehearsal scenario={scenario} />, async (q) => {
    const boundary = {
      scenarioId: scenario.id,
      trackId: "T1",
      tick: 180,
      revision: 1,
    };
    const rejected = [
      { ...boundary, scenarioId: "another-raid" },
      { ...boundary, trackId: "missing" },
      { ...boundary, tick: -1 },
      { ...boundary, tick: 1.5 },
      { ...boundary, tick: scenario.duration * 30 + 1 },
    ];
    for (const inspection of rejected) {
      await q.render(
        <RaidRehearsal scenario={scenario} inspection={inspection} />,
      );
      assert.match(q.document.querySelector("output")!.textContent!, /0.00/);
      assert.equal(q.document.querySelector('[role="status"]'), null);
      assert.match(
        q.document.querySelector(".raid-reference-properties")!.textContent!,
        /Select a roster entry/,
      );
    }
    await q.render(<RaidRehearsal scenario={scenario} inspection={boundary} />);
    assert.match(q.document.querySelector("output")!.textContent!, /6.00/);
    assert.match(
      q.document.querySelector('[role="status"]')!.textContent!,
      /T1.*6.00/,
    );
    assert.equal(
      q.document.activeElement,
      q.document.querySelector(".raid-rehearsal h3"),
    );
    await q.click("Beginning");
    assert.equal(q.document.querySelector('[role="status"]'), null);
    await q.render(
      <RaidRehearsal
        scenario={scenario}
        inspection={{ ...boundary, revision: 2 }}
      />,
    );
    assert.match(q.document.querySelector("output")!.textContent!, /6.00/);
    assert.equal(
      q.document.activeElement,
      q.document.querySelector(".raid-rehearsal h3"),
    );
    assert.equal(q.requests.length, 0);
  }));
