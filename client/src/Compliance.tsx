import { useEffect, useState } from "react";
import { api } from "./storage";

export type ComplianceItem = {
  id: string;
  audit_finding: string;
  status: "PASS" | "PARTIAL" | "N/A";
  severity: string;
  source_kind:
    "official_clause_or_platform_choice" | "audit_quality_expectation";
  implementation: string;
  tests: string;
  remaining_limitation: string;
  problem_statement_relevance: string;
  user_visible_proof: string;
  evidence_url: string;
  implemented_is_not_validated: true;
  finding_url?: string;
  evidence_documents?: { title: string; url: string }[];
  live_workflow?: {
    url: string;
    required_context: string;
    scope: string;
  } | null;
};
export type ComplianceManifest = {
  schema_version: 1;
  project: string;
  release_status: string;
  recorded_date: string;
  baseline_commit: string;
  branch: string;
  independent_score: number | null;
  score_note: string;
  source: {
    kind: string;
    url: string;
    fallback_url: string;
    description: string;
  };
  totals: Partial<Record<ComplianceItem["status"], number>>;
  items: ComplianceItem[];
  checkpoints: Record<string, unknown>;
  remaining: string[];
  documents: { id: string; title: string; url: string }[];
  freshness_note: string;
};
export function officialItems(manifest: ComplianceManifest) {
  return manifest.items.filter(
    (item) => item.source_kind === "official_clause_or_platform_choice",
  );
}
export function ComplianceBoard({
  manifest,
  initialFinding = "",
}: {
  manifest: ComplianceManifest;
  initialFinding?: string;
}) {
  const [scope, setScope] = useState<"official" | "all">(
    initialFinding ? "all" : "official",
  );
  const [focused, setFocused] = useState(initialFinding);
  const sourceRows =
    scope === "official" ? officialItems(manifest) : manifest.items;
  const rows = focused
    ? sourceRows.filter((row) => row.id === focused)
    : sourceRows;
  return (
    <main className="instructor-page">
      <header>
        <p className="breadcrumb">SYSTEM / REQUIREMENTS AND EVIDENCE</p>
        <h1>SIH26247 compliance board</h1>
        <p>{manifest.release_status}</p>
      </header>
      <section className="panel">
        <h2>Implementation and validation are separate</h2>
        <p>
          Each finding keeps its own acceptance status. Candidate code and
          scoped software tests do not certify the complete training product.
        </p>
        <p>
          {manifest.items.length} traceable findings ·{" "}
          {manifest.totals.PASS ?? 0} passed · {manifest.totals.PARTIAL ?? 0}{" "}
          partial · {manifest.totals["N/A"] ?? 0} not applicable
        </p>
        <p>
          {manifest.independent_score === null
            ? "A final independent acceptance score has not been recorded."
            : `Recorded final independent acceptance score: ${manifest.independent_score}/100.`}{" "}
          {manifest.score_note}
        </p>
        <p>{manifest.source.description}</p>
        <a href={manifest.source.url} target="_blank" rel="noreferrer">
          Inspect archived official problem statement
        </a>
        {" · "}
        <a href={manifest.source.fallback_url}>Read source provenance</a>
      </section>
      <section className="panel">
        <h2>Requirement traceability</h2>
        <div className="segmented">
          <button
            aria-pressed={scope === "official"}
            onClick={() => {
              setScope("official");
              setFocused("");
            }}
          >
            Official requirements and platform choice
          </button>
          <button
            aria-pressed={scope === "all"}
            onClick={() => {
              setScope("all");
              setFocused("");
            }}
          >
            All 93 audit findings
          </button>
        </div>
        <p>
          Difficulty, anti-rote variety, scientific fidelity and instructor
          depth remain quality objectives. They are not presented as additional
          verbatim official clauses.
        </p>
        <label>
          Focus finding
          <select value={focused} onChange={(e) => setFocused(e.target.value)}>
            <option value="">All findings in this scope</option>
            {sourceRows.map((row) => (
              <option key={row.id} value={row.id}>
                {row.id} · {row.audit_finding}
              </option>
            ))}
          </select>
        </label>
        {focused && !rows.length && (
          <p role="alert">
            This finding is unavailable. Select another recorded finding.
          </p>
        )}
        <div style={{ overflowX: "auto" }}>
          <table>
            <caption>
              {scope === "official"
                ? "Official requirements, including the desktop OR VR alternative"
                : "Complete acceptance backlog"}
            </caption>
            <thead>
              <tr>
                <th>Finding</th>
                <th>Acceptance status</th>
                <th>Implementation / validation evidence</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} id={`finding-${row.id}`}>
                  <td>
                    <strong>
                      {row.id} · {row.audit_finding}
                    </strong>
                    <p>{row.problem_statement_relevance}</p>
                    <small>
                      {row.source_kind === "official_clause_or_platform_choice"
                        ? "Archived official requirement / platform choice"
                        : "Audit / training-quality objective"}
                    </small>
                  </td>
                  <td>
                    {row.status}
                    <p>{row.severity}</p>
                  </td>
                  <td>
                    <details>
                      <summary>
                        Implementation, tests and remaining limits
                      </summary>
                      <h3>Candidate implementation</h3>
                      <p>{row.implementation}</p>
                      <h3>Executed / required checks</h3>
                      <p>{row.tests}</p>
                      <h3>Remaining validation</h3>
                      <p>{row.remaining_limitation}</p>
                      <h3>Required user-visible proof</h3>
                      <p>{row.user_visible_proof}</p>
                      <a href={row.evidence_url}>
                        Open this finding’s acceptance record
                      </a>
                      {row.finding_url && (
                        <>
                          {" "}
                          · <a href={row.finding_url}>Link to this finding</a>
                        </>
                      )}
                      {row.evidence_documents?.map((doc) => (
                        <p key={doc.url}>
                          <a href={doc.url}>{doc.title}</a>
                        </p>
                      ))}
                      {row.live_workflow && (
                        <>
                          <h3>Relevant live workflow</h3>
                          <a href={row.live_workflow.url}>
                            Open workflow for {row.id}
                          </a>
                          <p>{row.live_workflow.required_context}</p>
                          <p>{row.live_workflow.scope}</p>
                        </>
                      )}
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <h2>Scoped software checkpoints</h2>
        <p>{manifest.freshness_note}</p>
        <details>
          <summary>Inspect recorded checkpoint data</summary>
          <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            {JSON.stringify(manifest.checkpoints, null, 2)}
          </pre>
        </details>
        <p>
          Parity checks establish agreement between implementations. They do not
          calibrate sensor values, establish human learning efficacy or certify
          new physical LAN operation.
        </p>
      </section>
      <section className="panel">
        <h2>Remaining release requirements</h2>
        {manifest.remaining.length ? (
          <ul>
            {manifest.remaining.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p>
            Consult the final release acceptance document; absence of a listed
            item is not acceptance.
          </p>
        )}
      </section>
      <section className="panel">
        <h2>Evidence documents</h2>
        <ul>
          {manifest.documents.map((doc) => (
            <li key={doc.id}>
              <a href={doc.url}>{doc.title}</a>
            </li>
          ))}
        </ul>
        <a href="/system/evidence">Open source freshness and system evidence</a>
        <p className="footnote">
          {manifest.branch} · baseline {manifest.baseline_commit.slice(0, 12)} ·
          recorded {manifest.recorded_date}
        </p>
      </section>
    </main>
  );
}
export default function Compliance() {
  const [manifest, setManifest] = useState<ComplianceManifest | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let stopped = false;
    api<ComplianceManifest>("/system/compliance")
      .then((result) => {
        if (!stopped) setManifest(result);
      })
      .catch((reason) => {
        if (!stopped)
          setError(
            reason instanceof Error
              ? reason.message
              : "Compliance evidence unavailable.",
          );
      });
    return () => {
      stopped = true;
    };
  }, []);
  return manifest ? (
    <ComplianceBoard
      manifest={manifest}
      initialFinding={
        new URLSearchParams(window.location.search).get("finding") ?? ""
      }
    />
  ) : (
    <main className="instructor-page">
      <h1>SIH26247 compliance board</h1>
      {error ? (
        <p role="alert">
          {error} The acceptance documents remain the authoritative record.
        </p>
      ) : (
        <p role="status">Loading recorded requirement evidence…</p>
      )}
      <a href="/system/evidence">Open system evidence</a>
    </main>
  );
}
