import { useEffect, useRef, useState } from "react";
import { api, download, RECONSTRUCTION_TIMEOUT_MS } from "./storage";

type Assignment = {
  requested_seed: number;
  compiled_seed: number;
  duration_seconds: number;
  terrain: string;
  night: boolean;
  fog: number;
  family: string;
  focus: string;
  difficulty: string;
  compiler_rejected_candidates: number;
};
type GenerationReport = {
  receipt_sha256: string;
  receipt: {
    version: string;
    item_id: string;
    mode: string;
    study_mode: string;
    requested_seed: number;
    max_attempts: number;
    disposition: string;
    attempted_count: number;
    accepted_count: number;
    rejected_count: number;
    frozen_inputs: { catalog_hash: string; content_version: string };
    attempts: {
      attempt: number;
      requested_seed: number;
      disposition: string;
      rejection_reasons: string[];
      parameter_assignment: Assignment | null;
      scenario_sha256: string | null;
    }[];
    limitation: string;
  };
};

function matchesRequest(report: GenerationReport) {
  const receipt = report?.receipt;
  return (
    receipt?.version === "c01-generation-receipt-v1" &&
    receipt.item_id === "C01_BASELINE-A_A" &&
    receipt.mode === "assessment" &&
    receipt.study_mode === "not-enrolled" &&
    receipt.requested_seed === 7 &&
    receipt.max_attempts === 2 &&
    /^[a-f0-9]{64}$/.test(report.receipt_sha256) &&
    /^[a-f0-9]{64}$/.test(receipt.frozen_inputs?.catalog_hash) &&
    Array.isArray(receipt.attempts) &&
    Number.isInteger(receipt.attempted_count) &&
    receipt.attempted_count >= 1 &&
    receipt.attempted_count <= 2 &&
    receipt.attempted_count === receipt.attempts.length &&
    [0, 1].includes(receipt.accepted_count) &&
    Number.isInteger(receipt.rejected_count) &&
    receipt.rejected_count >= 0 &&
    receipt.accepted_count + receipt.rejected_count ===
      receipt.attempted_count &&
    (receipt.accepted_count === 0
      ? receipt.disposition === "generation-exhausted" &&
        receipt.attempts.every((attempt) => attempt.disposition === "invalid")
      : ["valid", "valid-ambiguous"].includes(receipt.disposition) &&
        receipt.attempts.filter((attempt) =>
          ["valid", "valid-ambiguous"].includes(attempt.disposition),
        ).length === 1)
  );
}

export default function AssessmentGeneration() {
  const [report, setReport] = useState<GenerationReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const pending = useRef(false);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  async function run() {
    if (pending.current) return;
    pending.current = true;
    const active = ++generation.current;
    setBusy(true);
    setReport(null);
    setError("");
    try {
      const next = await api<GenerationReport>(
        "/evaluations/assessment-diagnostics/c01/generation?seed=7&max_attempts=2",
        undefined,
        RECONSTRUCTION_TIMEOUT_MS,
      );
      if (active !== generation.current) return;
      if (!matchesRequest(next))
        throw new Error(
          "Unexpected assessment generation contract; no result accepted.",
        );
      setReport(next);
    } catch (failure) {
      if (active === generation.current)
        setError(
          (failure as Error).message || "Generation diagnostic unavailable.",
        );
    } finally {
      if (active === generation.current) {
        pending.current = false;
        setBusy(false);
      }
    }
  }
  const receipt = report?.receipt;
  const accepted = receipt?.attempts.find((attempt) =>
    ["valid", "valid-ambiguous"].includes(attempt.disposition),
  );
  const assignment = accepted?.parameter_assignment;
  return (
    <details className="panel advanced-card">
      <summary>Assessment generation receipt</summary>
      <p>
        Officer-only diagnostic for C01_BASELINE-A_A · seed 7 · at most two
        candidate attempts. Runs only when requested. No training allocation or
        participant enrollment occurs, and this does not establish human
        solvability, difficulty equivalence or empirical fairness.
      </p>
      <button
        className="button secondary"
        disabled={busy}
        onClick={() => void run()}
      >
        {busy ? "Generating assessment receipt…" : "Run assessment generation"}
      </button>
      {busy && (
        <p role="status">Checking bounded passive observation candidates…</p>
      )}
      {error && (
        <p role="alert">{error} Use Run assessment generation to retry.</p>
      )}
      {receipt && report && (
        <div aria-label="Assessment generation result">
          <p role="status">
            {receipt.disposition} · Accepted: {receipt.accepted_count} ·
            Rejected: {receipt.rejected_count} · Exhausted requests:{" "}
            {receipt.disposition === "generation-exhausted" ? 1 : 0} ·
            Attempted: {receipt.attempted_count}/{receipt.max_attempts}.
          </p>
          {assignment && (
            <p>
              Accepted frozen parameters: requested seed{" "}
              {assignment.requested_seed}, compiled seed{" "}
              {assignment.compiled_seed}; {assignment.family} ·{" "}
              {assignment.focus} · {assignment.difficulty};{" "}
              {assignment.duration_seconds} seconds · {assignment.terrain} ·{" "}
              {assignment.night ? "night" : "day"} · fog {assignment.fog}.
              Compiler-rejected candidates:{" "}
              {assignment.compiler_rejected_candidates}.
            </p>
          )}
          {receipt.attempts.some(
            (attempt) => attempt.rejection_reasons.length > 0,
          ) && (
            <ul>
              {receipt.attempts
                .filter((attempt) => attempt.rejection_reasons.length > 0)
                .map((attempt) => (
                  <li key={attempt.attempt}>
                    Attempt {attempt.attempt} · seed {attempt.requested_seed}:{" "}
                    {attempt.rejection_reasons.join(", ")}.
                  </li>
                ))}
            </ul>
          )}
          <p>{receipt.limitation}</p>
          <dl style={{ overflowWrap: "anywhere" }}>
            <dt>Receipt / content version</dt>
            <dd>
              {receipt.version} / {receipt.frozen_inputs.content_version}
            </dd>
            <dt>Item / mode / study</dt>
            <dd>
              {receipt.item_id} / {receipt.mode} / {receipt.study_mode}
            </dd>
            <dt>Receipt SHA-256</dt>
            <dd>{report.receipt_sha256}</dd>
            <dt>Catalog SHA-256</dt>
            <dd>{receipt.frozen_inputs.catalog_hash}</dd>
            {accepted?.scenario_sha256 && (
              <>
                <dt>Accepted scenario SHA-256</dt>
                <dd>{accepted.scenario_sha256}</dd>
              </>
            )}
          </dl>
          <button
            className="button subtle"
            onClick={() =>
              download("VYUHA-assessment-generation-seed7.json", report)
            }
          >
            Export assessment generation JSON
          </button>
        </div>
      )}
    </details>
  );
}
