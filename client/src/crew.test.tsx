import React from "react";
import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import Crew, { CrewPicture, type CrewState } from "./Crew";

test("crew role join and officer setup are distinct without a client simulator", () => {
  const html = renderToStaticMarkup(<Crew />);
  assert.match(html, /Join an assigned role/);
  assert.match(html, /Role code/);
  assert.match(html, /Officer sign-in|Checking officer session/);
  const source = readFileSync(new URL("./Crew.tsx", import.meta.url), "utf8");
  assert.ok(!source.includes("from './sim'"));
  assert.match(source, /X-VYUHA-Crew-Token/);
  assert.match(source, /Decisions are blocked until reconnection/);
});
test("crew picture draws reported geometry and labels shared outcome scope", () => {
  const state = {
    name: "TEST",
    role: "spotter",
    tick: 30,
    duration: 60,
    status: "active",
    paused: true,
    contacts: [{ id: "T1", position: { x: 120, z: 340, altitude: 18 } }],
    clock_note: "Recovered at durable checkpoint",
    note: "Shared score is not copied into individual skill profiles.",
  } as CrewState;
  const html = renderToStaticMarkup(<CrewPicture state={state} />);
  assert.match(html, /cx="120"/);
  assert.match(html, /cy="-340"/);
  assert.match(html, /Paused/);
  assert.match(html, /durable checkpoint/);
  assert.match(html, /not copied into individual skill profiles/);
});
