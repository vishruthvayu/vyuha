import type { LearningPreparation, LearningReview } from "./learning";
import { learningModeLabel } from "./learning";
export function LearningBanner({
  preparation,
}: {
  preparation: LearningPreparation;
}) {
  const c = preparation.context;
  return (
    <section
      className="panel curriculum-banner"
      aria-label="Curriculum attempt"
    >
      <strong>
        {learningModeLabel(c.mode)} · {c.item_id}
      </strong>
      <p>
        {c.mode === "assessment"
          ? "Assessment evidence is recorded separately. Guided hints and Fusion advice are disabled."
          : "Practice evidence is retained for reflection; it does not update individual assessment or the four-skill profile."}
      </p>
      <a href="/academy">Return to Academy</a>
      <small>
        Guidance: {c.assistance}. Frozen policy: {c.selection.policy}.
      </small>
    </section>
  );
}
export function LearningEvidence({ review }: { review: LearningReview }) {
  const e = review.evidence;
  if (!e)
    return <p>Competency evidence is awaiting original-server verification.</p>;
  return (
    <section
      className="curriculum-evidence"
      aria-label="Verified competency evidence"
    >
      <h3>{learningModeLabel(review.context.mode)} evidence</h3>
      <p>
        {e.assessed
          ? "Scenario-bound assessment observations"
          : "Practice only · excluded from individual assessment"}
      </p>
      <div
        className="table-scroll"
        role="region"
        aria-label="Competency evidence counts"
        tabIndex={0}
      >
        <table>
          <caption>
            Reconstructed decision evidence · counts, not mastery percentages
          </caption>
          <thead>
            <tr>
              <th scope="col">Competency</th>
              <th scope="col">Supported</th>
              <th scope="col">Incorrect</th>
              <th scope="col">Unassessable</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(e.summary).map(([id, c]) => (
              <tr key={id}>
                <th scope="row">{id}</th>
                <td>{c.correct}</td>
                <td>{c.incorrect}</td>
                <td>{c.unassessable}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>{e.limitation}</p>
      <details>
        <summary>Evidence and frozen selection</summary>
        <p>{review.context.selection.reason}</p>
        <p>
          Review hash: <code>{e.original_review_hash}</code>
        </p>
        <p>
          Catalog: <code>{review.context.catalog_hash}</code>
        </p>
        <ul>
          {e.observations.map((o) => (
            <li key={`${o.competency_id}:${o.decision_id}`}>
              {o.competency_id} · {o.decision_id} · T+{(o.tick / 30).toFixed(2)}
              s · {o.verdict} · {o.reason}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
