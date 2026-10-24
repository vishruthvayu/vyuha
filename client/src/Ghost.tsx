import { LearningEvidence } from "./LearningEvidence";
import { useEffect, useRef, useState } from "react";
import { Flag, ChevronRight, Activity } from "lucide-react";
import type {
  Action,
  DecisionReview,
  GhostSkill,
  Record as TrainingRecord,
  TimelineItem,
  Snapshot,
} from "./types";
import { KIND_LABEL } from "./types";
export { timelineSeek } from "./review-frame";

export const skillLabel: { [K in GhostSkill]: string } = {
  detection: "Detection",
  classification_iff: "Classification / IFF",
  effector_choice: "Effector choice",
  degraded_sensor_response: "Degraded sensor response",
};
export const tickLabel = (tick: number) => `T+${(tick / 30).toFixed(2)}s`;
export function actionLabel(
  action: Action | DecisionReview["expected_action"] | null,
) {
  if (!action) return "No action recorded";
  const type = "k" in action ? action.k : action.type;
  if (type === "engage")
    return action.effector === "rf_jam"
      ? "RF jammer"
      : action.effector === "kinetic"
        ? "Kinetic"
        : "Hold";
  if (type === "classify")
    return `${action.kind ? KIND_LABEL[action.kind] : "Unknown type"} / ${action.identity ?? "unknown"}`;
  return type === "designate" ? "Designate" : "Observe";
}
function selectedReview(record: TrainingRecord, id: string | null) {
  return (
    record.decision_reviews?.find(
      (r) =>
        r.decision_id ===
        (id ??
          record.ghost_summary?.largest_loss ??
          record.ghost_summary?.strongest_decision),
    ) ?? record.decision_reviews?.[0]
  );
}

export function EvidenceView({ review: r }: { review: DecisionReview }) {
  const e = r.evidence;
  return (
    <section className="ghost-section" data-evidence-scope="available">
      <h3>Available to trainee</h3>
      <dl className="ghost-evidence">
        <div>
          <dt>Radar</dt>
          <dd>
            {e.radar.state === "failed"
              ? "OFFLINE"
              : e.radar.state === "jammed"
                ? "DEGRADED"
                : "ACTIVE"}{" "}
            · {e.radar.detected ? "contact observed" : "no current detection"}
          </dd>
        </div>
        <div>
          <dt>RF control link</dt>
          <dd>
            {!e.rf.available
              ? "Unavailable"
              : e.rf.signal === null
                ? "No target RF observation"
                : e.rf.signal
                  ? "Detected"
                  : "No control link detected"}
          </dd>
        </div>
        <div>
          <dt>IFF</dt>
          <dd>
            {e.rf.iff === "unavailable"
              ? "Unavailable"
              : e.rf.iff === "friendly_reply"
                ? "Friendly reply"
                : e.rf.iff === "registered_civil"
                  ? "Registered civil beacon"
                  : "No reply · identity unconfirmed"}
          </dd>
        </div>
        <div>
          <dt>EO / IR observation</dt>
          <dd>
            {e.visual.available
              ? e.visual.silhouette
                ? `${e.visual.silhouette.replace("_", " ")} silhouette`
                : "Detection only · no identifying silhouette"
              : "No current modeled observation"}
          </dd>
        </div>
        <div>
          <dt>Range</dt>
          <dd>
            {e.range_m === null ? "Unavailable" : `${e.range_m.toFixed(1)} m`}
          </dd>
        </div>
        <div>
          <dt>Restricted sector</dt>
          <dd>
            {e.restricted === null
              ? "Unavailable"
              : e.restricted
                ? "Kinetic restricted"
                : "Outside restricted sector"}
          </dd>
        </div>
        <div>
          <dt>First detectable</dt>
          <dd>
            {e.first_detectable_tick === null
              ? "Not observed"
              : tickLabel(e.first_detectable_tick)}
          </dd>
        </div>
      </dl>
      <p className="footnote">
        Evidence at {tickLabel(e.tick)}:{" "}
        {r.trainee_action
          ? "immediately before the selected action"
          : "first detectable observation, or reviewed end if never detectable"}
        . IFF no reply does not establish hostility. Quad and FPV share a
        multirotor silhouette.
      </p>
    </section>
  );
}

export function GhostPanel({
  record,
  viewerTrainee,
  selectedId,
  onChoose,
  onJump,
  onReload,
}: {
  record: TrainingRecord;
  viewerTrainee?: string;
  onReload?: () => void;
  selectedId: string | null;
  onChoose: (r: DecisionReview) => void;
  onJump?: () => void;
}) {
  const r = selectedReview(record, selectedId);
  const reviewIndex =
    record.decision_reviews?.findIndex(
      (review) => review.decision_id === r?.decision_id,
    ) ?? -1;
  return (
    <section className="panel ghost-panel ghost-v2">
      <div className="panel-header">
        <div>
          <Flag size={16} aria-hidden="true" />
          <h2 className="panel-title">Ghost Expert</h2>
        </div>
        <span className="status">
          {record.verified ? "RULE-GROUNDED" : "VERIFICATION PENDING"}
        </span>
      </div>
      {record.verified && record.learning && (
        <LearningEvidence
          review={record.learning}
          learner={
            viewerTrainee === record.trainee
              ? { sessionId: record.id, trainee: record.trainee }
              : undefined
          }
        />
      )}
      {!record.verified ? (
        <div className="ghost-content">
          <h3>Verification pending</h3>
          <p>
            Authoritative decision review becomes available after the original
            local server verifies this exercise. No expert expectations are
            generated from device-only display state.
          </p>
        </div>
      ) : !record.decision_reviews ? (
        <div className="ghost-content">
          <h3>Review unavailable on this device</h3>
          <p>
            Connect to the original server to load and cache the reconstructed
            review. Cached verified reviews remain readable offline.
          </p>
          {onReload && (
            <button className="button subtle" onClick={onReload}>
              Retry review
            </button>
          )}
        </div>
      ) : !r ? (
        <div className="ghost-content">
          <h3>No recorded decisions</h3>
          <p>{record.ghost_summary?.text}</p>
          <p>{record.replay_metadata?.note}</p>
        </div>
      ) : (
        <div className="ghost-content">
          <label className="ghost-selector">
            Decision review
            <select
              aria-label="Decision review"
              value={r.decision_id}
              onChange={(e) => {
                const review = record.decision_reviews?.find(
                  (d) => d.decision_id === e.target.value,
                );
                if (review) onChoose(review);
              }}
            >
              {record.decision_reviews.map((d) => (
                <option key={d.decision_id} value={d.decision_id}>
                  {d.track_id} · {tickLabel(d.tick)} ·{" "}
                  {d.decision_kind.replace("_", " / ")} ·{" "}
                  {d.reason_code.replaceAll("_", " ").toLowerCase()}
                </option>
              ))}
            </select>
          </label>
          <div className="ghost-decision-heading">
            <strong>
              {r.track_id} · {tickLabel(r.tick)}
            </strong>
            <span className={`status verdict-${r.verdict}`}>
              {r.verdict === "unassessable"
                ? "INSUFFICIENT EVIDENCE"
                : r.verdict.toUpperCase()}
            </span>
          </div>
          <div className="review-controls">
            <button
              className="button subtle"
              disabled={reviewIndex <= 0}
              onClick={() => {
                const previous = record.decision_reviews?.[reviewIndex - 1];
                if (previous) onChoose(previous);
              }}
            >
              Previous decision
            </button>
            <button
              className="button subtle"
              disabled={
                reviewIndex < 0 ||
                reviewIndex >= (record.decision_reviews?.length ?? 0) - 1
              }
              onClick={() => {
                const next = record.decision_reviews?.[reviewIndex + 1];
                if (next) onChoose(next);
              }}
            >
              Next decision
            </button>
            <button
              className="text-button"
              onClick={() => {
                onChoose(r);
                onJump?.();
              }}
            >
              Jump to selected decision <ChevronRight size={13} />
            </button>
          </div>
          <p className="review-evidence-boundary">
            Decision evidence stays pinned while you move the replay cursor.
          </p>
          <div className="ghost-investigation" key={r.decision_id}>
            <EvidenceView review={r} />
            <section className="ghost-section ghost-comparison">
              <div>
                <h3>Your decision</h3>
                <strong>{actionLabel(r.trainee_action)}</strong>
              </div>
              <div>
                <h3>Expected decision</h3>
                <strong>
                  {r.decision_kind === "prioritisation"
                    ? `Prioritise ${r.expected_action.track_id} · permitted response: ${actionLabel(r.expected_action)}`
                    : actionLabel(r.expected_action)}
                </strong>
                <small>
                  {r.expected_action.basis === "ground_truth_reference"
                    ? "Ground-truth rubric reference; identity must first be established"
                    : "Based on available evidence"}
                </small>
              </div>
            </section>
            <section className="ghost-section">
              <h3>Why</h3>
              <p>{r.explanation}</p>
              <small className="mono">{r.reason_code}</small>
              {r.context_commands.length > 0 && (
                <p className="ghost-context">
                  Instructor context:{" "}
                  {r.context_commands
                    .map((seq) => {
                      const c = record.commands?.find((x) => x.seq === seq);
                      return c
                        ? `#${seq} ${c.type.replaceAll("_", " ")} at ${tickLabel(c.tick)}`
                        : `#${seq}`;
                    })
                    .join(" · ")}
                </p>
              )}
            </section>
            <details
              className="ghost-section ground-truth"
              data-evidence-scope="ground-truth"
            >
              <summary>Ground truth after review</summary>
              <dl className="ghost-evidence">
                <div>
                  <dt>Type</dt>
                  <dd>{KIND_LABEL[r.ground_truth.kind]}</dd>
                </div>
                <div>
                  <dt>Identity</dt>
                  <dd>{r.ground_truth.identity}</dd>
                </div>
                <div>
                  <dt>Physical RF link</dt>
                  <dd>{r.ground_truth.rf_link ? "Present" : "None"}</dd>
                </div>
                <div>
                  <dt>Spawn</dt>
                  <dd>{tickLabel(r.ground_truth.spawn_tick)}</dd>
                </div>
              </dl>
              <p className="footnote">
                These are reconstructed simulation facts, not a claim about what
                the trainee knew.
              </p>
            </details>
            <section className="ghost-section">
              <h3>Consequence</h3>
              <p>{r.consequence.text}</p>
              <small className="mono">{r.consequence.reason_code}</small>
            </section>
            <section className="ghost-section">
              <h3>Score impact</h3>
              <strong>
                {r.score_effect.node === "detect"
                  ? "Detection"
                  : r.score_effect.node === "classify"
                    ? "Classification"
                    : r.score_effect.node === "prioritise"
                      ? "Prioritisation"
                      : "Engagement"}
                : {r.score_effect.points_awarded} /{" "}
                {r.score_effect.points_possible}
              </strong>
              <p className="footnote">
                Final contact node, shared across all attempts. This is not a
                separate per-action award.
              </p>
              {r.score_effect.session_penalty > 0 && (
                <p>
                  Contact asset penalty: −{r.score_effect.session_penalty}{" "}
                  {r.score_effect.penalty_basis === "scoring_projection"
                    ? "(frozen-duration scoring projection, not an observed impact)"
                    : "(observed impact)"}
                </p>
              )}
              {r.score_effect.session_failure && (
                <p className="amber-text">
                  The recorded non-hostile response triggered the session safety
                  rule.
                </p>
              )}
            </section>
            <section className="ghost-section">
              <h3>Training skill</h3>
              <p>
                {r.decision_kind === "prioritisation"
                  ? "Ranking is recorded in the 15-point node; it adds no observations to the four-skill profile."
                  : r.skill_tags.length
                    ? r.skill_tags.map((s) => skillLabel[s]).join(" · ")
                    : "No mistake tag for this decision."}
              </p>
              {r.skill_tags.includes("degraded_sensor_response") && (
                <p className="footnote">
                  Sensor degradation is context; this tag does not prove it
                  caused the mistake.
                </p>
              )}
            </section>
          </div>
        </div>
      )}
    </section>
  );
}

export function GhostTimeline({
  record,
  onJump,
}: {
  record: TrainingRecord;
  onJump: (e: TimelineItem) => void;
}) {
  const g = record.ghost_summary;
  if (!record.timeline || !g) return null;
  return (
    <>
      <section className="panel ghost-summary">
        <div className="panel-header">
          <strong>Training focus</strong>
          <span className="status">SERVER REVIEW</span>
        </div>
        <p>{g.text}</p>
        <div className="ghost-skill-grid">
          {Object.entries(g.mistake_counts).map(([s, n]) => (
            <div key={s}>
              <span>{skillLabel[s as GhostSkill]}</span>
              <strong>{n}</strong>
              <small>
                contacts with errors · {g.lost_points[s as GhostSkill]} node
                points lost
              </small>
            </div>
          ))}
        </div>
        <div className="control-buttons">
          {[g.largest_loss, g.strongest_decision].map((id, i) => {
            const r = record.decision_reviews?.find(
              (d) => d.decision_id === id,
            );
            return r ? (
              <button
                key={i}
                className="button subtle"
                onClick={() =>
                  onJump({
                    id: r.decision_id,
                    tick: r.tick,
                    order: r.order,
                    track_id: r.track_id,
                    decision_id: r.decision_id,
                    category: "trainee_action",
                    code: r.reason_code,
                    title: r.reason_code,
                    seek_before: !!r.trainee_action,
                  })
                }
              >
                {i === 0 ? "Review largest loss" : "Review strongest decision"}
              </button>
            ) : null;
          })}
        </div>
        <p className="footnote">
          Lost points are deduplicated per contact/node before hostile-row
          averaging. Sensor-context tags overlap other skills. This focus is a
          review recommendation. The next adaptive drill uses the persistent
          four-skill profile.
        </p>
      </section>
      <section className="panel rubric-summary">
        <div className="panel-header">
          <strong>Hostile-node averages before penalties</strong>
        </div>
        <div className="ghost-skill-grid">
          {Object.entries(record.node_averages ?? {}).map(([k, n]) => (
            <div key={k}>
              <span>
                {k === "detect"
                  ? "Detection"
                  : k === "classify"
                    ? "Classification"
                    : k === "prioritise"
                      ? record.scorecard.prioritisation
                        ? "Priority ranking"
                        : "Timely resolution"
                      : "Engagement"}
              </span>
              <strong>
                {n} / {k === "prioritise" ? 15 : k === "engage" ? 35 : 25}
              </strong>
            </div>
          ))}
        </div>
        <p>
          Asset impacts: {record.scorecard.leakers} · Non-hostile safety flag:{" "}
          {record.scorecard.fratricide ? "Yes" : "No"}
        </p>
        <p className="footnote">
          {record.scorecard.prioritisation
            ? `Ranking agreement ${record.scorecard.prioritisation.agreement.toFixed(3)} × engagement coverage ${record.scorecard.prioritisation.coverage.toFixed(3)} × 15. ${record.scorecard.prioritisation.tie_rule}`
            : "This legacy exercise uses timely resolution for its 15-point node."}
        </p>
      </section>
      {record.teaching_notes?.length ? (
        <section className="panel teaching-notes">
          <h3>Instructor teaching notes</h3>
          <ul>
            {record.teaching_notes.map((n) => (
              <li key={n.command_seq}>
                <strong>
                  {n.tick === null ? n.status : tickLabel(n.tick)}
                </strong>{" "}
                · {n.text}
              </li>
            ))}
          </ul>
          <p className="footnote">
            Officer annotations attached to recorded pause commands; separate
            from score and learning evidence.
          </p>
        </section>
      ) : null}
      <section className="panel ghost-timeline">
        <div className="panel-header">
          <div>
            <Activity size={16} aria-hidden="true" />
            <strong>Exercise timeline</strong>
          </div>
        </div>
        <details className="evidence-disclosure timeline-provenance">
          <summary>Recorded interval and scoring horizon</summary>
          {record.replay_metadata ? (
            <>
              <p>
                Observed interval ends at{" "}
                {tickLabel(record.replay_metadata.observed_end_tick)}. Scoring
                horizon: {tickLabel(record.replay_metadata.scoring_end_tick)}.
              </p>
              <p className="footnote">
                {record.replay_metadata.note}
                {record.replay_metadata.horizon_source === "last_recorded_event"
                  ? " Legacy finish time is unknown; the reviewed interval ends at its last recorded event."
                  : ""}
              </p>
            </>
          ) : (
            <p>
              The server did not supply replay horizon metadata for this review.
            </p>
          )}
        </details>
        <TimelineEvents
          key={record.id}
          items={record.timeline}
          onJump={onJump}
        />
      </section>
    </>
  );
}

/** Read-only investigation of the server's ordered timeline; no inferred events. */
export function TimelineEvents({
  items,
  onJump,
}: {
  items: readonly TimelineItem[];
  onJump: (event: TimelineItem) => void;
}) {
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(100);
  const list = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (limit > 100) {
      // Keep keyboard users at the first newly revealed event, including when
      // the final batch removes the load-more control.
      const buttons =
        list.current?.querySelectorAll<HTMLButtonElement>("button");
      buttons?.item(limit - 100)?.focus();
    }
  }, [limit]);
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matching = items.filter((item) => {
    if (category !== "all" && item.category !== category) return false;
    const searchable =
      `${item.track_id ?? ""} ${item.title} ${item.code} ${item.category.replaceAll("_", " ")} ${tickLabel(item.tick)}`.toLowerCase();
    return terms.every((term) => searchable.includes(term));
  });
  function clear() {
    setQuery("");
    setCategory("all");
    setLimit(100);
    searchInput.current?.focus();
  }
  return (
    <>
      <div className="timeline-tools">
        <label>
          Find recorded evidence
          <input
            ref={searchInput}
            type="search"
            placeholder="Contact, event, reason or time…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setLimit(100);
            }}
          />
        </label>
        <label>
          Timeline category
          <select
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              setLimit(100);
            }}
          >
            <option value="all">All meaningful events</option>
            {[
              "trainee_action",
              "instructor_action",
              "sensor_transition",
              "contact_detection",
              "contact_resolution",
              "asset_impact",
              "score_error",
              "tactic_phase",
            ].map((value) => (
              <option key={value} value={value}>
                {value.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="timeline-results-bar">
        <p role="status">
          Showing {Math.min(limit, matching.length)} of {matching.length}{" "}
          matching events · {items.length} recorded
        </p>
        {(query || category !== "all") && (
          <button className="button subtle" onClick={clear}>
            Clear timeline filters
          </button>
        )}
      </div>
      {!matching.length && (
        <p className="timeline-empty">
          {items.length
            ? "No recorded events match these filters. Clear them or search for another contact or event."
            : "No events are recorded in this review."}
        </p>
      )}
      <div className="timeline-list" ref={list}>
        {matching.slice(0, limit).map((item) => (
          <button
            key={item.id}
            className={`timeline-item ${item.category}`}
            data-category={item.category}
            onClick={() => onJump(item)}
          >
            <span className="mono">{tickLabel(item.tick)}</span>
            <span>
              <small>
                {item.category.replaceAll("_", " ")}
                {item.track_id ? ` · ${item.track_id}` : ""}
              </small>
              {item.title}
            </span>
            <ChevronRight size={15} aria-hidden="true" />
          </button>
        ))}
      </div>
      {matching.length > limit && (
        <button
          className="button subtle timeline-load-more"
          onClick={() => setLimit((current) => current + 100)}
        >
          Show {Math.min(100, matching.length - limit)} more recorded events
        </button>
      )}
    </>
  );
}

export function ReplayTracks({
  state,
  onSelect,
}: {
  state: Snapshot;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="replay-tracks">
      <h3>Observed contact history</h3>
      <p className="footnote">
        Labels are trainee classifications. Sensor-silent tracks retain their
        recorded first observation.
      </p>
      {state.tracks
        .filter((t) => t.detected !== null)
        .map((t) => (
          <button key={t.id} onClick={() => onSelect(t.id)}>
            <b>{t.id}</b>
            <span>
              {t.classification
                ? KIND_LABEL[t.classification]
                : "Unknown contact"}{" "}
              · {t.resolved ? "resolved" : t.impact ? "asset impact" : "active"}
            </span>
            <small>
              {t.radar ? "Radar " : ""}
              {t.thermal ? "EO/IR" : !t.radar ? "Last observation" : ""}
            </small>
          </button>
        ))}
    </div>
  );
}
