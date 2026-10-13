import { testPython } from "./test-python";
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { renderToStaticMarkup } from "react-dom/server";
import {
  UnitAnalytics,
  GroupResults,
  type UnitReport,
  type GroupResult,
} from "./Unit";
import {
  IDENTITY_KEY,
  readIdentity,
  storeIdentity,
  ownDraft,
  newId,
  sealEvents,
  uploadBatches,
  syncMessage,
} from "./unit-state";
import type { Action } from "./types";
const py = spawnSync(
  testPython(),
  [
    "-c",
    `import json,tempfile\nfrom pathlib import Path\nfrom fastapi.testclient import TestClient\nfrom server import storage,auth\nimport secrets\nfrom server.main import app\nfrom server.tests.test_director import expert\nwith tempfile.TemporaryDirectory() as folder:\n storage.DB_PATH=Path(folder)/'unit.db'\n password=secrets.token_urlsafe(24)\n auth.provision(password)\n with TestClient(app) as c:\n  login=c.post('/api/v1/auth/login',json={'password':password}).json()\n  c.headers['Authorization']='Bearer '+login['token']\n  for i in range(2):\n   p=c.post('/api/v1/units/join',json=dict(callsign='T-'+str(i))).json()\n   s=c.post('/api/v1/scenarios/generate',json=dict(seed=7+i,trainee=p['trainee_id'])).json()\n   sid=c.post('/api/v1/sessions',json=dict(scenario_id=s['id'],trainee=p['trainee_id'])).json()['id']\n   events=expert(s).events if i==0 else []\n   c.post('/api/v1/sessions/'+sid+'/events',json=dict(seq=0,events=events))\n   c.post('/api/v1/sessions/'+sid+'/complete',json=dict(execution_tick=2250))\n  print(json.dumps(c.get('/api/v1/units/local/dashboard').json()))`,
  ],
  { cwd: "..", encoding: "utf8" },
);
assert.equal(py.status, 0, py.stderr);
const report = JSON.parse(py.stdout) as UnitReport;
test("join identity persists server ID, unit and callsign; malformed storage is excluded", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
  };
  const id = { trainee_id: "T_server", unit_id: "local", callsign: "T-03" };
  storeIdentity(storage, id);
  assert.deepEqual(readIdentity(storage), id);
  values.set(IDENTITY_KEY, '{"trainee_id":"wrong"}');
  assert.equal(readIdentity(storage), null);
});
test("unfinished session recovery only selects this browser trainee", () => {
  const a = { id: "A", trainee: "A", tick: 100 },
    b = { id: "B", trainee: "B", tick: 200 };
  assert.equal(ownDraft([b, a], "A"), a);
  assert.equal(ownDraft([b, a], "C"), null);
  assert.equal(ownDraft([{ ...a, tick: 2250 }], "A"), null);
});
test("HTTP LAN UUID fallback uses crypto random bytes when randomUUID is unavailable", () => {
  const source = {
    getRandomValues: (b: Uint8Array) => {
      b.fill(17);
      return b;
    },
    randomUUID: undefined,
  } as unknown as Crypto;
  assert.match(
    newId(source),
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
  );
});
test("event queue retains immutable batches across lost ACK and appends only new events", async () => {
  const events: Action[] = [
    { tick: 30, k: "designate", track: "T2" },
    {
      tick: 31,
      k: "classify",
      track: "T2",
      kind: "quad",
      identity: "friendly",
    },
  ];
  const original = sealEvents(events.slice(0, 1), []);
  const restored = JSON.parse(JSON.stringify(original)) as Action[][];
  const batches = sealEvents(events, restored);
  assert.deepEqual(batches, [events.slice(0, 1), events.slice(1)]);
  const calls: { path: string; body: unknown }[] = [];
  let fail = true;
  const send = async (path: string, body: unknown) => {
    calls.push({ path, body });
    if (fail) {
      fail = false;
      throw new Error("ACK lost");
    }
  };
  await assert.rejects(uploadBatches("own-session", batches, send));
  await uploadBatches("own-session", batches, send);
  assert.deepEqual(calls[0], calls[1]);
  assert.deepEqual(calls[2], {
    path: "/sessions/own-session/events",
    body: { seq: 1, events: events.slice(1) },
  });
  assert.throws(() => sealEvents(events.slice(1), batches));
});
test("connection status distinguishes local continuation, queued events and server sync", () => {
  assert.match(syncMessage(false, "queued", true), /Session continues locally/);
  assert.match(
    syncMessage(false, "queued", true),
    /Instructor control unavailable/,
  );
  assert.match(syncMessage(true, "syncing", true), /Syncing/);
  assert.match(syncMessage(true, "synced", false), /up to date/);
});
test("unit dashboard renders persisted four-skill aggregates and authoritative failure counts", () => {
  const html = renderToStaticMarkup(
    <UnitAnalytics report={report} onSelect={() => {}} onOpen={() => {}} />,
  );
  for (const mean of Object.values(report.skill_means))
    assert.ok(html.includes(`${Math.round(mean! * 100)}%`));
  for (const [reason, count] of Object.entries(report.failures)) {
    assert.ok(html.includes(reason));
    assert.ok(html.includes(`>${count}<`));
  }
  assert.ok(html.includes("T-0") && html.includes("T-1"));
  assert.ok(html.includes("baseline"));
  assert.ok(html.includes("Not operational readiness"));
  assert.ok(html.includes("latest 100 completed"));
});
test("group comparison renders independent session results and pending values without rankings", () => {
  const groups: GroupResult[] = [
    {
      exercise_group_id: "G-real",
      scenario_id: "scenario-real",
      created_at: "2026-10-03",
      results: [
        {
          session_id: "S1",
          trainee_id: "T1",
          callsign: "T-01",
          status: "completed",
          score: 81,
          node_averages: { detect: 20, classify: 24, engage: 30 },
        },
        {
          session_id: "S2",
          trainee_id: "T2",
          callsign: "T-02",
          status: "active",
          score: null,
          node_averages: { detect: null, classify: null, engage: null },
        },
      ],
    },
  ];
  const html = renderToStaticMarkup(<GroupResults groups={groups} />);
  assert.ok(
    html.includes("G-real") && html.includes("81") && html.includes("Pending"),
  );
  assert.ok(html.includes("/?session=S1"));
  assert.ok(!/winner|loser|best|worst/i.test(html));
});
