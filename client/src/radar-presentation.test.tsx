import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { Radar } from "./Radar";
import { radarPicture } from "./radar-presentation";
import { replay } from "./sim";
import { makeScenario } from "./scenario";
import { observeSensors, type SensorObservation } from "./sensors-v2";
function snapshot() {
  const s = replay(makeScenario(7), [], 210).snapshot();
  const t = {
    ...s.tracks[0],
    active: true,
    x: 9000,
    z: -7000,
    radar: true,
    thermal: true,
  };
  const o = observeSensors(1, 210, 0, t, { night: false, fog: 0 }).observation;
  o.radar = {
    available: true,
    state: "confirmed",
    fresh: true,
    detected: true,
    position: { x: 300, z: 900, altitude: 20 },
    sample_tick: 210,
  };
  o.ir.position = { x: 500, z: 100, altitude: 10 };
  t.observation = o;
  s.tracks = [t];
  s.radarStatus = "normal";
  s.jammed = false;
  return s;
}
function documentOf(s = snapshot()) {
  return new JSDOM(
    renderToStaticMarkup(
      <Radar state={s} selected={null} onSelect={() => {}} />,
    ),
  ).window.document;
}
test("Radar geometry uses only radar reports, not canonical/EO/IR positions or hidden identity", () => {
  const s = snapshot(),
    before = structuredClone(s);
  const p = radarPicture(s);
  assert.equal(p.contacts[0].x, 300);
  assert.equal(p.contacts[0].z, 900);
  const baseline = structuredClone(p);
  s.tracks[0].kind = "fiber_fpv";
  s.tracks[0].identity = "friendly";
  s.tracks[0].x = -20000;
  s.tracks[0].z = 15000;
  assert.deepEqual(radarPicture(s), baseline);
  assert.deepEqual(radarPicture(before), baseline);
  const path = documentOf(s).querySelector('g[role="button"] path');
  assert.equal(path?.getAttribute("d"), "M228 151l5 5-5 5-5-5Z");
});
test("A failed radar has neither an active sweep, contact buttons nor tentative returns", () => {
  const s = snapshot();
  s.radarStatus = "failed";
  s.jammed = false;
  s.falseContacts = [
    {
      track_id: "CLUTTER",
      tick: s.tick,
      radar: { ...s.tracks[0].observation!.radar },
    },
  ];
  const doc = documentOf(s);
  assert.equal(doc.querySelectorAll('g[role="button"]').length, 0);
  assert.equal(doc.querySelector('[aria-label="Schematic radar sweep"]'), null);
  assert.equal(doc.querySelector('line[stroke="#cdf46d"]'), null);
  assert.equal(doc.body.textContent?.includes("TENTATIVE"), false);
  assert.ok(doc.body.textContent?.includes("RADAR OFFLINE"));
  assert.deepEqual(radarPicture(s), {
    status: "failed",
    sweep: false,
    contacts: [],
    tentative: [],
  });
});
test("Unavailable, unobserved, invalid or future samples cannot be rendered via another sensor fallback", () => {
  for (const change of [
    { available: false },
    { state: "none" as const },
    { position: null },
    { position: { x: NaN, z: 0, altitude: 0 } },
    { sample_tick: 211 },
  ]) {
    const s = snapshot();
    Object.assign(s.tracks[0].observation!.radar, change);
    assert.equal(radarPicture(s).contacts.length, 0);
    assert.equal(documentOf(s).querySelectorAll('g[role="button"]').length, 0);
  }
});
test("Tentative and coasting plots expose their radar evidence state without pretending to be fresh confirmation", () => {
  const s = snapshot();
  Object.assign(s.tracks[0].observation!.radar, {
    state: "tentative",
    fresh: false,
    sample_tick: 180,
  });
  const doc = documentOf(s),
    button = doc.querySelector('g[role="button"]');
  assert.match(
    button?.getAttribute("aria-description") ?? "",
    /tentative.*1\.0s/i,
  );
  assert.equal(button?.querySelector("path")?.getAttribute("fill"), "none");
  assert.ok(button?.querySelector("path")?.getAttribute("stroke-dasharray"));
});
test("Multiple radar instances have unique SVG references and labelled schematic scan semantics", () => {
  const s = snapshot();
  const doc = new JSDOM(
    renderToStaticMarkup(
      <>
        <Radar state={s} selected={null} onSelect={() => {}} />
        <Radar state={s} selected={null} onSelect={() => {}} />
      </>,
    ),
  ).window.document;
  const ids = [...doc.querySelectorAll("[id]")].map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(
    doc.querySelectorAll('[aria-label="Schematic radar sweep"]').length,
    2,
  );
  for (const svg of doc.querySelectorAll("svg"))
    assert.match(
      svg.querySelector("desc")?.textContent ?? "",
      /not.*antenna phase/i,
    );
});

test("A damaged v0.4 observation never falls back to hidden legacy radar coordinates", () => {
  const s = snapshot();
  delete (s.tracks[0].observation as Partial<SensorObservation>).radar;
  assert.equal(radarPicture(s).contacts.length, 0);
  assert.equal(documentOf(s).querySelectorAll('g[role="button"]').length, 0);
});

test("A v0.4 snapshot with a missing entire observation fails closed while pure legacy remains supported", () => {
  const s = snapshot();
  const valid = structuredClone(s.tracks[0]);
  s.tracks.push({ ...valid, id: "MISSING-V04", observation: undefined });
  assert.deepEqual(
    radarPicture(s).contacts.map((t) => t.id),
    [valid.id],
  );
  s.tracks = [{ ...valid, observation: undefined }];
  s.falseContacts = [];
  assert.equal(radarPicture(s).contacts.length, 0);
  assert.equal(documentOf(s).querySelectorAll('g[role="button"]').length, 0);
  delete s.falseContacts;
  assert.equal(radarPicture(s).contacts.length, 1);
});
