import test from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { JSDOM } from "jsdom";
import CrewOfficerTools from "./CrewOfficerTools";
test("Officer can rediscover a crew after remount and rotate a lost code without persisting secrets", async () => {
  const dom = new JSDOM('<div id="root"></div>', {
    url: "http://qa.local/crew",
  });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  const requests: string[] = [];
  for (const [name, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    sessionStorage: dom.window.sessionStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async (input: unknown) => {
      const path = String(input);
      requests.push(path);
      if (path.endsWith("/manage?limit=20"))
        return new Response(
          JSON.stringify({
            crews: [
              {
                id: "C1",
                name: "Recovered QA",
                status: "active",
                created_at: "fixture",
              },
            ],
          }),
        );
      if (path.endsWith("/members"))
        return new Response(
          JSON.stringify({
            id: "C1",
            name: "Recovered QA",
            status: "active",
            members: [
              {
                member_id: "M1",
                callsign: "WATCH",
                role: "spotter",
                status: "active",
                expires_at: 2000000000,
                revoked_at: null,
              },
            ],
          }),
        );
      if (path.endsWith("/rotate"))
        return new Response(
          JSON.stringify({ member_id: "M1", code: "synthetic-rotated-once" }),
        );
      throw new Error("Unexpected " + path);
    },
  })) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, {
      value,
      writable: true,
      configurable: true,
    });
  }
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(dom.window.document.getElementById("root")!);
  const click = async (name: string) => {
    const b = [...dom.window.document.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === name,
    )!;
    assert.ok(b, name);
    await act(async () => b.click());
  };
  try {
    await act(async () =>
      root.render(<CrewOfficerTools key="first" createdId="" />),
    );
    await click("Find existing crews");
    await click("Manage Recovered QA · active · fixture");
    await click("Rotate WATCH code");
    assert.match(
      dom.window.document.body.textContent!,
      /synthetic-rotated-once/,
    );
    assert.equal(localStorage.length, 0);
    assert.equal(sessionStorage.length, 0);
    await act(async () =>
      root.render(<CrewOfficerTools key="reload" createdId="" />),
    );
    assert.doesNotMatch(
      dom.window.document.body.textContent!,
      /synthetic-rotated-once/,
    );
    await click("Find existing crews");
    await click("Manage Recovered QA · active · fixture");
    assert.match(dom.window.document.body.textContent!, /WATCH · spotter/);
    assert.equal(requests.filter((p) => p.endsWith("/rotate")).length, 1);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
});
