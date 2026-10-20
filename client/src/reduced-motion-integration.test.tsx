import test from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";
function Probe() {
  return <output>{String(usePrefersReducedMotion())}</output>;
}
test("Renderer motion preference is SSR-safe without browser APIs", () => {
  assert.match(renderToStaticMarkup(<Probe />), />false</);
});
test("Renderer observes dynamic OS reduced-motion preference and cleans up its subscription", async () => {
  const dom = new JSDOM('<div id="root"></div>');
  const saved = new Map<string, PropertyDescriptor | undefined>();
  const listeners = new Set<() => void>();
  const media = {
    matches: true,
    addEventListener: (_name: string, listener: () => void) =>
      listeners.add(listener),
    removeEventListener: (_name: string, listener: () => void) =>
      listeners.delete(listener),
  };
  Object.defineProperty(dom.window, "matchMedia", {
    value: () => media,
    configurable: true,
  });
  for (const [name, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
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
  try {
    await act(async () => root.render(<Probe />));
    assert.equal(
      dom.window.document.querySelector("output")!.textContent,
      "true",
    );
    await act(async () => {
      media.matches = false;
      listeners.forEach((fn) => fn());
    });
    assert.equal(
      dom.window.document.querySelector("output")!.textContent,
      "false",
    );
    await act(async () => {
      media.matches = true;
      listeners.forEach((fn) => fn());
    });
    assert.equal(
      dom.window.document.querySelector("output")!.textContent,
      "true",
    );
  } finally {
    await act(async () => root.unmount());
    assert.equal(listeners.size, 0);
    dom.window.close();
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
});
