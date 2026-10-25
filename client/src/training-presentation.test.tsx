import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { briefingSnapshot, arrivalCamera } from "./training-presentation";
import { makeScenario } from "./scenario";
import { Simulation } from "./sim";
import { TrainingWelcome } from "./TrainingWelcome";

test("briefing strips all roster, clutter, messages and response evidence without changing authoritative snapshot", () => {
  const state = new Simulation(makeScenario()).snapshot();
  state.messages = [{ tick: 0, track: "SECRET", text: "Hidden identity" }];
  const original = structuredClone(state),
    view = briefingSnapshot(state);
  assert.deepEqual(state, original);
  assert.deepEqual(view.tracks, []);
  assert.deepEqual(view.falseContacts, []);
  assert.deepEqual(view.messages, []);
  assert.equal(view.response, undefined);
  assert.equal(view.tick, 0);
  assert.equal(view.paused, true);
  assert.doesNotMatch(JSON.stringify(view), /SECRET|Hidden identity/);
});
test("authored arrival is bounded, roster-independent and stationary for reduced motion", () => {
  for (const terrain of ["urban_outpost", "rural_forward_base", undefined]) {
    const first = arrivalCamera(terrain, 0, false),
      last = arrivalCamera(terrain, 7, false);
    assert.deepEqual(arrivalCamera(terrain, -20, false), first);
    assert.deepEqual(arrivalCamera(terrain, NaN, false), first);
    assert.deepEqual(arrivalCamera(terrain, 100, false), last);
    assert.deepEqual(arrivalCamera(terrain, 0, true), last);
    assert.deepEqual(arrivalCamera(terrain, 300, true), last);
    assert.ok(
      [...first.position, ...last.position, ...last.aim].every(Number.isFinite),
    );
    assert.ok(
      Math.hypot(...last.position.map((n, i) => n - first.position[i])) < 50,
    );
  }
});
test("briefing offers one explicit phase-correct action and discloses non-evidentiary scenery", () => {
  const initial = renderToStaticMarkup(
    <TrainingWelcome onPrepare={() => {}} />,
  );
  assert.equal((initial.match(/<button/g) ?? []).length, 1);
  assert.match(initial, /Prepare adaptive drill/);
  assert.match(initial, /Orientation scenery/);
  assert.doesNotMatch(initial, /fps|score|success probability|<canvas|<img/);
  const ready = renderToStaticMarkup(
    <TrainingWelcome
      prepared
      title="Frozen lesson"
      label="Start adaptive drill"
      contacts={3}
      duration={60}
      onPrepare={() => {}}
    />,
  );
  assert.equal((ready.match(/<button/g) ?? []).length, 1);
  assert.match(ready, /Start adaptive drill/);
  assert.match(ready, /Contact-free environment preview/);
  assert.match(ready, /3 contacts/);
});
