import { officerReviewHref } from "./routes";
import { useState } from "react";
import { api, RECONSTRUCTION_TIMEOUT_MS } from "./storage";
import type { GroupResult } from "./Unit";
type Evidence = {
  version: string;
  site: string;
  mode: string;
  mastery_awarded: false;
  limitations: string[];
  results: {
    session_id: string;
    callsign: string;
    status: string;
    verified: boolean;
    original_tactical_score: number | null;
    evidence: null | {
      observed_end_tick: number;
      decisions: number;
      requests: number;
      competencies: { id: string; status: string }[];
      declared_deferrals: { tick: number; reason: string; track: string }[];
      follow_up: { href: string; reason: string };
    };
  }[];
};
export default function SiteEpisodeReview({
  groups,
}: {
  groups: GroupResult[];
}) {
  const [selected, setSelected] = useState(""),
    [result, setResult] = useState<Evidence | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function inspect() {
    if (!selected || busy) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(
        await api<Evidence>(
          `/units/local/exercises/${encodeURIComponent(selected)}/observation-evidence`,
          undefined,
          RECONSTRUCTION_TIMEOUT_MS,
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="panel site-episode-review"
      aria-label="Instructor site evidence"
    >
      <header>
        <span className="eyebrow">INSTRUCTOR / VERIFIED EPISODE EVIDENCE</span>
        <h2>Compare outcomes with their evidence.</h2>
        <p>
          Use existing assigned-group lineage. Tactical correctness, declared
          uncertainty and public evidence support remain separate.
        </p>
      </header>
      <label>
        Assigned exercise group
        <select
          value={selected}
          disabled={busy}
          onChange={(e) => {
            setSelected(e.target.value);
            setResult(null);
            setError("");
          }}
        >
          <option value="">Choose a group</option>
          {groups.map((g) => (
            <option value={g.exercise_group_id} key={g.exercise_group_id}>
              {g.exercise_group_id}
            </option>
          ))}
        </select>
      </label>
      <button
        className="button"
        disabled={!selected || busy}
        onClick={() => void inspect()}
      >
        {busy
          ? "Reconstructing verified evidence…"
          : "Inspect group observation evidence"}
      </button>
      {error && <p role="alert">{error}</p>}
      {result && (
        <>
          <h3>
            {result.site} · {result.mode}
          </h3>
          <div className="site-episode-people">
            {result.results.map((r) => (
              <article key={r.session_id}>
                <h4>{r.callsign}</h4>
                <strong>
                  {r.verified
                    ? `Verified tactical score ${r.original_tactical_score}/100`
                    : `${r.status} · evidence pending`}
                </strong>
                {r.evidence && (
                  <>
                    <p>
                      {(r.evidence.observed_end_tick / 30).toFixed(1)}s observed
                      · {r.evidence.decisions} decisions · {r.evidence.requests}{" "}
                      requests
                    </p>
                    <ul>
                      {r.evidence.competencies.map((c) => (
                        <li key={c.id}>
                          {c.id} · {c.status}
                        </li>
                      ))}
                    </ul>
                    <p>
                      {r.evidence.declared_deferrals.length} explicit Defer
                      declarations · no mastery inferred
                    </p>
                    <a href={officerReviewHref(r.session_id)}>
                      Open verified Ghost
                    </a>
                    <p>{r.evidence.follow_up.reason}</p>
                    <a href={r.evidence.follow_up.href}>
                      Inspect next-practice briefing
                    </a>
                  </>
                )}
              </article>
            ))}
          </div>
          {result.limitations.map((l) => (
            <p className="footnote" key={l}>
              {l}
            </p>
          ))}
        </>
      )}
    </section>
  );
}
