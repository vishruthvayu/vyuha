import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "./sim";
import { makeScenario } from "./scenario";
import { contactMemory, type ContactMemory } from "./useContactMemory";
import { reportedContacts } from "./observed-contacts";
import { latestCrewState, type CrewState } from "./Crew";
const empty: ContactMemory = { key: "", tick: -1, items: [] };
function sample(tick: number, seen: string[]) {
  const s = structuredClone(new Simulation(makeScenario()).state);
  s.tick = tick;
  for (const t of s.tracks) {
    t.active = true;
    t.radar = seen.includes(t.id);
    t.thermal = false;
    t.x = 1000 + tick;
    t.z = 0;
  }
  return s;
}
test("list memory prevents flicker without exposing never-observed contacts or moving stale positions", () => {
  const s = sample(10, ["T1", "T3"]),
    before = JSON.stringify(s);
  let m = contactMemory(empty, s, "session", null);
  assert.equal(JSON.stringify(s), before);
  m = contactMemory(m, sample(11, ["T3", "T4"]), "session", null);
  assert.deepEqual(
    m.items.map((i) => i.track.id),
    ["T1", "T3", "T4"],
  );
  assert.equal(m.items[0].track.x, 1010);
  assert.equal(m.items[0].available, false);
  assert.equal(
    reportedContacts(sample(11, ["T3", "T4"])).some((t) => t.id === "T1"),
    false,
  );
});
test("unselected last reports expire after2seconds; selected report remains labelled unavailable", () => {
  let m = contactMemory(empty, sample(10, ["T1", "T2"]), "session", null);
  m = contactMemory(m, sample(71, []), "session", "T1");
  assert.deepEqual(
    m.items.map((i) => i.track.id),
    ["T1"],
  );
  assert.equal(m.items[0].available, false);
  assert.equal(m.items[0].lastTick, 10);
  m = contactMemory(m, sample(72, []), "session", null);
  assert.equal(m.items.length, 0);
});
test("new exercise and rewind clear contact memory; reacquisition retains stable row order", () => {
  const m = contactMemory(empty, sample(10, ["T1", "T3"]), "A", null);
  assert.equal(contactMemory(m, sample(0, []), "A", "T1").items.length, 0);
  assert.equal(contactMemory(m, sample(20, []), "B", "T1").items.length, 0);
  const again = contactMemory(m, sample(12, ["T1", "T3"]), "A", null);
  assert.deepEqual(
    again.items.map((i) => i.track.id),
    ["T1", "T3"],
  );
  assert.ok(again.items.every((i) => i.available));
});
test("late shared polling cannot undo action attribution or a completed result", () => {
  const s = {
    id: "crew",
    tick: 100,
    attribution: [{}],
    status: "active",
  } as CrewState;
  assert.equal(latestCrewState(s, { ...s, tick: 99 }), s);
  assert.equal(latestCrewState(s, { ...s, attribution: [] }), s);
  const done = { ...s, status: "completed" };
  assert.equal(latestCrewState(done, s), done);
  const other = { ...s, id: "other" };
  assert.equal(latestCrewState(s, other), other);
});

test("equal-tick Crew controls cannot regress to an older pause snapshot", () => {
  const newer = {
    id: "crew",
    tick: 100,
    revision: 3,
    attribution: [],
    status: "active",
    paused: false,
  } as unknown as CrewState;
  assert.equal(
    latestCrewState(newer, { ...newer, revision: 2, paused: true }),
    newer,
  );
});
