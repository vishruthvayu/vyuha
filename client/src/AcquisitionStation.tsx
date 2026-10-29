import { useRef, useState } from "react";
import {
  Camera,
  Clock3,
  Crosshair,
  Radio,
  ScanLine,
  Thermometer,
} from "lucide-react";
import type { Action, Snapshot } from "./types";
const seconds = (tick: number) => (tick / 30).toFixed(2);
const rejectionText = (reason?: string) =>
  reason === "state_changed"
    ? "The report or task changed before acceptance. Check the current radar report and try again."
    : reason === "paused"
      ? "Resume the exercise before requesting an observation."
      : reason === "ended"
        ? "The exercise has ended. Start a new exercise to request an observation."
        : (reason ??
          "Check the current radar report and task availability, then try again.");
const iffText = (cue?: string) =>
  cue === "friendly_reply"
    ? "Friendly reply"
    : cue === "registered_civil"
      ? "Civil beacon"
      : cue === "no_reply"
        ? "No reply · unresolved"
        : "Unavailable";
/** A spatial instrument over the live world, projected only from authoritative
 * worker evidence. Display inspection never requests a sample or grants credit. */
export default function AcquisitionStation({
  state,
  selected,
  running,
  enabled,
  visible,
  request,
  receipt,
  brief,
  onInspectChannel,
}: {
  state: Snapshot;
  selected: string | null;
  running: boolean;
  enabled: boolean;
  visible: boolean;
  request: (channel: "eo" | "ir") => string | null;
  receipt?: {
    status: string;
    action: Omit<Action, "tick">;
    reason?: string;
  } | null;
  brief?: { title: string; objectives: string[] };
  onInspectChannel?: (channel: "eo" | "ir") => void;
}) {
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [inspection, setInspection] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const gate = useRef<string | null>(null);
  const a = state.acquisition;
  if (!a) return null;
  const acknowledged =
    !!submitted &&
    (a.requests.some((q) => q.id === submitted) ||
      (receipt?.action.request_id === submitted &&
        receipt.status !== "submitted"));
  if (acknowledged) gate.current = null;
  const pending = a.pending;
  const selectedTrack = state.tracks.find((t) => t.id === selected);
  const o = selectedTrack?.observation;
  const known =
    !!selectedTrack?.active &&
    !!o?.radar.detected &&
    o.radar.sample_tick !== null;
  const busy = !!pending || (!!submitted && !acknowledged);
  const selectedResults = a.results
    .filter((r) => r.trackId === selected)
    .slice(-4)
    .reverse();
  const inspected =
    selectedResults.find((r) => r.resultId === inspection) ??
    selectedResults[0];
  const sample = inspected
    ? a.samples.find((s) => s.resultId === inspected.resultId)?.observation
    : undefined;
  const expired = !!inspected && state.tick >= inspected.expiryTick;
  const resolution = !inspected
    ? "No optical result"
    : !inspected.reading.available
      ? "Channel unavailable"
      : inspected.reading.level === "none"
        ? "No modeled detection"
        : inspected.reading.level === "detect"
          ? "Detection only"
          : `Shape ${inspected.reading.level === "identify" ? "identification" : "recognition"} level`;
  const phase = pending
    ? state.tick < pending.sampleTick
      ? "Dwell"
      : "Publication delay"
    : busy
      ? "Submitting"
      : inspected
        ? expired
          ? "Expired evidence"
          : "Published evidence"
        : "Awaiting an observation";
  const fire = (channel: "eo" | "ir") => {
    if (!running || !enabled || !known || busy || gate.current) return;
    gate.current = "dispatching";
    setExpanded(true);
    const id = request(channel);
    gate.current = id;
    setSubmitted(id);
  };
  return (
    <aside
      className="acquisition-console observation-flight-deck"
      aria-label="Active observation instrument"
      tabIndex={0}
      hidden={!visible}
      data-task-phase={pending ? "acquiring" : busy ? "submitting" : "ready"}
      data-deck-expanded={expanded}
    >
      <header className="flight-directive">
        <div className="flight-directive-mark" aria-hidden="true">
          <Crosshair size={20} />
        </div>
        <div>
          <span className="eyebrow">OBSERVATION FLIGHT DECK</span>
          <h2>{brief?.title ?? "Investigate the unknown."}</h2>
          <details className="flight-mission-objectives">
            <summary>Mission objective</summary>
            {brief?.objectives.length ? (
              <ul>
                {brief.objectives.map((objective, i) => (
                  <li key={i}>{objective}</li>
                ))}
              </ul>
            ) : (
              <p>
                Use all available sensor evidence. Request a cross-check when it
                can resolve uncertainty; silence alone does not establish
                identity.
              </p>
            )}
          </details>
        </div>
      </header>

      <section
        className="flight-channel-rack"
        aria-label="Request synthetic optical observation"
      >
        <div className="flight-channel-heading">
          <span>OPTICAL TASKING</span>
          <small>One task slot · logical time</small>
        </div>
        <div className="acquisition-channel-actions">
          <button
            type="button"
            disabled={!enabled || !running || !known || busy}
            onClick={() => fire("eo")}
          >
            <Camera size={19} aria-hidden="true" />
            <span>
              <strong>Request EO</strong>
              <small>Day optical cross-check</small>
            </span>
          </button>
          <button
            type="button"
            disabled={!enabled || !running || !known || busy}
            onClick={() => fire("ir")}
          >
            <Thermometer size={19} aria-hidden="true" />
            <span>
              <strong>Request IR</strong>
              <small>Thermal cross-check</small>
            </span>
          </button>
        </div>
        <p className="flight-task-gate">
          {!running
            ? "Exercise paused · logical acquisition time is stopped."
            : !known
              ? "Select a current radar report to task optics."
              : busy
                ? "A request is in progress; selection cannot redirect it."
                : "Choose the channel for the information you need."}
        </p>
      </section>

      <section
        className="flight-evidence-deck"
        aria-label="Observation evidence deck"
        tabIndex={0}
        data-expanded={expanded}
      >
        <div className="flight-evidence-heading">
          <div>
            <span className="eyebrow">INFORMATION AT THIS MOMENT</span>
            <strong>
              {pending
                ? `ACQUIRING ${pending.channel.toUpperCase()} / ${pending.trackId}`
                : "Evidence before inference."}
            </strong>
            <small className="flight-compact-status">
              {pending
                ? `${Math.max(0, (pending.releaseTick - state.tick) / 30).toFixed(1)}s until publication`
                : phase}
            </small>
          </div>
          <span className="flight-logical-clock">
            <Clock3 size={14} aria-hidden="true" /> T+{seconds(state.tick)}s
          </span>
          <button
            type="button"
            className="flight-deck-toggle"
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Focus world" : "Open evidence"}
          </button>
        </div>
        <div className="flight-deck-instruments">
          <section
            className="acquisition-subject"
            aria-label="Selected observation subject"
          >
            <span>OBSERVED SUBJECT</span>
            <strong>{selected ?? "No report selected"}</strong>
            <small>
              {known
                ? "Current radar alias"
                : "Choose a reported contact in Radar or Reports."}
            </small>
            <dl className="flight-correlated-evidence">
              <div>
                <dt>
                  <ScanLine size={12} aria-hidden="true" /> Radar
                </dt>
                <dd>
                  {o?.radar.sample_tick !== null &&
                  o?.radar.sample_tick !== undefined
                    ? `${o.radar.state} · ${seconds(Math.max(0, state.tick - o.radar.sample_tick))}s old`
                    : "No time-valid report"}
                </dd>
              </div>
              <div>
                <dt>
                  <Radio size={12} aria-hidden="true" /> RF / IFF
                </dt>
                <dd>
                  {o?.rf.available
                    ? o.rf.detected
                      ? "Signal reported"
                      : "No signal reported"
                    : "RF unavailable"}
                  <span>
                    {o?.iff.available ? iffText(o.iff.cue) : "IFF unavailable"}
                  </span>
                </dd>
              </div>
            </dl>
          </section>

          <section
            className="flight-task-instrument"
            aria-label="Authoritative acquisition phase"
          >
            <div className="flight-instrument-label">
              <span>TASK SEQUENCE</span>
              <b>{phase}</b>
            </div>
            {pending ? (
              <div className="acquisition-pending" role="status">
                <strong>
                  ACQUIRING {pending.channel.toUpperCase()} / {pending.trackId}
                </strong>
                <span className="flight-countdown">
                  {Math.max(0, (pending.releaseTick - state.tick) / 30).toFixed(
                    1,
                  )}
                  <small>s until publication</small>
                </span>
                <progress
                  max={Math.max(1, pending.releaseTick - pending.acceptedTick)}
                  value={Math.max(0, state.tick - pending.acceptedTick)}
                  aria-label="Logical acquisition progress"
                />
                <ol
                  className="flight-phase-sequence"
                  aria-label="Request sample publication sequence"
                >
                  <li data-reached="true">
                    <b>Request</b>
                    <span>{seconds(pending.acceptedTick)}s</span>
                  </li>
                  <li data-reached={state.tick >= pending.sampleTick}>
                    <b>Sample</b>
                    <span>{seconds(pending.sampleTick)}s</span>
                  </li>
                  <li data-reached="false">
                    <b>Publish</b>
                    <span>{seconds(pending.releaseTick)}s</span>
                  </li>
                </ol>
                <small>
                  Planned sample and publication. The reading remains hidden
                  until release. Selecting another contact does not redirect
                  this request.
                </small>
              </div>
            ) : busy ? (
              <p role="status">
                Submitting this request to the exercise engine…
              </p>
            ) : (
              <div className="flight-sequence-idle">
                <ol
                  className="flight-phase-sequence"
                  aria-label="Observation workflow"
                >
                  <li>
                    <b>Request</b>
                    <span>Explicit intent</span>
                  </li>
                  <li>
                    <b>Sample</b>
                    <span>Frozen cadence</span>
                  </li>
                  <li>
                    <b>Inspect</b>
                    <span>Released evidence</span>
                  </li>
                </ol>
                <p>
                  Availability is not detection. A shape is not an affiliation.
                </p>
              </div>
            )}
            {receipt?.action.k === "inspect" &&
              receipt.status === "rejected" &&
              receipt.action.request_id === submitted && (
                <p role="alert" className="flight-rejection">
                  Request rejected. {rejectionText(receipt.reason)}
                </p>
              )}
          </section>

          <section
            className="acquisition-results"
            aria-label="Released observations for selected contact"
          >
            <div className="flight-instrument-label">
              <h3>Released evidence</h3>
              <small>
                {selectedResults.length
                  ? `${selectedResults.length} retained`
                  : "No publication"}
              </small>
            </div>
            {selectedResults.length > 1 && (
              <nav
                className="flight-result-selector"
                aria-label="Inspect released samples"
              >
                {selectedResults.map((r) => (
                  <button
                    type="button"
                    key={r.resultId}
                    aria-pressed={r.resultId === inspected?.resultId}
                    onClick={() => setInspection(r.resultId)}
                  >
                    {r.channel.toUpperCase()} · {seconds(r.sampleTick)}s
                  </button>
                ))}
              </nav>
            )}
            {inspected ? (
              <article key={inspected.resultId} data-expired={expired}>
                <header>
                  <b>
                    {inspected.channel.toUpperCase()} / {inspected.trackId}
                  </b>
                  <span>{expired ? "EXPIRED" : "RELEASED"}</span>
                </header>
                <strong>{resolution}</strong>
                <p>
                  {sample?.silhouette
                    ? `Reported silhouette: ${sample.silhouette}. Affiliation remains a separate question.`
                    : "This result does not establish type or affiliation."}
                </p>
                <div className="flight-evidence-age">
                  <span>
                    {expired ? "Expired" : "Published"}{" "}
                    {seconds(Math.max(0, state.tick - inspected.releaseTick))}s
                    ago
                  </span>
                  <b>
                    {expired
                      ? "Historical sample"
                      : `${seconds(Math.max(0, inspected.expiryTick - state.tick))}s until expiry`}
                  </b>
                </div>
                <div className="flight-inspection-action">
                  <button
                    type="button"
                    disabled={
                      !onInspectChannel ||
                      expired ||
                      !inspected.reading.available ||
                      inspected.reading.level === "none"
                    }
                    onClick={() => onInspectChannel?.(inspected.channel)}
                  >
                    Inspect {inspected.channel.toUpperCase()} in world
                  </button>
                  {expired && (
                    <small>
                      Expired evidence cannot restore live optical geometry.
                    </small>
                  )}
                </div>
                <details className="flight-provenance">
                  <summary>Observation timestamps</summary>
                  <small>
                    Requested {seconds(inspected.acceptedTick)}s · sampled{" "}
                    {seconds(inspected.sampleTick)}s · released{" "}
                    {seconds(inspected.releaseTick)}s · expires{" "}
                    {seconds(inspected.expiryTick)}s
                  </small>
                </details>
              </article>
            ) : (
              <p className="flight-no-evidence">
                No released cross-check for this contact. Missing evidence is
                not a hostile identity.
              </p>
            )}
          </section>
        </div>
        <footer>
          Server reconstruction preserves this sequence. Pointing/crop do not
          change sampling. Request counts do not earn mastery.
        </footer>
      </section>
    </aside>
  );
}
