import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CompetencyEvidenceJourney from "./CompetencyEvidenceJourney";
import {
  journeyMatches,
  type LearningJourney,
  type JourneyEvidence,
} from "./learning-journey";
const evidence: JourneyEvidence = {
  session_id: "verified-source",
  scenario_id: "raid_frozen",
  created_at: "2026-01-01",
  completed_at: "2026-01-03",
  evidence_at: "2026-01-03",
  evidence_time_source: "completed_at",
  competency: "C02",
  template: "civil_restraint",
  mission_version: "observation-mission-v3",
  assessment_version: "evidence-assessment-v2",
  site: "open_campus",
  mode: "assessment",
  status: "unsupported",
  criterion: "Affiliation remains a separate claim.",
  report_hash: "hash-of-frozen-report",
  href: "/?view=aar&session=verified-source",
  decisions: [{ id: "decision-7", tick: 180, order: 3 }],
};
const data: LearningJourney = {
  version: "observation-journey-v1",
  trainee: "A",
  window: {
    limit: 32,
    included_sessions: 32,
    total_sessions: 47,
    truncated: true,
    ordering:
      "completed_at (legacy fallback created_at) descending, session_id descending",
  },
  competencies: [
    {
      id: "C02",
      title: "Separate affiliation",
      state: "independent-gap",
      latest_practice: {
        ...evidence,
        mode: "practice",
        status: "supported",
        session_id: "practice-source",
      },
      latest_independent: evidence,
      independent_contexts: 1,
      evidence: [evidence],
    },
  ],
  recommendation: {
    competency: "C02",
    template: "night_switch",
    mode: "assessment",
    priority: 3,
    prior_context_sessions: 0,
    already_supported: false,
    rank: [3, 0, 0, 1, 0],
    based_on: [evidence],
    policy: "longitudinal-evidence-policy-v1",
    seed: 42,
    mission_version: 3,
    site: "open_campus",
    reason: "Sample independent evidence separately.",
    novelty: "Unobserved template context.",
    href: "/?mission_template=night_switch&mission_mode=assessment&mission_version=3&mission_site=open_campus&seed=42",
  },
  candidates: [],
  limitations: ["No mastery is inferred."],
};
test("versioned journey validates learner identity and renders provenance, independent gaps and truncation", () => {
  assert.equal(journeyMatches(data, "A"), true);
  assert.equal(journeyMatches(data, "B"), false);
  assert.equal(
    journeyMatches(
      { ...data, version: "future" } as unknown as LearningJourney,
      "A",
    ),
    false,
  );
  const html = renderToStaticMarkup(
    <CompetencyEvidenceJourney journey={data} />,
  );
  for (const text of [
    "decision-7",
    "tick 180 / order 3",
    "hash-of-frozen-report",
    "Session created 2026-01-01",
    "Completed 2026-01-03",
    "Evidence recency 2026-01-03",
    "raid_frozen",
    "observation-mission-v3",
    "evidence-assessment-v2",
    "Independent evidence",
    "Latest assessable independent decision: unsupported",
    "Latest assessable practice: supported",
    "Supported practice never clears an independent finding",
    "Showing 32 of 47",
    "Prepare recommended independent exercise",
  ])
    assert.ok(html.includes(text), text);
  assert.match(html, /view=aar&amp;session=verified-source/);
  assert.match(html, /mission_version=3&amp;mission_site=open_campus/);
  assert.doesNotMatch(
    html,
    /mastery awarded|assessment passed|Ready for assessment/,
  );
});

test("competency evidence, candidate table and disclosures expose an accessible document structure", async () => {
  const { JSDOM } = await import("jsdom");
  const { default: axe } = await import("axe-core");
  const markup = renderToStaticMarkup(
    <CompetencyEvidenceJourney journey={data} />,
  );
  const dom = new JSDOM(
    `<!doctype html><html lang="en"><head><title>Academy evidence</title></head><body><main><h1>Academy</h1><h2>Observation missions</h2>${markup}</main></body></html>`,
    { runScripts: "outside-only" },
  );
  try {
    dom.window.document
      .querySelectorAll("details")
      .forEach((d) => (d.open = true));
    dom.window.eval(axe.source);
    const result = await (dom.window as unknown as { axe: typeof axe }).axe.run(
      dom.window.document,
      { rules: { "color-contrast": { enabled: false } } },
    );
    assert.equal(
      result.violations.length,
      0,
      JSON.stringify(result.violations),
    );
  } finally {
    dom.window.close();
  }
});
