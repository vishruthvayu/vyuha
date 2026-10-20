import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import Crew from "./Crew";
import type { CrewState } from "./Crew";
async function run(
  status: 200 | 422,
  body: (
    document: Document,
    actions: () => number,
    release: () => void,
    fill: (label: string, value: string) => Promise<void>,
  ) => Promise<void>,
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
  const role = "spotter" as "spotter" | "responder";
  let calls = 0;
  let releaseAction: () => void = () => {};
  const requests: string[] = [];
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
        designatable: true,
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
      await new Promise<void>((resolve) => {
        releaseAction = resolve;
      });
      return new Response(
        JSON.stringify(
          status === 200
            ? { accepted: true }
            : { detail: "Previous role rejection must not leak after leave" },
        ),
        { status },
      );
    }
    if (url.endsWith("/state")) {
      const second =
        new Headers(init?.headers).get("X-VYUHA-Crew-Token") ===
        "second-role-code";
      return new Response(
        JSON.stringify(
          second
            ? {
                ...current,
                role: "responder",
                member_id: "second-member",
                contacts: current.contacts.map((t) => ({
                  ...t,
                  designated: 200,
                })),
              }
            : current,
        ),
      );
    }
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
    await body(
      dom.window.document,
      () => calls,
      () => releaseAction(),
      fill,
    );
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
}

for (const status of [200, 422] as const) {
  for (const reconnect of [false, true]) {
    test(`Late ${status === 200 ? "success" : "rejection"} after leaving${reconnect ? " and reconnecting another role" : ""} cannot restore prior role data`, async () =>
      run(status, async (document, actions, release, fill) => {
        const find = (text: string) =>
          [...document.querySelectorAll("button")].find(
            (b) => b.textContent === text,
          );
        await act(async () => find("Designate shared contact")!.click());
        assert.equal(actions(), 1);
        await act(async () => find("Leave role")!.click());
        assert.ok(
          !document.querySelector("select"),
          "Role pane clears after leaving",
        );
        if (reconnect) {
          await fill("Role code", "second-role-code");
          await act(async () => find("Connect role")!.click());
          assert.ok(
            find("Confirm shared classification"),
            "New responder role is connected",
          );
        }
        await act(async () => {
          release();
          await new Promise((r) => setTimeout(r, 10));
        });
        assert.ok(
          !find("Designate shared contact"),
          "Late old spotter completion must not resurrect its pane",
        );
        if (reconnect)
          assert.ok(
            find("Confirm shared classification"),
            "New responder must remain connected",
          );
        else
          assert.ok(
            !document.querySelector("select"),
            "No role pane after leaving",
          );
        assert.ok(
          !document.querySelector('[role="alert"]'),
          "Previous role feedback must not leak",
        );
        assert.equal(actions(), 1, "No hidden action retry");
      }));
  }
}
