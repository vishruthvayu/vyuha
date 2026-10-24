import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import React, {
  act,
  createRef,
  type ComponentProps,
  type ComponentType,
} from "react";
import { JSDOM } from "jsdom";
import { mkdtemp, readFile, writeFile, symlink, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import ts from "typescript";
import { testPython } from "./test-python";
import { replay } from "./sim";
import type { Record as TrainingRecord } from "./types";
type Props = ComponentProps<typeof import("./ReviewTheatre").default>;
let Theatre: ComponentType<Props>, directory: string;
before(async () => {
  const sourceDirectory = dirname(fileURLToPath(import.meta.url));
  directory = await mkdtemp(join(tmpdir(), "vyuha-theatre-"));
  await symlink(
    resolve(sourceDirectory, "../node_modules"),
    join(directory, "node_modules"),
  );
  const renderer = join(directory, "renderer.mjs");
  await writeFile(
    renderer,
    `import React from 'react';export function Scene(p){return React.createElement('div',{'data-scene-reference':String(p.groundTruth),'data-scene-camera':p.cameraPreset??'sensor','data-scene-vision':p.vision},React.createElement('button',{onClick:()=>p.onFps(60)},'Renderer frame update'));}`,
  );
  const source = await readFile(
    join(sourceDirectory, "ReviewTheatre.tsx"),
    "utf8",
  );
  const output = ts
    .transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    })
    .outputText.replace(
      /from\s+(["'])(\.\/[^"']+)\1/g,
      (_m, _q, specifier: string) => {
        const base = resolve(sourceDirectory, specifier);
        return `from ${JSON.stringify(pathToFileURL(specifier === "./LazyScene" ? renderer : [base + ".ts", base + ".tsx"].find(existsSync)!).href)}`;
      },
    );
  const path = join(directory, "theatre.mjs");
  await writeFile(path, output);
  Theatre = (await import(pathToFileURL(path).href)).default;
});
after(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
});
const generated = spawnSync(
  testPython(),
  [
    "-c",
    `import json
from server.engine import make_scenario
from server.review import build_review
s=make_scenario()
e=[dict(tick=1,order=0,k='designate',track='T1')]
r,c=build_review(s,e,[],'theatre-test',2250)
print(json.dumps(dict(id='theatre-test',trainee='QA',scenario=s,events=e,commands=[],endTick=2250,scorecard=c,created_at='2026-10-24T00:00:00Z',verified=True,**r)))`,
  ],
  { cwd: "..", encoding: "utf8" },
);
assert.equal(generated.status, 0, generated.stderr);
const record = JSON.parse(generated.stdout) as TrainingRecord;
const decision = record.decision_reviews!.find((r) => r.trainee_action)!;
async function mounted(
  body: (qa: {
    document: Document;
    props: Props;
    decisions: Props["record"]["decision_reviews"];
    seeks: unknown[];
    choices: unknown[];
    render: (next: Partial<Props>, key?: string) => Promise<void>;
    click: (text: string) => Promise<void>;
    select: (value: string) => Promise<void>;
  }) => Promise<void>,
) {
  const dom = new JSDOM(
      '<!doctype html><html lang="en"><title>Theatre</title><body><h1>Theatre test</h1><div id="root"></div></body></html>',
      { url: "http://qa.local/?view=aar" },
    ),
    saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [name, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value,
    });
  }
  const { createRoot } = await import("react-dom/client"),
    root = createRoot(dom.window.document.getElementById("root")!);
  const seeks: unknown[] = [],
    choices: unknown[] = [];
  let props: Props = {
    record: structuredClone(record),
    snapshot: replay(
      record.scenario,
      record.events,
      decision.tick,
      [],
      decision.order ?? undefined,
    ).snapshot(),
    tick: decision.tick,
    endTick: record.endTick,
    beforeOrder: decision.order ?? undefined,
    selected: decision.track_id,
    decisionId: decision.decision_id,
    playing: false,
    quality: "medium",
    headingRef: createRef<HTMLHeadingElement>(),
    inspector: <p>Immutable pinned explanation</p>,
    onSeek: (...args) => seeks.push(args),
    onSelect: (id) => choices.push(id),
    onDecision: (r) => choices.push(r.decision_id),
    onPlay: () => choices.push("play"),
  };
  const render = async (next: Partial<Props>, key = "A") => {
    props = { ...props, ...next };
    await act(async () => root.render(<Theatre key={key} {...props} />));
  };
  try {
    await render({});
    await body({
      document: dom.window.document,
      props,
      decisions: record.decision_reviews,
      seeks,
      choices,
      render,
      click: async (text) => {
        const button = [...dom.window.document.querySelectorAll("button")].find(
          (b) => b.textContent?.includes(text),
        );
        assert.ok(button, `Missing ${text}`);
        await act(async () => button.click());
      },
      select: async (value) => {
        const field = dom.window.document.querySelector(
          '[aria-label="Reported contact at cursor"]',
        )!;
        await act(async () => {
          Object.getOwnPropertyDescriptor(
            dom.window.HTMLSelectElement.prototype,
            "value",
          )!.set!.call(field, value);
          field.dispatchEvent(
            new dom.window.Event("change", { bubbles: true }),
          );
        });
      },
    });
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [name, value] of saved) {
      if (value) Object.defineProperty(globalThis, name, value);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
}
test("theatre starts in modeled sensor view; reference/EO transitions preserve time, contact and source", () =>
  mounted(async (qa) => {
    const before = structuredClone(qa.props.record);
    assert.equal(
      qa.document
        .querySelector("[data-scene-reference]")
        ?.getAttribute("data-scene-reference"),
      "false",
    );
    assert.equal(
      qa.document
        .querySelector("[data-scene-camera]")
        ?.getAttribute("data-scene-camera"),
      "sensor",
    );
    assert.match(qa.document.body.textContent ?? "", /not a recording of gaze/);
    await qa.click("Reference world");
    assert.equal(
      qa.document
        .querySelector("[data-scene-reference]")
        ?.getAttribute("data-scene-reference"),
      "true",
    );
    await qa.click("Modeled observations");
    await qa.click("EO");
    assert.equal(
      qa.document
        .querySelector("[data-scene-vision]")
        ?.getAttribute("data-scene-vision"),
      "day",
    );
    assert.match(
      qa.document.body.textContent ?? "",
      /separate channel provenance unavailable/,
    );
    assert.equal(qa.seeks.length, 0);
    assert.deepEqual(qa.props.record, before);
    await qa.render({ selected: "T2" });
    assert.match(
      qa.document.body.textContent ?? "",
      /inspected contact T2 differs from the pinned decision/,
    );
    await qa.render({ quality: "tactical" });
    const reference = [...qa.document.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Reference world"),
    )!;
    assert.equal(reference.disabled, true);
    assert.match(
      qa.document.body.textContent ?? "",
      /3D reference reconstruction is unavailable/,
    );
    assert.equal(qa.document.querySelector("[data-scene-reference]"), null);
  }));
test("divergent playhead and missing-action evidence disclose both times and seek actual stored evidence", () =>
  mounted(async (qa) => {
    const missing = record.decision_reviews!.find(
      (r) => r.trainee_action === null,
    )!;
    const modified = {
      ...missing,
      tick: 1800,
      evidence: { ...missing.evidence, tick: 60 },
    };
    const next = { ...record, decision_reviews: [modified] };
    await qa.render({
      record: next,
      decisionId: modified.decision_id,
      tick: 1800,
      beforeOrder: undefined,
    });
    assert.match(qa.document.body.textContent ?? "", /Two different moments/);
    assert.match(qa.document.body.textContent ?? "", /captured at T\+2.00s/);
    await qa.click("Inspect pinned evidence moment");
    assert.deepEqual(qa.seeks.at(-1), [60, undefined, modified.track_id]);
    await qa.render({ tick: 60 });
    assert.match(qa.document.body.textContent ?? "", /event boundary unknown/);
    await qa.render(
      { record: { ...record, id: "B" }, decisionId: decision.decision_id },
      "B",
    );
    assert.equal(
      qa.document
        .querySelector("[data-scene-reference]")
        ?.getAttribute("data-scene-reference"),
      "false",
    );
  }));
test("bounded chronological rail retains all decisions through paging and populated semantics pass axe", () =>
  mounted(async (qa) => {
    const rows = Array.from({ length: 27 }, (_, n) => ({
      ...decision,
      decision_id: `decision-${n}`,
      tick: 1 + n,
      order: n,
    }));
    await qa.render({
      record: { ...record, decision_reviews: rows },
      decisionId: rows[0].decision_id,
    });
    assert.equal(
      qa.document.querySelectorAll(".theatre-moments button").length,
      12,
    );
    await qa.click("Next 12 moments");
    assert.equal(qa.choices.at(-1), "decision-12");
    await qa.render({ decisionId: "decision-12" });
    assert.match(
      qa.document.querySelector(".theatre-rail-heading")?.textContent ?? "",
      /13–24 of 27/,
    );
    const axe = await import("axe-core");
    const result = await axe.default.run(
      qa.document.querySelector("section")!,
      { rules: { "color-contrast": { enabled: false } } },
    );
    assert.deepEqual(
      result.violations.map((v) => v.id),
      [],
    );
  }));
test("investigation chapters retain lens and record, use source order and disable unobserved outcomes", () =>
  mounted(async (qa) => {
    const review = {
      ...decision,
      evidence: { ...decision.evidence, tick: 30, first_detectable_tick: 15 },
      consequence: {
        ...decision.consequence,
        kind: "resolved" as const,
        tick: 100,
      },
    };
    const source = { ...record, decision_reviews: [review] };
    const before = structuredClone(source);
    await qa.render({
      record: source,
      decisionId: review.decision_id,
      endTick: 50,
    });
    await qa.click("Reference world");
    await qa.click("Decision evidence");
    assert.deepEqual(qa.seeks.at(-1), [30, undefined, review.track_id]);
    assert.equal(
      qa.document
        .querySelector("[data-scene-reference]")
        ?.getAttribute("data-scene-reference"),
      "true",
    );
    const outcome = [
      ...qa.document.querySelectorAll(".theatre-episode button"),
    ].find((b) =>
      b.textContent?.includes("Observed outcome"),
    ) as HTMLButtonElement;
    assert.equal(outcome.disabled, true);
    await qa.click("First modeled detectability");
    assert.deepEqual(qa.seeks.at(-1), [15, undefined, review.track_id]);
    assert.deepEqual(source, before);
  }));
