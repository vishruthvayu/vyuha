import CrewOfficerTools from "./CrewOfficerTools";
import { officerReviewHref } from "./routes";
import React, { useEffect, useRef, useState } from "react";
import OfficerGate from "./OfficerGate";
import { RECONSTRUCTION_TIMEOUT_MS, api } from "./storage";
import { newId } from "./unit-state";
import type { Scenario, Kind, Identity, Effector, ScoreCard } from "./types";
import type { SensorObservation } from "./sensors-v2";
import { crewTask } from "./command-crew-context";
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
  revision?: number;
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
  members: {
    member_id: string;
    callsign: string;
    role: string;
    code: string;
    expires_at: number;
  }[];
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
      signal: AbortSignal.timeout(6000),
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
const ROLE_DUTY = {
  spotter: "Watch the shared picture and designate contacts for the responder.",
  responder:
    "Classify designated contacts and choose a simulated response from the evidence.",
} as const;
/** Smallest ring scale that keeps every reported contact on the scope. */
function scopeRange(contacts: CrewState["contacts"]) {
  const far = Math.max(
    0,
    ...contacts.map((t) => Math.hypot(t.position.x, t.position.z)),
  );
  return (
    [1000, 1500, 2000, 3000, 4000, 6000, 8000, 12000].find(
      (r) => r >= far * 1.15,
    ) ?? Math.ceil((far * 1.15) / 1000) * 1000
  );
}
function contactStage(t: CrewState["contacts"][number]) {
  if (t.classification) return "classified";
  if (t.designated !== null && t.designated !== undefined) return "designated";
  return "observed";
}
export function CrewPicture({
  state,
  selected = "",
}: {
  state: CrewState;
  selected?: string;
}) {
  const member = state.roster?.find((entry) => entry.id === state.member_id);
  const phase =
    state.status === "completed"
      ? "completed"
      : state.done
        ? "scoring"
        : state.paused
          ? "paused"
          : "running";
  const range = scopeRange(state.contacts);
  const elapsed = Math.min(1, state.tick / 30 / Math.max(1, state.duration));
  return (
    <>
      <header className="crew-role-banner" data-role={state.role}>
        <div className="crew-role-identity">
          <div className="eyebrow">
            SHARED EXERCISE · {state.role.toUpperCase()}
          </div>
          <h2>
            {member?.callsign ?? "Assigned role"} · {state.name}
          </h2>
          <p className="crew-role-duty">{ROLE_DUTY[state.role]}</p>
        </div>
        <div className="crew-clock" data-phase={phase}>
          <span className="status">
            {state.status === "completed"
              ? "Completed"
              : state.done
                ? "Awaiting scoring"
                : state.paused
                  ? "Paused"
                  : "Running"}
          </span>
          <p className="command-lifecycle">
            T+{(state.tick / 30).toFixed(2)}s / {state.duration}s ·{" "}
            {state.status} ·{" "}
            {state.status === "completed"
              ? "Completed"
              : state.done
                ? "Awaiting officer scoring"
                : state.paused
                  ? "Paused"
                  : "Running"}
          </p>
          <div className="crew-clock-track" aria-hidden="true">
            <span style={{ inlineSize: `${(elapsed * 100).toFixed(1)}%` }} />
          </div>
        </div>
      </header>
      <div className="crew-scope-column">
        <figure className="crew-scope">
          <svg
            viewBox={`${-range} ${-range} ${range * 2} ${range * 2}`}
            role="img"
            aria-label={`Shared observed crew picture · ${state.contacts.length} reported contacts · outer ring ${range} m`}
          >
            <circle className="crew-scope-face" r={range} />
            {[0.25, 0.5, 0.75, 1].map((f) => (
              <circle key={f} className="crew-scope-ring" r={range * f} />
            ))}
            <path
              className="crew-scope-axis"
              d={`M${-range} 0H${range}M0 ${-range}V${range}`}
            />
            {[0.5, 1].map((f) => (
              <text
                key={f}
                className="crew-scope-scale"
                x={range * 0.02}
                y={-range * f + range * 0.06}
                fontSize={range * 0.04}
              >
                {Math.round(range * f)} m
              </text>
            ))}
            <circle className="crew-scope-own" r={range * 0.018} />
            {state.contacts.map((t) => (
              <g
                key={t.id}
                className="crew-scope-contact"
                data-stage={contactStage(t)}
                data-selected={t.id === selected ? "true" : undefined}
              >
                {t.id === selected && (
                  <circle
                    className="crew-scope-selection"
                    cx={t.position.x}
                    cy={-t.position.z}
                    r={range * 0.045}
                  />
                )}
                <circle
                  cx={t.position.x}
                  cy={-t.position.z}
                  r={range * 0.016}
                />
                <text
                  x={t.position.x + range * 0.03}
                  y={-t.position.z - range * 0.02}
                  fontSize={range * 0.042}
                >
                  {t.id}
                </text>
              </g>
            ))}
          </svg>
          <figcaption>
            <span data-stage="observed">Observed</span>
            <span data-stage="designated">Designated</span>
            <span data-stage="classified">Classified</span>
            <span>Rings every {Math.round(range / 4)} m</span>
          </figcaption>
        </figure>
        <details className="evidence-disclosure crew-scope-note">
          <summary>Shared clock and evidence scope</summary>
          <p>
            {state.status === "completed" || state.paused
              ? state.clock_note
              : "Server advances logical time while connected clients poll; long stalls discard excess wall time."}
          </p>
          <p>{state.note}</p>
        </details>
      </div>
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
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label="Shared coordination by member and role"
      >
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
// Catalogue is mounted only after OfficerGate confirms the server session.
function CrewCatalogue({
  setLibrary,
  setScenario,
}: {
  setLibrary: React.Dispatch<React.SetStateAction<Scenario[]>>;
  setScenario: React.Dispatch<React.SetStateAction<string>>;
}) {
  useEffect(() => {
    let stopped = false;
    void api<{ scenarios: Scenario[] }>("/crews/catalogue")
      .then((r) => {
        if (stopped) return;
        const eligible = r.scenarios.filter(
          (s) => s.engine_version === "vyuha-0.4.0" && !s.director_decision,
        );
        setLibrary(eligible);
        setScenario(eligible[0]?.id ?? "");
      })
      .catch(() => {});
    return () => {
      stopped = true;
    };
  }, [setLibrary, setScenario]);
  return null;
}
/** A late polling response must not undo an accepted action or completed result. */
export function latestCrewState(previous: CrewState | null, next: CrewState) {
  if (
    previous?.id === next.id &&
    (previous.tick > next.tick ||
      (previous.revision !== undefined &&
        next.revision !== undefined &&
        previous.revision > next.revision) ||
      previous.attribution.length > next.attribution.length ||
      (previous.status === "completed" && next.status !== "completed"))
  )
    return previous;
  return next;
}

export default function Crew() {
  const roleEpoch = useRef(0);
  useEffect(
    () => () => {
      roleEpoch.current += 1;
    },
    [],
  );
  const [id, setId] = useState(""),
    [code, setCode] = useState(""),
    [joined, setJoined] = useState(false),
    [state, setState] = useState<CrewState | null>(null),
    [error, setError] = useState(""),
    [actionFeedback, setActionFeedback] = useState(""),
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
          setState((previous) => latestCrewState(previous, s));
          completed = s.status === "completed";
          setError("");
        }
      } catch (e) {
        if (!stopped && e instanceof CrewHTTPError && e.status === 401) {
          roleEpoch.current += 1;
          setJoined(false);
          setState(null);
          setBusy(false);
          setPending(null);
        }
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
    const epoch = roleEpoch.current;
    const currentRole = () => roleEpoch.current === epoch;
    setBusy(true);
    setActionFeedback("");
    setPending(body);
    try {
      await requestCrew(id, code, body);
      if (!currentRole()) return;
      setPending(null);
      const fresh = await requestCrew<CrewState>(id, code);
      if (!currentRole()) return;
      setState((previous) => latestCrewState(previous, fresh));
      setError("");
    } catch (e) {
      if (!currentRole()) return;
      if (e instanceof CrewHTTPError && e.status < 500) {
        setPending(null);
        // Rejection is definitive: don't replay it invisibly at a later tick.
        setActionFeedback((e as Error).message);
        try {
          const fresh = await requestCrew<CrewState>(id, code);
          if (!currentRole()) return;
          setState((previous) => latestCrewState(previous, fresh));
          setError("");
        } catch (refreshError) {
          if (currentRole()) setError((refreshError as Error).message);
        }
      } else setError((e as Error).message);
    } finally {
      if (currentRole()) setBusy(false);
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
  const selectedContact = state?.contacts.find((t) => t.id === selected);
  const blocked =
    busy ||
    !!pending ||
    !!error ||
    !state ||
    state.paused ||
    state.status !== "active" ||
    state.done ||
    !selectedContact;
  return (
    <main
      className="instructor-page command-workspace crew-workspace"
      data-joined={joined ? "true" : undefined}
      data-role={state?.role}
    >
      <header className="crew-page-header">
        <div className="eyebrow">TWO-ROLE TRAINING</div>
        <h1>Shared Crew Mode</h1>
        <p>
          Spotter designates. Responder classifies and selects a simulated
          response. Both work in one authoritative server exercise; attribution
          and the shared result stay together.
        </p>
      </header>
      <section
        className="crew-join"
        aria-labelledby="crew-join-title"
        data-joined={joined ? "true" : undefined}
      >
        <div className="crew-section-heading">
          <div>
            <div className="eyebrow">TRAINEE ACCESS</div>
            <h2 id="crew-join-title">
              {joined ? "Connected role" : "Join an assigned role"}
            </h2>
          </div>
          <span className="footnote">
            One shared exercise · two distinct responsibilities
          </span>
        </div>
        <form
          className="crew-join-fields"
          aria-label="Connect assigned crew role"
          onSubmit={(event) => {
            event.preventDefault();
            if (!id || !code) return;
            roleEpoch.current += 1;
            setBusy(false);
            setJoined((j) => !j);
            setState(null);
            if (joined) setPending(null);
            setError("");
            setActionFeedback("");
            setSelected("");
          }}
        >
          <label>
            Crew ID
            <input
              value={id}
              required
              disabled={joined || !!pending}
              onChange={(e) => setId(e.target.value)}
            />
          </label>
          <label>
            Role code
            <input
              type="password"
              value={code}
              required
              disabled={joined}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="off"
            />
          </label>
          <button
            className={`button ${joined ? "subtle" : "primary"}`}
            disabled={!id || !code}
          >
            {joined ? "Leave role" : "Connect role"}
          </button>
        </form>
        <details className="crew-reconnection-help">
          <summary>Reconnecting or replacing a role code</summary>
          <p>
            Codes stay in this page’s memory. After reload, re-enter your code
            while it remains valid. If expired or revoked, ask the officer to
            rotate it. Accepted decisions remain recorded.
          </p>
        </details>
      </section>
      {error && <p role="alert">{error}</p>}
      {actionFeedback && <p role="alert">{actionFeedback}</p>}
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
        <section
          className="panel command-detail crew-station"
          data-role={state.role}
          aria-label={`${state.role === "spotter" ? "Spotter" : "Responder"} station`}
        >
          <CrewPicture state={state} selected={selected} />
          <div className="crew-console">
            <p className="crew-handoff" role="status">
              {crewTask(state, selected)}
            </p>
            <label className="crew-contact-picker">
              Observed contact
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                <option value="">Select contact</option>
                {selected && !selectedContact && (
                  <option value={selected} disabled>
                    {selected} · No current observation — wait for reacquisition
                  </option>
                )}
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
                <div
                  key={t.id}
                  className="crew-evidence"
                  role="group"
                  aria-label={`Current observation of ${t.id}`}
                >
                  <dl>
                    <div>
                      <dt>Radar</dt>
                      <dd>{t.observation.radar.state}</dd>
                    </div>
                    <div>
                      <dt>EO</dt>
                      <dd>{t.observation.eo.level}</dd>
                    </div>
                    <div>
                      <dt>IR</dt>
                      <dd>{t.observation.ir.level}</dd>
                    </div>
                    <div>
                      <dt>RF</dt>
                      <dd>
                        {t.observation.rf.detected
                          ? "detected"
                          : "not detected"}
                      </dd>
                    </div>
                    <div>
                      <dt>IFF</dt>
                      <dd>{t.observation.iff.cue}</dd>
                    </div>
                    <div data-recorded={t.designated !== null || undefined}>
                      <dt>Designation</dt>
                      <dd>{t.designated === null ? "pending" : "recorded"}</dd>
                    </div>
                  </dl>
                  <p className="footnote">
                    No IFF reply does not prove hostility.
                  </p>
                </div>
              ))}
            {state.role === "spotter" ? (
              <div className="crew-actions">
                <button
                  className="button primary"
                  disabled={blocked || selectedContact?.designated !== null}
                  onClick={() => void act("designate")}
                >
                  Designate shared contact
                </button>
              </div>
            ) : (
              <>
                <fieldset className="crew-actions crew-classify">
                  <legend>Shared classification</legend>
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
                    disabled={blocked || selectedContact?.designated === null}
                    title={
                      selectedContact?.designated === null
                        ? "Wait for the spotter to designate this contact."
                        : undefined
                    }
                    onClick={() => void act("classify")}
                  >
                    Confirm shared classification
                  </button>
                </fieldset>
                <fieldset className="crew-actions crew-respond">
                  <legend>Simulated response</legend>
                  {(["hold", "rf_jam", "kinetic"] as const).map((e) => (
                    <button
                      className="button"
                      key={e}
                      data-effector={e}
                      disabled={
                        blocked ||
                        selectedContact?.designated === null ||
                        !selectedContact?.classification
                      }
                      title={
                        !selectedContact?.classification
                          ? "Confirm shared classification before choosing a response."
                          : undefined
                      }
                      onClick={() => void act("engage", e)}
                    >
                      {
                        {
                          hold: "Hold fire",
                          rf_jam: "RF jammer",
                          kinetic: "Kinetic response",
                        }[e]
                      }
                    </button>
                  ))}
                </fieldset>
              </>
            )}
          </div>
          <section className="crew-ledger" aria-labelledby="crew-ledger-title">
            <h3 id="crew-ledger-title">
              Recorded coordination{" "}
              <span>· {state.attribution.length} accepted decisions</span>
            </h3>
            {state.attribution.length === 0 ? (
              <p className="crew-ledger-empty">
                No accepted decisions yet. Submitted requests appear here only
                after server acceptance.
              </p>
            ) : (
              <div
                className="crew-ledger-scroll"
                tabIndex={0}
                role="region"
                aria-label="Accepted crew decisions, oldest first"
              >
                <ol>
                  {state.attribution.map((a) => (
                    <li
                      key={a.timeline_order}
                      data-role={a.role}
                      data-own={a.member_id === state.member_id || undefined}
                    >
                      <span className="crew-ledger-order">
                        Order {a.timeline_order}
                      </span>
                      <span className="crew-ledger-who">
                        {a.callsign} · {a.role}
                        {a.member_id === state.member_id && (
                          <span className="crew-ledger-you"> · you</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </section>
          {state.coordination_metrics && (
            <CrewCoordination metrics={state.coordination_metrics} />
          )}
          {state.scorecard && (
            <div className="crew-result">
              <h3>
                Server-verified shared result: {state.scorecard.score}/100
              </h3>
              <a href={officerReviewHref(state.session_id)}>
                Open officer AAR (sign-in required)
              </a>
            </div>
          )}
        </section>
      )}
      <details className="crew-officer-workspace">
        <summary>
          Officer workspace · setup, role access and shared history
        </summary>
        <OfficerGate embedded>
          <>
            <CrewCatalogue setLibrary={setLibrary} setScenario={setScenario} />
            <section
              className="crew-officer-setup"
              aria-labelledby="crew-setup-title"
            >
              <div className="eyebrow">NEW SHARED EXERCISE</div>
              <h2 id="crew-setup-title">Officer crew setup</h2>
              <div className="crew-setup-fields">
                <label>
                  Exercise name
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
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
              </div>
              <p className="footnote">
                Save a v0.4 raid in Exercise studio first. This setup assigns
                WATCH / spotter and RESPONSE / responder.
              </p>
              <button
                className="button primary"
                disabled={!scenario || busy}
                onClick={() => void create()}
              >
                Create shared crew
              </button>
              {issued && (
                <div className="crew-issued">
                  <p className="crew-issued-id">Crew ID: {issued.id}</p>
                  <div className="crew-issued-codes">
                    {issued.members.map((m) => (
                      <details key={m.callsign} data-role={m.role}>
                        <summary>
                          {m.callsign} · {m.role} · reveal assigned role code
                        </summary>
                        <p>
                          Expires {new Date(m.expires_at * 1000).toISOString()}
                        </p>
                        <code style={{ overflowWrap: "anywhere" }}>
                          {m.code}
                        </code>
                      </details>
                    ))}
                  </div>
                  <div
                    className="crew-transport"
                    role="group"
                    aria-label="Shared exercise clock"
                  >
                    {(["resume", "pause", "complete"] as const).map((v) => (
                      <button
                        className="button"
                        key={v}
                        data-command={v}
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
                  </div>
                  <p className="footnote">
                    Save each code before leaving. After server restart, use the
                    instructor console to resume the same session.
                  </p>
                </div>
              )}
            </section>
            <CrewOfficerTools createdId={issued?.id ?? ""} />
          </>
        </OfficerGate>
      </details>
    </main>
  );
}
