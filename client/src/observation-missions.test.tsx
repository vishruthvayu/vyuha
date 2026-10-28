import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { execFileSync } from "node:child_process";
import { testPython } from "./test-python";
import { replay } from "./sim";
import ObservationMissionStudio from "./ObservationMissionStudio";
import type { Scenario, Action } from "./types";
const code = `import json\nfrom server.observation_missions import compile_mission,MissionRequest,TEMPLATES\nfrom server.engine_v3 import Simulation\nout=[]\nfor template in TEMPLATES:\n s=compile_mission(MissionRequest(template=template));sim=Simulation(s)\n while sim.tick<150:sim.step(force=True)\n observed=[t for t in sim.tracks if t['active'] and t['observation']['radar']['position'] is not None]\n target=observed[0]['id'];assert sim.act(dict(tick=150,order=sim.next_order,k='inspect',track=target,channel='ir',request_id='compiled_probe'))\n while sim.tick<210:sim.step(force=True)\n out.append(dict(scenario=s,events=sim.events,acquisition=sim.acquisition_snapshot()))\nprint(json.dumps(out))`;
test("authored mission metadata preserves exact Python/TypeScript publication and policy timing for three different challenges", () => {
  const fixtures = JSON.parse(
    execFileSync(testPython(), ["-c", code], { cwd: "..", encoding: "utf8" }),
  ) as { scenario: Scenario; events: Action[]; acquisition: unknown }[];
  assert.equal(fixtures.length, 3);
  for (const f of fixtures) {
    const s = replay(f.scenario, f.events, 210);
    assert.deepEqual(s.snapshot().acquisition, f.acquisition, f.scenario.title);
    assert.equal(
      f.scenario.observation_mission?.assessment_version,
      "evidence-assessment-v1",
    );
    assert.equal("rehearsal" in f.scenario, false);
  }
});
test("authoring entry exposes accessible frozen-input controls and explicitly separates rehearsal from human guarantees", () => {
  const html = renderToStaticMarkup(
    React.createElement(ObservationMissionStudio),
  );
  for (const label of [
    "Learning objectives",
    "Duration (seconds)",
    "Training evidence mode",
    "Evidence lifetime (ticks)",
    "Compile and rehearse",
  ])
    assert.ok(html.includes(label), label);
  assert.match(html, /not guaranteed human notice or solvability/);
  assert.match(html, /Practice and independent evidence stay separate/);
});
