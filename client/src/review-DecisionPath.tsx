import { useEffect, useState } from "react";
import type { DecisionReview, Record as TrainingRecord } from "./types";
import { actionLabel, EvidenceView, tickLabel } from "./Ghost";
import { contactDecisionPath, type ReviewStage } from "./review-path-model";
export function referenceLabel(review: DecisionReview): string {
  return review.decision_kind === "prioritisation"
    ? `${review.expected_action.track_id ? `Prioritize ${review.expected_action.track_id}` : "No reference contact established"} · ${actionLabel(review.expected_action)}`
    : actionLabel(review.expected_action);
}
export default function DecisionPath({
  record,
  track,
  onReview,
}: {
  record: TrainingRecord;
  track: string;
  onReview?: (review: DecisionReview) => void;
}) {
  const [stage, setStage] = useState<ReviewStage | "all">("all");
  useEffect(() => {
    setStage("all");
  }, [record.id, track]);
  const path = contactDecisionPath(record, track);
  const entries = path
    .filter((node) => stage === "all" || node.key === stage)
    .flatMap((node) => node.reviews);
  if (!path.length) return <p>No scored contact is available for review.</p>;
  return (
    <div className="review-decision-path">
      <p className="review-evidence-boundary">
        {record.verified
          ? "Server-verified post-exercise review."
          : "Device result; authoritative review requires server verification."}{" "}
        Node points are final contact outcomes, shared across attempts.
        After-review truth is labelled separately from observations.
      </p>
      <ol
        className="review-path"
        aria-label={`Final contact score path for ${track}`}
      >
        {path.map((node, index) => (
          <li className="review-node" key={node.key} data-stage={node.key}>
            <button
              className="review-node-control"
              aria-pressed={stage === node.key}
              onClick={() => setStage(stage === node.key ? "all" : node.key)}
            >
              <span className="eyebrow">
                STEP {index + 1} · {node.label}
              </span>{" "}
              <strong>
                {node.points} / {node.possible}
              </strong>
              <span>
                {node.reviews.length} authoritative review
                {node.reviews.length === 1 ? "" : "s"}
              </span>
              <small>
                {node.key === "prioritise" && !record.scorecard.prioritisation
                  ? "Legacy timely-response node"
                  : "Inspect recorded evidence"}
              </small>
            </button>
          </li>
        ))}
      </ol>
      <p className="footnote">
        Stages follow rubric order; decision ticks below preserve the actual
        recorded history. This display does not infer causal links between
        decisions.
      </p>
      <div className="review-controls">
        <button
          className="button subtle"
          aria-pressed={stage === "all"}
          onClick={() => setStage("all")}
        >
          All stages
        </button>
        <span role="status">
          {entries.length} review{entries.length === 1 ? "" : "s"} shown
        </span>
      </div>
      {!entries.length && (
        <p>
          No authoritative decision review is recorded for this selection. A
          score alone does not establish what was observed.
        </p>
      )}
      <div className="review-branches">
        {entries.map((review) => (
          <details className="review-decision" key={review.decision_id}>
            <summary>
              <span>
                {tickLabel(review.tick)} ·{" "}
                {review.decision_kind.replaceAll("_", " ")}
              </span>
              <strong>{actionLabel(review.trainee_action)}</strong>{" "}
              <span className={`status verdict-${review.verdict}`}>
                {review.verdict === "unassessable"
                  ? "INSUFFICIENT EVIDENCE"
                  : review.verdict.toUpperCase()}
              </span>
            </summary>
            <div className="review-comparison">
              <section>
                <h3>Recorded decision</h3>
                <strong>{actionLabel(review.trainee_action)}</strong>
              </section>
              <section>
                <h3>Reference decision</h3>
                <strong>{referenceLabel(review)}</strong>
                <p>
                  {review.expected_action.basis === "ground_truth_reference"
                    ? "After-review ground-truth rubric; identity must first be established."
                    : "Based on available evidence at this moment."}
                </p>
              </section>
            </div>
            <EvidenceView review={review} />
            <section>
              <h3>Reason and consequence</h3>
              <p>{review.explanation}</p>
              <p>{review.consequence.text}</p>
              <p className="footnote">
                Final contact node: {review.score_effect.points_awarded}/
                {review.score_effect.points_possible}; session penalty{" "}
                {review.score_effect.session_penalty} (
                {review.score_effect.penalty_basis.replaceAll("_", " ")}). This
                is not a separate per-action award.
              </p>
            </section>
            {onReview && (
              <button
                className="button subtle"
                onClick={() => onReview(review)}
              >
                Open this moment in replay
              </button>
            )}
            <details data-evidence-scope="ground-truth">
              <summary>After-review ground truth and technical record</summary>
              <p>
                {review.ground_truth.kind.replaceAll("_", " ")} /{" "}
                {review.ground_truth.identity}. These simulation facts do not
                establish what the trainee knew.
              </p>
              <pre>{JSON.stringify(review, null, 2)}</pre>
            </details>
          </details>
        ))}
      </div>
      <details className="review-linear-alternative">
        <summary>Read the complete linear decision record</summary>
        <ol>
          {path.map((node) => (
            <li key={node.key}>
              <strong>
                {node.label}: {node.points}/{node.possible}
              </strong>
              <ul>
                {node.reviews.map((review) => (
                  <li key={review.decision_id}>
                    {tickLabel(review.tick)} ·{" "}
                    {actionLabel(review.trainee_action)} · {review.verdict}.{" "}
                    {review.explanation} Reference: {referenceLabel(review)} (
                    {review.expected_action.basis.replaceAll("_", " ")}).
                    Consequence: {review.consequence.text}
                  </li>
                ))}
              </ul>
              {!node.reviews.length && (
                <p>No authoritative review recorded for this node.</p>
              )}
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}
