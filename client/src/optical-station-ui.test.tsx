import test from "node:test";
import assert from "node:assert/strict";
import React, { act, useEffect } from "react";
import { JSDOM } from "jsdom";
import { OpticalStation } from "./OpticalStation";
import { observeSensors } from "./sensors-v2";
import type { OpticalAim } from "./optical-station";
import type { SensorObservation } from "./sensors-v2";
async function mounted(
  run: (q: {
    document: Document;
    render: (options?: {
      scope?: string;
      selected?: string;
      tick?: number;
      enabled?: boolean;
      tactical?: boolean;
      scanEnabled?: boolean;
      observation?: SensorObservation;
      cue?: boolean;
      controlsHost?: HTMLElement | null;
    }) => Promise<void>;
    click: (name: string) => Promise<void>;
    view: () => OpticalAim | null;
    mounts: () => number;
    reportAim: (aim: OpticalAim) => void;
  }) => Promise<void>,
) {
  const dom = new JSDOM(
      '<!doctype html><html lang="en"><title>Observation station</title><body><main><div id="root"></div></main></body></html>',
      { url: "http://qa.local" },
    ),
    saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [k, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    getComputedStyle: dom.window.getComputedStyle,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    saved.set(k, Object.getOwnPropertyDescriptor(globalThis, k));
    Object.defineProperty(globalThis, k, {
      configurable: true,
      writable: true,
      value,
    });
  }
  const { createRoot } = await import("react-dom/client"),
    root = createRoot(dom.window.document.getElementById("root")!);
  let reportAim: (aim: OpticalAim) => void = () => {},
    view: OpticalAim | null = null,
    mounts = 0;
  function World() {
    useEffect(() => {
      mounts++;
    }, []);
    return <div>One observed world</div>;
  }
  const sample = (tick: number, id: string) =>
    observeSensors(
      4,
      tick,
      0,
      {
        id,
        kind: "quad",
        identity: "friendly",
        rf: true,
        x: 80,
        z: 500,
        altitude: 30,
      },
      { night: false, fog: 0 },
      undefined,
      { optical_reliability: 1 },
    ).observation;
  const render = async (
    o: {
      scope?: string;
      selected?: string;
      tick?: number;
      enabled?: boolean;
      tactical?: boolean;
      scanEnabled?: boolean;
      observation?: SensorObservation;
      cue?: boolean;
      controlsHost?: HTMLElement | null;
    } = {},
  ) => {
    const tick = o.tick ?? 90,
      selected = o.selected ?? "T1";
    await act(async () =>
      root.render(
        <OpticalStation
          scopeId={o.scope ?? "session:worker1"}
          enabled={o.enabled ?? true}
          tactical={o.tactical ?? false}
          scanEnabled={o.scanEnabled ?? true}
          selected={selected}
          observation={o.observation ?? sample(tick, selected)}
          cue={o.cue === false ? null : { x: 80, z: 500, altitude: 30 }}
          origin={{ x: 0, z: 0, altitude: 2 }}
          tick={tick}
          vision="thermal"
          zoom={1}
          onZoom={() => {}}
          controlsHost={o.controlsHost}
        >
          {(v) => {
            view = v.manualAim;
            reportAim = v.onCameraAim;
            return (
              <div data-scan-surface {...v.scanSurface}>
                <World />
                <canvas aria-label="Observed test world" />
              </div>
            );
          }}
        </OpticalStation>,
      ),
    );
  };
  const click = async (name: string) => {
    const button = [...dom.window.document.querySelectorAll("button")].find(
      (b) => (b.getAttribute("aria-label") ?? b.textContent?.trim()) === name,
    );
    assert.ok(button, name);
    await act(async () => button.click());
  };
  try {
    await render();
    await run({
      document: dom.window.document,
      render,
      click,
      view: () => view,
      mounts: () => mounts,
      reportAim: (aim) => reportAim(aim),
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
test("moving optics into the evidence instrument retains one world, camera aim and captured reports", () =>
  mounted(async (q) => {
    const host = q.document.createElement("div");
    q.document.querySelector("main")!.append(host);
    await q.click("Pan camera right");
    const aim = q.view();
    await q.render({ controlsHost: host });
    assert.ok(host.querySelector(".optical-console"));
    await q.click("Capture A");
    assert.match(q.document.body.textContent!, /Captured 3.00s/);
    await q.render({ controlsHost: null, tick: 150 });
    assert.equal(host.querySelector(".optical-console"), null);
    assert.deepEqual(q.view(), aim);
    assert.match(q.document.body.textContent!, /Captured 3.00s/);
    assert.equal(q.mounts(), 1);
    await q.render({ controlsHost: host, tick: 150 });
    assert.ok(host.querySelector(".optical-console"));
    await q.click("Capture / replace B");
    assert.match(q.document.body.textContent!, /Captured 5.00s/);
    assert.equal(q.mounts(), 1);
  }));
test("manual scan survives contact selection, explicitly reacquires, and preserves one world through phases", () =>
  mounted(async (q) => {
    await q.click("Pan camera right");
    assert.ok(q.view());
    const aim = q.view();
    await q.render({ selected: "T2" });
    assert.deepEqual(q.view(), aim);
    assert.match(q.document.body.textContent!, /MANUAL SCAN/);
    await q.click("Track selected report");
    assert.equal(q.view(), null);
    await q.render({ enabled: false });
    assert.equal(q.document.querySelector(".optical-console"), null);
    assert.equal(q.mounts(), 1);
  }));
test("local capture pins exact sample times while live changes; another contact and session never inherit it", () =>
  mounted(async (q) => {
    await q.click("Capture A");
    assert.match(q.document.body.textContent!, /Captured 3.00s/);
    await q.render({ tick: 150 });
    await q.click("Capture / replace B");
    assert.match(q.document.body.textContent!, /Captured 5.00s/);
    assert.match(q.document.body.textContent!, /2.00s between captures/);
    assert.match(q.document.body.textContent!, /Captured 3.00s/);
    await q.render({ selected: "T2" });
    assert.doesNotMatch(
      q.document.querySelector(".inquiry-grid")!.textContent!,
      /Captured 3.00s/,
    );
    await q.render({ scope: "owner2:worker2" });
    assert.equal(q.document.querySelector(".inquiry-bench"), null);
    assert.equal(q.document.querySelector("[role=status]")?.textContent, "");
    assert.equal(q.view(), null);
  }));
test("tactical view offers the evidence workflow without manual 3D controls", () =>
  mounted(async (q) => {
    await q.click("Tilt camera up");
    assert.ok(q.view());
    await q.render({ tactical: true });
    assert.equal(q.view(), null);
    assert.equal(
      [...q.document.querySelectorAll("button")].some(
        (b) => b.getAttribute("aria-label") === "Pan camera right",
      ),
      false,
    );
    await q.click("Capture A");
    assert.ok(q.document.querySelector(".inquiry-bench"));
  }));
test("a future observation cannot enter the visible notebook", () =>
  mounted(async (q) => {
    const future = observeSensors(
      4,
      120,
      0,
      {
        id: "T1",
        kind: "quad",
        identity: "hostile",
        rf: true,
        x: 0,
        z: 500,
        altitude: 40,
      },
      { night: false, fog: 0 },
    ).observation;
    await q.render({ tick: 90, observation: future });
    await q.click("Capture A");
    assert.match(
      q.document.querySelector("[role=status]")!.textContent!,
      /later than/,
    );
    assert.equal(q.document.querySelector(".inquiry-bench"), null);
  }));

test("entering manual scan uses displayed held bearing, not a vanished report or default sector", () =>
  mounted(async (q) => {
    q.reportAim({ azimuthDeg: 270, elevationDeg: 8 });
    await q.render({ cue: false });
    assert.match(
      q.document.querySelector(".optical-mode")!.textContent!,
      /HOLDING BEARING/,
    );
    await q.click("Pan camera right");
    assert.deepEqual(q.view(), { azimuthDeg: 275, elevationDeg: 8 });
    await q.render({ scope: "different-worker", cue: false });
    await q.click("Pan camera right");
    assert.equal(q.view(), null);
    assert.match(
      q.document.querySelector("[role=status]")!.textContent!,
      /Wait for the local camera/,
    );
  }));
test("pan arrows are scoped to the focused control group; comparison table has accessible structure", () =>
  mounted(async (q) => {
    const button = q.document.querySelector('[aria-label="Pan camera right"]')!;
    await act(async () =>
      button.dispatchEvent(
        new q.document.defaultView!.KeyboardEvent("keydown", {
          key: "ArrowRight",
          shiftKey: true,
          bubbles: true,
        }),
      ),
    );
    assert.ok(q.view());
    await q.click("Capture A");
    const axe = (await import("axe-core")).default;
    const result = await axe.run(q.document.querySelector("main")!, {
      rules: { "color-contrast": { enabled: false } },
    });
    assert.deepEqual(
      result.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
      [],
    );
  }));

test("opening comparison moves focus to its named region; Escape returns to its trigger", () =>
  mounted(async (q) => {
    await q.click("Evidence compare");
    const bench = q.document.querySelector(".inquiry-bench")!;
    assert.ok(
      q.document.activeElement === bench,
      "comparison region should receive focus",
    );
    await act(async () =>
      bench.dispatchEvent(
        new q.document.defaultView!.KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
        }),
      ),
    );
    assert.equal(q.document.querySelector(".inquiry-bench"), null);
    assert.equal(
      q.document.activeElement?.textContent?.trim(),
      "Evidence compare",
    );
  }));

test("scene drag retains one world and cannot survive contact, session or instrument ownership changes", () =>
  mounted(async (q) => {
    const canvas = q.document.querySelector("canvas")!;
    canvas.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 1000,
      bottom: 500,
      width: 1000,
      height: 500,
      toJSON: () => ({}),
    });
    async function pointer(type: string, x: number, y: number) {
      const e = new q.document.defaultView!.MouseEvent(type, {
        bubbles: true,
        clientX: x,
        clientY: y,
        button: 0,
      });
      Object.defineProperty(e, "pointerId", { value: 1 });
      await act(async () => {
        canvas.dispatchEvent(e);
      });
    }
    await pointer("pointerdown", 500, 250);
    await pointer("pointermove", 600, 300);
    assert.ok(q.view());
    const aim = q.view();
    await pointer("pointerup", 600, 300);
    await pointer("pointermove", 700, 300);
    assert.deepEqual(q.view(), aim);
    await pointer("pointerdown", 500, 250);
    await q.render({ selected: "T2" });
    await pointer("pointermove", 900, 400);
    assert.deepEqual(q.view(), aim);
    await pointer("pointerdown", 500, 250);
    await q.render({ selected: "T2", scanEnabled: false });
    await q.render({ selected: "T2" });
    await pointer("pointermove", 900, 400);
    assert.deepEqual(q.view(), aim);
    await q.render({ scope: "another-session" });
    assert.equal(q.view(), null);
    assert.equal(q.mounts(), 1);
  }));
