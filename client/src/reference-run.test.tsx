import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { ReferenceSummary, type ReferenceResult } from "./ReferenceRun";
import { makeScenario } from "./scenario";
import { replay, score } from "./sim";
const card = score(replay(makeScenario(), [], 2250));
const result: ReferenceResult = {
  session_id: "synthetic-session",
  version: "expert-run-1",
  mode: "canonical_reference",
  basis: "AFTER-AAR CANONICAL RUBRIC REFERENCE TRUTH",
  original_score: card,
  reference_score: { ...card, score: 95 },
  delta: 95 - card.score,
  reference_actions: [{ tick: 30, order: 0, k: "designate", track: "T1" }],
  reference_commands: [],
  rollout_horizon: {
    scoring_end_tick: 2250,
    original_observed_end_tick: 30,
    reference_is_hypothetical: true,
  },
  fingerprint: "synthetic",
  original_history_unchanged: true,
  limitations: [],
};
test("autonomous reference summary separates original score, own decisions and projected canonical truth", () => {
  const before = structuredClone(result);
  const output = renderToStaticMarkup(<ReferenceSummary result={result} />);
  assert.match(output, /AFTER-AAR CANONICAL/);
  assert.match(output, /Original 0\/100/);
  assert.match(output, /hypothetical reference 95\/100/);
  assert.match(output, /independently generated accepted decisions/);
  assert.match(output, /T\+75.00s/);
  assert.match(output, /T\+1.00s/);
  assert.match(output, /not a certified human expert/);
  assert.deepEqual(result, before);
});
test("evidence-only result retains conservative label and unknown observed horizon", () => {
  const output = renderToStaticMarkup(
    <ReferenceSummary
      result={{
        ...result,
        mode: "evidence_only",
        basis: "EVIDENCE-ONLY AUTONOMOUS CONSERVATIVE TRAINING POLICY",
        rollout_horizon: {
          ...result.rollout_horizon,
          original_observed_end_tick: null,
        },
      }}
    />,
  );
  assert.match(output, /EVIDENCE-ONLY/);
  assert.match(output, /unknown/);
  assert.doesNotMatch(output, /AFTER-AAR CANONICAL/);
});
