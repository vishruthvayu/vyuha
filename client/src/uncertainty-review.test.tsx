import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { execFileSync } from "node:child_process";
import { testPython } from "./test-python";
import Review from "./ObservationAssessmentReview";
import { GuidedDecision } from "./GuidedDecision";
import type { Record as TrainingRecord } from "./types";
const record = JSON.parse(
  execFileSync(
    testPython(),
    [
      "-c",
      `import json
from server.observation_missions_v2 import compile_mission
from server.engine import Simulation
from server.review import build_review
s=compile_mission({});sim=Simulation(s)
while sim.tick<150:sim.step(force=True)
assert sim.act(dict(k='defer',tick=150,order=0,track='T1',reason='affiliation_unresolved',decision_version='uncertainty-decisions-v1'))
r,card=build_review(s,sim.events,[],'defer-review',180,'completion',2700)
print(json.dumps(dict(**r,id='defer-review',scenario=s,events=sim.events,commands=[],scorecard=card,verified=True,trainee='QA',endTick=2700,executionTick=180,created_at='fixture')))`,
    ],
    { cwd: "..", encoding: "utf8" },
  ),
) as TrainingRecord;
test("Ghost exposes explicit unclassified uncertainty, keeps tactical score separate and never calls it an inferred Hold", () => {
  const html = renderToStaticMarkup(<Review record={record} />);
  assert.match(html, /evidence-assessment-v2/);
  assert.match(html, /Defer new declaration \/ affiliation unresolved/);
  assert.match(html, /No mastery awarded/);
  assert.match(html, /does not erase prior choices/);
  assert.match(html, /mission_version=2/);
  assert.doesNotMatch(html, /cannot record an unclassified defer/);
  assert.equal(record.events[0].k, "defer");
  assert.equal(record.scorecard.score, 0);
  assert.equal(
    renderToStaticMarkup(<Review record={{ ...record, verified: false }} />),
    "",
  );
});
test("new-contract decision station exposes Defer on a retained selection even without a current optical/radar position, while old contract stays unchanged", () => {
  const props = {
    phase: "running" as const,
    selected: "T1",
    state: { tick: 150, rfAvailable: true },
    vision: "day" as const,
    feedback: null,
    guidance: false,
    onGuidance: () => {},
    onAct: () => {},
  };
  const modern = renderToStaticMarkup(
    <GuidedDecision {...props} scenario={record.scenario} />,
  );
  assert.match(modern, /Record Defer/);
  assert.match(modern, /Choose your reason explicitly/);
  assert.doesNotMatch(modern, /value="affiliation_unresolved" selected/);
  const old = renderToStaticMarkup(
    <GuidedDecision
      {...props}
      scenario={{ ...record.scenario, engine_version: "vyuha-0.5.0" }}
    />,
  );
  assert.doesNotMatch(old, /Record Defer/);
});

import { actionLabel, GhostPanel } from "./Ghost";
test("tactical omission labels cannot disguise recorded Defer and its action label never becomes Observe", () => {
  assert.equal(actionLabel(record.events[0]), "Defer / affiliation unresolved");
  assert.equal(actionLabel(null, true), "No tactical action recorded");
  assert.equal(actionLabel(null), "No action recorded");
  const html = renderToStaticMarkup(
    <GhostPanel record={record} selectedId={null} onChoose={() => {}} />,
  );
  assert.match(html, /Ghost Expert · Tactical rubric/);
  assert.match(
    html,
    /Missing designation or classification does not mean no Defer was recorded/,
  );
});

test("tentative Defer shows its actual public admission requirement; a retained first observation at tick zero remains valid", () => {
  const props = {
    phase: "running" as const,
    selected: "T1",
    state: { tick: 80, rfAvailable: true },
    vision: "day" as const,
    feedback: null,
    guidance: false,
    onGuidance: () => {},
    onAct: () => {},
    scenario: record.scenario,
  };
  assert.match(
    renderToStaticMarkup(<GuidedDecision {...props} firstObservedAt={null} />),
    /no confirmed detection yet/,
  );
  assert.doesNotMatch(
    renderToStaticMarkup(<GuidedDecision {...props} firstObservedAt={0} />),
    /no confirmed detection yet/,
  );
});
