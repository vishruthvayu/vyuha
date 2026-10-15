import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { DecisionWorkspace } from "./DecisionWorkspace";

function withDom(body: (document: Document) => Promise<void> | void) {
  return async () => {
    const dom = new JSDOM('<!doctype html><div id="root"></div>', {
      url: "http://qa.local",
    });
    const keys = ["window", "document", "IS_REACT_ACT_ENVIRONMENT"] as const;
    const saved = keys.map((k) =>
      Object.getOwnPropertyDescriptor(globalThis, k),
    );
    Object.assign(globalThis, {
      window: dom.window,
      document: dom.window.document,
      IS_REACT_ACT_ENVIRONMENT: true,
    });
    try {
      await body(dom.window.document);
    } finally {
      keys.forEach((k, i) => {
        if (saved[i]) Object.defineProperty(globalThis, k, saved[i]!);
        else delete (globalThis as Record<string, unknown>)[k];
      });
      dom.window.close();
    }
  };
}

test(
  "decision dock and contact evidence are separate labelled regions",
  withDom(async (document) => {
    const root = createRoot(document.getElementById("root")!);
    await act(async () =>
      root.render(
        <DecisionWorkspace evidence={<p>RF evidence</p>}>
          <button>Designate</button>
        </DecisionWorkspace>,
      ),
    );
    const dock = document.querySelector("section.decision-workspace")!;
    const evidence = document.querySelector("aside.decision-evidence")!;
    assert.ok(dock && evidence, "both regions render");
    assert.equal(
      dock.getAttribute("aria-label"),
      "Decisions for the selected contact",
    );
    assert.equal(
      evidence.getAttribute("aria-label"),
      "Evidence for the selected contact",
    );
    assert.equal(
      dock.getAttribute("tabindex"),
      "-1",
      "dock is a programmatic focus target",
    );
    assert.ok(dock.textContent!.includes("Designate"));
    assert.ok(
      !dock.contains(evidence),
      "evidence is not nested inside the dock",
    );
    assert.ok(evidence.textContent!.includes("RF evidence"));
    await act(async () => root.unmount());
  }),
);

const premium = new URL("./premium/", import.meta.url);
const css = readdirSync(premium)
  .filter((f) => f.endsWith(".css"))
  .map((f) => [f, readFileSync(new URL(f, premium), "utf8")] as const);

test("premium layer never loads a remote asset", () => {
  for (const [file, source] of css) {
    for (const match of source.matchAll(/url\(\s*["']?([^"')]+)/g))
      assert.ok(
        !/^(https?:)?\/\//.test(match[1]),
        `${file} references a remote asset: ${match[1]}`,
      );
    assert.ok(
      !/@import\s+["']?https?:/.test(source),
      `${file} imports remotely`,
    );
  }
});

test("bundled fonts ship with their licences", () => {
  const fonts = readdirSync(new URL("./fonts/", premium));
  assert.ok(fonts.filter((f) => f.endsWith(".woff2")).length >= 4);
  assert.ok(fonts.some((f) => /OFL.*Geist/.test(f)));
  assert.ok(fonts.some((f) => /OFL.*Instrument/.test(f)));
});

test("every premium stylesheet with motion honours reduced motion", () => {
  for (const [file, source] of css) {
    if (!/animation:|transition:/.test(source) || file === "tokens.css")
      continue;
    assert.match(
      source,
      /prefers-reduced-motion:\s*reduce/,
      `${file} animates but has no reduced-motion rule`,
    );
  }
});

test("premium layer is imported after the legacy stylesheets", () => {
  const main = readFileSync(new URL("./main.tsx", import.meta.url), "utf8");
  const order = [...main.matchAll(/import "\.\/([^"]+\.css)";/g)].map(
    (m) => m[1],
  );
  assert.equal(order.at(-1), "premium/premium.css");
});
