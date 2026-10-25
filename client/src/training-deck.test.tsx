import test from "node:test";
import assert from "node:assert/strict";
import React, { act, useEffect } from "react";
import { JSDOM } from "jsdom";
import { TrainingDeck } from "./TrainingDeck";

async function mounted(
  run: (qa: {
    document: Document;
    render: (live: boolean, accept?: boolean) => Promise<void>;
    click: (label: string) => Promise<void>;
    suspends: () => number;
    mounts: () => number;
  }) => Promise<void>,
) {
  const dom = new JSDOM(
      '<!doctype html><html lang="en"><title>Training station</title><body><nav><a href="/">Training</a></nav><main><div id="root"></div></main></body></html>',
      { url: "http://qa.local/" },
    ),
    saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [k, v] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    getComputedStyle: dom.window.getComputedStyle,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    saved.set(k, Object.getOwnPropertyDescriptor(globalThis, k));
    Object.defineProperty(globalThis, k, {
      configurable: true,
      value: v,
      writable: true,
    });
  }
  const { createRoot } = await import("react-dom/client"),
    root = createRoot(dom.window.document.getElementById("root")!);
  let suspends = 0,
    mounts = 0;
  function World() {
    useEffect(() => {
      mounts++;
    }, []);
    return <div data-world="true">Observed world</div>;
  }
  const render = async (live: boolean, accept = true) => {
    await act(async () =>
      root.render(
        <TrainingDeck
          mission={<p>Frozen exercise</p>}
          setup={
            <label>
              Director seed
              <input defaultValue="7" />
            </label>
          }
          live={live}
          onSuspend={() => {
            suspends++;
            return accept;
          }}
        >
          <World />
        </TrainingDeck>,
      ),
    );
  };
  const click = async (label: string) => {
    const b = [...dom.window.document.querySelectorAll("button")].find(
      (b) => (b.getAttribute("aria-label") ?? b.textContent?.trim()) === label,
    );
    assert.ok(b, label);
    await act(async () => {
      b.focus();
      b.click();
    });
  };
  try {
    await render(false);
    await run({
      document: dom.window.document,
      render,
      click,
      suspends: () => suspends,
      mounts: () => mounts,
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
test("mission controls isolate focus, close with Escape, and retain one mounted world across phases", () =>
  mounted(async (q) => {
    await q.click("Mission controls");
    assert.equal(q.document.querySelectorAll("[role=dialog]").length, 1);
    assert.ok(q.document.querySelector("nav")?.hasAttribute("inert"));
    assert.equal(
      q.document.activeElement?.getAttribute("aria-label"),
      "Close mission controls",
    );
    const axe = await import("axe-core");
    const audit = await axe.default.run(
      q.document.querySelector('[role="dialog"]')!,
      { rules: { "color-contrast": { enabled: false } } },
    );
    assert.deepEqual(
      audit.violations.map((v) => v.id),
      [],
    );
    await act(async () =>
      q.document.dispatchEvent(
        new q.document.defaultView!.KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
        }),
      ),
    );
    assert.equal(q.document.querySelector("[role=dialog]"), null);
    assert.equal(
      q.document.activeElement?.textContent?.trim(),
      "Mission controls",
    );
    await q.render(true);
    await q.render(false);
    assert.equal(q.mounts(), 1);
    assert.equal(q.suspends(), 0);
  }));
test("an uninitialized exercise cannot be hidden by an unacknowledged pause request", () =>
  mounted(async (q) => {
    await q.render(true, false);
    await q.click("Mission controls");
    assert.equal(q.suspends(), 1);
    assert.equal(q.document.querySelector("[role=dialog]"), null);
    assert.match(
      q.document.body.textContent ?? "",
      /unavailable while the exercise initializes/,
    );
  }));
test("instructor resume closes paused mission controls without overriding the command", () =>
  mounted(async (q) => {
    await q.render(true);
    await q.click("Mission controls");
    assert.equal(q.suspends(), 1);
    assert.match(q.document.body.textContent ?? "", /Pause requested/);
    await q.render(false);
    assert.match(
      q.document.querySelector("[role=dialog]")?.textContent ?? "",
      /Exercise paused/,
    );
    await q.render(true);
    assert.equal(q.document.querySelector("[role=dialog]"), null);
    assert.match(q.document.body.textContent ?? "", /Exercise resumed/);
    assert.equal(q.suspends(), 1);
  }));
