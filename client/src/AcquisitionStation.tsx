import { useRef, useState } from "react";
import type { Action, Snapshot } from "./types";
const seconds = (tick: number) => (tick / 30).toFixed(2);
/** A view of authoritative worker evidence. No sensor sampling, world truth or
 * fabricated success is computed here; requests use the shared action protocol. */
export default function AcquisitionStation({
  state,
  selected,
  running,
  enabled,
  visible,
  request,
  receipt,
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
}) {
  const [submitted, setSubmitted] = useState<string | null>(null);
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
  const fire = (channel: "eo" | "ir") => {
    if (!running || !enabled || !known || busy || gate.current) return;
    gate.current = "dispatching";
    const id = request(channel);
    gate.current = id;
    setSubmitted(id);
  };
  return (
    <aside
      className="acquisition-console"
      aria-label="Active observation instrument"
      tabIndex={0}
      hidden={!visible}
    >
      <header>
        <span className="eyebrow">SYNTHETIC OPTICS / ENGINE 0.5</span>
        <h2>Resolve the uncertainty.</h2>
        <p>
          Request a cross-check. Inspect what it actually establishes before
          deciding.
        </p>
      </header>
      <div className="acquisition-subject">
        <span>OBSERVED SUBJECT</span>
        <strong>{selected ?? "Select a radar report"}</strong>
        <small>
          {known
            ? "Radar alias available · optical evidence requires a request"
            : "Use Reports or Radar to select a currently observed contact."}
        </small>
      </div>
      <div
        className="acquisition-channel-actions"
        aria-label="Request synthetic optical observation"
      >
        <button
          type="button"
          disabled={!enabled || !running || !known || busy}
          onClick={() => fire("eo")}
        >
          <strong>Request EO</strong>
          <span>Day optical cross-check</span>
        </button>
        <button
          type="button"
          disabled={!enabled || !running || !known || busy}
          onClick={() => fire("ir")}
        >
          <strong>Request IR</strong>
          <span>Thermal cross-check</span>
        </button>
      </div>
      {!running && (
        <p className="acquisition-state">
          Exercise paused · logical acquisition time is stopped.
        </p>
      )}
      {pending ? (
        <section className="acquisition-pending" role="status">
          <span>
            ACQUIRING {pending.channel.toUpperCase()} / {pending.trackId}
          </span>
          <strong>
            {Math.max(0, (pending.releaseTick - state.tick) / 30).toFixed(1)}s
            until publication
          </strong>
          <progress
            max={Math.max(1, pending.releaseTick - pending.acceptedTick)}
            value={Math.max(0, state.tick - pending.acceptedTick)}
            aria-label="Logical acquisition progress"
          />
          <small>
            Sample T+{seconds(pending.sampleTick)}s · publication T+
            {seconds(pending.releaseTick)}s. Selecting another contact does not
            redirect this request.
          </small>
        </section>
      ) : busy ? (
        <p role="status">Submitting this request to the exercise engine…</p>
      ) : (
        <p className="acquisition-state">
          One simulated optical task slot · positive dwell · results may be
          insufficient or unavailable.
        </p>
      )}
      {receipt?.action.k === "inspect" &&
        receipt.status === "rejected" &&
        receipt.action.request_id === submitted && (
          <p role="alert">
            Request rejected.{" "}
            {receipt.reason ??
              "Check the current radar report and task availability, then try again."}
          </p>
        )}
      <section
        className="acquisition-results"
        aria-label="Released observations for selected contact"
      >
        <h3>Released evidence</h3>
        {selectedResults.length ? (
          selectedResults.map((r) => {
            const sample = a.samples.find(
              (s) => s.resultId === r.resultId,
            )?.observation;
            const expired = state.tick >= r.expiryTick;
            const text = !r.reading.available
              ? "Channel unavailable"
              : r.reading.level === "none"
                ? "No modeled detection"
                : r.reading.level === "detect"
                  ? "Detection only"
                  : `Shape ${r.reading.level === "identify" ? "identification" : "recognition"} level`;
            return (
              <article key={r.resultId} data-expired={expired}>
                <header>
                  <b>
                    {r.channel.toUpperCase()} / {r.trackId}
                  </b>
                  <span>{expired ? "EXPIRED" : "RELEASED"}</span>
                </header>
                <strong>{text}</strong>
                <p>
                  {sample?.silhouette
                    ? `Reported silhouette: ${sample.silhouette}. Affiliation remains a separate question.`
                    : "This result does not establish type or affiliation."}
                </p>
                <small>
                  Requested {seconds(r.acceptedTick)}s · sampled{" "}
                  {seconds(r.sampleTick)}s · released {seconds(r.releaseTick)}s
                  · expires {seconds(r.expiryTick)}s
                </small>
              </article>
            );
          })
        ) : (
          <p>
            No released cross-check for this contact. Missing evidence is not a
            hostile identity.
          </p>
        )}
      </section>
      <footer>
        Evidence is reconstructed by the server. Pointing/crop do not change
        sampling. Request counts do not earn mastery.
      </footer>
    </aside>
  );
}
