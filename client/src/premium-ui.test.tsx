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

test("preparation stage: illustration is decorative and carries no contacts or readings", async () => {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { PreparationTerrain } = await import("./PreparationTerrain");
  const svg = renderToStaticMarkup(<PreparationTerrain />);
  assert.match(svg, /aria-hidden="true"/);
  assert.doesNotMatch(svg, /<text\b/, "no labels, ranges or contact IDs");
});

test("preparation stage: one primary action and an editorial headline", async () => {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { TrainingWelcome } = await import("./TrainingWelcome");
  const html = renderToStaticMarkup(<TrainingWelcome onPrepare={() => {}} />);
  assert.equal((html.match(/class="button primary"/g) ?? []).length, 1);
  assert.match(html, /<h2 class="display">/);
  assert.match(html, /<em>Own the decision\.<\/em>/);
});

test("drill settings are open by default so scenario choice is discoverable", async () => {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { default: DrillSetup } = await import("./DrillSetup");
  const noop = () => {};
  const html = renderToStaticMarkup(
    <DrillSetup
      mode="adaptive"
      onMode={noop}
      night={true}
      onNight={noop}
      seed={1}
      onSeed={noop}
      trainee="CHECK"
      onTrainee={noop}
      profile={null}
      prepared={null}
      onStart={noop}
      busy={false}
      library={[]}
      libraryId=""
      onLibrary={noop}
    />,
  );
  assert.match(
    html,
    /<details class="evidence-disclosure drill-settings" open="">/,
  );
});

test("review section navigator: plain anchors, one current location, no observer required", async () => {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { ReviewSections } = await import("./ReviewSections");
  const html = renderToStaticMarkup(
    <ReviewSections
      sections={[
        { id: "review-verdict", label: "Verdict" },
        { id: "review-replay", label: "Replay & decisions" },
      ]}
    />,
  );
  assert.match(
    html,
    /<nav class="review-sections" aria-label="Review sections">/,
  );
  assert.match(html, /href="#review-verdict"/);
  assert.match(html, /href="#review-replay"/);
  assert.equal((html.match(/aria-current="location"/g) ?? []).length, 1);
});

test(
  "review section navigator mounts where IntersectionObserver is unavailable",
  withDom(async (document) => {
    const { ReviewSections } = await import("./ReviewSections");
    const root = createRoot(document.getElementById("root")!);
    await act(async () =>
      root.render(
        <ReviewSections
          sections={[{ id: "review-verdict", label: "Verdict" }]}
        />,
      ),
    );
    assert.ok(document.querySelector('a[href="#review-verdict"]'));
    await act(async () => root.unmount());
  }),
);

test("instructor roster puts live sessions first and keeps history last", async () => {
  const { statusRank } = await import("./Instructor");
  const order = ["completed", "recoverable", "ACTIVE", "paused"].sort(
    (a, b) => statusRank(a) - statusRank(b),
  );
  assert.deepEqual(order, ["ACTIVE", "paused", "recoverable", "completed"]);
});
