import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  GuidedDecision,
  attemptOutcome,
  decisionRecord,
  decisionStep,
  effectorStates,
  feedbackText,
  shapeEvidence,
  type ActionFeedback,
  type DecisionAction,
} from "./GuidedDecision";
import { replay } from "./sim";
import { makeScenario } from "./scenario";
import { ObservedPoseBuffer } from "./render-contacts";
import type { DoctrineRules, Scenario, Snapshot, Track } from "./types";
import type { SensorObservation } from "./sensors-v2";

const rules: DoctrineRules = {
  rf_range: 1000,
  kinetic_range: 800,
  restricted: { enabled: true, x_lt: -300, z_gt: 200 },
  effectors: ["hold", "rf_jam", "kinetic"],
  risk_weights: { quad: 1 },
  asset_risk: 1,
  hold_any_range: true,
};
const scenario: Pick<Scenario, "doctrine" | "response_model"> = {
  doctrine: {
    id: "test",
    version: 1,
    name: "Test pack",
    description: "fixture",
    example_values: true,
    rules,
    defaults: { fog: 0, night: false, mix: [] },
    allowed_tactics: ["DIRECT"],
    rubric: { detect: 25, classify: 25, prioritise: 15, engage: 35 },
  },
  response_model: {
    version: 1,
    illustrative_training_assumptions: true,
    kinetic_ammo: 8,
    kinetic_cooldown_ticks: 30,
    kinetic_delay_ticks: 15,
    kinetic_success_probability: 0.85,
    jammer_channels: 2,
    jammer_duration_ticks: 90,
    jammer_success_probability: 0.75,
  },
};
const base = replay(makeScenario(812), [], 150).snapshot().tracks[0];
function observation(
  level: "none" | "detect" | "recognise" | "identify",
  silhouette: "bird" | "fixed_wing" | "multirotor" | null,
): SensorObservation {
  const position = { x: 300, z: 500, altitude: 40 };
  const optical = {
    available: true,
    level,
    position: level === "none" ? null : position,
    silhouette,
    sample_tick: 150,
  };
  return {
    version: "vyuha-0.4.0",
    tick: 150,
    track_id: "T4",
    radar: {
      available: true,
      state: "confirmed",
      detected: true,
      fresh: true,
      position,
      sample_tick: 150,
    },
    eo: optical,
    ir: optical,
    rf: { available: true, detected: true, band_ghz: 2.4, bearing_deg: 31 },
    iff: { available: true, cue: "no_reply", registration_id: null },
  };
}
function contact(overrides: Partial<Track> = {}): Track {
  return {
    ...base,
    id: "T4",
    active: true,
    x: 300,
    z: 500,
    altitude: 40,
    detected: 120,
    designated: null,
    classification: null,
    declared: null,
    attempts: [],
    rules,
    observation: observation("recognise", "multirotor"),
    ...overrides,
  };
}
const state: Pick<Snapshot, "tick" | "rfAvailable" | "response"> = {
  tick: 150,
  rfAvailable: true,
  response: {
    version: 1,
    kinetic_ammo_remaining: 8,
    kinetic_ready_tick: 0,
    jammer_channels_in_use: 0,
    pending: [],
    attempts: [],
  },
};

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
type Props = Parameters<typeof GuidedDecision>[0];
async function mount(document: Document, props: Partial<Props> = {}) {
  const root: Root = createRoot(document.getElementById("root")!);
  const acts: DecisionAction[] = [];
  const target = props.target === undefined ? contact() : props.target;
  const all: Props = {
    phase: "running",
    selected: "T4",
    target,
    record: decisionRecord(target),
    state,
    scenario,
    vision: "thermal",
    feedback: null,
    guidance: false,
    onGuidance: () => {},
    onAct: (a) => acts.push(a),
    ...props,
  };
  await act(async () => root.render(<GuidedDecision {...all} />));
  return {
    root,
    acts,
    rerender: (next: Partial<Props>) =>
      act(async () => root.render(<GuidedDecision {...all} {...next} />)),
  };
}
const click = async (el: Element | null) => {
  assert.ok(el, "element exists");
  await act(async () =>
    (el as HTMLElement).dispatchEvent(
      new el.ownerDocument.defaultView!.MouseEvent("click", {
        bubbles: true,
      }),
    ),
  );
};
const button = (document: Document, text: string) =>
  [...document.querySelectorAll("button")].find((b) =>
    b.textContent!.includes(text),
  ) as HTMLButtonElement | undefined;

test("decision steps follow the trainee's own recorded decisions", () => {
  const t = contact();
  assert.equal(decisionStep(null, t, decisionRecord(t), null), "select");
  assert.equal(decisionStep("T4", t, decisionRecord(t), null), "designate");
  const d = contact({ designated: 130 });
  assert.equal(decisionStep("T4", d, decisionRecord(d), null), "classify");
  const c = contact({
    designated: 130,
    classification: "quad",
    declared: "hostile",
  });
  assert.equal(decisionStep("T4", c, decisionRecord(c), null), "respond");
  assert.equal(
    decisionStep("T4", c, decisionRecord(c), "classify"),
    "classify",
  );
  const r = contact({
    designated: 130,
    classification: "quad",
    declared: "hostile",
    attempts: ["rf_jam"],
  });
  assert.equal(decisionStep("T4", r, decisionRecord(r), null), "outcome");
  assert.equal(decisionStep("T4", r, decisionRecord(r), "respond"), "respond");
  // A contact that stops being reported after a response shows its outcome.
  assert.equal(
    decisionStep("T4", undefined, decisionRecord(r), null),
    "outcome",
  );
  assert.equal(
    decisionStep("T4", undefined, decisionRecord(t), null),
    "select",
  );
});

test(
  "classification starts with no answer and confirms exactly the trainee's choice",
  withDom(async (document) => {
    const target = contact({ designated: 130 });
    const { acts } = await mount(document, { target });
    const radios = [
      ...document.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
    ];
    assert.equal(radios.length, 7, "four types and three identities");
    assert.ok(
      radios.every((r) => !r.checked),
      "nothing is pre-selected",
    );
    const confirm = button(document, "Confirm classification")!;
    assert.equal(confirm.disabled, true);
    assert.match(document.body.textContent!, /Choose a type and an identity\./);
    assert.ok(
      confirm.getAttribute("aria-describedby"),
      "the reason is programmatically linked",
    );
    await click(radios.find((r) => r.value === "fiber_fpv")!);
    assert.equal(confirm.disabled, true, "identity still missing");
    await click(radios.find((r) => r.value === "neutral")!);
    assert.equal(confirm.disabled, false);
    await click(confirm);
    assert.deepEqual(acts, [
      { k: "classify", track: "T4", kind: "fiber_fpv", identity: "neutral" },
    ]);
    // Every option carries a one-line explanation.
    for (const card of document.querySelectorAll(".choice-card"))
      assert.ok(card.querySelector("small")!.textContent!.length > 10);
  }),
);

test(
  "hidden kind, identity and RF truth cannot change what the dock shows",
  withDom(async (document) => {
    const rendered = new Set<string>();
    for (const kind of ["quad", "fiber_fpv", "bird", "fixed_wing"] as const)
      for (const identity of ["hostile", "friendly", "neutral"] as const)
        for (const designated of [null, 130]) {
          const target = contact({
            kind,
            identity,
            rf: kind === "quad",
            designated,
          });
          const { root } = await mount(document, { target });
          // useId differs per root; compare everything else.
          const html = document
            .getElementById("root")!
            .innerHTML.replace(/(id|name|aria-describedby)="[^"]*"/g, "$1");
          rendered.add(`${designated}:${html}`);
          await act(async () => root.unmount());
        }
    assert.equal(rendered.size, 2, "one rendering per recorded decision state");
  }),
);

test(
  "disabled actions explain themselves in visible text",
  withDom(async (document) => {
    await mount(document, { phase: "paused" });
    assert.equal(button(document, "Designate T4")!.disabled, true);
    assert.match(
      document.body.textContent!,
      /Exercise is paused\. Resume to make decisions\./,
    );
  }),
);

test("response eligibility uses published reach, the restricted zone and public resources", () => {
  const near = contact({
    designated: 1,
    classification: "quad",
    declared: "hostile",
  });
  const [hold, jam, kinetic] = effectorStates(
    "running",
    near,
    scenario,
    state.response,
    150,
  );
  assert.equal(hold.reach, undefined, "hold works at any range here");
  assert.equal(jam.reach, 1000);
  assert.equal(jam.range, 583);
  assert.ok(jam.facts.includes("2/2 channels free"));
  assert.equal(kinetic.reach, 800);
  assert.ok(kinetic.facts.includes("8 rounds"));
  assert.ok([hold, jam, kinetic].every((e) => !e.disabled && !e.reason));
  const far = contact({ ...near, x: 0, z: 950 });
  const [, farJam, farKinetic] = effectorStates(
    "running",
    far,
    scenario,
    state.response,
    150,
  );
  assert.equal(farJam.reason, undefined);
  assert.match(farKinetic.reason!, /Beyond reach/);
  const zone = contact({ ...near, x: -400, z: 300 });
  assert.match(
    effectorStates("running", zone, scenario, state.response, 150)[2].reason!,
    /restricted zone/,
  );
  const busy = effectorStates(
    "running",
    near,
    scenario,
    {
      ...state.response!,
      jammer_channels_in_use: 2,
      kinetic_ammo_remaining: 0,
    },
    150,
  );
  assert.match(busy[1].reason!, /channels are busy/);
  assert.match(busy[2].reason!, /No rounds remain/);
  const unclassified = effectorStates(
    "running",
    contact({ designated: 1 }),
    scenario,
    state.response,
    150,
  );
  assert.ok(unclassified.every((e) => e.disabled));
});

test(
  "the respond step shows reach against the observed range and sends the chosen effector",
  withDom(async (document) => {
    const target = contact({
      designated: 130,
      classification: "quad",
      declared: "hostile",
    });
    const { acts } = await mount(document, { target });
    const cards = [...document.querySelectorAll(".effector-card")];
    assert.equal(cards.length, 3);
    assert.match(cards[1].textContent!, /583 m observed · reach 1000 m/);
    assert.match(cards[1].textContent!, /2\/2 channels free/);
    assert.match(document.body.textContent!, /not guaranteed/);
    await click(cards[1]);
    assert.deepEqual(acts, [{ k: "engage", track: "T4", effector: "rf_jam" }]);
  }),
);

test(
  "every action is acknowledged: submitted, accepted or not accepted",
  withDom(async (document) => {
    const action: DecisionAction = { k: "designate", track: "T4" };
    const f = (status: ActionFeedback["status"]): ActionFeedback => ({
      seq: 1,
      action,
      status,
      tick: 300,
      reason: status === "rejected" ? "It lost its observation." : undefined,
    });
    const view = await mount(document, { feedback: f("submitted") });
    const status = () => document.querySelector('[role="status"]')!.textContent;
    assert.match(status()!, /Designation of T4: submitted/);
    await view.rerender({ feedback: f("accepted") });
    assert.match(status()!, /accepted at 00:10/);
    await view.rerender({ feedback: f("rejected") });
    assert.match(status()!, /not accepted\. It lost its observation\./);
    assert.match(feedbackText(f("accepted")), /Designation of T4/);
  }),
);

test(
  "the outcome comes from the public response state, not from guesses",
  withDom(async (document) => {
    const record = decisionRecord(
      contact({
        designated: 130,
        classification: "quad",
        declared: "hostile",
        attempts: ["rf_jam"],
      }),
    );
    const attempt = {
      id: "R1",
      track: "T4",
      effector: "rf_jam" as const,
      tick: 160,
      order: 2,
      due_tick: 250,
      status: "pending" as const,
      result_tick: null,
    };
    const view = await mount(document, {
      record,
      state: {
        ...state,
        response: { ...state.response!, attempts: [attempt] },
      },
    });
    assert.match(
      document.body.textContent!,
      /under way · effect decided at 00:08/,
    );
    await view.rerender({
      target: undefined,
      state: {
        ...state,
        response: {
          ...state.response!,
          attempts: [{ ...attempt, status: "resolved", result_tick: 250 }],
        },
      },
    });
    assert.match(
      document.body.textContent!,
      /took effect at 00:08: contact neutralised/,
    );
    for (const status of [
      "no_effect",
      "hold",
      "blocked_ammo",
      "blocked_cooldown",
      "blocked_channels",
      "unavailable",
      "target_inactive",
    ] as const)
      assert.ok(attemptOutcome({ ...attempt, status }).text.length > 10);
  }),
);

test(
  "guidance is optional and explains process without naming an answer",
  withDom(async (document) => {
    let on = false;
    const view = await mount(document, {
      guidance: false,
      onGuidance: (v) => (on = v),
    });
    assert.equal(document.querySelector(".guided-coach"), null);
    await click(button(document, "Guidance")!);
    assert.equal(on, true);
    await view.rerender({ guidance: true });
    const coach = document.querySelector(".guided-coach")!.textContent!;
    assert.match(coach, /Designating/);
    assert.doesNotMatch(coach, /hostile|friendly|neutral|correct/i);
  }),
);

test("shape evidence reflects only the active camera's observation level", () => {
  const t = contact();
  assert.deepEqual(shapeEvidence(t, "thermal"), {
    text: "Multirotor",
    detail: "IR · recognise",
  });
  const detect = contact({ observation: observation("detect", null) });
  assert.equal(shapeEvidence(detect, "day").text, "Unresolved shape");
  const none = contact({ observation: observation("none", null) });
  assert.equal(shapeEvidence(none, "day").text, "Not seen by DAY TV");
  const night = observation("identify", "fixed_wing");
  night.eo = { ...night.eo, available: false, level: "none", position: null };
  assert.equal(
    shapeEvidence(contact({ observation: night }), "day").text,
    "DAY TV unavailable",
  );
  assert.equal(
    shapeEvidence(contact({ observation: night }), "thermal").text,
    "Fixed-wing",
  );
});

test("displayed motion is steady for a steadily observed contact (no 10 Hz surge and stall)", () => {
  const buffer = new ObservedPoseBuffer();
  const speed = 15;
  let tick = 0;
  let last: number | null = null;
  const speeds: number[] = [];
  for (let frame = 0; frame < 600; frame++) {
    const t = frame / 60;
    const sampleTick = Math.floor((t * 30) / 3) * 3;
    if (sampleTick !== tick) tick = sampleTick;
    buffer.update(
      [
        {
          id: "T1",
          x: (speed * tick) / 30,
          y: 30,
          z: 500,
          shape: "multirotor",
        },
      ],
      tick,
      "ctx",
    );
    buffer.forEachFrame(1 / 60, (p) => {
      if (frame > 60 && last !== null) speeds.push((p.displayX - last) * 60);
      last = p.displayX;
    });
  }
  const mean = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  const sd = Math.sqrt(
    speeds.reduce((a, b) => a + (b - mean) ** 2, 0) / speeds.length,
  );
  assert.ok(Math.abs(mean - speed) < 0.2, `mean ${mean}`);
  // Baseline exponential chasing measured SD 8.75 m/s, min 3.6, max 32.
  assert.ok(sd < 1, `display speed SD ${sd}`);
  assert.ok(Math.min(...speeds) > 10 && Math.max(...speeds) < 20);
});

test("pausing freezes cosmetic logical time; it never runs past one publish interval", () => {
  const buffer = new ObservedPoseBuffer();
  buffer.update([{ id: "T1", x: 0, y: 1, z: 1, shape: "bird" }], 300, "ctx");
  for (let i = 0; i < 600; i++) buffer.forEachFrame(1 / 60, () => {});
  assert.equal(buffer.displayTick, 303);
  buffer.update([{ id: "T1", x: 0, y: 1, z: 1, shape: "bird" }], 303, "ctx");
  assert.equal(buffer.displayTick, 303);
});

test("a selected contact never sends the live camera back to the default sector", async () => {
  const { liveCameraMode } = await import("./camera-view");
  const cue = { x: 10, z: 400, altitude: 30 };
  assert.equal(liveCameraMode(true, "T4", cue), "track");
  assert.equal(liveCameraMode(false, "T4", cue), "cue");
  assert.equal(liveCameraMode(false, "T4", null), "hold");
  assert.equal(liveCameraMode(false, null, null), "sector");
});

test("view blends converge on a moving goal in bounded time without angular jumps", async () => {
  const THREE = await import("three");
  const { ViewBlend, slewSeconds } = await import("./camera-view");
  const origin = new THREE.Vector3(0, 2, 0);
  const aim = new THREE.Vector3(0, 2, 500);
  const goal = new THREE.Vector3(500, 2, 0);
  const duration = slewSeconds(Math.PI / 2);
  assert.ok(duration >= 0.25 && duration <= 0.9);
  const blend = new ViewBlend();
  blend.start(aim, duration);
  let previous = aim.clone().sub(origin);
  let frames = 0;
  while (blend.active && frames < 120) {
    goal.z += 0.25; // the target keeps moving during the slew
    blend.apply(aim, goal, origin, 1 / 60);
    const dir = aim.clone().sub(origin);
    assert.ok(Math.abs(dir.length() - 500) < 1, `radius ${dir.length()}`);
    const step = THREE.MathUtils.radToDeg(dir.angleTo(previous));
    assert.ok(step < 4, `${step.toFixed(2)}° in one frame`);
    previous = dir;
    frames++;
  }
  assert.equal(blend.active, false);
  assert.ok(frames <= Math.ceil(duration * 60) + 1);
  assert.ok(aim.distanceTo(goal) < 1e-6);
});
