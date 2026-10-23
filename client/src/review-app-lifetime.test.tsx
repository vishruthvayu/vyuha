import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { JSDOM } from "jsdom";
import { mkdtemp, readFile, writeFile, symlink, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import { makeScenario } from "./scenario";
import { replay, score } from "./sim";
import { readFileSync } from "node:fs";
import { reportedContacts } from "./observed-contacts";
import type { Draft } from "./storage";
import type { Record as TrainingRecord, Snapshot, Scenario } from "./types";

// Execute the actual App orchestration. Only the WebGL renderer is replaced with
// a headless presentation fixture; API/storage/navigation/engine code stays real.
// Cross-modality receipt tests also control the displayed Fusion receipt source
// and replace only the immersive surface with buttons calling the actual App callbacks.
let App: React.ComponentType;
let compiledDirectory: string;
before(async () => {
  const sourceDirectory = dirname(fileURLToPath(import.meta.url));
  compiledDirectory = await mkdtemp(join(tmpdir(), "vyuha-app-lifetime-"));
  await symlink(
    resolve(sourceDirectory, "../node_modules"),
    join(compiledDirectory, "node_modules"),
  );
  const renderer = join(compiledDirectory, "renderer.mjs");
  await writeFile(
    renderer,
    `import React from 'react'; export function Scene(props) { globalThis.__qaSceneSnapshots.push(props.state); return React.createElement('button',{onClick:()=>props.onFps(53),'data-headless-renderer':true},'Headless renderer FPS callback'); }`,
  );
  const fusion = join(compiledDirectory, "fusion-fixture.mjs");
  await writeFile(
    fusion,
    `import React,{useEffect} from 'react';export function FusionPanel(props){useEffect(()=>{props.onExposure?.(globalThis.__qaAdvice);},[]);return React.createElement('p',null,'Controlled displayed Fusion receipt');}`,
  );
  const cockpit = join(compiledDirectory, "cockpit-fixture.mjs");
  await writeFile(
    cockpit,
    `import React from 'react';export default function Cockpit(p){return React.createElement('section',null,React.createElement('button',{onClick:()=>p.onAction({k:'designate',track:'T2'})},'Submit VR designation'),React.createElement('button',{onClick:p.onClose},'Close mock cockpit'));}`,
  );
  const source = (
    await readFile(join(sourceDirectory, "App.tsx"), "utf8")
  ).replace(
    /import\("\.\/VRCockpit"\)/g,
    `import(${JSON.stringify(pathToFileURL(cockpit).href)})`,
  );
  const emitted = ts
    .transpileModule(source, {
      fileName: "App.tsx",
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    })
    .outputText.replace(
      /from\s+(["'])(\.\/[^"']+)\1/g,
      (_match, _quote, specifier: string) => {
        let dependency = resolve(sourceDirectory, specifier);
        if (specifier === "./LazyScene") dependency = renderer;
        else if (specifier === "./FusionPanel") dependency = fusion;
        else
          dependency = [dependency + ".ts", dependency + ".tsx"].find(
            existsSync,
          )!;
        assert.ok(dependency, `Unresolved App dependency ${specifier}`);
        return `from ${JSON.stringify(pathToFileURL(dependency).href)}`;
      },
    );
  const output = join(compiledDirectory, "app.mjs");
  await writeFile(output, emitted);
  App = (await import(pathToFileURL(output).href)).default;
});
after(async () => {
  if (compiledDirectory)
    await rm(compiledDirectory, { recursive: true, force: true });
});

const scenario = {
  ...makeScenario(482913),
  duration: 2,
  id: "lifetime-scenario",
  title: "Exercise A",
};
const card = score(replay(scenario, [], 60));
const restoredScenario = JSON.parse(
  readFileSync(
    new URL("./command-restoration-scenario.json", import.meta.url),
    "utf8",
  ),
) as Scenario;
const restoredCommands: import("./types").AppliedCommand[] = [
  {
    command_id: "recovery-environment",
    session_id: "RESTORED",
    seq: 1,
    issued_at: "2026-10-14T00:00:00Z",
    type: "environment",
    payload: { night: false },
    tick: 30,
    order: 0,
  },
];
const designated = reportedContacts(
  replay(restoredScenario, [], 90, restoredCommands).snapshot(),
).find((track) => track.detected !== null);
assert.ok(designated, "Synthetic fixture needs an actual observed contact");
const restoredEvents: import("./types").Action[] = [
  { k: "designate", track: designated.id, tick: 90, order: 1 },
];
const restoredDraft: Draft = {
  id: "RESTORED",
  trainee: "CADET-01",
  scenario: restoredScenario,
  events: restoredEvents,
  commands: restoredCommands,
  tick: 990,
  server: false,
  eventBatches: [restoredEvents],
  fusionExposures: [],
  learning: {
    preparation_id: "restored-curriculum",
    scenario: restoredScenario,
    context: {
      version: "learning-v1",
      catalog_hash: "a".repeat(64),
      item_id: "C01_PRACTICE_A",
      mode: "practice",
      assistance: "full",
      seed: 7,
      selection: {
        policy: "direct-item-v1",
        coverage: {},
        recent_items: [],
        candidates: ["C01_PRACTICE_A"],
        reason: "Restored lesson",
      },
    },
  },
  updated_at: "2026-10-14T00:00:00Z",
};

function record(id: string, verified: boolean): TrainingRecord {
  return {
    id,
    trainee: "CADET-01",
    scenario: { ...scenario, title: `Exercise ${id}` },
    events: [],
    endTick: 60,
    executionTick: 60,
    commands: [],
    scorecard: { ...card, summary: `Recorded outcome ${id}` },
    created_at: "2026-10-14T00:00:00Z",
    verified,
  };
}
const notes = [
  {
    command_seq: 1,
    text: "Immediate officer annotation",
    issued_at: "2026-10-14T00:00:00Z",
    tick: 30,
    order: 0,
    status: "applied",
  },
];
const ghost = {
  timeline: [],
  decision_reviews: [],
  node_averages: { detect: 0, classify: 0, prioritise: 0, engage: 0 },
  ghost_summary: {
    largest_loss: null,
    strongest_decision: null,
    mistake_counts: {
      detection: 0,
      classification_iff: 0,
      effector_choice: 0,
      degraded_sensor_response: 0,
    },
    lost_points: {
      detection: 0,
      classification_iff: 0,
      effector_choice: 0,
      degraded_sensor_response: 0,
    },
    recommended_focus: null,
    no_major_errors: true,
    text: "Synthetic test review",
  },
  replay_metadata: {
    hz: 30,
    observed_end_tick: 60,
    scoring_end_tick: 60,
    horizon_source: "completion" as const,
    early_end: false,
    version: "fixture",
    note: "Synthetic fixture",
  },
};
function memoryDatabase(
  records: Map<string, TrainingRecord>,
  initialDraft?: Draft,
  providedDrafts?: Map<string, unknown>,
) {
  const drafts =
    providedDrafts ??
    new Map<string, unknown>(
      initialDraft ? [[initialDraft.id, initialDraft]] : [],
    );
  const database = {
    close() {},
    transaction(name: string) {
      const data = name === "records" ? records : drafts;
      const transaction: {
        oncomplete?: () => void;
        objectStore?: (store: string) => unknown;
      } = {};
      transaction.objectStore = () => ({
        put(value: { id: string }) {
          data.set(value.id, structuredClone(value) as TrainingRecord);
          queueMicrotask(() => transaction.oncomplete?.());
        },
        delete(id: string) {
          data.delete(id);
          queueMicrotask(() => transaction.oncomplete?.());
        },
        getAll() {
          const request: { result: unknown[]; onsuccess?: () => void } = {
            result: structuredClone([...data.values()]),
          };
          queueMicrotask(() => request.onsuccess?.());
          return request;
        },
      });
      return transaction;
    },
  };
  return {
    open() {
      const request: { result: typeof database; onsuccess?: () => void } = {
        result: database,
      };
      queueMicrotask(() => request.onsuccess?.());
      return request;
    },
  };
}
type Mode =
  | "completion"
  | "retry-complete"
  | "retry-existing"
  | "notes"
  | "notes-failed"
  | "memo"
  | "restoration"
  | "modality-evidence"
  | "learning"
  | "learning-rejected"
  | "learning-invalid"
  | "learning-network"
  | "legacy-rejected"
  | "legacy-network";
async function mounted(
  mode: Mode,
  body: (context: {
    document: Document;
    saved: Map<string, TrainingRecord>;
    createBodies: unknown[];
    drafts: Map<string, unknown>;
    setAdvice: (id: string) => void;
    waitForPending: () => Promise<void>;
    release: () => void;
    selectB: () => Promise<void>;
    sceneSnapshots: Snapshot[];
    workerMessages: {
      type: string;
      scope?: string;
      request_id?: number;
      action?: import("./types").Action;
      scenario?: Scenario;
      events?: import("./types").Action[];
      commands?: import("./types").AppliedCommand[];
      tick?: number;
    }[];
    emitWorker: (data: object) => void;
  }) => Promise<void>,
) {
  const initial = record("A", mode === "memo");
  if (mode.startsWith("retry"))
    initial.fusionExposures = [
      {
        tick: 0,
        before_order: 0,
        track: "T1",
        exposure_id: "retained-local-request",
        association: "unspecified",
      },
    ];
  const savedRecords = new Map([
    ["A", initial],
    ["B", record("B", true)],
  ]);
  const sceneSnapshots: Snapshot[] = [];
  const savedDrafts = new Map<string, unknown>(
    mode === "restoration" ? [[restoredDraft.id, restoredDraft]] : [],
  );
  const advice = (id: string) => ({
    exposure_id: id,
    evidence: { track_id: "T2", tick: 0 },
    context: { before_order: 0 },
  });
  const dom = new JSDOM('<!doctype html><body><div id="root"></div></body>', {
    url: `http://qa.local/${mode.startsWith("learning") ? "?mode=adaptive&learning=prepared-learning" : mode.startsWith("retry") || mode === "memo" ? "?view=aar&session=A" : "?mode=scripted"}`,
    pretendToBeVisual: true,
  });
  const workers: { onmessage?: (event: { data: unknown }) => void }[] = [];
  const workerMessages: {
    type: string;
    scope?: string;
    request_id?: number;
    action?: import("./types").Action;
    scenario?: Scenario;
    events?: import("./types").Action[];
    commands?: import("./types").AppliedCommand[];
    tick?: number;
  }[] = [];
  class HeadlessWorker {
    onmessage?: (event: { data: unknown }) => void;
    constructor() {
      workers.push(this);
    }
    scope?: string;
    scenario?: Scenario;
    postMessage(message: {
      type: string;
      scope?: string;
      request_id?: number;
      action?: import("./types").Action;
      scenario?: Scenario;
    }) {
      workerMessages.push(message);
      if (message.type === "init") {
        this.scope = message.scope;
        this.scenario = message.scenario;
        if (mode !== "restoration")
          queueMicrotask(() =>
            this.onmessage?.({
              data: {
                type: "snapshot",
                initialized: true,
                scope: this.scope,
                scenario_id: this.scenario!.id,
                paused: false,
                state: replay(this.scenario!, [], 0).snapshot(),
              },
            }),
          );
      }
      if (message.type === "finish")
        queueMicrotask(() =>
          this.onmessage?.({
            data: {
              type: "finalized",
              commands: [],
              events: [],
              scope: this.scope,
              scenario_id: this.scenario?.id,
            },
          }),
        );
    }
    terminate() {}
  }
  let release = () => {},
    pending = false,
    completed = mode === "memo",
    readsA = 0;
  const frozenB = structuredClone(savedRecords.get("B")!);
  const consoleError = console.error;
  const diagnosticErrors: string[] = [];
  console.error = (...messages: unknown[]) => {
    diagnosticErrors.push(messages.map(String).join(" "));
    consoleError(...messages);
  };
  const createBodies: unknown[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input).replace(/^\/api\/v1/, "");
    const json = (value: unknown) => new Response(JSON.stringify(value));
    if (url === "/sessions/RESTORED/aar")
      return new Response(
        JSON.stringify({ detail: "Synthetic server offline" }),
        { status: 503 },
      );
    if (url.startsWith("/learning/preparations/")) {
      pending = true;
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return json({
        preparation_id: "prepared-learning",
        scenario,
        context: {
          version: "learning-v1",
          catalog_hash: "a".repeat(64),
          item_id: "C01_BASELINE-A_A",
          mode: "assessment",
          assistance: "none",
          seed: 7,
          selection: {
            policy: "direct-item-v1",
            reason: "Frozen assessment item",
            coverage: {},
            recent_items: [],
            candidates: ["C01_BASELINE-A_A"],
          },
        },
      });
    }
    if (url === "/health") return json({ ok: true });
    if (url.endsWith("/profile"))
      return json({ sessions: 2, skills: {}, unprocessed_sessions: [] });
    if (url.endsWith("/sessions") && url !== "/sessions")
      return json({ sessions: [...savedRecords.values()] });
    if (url === "/scenario-library") return json({ scenarios: [] });
    if (url === "/scenarios/generate")
      return json(
        mode === "modality-evidence"
          ? {
              ...scenario,
              fusion: {
                version: "fusion-1",
                mode: "training",
                exercise: "normal",
                bias_seed: 0,
              },
            }
          : scenario,
      );
    if (url === "/sessions") {
      createBodies.push(JSON.parse(String(init?.body)));
      if (
        mode === "learning-rejected" ||
        mode === "learning-invalid" ||
        mode === "legacy-rejected"
      )
        return new Response(
          JSON.stringify({
            detail:
              mode === "learning-invalid"
                ? "Learning preparation belongs to another trainee or scenario"
                : "Participant has a terminal disposition; new session creation is disabled.",
          }),
          { status: mode === "learning-invalid" ? 422 : 409 },
        );
      if (mode === "learning-network" || mode === "legacy-network")
        throw new TypeError("Synthetic network failure");
      return json({ id: "A" });
    }
    if (url === "/sessions/A/complete") {
      if (mode === "completion" || mode === "retry-complete") {
        pending = true;
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      }
      completed = true;
      return json({ ...card, score: 77, summary: "Verified outcome A" });
    }
    if (url === "/sessions/A/aar") {
      readsA++;
      if (mode === "retry-existing" && readsA === 2) {
        pending = true;
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        completed = true;
      }
      if (mode === "notes" && completed && readsA === 1) {
        pending = true;
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      }
      if (mode === "notes-failed" && completed)
        return new Response(
          JSON.stringify({ detail: "Annotation read unavailable" }),
          { status: 503 },
        );
      return json(
        completed
          ? {
              ...record("A", true),
              ...ghost,
              scorecard: { ...card, score: 77, summary: "Verified outcome A" },
              teaching_notes: notes,
            }
          : initial,
      );
    }
    if (url === "/sessions/B/aar")
      return json({ ...record("B", true), ...ghost });
    if (url.includes("/commands?") || url.includes("command-stream"))
      return json({ commands: [] });
    if (
      url.endsWith("/event-batches") ||
      url.endsWith("/events") ||
      url.endsWith("/control-state") ||
      url.endsWith("/fusion-exposures")
    )
      return json({ ok: true });
    throw new Error("Unexpected test request " + url);
  };
  const values = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    localStorage: dom.window.localStorage,
    sessionStorage: dom.window.sessionStorage,
    HTMLElement: dom.window.HTMLElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    getComputedStyle: dom.window.getComputedStyle,
    Event: dom.window.Event,
    PopStateEvent: dom.window.PopStateEvent,
    indexedDB: memoryDatabase(
      savedRecords,
      mode === "restoration" ? restoredDraft : undefined,
      savedDrafts,
    ),
    Worker: HeadlessWorker,
    ResizeObserver: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
    fetch: fetcher,
    IS_REACT_ACT_ENVIRONMENT: true,
    __qaSceneSnapshots: sceneSnapshots,
    __qaAdvice: advice("advice-at-dispatch"),
  };
  const descriptors = new Map(
    Object.keys(values).map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  for (const [key, value] of Object.entries(values))
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    });
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(dom.window.document.getElementById("root")!);
  const settle = async () =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  try {
    await act(async () => root.render(<App />));
    await settle();
    await body({
      document: dom.window.document,
      saved: savedRecords,
      createBodies,
      drafts: savedDrafts,
      setAdvice: (id) => {
        (globalThis as unknown as { __qaAdvice: unknown }).__qaAdvice =
          advice(id);
      },
      sceneSnapshots,
      workerMessages,
      emitWorker: (data) => workers.at(-1)?.onmessage?.({ data }),
      waitForPending: async () => {
        for (let attempt = 0; attempt < 100 && !pending; attempt++)
          await settle();
        assert.equal(pending, true);
      },
      release: () => release(),
      selectB: async () => {
        await act(async () => {
          dom.window.history.pushState(null, "", "/?view=aar&session=B");
          dom.window.dispatchEvent(new dom.window.PopStateEvent("popstate"));
        });
        await settle();
        assert.match(
          dom.window.document.querySelector(".aar-summary")!.textContent!,
          /Exercise B/,
        );
      },
    });
    for (const key of ["scorecard", "events", "scenario", "commands"] as const)
      assert.deepEqual(
        savedRecords.get("B")![key],
        frozenB[key],
        `Frozen B ${key} unchanged`,
      );
    assert.ok(
      !diagnosticErrors.some((message) => message.includes("same key")),
      "Advanced review siblings retain unique component keys",
    );
  } finally {
    await act(async () => root.unmount());
    console.error = consoleError;
    dom.window.close();
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
}
const click = async (document: Document, text: string) => {
  const button = [...document.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === text,
  );
  assert.ok(button, `Missing button ${text}`);
  await act(async () => button.click());
};
for (const mode of [
  "completion",
  "retry-complete",
  "retry-existing",
] as const) {
  test(`Actual App ${mode} persists verified evidence without stealing a subsequently selected review`, () =>
    mounted(
      mode,
      async ({ document, saved, waitForPending, release, selectB }) => {
        if (mode === "completion") {
          await click(document, "Begin exercise");
          await click(document, "End exercise");
        } else await click(document, "Retry verification");
        await waitForPending();
        await selectB();
        await act(async () => {
          release();
          await new Promise((resolve) => setTimeout(resolve, 20));
        });
        assert.match(
          document.querySelector(".aar-summary")!.textContent!,
          /Exercise B/,
        );
        assert.equal(
          new URL(document.defaultView!.location.href).searchParams.get(
            "session",
          ),
          "B",
        );
        assert.equal(saved.get("A")!.verified, true);
        assert.equal(saved.get("A")!.scorecard.score, 77);
        assert.equal(saved.get("A")!.teaching_notes?.[0].text, notes[0].text);
        if (mode.startsWith("retry"))
          assert.equal(
            saved.get("A")!.fusionExposures?.[0].exposure_id,
            "retained-local-request",
          );
      },
    ));
}
for (const mode of ["notes", "notes-failed"] as const) {
  test(`Actual App completion ${mode} keeps the score verified and exposes annotation availability immediately`, () =>
    mounted(mode, async ({ document, saved, waitForPending, release }) => {
      await click(document, "Begin exercise");
      await click(document, "End exercise");
      if (mode === "notes") {
        await waitForPending();
        assert.doesNotMatch(
          document.querySelector(".aar-summary")!.textContent!,
          /Server verified/,
          "The first verified completion includes full annotations rather than a card-only render",
        );
        await act(async () => release());
      }
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
      assert.match(
        document.querySelector(".aar-summary")!.textContent!,
        /Server verified/,
      );
      assert.equal(saved.get("A")!.verified, true);
      assert.equal(saved.get("A")!.scorecard.score, 77);
      if (mode === "notes")
        assert.match(
          document.querySelector(".teaching-notes")!.textContent!,
          /Immediate officer annotation/,
        );
      else
        assert.match(
          document.body.textContent!,
          /Detailed review and instructor notes await a server refresh; the score remains verified/,
        );
    }));
}
test("Actual App presentation-only FPS/camera changes reuse replay snapshot while a seek reconstructs", () =>
  mounted("memo", async ({ document, sceneSnapshots }) => {
    const original = sceneSnapshots.at(-1)!;
    assert.ok(original);
    await click(document, "Headless renderer FPS callback");
    await click(document, "OBSERVER");
    assert.equal(
      sceneSnapshots.at(-1),
      original,
      "Presentation updates do not invoke engine replay again",
    );
    const range = document.querySelector<HTMLInputElement>(
      '[aria-label="Replay time"]',
    )!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        document.defaultView!.HTMLInputElement.prototype,
        "value",
      )!.set!.call(range, "30");
      range.dispatchEvent(
        new document.defaultView!.Event("input", { bubbles: true }),
      );
    });
    assert.notEqual(sceneSnapshots.at(-1), original);
    assert.equal(sceneSnapshots.at(-1)!.tick, 30);
  }));

test("Actual App restored draft locks evidence until its own initialized replay and ignores stale worker ownership", () =>
  mounted(
    "restoration",
    async ({
      document,
      workerMessages,
      emitWorker,
      sceneSnapshots,
      drafts,
    }) => {
      await click(document, "Resume saved drill");
      const init = [...workerMessages]
        .reverse()
        .find((message) => message.type === "init")!;
      assert.ok(init.scope);
      assert.deepEqual(init.scenario, restoredDraft.scenario);
      assert.deepEqual(init.events, restoredDraft.events);
      assert.deepEqual(init.commands, restoredDraft.commands);
      assert.equal(init.tick, 990);
      assert.equal(
        (drafts.get("RESTORED") as Draft).learning?.preparation_id,
        "restored-curriculum",
      );
      assert.match(document.body.textContent!, /EXERCISE \/ RESTORING/);
      assert.match(document.body.textContent!, /Controls are unavailable/);
      assert.equal(document.querySelectorAll(".contact-item").length, 0);
      assert.equal(
        document.querySelector(".decision-workspace"),
        null,
        "Resources and decisions must not expose an unreconstructed initial state",
      );
      assert.equal(document.querySelector("[data-headless-renderer]"), null);
      assert.equal(
        [...document.querySelectorAll("button")].some(
          (button) => button.textContent?.trim() === "End exercise",
        ),
        false,
      );
      const lastScene = sceneSnapshots.at(-1);
      const restored = replay(
        restoredScenario,
        restoredEvents,
        990,
        restoredCommands,
      ).snapshot();
      const stale = replay({ ...scenario, night: true }, [], 0).snapshot();
      stale.tracks[0].id = "STALE-OTHER-RUN";
      await act(async () => {
        emitWorker({
          type: "snapshot",
          scope: "old-worker",
          scenario_id: scenario.id,
          initialized: true,
          state: stale,
          paused: false,
        });
        emitWorker({
          type: "accepted",
          scope: "old-worker",
          scenario_id: scenario.id,
          action: { k: "designate", track: "STALE-OTHER-RUN", tick: 0 },
        });
        emitWorker({
          type: "controlled",
          scope: "old-worker",
          scenario_id: scenario.id,
          commands: [],
        });
        emitWorker({
          type: "finalized",
          scope: "old-worker",
          scenario_id: scenario.id,
          events: [],
          commands: [],
        });
        // Even a matching scope's ordinary frame cannot unlock initialization.
        emitWorker({
          type: "snapshot",
          scope: init.scope,
          scenario_id: restoredScenario.id,
          initialized: false,
          state: stale,
          paused: false,
        });
      });
      assert.match(document.body.textContent!, /EXERCISE \/ RESTORING/);
      assert.equal(sceneSnapshots.at(-1), lastScene);
      assert.doesNotMatch(document.body.textContent!, /STALE-OTHER-RUN/);
      await act(async () =>
        emitWorker({
          type: "snapshot",
          scope: init.scope,
          scenario_id: restoredScenario.id,
          initialized: true,
          state: restored,
          paused: true,
        }),
      );
      assert.match(document.body.textContent!, /EXERCISE \/ PAUSED/);
      assert.doesNotMatch(
        document.body.textContent!,
        /Controls unlock after reconstruction/,
      );
      assert.equal(sceneSnapshots.at(-1)!.tick, 990);
      assert.equal(sceneSnapshots.at(-1)!.night, false);
      assert.deepEqual(sceneSnapshots.at(-1), restored);
      await act(async () =>
        emitWorker({
          type: "snapshot",
          scope: init.scope,
          scenario_id: restoredScenario.id,
          state: restored,
          paused: false,
        }),
      );
      assert.match(document.body.textContent!, /EXERCISE \/ RUNNING/);
      assert.match(
        document.querySelector(".mission-facts")!.textContent!,
        /00:33/,
      );
      assert.doesNotMatch(document.body.textContent!, /STALE-OTHER-RUN/);
      // Existing restored decisions and commands remain in the save/completion
      // boundary; a stale finalization may not move this exercise into a debrief.
      await act(async () =>
        emitWorker({
          type: "finalized",
          scope: "old-worker",
          scenario_id: restoredScenario.id,
          events: [],
          commands: [],
        }),
      );
      assert.match(document.body.textContent!, /EXERCISE \/ RUNNING/);
      assert.equal(document.querySelector(".aar-summary"), null);
    },
  ));

for (const olderStatus of ["accepted", "rejected"] as const) {
  test(`Actual App ignores an older ${olderStatus} acknowledgment while a different classification is pending`, () =>
    mounted("restoration", async ({ document, workerMessages, emitWorker }) => {
      await click(document, "Resume saved drill");
      const init = [...workerMessages]
        .reverse()
        .find((message) => message.type === "init")!;
      const restored = replay(
        restoredScenario,
        restoredEvents,
        990,
        restoredCommands,
      ).snapshot();
      const contact = reportedContacts(restored).find(
        (track) => track.id === designated.id,
      )!;
      assert.ok(contact, "Restored contact still has a sensor report");
      assert.equal(contact.classification, null);
      await act(async () =>
        emitWorker({
          type: "snapshot",
          scope: init.scope,
          scenario_id: restoredScenario.id,
          initialized: true,
          state: restored,
          paused: false,
        }),
      );
      const row = [
        ...document.querySelectorAll<HTMLButtonElement>(".contact-item"),
      ].find((button) => button.textContent?.includes(contact.id));
      assert.ok(row);
      await act(async () =>
        row.dispatchEvent(
          new document.defaultView!.Event("pointerdown", { bubbles: true }),
        ),
      );
      const chooseRadio = async (value: string) => {
        const radio = document.querySelector<HTMLInputElement>(
          `.guided input[type="radio"][value="${value}"]`,
        );
        assert.ok(radio, `Missing classification choice ${value}`);
        await act(async () => radio.click());
      };
      await chooseRadio("quad");
      await chooseRadio("neutral");
      await click(document, "Confirm classification");
      const first = [...workerMessages]
        .reverse()
        .find((message) => message.type === "action")!;
      await chooseRadio("bird");
      await chooseRadio("friendly");
      await click(document, "Confirm classification");
      const second = [...workerMessages]
        .reverse()
        .find((message) => message.type === "action")!;
      assert.ok(Number.isInteger(first.request_id));
      assert.ok(Number.isInteger(second.request_id));
      assert.notEqual(first.request_id, second.request_id);
      assert.equal(first.action!.k, "classify");
      assert.equal(first.action!.track, second.action!.track);
      assert.equal(second.action!.k, "classify");
      assert.equal(first.action!.kind, "quad");
      assert.equal(first.action!.identity, "neutral");
      assert.equal(second.action!.kind, "bird");
      assert.equal(second.action!.identity, "friendly");
      const status = () =>
        document.querySelector(".guided-status")!.textContent!;
      const pending = status();
      assert.match(pending, /Bird.*friendly.*submitted/);
      await act(async () =>
        emitWorker({
          type: olderStatus,
          scope: init.scope,
          scenario_id: restoredScenario.id,
          request_id: first.request_id,
          action: { ...first.action!, tick: 990, order: 2 },
        }),
      );
      assert.equal(
        status(),
        pending,
        "An older same-contact/kind reply must not settle the newer choice",
      );
      await act(async () =>
        emitWorker({
          type: "accepted",
          scope: init.scope,
          scenario_id: restoredScenario.id,
          request_id: second.request_id,
          action: {
            ...second.action!,
            tick: 990,
            order: olderStatus === "accepted" ? 3 : 2,
          },
        }),
      );
      assert.match(status(), /Bird.*friendly.*accepted at 00:33/);
      assert.doesNotMatch(status(), /submitted|not accepted/);
    }));
}

for (const origin of ["browser", "VR"] as const) {
  test(`Actual App freezes ${origin} Fusion attribution across a delayed cross-modality acknowledgment`, () =>
    mounted(
      "modality-evidence",
      async ({ document, drafts, workerMessages, emitWorker, setAdvice }) => {
        await click(document, "Begin exercise");
        const row = [
          ...document.querySelectorAll<HTMLButtonElement>(".contact-item"),
        ].find((b) => b.textContent?.includes("T2"));
        assert.ok(row);
        await act(async () =>
          row.dispatchEvent(
            new document.defaultView!.Event("pointerdown", { bubbles: true }),
          ),
        );
        if (origin === "browser") await click(document, "Designate T2");
        await click(document, "Open VR observation cockpit");
        // Let the lazy surface mount; only presentation is stubbed, App.act is real.
        await act(async () => {
          await new Promise((r) => setTimeout(r, 20));
        });
        if (origin === "VR") {
          await click(document, "Submit VR designation");
          setAdvice("advice-displayed-after-VR-submission");
          await click(document, "Close mock cockpit");
        }
        const request = [...workerMessages]
          .reverse()
          .find((m) => m.type === "action")!;
        assert.ok(request?.request_id);
        const init = [...workerMessages]
          .reverse()
          .find((m) => m.type === "init")!;
        const reply = {
          type: "accepted",
          scope: init.scope,
          scenario_id: request.scenario?.id ?? scenario.id,
          request_id: request.request_id,
          action: { ...request.action!, tick: 0, order: 0 },
        };
        await act(async () => {
          emitWorker({ ...reply, action: { ...reply.action, track: "T999" } });
          emitWorker({ ...reply, request_id: request.request_id! + 100 });
          await new Promise((r) => setTimeout(r, 20));
        });
        assert.equal(
          (drafts.get("A") as Draft | undefined)?.events.length ?? 0,
          0,
          "unknown IDs and mismatched payloads cannot enter the recorded action stream",
        );
        await act(async () => {
          emitWorker(reply);
          emitWorker(reply);
          await new Promise((r) => setTimeout(r, 20));
        });
        const draft = drafts.get("A") as Draft;
        assert.ok(draft, "Accepted action saved in the original shared draft");
        assert.equal(draft.events.length, 1);
        assert.deepEqual(
          draft.fusionExposures?.map((e) => e.exposure_id) ?? [],
          origin === "browser" ? ["advice-at-dispatch"] : [],
          "Only advice displayed at dispatch may be associated; VR did not display the browser panel",
        );
      },
    ));
}

test("Actual App waits for the Academy ticket and persists assessment context without default hints", () =>
  mounted(
    "learning",
    async ({ document, createBodies, drafts, waitForPending, release }) => {
      await waitForPending();
      await click(document, "Prepare adaptive drill");
      assert.equal(
        createBodies.length,
        0,
        "pending curriculum must not launch a regular Director session",
      );
      await act(async () => {
        release();
        await new Promise((r) => setTimeout(r, 20));
      });
      const seedInput = document.querySelector<HTMLInputElement>(
        'input[type="number"]',
      )!;
      assert.equal(seedInput.disabled, true);
      assert.equal(seedInput.value, "7");
      await click(document, "Start adaptive drill");
      await act(async () => {
        await new Promise((r) => setTimeout(r, 20));
      });
      assert.deepEqual(createBodies, [
        {
          scenario_id: scenario.id,
          trainee: "CADET-01",
          learning_preparation: "prepared-learning",
        },
      ]);
      const guidance = [...document.querySelectorAll("button")].find(
        (b) => b.textContent?.trim() === "Guidance",
      )!;
      assert.equal(guidance.disabled, true);
      assert.equal(guidance.getAttribute("aria-pressed"), "false");
      const draft = drafts.get("A") as Draft;
      assert.equal(draft.learning?.preparation_id, "prepared-learning");
      assert.equal(draft.learning?.context.mode, "assessment");
    },
  ));

for (const mode of [
  "learning-rejected",
  "learning-invalid",
  "learning-network",
] as const) {
  test(`Actual App distinguishes ${mode} without starting or saving a refused curriculum`, () =>
    mounted(
      mode,
      async ({
        document,
        createBodies,
        drafts,
        workerMessages,
        waitForPending,
        release,
      }) => {
        await waitForPending();
        await act(async () => {
          release();
          await new Promise((r) => setTimeout(r, 20));
        });
        await click(document, "Start adaptive drill");
        await act(async () => {
          await new Promise((r) => setTimeout(r, 20));
        });
        assert.equal(createBodies.length, 1);
        assert.equal(drafts.size, 0);
        assert.equal(
          workerMessages.some((m) => m.type === "play"),
          false,
        );
        const text = document.body.textContent ?? "";
        if (mode === "learning-network") {
          assert.match(text, /SERVER OFFLINE/);
          assert.match(text, /original local server/);
        } else {
          assert.match(text, /SERVER CONNECTED/);
          assert.match(text, /Exercise was not started/);
          assert.match(
            text,
            mode === "learning-invalid"
              ? /belongs to another trainee/
              : /terminal disposition/,
          );
          assert.doesNotMatch(text, /Advanced drills require the original/);
        }
      },
    ));
}
for (const mode of ["legacy-rejected", "legacy-network"] as const) {
  test(`Actual App preserves safe legacy behavior for ${mode}`, () =>
    mounted(mode, async ({ document, workerMessages }) => {
      await click(document, "Begin exercise");
      await act(async () => {
        await new Promise((r) => setTimeout(r, 20));
      });
      const text = document.body.textContent ?? "";
      if (mode === "legacy-rejected") {
        assert.match(text, /Exercise was not started/);
        assert.equal(
          workerMessages.some((m) => m.type === "play"),
          false,
        );
      } else {
        assert.match(text, /Local practice mode/);
        assert.equal(
          workerMessages.some((m) => m.type === "play"),
          true,
        );
      }
    }));
}
