import test from "node:test";
import assert from "node:assert/strict";
import { act } from "react";
import { JSDOM } from "jsdom";
import WorkspaceBoundary from "./WorkspaceBoundary";

test("A page crash preserves surrounding navigation and offers recovery without clearing queued data", async () => {
  const dom = new JSDOM('<html><body><div id="root"></div></body></html>', {
    url: "http://qa.local/analytics",
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
  dom.window.localStorage.setItem(
    "queued-training-evidence",
    "synthetic-pending",
  );
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(dom.window.document.getElementById("root")!);
  const original = console.error;
  console.error = () => {};
  function BrokenPage(): never {
    throw new Error("Synthetic chunk failure");
  }
  try {
    await act(async () =>
      root.render(
        <>
          <nav aria-label="Workspace directory">
            <a href="/analytics">Analytics</a>
          </nav>
          <WorkspaceBoundary>
            <BrokenPage />
          </WorkspaceBoundary>
        </>,
      ),
    );
    assert.ok(dom.window.document.querySelector('nav a[href="/analytics"]'));
    assert.match(
      dom.window.document.querySelector('[role="alert"]')!.textContent!,
      /reload this workspace/,
    );
    assert.equal(
      dom.window.document.querySelector("button")!.textContent,
      "Reload workspace",
    );
    assert.equal(
      dom.window.localStorage.getItem("queued-training-evidence"),
      "synthetic-pending",
    );
    assert.ok(
      !dom.window.document.body.textContent!.includes(
        "Synthetic chunk failure",
      ),
      "Internal stack is not shown as recovery guidance",
    );
  } finally {
    await act(async () => root.unmount());
    console.error = original;
    dom.window.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
