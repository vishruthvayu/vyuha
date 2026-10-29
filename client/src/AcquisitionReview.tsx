import { isAcquisitionEngine } from "./engine-contracts";
import type { Record as TrainingRecord, TimelineItem } from "./types";
const time = (n: number) => `T+${(n / 30).toFixed(2)}s`;
export function acquisitionDecisionEvidence(record: TrainingRecord) {
  if (
    !isAcquisitionEngine(record.scenario.engine_version) ||
    !record.verified ||
    !record.acquisition
  )
    return [];
  return record.events
    .filter((a) => a.k === "classify" || a.k === "engage")
    .map((a) => ({
      action: a,
      results: record.acquisition!.results.filter(
        (r) =>
          r.trackId === a.track &&
          (r.releaseTick < a.tick ||
            (r.releaseTick === a.tick && r.releasedOrder < (a.order ?? -1))) &&
          a.tick < r.expiryTick,
      ),
    }));
}
/** Only server reconstructed evidence, not a new rubric or inferred intention. */
export default function AcquisitionReview({
  record,
  onJump,
}: {
  record: TrainingRecord;
  onJump?: (event: TimelineItem) => void;
}) {
  const a = record.acquisition;
  if (
    !isAcquisitionEngine(record.scenario.engine_version) ||
    !record.verified ||
    !a
  )
    return null;
  const decisions = acquisitionDecisionEvidence(record);
  const missing = decisions.filter(
    (d) =>
      !d.results.some((r) => r.reading.available && r.reading.level !== "none"),
  );
  const unavailable = a.results.filter((r) => !r.reading.available).length;
  const label = !a.requests.length
    ? "Practice requesting a cross-check before deciding"
    : missing.length
      ? "Practice the evidence-to-decision timing boundary"
      : unavailable
        ? "Practice switching channels when evidence is unavailable"
        : "Try changed evidence conditions";
  return (
    <section
      className="panel acquisition-review"
      aria-label="Verified acquisition reconstruction"
    >
      <header>
        <span className="eyebrow">VERIFIED / ACTIVE OBSERVATION</span>
        <h2>What information reached the decision?</h2>
      </header>
      <p>
        {a.requests.length} accepted requests · {a.results.length} published
        results. Requests are intentions; availability and shape resolution
        determine what information was returned.
      </p>
      <p>
        {missing.length} of {decisions.length} recorded classification/response
        decisions had no current released optical detection. This describes
        missing optical evidence, not intent, wrongness by itself or a mastery
        score. RF/IFF and other evidence must still be considered.
      </p>
      <ol className="acquisition-review-queries">
        {a.requests.slice(-12).map((q) => {
          const r = a.results.find((r) => r.id === q.id);
          return (
            <li key={q.id}>
              <strong>
                {q.trackId} / {q.channel.toUpperCase()}
              </strong>
              <span>
                Requested {time(q.acceptedTick)} · planned sample{" "}
                {time(q.sampleTick)} · publication {time(q.releaseTick)}
              </span>
              <p>
                {r
                  ? `${!r.reading.available ? "Channel unavailable" : r.reading.level === "none" ? "No detection" : r.reading.level === "detect" ? "Detection only" : `Shape ${r.reading.level} level`} · expiry ${time(r.expiryTick)}. Affiliation is a separate inference.`
                  : a.events.some(
                        (e) => e.requestId === q.id && e.kind === "cancelled",
                      )
                    ? "Cancelled at the recorded end; no future observation is claimed."
                    : "No published result in this recording."}
              </p>
              <nav aria-label={`Reconstruct ${q.trackId} ${q.channel}`}>
                {(record.timeline ?? [])
                  .filter(
                    (e) =>
                      e.id === `acq_${q.acceptedOrder}` ||
                      e.id === `acq_sample_${q.id}` ||
                      (r && e.id === `acq_${r.releasedOrder}`),
                  )
                  .map((e) => (
                    <button
                      className="button subtle"
                      key={e.id}
                      onClick={() => onJump?.(e)}
                      disabled={!onJump}
                    >
                      {e.code === "ACQUISITION_SAMPLE"
                        ? "Sample"
                        : e.code === "ACQUISITION_RELEASED"
                          ? "Release"
                          : "Request"}{" "}
                      · {time(e.tick)}
                    </button>
                  ))}
              </nav>
            </li>
          );
        })}
      </ol>
      {a.requests.length > 12 && (
        <p>
          Latest 12 requests shown. The complete ordered history is available in
          the exercise timeline.
        </p>
      )}
      <aside>
        <strong>Suggested next practice</strong>
        <p>
          {label}. This is a transparent evidence-timing heuristic, not a
          calibrated adaptive policy or proof of learning.
        </p>
        <a
          className="button primary"
          href={`/?acquisition=1&seed=${(record.scenario.seed + 1) >>> 0}&night=${record.scenario.night ? "0" : "1"}`}
        >
          Prepare a changed observation exercise
        </a>
        <a className="button subtle" href="/academy">
          Return to Academy
        </a>
      </aside>
    </section>
  );
}
