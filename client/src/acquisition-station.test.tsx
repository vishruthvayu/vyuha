import { feedbackText } from "./GuidedDecision";
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import AcquisitionStation from "./AcquisitionStation";
import { Simulation } from "./sim-v3";
import { testPython } from "./test-python";
import type { Scenario } from "./types";
const scenario = JSON.parse(
  execFileSync(
    testPython(),
    [
      "-c",
      "import json;from server.acquisition import make_practice;print(json.dumps(make_practice(482913,False)))",
    ],
    { cwd: "..", encoding: "utf8" },
  ),
) as Scenario;
test("real acquisition UI shows pending then released immutable evidence, blocks double submit and keeps contact scope", async () => {
  const dom = new JSDOM('<main id="root"></main>', { url: "http://qa.local" });
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
  const root = createRoot(dom.window.document.getElementById("root")!);
  const sim = new Simulation(scenario);
  for (let i = 0; i < 150; i++) sim.step(true);
  const requests: string[] = [];
  const inspected: string[] = [];
  let receipt: React.ComponentProps<typeof AcquisitionStation>["receipt"] =
    null;
  const render = async (selected = "T1", running = true) =>
    act(async () =>
      root.render(
        <AcquisitionStation
          state={sim.snapshot()}
          selected={selected}
          running={running}
          enabled={true}
          visible={true}
          receipt={receipt}
          brief={{
            title: "Frozen night investigation",
            objectives: ["Reconcile optical and affiliation evidence."],
          }}
          onInspectChannel={(channel) => inspected.push(channel)}
          request={(channel) => {
            requests.push(channel);
            return `ui_request_${requests.length}`;
          }}
        />,
      ),
    );
  const click = async () =>
    act(async () => {
      (
        dom.window.document.querySelector("button") as HTMLButtonElement
      ).click();
    });
  try {
    await render();
    assert.equal(
      dom.window.document
        .querySelector(".acquisition-console")!
        .getAttribute("tabindex"),
      "0",
      "the scrolling instrument remains keyboard reachable while its action buttons are disabled",
    );
    assert.match(
      dom.window.document.body.textContent!,
      /Frozen night investigation/,
    );
    assert.match(dom.window.document.body.textContent!, /RF \/ IFF/);
    await click();
    await click();
    assert.deepEqual(requests, ["eo"]);
    assert.match(dom.window.document.body.textContent!, /Submitting/);
    receipt = {
      status: "rejected",
      action: {
        k: "inspect",
        track: "T1",
        channel: "eo",
        request_id: "ui_request_1",
      },
      reason: "Radar report changed before acceptance",
    };
    await render();
    assert.match(dom.window.document.body.textContent!, /Request rejected/);
    assert.equal(
      (dom.window.document.querySelector("button") as HTMLButtonElement)
        .disabled,
      false,
    );
    await click();
    assert.deepEqual(requests, ["eo", "eo"]);
    assert.match(dom.window.document.body.textContent!, /Submitting/);
    assert.ok(
      sim.act({
        tick: 150,
        order: sim.nextOrder,
        k: "inspect",
        track: "T1",
        channel: "eo",
        request_id: "ui_request_2",
      }),
    );
    await render();
    assert.match(dom.window.document.body.textContent!, /ACQUIRING EO.*T1/s);
    await render("T2");
    assert.match(dom.window.document.body.textContent!, /ACQUIRING EO.*T1/s);
    assert.match(
      dom.window.document.body.textContent!,
      /No released cross-check for this contact/,
    );
    for (let i = 150; i < 186; i++) sim.step(true);
    await render();
    assert.match(dom.window.document.body.textContent!, /RELEASED/);
    assert.match(
      dom.window.document.body.textContent!,
      /sampled 6.00s.*released 6.20s/s,
    );
    assert.doesNotMatch(
      dom.window.document.querySelector(".acquisition-results")!.textContent!,
      /hostile|friendly/,
    );
    assert.equal(
      (
        dom.window.document.querySelector(
          ".flight-inspection-action button",
        ) as HTMLButtonElement
      ).disabled,
      true,
      "an EO publication without detection does not offer live optical geometry",
    );
    for (let i = 186; i < 192; i++) sim.step(true);
    await render();
    await act(async () =>
      (
        dom.window.document.querySelectorAll<HTMLButtonElement>(
          ".acquisition-channel-actions button",
        )[1] as HTMLButtonElement
      ).click(),
    );
    assert.deepEqual(requests, ["eo", "eo", "ir"]);
    assert.ok(
      sim.act({
        tick: 192,
        order: sim.nextOrder,
        k: "inspect",
        track: "T1",
        channel: "ir",
        request_id: "ui_request_3",
      }),
    );
    for (let i = 192; i < 228; i++) sim.step(true);
    await render("T1", false);
    const inspectButton = dom.window.document.querySelector(
      ".flight-inspection-action button",
    ) as HTMLButtonElement;
    assert.equal(
      inspectButton.disabled,
      false,
      "inspection changes display only and remains usable while paused",
    );
    const evidenceBefore = JSON.stringify(sim.snapshot());
    await act(async () => inspectButton.click());
    assert.deepEqual(inspected, ["ir"]);
    assert.equal(JSON.stringify(sim.snapshot()), evidenceBefore);
    const sampleButtons =
      dom.window.document.querySelectorAll<HTMLButtonElement>(
        ".flight-result-selector button",
      );
    assert.equal(sampleButtons.length, 2);
    await act(async () => (sampleButtons[1] as HTMLButtonElement).click());
    assert.match(
      dom.window.document.querySelector(".acquisition-results article")!
        .textContent!,
      /EO \/ T1/,
    );
    assert.equal(
      (
        dom.window.document.querySelector(
          ".flight-inspection-action button",
        ) as HTMLButtonElement
      ).disabled,
      true,
    );
    assert.deepEqual(
      inspected,
      ["ir"],
      "selecting stored evidence never changes the camera channel automatically",
    );
    await act(async () =>
      (
        dom.window.document.querySelectorAll<HTMLButtonElement>(
          ".flight-result-selector button",
        )[0] as HTMLButtonElement
      ).click(),
    );
    assert.match(
      dom.window.document.querySelector(".acquisition-results article")!
        .textContent!,
      /IR \/ T1/,
    );
    assert.equal(JSON.stringify(sim.snapshot()), evidenceBefore);
    const focusButton = dom.window.document.querySelector(
      ".flight-deck-toggle",
    ) as HTMLButtonElement;
    await act(async () => focusButton.click());
    assert.equal(
      dom.window.document
        .querySelector(".flight-evidence-deck")!
        .getAttribute("data-expanded"),
      "false",
    );
    assert.match(dom.window.document.body.textContent!, /Published evidence/);
    assert.deepEqual(
      requests,
      ["eo", "eo", "ir"],
      "focus and channel inspection do not submit another request",
    );
    for (let i = 228; i < 318; i++) sim.step(true);
    await render();
    assert.match(dom.window.document.body.textContent!, /EXPIRED/);
    assert.equal(
      (
        dom.window.document.querySelector(
          ".flight-inspection-action button",
        ) as HTMLButtonElement
      ).disabled,
      true,
      "expired samples cannot return live geometry",
    );
    await render("T1", false);
    assert.ok(
      [
        ...dom.window.document.querySelectorAll<HTMLButtonElement>(
          ".acquisition-channel-actions button",
        ),
      ].every((b) => b.disabled),
    );
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test("an acquisition acknowledgment is labelled as observation intent, not an effector response", () => {
  assert.match(
    feedbackText({
      seq: 1,
      action: { k: "inspect", track: "T1", channel: "ir", request_id: "label" },
      status: "accepted",
      tick: 150,
    }),
    /Request IR observation of T1: accepted/,
  );
});
