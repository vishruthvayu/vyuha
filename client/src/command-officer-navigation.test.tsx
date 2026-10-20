import test from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { JSDOM } from "jsdom";
import OfficerGate from "./OfficerGate";
import Navigation from "./Navigation";

test("Officer fallback navigation remains available before sign-in while protected children and duplicate navigation remain absent", async () => {
  const dom = new JSDOM('<html><body><div id="root"></div></body></html>', {
    url: "http://qa.local/?session=synthetic&review=officer",
  });
  let authenticated = false;
  let resolveSession: (response: Response) => void = () => {};
  const globals = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    Event: dom.window.Event,
    localStorage: dom.window.localStorage,
    sessionStorage: dom.window.sessionStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async (input: unknown) => {
      const url = String(input);
      if (url.endsWith("/auth/login")) {
        authenticated = true;
        return new Response(JSON.stringify({ token: "synthetic-test-token" }));
      }
      if (url.endsWith("/auth/logout")) {
        authenticated = false;
        return new Response("{}");
      }
      if (url.endsWith("/auth/session"))
        return authenticated
          ? new Response(
              JSON.stringify({ authenticated: true, configured: true }),
            )
          : new Promise<Response>((resolve) => {
              resolveSession = resolve;
            });
      throw new Error("Unexpected request " + url);
    },
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
      writable: true,
      configurable: true,
    });
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(dom.window.document.getElementById("root")!);
  const contents = (
    <>
      <Navigation />
      <p data-protected-evidence>Protected actual review</p>
    </>
  );
  try {
    await act(async () =>
      root.render(
        <OfficerGate fallbackNavigation={<Navigation />}>
          {contents}
        </OfficerGate>,
      ),
    );
    assert.match(
      dom.window.document.body.textContent!,
      /Checking officer session/,
    );
    assert.equal(
      dom.window.document.querySelector("[data-protected-evidence]"),
      null,
    );
    assert.equal(
      dom.window.document.querySelectorAll(".mission-navigation").length,
      1,
    );
    await act(async () =>
      resolveSession(
        new Response(
          JSON.stringify({ authenticated: false, configured: true }),
        ),
      ),
    );
    assert.match(dom.window.document.body.textContent!, /Officer sign-in/);
    assert.equal(
      dom.window.document.querySelector("[data-protected-evidence]"),
      null,
    );
    assert.equal(
      dom.window.document.querySelectorAll(".mission-navigation").length,
      1,
    );
    await act(async () => {
      const input = dom.window.document.querySelector<HTMLInputElement>(
        'input[type="password"]',
      )!;
      Object.getOwnPropertyDescriptor(
        dom.window.HTMLInputElement.prototype,
        "value",
      )!.set!.call(input, "synthetic-only");
      input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });
    await act(async () =>
      dom.window.document
        .querySelector("form")!
        .dispatchEvent(
          new dom.window.Event("submit", { bubbles: true, cancelable: true }),
        ),
    );
    assert.ok(dom.window.document.querySelector("[data-protected-evidence]"));
    assert.equal(
      dom.window.document.querySelectorAll(".mission-navigation").length,
      1,
      "Authenticated review has only its own navigation; fallback is removed",
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
