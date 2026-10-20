import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import {
  SituationMap,
  WhiteCellDetails,
  situationPoints,
  type WhiteCellPicture,
} from "./WhiteCell";

const picture: WhiteCellPicture = {
  schema_version: 1,
  session_id: "session-A",
  trainee: "trainee-A",
  callsign: "A",
  unit_id: "local",
  exercise_group_id: null,
  status: "ACTIVE",
  last_seen: null,
  scenario: {
    id: "scenario-A",
    title: "Frozen exercise",
    duration_seconds: 75,
    engine_version: "released-v1.0.1-legacy",
    world_scale_m: null,
  },
  telemetry: {
    assurance: "Client-reported",
    state: { tick: 30, active_contacts: 2, paused: false },
  },
  reconstruction: {
    horizon_tick: 30,
    hz: 30,
    horizon_source: "client_control_state",
    assurance: "Accepted inputs reconstructed",
    input_fingerprint: "sample-fingerprint",
    cached: false,
    newer_accepted_events: 0,
    newer_applied_commands: 0,
  },
  reference: {
    label: "Instructor reference truth — reconstructed",
    tracks: [
      {
        id: "T1",
        kind: "secret-reference-kind",
        identity: "hostile",
        rf_link: false,
        position: { x: 100, z: 100, altitude: 30 },
        active: true,
        resolved: false,
        asset_impact: false,
        trainee_classification: null,
        trainee_identity: null,
      },
      {
        id: "T2",
        kind: "quad",
        identity: "friendly",
        rf_link: true,
        position: { x: -10, z: 20, altitude: 20 },
        active: true,
        resolved: false,
        asset_impact: false,
        trainee_classification: null,
        trainee_identity: null,
      },
    ],
  },
  observed: {
    label: "Current sensor evidence, not reference truth",
    tracks: [
      {
        id: "T2",
        position: { x: -5, z: 25, altitude: 20 },
        channels: [
          {
            sensor: "radar",
            position: { x: -5, z: 25, altitude: 20 },
            sample_tick: 20,
            state: "confirmed",
          },
        ],
        evidence: { radar: { detected: true } },
        trainee_classification: null,
        trainee_identity: null,
        designated: false,
        responded: false,
      },
    ],
  },
  progress: {
    spawned: 2,
    active: 2,
    first_detected: 1,
    designated: 0,
    classified: 0,
    responded: 0,
    resolved: 0,
    impacts: 0,
  },
  alerts: [],
  sensor_state: {
    radar: "normal",
    rf_available: true,
    night: false,
    paused_by_applied_command: false,
  },
};

test("observed map uses channel-reported geometry and omits hidden reference labels", () => {
  const points = situationPoints(picture, "observed");
  assert.equal(points.length, 1);
  assert.deepEqual(points[0].position, { x: -5, z: 25, altitude: 20 });
  const html = renderToStaticMarkup(
    <SituationMap picture={picture} mode="observed" />,
  );
  assert.match(html, /sensor-reported positions/);
  assert.match(html, /T2/);
  assert.doesNotMatch(html, /secret-reference-kind|hostile|friendly|T1/);
});

test("instructor reference mode is explicit and distinct from observed evidence", () => {
  const html = renderToStaticMarkup(
    <SituationMap picture={picture} mode="reference" />,
  );
  assert.match(html, /Instructor reference map/);
  assert.match(html, /secret-reference-kind/);
  assert.match(html, /hostile/);
  assert.equal(situationPoints(picture, "reference").length, 2);
});

test("White Cell details label horizon assurance and show actual progress without hidden kind", () => {
  const html = renderToStaticMarkup(
    <WhiteCellDetails picture={picture} mode="observed" />,
  );
  assert.match(html, /T\+1.00 s/);
  assert.match(html, /not independently verified elapsed wall time/);
  assert.match(html, /Accepted decision progress/);
  assert.match(html, /first detected/);
  assert.match(html, /Open this session review/);
  assert.doesNotMatch(html, /secret-reference-kind/);
});

test("White Cell reports accepted actions waiting beyond last telemetry and does not mutate inputs", () => {
  const source = JSON.stringify(picture);
  const html = renderToStaticMarkup(
    <WhiteCellDetails
      picture={{
        ...picture,
        reconstruction: {
          ...picture.reconstruction,
          newer_accepted_events: 2,
          newer_applied_commands: 1,
        },
      }}
      mode="observed"
    />,
  );
  assert.match(html, /2 accepted actions and 1 applied commands/);
  assert.equal(JSON.stringify(picture), source);
});
