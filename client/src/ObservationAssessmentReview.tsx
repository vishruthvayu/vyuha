import type { Action, Record as TrainingRecord, TimelineItem } from "./types";
import type { SensorObservation } from "./sensors-v2";
import type { ObservationTemplate } from "./observation-missions";
export type EvidenceSupport =
  "supported" | "unsupported" | "inconclusive" | "unassessable";
type Finding = {
  dimension: string;
  status: EvidenceSupport;
  code: string;
  explanation: string;
  evidence_ids: string[];
};
export type ObservationAssessment = {
  version: "evidence-assessment-v1";
  session_id: string;
  mission_version: "observation-mission-v1";
  criterion_profile: ObservationTemplate;
  mode: "practice" | "assessment";
  assessed: boolean;
  observed_end_tick: number;
  score_contract: "separate-from-frozen-rubric";
  decisions: {
    id: string;
    tick: number;
    order: number;
    track: string;
    action: Action;
    status: EvidenceSupport;
    findings: Finding[];
    available_evidence: {
      tick: number;
      track: string;
      has_geometry: boolean;
      observation: SensorObservation;
      current_optical_results: {
        resultId: string;
        channel: "eo" | "ir";
        sampleTick: number;
        releaseTick: number;
        expiryTick: number;
        reading: { available: boolean; level: string };
      }[];
    };
    confidence: { status: "not_assessed"; reason: string };
  }[];
  acquisitions: {
    id: string;
    track: string;
    channel: "eo" | "ir";
    accepted_tick: number;
    accepted_order: number;
    sample_tick: number;
    release_tick: number;
    released_order: number | null;
    result_id: string | null;
    expiry_tick: number | null;
    utility: string;
    explanation: string;
    available_before_decisions: string[];
    cognitive_use: "not_observed";
  }[];
  competencies: {
    id: string;
    status: EvidenceSupport;
    decision_ids: string[];
    observation_scope: string;
    criterion: string;
  }[];
  summary: {
    decisions: number;
    statuses: Partial<Record<EvidenceSupport, number>>;
    requests: number;
    mastery_awarded: false;
  };
  follow_up: {
    competency: string;
    template: ObservationTemplate;
    mode: "practice";
    seed: number;
    reason: string;
    href: string;
  };
  limitations: string[];
  input_fingerprint: string;
  report_hash: string;
};
const when = (tick: number) => `T+${(tick / 30).toFixed(2)}s`;
const human = (value: string) => value.replaceAll("_", " ");
const actionName = (a: Action) =>
  a.k === "classify"
    ? `Declare ${human(a.kind ?? "unknown")} / ${a.identity ?? "unknown"}`
    : a.k === "engage"
      ? `Choose ${human(a.effector ?? "unknown")}`
      : "Designate";
export default function ObservationAssessmentReview({
  record,
  onJump,
}: {
  record: TrainingRecord & { observation_assessment?: ObservationAssessment };
  onJump?: (event: TimelineItem) => void;
}) {
  const report = record.observation_assessment;
  if (
    !record.verified ||
    record.scenario.engine_version !== "vyuha-0.5.0" ||
    report?.version !== "evidence-assessment-v1" ||
    report.session_id !== record.id
  )
    return null;
  return (
    <section
      className="observation-assessment"
      aria-label="Mission evidence assessment"
    >
      <header>
        <span className="eyebrow">
          RECONSTRUCTED SUPPORT / {report.version}
        </span>
        <h2>An answer can be correct before its reasoning is established.</h2>
        <p>
          The original {record.scorecard.score}/100 rubric result is preserved.
          This separate educational model asks what the frozen public reports
          support at each accepted decision boundary.
        </p>
        <strong>
          {report.assessed ? "Independent software form" : "Practice evidence"}
          {" · "}No mastery awarded
        </strong>
        <p className="assessment-scope-note">
          Explicit Hold is evaluated separately from the preceding declaration.
          This frozen action alphabet cannot record an unclassified defer
          choice; inactivity is not interpreted as justified uncertainty.
          Choices are not confidence statements.
        </p>
      </header>
      <nav
        className="assessment-competency-strip"
        aria-label="Mission competency evidence"
      >
        {report.competencies.map((c) => (
          <a
            key={c.id}
            href={`/academy?competency=${encodeURIComponent(c.id)}`}
          >
            <strong>{c.id}</strong>
            <span data-support={c.status}>{human(c.status)}</span>
            <small>{c.criterion}</small>
            <small>One mission observation · not proficiency</small>
          </a>
        ))}
      </nav>
      <div className="assessment-decision-chain">
        {report.decisions.length ? (
          report.decisions.map((d) => (
            <article key={d.id} data-support={d.status}>
              <header>
                <span>
                  {when(d.tick)} · BEFORE ORDER {d.order} · {d.track}
                </span>
                <h3>{actionName(d.action)}</h3>
                <strong>{human(d.status)}</strong>
              </header>
              <ol
                aria-label={`Evidence support for ${d.track} at ${when(d.tick)}`}
              >
                {d.findings.map((f) => (
                  <li key={f.dimension}>
                    <span>
                      {f.dimension} · <b>{human(f.status)}</b>
                    </span>
                    <p>{f.explanation}</p>
                    <small>
                      {f.evidence_ids.join(" → ") ||
                        "No supporting report reference"}
                    </small>
                  </li>
                ))}
              </ol>
              <details>
                <summary>Inspect the exact available evidence</summary>
                <dl>
                  <dt>Radar</dt>
                  <dd>
                    {d.available_evidence.observation.radar.state} · reported
                    geometry{" "}
                    {d.available_evidence.has_geometry ? "available" : "absent"}
                  </dd>
                  <dt>RF / IFF</dt>
                  <dd>
                    {d.available_evidence.observation.rf.detected
                      ? "Signal reported"
                      : "No signal reported"}{" "}
                    · {human(d.available_evidence.observation.iff.cue)}
                  </dd>
                </dl>
                {d.available_evidence.current_optical_results.length ? (
                  <ul>
                    {d.available_evidence.current_optical_results.map((r) => (
                      <li key={r.resultId}>
                        {r.channel.toUpperCase()} ·{" "}
                        {r.reading.available
                          ? human(r.reading.level)
                          : "unavailable"}
                        {" · "}sample {when(r.sampleTick)}, release{" "}
                        {when(r.releaseTick)}, expiry {when(r.expiryTick)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>
                    No current released optical result. Other available cues
                    still matter.
                  </p>
                )}
              </details>
              {onJump && (
                <button
                  className="button subtle"
                  onClick={() =>
                    onJump({
                      id: d.id,
                      tick: d.tick,
                      order: d.order,
                      category: "trainee_action",
                      code: "EDUCATIONAL_SUPPORT",
                      title: actionName(d.action),
                      track_id: d.track,
                      decision_id: null,
                      seek_before: true,
                    })
                  }
                >
                  Reconstruct this boundary
                </button>
              )}
            </article>
          ))
        ) : (
          <p>
            No decision was recorded in the observed interval. Requests or
            inactivity do not become assessed reasoning.
          </p>
        )}
      </div>
      <details className="assessment-acquisitions">
        <summary>
          What did the requests add? · {report.acquisitions.length} accepted
        </summary>
        <ol>
          {report.acquisitions.map((q) => (
            <li key={q.id}>
              <strong>
                {q.track} / {q.channel.toUpperCase()} · {human(q.utility)}
              </strong>
              <p>{q.explanation}</p>
              <span>
                Request {when(q.accepted_tick)} → sample {when(q.sample_tick)} →{" "}
                {q.result_id
                  ? `release ${when(q.release_tick)}`
                  : "no publication before end"}
              </span>
              <small>
                {q.available_before_decisions.length} later decisions had this
                result current. Cognitive use was not observed.
              </small>
            </li>
          ))}
        </ol>
      </details>
      <aside className="assessment-next-mission">
        <div>
          <span className="eyebrow">EVIDENCE → NEXT PRACTICE</span>
          <h3>{report.follow_up.competency} · changed conditions</h3>
          <p>{report.follow_up.reason}</p>
        </div>
        <a className="button primary" href={report.follow_up.href}>
          Open the next mission briefing
        </a>
      </aside>
      <details>
        <summary>Interpretation contract and limits</summary>
        <ul>
          {report.limitations.map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ul>
        <small>
          Input {report.input_fingerprint} · Report {report.report_hash}
        </small>
      </details>
    </section>
  );
}
