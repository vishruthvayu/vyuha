import test from "node:test";
import assert from "node:assert/strict";
import React, { act, useEffect, useState } from "react";
import { JSDOM } from "jsdom";
import SimulationWorkstation from "./SimulationWorkstation";
import {
  instrumentFor,
  openInstrument,
  type SimulationInstrument,
} from "./simulation-instruments";
import { FusionPanel } from "./FusionPanel";
import type { SensorObservation } from "./sensors-v2";
import type { FusionAdvice } from "./fusion";

test("instrument context is presentation-only and cannot follow a different exercise", () => {
  const state = openInstrument("attempt-A", "decide");
  assert.equal(instrumentFor(state, "attempt-A"), "decide");
  assert.equal(instrumentFor(state, "attempt-B"), "observe");
  assert.equal(instrumentFor(null, "attempt-A"), "observe");
  assert.throws(() => openInstrument("", "observe"));
  assert.throws(() => openInstrument("A", "engage" as SimulationInstrument));
  assert.deepEqual(state, { scope: "attempt-A", view: "decide" });
});

test("instrument navigation retains the same world/form, preserves selection and returns keyboard focus", async () => {
  const dom = new JSDOM(
    '<!doctype html><html lang="en"><title>Station QA</title><body><main><h1>Training ground</h1><div id="root"></div></main></body></html>',
    { url: "http://qa.local" },
  );
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    IS_REACT_ACT_ENVIRONMENT: true,
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
  let mounts = 0;
  const views: string[] = [];
  function World() {
    useEffect(() => {
      mounts++;
    }, []);
    return <div data-world="same">World</div>;
  }
  function Harness({ range = 500 }: { range?: number }) {
    const [view, setView] = useState<SimulationInstrument>("observe");
    return (
      <SimulationWorkstation
        view={view}
        onView={(next) => {
          views.push(next);
          setView(next);
        }}
        phase="running"
        reportCount={1}
        selected={{
          id: "T1",
          current: true,
          reportTick: 30,
          rangeM: range,
          declaration: null,
          rf: "Not detected",
          iff: "No reply",
        }}
      >
        <section className="sensor-workspace">
          <World />
          <section className="radar-panel" tabIndex={-1}>
            Radar
          </section>
        </section>
        <aside className="right-panels" tabIndex={-1}>
          Reports
        </aside>
        <section className="decision-workspace" tabIndex={-1}>
          <label>
            Type choice
            <input defaultValue="Unsubmitted choice" />
          </label>
          <button>Original action</button>
        </section>
        <aside className="decision-evidence" tabIndex={0}>
          Existing evidence
        </aside>
      </SimulationWorkstation>
    );
  }
  const click = async (name: string) =>
    act(async () => {
      [...dom.window.document.querySelectorAll("button")]
        .find((b) => (b.getAttribute("aria-label") ?? b.textContent) === name)!
        .click();
    });
  try {
    await act(async () => root.render(<Harness />));
    const original = dom.window.document.querySelector("[data-world]");
    await click("Open decision station");
    assert.equal(
      dom.window.document.activeElement?.className,
      "decision-workspace",
    );
    await click("Inspect selected evidence");
    await click("Browse reported contacts");
    assert.equal(
      dom.window.document.querySelector("input")!.value,
      "Unsubmitted choice",
    );
    assert.equal(dom.window.document.querySelector("[data-world]"), original);
    assert.equal(mounts, 1);
    await act(async () => root.render(<Harness range={490} />));
    assert.equal(dom.window.document.activeElement?.className, "right-panels");
    await act(async () =>
      dom.window.document.activeElement!.dispatchEvent(
        new dom.window.KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
        }),
      ),
    );
    assert.equal(
      dom.window.document.activeElement?.getAttribute("aria-label"),
      "Observe world",
    );
    assert.equal(
      dom.window.document
        .querySelector(".simulation-workstation")!
        .getAttribute("data-instrument"),
      "observe",
    );
    assert.deepEqual(views, ["decide", "evidence", "reports", "observe"]);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, value] of saved) {
      if (value) Object.defineProperty(globalThis, key, value);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test("Fusion cannot report new displayed advice while its instrument is hidden; showing it restores the current snapshot", async () => {
  const dom = new JSDOM('<div id="root"></div><div id="decision"></div>');
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    IS_REACT_ACT_ENVIRONMENT: true,
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
  const displays: (FusionAdvice | null)[] = [];
  const onExposure = (value: FusionAdvice | null) => displays.push(value);
  const observation: SensorObservation = {
    version: "vyuha-0.4.0",
    tick: 30,
    track_id: "T1",
    radar: {
      available: true,
      state: "confirmed",
      detected: true,
      fresh: true,
      position: { x: 0, z: 100, altitude: 20 },
      sample_tick: 30,
    },
    eo: {
      available: true,
      level: "recognise",
      position: { x: 0, z: 100, altitude: 20 },
      silhouette: "multirotor",
      sample_tick: 30,
    },
    ir: {
      available: false,
      level: "none",
      position: null,
      silhouette: null,
      sample_tick: null,
    },
    rf: { available: true, detected: false, band_ghz: null, bearing_deg: null },
    iff: { available: true, cue: "no_reply", registration_id: null },
  };
  const render = async (presented: boolean, tick = 30) =>
    act(async () =>
      root.render(
        <FusionPanel
          observation={{
            ...observation,
            tick,
            eo: { ...observation.eo, sample_tick: tick },
            radar: { ...observation.radar, sample_tick: tick },
          }}
          config={{ mode: "training" }}
          context={{ session_id: "S", scenario_id: "A" }}
          presented={presented}
          controlsHost={dom.window.document.getElementById("decision")}
          onExposure={onExposure}
        />,
      ),
    );
  try {
    await render(false);
    assert.equal(displays.at(-1), null);
    assert.equal(dom.window.document.body.textContent, "");
    await render(true);
    assert.equal(displays.at(-1)?.evidence.tick, 30);
    assert.ok(dom.window.document.querySelector("#decision .fusion-panel"));
    assert.equal(
      dom.window.document.querySelector("#root .fusion-panel"),
      null,
    );
    const displayed = displays.at(-1);
    await render(true);
    assert.equal(displays.at(-1)?.exposure_id, displayed?.exposure_id);
    await render(false, 31);
    assert.equal(displays.at(-1), null);
    assert.equal(dom.window.document.body.textContent, "");
    await render(true, 32);
    assert.equal(displays.at(-1)?.evidence.tick, 32);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, value] of saved) {
      if (value) Object.defineProperty(globalThis, key, value);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
