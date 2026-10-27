import test from "node:test";
import assert from "node:assert/strict";
import React, { act, useState } from "react";
import { JSDOM } from "jsdom";
import { renderToStaticMarkup } from "react-dom/server";
import axe from "axe-core";
import { MissionBriefing } from "./MissionBriefing";
import type { SurveyCommand } from "./world-survey";

async function mounted(
  run: (q: {
    document: Document;
    click: (name: string) => Promise<void>;
    render: (prepared?: boolean, busy?: boolean) => Promise<void>;
    launches: () => number;
    commands: SurveyCommand[];
  }) => Promise<void>,
) {
  const dom = new JSDOM(
    '<!doctype html><html lang="en"><head><title>Mission briefing QA</title></head><body><main><h1>Training</h1><div id="root"></div></main></body></html>',
    { url: "http://qa.local", runScripts: "outside-only" },
  );
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [k, v] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    saved.set(k, Object.getOwnPropertyDescriptor(globalThis, k));
    Object.defineProperty(globalThis, k, {
      value: v,
      configurable: true,
      writable: true,
    });
  }
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(dom.window.document.getElementById("root")!);
  let launches = 0;
  const commands: SurveyCommand[] = [];
  function Harness({ prepared, busy }: { prepared: boolean; busy: boolean }) {
    const [survey, setSurvey] = useState(false);
    return (
      <MissionBriefing
        title="Identify the evidence gap"
        objective="Compare available reports; retain uncertainty when they do not establish identity."
        instructions={[
          "Compare the original reports before deciding.",
          "<script>not executable</script>",
        ]}
        prepared={prepared}
        busy={busy}
        label={prepared ? "Start practice" : "Prepare practice"}
        contacts={4}
        duration={60}
        environmentName="Logistics Quarter"
        dayNight="Day · light fog"
        assistance="Full guidance · frozen"
        survey={survey}
        onSurveyChange={setSurvey}
        onSurveyCommand={(c) => commands.push(c)}
        onPrepare={() => launches++}
      />
    );
  }
  const render = async (prepared = false, busy = false) => {
    await act(async () =>
      root.render(<Harness prepared={prepared} busy={busy} />),
    );
  };
  const click = async (name: string) => {
    const button = [...dom.window.document.querySelectorAll("button")].find(
      (b) => (b.getAttribute("aria-label") ?? b.textContent!.trim()) === name,
    );
    assert.ok(button, name);
    await act(async () => button.click());
  };
  try {
    await render();
    await run({
      document: dom.window.document,
      click,
      render,
      launches: () => launches,
      commands,
    });
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [k, v] of saved) {
      if (v) Object.defineProperty(globalThis, k, v);
      else Reflect.deleteProperty(globalThis, k);
    }
  }
}

test("public scenery survey and keyboard camera controls never dispatch Start, and the primary launch node stays mounted", () =>
  mounted(async (q) => {
    const primary = q.document.querySelector(".mission-launch-action");
    assert.equal(
      q.document.querySelectorAll(".mission-survey-toggle").length,
      1,
    );
    assert.ok(
      q.document.querySelector(".mission-launch-bar > .mission-survey-toggle"),
    );
    assert.equal(q.launches(), 0);
    assert.match(
      q.document.querySelector(".mission-briefing-main")!.textContent!,
      /Compare the original reports before deciding/,
    );
    assert.equal(q.document.querySelector("script"), null);
    assert.doesNotMatch(
      q.document.body.textContent!,
      /Planned contacts|60 seconds/,
    );
    await q.click("Explore environment");
    assert.match(
      q.document.activeElement!.textContent!,
      /Explore Logistics Quarter/,
    );
    assert.equal(q.document.querySelector(".mission-launch-action"), primary);
    assert.match(
      q.document.body.textContent!,
      /public environment preview, not a sensor observation/,
    );
    await q.click("Turn view left");
    await q.click("Move view closer");
    await q.click("Reset environment view");
    assert.deepEqual(q.commands, ["left", "closer", "reset"]);
    assert.equal(q.launches(), 0);
    await q.click("Return to briefing");
    assert.equal(q.launches(), 0);
    assert.match(
      q.document.activeElement!.textContent!,
      /Identify the evidence gap/,
    );
    await q.click("Prepare practice");
    assert.equal(q.launches(), 1);
    await q.render(true);
    assert.equal(q.document.querySelector(".mission-launch-action"), primary);
    assert.match(q.document.body.textContent!, /4/);
    assert.match(q.document.body.textContent!, /60 seconds/);
    await q.click("Start practice");
    assert.equal(q.launches(), 2);
  }));

test("busy preparation/start guards actions and communicates the actual phase", () =>
  mounted(async (q) => {
    await q.render(false, true);
    assert.equal(
      (q.document.querySelector(".mission-launch-action") as HTMLButtonElement)
        .disabled,
      true,
    );
    await q.click("Preparing your exercise…");
    assert.equal(q.launches(), 0);
    await q.render(true, true);
    assert.match(q.document.body.textContent!, /Starting exercise…/);
    await q.click("Starting exercise…");
    assert.equal(q.launches(), 0);
    await q.render(true, false);
    await q.click("Explore environment");
    await q.render(true, true);
    await q.click("Turn view right");
    assert.deepEqual(q.commands, []);
  }));

test("populated briefing and survey expose named keyboard controls and pass structural axe", () =>
  mounted(async (q) => {
    await q.render(true);
    const view = q.document.defaultView as unknown as {
      eval: (s: string) => void;
      axe: typeof axe;
    };
    view.eval(axe.source);
    for (const survey of [false, true]) {
      if (survey) await q.click("Explore environment");
      const results = await view.axe.run(q.document, {
        rules: { "color-contrast": { enabled: false } },
      });
      assert.equal(
        results.violations.length,
        0,
        JSON.stringify(results.violations),
      );
    }
  }));

test("briefing renders input as text, omits malformed optional facts and has no implicit launch", () => {
  let launched = 0;
  const html = renderToStaticMarkup(
    <MissionBriefing
      prepared
      title={"<img src=x onerror=alert(1)>"}
      duration={NaN}
      contacts={-1}
      environmentName="<script>world</script>"
      dayNight="Day"
      survey={false}
      onSurveyChange={() => {}}
      onPrepare={() => launched++}
    />,
  );
  assert.equal(launched, 0);
  assert.doesNotMatch(html, /<img|<script>|NaN|Planned contacts|Exercise time/);
  const fallback = renderToStaticMarkup(
    <MissionBriefing
      environmentName="Public environment"
      dayNight="Day"
      survey={false}
      onSurveyChange={() => {}}
    />,
  );
  assert.match(fallback, /disabled/);
  assert.doesNotMatch(fallback, /quiz|correct answer|mastery/i);
});
