import { useEffect, useRef, useState } from "react";
import { api, download } from "./storage";
type Report = {
  version: string;
  catalog_hash: string;
  receipt_sha256: string;
  trials: number;
  cases: {
    case: string;
    least_assessed_competencies: string[];
    policies: {
      policy: string;
      selections: number;
      least_assessed_selections: number;
      last_two_repeat_selections: number;
      competency_counts: Record<string, number>;
    }[];
  }[];
  limitations: string[];
};
export default function CurriculumPolicyDiagnostic() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const generation = useRef(0),
    pending = useRef(false);
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
    setError("");
    setReport(null);
    try {
      const next = await api<Report>(
        "/evaluations/policy-diagnostics/coverage",
      );
      if (active !== generation.current) return;
      if (
        next.version !== "curriculum-policy-diagnostic-v1" ||
        next.trials !== 64 ||
        next.cases.length !== 6
      )
        throw new Error(
          "Unexpected policy diagnostic contract; no result accepted.",
        );
      setReport(next);
    } catch (failure) {
      if (active === generation.current) setError((failure as Error).message);
    } finally {
      if (active === generation.current) {
        pending.current = false;
        setBusy(false);
      }
    }
  }
  return (
    <section
      className="panel advanced-card"
      aria-labelledby="curriculum-policy-title"
    >
      <h2 id="curriculum-policy-title">Curriculum selection laboratory</h2>
      <p>
        Compare the current coverage-first selector with uniform and round-robin
        practice on six fixed synthetic histories, using 64 shared seeds. No
        trainee history is read and no exercise is started.
      </p>
      <p>
        These are selection and recency checks. They do not predict learning,
        certify fairness or replace the active Director.
      </p>
      <button
        className="button secondary"
        disabled={busy}
        onClick={() => void run()}
      >
        {busy ? "Comparing selection policies…" : "Compare curriculum policies"}
      </button>
      {busy && <p role="status">Comparing bounded synthetic histories…</p>}
      {error && (
        <p role="alert">{error} Use Compare curriculum policies to retry.</p>
      )}
      {report && (
        <div aria-label="Curriculum policy comparison">
          <p role="status">
            Six synthetic cases · {report.trials} seeds per policy. Full inputs
            and selected items are included in the export.
          </p>
          <div
            className="table-scroll"
            role="region"
            aria-label="Selection policy results"
            tabIndex={0}
          >
            <table>
              <caption>
                Selections of least-assessed competencies and recent items ·
                counts, not learning scores
              </caption>
              <thead>
                <tr>
                  <th scope="col">Fixed history</th>
                  <th scope="col">Policy</th>
                  <th scope="col">Least-assessed selection</th>
                  <th scope="col">Repeat of last two items</th>
                  <th scope="col">Competency selections</th>
                </tr>
              </thead>
              <tbody>
                {report.cases.flatMap((c) =>
                  c.policies.map((p) => (
                    <tr key={`${c.case}:${p.policy}`}>
                      <th scope="row">{c.case}</th>
                      <td>{p.policy}</td>
                      <td>
                        {p.least_assessed_selections}/{p.selections} ·{" "}
                        {c.least_assessed_competencies.join(", ")}
                      </td>
                      <td>
                        {p.last_two_repeat_selections}/{p.selections}
                      </td>
                      <td>
                        {Object.entries(p.competency_counts)
                          .map(([id, n]) => `${id}: ${n}`)
                          .join(" · ")}
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
          <p>
            Inspect the recency-versus-coverage case: avoiding both recent items
            can defer an underexposed competency. A zero in that column is a
            disclosed tradeoff.
          </p>
          <ul>
            {report.limitations.map((limit) => (
              <li key={limit}>{limit}</li>
            ))}
          </ul>
          <details>
            <summary>Reproduction identifiers</summary>
            <p>
              Catalog SHA-256: <code>{report.catalog_hash}</code>
            </p>
            <p>
              Receipt SHA-256: <code>{report.receipt_sha256}</code>
            </p>
          </details>
          <button
            className="button subtle"
            onClick={() =>
              download("VYUHA-curriculum-policy-diagnostic.json", report)
            }
          >
            Export policy diagnostic
          </button>
        </div>
      )}
    </section>
  );
}
