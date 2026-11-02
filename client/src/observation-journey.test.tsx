import test from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import Journey from "./ObservationMissionJourney";
test("mission journey separates practice/assessment admission and discards stale learner recommendations", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://qa.local" });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  const pending: { url: string; resolve: (r: Response) => void }[] = [];
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    IS_REACT_ACT_ENVIRONMENT: true,
    fetch: (url: unknown) =>
      new Promise<Response>((resolve) =>
        pending.push({ url: String(url), resolve }),
      ),
  })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      value,
      writable: true,
      configurable: true,
    });
  }
  const root = createRoot(dom.window.document.getElementById("root")!);
  const catalog = {
    templates: [
      {
        id: "night_switch",
        title: "Night investigation",
        summary: "Use a different channel",
        objectives: ["Separate availability from identity"],
        competencies: ["C02"],
        default_conditions: { night: true, terrain: "urban" },
      },
    ],
    missions: [],
  };
  const progress = (name: string, trainee: string) => ({
    version: "observation-journey-v1",
    trainee,
    window: {
      included_sessions: 1,
      total_sessions: 1,
      limit: 32,
      truncated: false,
      ordering:
        "completed_at (legacy fallback created_at) descending, session_id descending",
    },
    competencies: [
      {
        id: "C02",
        title: "Separate affiliation",
        state: "practice-only",
        latest_practice: null,
        latest_independent: null,
        independent_contexts: 0,
        evidence: [],
      },
    ],
    candidates: [],
    limitations: ["No mastery inferred."],
    recommendation: {
      competency: "C02",
      template: "civil_restraint",
      mode: "practice",
      policy: "longitudinal-evidence-policy-v1",
      seed: 42,
      mission_version: 3,
      site: "open_campus",
      novelty: "Unobserved template context",
      rank: [2, 0, 0, 1, 1],
      reason: name,
      href: "/?mission_template=civil_restraint&mission_version=3&mission_site=open_campus",
      based_on: [],
    },
  });
  const respond = async (p: (typeof pending)[number], data: unknown) =>
    act(async () => {
      p.resolve(
        new Response(JSON.stringify(data), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    });
  try {
    await act(async () => root.render(<Journey trainee="FIRST" />));
    await respond(pending[0], catalog);
    await respond(pending[1], progress("First learner", "FIRST"));
    assert.match(dom.window.document.body.textContent!, /First learner/);
    assert.match(
      dom.window.document
        .querySelector(".mission-brief-grid a")!
        .getAttribute("href")!,
      /mission_mode=practice/,
    );
    await act(async () =>
      dom.window.document
        .querySelectorAll<HTMLInputElement>("input[type=radio]")[1]
        .click(),
    );
    assert.match(
      dom.window.document
        .querySelector(".mission-brief-grid a")!
        .getAttribute("href")!,
      /mission_mode=assessment/,
    );
    await act(async () => root.render(<Journey trainee="SECOND" />));
    assert.doesNotMatch(dom.window.document.body.textContent!, /First learner/);
    const second = pending.find((p) => p.url.includes("SECOND"))!;
    await act(async () => root.render(<Journey trainee="THIRD" />));
    await respond(second, progress("Stale second learner", "SECOND"));
    assert.doesNotMatch(
      dom.window.document.body.textContent!,
      /Stale second learner/,
    );
    await respond(
      pending.find((p) => p.url.includes("THIRD"))!,
      progress("Current third learner", "THIRD"),
    );
    assert.match(
      dom.window.document.body.textContent!,
      /Current third learner/,
    );
    assert.match(
      dom.window.document.body.textContent!,
      /Readiness is not established/,
    );
    assert.match(
      dom.window.document.body.textContent!,
      /Practice does not supply independent evidence/,
    );
    assert.match(
      dom.window.document
        .querySelector(".journey-next-exercise a")!
        .getAttribute("href")!,
      /mission_site=open_campus/,
    );
    await act(async () => root.render(<Journey trainee="FOURTH" />));
    await respond(
      pending.find((p) => p.url.includes("FOURTH"))!,
      progress("Wrong learner evidence", "THIRD"),
    );
    assert.doesNotMatch(
      dom.window.document.body.textContent!,
      /Wrong learner evidence/,
    );
    assert.match(
      dom.window.document.body.textContent!,
      /does not match this learner/,
    );
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, d] of saved)
      if (d) Object.defineProperty(globalThis, key, d);
      else Reflect.deleteProperty(globalThis, key);
  }
});
