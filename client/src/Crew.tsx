import { officerReviewHref } from "./routes";
import React, { useEffect, useState } from "react";
import OfficerGate from "./OfficerGate";
import { RECONSTRUCTION_TIMEOUT_MS, api } from "./storage";
import { newId } from "./unit-state";
import type { Scenario, Kind, Identity, Effector, ScoreCard } from "./types";
import type { SensorObservation } from "./sensors-v2";
// Role clients receive reported contacts only; they never instantiate a simulator.
export type CoordinationMetrics = {
  accepted_actions: number;
  attributed_actions: number;
  unattributed_actions: number;
  contacts_with_actions: number;
  members: {
    member_id: string;
    callsign: string;
    role: string;
    accepted_actions: number;
    designations: number;
    classifications: number;
    responses: number;
  }[];
  median_designation_to_classification_s: number | null;
  median_classification_to_response_s: number | null;
  timing_basis: string;
  interpretation: string;
};
export type CrewState = {
  id: string;
  name: string;
  session_id: string;
  role: "spotter" | "responder";
  member_id: string;
  tick: number;
  duration: number;
  paused: boolean;
  done: boolean;
  status: string;
  contacts: {
    id: string;
    position: { x: number; z: number; altitude: number };
    observation: SensorObservation;
    designated: number | null;
    classification: Kind | null;
    declared: Identity | null;
  }[];
  roster: { id: string; callsign: string; role: string }[];
  attribution: {
    timeline_order: number;
    member_id: string;
    role: string;
    callsign: string;
  }[];
  scorecard: ScoreCard | null;
  coordination_metrics?: CoordinationMetrics | null;
  clock_note: string;
  note: string;
};
type PendingAction = {
  request_id: string;
  k: "designate" | "classify" | "engage";
  track: string;
  kind?: Kind;
  identity?: Identity;
  effector?: Effector;
};
class CrewHTTPError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
type Issued = {
  id: string;
  session_id: string;
  members: { callsign: string; role: string; code: string }[];
};
const nonce = newId;
async function requestCrew<T>(
  id: string,
  code: string,
  body?: unknown,
): Promise<T> {
  const r = await fetch(
    `/api/v1/crews/${encodeURIComponent(id)}/${body ? "actions" : "state"}`,
    {
      method: body ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        "X-VYUHA-Crew-Token": code,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    },
  );
  const json = await r.json();
  if (!r.ok)
    throw new CrewHTTPError(
      typeof json.detail === "string" ? json.detail : "Crew request rejected",
      r.status,
    );
  return json;
}
export function CrewPicture({ state }: { state: CrewState }) {
  return (
    <>
      <h2>
        {state.name} · {state.role}
      </h2>
      <p>
        T+{(state.tick / 30).toFixed(2)}s / {state.duration}s · {state.status} ·{" "}
        {state.status === "completed"
          ? "Completed"
          : state.done
            ? "Awaiting officer scoring"
            : state.paused
              ? "Paused"
              : "Running"}
      </p>
      <p>
        {state.status === "completed" || state.paused
          ? state.clock_note
          : "Server advances logical time while connected clients poll; long stalls discard excess wall time."}
      </p>
      <svg
        viewBox="-3000 -3000 6000 6000"
        role="img"
        aria-label="Shared observed crew picture"
        style={{ width: "100%", maxWidth: 420, background: "#07121c" }}
      >
        <circle r="45" fill="#54dbc2" />
        {state.contacts.map((t) => (
          <g key={t.id}>
            <circle
              cx={t.position.x}
              cy={-t.position.z}
              r="55"
              fill="#d4edf1"
            />
            <text
              x={t.position.x + 70}
              y={-t.position.z}
              fontSize="150"
              fill="white"
            >
              {t.id}
            </text>
          </g>
        ))}
      </svg>
      <p>{state.note}</p>
    </>
  );
}
export function CrewCoordination({
  metrics,
}: {
  metrics: CoordinationMetrics;
}) {
  return (
    <section className="advanced-card">
      <h3>Shared coordination review</h3>
      <p>
        {metrics.accepted_actions} accepted decisions ·{" "}
        {metrics.attributed_actions} attributed ·{" "}
        {metrics.contacts_with_actions} contacts. Unattributed:{" "}
        {metrics.unattributed_actions}.
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Member / role</th>
              <th>Designations</th>
              <th>Classifications</th>
              <th>Responses</th>
            </tr>
          </thead>
          <tbody>
            {metrics.members.map((m) => (
              <tr key={m.member_id}>
                <th>
                  {m.callsign} · {m.role}
                </th>
                <td>{m.designations}</td>
                <td>{m.classifications}</td>
                <td>{m.responses}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Median designation → classification:{" "}
        {metrics.median_designation_to_classification_s === null
          ? "No paired stages"
          : `${metrics.median_designation_to_classification_s.toFixed(2)}s`}
        . Classification → response:{" "}
        {metrics.median_classification_to_response_s === null
          ? "No paired stages"
          : `${metrics.median_classification_to_response_s.toFixed(2)}s`}
        .
      </p>
      <p>{metrics.timing_basis}</p>
      <p className="footnote">{metrics.interpretation}</p>
    </section>
  );
}
export default function Crew() {
  const [id, setId] = useState(""),
    [code, setCode] = useState(""),
    [joined, setJoined] = useState(false),
    [state, setState] = useState<CrewState | null>(null),
    [error, setError] = useState(""),
    [selected, setSelected] = useState(""),
    [kind, setKind] = useState<Kind>("quad"),
    [identity, setIdentity] = useState<Identity>("hostile"),
    [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [library, setLibrary] = useState<Scenario[]>([]),
    [scenario, setScenario] = useState(""),
    [issued, setIssued] = useState<Issued | null>(null),
    [name, setName] = useState("Shared crew drill");
  useEffect(() => {
    const load = () => {
      api<{ scenarios: Scenario[] }>("/crews/catalogue")
        .then((r) => {
          const eligible = r.scenarios.filter(
            (s) => s.engine_version === "vyuha-0.4.0" && !s.director_decision,
          );
          setLibrary(eligible);
          setScenario(eligible[0]?.id ?? "");
        })
        .catch(() => {});
    };
    load();
    window.addEventListener("vyuha-officer-session", load);
    return () => window.removeEventListener("vyuha-officer-session", load);
  }, []);
  useEffect(() => {
    if (!joined) return;
    let stopped = false,
      pending = false,
      completed = false;
    const pulse = async () => {
      if (pending || completed) return;
      pending = true;
      try {
        const s = await requestCrew<CrewState>(id, code);
        if (!stopped) {
          setState(s);
          completed = s.status === "completed";
          setError("");
        }
      } catch (e) {
        if (!stopped)
          setError(
            (e as Error).message + " Decisions are blocked until reconnection.",
          );
      } finally {
        pending = false;
      }
    };
    void pulse();
    const timer = setInterval(() => void pulse(), 500);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [joined, id, code]);
  async function submit(body: PendingAction) {
    setBusy(true);
    setPending(body);
    try {
      await requestCrew(id, code, body);
      setPending(null);
      setState(await requestCrew<CrewState>(id, code));
      setError("");
    } catch (e) {
      if (e instanceof CrewHTTPError && e.status < 500) setPending(null);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function act(
    k: "designate" | "classify" | "engage",
    effector?: Effector,
  ) {
    if (pending) return;
    await submit({
      request_id: nonce(),
      k,
      track: selected,
      ...(k === "classify" ? { kind, identity } : {}),
      ...(effector ? { effector } : {}),
    });
  }

  async function create() {
    setBusy(true);
    try {
      setIssued(
        await api<Issued>("/crews", {
          name,
          scenario_id: scenario,
          members: [
            { callsign: "WATCH", role: "spotter" },
            { callsign: "RESPONSE", role: "responder" },
          ],
        }),
      );
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function command(type: "resume" | "pause" | "complete") {
    if (!issued) return;
    setBusy(true);
    try {
      await api(
        `/crews/${issued.id}/${type === "complete" ? "complete" : "control"}`,
        type === "complete" ? {} : { command_id: nonce(), type, payload: {} },
        type === "complete" ? RECONSTRUCTION_TIMEOUT_MS : 6000,
      );
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const blocked =
    busy ||
    !!pending ||
    !!error ||
    !state ||
    state.paused ||
    state.status !== "active" ||
    state.done ||
    !selected;
  return (
    <main className="instructor-page">
      <h1>Shared Crew Mode</h1>
      <p>
        Spotter designates. Responder classifies and selects a simulated
        response. Both work in one authoritative server exercise; attribution
        and the shared result stay together.
      </p>
      <section className="panel">
        <h2>Join an assigned role</h2>
        <label>
          Crew ID
          <input
            value={id}
            disabled={joined}
            onChange={(e) => setId(e.target.value)}
          />
        </label>
        <label>
          Role code
          <input
            type="password"
            value={code}
            disabled={joined}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="off"
          />
        </label>
        <button
          className="button"
          disabled={!id || !code}
          onClick={() => {
            setJoined((j) => !j);
            setState(null);
            setPending(null);
            setError("");
          }}
        >
          {joined ? "Leave role" : "Connect role"}
        </button>
        <p>
          Role codes are kept in this page’s memory. Re-enter the same code
          after a reload to reconnect.
        </p>
      </section>
      {error && <p role="alert">{error}</p>}
      {pending && (
        <section className="panel">
          <h2>Unacknowledged crew decision</h2>
          <p>
            {pending.k} · {pending.track}. The same request ID is retained.
            Retry resolves an existing receipt or validates the action at the
            current shared tick.
          </p>
          <button
            className="button"
            disabled={busy || !joined}
            onClick={() => void submit(pending)}
          >
            Retry retained decision
          </button>
          <button
            className="button"
            disabled={busy}
            onClick={() => setPending(null)}
          >
            Discard local retry
          </button>
          <p className="footnote">
            Discarding a local retry does not undo a decision already accepted
            by the server. Inspect the coordination ledger.
          </p>
        </section>
      )}
      {state && (
        <section className="panel">
          <CrewPicture state={state} />
          <label>
            Observed contact
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">Select contact</option>
              {state.contacts.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.id} · {t.classification ?? "unknown"} ·{" "}
                  {Math.round(Math.hypot(t.position.x, t.position.z))}m
                </option>
              ))}
            </select>
          </label>
          {state.contacts
            .filter((t) => t.id === selected)
            .map((t) => (
              <p key={t.id}>
                Radar: {t.observation.radar.state}. EO: {t.observation.eo.level}
                . IR: {t.observation.ir.level}. RF:{" "}
                {t.observation.rf.detected ? "detected" : "not detected"}. IFF:{" "}
                {t.observation.iff.cue} · no reply does not prove hostility.
                Designation: {t.designated === null ? "pending" : "recorded"}.
              </p>
            ))}
          {state.role === "spotter" ? (
            <button
              className="button primary"
              disabled={blocked}
              onClick={() => void act("designate")}
            >
              Designate shared contact
            </button>
          ) : (
            <>
              <label>
                Contact type
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as Kind)}
                >
                  {["bird", "quad", "fixed_wing", "fiber_fpv"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                Identity
                <select
                  value={identity}
                  onChange={(e) => setIdentity(e.target.value as Identity)}
                >
                  {["hostile", "friendly", "neutral"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <button
                className="button"
                disabled={blocked}
                onClick={() => void act("classify")}
              >
                Confirm shared classification
              </button>
              {(["hold", "rf_jam", "kinetic"] as const).map((e) => (
                <button
                  className="button"
                  key={e}
                  disabled={blocked}
                  onClick={() => void act("engage", e)}
                >
                  {e}
                </button>
              ))}
            </>
          )}
          <h3>Recorded coordination</h3>
          <ol>
            {state.attribution.map((a) => (
              <li key={a.timeline_order}>
                Order {a.timeline_order} · {a.callsign} · {a.role}
              </li>
            ))}
          </ol>
          {state.coordination_metrics && (
            <CrewCoordination metrics={state.coordination_metrics} />
          )}{" "}
          {state.scorecard && (
            <>
              <h3>
                Server-verified shared result: {state.scorecard.score}/100
              </h3>
              <a href={officerReviewHref(state.session_id)}>
                Open officer AAR (sign-in required)
              </a>
            </>
          )}
        </section>
      )}
      <OfficerGate>
        <section className="panel">
          <h2>Officer crew setup</h2>
          <label>
            Exercise name
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Frozen shared raid
            <select
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
            >
              {library.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
          <p>
            Save a v0.4 raid in Exercise studio first. This setup assigns WATCH
            / spotter and RESPONSE / responder.
          </p>
          <button
            className="button primary"
            disabled={!scenario || busy}
            onClick={() => void create()}
          >
            Create shared crew
          </button>
          {issued && (
            <>
              <p>Crew ID: {issued.id}</p>
              {issued.members.map((m) => (
                <details key={m.callsign}>
                  <summary>
                    {m.callsign} · {m.role} · reveal assigned role code
                  </summary>
                  <code style={{ overflowWrap: "anywhere" }}>{m.code}</code>
                </details>
              ))}
              {(["resume", "pause", "complete"] as const).map((v) => (
                <button
                  className="button"
                  key={v}
                  disabled={busy}
                  onClick={() => void command(v)}
                >
                  {v === "complete"
                    ? "End and score crew"
                    : v === "resume"
                      ? "Start / resume crew"
                      : "Pause crew"}
                </button>
              ))}
              <p>
                Save each code before leaving. After server restart, use the
                instructor console to resume the same session.
              </p>
            </>
          )}
        </section>
      </OfficerGate>
    </main>
  );
}
