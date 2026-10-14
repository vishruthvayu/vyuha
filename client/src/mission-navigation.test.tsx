import test from "node:test";
import assert from "node:assert/strict";
import { act, type ReactNode } from "react";
import { JSDOM } from "jsdom";
import Navigation from "./Navigation";
import { navigationItems, type NavigationItem } from "./routes";

async function mounted(
  body: (
    document: Document,
    render: (node: ReactNode) => Promise<void>,
  ) => Promise<void>,
  search = "",
) {
  const dom = new JSDOM(
    '<!doctype html><body><div id="root"></div><main id="workspace-content" tabindex="-1">Synthetic workspace</main></body>',
    { url: `http://qa.local/${search}` },
  );
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [name, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    Event: dom.window.Event,
    navigator: dom.window.navigator,
    getComputedStyle: dom.window.getComputedStyle,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value,
    });
  }
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(dom.window.document.getElementById("root")!);
  const render = async (node: ReactNode) => {
    await act(async () => root.render(node));
  };
  try {
    await body(dom.window.document, render);
  } finally {
    await act(async () => root.unmount());
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
    dom.window.close();
  }
}
const click = async (node: HTMLElement) => {
  await act(async () => node.click());
};
const key = async (document: Document, value: string, ctrl = false) => {
  await act(async () =>
    (document.activeElement ?? document).dispatchEvent(
      new document.defaultView!.KeyboardEvent("keydown", {
        key: value,
        ctrlKey: ctrl,
        bubbles: true,
      }),
    ),
  );
};

test("Command navigation exposes primary tasks without a permanent sidebar and preserves every catalogue destination", async () =>
  mounted(async (document, render) => {
    document.defaultView!.history.replaceState(null, "", "/?mode=adaptive");
    await render(<Navigation view="drill" reviewCount={3} />);
    assert.equal(document.querySelector(".sidebar"), null);
    assert.equal(
      document.querySelectorAll(".mission-primary-navigation a").length,
      5,
    );
    assert.equal(
      document.querySelector('[aria-current="location"]')?.getAttribute("href"),
      "/",
    );
    assert.equal(document.querySelector(".workspace-navigation"), null);
    const toggle = document.querySelector<HTMLButtonElement>(
      '[aria-label="Toggle navigation"]',
    )!;
    toggle.focus();
    await click(toggle);
    const modal = document.querySelector('[role="dialog"]')!;
    assert.equal(
      modal.getAttribute("aria-labelledby"),
      "workspace-catalog-title",
    );
    const links = [
      ...modal.querySelectorAll('nav[aria-label="Main navigation"] a'),
    ];
    assert.equal(links.length, navigationItems.length);
    for (const item of navigationItems)
      assert.ok(
        links.some((link) => link.getAttribute("aria-label") === item.label),
      );
    assert.equal(
      document.querySelector("#workspace-content")?.hasAttribute("inert"),
      true,
    );
    await key(document, "Escape");
    assert.equal(document.querySelector('[role="dialog"]'), null);
    assert.equal(document.activeElement, toggle);
    assert.equal(
      document.querySelector("#workspace-content")?.hasAttribute("inert"),
      false,
    );
  }));

test("Catalogue search and Control K transfer a single modal owner and restore the reachable command toggle", async () =>
  mounted(async (document, render) => {
    await render(<Navigation />);
    assert.equal(
      document.querySelectorAll(".workspace-search-button").length,
      1,
      "Only one search component owns global listeners",
    );
    const toggle = document.querySelector<HTMLButtonElement>(
      '[aria-label="Toggle navigation"]',
    )!;
    toggle.focus();
    await click(toggle);
    await click(
      document.querySelector<HTMLElement>(".catalogue-search-trigger")!,
    );
    assert.equal(document.querySelectorAll('[aria-modal="true"]').length, 1);
    assert.ok(document.activeElement?.closest(".workspace-search-dialog"));
    assert.equal(document.activeElement?.getAttribute("type"), "search");
    assert.equal(document.querySelector(".mission-catalog"), null);
    await key(document, "Escape");
    assert.equal(document.activeElement, toggle);
    await click(toggle);
    await key(document, "k", true);
    assert.equal(document.querySelectorAll('[aria-modal="true"]').length, 1);
    assert.ok(document.querySelector(".workspace-search-dialog"));
    await key(document, "Escape");
    assert.equal(document.activeElement, toggle);
  }));

test("Guide replaces catalogue ownership and blocks search shortcuts until closed", async () =>
  mounted(async (document, render) => {
    await render(<Navigation />);
    const toggle = document.querySelector<HTMLButtonElement>(
      '[aria-label="Toggle navigation"]',
    )!;
    toggle.focus();
    await click(toggle);
    await click(
      document.querySelector<HTMLElement>(
        ".mission-catalog-actions .mission-guide-button",
      )!,
    );
    assert.equal(document.querySelectorAll('[aria-modal="true"]').length, 1);
    assert.ok(document.activeElement?.closest(".guide-modal"));
    await key(document, "k", true);
    assert.equal(document.querySelectorAll('[aria-modal="true"]').length, 1);
    assert.equal(document.querySelector(".workspace-search-dialog"), null);
    await key(document, "Escape");
    assert.equal(document.activeElement, toggle);
  }));

test("Search preserves in-app unit/review transitions and native modified navigation semantics", async () =>
  mounted(async (document, render) => {
    const navigated: NavigationItem[] = [];
    await render(
      <Navigation
        view="drill"
        onWorkspaceNavigate={(item) => navigated.push(item)}
      />,
    );
    await key(document, "k", true);
    const unit = document.querySelector<HTMLAnchorElement>(
      '.workspace-search-dialog a[href="/?view=unit"]',
    )!;
    assert.ok(
      unit,
      "Unit search retains the embedded workspace instead of unloading the simulator",
    );
    await click(unit);
    assert.equal(navigated.at(-1)?.id, "unit");
    assert.equal(document.querySelector(".workspace-search-dialog"), null);
    await key(document, "k", true);
    const review = document.querySelector<HTMLAnchorElement>(
      '.workspace-search-dialog a[href="/?view=aar"]',
    )!;
    let productPrevented: boolean | undefined;
    const preventTestNavigation = (event: Event) => {
      productPrevented = event.defaultPrevented;
      event.preventDefault();
    };
    document.body.addEventListener("click", preventTestNavigation, {
      once: true,
    });
    await act(async () =>
      review.dispatchEvent(
        new document.defaultView!.MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
        }),
      ),
    );
    assert.equal(
      productPrevented,
      false,
      "Modified anchor keeps browser-native new-tab behavior",
    );
    assert.equal(navigated.length, 1);
    assert.equal(document.querySelector(".workspace-search-dialog"), null);
    await key(document, "k", true);
    await click(
      document.querySelector<HTMLAnchorElement>(
        '.workspace-search-dialog a[href="/?view=aar"]',
      )!,
    );
    assert.equal(navigated.at(-1)?.id, "review");
  }));

test("Guided walkthrough releases catalogue focus isolation before its explicit tour event", async () =>
  mounted(async (document, render) => {
    let calls = 0;
    let modalAtDispatch: Element | null = null;
    let inertAtDispatch = true;
    const capture = () => {
      calls++;
      modalAtDispatch = document.querySelector('[aria-modal="true"]');
      inertAtDispatch = document
        .getElementById("workspace-content")!
        .hasAttribute("inert");
    };
    document.defaultView!.addEventListener("vyuha-start-tour", capture);
    await render(<Navigation />);
    const toggle = document.querySelector<HTMLButtonElement>(
      '[aria-label="Toggle navigation"]',
    )!;
    toggle.focus();
    await click(toggle);
    await click(
      document.querySelector<HTMLElement>(".mission-walkthrough-button")!,
    );
    assert.equal(calls, 1);
    assert.equal(modalAtDispatch, null);
    assert.equal(inertAtDispatch, false);
    assert.equal(document.querySelector(".mission-catalog"), null);
    assert.equal(document.activeElement, toggle);
    document.defaultView!.removeEventListener("vyuha-start-tour", capture);
  }));
