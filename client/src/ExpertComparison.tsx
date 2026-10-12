import React, { useEffect, useState } from "react";
import { RECONSTRUCTION_TIMEOUT_MS, api } from "./storage";
import type { Record as TrainingRecord } from "./types";
export type ReferenceReport = {
  schema_version: 1;
  kind: "available_evidence_response_comparison";
  session_id: string;
  engine_version: string;
  mode: "original_history_boundary_comparison";
  replayed_end_tick: number;
  hz: number;
  input_fingerprint: string;
  entries: {
    decision_index: number;
    tick: number;
    order: number;
    track_id: string;
    recorded_effector: string;
    available_evidence: {
      rf: { available: boolean; signal: boolean | null; iff: string };
      visual: { available: boolean; silhouette: string | null };
      prior_classification: string | null;
      prior_identity: string | null;
      range_m: number | null;
    };
    reference_policy: {
      action: string;
      confidence: string;
      cues: string[];
      basis: "available_evidence";
    };
    agrees_with_policy: boolean;
    identity_assurance: string;
    iff_no_reply_is_hostility: false;
    rubric_reference: {
      basis: "full_rubric_truth";
      label: string;
      effector: string;
      limitation: string;
    };
  }[];
  summary: {
    recorded_responses: number;
    agreements: number;
    agreement_fraction: number | null;
    supported: number;
    conditional: number;
    uncertain: number;
    interpretation: string;
  };
  limitations: string[];
  original_history_unchanged: true;
};
const label = (effector: string) =>
  effector === "rf_jam"
    ? "RF jammer"
    : effector === "kinetic"
      ? "Kinetic response"
      : "Hold";
export function EvidenceResponseComparison({
  report,
}: {
  report: ReferenceReport;
}) {
  return (
    <section className="panel advanced-card">
      <h2>Evidence-constrained response comparison</h2>
      <p>
        Each recorded response is compared at its original tick using the
        evidence then available. This reference is an inspectable training
        policy, not a certified military expert.
      </p>
      <p>
        {report.summary.agreements} / {report.summary.recorded_responses}{" "}
        recorded responses match the policy. {report.summary.interpretation}
      </p>
      <p>
        {report.summary.supported} supported · {report.summary.conditional}{" "}
        conditional · {report.summary.uncertain} uncertain reference choices
      </p>
      {!report.entries.length && (
        <p>
          No engagement was recorded; no policy agreement fraction is assigned.
        </p>
      )}
      {report.entries.map((entry) => (
        <details key={`${entry.decision_index}-${entry.order}`}>
          <summary>
            {entry.track_id} · T+{(entry.tick / report.hz).toFixed(2)}s ·
            recorded {label(entry.recorded_effector)} ·{" "}
            {entry.agrees_with_policy ? "matches" : "differs from"} policy
          </summary>
          <h3>Available-evidence reference</h3>
          <p>
            {label(entry.reference_policy.action)} ·{" "}
            {entry.reference_policy.confidence} · basis:{" "}
            {entry.reference_policy.basis}
          </p>
          <ul>
            {entry.reference_policy.cues.map((cue) => (
              <li key={cue}>{cue}</li>
            ))}
          </ul>
          <p>
            Recorded classification:{" "}
            {entry.available_evidence.prior_classification ?? "unestablished"} /{" "}
            {entry.available_evidence.prior_identity ?? "unestablished"}. IFF:{" "}
            {entry.available_evidence.rf.iff}. No reply does not prove
            hostility; a hostile declaration alone is not verified
            identification.
          </p>
          <h3>Separately labelled rubric/type-range reference</h3>
          <p>
            {label(entry.rubric_reference.effector)} · basis:{" "}
            {entry.rubric_reference.basis}
          </p>
          <p>{entry.rubric_reference.limitation}</p>
        </details>
      ))}
      <details>
        <summary>Scope and limitations</summary>
        <ul>
          {report.limitations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p>
          {report.engine_version} · one replay of original accepted history
          through T+{(report.replayed_end_tick / report.hz).toFixed(2)}s.
          Original score, completed history and skill profiles remain unchanged.
        </p>
      </details>
    </section>
  );
}
export default function ExpertComparison({
  record,
}: {
  record: TrainingRecord;
}) {
  const [report, setReport] = useState<ReferenceReport | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let stopped = false;
    setReport(null);
    setError("");
    if (!record.verified) return;
    api<ReferenceReport>(
      `/sessions/${encodeURIComponent(record.id)}/reference-policy`,
      undefined,
      RECONSTRUCTION_TIMEOUT_MS,
    )
      .then((result) => {
        if (!stopped) setReport(result);
      })
      .catch((reason) => {
        if (!stopped)
          setError(
            reason instanceof Error
              ? reason.message
              : "Reference comparison unavailable.",
          );
      });
    return () => {
      stopped = true;
    };
  }, [record.id, record.verified]);
  if (!record.verified)
    return (
      <section className="panel">
        <h2>Evidence-constrained response comparison</h2>
        <p>Server verification of this completed session is required.</p>
      </section>
    );
  return report ? (
    <EvidenceResponseComparison report={report} />
  ) : (
    <section className="panel">
      <h2>Evidence-constrained response comparison</h2>
      {error ? (
        <p role="alert">{error} The original result remains unchanged.</p>
      ) : (
        <p role="status">Reconstructing recorded response boundaries…</p>
      )}
    </section>
  );
}
