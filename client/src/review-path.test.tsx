import test from "node:test";
import assert from "node:assert/strict";
import { contactDecisionPath } from "./review-path-model";
import { makeScenario } from "./scenario";
import { replay, score } from "./sim";
import type { DecisionReview, Record as TrainingRecord } from "./types";
function fixture(): TrainingRecord {
  const scenario = makeScenario();
  const scorecard = score(replay(scenario, [], 60));
  const id = scorecard.rows[0].id;
  return {
    id: "synthetic-review",
    trainee: "TEST",
    scenario,
    events: [],
    endTick: 60,
    scorecard,
    created_at: "2026-10-13T00:00:00Z",
    verified: true,
    decision_reviews: [
      {
        decision_id: "first",
        track_id: id,
        decision_kind: "engagement",
        score_effect: { points_awarded: 5 },
      } as DecisionReview,
      {
        decision_id: "second",
        track_id: id,
        decision_kind: "engagement",
        score_effect: { points_awarded: 5 },
      } as DecisionReview,
      {
        decision_id: "other",
        track_id: "other-contact",
        decision_kind: "classification_iff",
      } as DecisionReview,
    ],
  };
}
test("Decision path preserves exact final-node scores, separates contacts and never adds repeated attempt points", () => {
  const record = fixture();
  const before = structuredClone(record);
  const path = contactDecisionPath(record, record.scorecard.rows[0].id);
  assert.deepEqual(
    path.map((stage) => stage.key),
    ["detect", "classify", "prioritise", "engage"],
  );
  assert.equal(
    path[2].label,
    "Timely response",
    "Legacy timing node is not relabelled as ranking",
  );
  assert.equal(path[3].points, record.scorecard.rows[0].engage);
  assert.equal(path[3].reviews.length, 2);
  assert.equal(path[1].reviews.length, 0);
  assert.deepEqual(record, before);
  assert.deepEqual(contactDecisionPath(record, "missing-contact"), []);
});
test("Device-only review cannot present retained entries as authoritative decision evidence", () => {
  const record = fixture();
  record.verified = false;
  assert.ok(
    contactDecisionPath(record, record.scorecard.rows[0].id).every(
      (stage) => stage.reviews.length === 0,
    ),
  );
});
