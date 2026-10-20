import { testPython } from "./test-python";
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { renderToStaticMarkup } from "react-dom/server";
import { DirectorCard, ProfilePanel, launchPreparedScenario } from "./Director";
import { replay, score, Simulation, idealFor, inCivilZone } from "./sim";
import type { Scenario, TrainingProfile } from "./types";
const py = spawnSync(
  testPython(),
  [
    "-c",
    `import json,tempfile\nfrom pathlib import Path\nfrom server import storage\nfrom server.main import profile\nfrom server.director import SKILLS,TEMPLATES,select_director,adapt_scenario\nwith tempfile.TemporaryDirectory() as p:\n storage.DB_PATH=Path(p)/'test.db';storage.init();p=profile('QA');d=select_director(p,[],19);spec=adapt_scenario(d);cases=[]\n for skill in SKILLS:\n  for template in TEMPLATES[skill]:\n   d=select_director(p,[],17);d.update(focus_skill=skill,scenario_template=skill+'/'+template);cases.append(adapt_scenario(d))\n print(json.dumps(dict(profile=p,scenario=spec,cases=cases)))`,
  ],
  { cwd: "..", encoding: "utf8" },
);
assert.equal(py.status, 0, py.stderr);
const fixture = JSON.parse(py.stdout) as {
  profile: TrainingProfile;
  scenario: Scenario;
  cases: Scenario[];
};
test("profile renders four canonical skills and truthful baseline uncertainty", () => {
  const html = renderToStaticMarkup(<ProfilePanel profile={fixture.profile} />);
  for (const label of [
    "Detection",
    "Classification / IFF",
    "Effector choice",
    "Degraded sensor response",
  ])
    assert.ok(html.includes(label));
  assert.equal(
    (html.match(/Baseline prior · 0 observations/g) || []).length,
    4,
  );
  assert.ok(html.includes("not validated operational competence"));
});
test("Director card shows Beta mean, focus, difficulty, features and heuristic target", () => {
  const d = {
    ...fixture.scenario.director_decision!,
    mastery_estimate: 0.5,
    debug_samples: {
      ...fixture.scenario.director_decision!.debug_samples,
      detection: 0.01,
    },
  };
  const html = renderToStaticMarkup(
    <DirectorCard decision={d} onStart={() => {}} busy={false} />,
  );
  assert.ok(html.includes("50%"));
  assert.ok(!html.includes("1%"));
  assert.ok(html.includes(d.difficulty_label));
  assert.ok(html.includes("≈70%"));
  for (const f of d.scenario_features) assert.ok(html.includes(f));
  assert.ok(html.includes("Limited history"));
  assert.ok(html.includes("Start adaptive drill"));
});
test("updated profile renders changed posterior and observation count", () => {
  const p = structuredClone(fixture.profile);
  p.sessions = 1;
  p.skills.effector_choice = {
    ...p.skills.effector_choice,
    alpha: 1,
    beta: 2,
    observations: 1,
    mean: 1 / 3,
  };
  const html = renderToStaticMarkup(<ProfilePanel profile={p} />);
  assert.ok(html.includes("33%"));
  assert.ok(html.includes("1 observations · limited evidence"));
  assert.ok(html.includes("Beta(1, 2)"));
});
test("adaptive launch uses the exact prepared server scenario and session ID", async () => {
  let sent: unknown;
  const launched = await launchPreparedScenario(
    fixture.scenario,
    "QA",
    async (body) => {
      sent = body;
      return { id: "real-session" };
    },
  );
  assert.equal(launched.scenario, fixture.scenario);
  assert.equal(launched.sessionId, "real-session");
  assert.deepEqual(sent, { scenario_id: fixture.scenario.id, trainee: "QA" });
  await assert.rejects(() =>
    launchPreparedScenario(fixture.scenario, "OTHER", async () => ({
      id: "bad",
    })),
  );
});
test("all twelve server Director templates preserve browser/Python replay and scoring parity", () => {
  for (const spec of fixture.cases) {
    const sim = new Simulation(spec);
    while (!sim.state.done) {
      for (const t of sim.state.tracks) {
        if (!t.active || t.detected === null) continue;
        const tick = sim.state.tick;
        if (t.designated === null) {
          sim.act({ tick, k: "designate", track: t.id });
          sim.act({
            tick,
            k: "classify",
            track: t.id,
            kind: t.kind,
            identity: t.identity,
          });
        }
        const effector = idealFor(t);
        if (
          t.attempts.includes("hold") ||
          (effector === "kinetic" &&
            (Math.hypot(t.x, t.z) > 160 || inCivilZone(t))) ||
          (effector === "rf_jam" && Math.hypot(t.x, t.z) > 180)
        )
          continue;
        sim.act({ tick, k: "engage", track: t.id, effector });
      }
      sim.step();
    }
    const checkpoints = [0, 30, 180, 600, 900, 2250].map((tick) => {
      const state = replay(
        spec,
        sim.events.filter((e) => e.tick <= tick),
        tick,
      ).state;
      return {
        tick,
        radar_status: state.radarStatus,
        tracks: state.tracks.map((t) => ({
          id: t.id,
          detected: t.detected,
          resolved: t.resolved,
          impact: t.impact,
          radar: t.radar,
          thermal: t.thermal,
        })),
      };
    });
    const result = spawnSync(
      testPython(),
      [
        "-c",
        `import json,sys\nfrom server.engine import replay,score\nx=json.load(sys.stdin)\nfor expected in x['checkpoints']:\n tick=expected['tick'];r=replay(x['spec'],[e for e in x['events'] if e['tick']<=tick],tick)\n assert dict(tick=r.tick,radar_status=r.radar_status,tracks=[{k:t[k] for k in ['id','detected','resolved','impact','radar','thermal']} for t in r.tracks])==expected\nprint(json.dumps(score(replay(x['spec'],x['events'],2250))))`,
      ],
      {
        cwd: "..",
        encoding: "utf8",
        input: JSON.stringify({ spec, events: sim.events, checkpoints }),
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), score(sim));
  }
});
