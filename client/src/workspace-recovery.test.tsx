import test from "node:test";
import assert from "node:assert/strict";
import React, { act, lazy, Suspense } from "react";
import { JSDOM } from "jsdom";
import WorkspaceSearch from "./WorkspaceSearch";
import Navigation from "./Navigation";
import { RendererBoundary } from "./LazyScene";
async function run(
  body: (
    document: Document,
    render: (node: React.ReactNode) => Promise<void>,
  ) => Promise<void>,
) {
  const dom = new JSDOM(
    '<!doctype html><body><div id="app"></div><button id="outside">Outside</button></body>',
    { url: "http://localhost/" },
  );
  const names = [
    "window",
    "document",
    "HTMLElement",
    "HTMLInputElement",
    "getComputedStyle",
    "IS_REACT_ACT_ENVIRONMENT",
  ];
  const saved = new Map(
    names.map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]),
  );
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    getComputedStyle: dom.window.getComputedStyle,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(dom.window.document.getElementById("app")!, {
    onCaughtError: () => {},
  });
  const render = async (node: React.ReactNode) => {
    await act(async () => root.render(node));
  };
  try {
    await body(dom.window.document, render);
  } finally {
    await act(async () => root.unmount());
    for (const [k, v] of saved) {
      if (v) Object.defineProperty(globalThis, k, v);
      else delete (globalThis as any)[k];
    }
    dom.window.close();
  }
}
const key = async (d: Document, k: string, ctrl = false) =>
  act(async () =>
    (d.activeElement ?? d).dispatchEvent(
      new d.defaultView!.KeyboardEvent("keydown", {
        key: k,
        ctrlKey: ctrl,
        bubbles: true,
      }),
    ),
  );
test("rejected lazy renderer preserves reachable and functional tactical fallback", () =>
  run(async (d, render) => {
    const Rejected = lazy(() => Promise.reject(new Error("Missing 3D chunk")));
    let fallback = 0;
    await render(
      <RendererBoundary
        fallback={<button onClick={() => fallback++}>Use tactical view</button>}
      >
        <Suspense fallback={<p>Loading renderer</p>}>
          <Rejected />
        </Suspense>
      </RendererBoundary>,
    );
    const button = d.querySelector("button")!;
    assert.equal(button.textContent, "Use tactical view");
    await act(async () => button.click());
    assert.equal(fallback, 1);
    assert.ok(!d.body.textContent?.includes("Loading renderer"));
  }));
test("workspace search is outside a hidden sidebar and opens with search focus", () =>
  run(async (d, render) => {
    await render(
      <aside style={{ visibility: "hidden", transform: "translateX(-100%)" }}>
        <WorkspaceSearch />
      </aside>,
    );
    await key(d, "k", true);
    const dialog = d.querySelector("[role=dialog]")!;
    assert.ok(dialog);
    assert.equal(dialog.closest("aside"), null);
    assert.equal(d.activeElement?.getAttribute("type"), "search");
    assert.equal(d.getElementById("app")?.hasAttribute("inert"), true);
    await key(d, "Escape");
    assert.equal(d.querySelector("[role=dialog]"), null);
    assert.equal(d.getElementById("app")?.hasAttribute("inert"), false);
  }));
test("guide retains exclusive modal focus when workspace shortcut is pressed", () =>
  run(async (d, render) => {
    await render(<Navigation />);
    const guide = [...d.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Operator guide"),
    )!;
    await act(async () => guide.click());
    assert.equal(d.querySelectorAll("[aria-modal=true]").length, 1);
    await key(d, "k", true);
    assert.equal(d.querySelectorAll("[aria-modal=true]").length, 1);
    assert.equal(d.querySelector(".workspace-search-dialog"), null);
    assert.ok(d.activeElement?.closest(".guide-modal"));
    await key(d, "Escape");
    assert.equal(d.querySelector("[aria-modal=true]"), null);
  }));
test("mobile drawer search closes the drawer before transferring modal ownership", () =>
  run(async (d, render) => {
    await render(<Navigation />);
    await act(async () =>
      d.querySelector<HTMLButtonElement>('[aria-label="Workspaces"]')!.click(),
    );
    assert.equal(d.querySelectorAll("[aria-modal=true]").length, 1);
    await act(async () =>
      d.querySelector<HTMLButtonElement>(".workspace-search-button")!.click(),
    );
    assert.equal(d.querySelectorAll("[aria-modal=true]").length, 1);
    assert.ok(d.querySelector(".workspace-search-dialog"));
    assert.equal(d.querySelector(".navigation-open"), null);
    assert.equal(d.activeElement?.getAttribute("type"), "search");
    await key(d, "Escape");
    assert.equal(d.querySelector("[aria-modal=true]"), null);
  }));
