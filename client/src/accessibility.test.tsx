import { spawnSync } from "node:child_process";
import { testPython } from "./test-python";
import AdvancedAAR from "./AdvancedAAR";
import { GhostPanel, GhostTimeline } from "./Ghost";
import { FusionPanel } from "./FusionPanel";
import { CrewCoordination } from "./Crew";
import type { SensorObservation } from "./sensors-v2";
import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import axe from "axe-core";
import { act, useCallback, useRef, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import OperatorGuide from "./OperatorGuide";
import Navigation, { NavigationLinks } from "./Navigation";
import CapabilityTour from "./CapabilityTour";
import { Radar } from "./Radar";
import { Simulation } from "./sim";
import { makeScenario } from "./scenario";
import { useModalFocus } from "./useModalFocus";
import { useRenderingQuality } from "./useRenderingQuality";
import { useOfflineStatus } from "./useOfflineStatus";
import { useWorkspaceNavigation } from "./useWorkspaceNavigation";
import type { Record as TrainingRecord } from "./types";
import { navigationItems, type WorkspaceView } from "./routes";
import App from "./App";
import Crew from "./Crew";
import Instructor from "./Instructor";
import RapidID from "./RapidID";
import ExerciseStudio from "./ExerciseStudio";
import Analytics from "./Analytics";
import Recorded from "./Recorded";
import Transfer from "./Transfer";
import Evidence from "./Evidence";

let dom: JSDOM, roots: Root[];
const saved = new Map<string, PropertyDescriptor | undefined>();
beforeEach(() => {
  dom = new JSDOM(
    '<!doctype html><html lang="en"><head><title>VYUHA accessibility test</title></head><body><button id="launcher">Launch</button><div id="mount"></div></body></html>',
    { url: "http://unit.local/", runScripts: "outside-only" },
  );
  roots = [];
  // SSR does not render or measure WebGL; this adapter permits its DOM wrapper.
  // Canvas pixels cannot be inspected by jsdom; retain DOM checks only.
  Object.defineProperty(dom.window.HTMLCanvasElement.prototype, "getContext", {
    value: () => null,
  });
  Object.defineProperty(dom.window, "ResizeObserver", {
    value: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  });
  const globals = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    Node: dom.window.Node,
    PopStateEvent: dom.window.PopStateEvent,
    KeyboardEvent: dom.window.KeyboardEvent,
    Event: dom.window.Event,
    getComputedStyle: dom.window.getComputedStyle,
    localStorage: dom.window.localStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  for (const [name, value] of Object.entries(globals)) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value,
    });
  }
});
afterEach(async () => {
  for (const root of roots) await act(async () => root.unmount());
  dom.window.close();
  for (const [name, descriptor] of saved) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
  saved.clear();
});
async function mount(content: ReactNode) {
  const root = createRoot(document.getElementById("mount")!);
  roots.push(root);
  await act(async () => root.render(content));
  return root;
}
async function click(element: Element) {
  await act(async () =>
    element.dispatchEvent(
      new dom.window.MouseEvent("click", { bubbles: true }),
    ),
  );
}
async function key(element: Element, key: string, shiftKey = false) {
  const event = new dom.window.KeyboardEvent("keydown", {
    key,
    shiftKey,
    bubbles: true,
    cancelable: true,
  });
  await act(async () => element.dispatchEvent(event));
  return event;
}

test("guide contains all tabbable controls, isolates background and restores focus on Escape", async () => {
  const launcher = document.getElementById("launcher") as HTMLButtonElement;
  launcher.focus();
  function Guide() {
    const [open, setOpen] = useState(true);
    const close = useCallback(() => setOpen(false), []);
    return open ? <OperatorGuide onClose={close} /> : null;
  }
  await mount(<Guide />);
  const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
  assert.equal(
    document.activeElement?.getAttribute("aria-label"),
    "Close operator guide",
  );
  assert.equal(launcher.hasAttribute("inert"), true);
  const link = document.createElement("a");
  link.href = "/system/evidence";
  link.textContent = "Evidence";
  dialog.append(link);
  link.focus();
  const tab = await key(link, "Tab");
  assert.equal(tab.defaultPrevented, true);
  assert.equal(
    document.activeElement?.getAttribute("aria-label"),
    "Close operator guide",
  );
  await key(document.activeElement as Element, "Tab", true);
  assert.equal(document.activeElement, link);
  launcher.focus();
  assert.equal(dialog.contains(document.activeElement), true);
  await key(document.activeElement as Element, "Escape");
  assert.equal(document.querySelector('[role="dialog"]'), null);
  assert.equal(document.activeElement, launcher);
  assert.equal(launcher.hasAttribute("inert"), false);
  assert.equal(document.body.style.overflow, "");
});

test("empty modal traps Tab safely and restores preexisting inert and body overflow", async () => {
  const launcher = document.getElementById("launcher")!;
  launcher.setAttribute("inert", "preserved");
  document.body.style.overflow = "clip";
  function Empty() {
    const ref = useRef<HTMLElement>(null);
    const close = useCallback(() => {}, []);
    useModalFocus(ref, true, close);
    return <section ref={ref} role="dialog" aria-label="Empty" tabIndex={-1} />;
  }
  const root = await mount(<Empty />);
  const dialog = document.querySelector('[role="dialog"]')!;
  assert.equal(document.activeElement, dialog);
  assert.equal((await key(dialog, "Tab")).defaultPrevented, true);
  await act(async () => root.unmount());
  roots = [];
  assert.equal(launcher.getAttribute("inert"), "preserved");
  assert.equal(document.body.style.overflow, "clip");
});

test("navigation drawer exposes a labelled modal, Escape restores the toggle, skip link focuses content", async () => {
  await mount(
    <>
      <Navigation />
      <main id="workspace-content" tabIndex={-1}>
        Training workspace
      </main>
    </>,
  );
  const toggle =
    document.querySelector<HTMLButtonElement>(".navigation-toggle")!;
  toggle.focus();
  await click(toggle);
  const drawer = document.querySelector<HTMLElement>(".workspace-navigation")!;
  assert.equal(drawer.getAttribute("role"), "dialog");
  assert.equal(drawer.getAttribute("aria-modal"), "true");
  assert.equal(drawer.contains(document.activeElement), true);
  assert.equal(document.querySelector("main")?.hasAttribute("inert"), true);
  await key(document.activeElement as Element, "Escape");
  assert.equal(toggle.getAttribute("aria-expanded"), "false");
  assert.equal(document.activeElement, toggle);
  await click(document.querySelector(".skip-link")!);
  assert.equal(document.activeElement, document.querySelector("main"));
});

test("tour announces changed steps, permits outside focus and restores launcher on Escape", async () => {
  await mount(<CapabilityTour />);
  const launch = document.querySelector<HTMLButtonElement>(".tour-launch")!;
  launch.focus();
  await click(launch);
  const card = document.querySelector<HTMLElement>(".tour-card")!;
  assert.equal(document.activeElement, card);
  assert.equal(card.getAttribute("aria-modal"), null);
  await click(
    [...card.querySelectorAll("button")].find((b) => b.textContent === "Next")!,
  );
  assert.match(
    card.querySelector("[aria-live]")?.textContent ?? "",
    /Training Ground.*Step 2 of 6/,
  );
  document.getElementById("launcher")!.focus();
  assert.equal(document.activeElement?.id, "launcher");
  card.focus();
  await key(card, "Escape");
  assert.equal(document.querySelector(".tour-card"), null);
  assert.equal(document.activeElement, launch);
});

test("radar contacts expose selectable group semantics and Space activates without scrolling", async () => {
  const sim = new Simulation(makeScenario(7));
  for (let i = 0; i < 210; i++) sim.step();
  const selected: string[] = [];
  await mount(
    <Radar
      state={sim.snapshot()}
      selected={null}
      onSelect={(id) => selected.push(id)}
    />,
  );
  assert.equal(document.querySelector("svg")?.getAttribute("role"), "group");
  const contact = document.querySelector<SVGGElement>('g[role="button"]')!;
  assert.ok(contact, "seeded exercise includes an observed radar contact");
  const event = await key(contact, " ");
  assert.equal(event.defaultPrevented, true);
  assert.equal(selected.length, 1);
  assert.equal(contact.getAttribute("aria-pressed"), "false");
});

test("automatic rendering adaptation uses consecutive samples and respects explicit quality controls", async () => {
  let controls: ReturnType<typeof useRenderingQuality>;
  let tactical = 0;
  function Quality() {
    const enter = useCallback(() => {
      tactical++;
    }, []);
    controls = useRenderingQuality(enter);
    return <div>{controls.quality}</div>;
  }
  await mount(<Quality />);
  for (const value of [10, 10, 25, 10, 10])
    await act(async () => controls.renderFps(value));
  assert.equal(controls!.quality, "medium");
  await act(async () => controls.renderFps(10));
  assert.equal(controls!.quality, "low");
  await act(async () => controls.setAutoQuality(false));
  for (const value of [5, 5, 5, 5])
    await act(async () => controls.renderFps(value));
  assert.equal(controls!.quality, "low");
  await act(async () => controls.setAutoQuality(true));
  for (const value of [5, 5, 5])
    await act(async () => controls.renderFps(value));
  assert.equal(controls!.quality, "tactical");
  assert.equal(tactical, 1);
});

test("offline installation hook reads document state and follows status lifecycle events", async () => {
  document.documentElement.dataset.offlineStatus = "ready";
  function Status() {
    return <p>{useOfflineStatus()}</p>;
  }
  await mount(<Status />);
  assert.equal(document.querySelector("#mount")?.textContent, "ready");
  await act(async () => {
    document.documentElement.dataset.offlineStatus = "unsupported";
    window.dispatchEvent(new dom.window.Event("vyuha-offline-status"));
  });
  assert.equal(document.querySelector("#mount")?.textContent, "unsupported");
});

async function audit(content: ReactNode) {
  document.getElementById("mount")!.innerHTML = renderToStaticMarkup(content);
  dom.window.eval(axe.source);
  const engine = (dom.window as unknown as { axe: typeof axe }).axe;
  return engine.run(document.getElementById("mount")!, {
    runOnly: {
      type: "tag",
      values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
    },
    rules: { "color-contrast": { enabled: false } },
  });
}
test("axe checks guide and navigation DOM semantics (layout/contrast excluded from jsdom)", async () => {
  for (const content of [
    <OperatorGuide onClose={() => {}} />,
    <NavigationLinks pathname="/" />,
  ]) {
    const result = await audit(content);
    assert.equal(
      result.violations.length,
      0,
      JSON.stringify(
        result.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
      ),
    );
  }
});
test("axe checks rendered initial important routes and reports real form/ARIA defects", async () => {
  for (const [name, Component] of Object.entries({
    training: App,
    crew: Crew,
    instructor: Instructor,
    rapid: RapidID,
    studio: ExerciseStudio,
    analytics: Analytics,
    recorded: Recorded,
    transfer: Transfer,
    evidence: Evidence,
  })) {
    const result = await audit(<Component />);
    assert.equal(
      result.violations.length,
      0,
      name +
        ": " +
        JSON.stringify(
          result.violations.map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => n.target),
          })),
        ),
    );
  }
});

test("workspace navigation clears stale review data, stops replay and keeps refreshable native URLs", async () => {
  let navigation: ReturnType<typeof useWorkspaceNavigation>;
  let current: TrainingRecord | null = null,
    view: WorkspaceView = "drill",
    playing = true,
    mode = "scripted",
    tick = 40;
  const record = { id: "verified-A", verified: true } as TrainingRecord;
  function Workspace() {
    const [v, setView] = useState<WorkspaceView>("drill"),
      [r, setCurrent] = useState<TrainingRecord | null>(null),
      [p, setReplayPlay] = useState(true),
      [t, setReplayTick] = useState(40),
      [m, setMode] = useState<"scripted" | "adaptive" | "library">("scripted");
    current = r;
    view = v;
    playing = p;
    mode = m;
    tick = t;
    navigation = useWorkspaceNavigation({
      view: v,
      current: r,
      reviewOnly: false,
      setView,
      setCurrent,
      setReplayPlay,
      setReplayTick,
      setMode,
    });
    return (
      <main id="workspace-content" tabIndex={-1}>
        {v}
      </main>
    );
  }
  await mount(<Workspace />);
  await act(async () => navigation.openReview(record));
  assert.equal(current, record);
  assert.equal(view, "aar");
  assert.equal(playing, false);
  assert.equal(tick, 0);
  assert.match(window.location.search, /session=verified-A/);
  assert.equal(document.activeElement?.id, "workspace-content");
  await act(async () => {
    window.history.pushState(null, "", "/?view=aar&session=verified-B");
    window.dispatchEvent(new dom.window.PopStateEvent("popstate"));
  });
  assert.equal(current, null);
  assert.equal(navigation!.routeSearch, "?view=aar&session=verified-B");
  await act(async () =>
    navigation.navigateWorkspace(
      navigationItems.find((item) => item.id === "director")!,
    ),
  );
  assert.equal(view, "drill");
  assert.equal(mode, "adaptive");
  assert.equal(
    new URLSearchParams(window.location.search).has("session"),
    false,
  );
});

test("axe checks populated Ghost/decision path, Fusion uncertainty and Crew coordination evidence", async () => {
  const generated = spawnSync(
    testPython(),
    [
      "-c",
      `import json
from server.engine import make_scenario
from server.review import build_review
spec=make_scenario()
log=[dict(tick=1,order=0,k='designate',track='T1'),dict(tick=2,order=1,k='classify',track='T1',kind='quad',identity='hostile'),dict(tick=3,order=2,k='engage',track='T1',effector='rf_jam')]
review,card=build_review(spec,log,[],'a11y-verified',2250)
print(json.dumps(dict(id='a11y-verified',trainee='A11Y',scenario=spec,events=log,commands=[],endTick=2250,scorecard=card,created_at='2026-10-12T00:00:00Z',verified=True,**review)))`,
    ],
    { cwd: "..", encoding: "utf8" },
  );
  assert.equal(generated.status, 0, generated.stderr);
  const record = JSON.parse(generated.stdout) as TrainingRecord;
  const observation: SensorObservation = {
    version: "vyuha-0.4.0",
    tick: 30,
    track_id: "T1",
    radar: {
      available: true,
      state: "confirmed",
      detected: true,
      fresh: true,
      position: { x: 0, z: 100, altitude: 20 },
      sample_tick: 30,
    },
    eo: {
      available: true,
      level: "recognise",
      position: { x: 0, z: 100, altitude: 20 },
      silhouette: "multirotor",
      sample_tick: 30,
    },
    ir: {
      available: false,
      level: "none",
      position: null,
      silhouette: null,
      sample_tick: null,
    },
    rf: { available: true, detected: false, band_ghz: null, bearing_deg: null },
    iff: { available: true, cue: "no_reply", registration_id: null },
  };
  const result = await audit(
    <>
      <GhostPanel record={record} selectedId={null} onChoose={() => {}} />
      <GhostTimeline record={record} onJump={() => {}} />
      <AdvancedAAR record={record} />
      <FusionPanel
        observation={observation}
        config={{}}
        context={{ session_id: record.id, scenario_id: record.scenario.id }}
      />
      <CrewCoordination
        metrics={{
          accepted_actions: 3,
          attributed_actions: 3,
          unattributed_actions: 0,
          contacts_with_actions: 1,
          members: [
            {
              member_id: "a",
              callsign: "WATCH",
              role: "spotter",
              accepted_actions: 1,
              designations: 1,
              classifications: 0,
              responses: 0,
            },
          ],
          median_designation_to_classification_s: 0.5,
          median_classification_to_response_s: null,
          timing_basis: "Logical ticks",
          interpretation: "Coordination only",
        }}
      />
    </>,
  );
  assert.equal(
    result.violations.length,
    0,
    JSON.stringify(
      result.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ),
  );
  assert.match(
    document.getElementById("mount")!.textContent ?? "",
    /not calibrated probabilities/,
  );
});
