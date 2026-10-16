import { useEffect, useState } from "react";
import SkillHeatmap from "./SkillHeatmap";
import ReviewTrendChart from "./review-TrendChart";
import { api } from "./storage";
import type { UnitIdentity } from "./unit-state";
import type { GhostSkill } from "./types";
import { skillLabel } from "./Ghost";
import { officerReviewHref } from "./routes";
import { EmptyState } from "./UI";
type Point = {
  sequence: number;
  session_id: string;
  kind: string;
  processed_at: string;
  means: Record<GhostSkill, number>;
  director_focus: GhostSkill | null;
  director_mastery_before: number | null;
};
type Session = {
  id: string;
  title: string;
  pack: string;
  seed: number;
  observed_tick: number | null;
  score: number;
  nodes: {
    detect: number;
    classify: number;
    prioritise: number;
    engage: number;
  };
  leakers: number;
  roe_breaches: number;
  failures: Record<string, number>;
};
type History = {
  prior: Record<GhostSkill, number>;
  points: Point[];
  sessions: Session[];
  note: string;
};
export function Trend({
  history,
}: {
  history: { points: Point[]; note: string };
}) {
  return (
    <>
      <ReviewTrendChart points={history.points} />
      <p className="review-evidence-boundary">{history.note}</p>
      <details className="analytics-detail">
        <summary>Exact historical estimates and baseline prior</summary>
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Exact historical skill estimates"
        >
          <table>
            <thead>
              <tr>
                <th>Sequence</th>
                <th>Session / processed</th>
                {Object.values(skillLabel).map((label) => (
                  <th key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Prior</td>
                <td>Beta(1,1), before observations</td>
                {Object.keys(skillLabel).map((s) => (
                  <td key={s}>50.00%</td>
                ))}
              </tr>
              {history.points.map((p) => (
                <tr key={p.session_id}>
                  <td>
                    {p.sequence} · {p.kind}
                  </td>
                  <td title={p.session_id}>
                    {p.session_id.slice(0, 10)}
                    <small>{new Date(p.processed_at).toLocaleString()}</small>
                  </td>
                  {Object.keys(skillLabel).map((s) => (
                    <td key={s}>
                      {(100 * p.means[s as GhostSkill]).toFixed(2)}%
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      {!history.points.length && (
        <p>
          No completed training observations yet. Only baseline priors are
          available.
        </p>
      )}
    </>
  );
}
type AnalyticsView =
  "overview" | "scenario" | "comparison" | "director" | "unit";
const viewHashes: Record<AnalyticsView, string> = {
  overview: "",
  scenario: "#scenario-skill",
  comparison: "#session-comparison",
  director: "#director-history",
  unit: "#unit-trend",
};
function viewFromHash(hash: string): AnalyticsView {
  return (
    (Object.keys(viewHashes) as AnalyticsView[]).find(
      (view) => viewHashes[view] === hash,
    ) ?? "overview"
  );
}
type AnalysisSelection = {
  unit: string;
  trainee: string;
  a: string | null;
  b: string | null;
};
function selectionFromUrl(identity?: UnitIdentity): AnalysisSelection {
  const query = new URLSearchParams(window.location.search);
  const unit = query.get("unit") || identity?.unit_id || "local";
  return {
    unit,
    trainee:
      query.get("trainee") ??
      (unit === identity?.unit_id ? identity.trainee_id : ""),
    a: query.get("sessionA"),
    b: query.get("sessionB"),
  };
}
export default function Analytics({ identity }: { identity?: UnitIdentity }) {
  const [roster, setRoster] = useState<{
      unit: string;
      trainees: UnitIdentity[];
    } | null>(null),
    [selection, setSelection] = useState(() => selectionFromUrl(identity)),
    [units, setUnits] = useState<{ id: string; name: string }[]>([]),
    [loadedHistory, setHistory] = useState<{
      unit: string;
      trainee: string;
      data: History;
    } | null>(null),
    [loadedUnitHistory, setUnitHistory] = useState<{
      unit: string;
      points: Point[];
      note: string;
    } | null>(null),
    [error, setError] = useState(""),
    [view, setView] = useState<AnalyticsView>(() =>
      viewFromHash(window.location.hash),
    );
  const unit = selection.unit;
  const unitHistory =
    loadedUnitHistory?.unit === unit ? loadedUnitHistory : null;
  const trainees = roster?.unit === unit ? roster.trainees : [];
  const tid = selection.trainee
    ? (trainees.find((t) => t.trainee_id === selection.trainee)?.trainee_id ??
      "")
    : (trainees[0]?.trainee_id ?? "");
  const history =
    loadedHistory?.unit === unit && loadedHistory.trainee === tid
      ? loadedHistory.data
      : null;
  const a =
    selection.a === null
      ? (history?.sessions.at(-2)?.id ?? history?.sessions[0]?.id ?? "")
      : (history?.sessions.find((s) => s.id === selection.a)?.id ?? "");
  const b =
    selection.b === null
      ? (history?.sessions.at(-1)?.id ?? "")
      : (history?.sessions.find((s) => s.id === selection.b)?.id ?? "");
  useEffect(() => {
    const update = () => {
      setView(viewFromHash(window.location.hash));
      setSelection(selectionFromUrl(identity));
    };
    window.addEventListener("hashchange", update);
    window.addEventListener("popstate", update);
    return () => {
      window.removeEventListener("hashchange", update);
      window.removeEventListener("popstate", update);
    };
  }, [identity]);
  function navigateView(next: AnalyticsView) {
    const hash = viewHashes[next];
    if (window.location.hash !== hash) {
      const url = new URL(window.location.href);
      url.hash = hash;
      window.history.pushState(window.history.state, "", url);
    }
    setView(next);
  }
  function navigateSelection(next: AnalysisSelection) {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries({
      unit: next.unit,
      trainee: next.trainee,
      sessionA: next.a,
      sessionB: next.b,
    })) {
      if (value === null) url.searchParams.delete(key);
      else url.searchParams.set(key, value);
    }
    if (url.href !== window.location.href)
      window.history.pushState(window.history.state, "", url);
    setSelection(next);
  }
  useEffect(() => {
    let stopped = false;
    void api<{ units: { id: string; name: string }[] }>("/units")
      .then((r) => {
        if (!stopped) setUnits(r.units);
      })
      .catch((e) => {
        if (!stopped) setError(e.message);
      });
    return () => {
      stopped = true;
    };
  }, []);
  useEffect(() => {
    let stopped = false;
    setUnitHistory(null);
    setRoster(null);
    setError("");
    void Promise.all([
      api<{ trainees: UnitIdentity[] }>(
        `/units/${encodeURIComponent(unit)}/trainees`,
      ),
      api<{ points: Point[]; note: string }>(
        `/units/${encodeURIComponent(unit)}/analytics`,
      ),
    ])
      .then(([r, u]) => {
        if (!stopped) {
          setRoster({ unit, trainees: r.trainees });
          setUnitHistory({ ...u, unit });
        }
      })
      .catch((e) => {
        if (!stopped) setError(e.message);
      });
    return () => {
      stopped = true;
    };
  }, [unit]);
  useEffect(() => {
    let stopped = false;
    setHistory(null);
    setError("");
    if (!tid)
      return () => {
        stopped = true;
      };
    void api<History>(`/trainees/${encodeURIComponent(tid)}/analytics`)
      .then((h) => {
        if (stopped) return;
        setHistory({ unit, trainee: tid, data: h });
      })
      .catch((e) => {
        if (!stopped) setError(e.message);
      });
    return () => {
      stopped = true;
    };
  }, [tid, unit]);
  const left = history?.sessions.find((s) => s.id === a),
    right = history?.sessions.find((s) => s.id === b);
  const metrics: [string, (s: Session) => number][] = [
    ["Detection / 25", (s) => s.nodes.detect],
    ["Classification / 25", (s) => s.nodes.classify],
    ["Priority / timely resolution / 15", (s) => s.nodes.prioritise],
    ["Engagement / 35", (s) => s.nodes.engage],
    ["Late detections", (s) => s.failures.DETECTION_LATE ?? 0],
    [
      "Wrong effector / ineffective RF",
      (s) =>
        (s.failures.WRONG_EFFECTOR ?? 0) +
        (s.failures.NO_RF_JAM_INEFFECTIVE ?? 0),
    ],
    ["Asset impacts", (s) => s.leakers],
    ["ROE breaches", (s) => s.roe_breaches],
  ];
  return (
    <main className="instructor-page advanced-page">
      <header className="page-heading">
        <div>
          <div className="eyebrow">PERSISTED TRAINING EVIDENCE</div>
          <h1>Training analytics</h1>
          <p>Historical estimates and observed differences.</p>
        </div>
        <nav className="advanced-nav">
          <a href="/">Training home</a>
          <a href="/instructor">Instructor console</a>
          <a href="/exercises">Exercise studio</a>
        </nav>
      </header>
      {error && <p role="alert">{error}</p>}
      <div className="studio-fields">
        <label>
          Unit
          <select
            value={unit}
            onChange={(e) =>
              navigateSelection({
                unit: e.target.value,
                trainee: "",
                a: null,
                b: null,
              })
            }
          >
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Trainee
          <select
            value={tid}
            disabled={roster?.unit !== unit || !trainees.length}
            onChange={(e) =>
              navigateSelection({
                unit,
                trainee: e.target.value,
                a: null,
                b: null,
              })
            }
          >
            <option value={tid}>
              {trainees.find((t) => t.trainee_id === tid)?.callsign ??
                (roster?.unit !== unit
                  ? "Loading trainees…"
                  : selection.trainee
                    ? "Requested trainee unavailable"
                    : "No trainees in this unit")}
            </option>
            {trainees
              .filter((t) => t.trainee_id !== tid)
              .map((t) => (
                <option key={t.trainee_id} value={t.trainee_id}>
                  {t.callsign}
                </option>
              ))}
          </select>
        </label>
      </div>
      {roster?.unit === unit && selection.trainee && !tid && (
        <p role="status">
          The linked trainee is unavailable in this unit. Choose an available
          trainee to inspect their evidence.
        </p>
      )}
      {history && ((selection.a && !a) || (selection.b && !b)) && (
        <p role="status">
          A linked session is unavailable for this trainee. Choose an available
          session to compare; no substitute evidence has been selected.
        </p>
      )}
      <p className="analytics-view-hint">
        Choose an analysis view · scroll to see all views on narrow screens
      </p>
      <nav className="analytics-tabs" aria-label="Analytics views">
        {(
          [
            ["overview", "Overview"],
            ["scenario", "Scenario × skill"],
            ["comparison", "Session comparison"],
            ["director", "Director history"],
            ["unit", "Unit trend"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            className="button subtle"
            aria-pressed={view === key}
            onClick={() => navigateView(key)}
          >
            {label}
          </button>
        ))}
      </nav>
      {view === "overview" && (
        <section className="panel advanced-card analytics-overview">
          <div className="eyebrow">SELECTED TRAINEE · PERSISTED EVIDENCE</div>
          <h2>Evidence at a glance</h2>
          <div className="analytics-evidence-ledger">
            <div className="analytics-ledger-total">
              <strong>{history ? history.sessions.length : "—"}</strong>
              <span>completed tactical sessions</span>
              <small>
                {history ? history.points.length : "—"} processed
                learning-ledger entries
              </small>
            </div>
            <div className="analytics-ledger-context">
              <span>Latest recorded exercise</span>
              <h3>
                {history?.sessions.at(-1)?.title ??
                  "Your evidence starts with a completed drill"}
              </h3>
              <p>
                {history?.sessions.at(-1)
                  ? `${history.sessions.at(-1)!.score}/100 · frozen server result. Open its AAR to inspect decisions and the scoring rubric.`
                  : "Choose a trainee with completed training to explore decisions, skill estimates and scenario comparisons."}
              </p>
              {history?.sessions.at(-1) && (
                <a
                  className="text-button"
                  href={officerReviewHref(history.sessions.at(-1)!.id)}
                >
                  Investigate latest AAR →
                </a>
              )}
            </div>
          </div>
          <p className="review-evidence-boundary">
            Scores are simulated exercise outcomes. Skill means are historical
            Bayesian estimates; shared Crew sessions do not contribute to
            individual learning profiles. Observed differences do not establish
            learning efficacy.
          </p>
          {history && history.sessions.length >= 2 ? (
            <button
              className="text-button"
              onClick={() => navigateView("comparison")}
            >
              Inspect two recorded sessions
            </button>
          ) : (
            <p className="footnote">
              Session comparison becomes available after two completed tactical
              exercises for the selected trainee.
            </p>
          )}
        </section>
      )}
      {view === "scenario" && tid && (
        <SkillHeatmap key={`${unit}/${tid}`} unit={unit} trainee={tid} />
      )}
      {history && (
        <>
          {view === "overview" && (
            <section className="panel advanced-card analytics-detail">
              <h2>Trainee skill trend</h2>
              <Trend history={history} />
            </section>
          )}
          {view === "overview" && (
            <section className="panel advanced-card analytics-session-ledger">
              <div className="analytics-section-heading">
                <div>
                  <p className="eyebrow">FROZEN RESULTS</p>
                  <h2>Exercise evidence</h2>
                </div>
                <span>{history.sessions.length} recorded</span>
              </div>
              {history.sessions.length ? (
                <div
                  className="table-scroll"
                  tabIndex={0}
                  role="region"
                  aria-label="Completed exercise evidence"
                >
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Exercise / scenario</th>
                        <th scope="col">Observed time</th>
                        <th scope="col">Score</th>
                        <th scope="col">Review</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...history.sessions].reverse().map((session) => (
                        <tr key={session.id}>
                          <td>
                            <strong>{session.title}</strong>
                            <small>
                              {session.pack} · seed {session.seed}
                            </small>
                          </td>
                          <td>
                            {session.observed_tick === null
                              ? "Unknown"
                              : `${(session.observed_tick / 30).toFixed(2)}s`}
                          </td>
                          <td className="mono">{session.score}/100</td>
                          <td>
                            <a
                              href={officerReviewHref(session.id)}
                              aria-label={`Review ${session.title} · ${session.id.slice(0, 8)}`}
                            >
                              Open AAR →
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState title="No completed exercises yet">
                  Complete a tactical drill for this trainee to create a
                  verified decision record. Baseline priors alone do not show
                  learning.
                </EmptyState>
              )}
            </section>
          )}
          {view === "comparison" && (
            <section
              className="panel advanced-card analytics-detail"
              id="session-comparison"
            >
              <div className="eyebrow">
                DESCRIPTIVE COMPARISON · ORIGINALS UNCHANGED
              </div>
              <h2>Session A vs Session B</h2>
              <div className="studio-fields">
                {[
                  ["A", a],
                  ["B", b],
                ].map(([label, id]) => (
                  <label key={label as string}>
                    Session {label as string}
                    <select
                      value={id as string}
                      onChange={(e) =>
                        navigateSelection({
                          unit,
                          trainee: tid,
                          a: label === "A" ? e.target.value : a,
                          b: label === "B" ? e.target.value : b,
                        })
                      }
                    >
                      <option value="">Select session</option>
                      {history.sessions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title} · {s.id.slice(0, 8)} · {s.score}/100
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              {left && right ? (
                <>
                  <p>
                    A: {left.pack}, seed {left.seed}, observed T+
                    {left.observed_tick === null
                      ? "unknown"
                      : (left.observed_tick / 30).toFixed(2)}
                    s. B: {right.pack}, seed {right.seed}, observed T+
                    {right.observed_tick === null
                      ? "unknown"
                      : (right.observed_tick / 30).toFixed(2)}
                    s.
                  </p>
                  <div
                    className="table-scroll"
                    tabIndex={0}
                    role="region"
                    aria-label="Persisted session comparison"
                  >
                    <table className="analytics-comparison-table">
                      <caption>
                        Persisted hostile-node averages and distinct failure
                        counts
                      </caption>
                      <thead>
                        <tr>
                          <th>Metric</th>
                          <th>A</th>
                          <th>B</th>
                          <th>
                            <span className="comparison-difference-label">
                              Observed difference{" "}
                            </span>
                            B − A
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {metrics.map(([label, value]) => (
                          <tr key={label}>
                            <td>{label}</td>
                            <td>{value(left)}</td>
                            <td>{value(right)}</td>
                            <td>{(value(right) - value(left)).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p>
                    Node scores average hostile contacts before penalties;
                    failure counts use distinct contact/reason pairs.
                    Differences do not establish that training caused
                    improvement.
                  </p>
                  <p className="footnote">
                    The 15-point node may represent priority ranking or legacy
                    timely resolution. Inspect each saved AAR for its frozen
                    rubric before comparing exercise versions.
                  </p>
                </>
              ) : (
                <p>
                  {history.sessions.length < 2
                    ? "Complete two tactical sessions for a comparison."
                    : "Choose Session A and Session B from the saved records to compare."}
                </p>
              )}
            </section>
          )}
          {view === "director" && (
            <section
              className="panel advanced-card analytics-detail"
              id="director-history"
            >
              <h2>Director focus history</h2>
              <div
                className="table-scroll"
                tabIndex={0}
                role="region"
                aria-label="Frozen Director selection history"
              >
                <table>
                  <caption>
                    Persisted adaptive selections and model estimates
                  </caption>
                  <thead>
                    <tr>
                      <th>Session</th>
                      <th>Selected focus</th>
                      <th>Estimate before</th>
                      <th>Estimate after completion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.points
                      .filter((p) => p.director_focus)
                      .map((p) => (
                        <tr key={p.session_id}>
                          <td>
                            {p.sequence} · {p.session_id.slice(0, 8)}
                          </td>
                          <td>{skillLabel[p.director_focus!]}</td>
                          <td>
                            {((p.director_mastery_before ?? 0.5) * 100).toFixed(
                              2,
                            )}
                            %
                          </td>
                          <td>
                            {(p.means[p.director_focus!] * 100).toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {!history.points.some((p) => p.director_focus) && (
                <p>
                  No adaptive focus has been recorded in this trainee's
                  processed history.
                </p>
              )}
              <p>
                Selection and outcome history make adaptation visible; these are
                Bayesian estimates, not calibrated readiness or efficacy
                measurements.
              </p>
            </section>
          )}
        </>
      )}
      {!history && tid && view !== "unit" && view !== "scenario" && !error && (
        <p role="status">Loading selected trainee's persisted evidence…</p>
      )}
      {!tid && view !== "unit" && (
        <p>
          No trainee selected. Choose a unit and trainee to inspect individual
          evidence.
        </p>
      )}
      {unitHistory && view === "unit" && (
        <section className="panel advanced-card" id="unit-trend">
          <h2>Unit skill trend</h2>
          <Trend history={unitHistory} />
        </section>
      )}
    </main>
  );
}
