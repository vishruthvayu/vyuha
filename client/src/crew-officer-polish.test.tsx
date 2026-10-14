import test from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { JSDOM } from "jsdom";
import { renderToStaticMarkup } from "react-dom/server";
import Crew, { CrewCoordination } from "./Crew";
import OfficerGate from "./OfficerGate";

test("Crew role entry is a named keyboard-submittable form, with officer setup separate and collapsed", () => {
  const dom = new JSDOM(renderToStaticMarkup(<Crew />));
  const form = dom.window.document.querySelector(
    'form[aria-label="Connect assigned crew role"]',
  )!;
  assert.ok(form);
  assert.equal(form.querySelectorAll("label input").length, 2);
  assert.ok(form.querySelector('input[type="password"][required]'));
  assert.equal(
    form.querySelector("button")!.getAttribute("type"),
    null,
    "Native submit behavior supports Enter without extra key handlers",
  );
  const officer = dom.window.document.querySelector(
    "details.crew-officer-workspace",
  )!;
  assert.equal(officer.hasAttribute("open"), false);
  assert.equal(dom.window.document.querySelectorAll("main").length, 1);
  dom.window.close();
});

test("Crew coordination overflow is keyboard focusable and labelled without intercepting navigation keys", () => {
  const metrics = {
    accepted_actions: 1,
    attributed_actions: 1,
    unattributed_actions: 0,
    contacts_with_actions: 1,
    members: [
      {
        member_id: "m",
        callsign: "WATCH",
        role: "spotter",
        accepted_actions: 1,
        designations: 1,
        classifications: 0,
        responses: 0,
      },
    ],
    median_designation_to_classification_s: null,
    median_classification_to_response_s: null,
    timing_basis: "Logical ticks",
    interpretation: "Shared evidence only",
  };
  const dom = new JSDOM(
    renderToStaticMarkup(<CrewCoordination metrics={metrics} />),
  );
  const region =
    dom.window.document.querySelector<HTMLElement>('[role="region"]')!;
  assert.equal(region.tabIndex, 0);
  assert.equal(
    region.getAttribute("aria-label"),
    "Shared coordination by member and role",
  );
  region.focus();
  assert.equal(dom.window.document.activeElement, region);
  const arrow = new dom.window.KeyboardEvent("keydown", {
    key: "ArrowRight",
    bubbles: true,
    cancelable: true,
  });
  const tab = new dom.window.KeyboardEvent("keydown", {
    key: "Tab",
    bubbles: true,
    cancelable: true,
  });
  region.dispatchEvent(arrow);
  region.dispatchEvent(tab);
  assert.equal(arrow.defaultPrevented, false);
  assert.equal(tab.defaultPrevented, false);
  assert.match(region.textContent!, /WATCH · spotter/);
  dom.window.close();
});

test("Embedded officer sign-in preserves a single main landmark and exposes rejected authentication accessibly", async () => {
  const dom = new JSDOM(
    '<html><body><main><div id="root"></div></main></body></html>',
    { url: "http://qa.local/crew" },
  );
  const globals = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    localStorage: dom.window.localStorage,
    sessionStorage: dom.window.sessionStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async (input: unknown) =>
      String(input).endsWith("/auth/session")
        ? new Response(
            JSON.stringify({ authenticated: false, configured: true }),
          )
        : new Response(
            JSON.stringify({ detail: "Officer password rejected" }),
            { status: 401 },
          ),
  };
  const saved = new Map(
    Object.keys(globals).map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(globalThis, key, {
      value,
      configurable: true,
      writable: true,
    });
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(dom.window.document.getElementById("root")!);
  try {
    await act(async () =>
      root.render(
        <OfficerGate embedded>
          <p data-protected>Private roster</p>
        </OfficerGate>,
      ),
    );
    const doc = dom.window.document;
    assert.equal(doc.querySelectorAll("main").length, 1);
    assert.equal(doc.querySelector("[data-protected]"), null);
    const input = doc.querySelector<HTMLInputElement>(
      'input[type="password"]',
    )!;
    assert.equal(input.autocomplete, "current-password");
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        dom.window.HTMLInputElement.prototype,
        "value",
      )!.set!.call(input, "rejected-synthetic-only");
      input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });
    await act(async () =>
      doc
        .querySelector("form")!
        .dispatchEvent(
          new dom.window.Event("submit", { bubbles: true, cancelable: true }),
        ),
    );
    assert.equal(doc.querySelector("[data-protected]"), null);
    assert.equal(input.getAttribute("aria-invalid"), "true");
    assert.equal(input.getAttribute("aria-describedby"), "officer-login-error");
    assert.match(
      doc.querySelector('[role="alert"]')!.textContent!,
      /Officer password rejected/,
    );
    assert.equal(
      input.disabled,
      false,
      "Rejected login can be corrected without reload",
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
