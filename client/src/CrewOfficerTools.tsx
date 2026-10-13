import React, { useEffect, useState } from "react";
import { api } from "./storage";
import { officerReviewHref } from "./routes";
import { CrewCoordination, type CoordinationMetrics } from "./Crew";
import type { ScoreCard } from "./types";

type Capability = {
  member_id: string;
  callsign: string;
  role: string;
  status: "active" | "expired" | "revoked" | "rotation_required";
  expires_at: number | null;
  revoked_at: string | null;
};
type Roster = {
  id: string;
  name: string;
  status: string;
  members: Capability[];
};
export type CrewHistoryData = {
  included_sessions: number;
  scope: string;
  interpretation: string;
  timing_basis: string;
  sessions: {
    session_id: string;
    name: string;
    source: string;
    created_at: string;
    completed_at: string | null;
    scenario: {
      title: string;
      family: string | null;
      difficulty: string | null;
    };
    scorecard: ScoreCard;
    coordination_metrics: CoordinationMetrics;
    coordination_timeline?: {
      tick: number;
      order: number;
      k: string;
      track: string;
      callsign: string | null;
      role: string | null;
      attributed: boolean;
    }[];
    timeline_total_actions?: number;
    timeline_truncated?: boolean;
  }[];
  groups: {
    group_id: string;
    name: string;
    source: string;
    grouping_basis?: string;
    session_count: number;
    median_designation_to_classification_s: number | null;
    median_classification_to_response_s: number | null;
    members: { callsign: string; role: string; accepted_actions: number }[];
  }[];
};
const seconds = (value: number | null) =>
  value === null ? "No recorded pair" : `${value.toFixed(2)}s`;

export function CrewHistoryResults({ data }: { data: CrewHistoryData }) {
  return (
    <>
      <p>{data.included_sessions} completed shared exercises.</p>
      <details className="evidence-disclosure">
        <summary>Shared history scope and interpretation</summary>
        <p>{data.scope}</p>
        <p className="footnote">{data.interpretation}</p>
      </details>
      {data.included_sessions === 0 && (
        <p>
          No completed shared exercises yet. End and score a crew exercise to
          create a recorded coordination review.
        </p>
      )}
      <h3>Declared roster history</h3>
      {data.groups.map((group) => (
        <div key={group.group_id} className="panel">
          <h4>
            {group.name} · {group.session_count} sessions
          </h4>
          <p>{group.source.replaceAll("_", " ")}</p>
          {group.grouping_basis && <p>{group.grouping_basis}</p>}
          <p>
            Designation → classification:{" "}
            {seconds(group.median_designation_to_classification_s)}.
            Classification → response:{" "}
            {seconds(group.median_classification_to_response_s)}.
          </p>
          <ul>
            {group.members.map((member) => (
              <li key={`${member.callsign}-${member.role}`}>
                {member.callsign} · {member.role} · {member.accepted_actions}{" "}
                accepted decisions
              </li>
            ))}
          </ul>
        </div>
      ))}
      <h3>Completed session timeline</h3>
      {data.sessions.map((session) => (
        <details className="evidence-disclosure" key={session.session_id}>
          <summary>
            {session.name} · {session.completed_at ?? session.created_at} ·
            shared {session.scorecard.score}/100
          </summary>
          <p>
            {session.scenario.title} ·{" "}
            {session.scenario.family ?? "No family label"} ·{" "}
            {session.scenario.difficulty ?? "No difficulty label"}
          </p>
          <CrewCoordination metrics={session.coordination_metrics} />
          <h4>Accepted role-attributed decisions</h4>
          {session.timeline_truncated && (
            <p>
              Showing the latest 100 of {session.timeline_total_actions}{" "}
              accepted decisions. Open the AAR for the complete log.
            </p>
          )}
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Logical time / order</th>
                  <th>Member / role</th>
                  <th>Decision / contact</th>
                </tr>
              </thead>
              <tbody>
                {session.coordination_timeline?.map((action) => (
                  <tr key={action.order}>
                    <td>
                      T+{(action.tick / 30).toFixed(2)}s · #{action.order}
                    </td>
                    <td>
                      {action.attributed
                        ? `${action.callsign} · ${action.role}`
                        : "Unattributed"}
                    </td>
                    <td>
                      {action.k} · {action.track}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <a href={officerReviewHref(session.session_id)}>
            Open completed officer AAR
          </a>
        </details>
      ))}
      <p className="footnote">{data.timing_basis}</p>
    </>
  );
}

export default function CrewOfficerTools({ createdId }: { createdId: string }) {
  const [crewId, setCrewId] = useState(createdId);
  const [roster, setRoster] = useState<Roster | null>(null);
  const [history, setHistory] = useState<CrewHistoryData | null>(null);
  const [minutes, setMinutes] = useState(480);
  const [revealed, setRevealed] = useState<{
    member_id: string;
    code: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setCrewId(createdId);
    setRoster(null);
    setRevealed(null);
  }, [createdId]);
  async function loadMembers() {
    setBusy(true);
    setError("");
    setRevealed(null);
    try {
      setRoster(
        await api<Roster>(`/crews/${encodeURIComponent(crewId)}/members`),
      );
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function update(member: Capability, action: "rotate" | "revoke") {
    if (!roster || roster.id !== crewId) return;
    setBusy(true);
    setError("");
    setRevealed(null);
    try {
      const result = await api<Capability & { code?: string }>(
        `/crews/${encodeURIComponent(roster.id)}/members/${encodeURIComponent(member.member_id)}/${action}`,
        action === "rotate" ? { valid_minutes: minutes } : {},
      );
      if (result.code)
        setRevealed({ member_id: member.member_id, code: result.code });
      setRoster(
        await api<Roster>(`/crews/${encodeURIComponent(roster.id)}/members`),
      );
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function loadHistory() {
    setBusy(true);
    setError("");
    try {
      setHistory(await api<CrewHistoryData>("/crews/history?limit=20"));
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="panel command-detail">
        <h2>Officer role-code management</h2>
        <p>
          Codes expire after a bounded assignment window. Rotation invalidates
          the previous code; revocation blocks access immediately. Neither
          changes accepted decisions or results. Older unbounded codes require
          officer rotation.
        </p>
        <label>
          Crew ID to manage
          <input
            value={crewId}
            disabled={busy}
            onChange={(event) => {
              setCrewId(event.target.value);
              setRoster(null);
              setRevealed(null);
            }}
          />
        </label>
        <button
          className="button subtle"
          disabled={!crewId || busy}
          onClick={() => void loadMembers()}
        >
          Load crew roles
        </button>
        <label>
          New code validity
          <select
            value={minutes}
            disabled={busy}
            onChange={(event) => setMinutes(Number(event.target.value))}
          >
            {[15, 60, 480, 1440].map((value) => (
              <option key={value} value={value}>
                {value < 60 ? `${value} minutes` : `${value / 60} hours`}
              </option>
            ))}
          </select>
        </label>
        {roster && (
          <>
            <h3>
              {roster.name} · {roster.status}
            </h3>
            {roster.members.map((member) => (
              <div key={member.member_id}>
                <p>
                  {member.callsign} · {member.role} ·{" "}
                  {member.status.replaceAll("_", " ")} · expires{" "}
                  {member.expires_at === null
                    ? "Officer rotation required"
                    : new Date(member.expires_at * 1000).toISOString()}
                </p>
                <button
                  className="button subtle"
                  disabled={busy}
                  onClick={() => void update(member, "rotate")}
                >
                  Rotate {member.callsign} code
                </button>
                <button
                  className="button subtle"
                  disabled={busy || member.status === "revoked"}
                  onClick={() => void update(member, "revoke")}
                >
                  Revoke {member.callsign} code
                </button>
                {revealed?.member_id === member.member_id && (
                  <details>
                    <summary>
                      Reveal new role code once; share privately
                    </summary>
                    <code style={{ overflowWrap: "anywhere" }}>
                      {revealed.code}
                    </code>
                  </details>
                )}
              </div>
            ))}
          </>
        )}
      </section>
      <section className="panel command-detail" id="crew-history">
        <h2>Completed crew coordination history</h2>
        <button
          className="button subtle"
          disabled={busy}
          onClick={() => void loadHistory()}
        >
          Refresh completed crew history
        </button>
        {history && <CrewHistoryResults data={history} />}
      </section>
      <p role="status" aria-live="polite">
        {busy ? "Loading crew records…" : error}
      </p>
    </>
  );
}
