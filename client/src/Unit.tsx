import { PageHeader } from "./UI";
import { officerReviewHref } from "./routes";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "./storage";
import { ProfilePanel } from "./Director";
import { skillLabel } from "./Ghost";
import {
  newId,
  readIdentity,
  storeIdentity,
  type UnitIdentity,
} from "./unit-state";
import type {
  GhostSkill,
  TrainingProfile,
  Record as TrainingRecord,
  InstructorSession,
} from "./types";
export type RosterMember = UnitIdentity & { connected: boolean; busy: boolean };
type UnitTrainee = UnitIdentity & {
  profile: TrainingProfile;
  latest_adaptive_focus: GhostSkill | null;
};
export type UnitReport = {
  shared_aggregate_count?: number;
  individual_cohort_scope?: string;
  unit: { id: string; name: string };
  trainee_count: number;
  session_count: number;
  active_trainees: number;
  completed_today: number;
  day_basis: string;
  skill_means: { [K in GhostSkill]: number | null };
  weakest_skill: GhostSkill | null;
  affected_trainees: number;
  affected_threshold: number;
  trainees: UnitTrainee[];
  failures: { [code: string]: number };
  failure_scope: string;
  excluded_reviews: string[];
  sessions: TrainingRecord[];
  active_sessions: InstructorSession[];
};
export type GroupResult = {
  exercise_group_id: string;
  scenario_id: string;
  created_at: string;
  results: {
    session_id: string;
    trainee_id: string;
    callsign: string;
    status: string;
    score: number | null;
    node_averages: {
      prioritise?: number;
      detect: number | null;
      classify: number | null;
      engage: number | null;
    };
  }[];
};
export type Assignment = {
  session_id: string;
  exercise_group_id: string;
  scenario: TrainingRecord["scenario"];
};
export function UnitGateway({
  children,
  fallbackNavigation,
}: {
  children: (identity?: UnitIdentity) => ReactNode;
  fallbackNavigation?: ReactNode;
}) {
  const [identity, setIdentity] = useState<UnitIdentity | null>(() =>
    readIdentity(localStorage),
  );
  const [unitMode, setUnitMode] = useState<boolean | null>(null);
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
  const [unit, setUnit] = useState("local");
  const [callsign, setCallsign] = useState("");
  const [resumeId, setResumeId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let stopped = false;
    void api<{ mode: string }>("/health")
      .then(async (h) => {
        if (stopped) return;
        setUnitMode(h.mode === "unit");
        if (h.mode === "unit") {
          const list = await api<{ units: { id: string; name: string }[] }>(
            "/units",
          );
          if (!stopped) setUnits(list.units);
          const saved = readIdentity(localStorage);
          if (saved) {
            try {
              const checked = await api<UnitIdentity>("/units/join", {
                unit_id: saved.unit_id,
                callsign: saved.callsign,
                trainee_id: saved.trainee_id,
              });
              if (!stopped) setIdentity(checked);
            } catch (e) {
              if (!stopped) {
                setIdentity(null);
                setError(
                  e instanceof Error
                    ? e.message
                    : "Saved identity unavailable.",
                );
              }
            }
          }
        }
      })
      .catch(() => {
        if (!stopped) {
          setUnitMode(!!identity);
          setError(
            "Server unavailable. A saved identity can continue its own recovered drill.",
          );
        }
      });
    return () => {
      stopped = true;
    };
  }, []);
  async function join() {
    setBusy(true);
    try {
      const saved = JSON.parse(
        localStorage.getItem("vyuha-pending-join-v1") || "null",
      ) as { request_id: string; unit_id: string; callsign: string } | null;
      const request =
        saved && saved.unit_id === unit && saved.callsign === callsign
          ? saved
          : { request_id: newId(), unit_id: unit, callsign };
      localStorage.setItem("vyuha-pending-join-v1", JSON.stringify(request));
      const id = await api<UnitIdentity>("/units/join", {
        ...request,
        ...(resumeId ? { trainee_id: resumeId } : {}),
      });
      localStorage.removeItem("vyuha-pending-join-v1");
      storeIdentity(localStorage, id);
      setIdentity(id);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Join failed.");
    } finally {
      setBusy(false);
    }
  }
  if (unitMode === null)
    return (
      <>
        {fallbackNavigation}
        <main className="unit-entry">
          <h1>Connecting to VYUHA…</h1>
        </main>
      </>
    );
  if (!unitMode) return children();
  if (identity) return children(identity);
  return (
    <>
      {fallbackNavigation}
      <main className="unit-entry">
        <section className="panel">
          <div className="eyebrow">VYUHA · UNIT TRAINING</div>
          <h1>Join your training unit</h1>
          <p>
            Use a callsign. Your training profile belongs to the server-assigned
            identity saved in this browser.
          </p>
          <label>
            Unit
            <select
              aria-label="Unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            >
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Callsign
            <input
              aria-label="Callsign"
              maxLength={24}
              value={callsign}
              onChange={(e) =>
                setCallsign(e.target.value.replace(/[^A-Za-z0-9_-]/g, ""))
              }
            />
          </label>
          <label>
            Existing trainee ID (optional)
            <input
              aria-label="Existing trainee ID"
              maxLength={24}
              value={resumeId}
              onChange={(e) => setResumeId(e.target.value)}
            />
          </label>
          <button
            className="button primary"
            disabled={busy || !callsign || !units.length}
            title={
              busy
                ? "Joining the selected unit."
                : !callsign
                  ? "Enter a callsign first."
                  : !units.length
                    ? "No unit loaded; check the local server connection."
                    : undefined
            }
            onClick={() => void join()}
          >
            {busy ? "Joining…" : "Join unit"}
          </button>
          {error && <p role="alert">{error}</p>}
          <p className="footnote">
            Trusted local network prototype · Trainee callsigns are not
            authenticated; officer controls require sign-in. Internet is not
            required during training.
          </p>
          <a href="/instructor">Officer console</a>
        </section>
      </main>
    </>
  );
}
export function UnitAnalytics({
  report,
  onOpen,
  onSelect,
}: {
  report: UnitReport;
  onOpen: (record: TrainingRecord) => void;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const matches = (value: string) =>
    value.toLowerCase().includes(query.trim().toLowerCase());
  const trainees = report.trainees.filter((person) =>
    matches(`${person.callsign} ${person.trainee_id}`),
  );
  const sessions = report.sessions.filter((record) =>
    matches(
      `${record.trainee} ${record.scenario.title} ${record.id} ${report.trainees.find((person) => person.trainee_id === record.trainee)?.callsign ?? ""}`,
    ),
  );
  return (
    <>
      <div className="metric-grid unit-summary-band">
        <article className="metric">
          <span>Registered trainees</span>
          <strong>{report.trainee_count}</strong>
        </article>
        <article className="metric">
          <span>Active trainees</span>
          <strong>{report.active_trainees}</strong>
        </article>
        <article className="metric">
          <span>Completed today ({report.day_basis})</span>
          <strong>{report.completed_today}</strong>
        </article>
        <article className="metric">
          <span>Completed sessions</span>
          <strong>{report.session_count}</strong>
        </article>
      </div>
      <section className="panel training-profile">
        <div className="panel-header">
          <strong>Unit training mastery estimates</strong>
        </div>
        <p>
          Mean of registered trainee Beta means, including baseline priors. Not
          operational readiness.
        </p>
        {!!report.shared_aggregate_count && (
          <p>
            {report.shared_aggregate_count} shared crew aggregate
            {report.shared_aggregate_count === 1 ? "" : "s"} excluded from
            individual mastery averages. Shared scores remain in exercise
            history.
          </p>
        )}
        <div className="ghost-skill-grid">
          {Object.entries(report.skill_means).map(([s, n]) => (
            <div key={s}>
              <span>{skillLabel[s as GhostSkill]}</span>
              <strong>
                {n === null ? "No evidence" : `${Math.round(n * 100)}%`}
              </strong>
            </div>
          ))}
        </div>
        <h3>Unit training focus</h3>
        <p>
          {report.weakest_skill
            ? `${skillLabel[report.weakest_skill]} · ${report.affected_trainees} / ${report.trainee_count} trainees below ${report.affected_threshold * 100}% estimate. Baseline priors may determine this focus.`
            : "Join trainees to establish a baseline."}
        </p>
      </section>
      <div className="unit-evidence-filter">
        <label>
          Find trainee or exercise
          <input
            type="search"
            value={query}
            placeholder="Callsign, exercise or session ID"
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <p role="status">
          {trainees.length} matching profiles · {sessions.length} matching
          sessions. Unit summary includes the full cohort.
        </p>
      </div>
      <section className="panel score-table">
        <div className="panel-header">
          <strong>Trainee profiles</strong>
        </div>
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Trainee skill profiles"
        >
          <table>
            <thead>
              <tr>
                <th>Callsign</th>
                {Object.values(skillLabel).map((s) => (
                  <th key={s}>{s}</th>
                ))}
                <th>Processed sessions</th>
                <th>Latest adaptive focus</th>
              </tr>
            </thead>
            <tbody>
              {trainees.map((t) => (
                <tr key={t.trainee_id}>
                  <td>
                    <button
                      className="text-button"
                      onClick={() => onSelect(t.trainee_id)}
                    >
                      {t.callsign}
                    </button>
                  </td>
                  {Object.entries(t.profile.skills).map(([s, p]) => (
                    <td key={s}>
                      {Math.round(p.mean * 100)}%
                      <small className="cell-evidence">
                        {p.observations} observations
                        {p.observations === 0
                          ? " · baseline"
                          : p.observations < 5
                            ? " · limited"
                            : ""}
                      </small>
                    </td>
                  ))}
                  <td>{t.profile.sessions}</td>
                  <td>
                    {t.latest_adaptive_focus
                      ? skillLabel[t.latest_adaptive_focus]
                      : "No started adaptive drill"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel unit-failures">
        <div className="panel-header">
          <strong>Unit failure patterns</strong>
        </div>
        <p>{report.failure_scope}. Source: authoritative Ghost reviews.</p>
        {Object.entries(report.failures).length ? (
          <table>
            <thead>
              <tr>
                <th>Ghost reason</th>
                <th>Contact observations</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(report.failures).map(([code, n]) => (
                <tr key={code}>
                  <td>{code}</td>
                  <td>{n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No recorded failures in this history.</p>
        )}
        {report.excluded_reviews.length > 0 && (
          <p>
            {report.excluded_reviews.length} unreconstructable reviews excluded.
          </p>
        )}
      </section>
      <section className="panel history">
        <div className="panel-header">
          <strong>Verified session history</strong>
        </div>
        <div className="record-list">
          {sessions.map((r) => (
            <button key={r.id} onClick={() => onOpen(r)}>
              <span>
                {report.trainees.find((t) => t.trainee_id === r.trainee)
                  ?.callsign ?? r.trainee}{" "}
                · {r.scenario.title}
                <small>
                  {new Date(r.created_at).toLocaleString()} · Server verified
                </small>
              </span>
              <strong>{r.scorecard.score}/100</strong>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
export function GroupResults({ groups }: { groups: GroupResult[] }) {
  return (
    <section className="panel score-table">
      <div className="panel-header">
        <strong>Group exercise results</strong>
      </div>
      {groups.length ? (
        groups.map((g) => (
          <div key={g.exercise_group_id}>
            <p className="mono">
              {g.exercise_group_id} · {g.scenario_id}
            </p>
            <div
              className="table-scroll"
              tabIndex={0}
              role="region"
              aria-label="Group exercise results"
            >
              <table>
                <thead>
                  <tr>
                    <th>Trainee</th>
                    <th>Status</th>
                    <th>Score / 100</th>
                    <th>Detection / 25</th>
                    <th>IFF / 25</th>
                    {g.results.some(
                      (r) => r.node_averages.prioritise !== undefined,
                    ) && <th>Priority / 15</th>}
                    <th>Effector / 35</th>
                    <th>AAR</th>
                  </tr>
                </thead>
                <tbody>
                  {g.results.map((r) => (
                    <tr key={r.session_id}>
                      <td>{r.callsign}</td>
                      <td>{r.status}</td>
                      <td>{r.score ?? "Pending"}</td>
                      <td>{r.node_averages.detect ?? "—"}</td>
                      <td>{r.node_averages.classify ?? "—"}</td>
                      {g.results.some(
                        (r) => r.node_averages.prioritise !== undefined,
                      ) && <td>{r.node_averages.prioritise ?? "—"}</td>}
                      <td>{r.node_averages.engage ?? "—"}</td>
                      <td>
                        {r.status === "completed" && (
                          <a href={officerReviewHref(r.session_id)}>
                            Open review
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      ) : (
        <p>No group exercises assigned yet.</p>
      )}
      <p>
        Each row has independent logs and authoritative scoring. Node values are
        hostile-contact averages.
      </p>
    </section>
  );
}
export function UnitDashboard({
  unitId = "local",
  onOpen,
}: {
  unitId?: string;
  onOpen: (r: TrainingRecord) => void;
}) {
  const [report, setReport] = useState<UnitReport | null>(null);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [groups, setGroups] = useState<GroupResult[]>([]);
  const [diagnostics, setDiagnostics] = useState<{
    status: string;
    database: string;
    active_sessions: number;
    connected_clients: number;
    pending_assignments: number;
    sync_note: string;
    offline_assets: string;
    security: string;
  } | null>(null);
  useEffect(() => {
    let stopped = false,
      pending = false;
    const refresh = async () => {
      if (pending) return;
      pending = true;
      try {
        const [r, g, d] = await Promise.all([
          api<UnitReport>(`/units/${unitId}/dashboard`),
          api<{ groups: GroupResult[] }>(`/units/${unitId}/exercises`),
          api<typeof diagnostics>(`/units/${unitId}/status`),
        ]);
        if (!stopped) {
          setReport(r);
          setGroups(g.groups);
          setDiagnostics(d);
          setError("");
        }
      } catch {
        if (!stopped)
          setError("Server unavailable. Displayed analytics may be stale.");
      } finally {
        pending = false;
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 3000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [unitId]);
  const person = report?.trainees.find((t) => t.trainee_id === selected);
  return (
    <>
      {error && <p role="status">{error}</p>}
      {report ? (
        <>
          <UnitAnalytics
            report={report}
            onOpen={onOpen}
            onSelect={setSelected}
          />
          {person && (
            <section className="panel">
              <div className="panel-header">
                <strong>{person.callsign} · Profile and history</strong>
              </div>
              <ProfilePanel profile={person.profile} />
              <p>
                Latest started adaptive focus:{" "}
                {person.latest_adaptive_focus
                  ? skillLabel[person.latest_adaptive_focus]
                  : "none"}
              </p>
              <div className="record-list">
                {report.sessions
                  .filter((r) => r.trainee === selected)
                  .map((r) => (
                    <button key={r.id} onClick={() => onOpen(r)}>
                      {r.scenario.title} · {r.scorecard.score}/100 · Open AAR
                    </button>
                  ))}
              </div>
            </section>
          )}
          <GroupResults groups={groups} />
          {diagnostics && (
            <section className="panel unit-status">
              <div className="panel-header">
                <strong>Unit server diagnostics</strong>
              </div>
              <p>
                Status: {diagnostics.status} · Database: {diagnostics.database}
              </p>
              <p>
                Active sessions: {diagnostics.active_sessions} · Connected
                browser clients: {diagnostics.connected_clients} · Pending
                assignments: {diagnostics.pending_assignments}
              </p>
              <p>{diagnostics.sync_note}</p>
              <p>{diagnostics.offline_assets}</p>
              <p>{diagnostics.security}</p>
            </section>
          )}
        </>
      ) : (
        <p>Loading persisted unit analytics…</p>
      )}
    </>
  );
}
export default function UnitPage() {
  return (
    <main className="instructor-page">
      <PageHeader
        eyebrow="PERSISTED UNIT EVIDENCE"
        title="Unit training overview"
        description="Review the unit’s recorded sessions, skill estimates and training focus."
        actions={
          <nav className="advanced-nav">
            <a className="button subtle" href="/instructor">
              Instructor console
            </a>
            <a className="button subtle" href="/?view=unit">
              Trainee workspace overview
            </a>
          </nav>
        }
      />
      <UnitDashboard
        onOpen={(r) => {
          window.location.href = officerReviewHref(r.id);
        }}
      />
    </main>
  );
}
