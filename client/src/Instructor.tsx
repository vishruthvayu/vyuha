import { useEffect, useState } from "react";
import { WhiteCell } from "./WhiteCell";
import { commandLabel, commandState, instructorReason } from "./presentation";
import type { InstructorCommand } from "./types";
import { newId } from "./unit-state";
import { GroupResults, type GroupResult, type RosterMember } from "./Unit";
import { api } from "./storage";
import { useInstructorFeed } from "./useInstructorFeed";
import type { InstructorIntent } from "./types";

export default function Instructor() {
  const { sessions, transport, error: feedError } = useInstructorFeed();
  const [selected, setSelected] = useState("");
  const [bearing, setBearing] = useState(40);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<{
    id: string;
    session: string;
    transport: "sending" | "failed" | "acknowledged";
    command?: InstructorCommand;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [teaching, setTeaching] = useState("");
  const [teachingRequest, setTeachingRequest] = useState<{
    sid: string;
    request_id: string;
    text: string;
  } | null>(null);
  const [teachingResult, setTeachingResult] = useState("");
  async function teach() {
    if (!session || busy) return;
    const req = teachingRequest ?? {
      sid: session.id,
      request_id: newId(),
      text: teaching.trim(),
    };
    setTeachingRequest(req);
    setBusy(true);
    try {
      const r = await api<{ command: InstructorCommand }>(
        `/instructor/sessions/${req.sid}/teaching-pauses`,
        { request_id: req.request_id, text: req.text },
      );
      setReceipt({
        id: req.request_id,
        session: req.sid,
        transport: "acknowledged",
        command: r.command,
      });
      setTeachingRequest(null);
      setTeaching("");
      setTeachingResult(
        "Teaching note saved with pause command. Application follows the trainee acknowledgment.",
      );
    } catch (e) {
      setTeachingResult((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const [retry, setRetry] = useState<{
    id: string;
    body: InstructorIntent & { command_id: string };
  } | null>(null);
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [checked, setChecked] = useState<string[]>([]);
  const [groups, setGroups] = useState<GroupResult[]>([]);
  const [launchMessage, setLaunchMessage] = useState("");
  const [launching, setLaunching] = useState(false);
  const [groupRequest, setGroupRequest] = useState<{
    request_id: string;
    trainees: string[];
    seed: number;
    night: boolean;
  } | null>(null);
  useEffect(() => {
    let stopped = false,
      pending = false;
    const refresh = async () => {
      if (pending) return;
      pending = true;
      try {
        const [r, g] = await Promise.all([
          api<{ trainees: RosterMember[] }>("/units/local/trainees"),
          api<{ groups: GroupResult[] }>("/units/local/exercises"),
        ]);
        if (!stopped) {
          setRoster(r.trainees);
          setGroups(g.groups);
        }
      } catch {
      } finally {
        pending = false;
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 1000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, []);
  async function assign() {
    setLaunching(true);
    const body = groupRequest ?? {
      request_id: newId(),
      trainees: checked,
      seed: 482913,
      night: true,
    };
    setGroupRequest(body);
    try {
      await api("/units/local/exercises", body);
      setGroupRequest(null);
      setChecked([]);
      setLaunchMessage(
        "Night Watch assigned. Each trainee receives a separate session and can start from its lobby.",
      );
    } catch (e) {
      setLaunchMessage(e instanceof Error ? e.message : "Assignment failed.");
    } finally {
      setLaunching(false);
    }
  }
  const session = sessions.find((s) => s.id === selected);
  useEffect(() => {
    if (!retry && !teachingRequest)
      setSelected(
        (id) =>
          id ||
          sessions.find((s) => s.status === "ACTIVE" || s.status === "PAUSED")
            ?.id ||
          "",
      );
  }, [sessions, retry, teachingRequest]);

  async function send(intent: InstructorIntent, existing = retry) {
    if (!session || busy) return;
    const request = existing ?? {
      id: session.id,
      body: { ...intent, command_id: newId() },
    };
    setBusy(true);
    setReceipt({
      id: request.body.command_id,
      session: request.id,
      transport: "sending",
    });
    try {
      const result = await api<{
        command: InstructorCommand;
        duplicate: boolean;
      }>(`/instructor/sessions/${request.id}/commands`, request.body);
      setReceipt({
        id: request.body.command_id,
        session: request.id,
        transport: "acknowledged",
        command: result.command,
      });
      setRetry(null);
      setError("");
    } catch (e) {
      setReceipt({
        id: request.body.command_id,
        session: request.id,
        transport: "failed",
      });
      setRetry(request);
      setError(e instanceof Error ? e.message : "Command failed.");
    } finally {
      setBusy(false);
    }
  }
  const reason = instructorReason(
    session,
    busy,
    !!retry || !!teachingRequest,
    error || feedError,
  );
  const enabled = !reason;
  const latest = receipt?.session === session?.id ? receipt : null;
  const latestCommand =
    session?.commands.find((c) => c.command_id === latest?.id) ??
    latest?.command;
  const lifecycle = commandState(
    latestCommand,
    session?.status,
    latest?.transport ?? "ready",
  );
  const button = (label: string, intent: InstructorIntent) => (
    <button
      className="button subtle"
      disabled={!enabled}
      title={reason}
      onClick={() => void send(intent)}
    >
      {label}
    </button>
  );
  return (
    <main className="instructor-page command-workspace">
      <header className="page-heading">
        <div>
          <div className="eyebrow">VYUHA · TRAINING CONTROLS</div>
          <h1>Instructor console</h1>
          <p>
            Controls act on the selected trainee's independent server session.
          </p>
        </div>
        <a className="button subtle" href="/recorded">
          Recorded exercise
        </a>
        <a className="button subtle" href="/transfer">
          Portable transfer
        </a>
        <a className="button subtle" href="/system/evidence">
          System evidence
        </a>
        <a className="button subtle" href="/exercises">
          Exercise studio
        </a>
        <a className="button subtle" href="/analytics">
          Training analytics
        </a>
        <a className="button subtle" href="/unit">
          Unit overview
        </a>
        <a
          className="button subtle"
          href="/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open trainee
        </a>
      </header>
      <p role="status">
        Live session transport: {transport}.{feedError && ` ${feedError}`}
      </p>
      <WhiteCell
        selectedSessionId={selected}
        onSelectSession={(id) => {
          if (!retry && !teachingRequest) setSelected(id);
        }}
      />
      <section className="panel group-assignment">
        <details className="evidence-disclosure">
          <summary>Assign an exercise to connected trainees</summary>
          <div className="panel-header">
            <strong>Connected trainees · Group assignment</strong>
          </div>
          <p>
            Assign Night Watch to connected, idle trainees. Each browser polls
            once per second and starts its own assigned session.
          </p>
          <div className="roster-options">
            {roster
              .filter((r) => r.connected)
              .map((r) => (
                <label key={r.trainee_id}>
                  <input
                    type="checkbox"
                    disabled={r.busy || launching || !!groupRequest}
                    title={
                      r.busy
                        ? "Trainee is already training."
                        : launching
                          ? "Assignment is being sent."
                          : groupRequest
                            ? "Resolve the pending assignment first."
                            : undefined
                    }
                    checked={checked.includes(r.trainee_id)}
                    onChange={(e) =>
                      setChecked((ids) =>
                        e.target.checked
                          ? [...ids, r.trainee_id]
                          : ids.filter((id) => id !== r.trainee_id),
                      )
                    }
                  />
                  {r.callsign} · {r.busy ? "Training" : "Ready"}
                </label>
              ))}
          </div>
          <button
            className="button primary"
            disabled={launching || (!checked.length && !groupRequest)}
            title={
              launching
                ? "Assignment is being sent."
                : !checked.length && !groupRequest
                  ? "Select an idle connected trainee."
                  : undefined
            }
            onClick={() => void assign()}
          >
            {launching
              ? "Assigning…"
              : groupRequest
                ? "Retry same assignment"
                : "Assign Night Watch"}
          </button>
          {launchMessage && <p role="status">{launchMessage}</p>}
          <p className="footnote">
            Authenticated officer controls · Use trusted LAN HTTPS. Commands and
            assignments require the server. Pending assignments retain their
            original request ID on retry.
          </p>
        </details>
      </section>
      {error && (
        <div className="recovery-banner" role="status">
          <span>{error}</span>
          {retry ? (
            <button
              className="button subtle"
              disabled={busy}
              title={busy ? "Sending the current command." : undefined}
              onClick={() => void send(retry.body, retry)}
            >
              Retry same command
            </button>
          ) : (
            <button className="button subtle" onClick={() => setError("")}>
              Reconnect controls
            </button>
          )}
        </div>
      )}
      <div className="instructor-grid">
        <section className="panel command-overview">
          <div className="panel-header">
            <strong>Sessions</strong>
            <span>{sessions.length} saved</span>
          </div>
          <div className="instructor-sessions">
            {sessions.length ? (
              sessions.map((s) => (
                <button
                  className={`instructor-session ${selected === s.id ? "selected" : ""}`}
                  key={s.id}
                  aria-pressed={selected === s.id}
                  disabled={!!retry || !!teachingRequest}
                  title={
                    retry || teachingRequest
                      ? "Resolve the pending command before selecting another session."
                      : undefined
                  }
                  onClick={() => {
                    if (!retry && !teachingRequest) setSelected(s.id);
                  }}
                >
                  <strong>
                    {s.callsign ?? s.trainee} · {s.scenario}
                  </strong>
                  <small>{s.id}</small>
                  <span className="status">{s.status}</span>
                </button>
              ))
            ) : (
              <p>No sessions available. Start a trainee drill.</p>
            )}
          </div>
        </section>
        <div>
          {session ? (
            <>
              <section className="panel instructor-summary command-detail">
                <div className="panel-header">
                  <strong>
                    {session.callsign ?? session.trainee} · {session.scenario}
                  </strong>
                  <span className="status">{session.status}</span>
                </div>
                <details className="evidence-disclosure">
                  <summary>Session identity and telemetry source</summary>
                  <p className="mono">Session {session.id}</p>
                  <p>
                    Telemetry is reported by the trainee; server-verified
                    scoring runs at completion.
                  </p>
                </details>
                {session.telemetry ? (
                  <div className="metric-grid">
                    <article className="metric">
                      <span>Elapsed simulation time</span>
                      <strong>
                        {(session.telemetry.tick / 30).toFixed(1)}s
                      </strong>
                    </article>
                    <article className="metric">
                      <span>Active contacts</span>
                      <strong>{session.telemetry.active_contacts}</strong>
                    </article>
                    <article className="metric">
                      <span>Radar</span>
                      <strong>
                        {session.telemetry.radar_status === "normal"
                          ? "NORMAL"
                          : session.telemetry.radar_status === "failed"
                            ? "OFFLINE"
                            : "DEGRADED"}
                      </strong>
                    </article>
                    <article className="metric">
                      <span>RF / conditions</span>
                      <strong>
                        {session.telemetry.rf_available ? "NORMAL" : "OFFLINE"}
                      </strong>
                      <small>{session.telemetry.night ? "Night" : "Day"}</small>
                    </article>
                  </div>
                ) : (
                  <p>No live telemetry received.</p>
                )}
                <p>
                  Last trainee update:{" "}
                  {session.last_seen
                    ? new Date(session.last_seen).toLocaleTimeString()
                    : "never"}
                  . Telemetry is reported by the trainee; verified scoring runs
                  at completion.
                </p>
              </section>
              <section className="panel instructor-controls command-detail">
                <div
                  className="command-receipt command-lifecycle"
                  role="status"
                >
                  <strong>{lifecycle.state}</strong>{" "}
                  {latestCommand && commandLabel(latestCommand)}
                  <small>{lifecycle.detail}</small>
                </div>
                {reason && <p className="control-reason">{reason}</p>}
                <h2>Exercise</h2>
                <div className="control-buttons">
                  {button("Pause exercise", { type: "pause", payload: {} })}
                  {button("Resume exercise", { type: "resume", payload: {} })}
                </div>
                <details className="evidence-disclosure">
                  <summary>Teaching pause and after-action note</summary>
                  <h2>Teaching pause</h2>
                  <label>
                    Explanation for after-action review
                    <textarea
                      aria-label="Teaching explanation"
                      maxLength={1000}
                      value={teaching}
                      disabled={busy || !!teachingRequest}
                      onChange={(e) => setTeaching(e.target.value)}
                    />
                  </label>
                  <button
                    className="button subtle"
                    disabled={
                      busy ||
                      (!teachingRequest && (!enabled || !teaching.trim()))
                    }
                    onClick={() => void teach()}
                  >
                    {teachingRequest
                      ? "Retry same teaching pause"
                      : "Pause with teaching note"}
                  </button>
                  {teachingResult && <p role="status">{teachingResult}</p>}
                  <p className="footnote">
                    Notes remain attached to this session and do not change its
                    score. Review free text before sharing an archive.
                  </p>
                </details>
                <details className="evidence-disclosure">
                  <summary>Inject threats and change sensor conditions</summary>
                  <h2>Threat injection</h2>
                  <label>
                    Injection bearing (degrees)
                    <input
                      aria-label="Injection bearing"
                      type="number"
                      min="0"
                      max="359"
                      value={bearing}
                      onChange={(e) =>
                        setBearing(
                          Math.max(
                            0,
                            Math.min(359, Math.trunc(Number(e.target.value))),
                          ),
                        )
                      }
                    />
                  </label>
                  <div className="control-buttons">
                    {button("Inject hostile quad", {
                      type: "inject_contact",
                      payload: { kind: "quad", bearing },
                    })}
                    {button("Inject no-RF FPV", {
                      type: "inject_contact",
                      payload: { kind: "fiber_fpv", bearing },
                    })}
                    {button("Inject 6-drone swarm", {
                      type: "inject_swarm",
                      payload: { count: 6, bearing },
                    })}
                  </div>
                  <h2>Sensors</h2>
                  <div className="control-buttons">
                    {button("Jam radar", {
                      type: "sensor_fault",
                      payload: { sensor: "radar", mode: "jammed" },
                    })}
                    {button("Fail radar", {
                      type: "sensor_fault",
                      payload: { sensor: "radar", mode: "failed" },
                    })}
                    {button("Restore radar", {
                      type: "sensor_restore",
                      payload: { sensor: "radar" },
                    })}
                    {button("Fail RF", {
                      type: "sensor_fault",
                      payload: { sensor: "rf", mode: "failed" },
                    })}
                    {button("Restore RF", {
                      type: "sensor_restore",
                      payload: { sensor: "rf" },
                    })}
                  </div>
                  <h2>Environment</h2>
                  <div className="control-buttons">
                    {button("Set day", {
                      type: "environment",
                      payload: { night: false },
                    })}
                    {button("Set night", {
                      type: "environment",
                      payload: { night: true },
                    })}
                  </div>
                  <p>
                    Illustrative training models. Recoverable sessions are
                    disconnected or have not sent an update for six seconds.
                  </p>
                </details>
              </section>
              <section className="panel command-audit">
                <details className="evidence-disclosure">
                  <summary>
                    Command history · {session.commands.length} issued
                  </summary>
                  <div className="panel-header">
                    <strong>Command history</strong>
                  </div>
                  {session.commands.length ? (
                    session.commands.map((c) => (
                      <p key={c.seq}>
                        <b>
                          #{c.seq} · {commandLabel(c)}
                        </b>{" "}
                        · {session.callsign ?? session.trainee}
                        <small>Session {session.id}</small>
                        <br />
                        <span className="dim">
                          Issued {new Date(c.issued_at).toLocaleTimeString()} ·{" "}
                          {commandState(c, session.status).state} ·{" "}
                          {commandState(c, session.status).detail}
                        </span>
                      </p>
                    ))
                  ) : (
                    <p>No instructor commands.</p>
                  )}
                </details>
              </section>
            </>
          ) : (
            <section className="panel instructor-controls">
              <h2>Select an active session</h2>
              <p>
                Start an exercise in the trainee browser, then select it here.
              </p>
            </section>
          )}
        </div>
      </div>
      <GroupResults groups={groups} />
    </main>
  );
}
