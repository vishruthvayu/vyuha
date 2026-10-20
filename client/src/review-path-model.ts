import type { DecisionReview, Record as TrainingRecord } from "./types";
export const REVIEW_STAGES = [
  { key: "detect", label: "Detect", possible: 25, kind: "detection" },
  {
    key: "classify",
    label: "Classify",
    possible: 25,
    kind: "classification_iff",
  },
  {
    key: "prioritise",
    label: "Prioritize",
    possible: 15,
    kind: "prioritisation",
  },
  { key: "engage", label: "Respond", possible: 35, kind: "engagement" },
] as const;
export type ReviewStage = (typeof REVIEW_STAGES)[number]["key"];
/** Display only persisted final-contact-node scores and authoritative review entries.
 * No per-action score summation and no inferred observations or verdicts. */
export function contactDecisionPath(record: TrainingRecord, track: string) {
  const row = record.scorecard.rows.find((r) => r.id === track);
  if (!row) return [];
  return REVIEW_STAGES.map((stage) => ({
    ...stage,
    label:
      stage.key === "prioritise" && !record.scorecard.prioritisation
        ? "Timely response"
        : stage.label,
    points: row[stage.key],
    reviews: record.verified
      ? (record.decision_reviews ?? []).filter(
          (review: DecisionReview) =>
            review.track_id === track && review.decision_kind === stage.kind,
        )
      : [],
  }));
}
