import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import React, { act } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import ObservationAssessmentReview, {
  type ObservationAssessment,
} from "./ObservationAssessmentReview";
import type { Record as TrainingRecord, TimelineItem } from "./types";
import { testPython } from "./test-python";
const code = `import json
from server.observation_missions import compile_mission
from server.engine import Simulation
from server.review import build_review
s=compile_mission(dict(template='night_switch',night=False,seed=482913))
sim=Simulation(s)
while sim.tick<150:sim.step(force=True)
assert sim.act(dict(k='designate',track='T1',tick=150,order=sim.next_order))
assert sim.act(dict(k='inspect',track='T1',tick=150,order=sim.next_order,channel='ir',request_id='ui_educational'))
while sim.tick<186:sim.step(force=True)
assert sim.act(dict(k='classify',track='T1',tick=186,order=sim.next_order,kind='quad',identity='hostile'))
assert sim.act(dict(k='engage',track='T1',tick=186,order=sim.next_order,effector='rf_jam'))
r,card=build_review(s,sim.events,[],'assessment-ui',200,'completion',2700)
print(json.dumps(dict(**r,id='assessment-ui',scenario=s,events=sim.events,commands=[],scorecard=card,verified=True,trainee='QA',endTick=2700,executionTick=200,created_at='fixture')))
`;
const record = JSON.parse(
  execFileSync(testPython(), ["-c", code], { cwd: "..", encoding: "utf8" }),
) as TrainingRecord & { observation_assessment: ObservationAssessment };

test("educational review separates actual evidence support from an unchanged perfect rubric and hides unverified/mismatched reports", () => {
  const original = structuredClone(record);
  const html = renderToStaticMarkup(
    <ObservationAssessmentReview record={record} onJump={() => {}} />,
  );
  assert.match(html, /original 100\/100 rubric result is preserved/);
  assert.match(
    html,
    /HOSTILITY_NOT_ESTABLISHED|No positive hostile-intent cue/,
  );
  assert.match(html, /unclassified defer choice/);
  assert.match(html, /inactivity is not interpreted as justified uncertainty/);
  assert.match(html, /Choices are not confidence statements/);
  assert.match(html, /No mastery awarded/);
  assert.match(html, /mission_template=civil_restraint/);
  assert.equal(
    renderToStaticMarkup(
      <ObservationAssessmentReview record={{ ...record, verified: false }} />,
    ),
    "",
  );
  assert.equal(
    renderToStaticMarkup(
      <ObservationAssessmentReview
        record={{
          ...record,
          observation_assessment: {
            ...record.observation_assessment,
            session_id: "another",
          },
        }}
      />,
    ),
    "",
  );
  assert.deepEqual(record, original);
});

test("reconstruction control carries the exact before-action order and keeps competency practice links traceable", async () => {
  const dom = new JSDOM('<main id="root"></main>', { url: "http://qa.local" });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      value,
      configurable: true,
      writable: true,
    });
  }
  const root = createRoot(dom.window.document.getElementById("root")!);
  const jumps: TimelineItem[] = [];
  try {
    await act(async () =>
      root.render(
        <ObservationAssessmentReview
          record={record}
          onJump={(e) => jumps.push(e)}
        />,
      ),
    );
    const button = dom.window.document.querySelector(
      "button",
    ) as HTMLButtonElement;
    await act(async () => button.click());
    assert.equal(jumps.length, 1);
    assert.equal(jumps[0].tick, 150);
    assert.equal(jumps[0].order, 0);
    assert.equal(jumps[0].seek_before, true);
    assert.equal(jumps[0].track_id, "T1");
    const links = [
      ...dom.window.document.querySelectorAll(".assessment-competency-strip a"),
    ].map((a) => a.getAttribute("href"));
    assert.deepEqual(links, [
      "/academy?competency=C01",
      "/academy?competency=C02",
      "/academy?competency=C05",
    ]);
    const follow = dom.window.document.querySelector(
      ".assessment-next-mission a",
    )!;
    assert.match(follow.getAttribute("href")!, /mission_mode=practice/);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, d] of saved) {
      if (d) Object.defineProperty(globalThis, key, d);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
