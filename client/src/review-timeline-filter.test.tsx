import test from "node:test";
import assert from "node:assert/strict";
import { act } from "react";
import { JSDOM } from "jsdom";
import { TimelineEvents } from "./Ghost";
import type { TimelineItem } from "./types";

// Labelled synthetic timeline: no generated sensor truth or scores.
const events: TimelineItem[] = Array.from({ length: 140 }, (_, i) => ({
  id: `synthetic-${i}`,
  tick: i < 3 ? 30 : i * 30,
  order: i,
  category: i === 0 || i === 2 ? "sensor_transition" : "trainee_action",
  code: i === 0 ? "radar_degraded" : i === 2 ? "radar_restored" : "designate",
  title:
    i === 0
      ? "Radar degraded"
      : i === 2
        ? "Radar restored"
        : `Recorded designation ${i}`,
  track_id: i === 0 ? null : i === 1 || i === 2 ? "T9" : "T1",
  decision_id: null,
  seek_before: i === 1,
}));
async function mounted(
  run: (
    document: Document,
    window: JSDOM["window"],
    chosen: TimelineItem[],
  ) => Promise<void>,
) {
  const dom = new JSDOM('<html><body><div id="root"></div></body></html>', {
    url: "http://qa.local/?view=aar",
  });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      value,
      writable: true,
      configurable: true,
    });
  }
  const before = JSON.stringify(events),
    chosen: TimelineItem[] = [];
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(dom.window.document.getElementById("root")!);
  try {
    await act(async () =>
      root.render(
        <TimelineEvents
          items={events}
          onJump={(event) => chosen.push(event)}
        />,
      ),
    );
    await run(dom.window.document, dom.window, chosen);
    assert.equal(
      JSON.stringify(events),
      before,
      "Investigation must never rewrite recorded evidence",
    );
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, value] of saved) {
      if (value) Object.defineProperty(globalThis, key, value);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
}
async function query(
  document: Document,
  window: JSDOM["window"],
  value: string,
) {
  const input = document.querySelector<HTMLInputElement>(
    'input[type="search"]',
  )!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, value);
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
}

test("Long timelines initially bound rendered events and reveal the unchanged recorded order on demand", async () =>
  mounted(async (document) => {
    assert.equal(document.querySelectorAll(".timeline-item").length, 100);
    assert.match(
      document.querySelector('[role="status"]')!.textContent!,
      /100 of 140 matching/,
    );
    const more = [
      ...document.querySelectorAll<HTMLButtonElement>("button"),
    ].find((button) => button.textContent?.includes("40 more"))!;
    await act(async () => more.click());
    assert.equal(document.querySelectorAll(".timeline-item").length, 140);
    assert.equal(
      document.activeElement,
      document.querySelectorAll(".timeline-item")[100],
      "Load more moves focus to newly revealed evidence",
    );
    assert.equal(document.querySelector(".timeline-load-more"), null);
    assert.deepEqual(
      [...document.querySelectorAll(".timeline-item > .mono")]
        .slice(0, 3)
        .map((item) => item.textContent),
      ["T+1.00s", "T+1.00s", "T+1.00s"],
    );
  }));

test("Contact and category filters intersect, and a replay jump receives the original same-tick boundary", async () =>
  mounted(async (document, window, chosen) => {
    await query(document, window, " t9 ");
    assert.equal(document.querySelectorAll(".timeline-item").length, 2);
    await act(async () => {
      const select = document.querySelector("select")!;
      select.value = "sensor_transition";
      select.dispatchEvent(new window.Event("change", { bubbles: true }));
    });
    assert.equal(document.querySelectorAll(".timeline-item").length, 1);
    await act(async () =>
      document.querySelector<HTMLButtonElement>(".timeline-item")!.click(),
    );
    assert.equal(chosen[0], events[2]);
    assert.equal(chosen[0].tick, 30);
    assert.equal(chosen[0].order, 2);
    assert.equal(chosen[0].seek_before, false);
  }));

test("No-match recovery clears filters and resets the visible batch without inventing an event", async () =>
  mounted(async (document, window) => {
    await query(document, window, "not-recorded-anywhere");
    assert.equal(document.querySelectorAll(".timeline-item").length, 0);
    assert.match(
      document.querySelector(".timeline-empty")!.textContent!,
      /No recorded events match/,
    );
    const clear = [
      ...document.querySelectorAll<HTMLButtonElement>("button"),
    ].find((button) => button.textContent === "Clear timeline filters")!;
    await act(async () => clear.click());
    assert.equal(document.querySelector<HTMLInputElement>("input")!.value, "");
    assert.equal(
      document.activeElement,
      document.querySelector("input"),
      "Clearing a filter returns focus to the search field",
    );
    assert.equal(document.querySelector("select")!.value, "all");
    assert.equal(document.querySelectorAll(".timeline-item").length, 100);
  }));

test("merged searchable timeline retains native visible event labels", async () => {
  await mounted(async (document) => {
    const buttons = [
      ...document.querySelectorAll<HTMLButtonElement>("button.timeline-item"),
    ];
    assert.equal(buttons.length, 100);
    for (const button of buttons) {
      assert.equal(
        button.hasAttribute("aria-label"),
        false,
        "Do not override category, time or contact text",
      );
      assert.ok(button.querySelector(".mono")?.textContent);
      assert.ok(button.querySelector("small")?.textContent);
      assert.equal(
        button.querySelector("svg")?.getAttribute("aria-hidden"),
        "true",
      );
    }
  });
});
