import React from "react";
import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import {
  EvidenceResponseComparison,
  type ReferenceReport,
} from "./ExpertComparison";
const report: ReferenceReport = {
  schema_version: 1,
  kind: "available_evidence_response_comparison",
  session_id: "frozen",
  engine_version: "vyuha-0.4.0",
  mode: "original_history_boundary_comparison",
  replayed_end_tick: 2700,
  hz: 30,
  input_fingerprint: "receipt",
  entries: [
    {
      decision_index: 2,
      tick: 60,
      order: 2,
      track_id: "T1",
      recorded_effector: "rf_jam",
      available_evidence: {
        rf: { available: true, signal: false, iff: "no_reply" },
        visual: { available: true, silhouette: "multirotor" },
        prior_classification: "quad",
        prior_identity: "hostile",
        range_m: 30,
      },
      reference_policy: {
        action: "hold",
        confidence: "uncertain",
        cues: ["No detected link supports jamming"],
        basis: "available_evidence",
      },
      agrees_with_policy: false,
      identity_assurance: "operator_declaration_only",
      iff_no_reply_is_hostility: false,
      rubric_reference: {
        basis: "full_rubric_truth",
        label: "Rubric/type-range reference",
        effector: "kinetic",
        limitation: "Canonical type/range, not resource-aware expected success",
      },
    },
  ],
  summary: {
    recorded_responses: 1,
    agreements: 0,
    agreement_fraction: 0,
    supported: 0,
    conditional: 0,
    uncertain: 1,
    interpretation:
      "Descriptive agreement; not a score or correctness judgement",
  },
  limitations: [
    "No certified human expert or operational competence claim",
    "Original history comparison is not an autonomous expert rollout",
  ],
  original_history_unchanged: true,
};
test("response comparison separates available evidence from canonical rubric truth", () => {
  const html = renderToStaticMarkup(
    <EvidenceResponseComparison report={report} />,
  );
  assert.match(html, /Available-evidence reference/);
  assert.match(html, /available_evidence/);
  assert.match(html, /Separately labelled rubric\/type-range reference/);
  assert.match(html, /full_rubric_truth/);
  assert.match(html, /No reply does not prove hostility/);
  assert.match(html, /not a score or correctness judgement/);
  assert.match(html, /not resource-aware expected success/);
});
test("response comparison has no fabricated agreement fraction when no responses were recorded", () => {
  const html = renderToStaticMarkup(
    <EvidenceResponseComparison
      report={{
        ...report,
        entries: [],
        summary: {
          ...report.summary,
          recorded_responses: 0,
          agreements: 0,
          agreement_fraction: null,
        },
      }}
    />,
  );
  assert.match(html, /No engagement was recorded/);
  assert.doesNotMatch(
    html,
    /NaN|Infinity|100%|0 \/ 0|recorded responses match the policy/,
  );
});
test("comparison preserves supplied original report and explains unchanged history", () => {
  const before = JSON.stringify(report);
  const html = renderToStaticMarkup(
    <EvidenceResponseComparison report={report} />,
  );
  assert.equal(JSON.stringify(report), before);
  assert.match(
    html,
    /Original score, completed history and skill profiles remain unchanged/,
  );
  assert.match(html, /not an autonomous expert rollout/);
});
