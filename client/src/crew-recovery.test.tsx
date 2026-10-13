import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { act } from "react";
import Crew from "./Crew";
import type { CrewState } from "./Crew";
async function run(
  role: "spotter" | "responder",
  body: (document: Document, actions: () => number) => Promise<void>,
) {
  const dom = new JSDOM(
    '<html><head></head><body><div id="root"></div></body></html>',
    { url: "http://qa.local" },
  );
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [name, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    navigator: dom.window.navigator,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value,
    });
  }
  let calls = 0;
  const requests: string[] = [];
  let stale = false;
  const current = {
    id: "crew",
    name: "QA",
    session_id: "session",
    role,
    member_id: "m",
    tick: 300,
    duration: 60,
    paused: false,
    done: false,
    status: "active",
    contacts: [
      {
        id: "T1",
        position: { x: 1, z: 20, altitude: 10 },
        observation: {
          radar: { state: "confirmed" },
          eo: { level: "detect" },
          ir: { level: "none" },
          rf: { detected: false },
          iff: { cue: "no_reply" },
        },
        designated: role === "responder" ? 200 : null,
        classification: null,
        declared: null,
      },
    ],
    roster: [],
    attribution: [],
    scorecard: null,
    clock_note: "",
    note: "",
  } as unknown as CrewState;
  saved.set("fetch", Object.getOwnPropertyDescriptor(globalThis, "fetch"));
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    requests.push(url);
    if (url.endsWith("/auth/session"))
      return new Response(
        JSON.stringify({ authenticated: false, configured: true }),
      );
    if (url.endsWith("/actions")) {
      calls++;
      stale = true;
      return new Response(
        JSON.stringify({
          detail: "No current sensor observation; no decision was recorded.",
        }),
        { status: 422 },
      );
    }
    if (url.endsWith("/state"))
      return new Response(
        JSON.stringify({ ...current, contacts: stale ? [] : current.contacts }),
      );
    throw new Error("Unnecessary request " + url);
  };
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(dom.window.document.getElementById("root")!);
  const fill = async (label: string, value: string) => {
    const input = [...dom.window.document.querySelectorAll("label")]
      .find((l) => l.textContent?.trim() === label)!
      .querySelector("input")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        dom.window.HTMLInputElement.prototype,
        "value",
      )!.set!.call(input, value);
      input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
      input.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
  };
  try {
    await act(async () => root.render(<Crew />));
    await fill("Crew ID", "crew");
    await fill("Role code", "test-role-code");
    const connect = [...dom.window.document.querySelectorAll("button")].find(
      (b) => b.textContent === "Connect role",
    )!;
    assert.equal(connect.disabled, false);
    await act(async () => connect.click());
    const select = dom.window.document.querySelector("select")!;
    await act(async () => {
      select.value = "T1";
      select.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
    assert.ok(
      !requests.some((u) => u.endsWith("/catalogue")),
      "Participant must not request officer catalogue",
    );
    await body(dom.window.document, () => calls);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
}
test("Crew rejection refreshes picture, disables unavailable action and retains feedback across polling", async () =>
  run("spotter", async (document, actions) => {
    const button = [...document.querySelectorAll("button")].find(
      (b) => b.textContent === "Designate shared contact",
    )!;
    assert.equal(button.disabled, false);
    await act(async () => button.click());
    assert.equal(actions(), 1);
    assert.match(
      document.querySelector('[role="alert"]')!.textContent!,
      /no decision was recorded/,
    );
    assert.ok(button.disabled);
    assert.match(
      document.querySelector("select")!.textContent!,
      /No current observation/,
    );
    await act(async () => new Promise((r) => setTimeout(r, 550)));
    assert.match(
      document.querySelector('[role="alert"]')!.textContent!,
      /no decision was recorded/,
    );
    assert.equal(actions(), 1);
  }));
test("Enabled responder and leave-role buttons have contrasting explicit native-independent colours", async () =>
  run("responder", async (document) => {
    const css = readFileSync(new URL("./style.css", import.meta.url), "utf8");
    const style = document.createElement("style");
    style.textContent = [
      ...css.matchAll(/\.button(?:\.primary|\.subtle)?\{[^}]*\}/g),
    ]
      .map((m) => m[0])
      .join("\n");
    document.head.append(style);
    const luminance = (rgb: string) => {
      const c = rgb
        .match(/\d+/g)!
        .map(Number)
        .map((x) => x / 255)
        .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    for (const name of [
      "Leave role",
      "Confirm shared classification",
      "hold",
      "rf_jam",
      "kinetic",
    ]) {
      const button = [...document.querySelectorAll("button")].find(
        (b) => b.textContent === name,
      )!;
      assert.equal(button.disabled, false, name);
      const s = window.getComputedStyle(button),
        a = luminance(s.color),
        b = luminance(s.backgroundColor);
      assert.ok((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 4.5, name);
    }
  }));
