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
  assert.equal((html.match(/<button /g) ?? []).length, 1);
  assert.match(html, /<h2>/);
  assert.match(html, /Enter the observation station\./);
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

test("crew scope scales to the farthest reported contact and marks shared stages", async () => {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { CrewPicture } = await import("./Crew");
  type State = Parameters<typeof CrewPicture>[0]["state"];
  const contact = (
    id: string,
    x: number,
    z: number,
    designated: number | null,
    classification: string | null,
  ) => ({
    id,
    position: { x, z, altitude: 40 },
    designated,
    classification,
    declared: null,
  });
  const state = {
    id: "crew",
    name: "Scope check",
    role: "responder",
    member_id: "m2",
    roster: [{ id: "m2", callsign: "RESPONSE", role: "responder" }],
    tick: 900,
    duration: 60,
    paused: false,
    done: false,
    status: "active",
    contacts: [
      contact("T1", 2600, 0, null, null),
      contact("T2", 100, 200, 12, null),
      contact("T3", -300, 50, 20, "quad"),
    ],
    attribution: [],
    clock_note: "",
    note: "",
  } as unknown as State;
  const html = renderToStaticMarkup(
    <CrewPicture state={state} selected="T2" />,
  );
  // 2600 m × 1.15 needs the 3000 m scope; geometry stays in reported metres.
  assert.match(html, /viewBox="-3000 -3000 6000 6000"/);
  assert.match(html, /cx="2600"/);
  assert.match(html, /data-stage="observed"[^>]*>(?:(?!data-stage).)*T1/);
  assert.match(html, /data-stage="designated" data-selected="true"/);
  assert.match(html, /data-stage="classified"/);
  assert.match(html, /class="crew-role-banner" data-role="responder"/);
  assert.match(html, /data-phase="running"/);
  assert.match(html, /T\+30\.00s \/ 60s/);
  // Elapsed share of the shared clock, capped at the exercise duration.
  assert.match(html, /inline-size:50(?:\.0)?%/);
});

test("scenario × skill shading is a CSS variable, and empty cells are marked rather than coloured", async () => {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { HeatmapTable } = await import("./SkillHeatmap");
  type Data = Parameters<typeof HeatmapTable>[0]["data"];
  const cell = (estimate: number | null, observations: number) => ({
    successes: 0,
    failures: 0,
    observations,
    estimate,
    sessions: observations ? 1 : 0,
  });
  const data = {
    note: "Persisted outcomes",
    skills: ["detection", "classification_iff"],
    rows: [
      {
        family: "DIRECT",
        sessions: 1,
        cells: {
          detection: cell(0.625, 14),
          classification_iff: cell(null, 0),
        },
      },
    ],
  } as unknown as Data;
  const html = renderToStaticMarkup(<HeatmapTable data={data} />);
  assert.match(html, /style="--estimate:0\.625"/);
  assert.match(html, /<td data-empty="true">/);
  assert.doesNotMatch(html, /rgba\(/);
});

test("opening landscape ships locally with its provenance, and the art stays decorative", async () => {
  const media = new URL("./premium/media/", import.meta.url);
  const files = readdirSync(media);
  assert.ok(files.includes("blue-hour-1600.webp"));
  assert.ok(files.includes("blue-hour-960.webp"));
  assert.match(
    readFileSync(new URL("PROVENANCE.md", media), "utf8"),
    /illustrative artwork, not photographs/,
  );
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { TrainingWelcome } = await import("./TrainingWelcome");
  assert.match(
    renderToStaticMarkup(<TrainingWelcome />),
    /Orientation scenery · your frozen exercise loads after preparation/,
  );
});
