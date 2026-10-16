import test from "node:test";
import assert from "node:assert/strict";
import { act, type ReactNode } from "react";
import { JSDOM } from "jsdom";
import WorkspaceSearch from "./WorkspaceSearch";

async function mounted(
  node: ReactNode,
  run: (document: Document, window: JSDOM["window"]) => Promise<void>,
) {
  const dom = new JSDOM('<html><body><div id="root"></div></body></html>', {
    url: "http://qa.local/exercises",
  });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    getComputedStyle: dom.window.getComputedStyle,
    Event: dom.window.Event,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      value,
      writable: true,
      configurable: true,
    });
  }
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(dom.window.document.getElementById("root")!);
  try {
    await act(async () => root.render(node));
    await act(async () =>
      dom.window.document.querySelector<HTMLButtonElement>("button")!.click(),
    );
    await run(dom.window.document, dom.window);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, value] of saved) {
      if (value) Object.defineProperty(globalThis, key, value);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
}
async function search(
  document: Document,
  window: JSDOM["window"],
  query: string,
) {
  const input = document.querySelector<HTMLInputElement>(
    'input[type="search"]',
  )!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, query);
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
  return input;
}
async function key(
  window: JSDOM["window"],
  element: Element,
  key: string,
  extra: KeyboardEventInit = {},
) {
  await act(async () =>
    element.dispatchEvent(
      new window.KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
        ...extra,
      }),
    ),
  );
}

test("Enter on one search match uses the existing embedded-workspace callback and href", async () => {
  const destinations: string[] = [];
  await mounted(
    <WorkspaceSearch
      view="drill"
      onNavigate={(event, item) => {
        event.preventDefault();
        destinations.push(item.href);
      }}
    />,
    async (document, window) => {
      const input = await search(document, window, " Unit training overview ");
      assert.equal(document.querySelectorAll("nav a").length, 1);
      await key(window, input, "Enter");
      assert.deepEqual(destinations, ["/?view=unit"]);
      assert.equal(document.querySelector('[role="dialog"]'), null);
    },
  );
});

test("Arrow navigation retains real links and returns to search; ambiguous or composing Enter does not navigate", async () => {
  const destinations: string[] = [];
  await mounted(
    <WorkspaceSearch
      onNavigate={(event, item) => {
        event.preventDefault();
        destinations.push(item.href);
      }}
    />,
    async (document, window) => {
      const input = await search(document, window, "");
      const links = [...document.querySelectorAll<HTMLAnchorElement>("nav a")];
      await key(window, input, "Enter");
      assert.deepEqual(destinations, []);
      await key(window, input, "ArrowDown");
      assert.equal(document.activeElement, links[0]);
      await key(window, links[0], "ArrowDown");
      assert.equal(document.activeElement, links[1]);
      await key(window, links[1], "ArrowUp");
      assert.equal(document.activeElement, links[0]);
      await key(window, links[0], "ArrowUp");
      assert.equal(document.activeElement, input);
      await search(document, window, "analytics");
      await key(window, input, "Enter", { isComposing: true });
      await key(window, input, "Enter", { ctrlKey: true });
      assert.deepEqual(destinations, []);
      await key(window, input, "Enter");
      assert.deepEqual(destinations, ["/analytics"]);
    },
  );
});
