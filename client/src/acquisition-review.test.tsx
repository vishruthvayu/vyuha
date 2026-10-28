import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import AcquisitionReview, {
  acquisitionDecisionEvidence,
} from "./AcquisitionReview";
import { testPython } from "./test-python";
import ReferenceRun from "./ReferenceRun";
import type { Record as TrainingRecord } from "./types";
const code = `import json\nfrom server.acquisition import make_practice\nfrom server.engine import Simulation\nfrom server.review import build_review\ns=make_practice();sim=Simulation(s)\nwhile sim.tick<150:sim.step(force=True)\nassert sim.act(dict(tick=150,order=0,k='inspect',track='T1',channel='ir',request_id='review_fixture'))\nwhile sim.tick<186:sim.step(force=True)\nassert sim.act(dict(tick=186,order=2,k='designate',track='T1'))\nassert sim.act(dict(tick=186,order=3,k='classify',track='T1',kind='quad',identity='hostile'))\nr,card=build_review(s,sim.events,[],'fixture',200,'completion',2700)\nprint(json.dumps(dict(**r,id='fixture',scenario=s,events=sim.events,commands=[],scorecard=card,verified=True,trainee='QA',endTick=2700,executionTick=200,created_at='fixture')))\n`;
const record = JSON.parse(
  execFileSync(testPython(), ["-c", code], { cwd: "..", encoding: "utf8" }),
) as TrainingRecord;
test("verified acquisition feedback uses release order and expiry at each decision, never future or stale evidence", () => {
  const first = acquisitionDecisionEvidence(record);
  assert.equal(first.length, 1);
  assert.equal(first[0].results.length, 1);
  const q = record.acquisition!.results[0];
  for (const action of [
    { ...record.events.at(-1)!, order: q.releasedOrder },
    { ...record.events.at(-1)!, tick: q.releaseTick - 1 },
    { ...record.events.at(-1)!, tick: q.expiryTick },
  ]) {
    const next = { ...record, events: [action] };
    assert.equal(acquisitionDecisionEvidence(next)[0].results.length, 0);
  }
  assert.deepEqual(
    acquisitionDecisionEvidence({ ...record, verified: false }),
    [],
  );
  const html = renderToStaticMarkup(
    <AcquisitionReview record={record} onJump={() => {}} />,
  );
  assert.match(html, /What information reached the decision/);
  assert.match(html, /Sample.*Release/s);
  assert.match(html, /Prepare a changed observation exercise/);
  assert.doesNotMatch(html, /hostile|friendly/);
  assert.equal(
    renderToStaticMarkup(
      <AcquisitionReview record={{ ...record, verified: false }} />,
    ),
    "",
  );
  const reference = renderToStaticMarkup(<ReferenceRun record={record} />);
  assert.match(reference, /policy adapter is not yet admitted/);
  assert.doesNotMatch(reference, /Run autonomous reference/);
  assert.match(
    renderToStaticMarkup(
      <ReferenceRun
        record={{
          ...record,
          scenario: { ...record.scenario, engine_version: "vyuha-0.4.0" },
        }}
      />,
    ),
    /Run autonomous reference/,
  );
});
