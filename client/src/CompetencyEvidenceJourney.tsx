import { useState } from "react";
import type { JourneyEvidence, LearningJourney } from "./learning-journey";
const label = (value: string) => value.replaceAll("_", " ");
function Evidence({ item }: { item: JourneyEvidence }) {
  return (
    <article className="journey-evidence-source">
      <p>
        <a href={item.href}>Review {item.session_id.slice(0, 12)}</a> ·{" "}
        {item.mode === "assessment" ? "Independent" : "Practice"} ·{" "}
        <strong>{item.status}</strong>
      </p>
      <p>{item.criterion}</p>
      <p>
        {label(item.template)} ·{" "}
        {item.site ? label(item.site) : "Legacy environment"} ·{" "}
        {item.mission_version} · {item.assessment_version}
      </p>
      {item.decisions.length ? (
        <ul>
          {item.decisions.map((d) => (
            <li key={d.id}>
              Decision <code>{d.id}</code> · T+{(d.tick / 30).toFixed(2)}s ·
              tick {d.tick} / order {d.order}
            </li>
          ))}
        </ul>
      ) : (
        <p>No assessable decision boundary recorded.</p>
      )}
      <details>
        <summary>Frozen source receipt</summary>
        <p>
          Scenario <code>{item.scenario_id}</code>
        </p>
        <p>
          Reconstructed report <code>{item.report_hash}</code>
        </p>
        <p>Session created {item.created_at}</p>
        <p>
          {item.completed_at
            ? `Completed ${item.completed_at}`
            : "Legacy completion timestamp unavailable."}
        </p>
        <p>
          Evidence recency {item.evidence_at} ·{" "}
          {item.evidence_time_source === "completed_at"
            ? "completion time"
            : "legacy creation-time fallback"}
        </p>
      </details>
    </article>
  );
}
export default function CompetencyEvidenceJourney({
  journey,
}: {
  journey: LearningJourney;
}) {
  const [selected, setSelected] = useState(journey.recommendation.competency);
  const focus =
    journey.competencies.find((c) => c.id === selected) ??
    journey.competencies[0];
  const next = journey.recommendation;
  return (
    <section
      className="observation-next-practice competency-evidence-journey"
      aria-label="Verified competency journey"
    >
      <header>
        <span className="eyebrow">VERIFIED EVIDENCE / YOUR NEXT EXERCISE</span>
        <h3>Follow the evidence forward.</h3>
        <p>
          Separate what a report supported from what an outcome scored. These
          observations describe available evidence at recorded decisions; they
          do not establish attention or understanding.
        </p>
      </header>
      <div className="journey-next-exercise">
        <div>
          <span className="eyebrow">
            {next.mode === "assessment"
              ? "SAMPLE INDEPENDENT EVIDENCE"
              : "FOCUSED PRACTICE"}
          </span>
          <h4>
            {next.competency} · {label(next.template)}
          </h4>
          <p>{next.reason}</p>
          <p>{next.novelty}</p>
        </div>
        <div>
          <a className="button primary" href={next.href}>
            Prepare recommended{" "}
            {next.mode === "assessment"
              ? "independent exercise"
              : "observation practice"}
          </a>
          <p>
            Contract {next.mission_version} ·{" "}
            {next.site ? label(next.site) : "legacy environment"} · seed{" "}
            {next.seed}. Preparation opens the existing frozen mission brief.
          </p>
        </div>
      </div>
      <details>
        <summary>Why this exercise? Inspect the selection</summary>
        <p>
          Policy <code>{next.policy}</code> ranks unresolved independent
          evidence, then practice gaps, then missing independent evidence, then
          independent sampling after supported practice. Within the same
          priority it prefers contexts without supported evidence and fewer
          previous attempts. A changed seed is not a new learning context.
        </p>
        {next.based_on.length ? (
          next.based_on.map((e) => (
            <Evidence key={`${e.session_id}-${e.competency}`} item={e} />
          ))
        ) : (
          <p>
            No assessable personal evidence supports an inference yet. This
            selection creates an evidence opportunity.
          </p>
        )}
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Exercise selection candidates"
        >
          <table>
            <caption>
              Eligible candidates in policy order · lower rank is preferred
            </caption>
            <thead>
              <tr>
                <th scope="col">Focus / task</th>
                <th scope="col">Intent</th>
                <th scope="col">Prior context attempts</th>
                <th scope="col">Supported here</th>
                <th scope="col">Rank</th>
              </tr>
            </thead>
            <tbody>
              {journey.candidates.map((c) => (
                <tr key={`${c.competency}-${c.template}`}>
                  <th scope="row">
                    {c.competency} · {label(c.template)}
                  </th>
                  <td>
                    {c.mode === "assessment"
                      ? "Independent sample"
                      : "Practice"}
                  </td>
                  <td>{c.prior_context_sessions}</td>
                  <td>{c.already_supported ? "Yes" : "No"}</td>
                  <td>{c.rank.join(" / ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <nav
        className="journey-competency-rail"
        aria-label="Inspect a competency"
      >
        {journey.competencies.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={focus?.id === c.id}
            onClick={() => setSelected(c.id)}
          >
            <span>{c.id}</span>
            <strong>{c.title}</strong>
            <small>
              {c.latest_independent
                ? `Independent: ${c.latest_independent.status}`
                : "No assessable independent evidence"}
            </small>
          </button>
        ))}
      </nav>
      {focus && (
        <section
          aria-label={`${focus.id} evidence history`}
          className="journey-competency-detail"
        >
          <h4>
            {focus.id} · {focus.title}
          </h4>
          <div className="journey-evidence-lanes">
            <div>
              <h5>Practice evidence</h5>
              <p>
                {focus.latest_practice
                  ? `Latest assessable practice: ${focus.latest_practice.status}.`
                  : "No assessable practice decision recorded."}
              </p>
              {focus.latest_practice && (
                <a href={focus.latest_practice.href}>Review latest practice</a>
              )}
            </div>
            <div>
              <h5>Independent evidence</h5>
              <p>
                {focus.latest_independent
                  ? `Latest assessable independent decision: ${focus.latest_independent.status}.`
                  : "Practice does not supply independent evidence."}
              </p>
              {focus.latest_independent && (
                <a href={focus.latest_independent.href}>
                  Review latest independent exercise
                </a>
              )}
              <p>
                {focus.independent_contexts} distinct template / site / version
                context{focus.independent_contexts === 1 ? "" : "s"}. Repeats do
                not become independent demonstrations.
              </p>
            </div>
          </div>
          <p>
            Readiness is not established by these observations. Supported
            practice never clears an independent finding; both remain
            inspectable below.
          </p>
          <details>
            <summary>
              Inspect {focus.evidence.length} versioned evidence observation
              {focus.evidence.length === 1 ? "" : "s"}
            </summary>
            {focus.evidence.length ? (
              focus.evidence.map((e) => (
                <Evidence key={`${e.session_id}-${e.competency}`} item={e} />
              ))
            ) : (
              <p>No verified mission observations in this window.</p>
            )}
          </details>
        </section>
      )}
      <p>
        Showing {journey.window.included_sessions} of{" "}
        {journey.window.total_sessions} completed personal mission sessions.{" "}
        {journey.window.truncated
          ? `History is bounded to the newest ${journey.window.limit}; older evidence is outside this view.`
          : `This view includes at most ${journey.window.limit} sessions.`}{" "}
        Active and offline queued attempts are excluded. Evidence is ordered by
        completion time, with creation-time fallback for legacy records.
      </p>
      <details>
        <summary>Evidence limits and visibility</summary>
        <ul>
          {journey.limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}
