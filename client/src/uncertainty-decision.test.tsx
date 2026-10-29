import test from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { JSDOM } from "jsdom";
import { createRoot } from "react-dom/client";
import UncertaintyDecision from "./UncertaintyDecision";
import { ActionEvidenceLedger } from "./action-evidence";
import type { ActionFeedback, DecisionAction } from "./GuidedDecision";
test("Defer requires an explicit reason, owns its receipt, blocks duplicate clicks and resets on contact/session replacement", async () => {
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
      writable: true,
      configurable: true,
    });
  }
  const root = createRoot(dom.window.document.getElementById("root")!);
  let receipt: ActionFeedback | null = null;
  const actions: DecisionAction[] = [];
  const render = async (key = "session-A:T1", track = "T1", enabled = true) =>
    act(async () =>
      root.render(
        <UncertaintyDecision
          key={key}
          track={track}
          enabled={enabled}
          feedback={receipt}
          onAct={(a) => {
            actions.push(a);
            return 7;
          }}
        />,
      ),
    );
  const button = () => dom.window.document.querySelector("button")!;
  try {
    await render();
    assert.equal(dom.window.document.querySelector("details")!.open, false);
    await act(async () =>
      dom.window.document.querySelector("summary")!.click(),
    );
    assert.equal(dom.window.document.querySelector("details")!.open, true);
    const summary = dom.window.document.querySelector("summary")!;
    const reasonControl = dom.window.document.querySelector("select")!;
    reasonControl.focus();
    await act(async () =>
      reasonControl.dispatchEvent(
        new dom.window.KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
        }),
      ),
    );
    assert.equal(dom.window.document.querySelector("details")!.open, false);
    assert.equal(dom.window.document.activeElement, summary);
    await act(async () => summary.click());
    assert.equal(dom.window.document.querySelector("details")!.open, true);
    assert.ok(button().disabled);
    assert.equal(dom.window.document.querySelector("select")!.value, "");
    const select = dom.window.document.querySelector("select")!;
    await act(async () => {
      select.value = "affiliation_unresolved";
      select.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
    await act(async () => {
      button().click();
      button().click();
    });
    assert.equal(actions.length, 1);
    assert.ok(button().disabled);
    assert.deepEqual(actions[0], {
      k: "defer",
      track: "T1",
      decision_version: "uncertainty-decisions-v1",
      reason: "affiliation_unresolved",
    });
    receipt = {
      seq: 7,
      status: "accepted",
      tick: 150,
      action: { ...actions[0], reason: "type_unresolved" },
    };
    await render();
    assert.ok(
      button().disabled,
      "mismatched reason cannot consume the pending receipt",
    );
    receipt = { seq: 7, status: "accepted", tick: 150, action: actions[0] };
    await render();
    assert.match(
      dom.window.document.body.textContent!,
      /Defer recorded at T\+5.00s/,
    );
    assert.equal(button().disabled, false);
    await render("session-A:T2", "T2");
    assert.equal(dom.window.document.querySelector("select")!.value, "");
    assert.ok(button().disabled);
    assert.doesNotMatch(
      dom.window.document.body.textContent!,
      /Defer recorded at/,
    );
    await render("session-B:T1");
    assert.equal(dom.window.document.querySelector("select")!.value, "");
    assert.ok(button().disabled);
    assert.equal(
      dom.window.document.querySelector("details")!.open,
      false,
      "new contact/session closes the disclosure and carries no previous answer",
    );
    await act(async () =>
      dom.window.document.querySelector("summary")!.click(),
    );
    const { default: axe } = await import("axe-core");
    const result = await axe.run(dom.window.document.querySelector("main")!, {
      rules: { "color-contrast": { enabled: false } },
    });
    assert.deepEqual(
      result.violations.map((v) => v.id),
      [],
    );
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, d] of saved)
      if (d) Object.defineProperty(globalThis, key, d);
      else Reflect.deleteProperty(globalThis, key);
  }
});
test("pending evidence ledger never accepts a Defer acknowledgment carrying another declared reason or contract", () => {
  const ledger = new ActionEvidenceLedger();
  const payload = {
    k: "defer" as const,
    track: "T1",
    decision_version: "uncertainty-decisions-v1" as const,
    reason: "affiliation_unresolved" as const,
  };
  ledger.capture("scope", 4, payload, null, null);
  assert.equal(
    ledger.take("scope", 4, {
      ...payload,
      tick: 150,
      reason: "type_unresolved",
    }),
    undefined,
  );
  assert.equal(ledger.size, 1);
  assert.equal(
    ledger.take("old-scope", 4, { ...payload, tick: 150 }),
    undefined,
  );
  assert.equal(
    ledger.take("scope", 4, { ...payload, tick: 150 })?.action.reason,
    "affiliation_unresolved",
  );
  assert.equal(ledger.size, 0);
});
