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
    for (let i = 186; i < 276; i++) sim.step(true);
    await render();
    assert.match(dom.window.document.body.textContent!, /EXPIRED/);
    await render("T1", false);
    assert.ok(
      [...dom.window.document.querySelectorAll("button")].every(
        (b) => b.disabled,
      ),
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
