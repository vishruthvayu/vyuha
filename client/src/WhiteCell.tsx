import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { api } from "./storage";
import { officerReviewHref } from "./routes";

type Position = { x: number; z: number; altitude?: number };
type ReferenceTrack = {
  id: string;
  kind: string;
  identity: string;
  rf_link: boolean;
  position: Position;
  active: boolean;
  resolved: boolean;
  asset_impact: boolean;
  trainee_classification: string | null;
  trainee_identity: string | null;
};
type Channel = {
  sensor: string;
  position: Position;
  sample_tick: number | null;
  state: string;
};
type ObservedTrack = {
  id: string;
  position: Position;
  channels: Channel[];
  evidence: { [key: string]: unknown };
  trainee_classification: string | null;
  trainee_identity: string | null;
  designated: boolean;
  responded: boolean;
};
export type WhiteCellPicture = {
  schema_version: 1;
  session_id: string;
  trainee: string;
  callsign: string;
  unit_id: string;
  exercise_group_id: string | null;
  status: string;
  last_seen: string | null;
  scenario: {
    id: string;
    title: string;
    duration_seconds: number;
    engine_version: string;
    world_scale_m: number | null;
  };
  telemetry: {
    assurance: string;
    state: { tick: number; active_contacts: number; paused: boolean } | null;
  };
  reconstruction: {
    horizon_tick: number;
    hz: number;
    horizon_source: string;
    assurance: string;
    input_fingerprint: string;
    cached: boolean;
    newer_accepted_events: number;
    newer_applied_commands: number;
  };
  reference: { label: string; tracks: ReferenceTrack[] };
  observed: { label: string; tracks: ObservedTrack[] };
  progress: {
    spawned: number;
    active: number;
    first_detected: number;
    designated: number;
    classified: number;
    responded: number;
    resolved: number;
    impacts: number;
  };
  alerts: {
    code: string;
    track_id: string;
    message: string;
    scope: string;
    estimate_seconds?: number;
  }[];
  sensor_state: {
    radar: string;
    rf_available: boolean;
    night: boolean;
    paused_by_applied_command: boolean;
  };
};
type FailedPicture = {
  schema_version: 1;
  session_id: string;
  status: "RECONSTRUCTION_UNAVAILABLE";
  error: string;
};
type PictureEntry = WhiteCellPicture | FailedPicture;
export type WhiteCellMode = "observed" | "reference";
const grid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,230px),1fr))",
  gap: 16,
};
function valid(picture: PictureEntry): picture is WhiteCellPicture {
  return "reference" in picture;
}
export function situationPoints(
  picture: WhiteCellPicture,
  mode: WhiteCellMode,
) {
  return mode === "reference"
    ? picture.reference.tracks
        .filter((t) => t.active)
        .map((t) => ({
          id: t.id,
          position: t.position,
          label: `${t.id} · ${t.kind} · ${t.identity}`,
          identity: t.identity,
        }))
    : picture.observed.tracks.map((t) => ({
        id: t.id,
        position: t.position,
        label: `${t.id} · ${t.channels.map((c) => c.sensor.toUpperCase()).join(" / ")}${t.trainee_classification ? ` · trainee: ${t.trainee_classification}` : ""}`,
        identity: t.trainee_identity ?? "unknown",
      }));
}
export function SituationMap({
  picture,
  mode,
}: {
  picture: WhiteCellPicture;
  mode: WhiteCellMode;
}) {
  const points = situationPoints(picture, mode);
  const scale =
    picture.scenario.world_scale_m ??
    (picture.scenario.engine_version === "vyuha-0.4.0" ? 4000 : 200);
  const radius = Math.max(1, scale),
    factor = 125 / radius;
  return (
    <svg
      viewBox="0 0 320 320"
      role="img"
      aria-label={
        mode === "reference"
          ? "Instructor reference map, reconstructed truth"
          : "Reconstructed observed map, sensor-reported positions"
      }
      style={{
        display: "block",
        width: "100%",
        maxWidth: 370,
        background: "#0b1b26",
        borderRadius: 10,
      }}
    >
      {[42, 83, 125].map((r) => (
        <circle key={r} cx="160" cy="160" r={r} stroke="#315065" fill="none" />
      ))}
      <path d="M35 160H285M160 35V285" stroke="#315065" />
      <text x="160" y="18" textAnchor="middle" fill="#a6bdca" fontSize="13">
        N · {radius} m scope
      </text>
      <rect x="156" y="156" width="8" height="8" fill="#dcf1fa">
        <title>Protected asset</title>
      </rect>
      {points.map((point) => {
        const x = 160 + point.position.x * factor,
          y = 160 - point.position.z * factor;
        const outside = Math.hypot(point.position.x, point.position.z) > radius;
        return outside ? null : (
          <g key={point.id}>
            <circle
              cx={x}
              cy={y}
              r="5"
              fill={
                mode === "reference"
                  ? point.identity === "hostile"
                    ? "#ff9274"
                    : point.identity === "friendly"
                      ? "#80c8ff"
                      : "#c1d1db"
                  : "#74dadd"
              }
            >
              <title>{point.label}</title>
            </circle>
            <text x={x + 7} y={y - 7} fontSize="12" fill="#e4f0f5">
              {point.id}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
export function WhiteCellDetails({
  picture,
  mode,
}: {
  picture: WhiteCellPicture;
  mode: WhiteCellMode;
}) {
  const tracks = situationPoints(picture, mode);
  return (
    <div className="command-detail">
      <h3>
        {picture.callsign} · {picture.scenario.title}
      </h3>
      <p className="footnote">
        {mode === "reference"
          ? picture.reference.label
          : picture.observed.label}
        . T+
        {(
          picture.reconstruction.horizon_tick / picture.reconstruction.hz
        ).toFixed(2)}{" "}
        s · {picture.scenario.engine_version}
      </p>
      <div style={grid}>
        <SituationMap picture={picture} mode={mode} />
        <div>
          <h4>Accepted decision progress</h4>
          <dl>
            {(
              [
                "first_detected",
                "designated",
                "classified",
                "responded",
                "resolved",
                "impacts",
              ] as const
            ).map((key) => (
              <div
                key={key}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  padding: "6px 0",
                }}
              >
                <dt>{key.replaceAll("_", " ")}</dt>
                <dd>
                  {picture.progress[key]} / {picture.progress.spawned}
                </dd>
              </div>
            ))}
          </dl>
          <p>
            RADAR: {picture.sensor_state.radar.toUpperCase()} · RF:{" "}
            {picture.sensor_state.rf_available ? "AVAILABLE" : "UNAVAILABLE"} ·{" "}
            {picture.sensor_state.night ? "NIGHT" : "DAY"}
          </p>
        </div>
      </div>
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label="White Cell contact evidence"
      >
        <table>
          <caption>
            {mode === "reference"
              ? "Instructor reference contacts"
              : "Current observed contacts; labels are trainee declarations"}
          </caption>
          <thead>
            <tr>
              <th>Contact</th>
              <th>
                {mode === "reference"
                  ? "Reference identity and type"
                  : "Observed channels / trainee classification"}
              </th>
              <th>Reported position</th>
            </tr>
          </thead>
          <tbody>
            {tracks.map((track) => (
              <tr key={track.id}>
                <td>{track.id}</td>
                <td>{track.label}</td>
                <td>
                  {Math.round(track.position.x)} m X /{" "}
                  {Math.round(track.position.z)} m Z
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!tracks.length && <p>No contacts available in this picture.</p>}
      <details className="evidence-disclosure" open={mode === "reference"}>
        <summary>Instructor reference alerts · {picture.alerts.length}</summary>
        <h4>Instructor reference alerts</h4>
        {picture.alerts.length ? (
          <ul>
            {picture.alerts.map((alert, index) => (
              <li key={`${alert.track_id}-${alert.code}-${index}`}>
                {alert.track_id}: {alert.message}
              </li>
            ))}
          </ul>
        ) : (
          <p>No current reference alerts.</p>
        )}
      </details>
      <p className="footnote">
        {picture.reconstruction.assurance}. Horizon is{" "}
        {picture.reconstruction.horizon_source.replaceAll("_", " ")}; this is
        not independently verified elapsed wall time. Reference alerts may
        concern facts the trainee cannot see.
      </p>
      {(picture.reconstruction.newer_accepted_events > 0 ||
        picture.reconstruction.newer_applied_commands > 0) && (
        <p role="status">
          Awaiting a newer reported horizon:{" "}
          {picture.reconstruction.newer_accepted_events} accepted actions and{" "}
          {picture.reconstruction.newer_applied_commands} applied commands occur
          after this picture.
        </p>
      )}
      <a href={officerReviewHref(picture.session_id)}>
        Open this session review
      </a>
    </div>
  );
}
export function WhiteCell({
  selectedSessionId,
  onSelectSession,
}: {
  selectedSessionId?: string;
  onSelectSession?: (id: string) => void;
}) {
  const [entries, setEntries] = useState<PictureEntry[]>([]),
    [localId, setLocalId] = useState(""),
    [mode, setMode] = useState<WhiteCellMode>("observed"),
    [error, setError] = useState(""),
    [loaded, setLoaded] = useState(false),
    [refresh, setRefresh] = useState(0);
  const selected = selectedSessionId ?? localId;
  useEffect(() => {
    let stopped = false,
      pending = false;
    const update = async () => {
      if (pending) return;
      pending = true;
      try {
        const result = await api<{
          schema_version: 1;
          pictures: PictureEntry[];
        }>("/white-cell", undefined, 10000);
        if (!stopped) {
          setEntries(result.pictures);
          setLoaded(true);
          setError("");
          setLocalId((id) =>
            result.pictures.some((p) => p.session_id === id)
              ? id
              : (result.pictures[0]?.session_id ?? ""),
          );
        }
      } catch (reason) {
        if (!stopped)
          setError(
            reason instanceof Error
              ? reason.message
              : "White Cell unavailable; reconnect to the officer server.",
          );
      } finally {
        pending = false;
      }
    };
    void update();
    const timer = setInterval(() => void update(), 1500);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [refresh]);
  // A controlled selection is the command target. Never substitute another
  // trainee's picture when that target is absent from the active feed.
  const entry =
    entries.find((p) => p.session_id === selected) ??
    (selectedSessionId === undefined ? entries[0] : undefined);
  function select(id: string) {
    setLocalId(id);
    onSelectSession?.(id);
  }
  return (
    <section
      id="white-cell"
      className="panel command-workspace"
      aria-label="White Cell live exercise picture"
    >
      <div className="panel-header">
        <strong>White Cell · Instructor situation picture</strong>
        <button
          className="button subtle"
          onClick={() => setRefresh((n) => n + 1)}
        >
          Refresh picture
        </button>
      </div>
      <p>
        Server reconstruction of accepted trainee actions and applied instructor
        commands. Choose a trainee; use the instructor controls below for
        interventions.
      </p>
      <div className="segmented" aria-label="White Cell evidence mode">
        <button
          aria-pressed={mode === "observed"}
          onClick={() => setMode("observed")}
        >
          Observed evidence
        </button>
        <button
          aria-pressed={mode === "reference"}
          onClick={() => setMode("reference")}
        >
          Instructor reference truth
        </button>
      </div>
      {error && <p role="alert">{error} Previous pictures may be stale.</p>}
      {!loaded && !error && (
        <p role="status">Reconstructing active exercises…</p>
      )}
      {loaded && !entries.length && (
        <p>
          No active exercises. Completed sessions remain available in
          after-action review.
        </p>
      )}
      {loaded && !!selectedSessionId && !entry && (
        <p role="status">
          No current picture for the selected session. Select another active
          session or open its recorded review; instructor commands keep their
          selected target.
        </p>
      )}
      <div style={grid} className="command-overview">
        {entries.map((picture) => (
          <button
            className="button subtle"
            key={picture.session_id}
            aria-pressed={entry?.session_id === picture.session_id}
            onClick={() => select(picture.session_id)}
            style={{ display: "block", textAlign: "left", padding: 14 }}
          >
            {valid(picture) ? (
              <>
                <strong>
                  {picture.callsign} · {picture.status}
                </strong>{" "}
                <span>
                  {picture.scenario.title} ·{" "}
                  {mode === "observed"
                    ? picture.observed.tracks.length
                    : picture.reference.tracks.filter((track) => track.active)
                        .length}{" "}
                  contacts in this picture
                </span>
              </>
            ) : (
              <>
                <strong>Reconstruction unavailable</strong>
                <p>{picture.error}</p>
              </>
            )}
          </button>
        ))}
      </div>
      {entry && valid(entry) && (
        <WhiteCellDetails picture={entry} mode={mode} />
      )}
      <p className="footnote">
        Officer access required. Current sensor observations exclude the
        camera’s short presentation hold. Client-reported telemetry is advisory.
        White Cell does not change completed histories, scores or skill
        profiles.
      </p>
    </section>
  );
}

export default WhiteCell;
