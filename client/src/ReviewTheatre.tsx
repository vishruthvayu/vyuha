import ObservationAssessmentReview from "./ObservationAssessmentReview";
import AcquisitionReview from "./AcquisitionReview";
import { timelineSeek } from "./review-frame";
import {
  useEffect,
  useRef,
  useMemo,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Play, Pause, RotateCcw, Eye, Layers } from "lucide-react";
import { Scene } from "./LazyScene";
import { Radar } from "./Radar";
import { actionLabel, tickLabel } from "./Ghost";
import {
  evidenceAtCursor,
  reviewEpisodeMoments,
  reviewObservationFrame,
  reviewObservationSnapshot,
  selectedReviewDecision,
} from "./review-frame";
import type { CameraPreset } from "./presentation";
import type { Quality } from "./quality";
import type {
  DecisionReview,
  Record as TrainingRecord,
  Snapshot,
} from "./types";
type Props = {
  record: TrainingRecord;
  snapshot: Snapshot;
  tick: number;
  endTick: number;
  beforeOrder?: number;
  selected: string | null;
  decisionId: string | null;
  playing: boolean;
  quality: Quality;
  headingRef: RefObject<HTMLHeadingElement | null>;
  inspector: ReactNode;
  onSeek: (
    tick: number,
    order: number | undefined,
    track: string | null,
  ) => void;
  onSelect: (track: string) => void;
  onDecision: (review: DecisionReview) => void;
  onPlay: () => void;
};
/** Presentation-only reconstruction controller. App retains immutable source,
 * exact replay boundaries and playback; this component never dispatches actions. */
export default function ReviewTheatre(props: Props) {
  const { record, snapshot, tick, endTick, beforeOrder, selected } = props;
  const [lens, setLens] = useState<"observations" | "reference">(
    "observations",
  );
  const [channel, setChannel] = useState<"ir" | "eo" | "radar">("ir");
  const [camera, setCamera] = useState<CameraPreset>("overview");
  const [tactical, setTactical] = useState(false),
    [fps, setFps] = useState(0);
  const modeledSnapshot = useMemo(
    () => reviewObservationSnapshot(snapshot),
    [snapshot],
  );
  const frame = useMemo(() => reviewObservationFrame(snapshot), [snapshot]);
  const decision = selectedReviewDecision(record, props.decisionId);
  const aligned = evidenceAtCursor(decision, tick, beforeOrder);
  const sampleTimeMatches = decision?.evidence.tick === tick;
  const atCursor = frame.contacts.find((c) => c.id === selected) ?? null;
  const decisions = useMemo(
    () =>
      [...(record.decision_reviews ?? [])]
        .filter((r) => r.tick <= endTick)
        .sort((a, b) => a.tick - b.tick || (a.order ?? -1) - (b.order ?? -1)),
    [record, endTick],
  );
  const decisionIndex = decisions.findIndex(
    (r) => r.decision_id === decision?.decision_id,
  );
  const activePage = decisionIndex >= 0 ? Math.floor(decisionIndex / 12) : 0;
  const offset =
    Math.min(activePage, Math.max(0, Math.ceil(decisions.length / 12) - 1)) *
    12;
  const railRef = useRef<HTMLDivElement>(null);
  const radarOnly = tactical || props.quality === "tactical";
  const referenceLens = lens === "reference" && !radarOnly;
  useEffect(() => {
    const rail = railRef.current,
      card = rail?.querySelector<HTMLElement>('button[aria-pressed="true"]');
    if (rail && card && typeof rail.scrollTo === "function") {
      const left = card.offsetLeft - rail.offsetLeft;
      if (
        left < rail.scrollLeft ||
        left + card.offsetWidth > rail.scrollLeft + rail.clientWidth
      )
        rail.scrollTo({ left: Math.max(0, left - 8), behavior: "auto" });
    }
  }, [props.decisionId, offset, record.id]);
  const displayRadar =
    channel === "radar" || tactical || props.quality === "tactical";
  const vision = channel === "eo" ? "day" : "thermal";
  const choose = (r: DecisionReview) => {
    props.onDecision(r);
  };
  return (
    <section
      className="evidence-theatre"
      id="review-replay"
      aria-labelledby="theatre-heading"
      data-lens={referenceLens ? "reference" : "observations"}
    >
      <header className="theatre-heading">
        <div>
          <p className="eyebrow">INVESTIGATE THE DECISION</p>
          <h2 id="theatre-heading" ref={props.headingRef} tabIndex={-1}>
            Evidence reconstruction theatre
          </h2>
          <p>
            Reconstruct available observations, then compare them with the
            reference world.
          </p>
        </div>
        <span className="theatre-source">
          {record.verified ? "SERVER VERIFIED" : "LOCAL · VERIFICATION PENDING"}
          <small>{record.scenario.title}</small>
        </span>
      </header>
      <div className="theatre-lensbar" aria-label="Reconstruction lens">
        <button
          aria-pressed={!referenceLens}
          onClick={() => setLens("observations")}
        >
          <Eye size={16} aria-hidden="true" />
          Modeled observations
        </button>
        <button
          aria-pressed={referenceLens}
          disabled={radarOnly}
          title={
            radarOnly
              ? "3D reference is unavailable in radar-only fallback; use the explanation below for reference answers."
              : undefined
          }
          onClick={() => {
            setLens("reference");
            if (channel === "radar") setChannel("ir");
          }}
        >
          <Layers size={16} aria-hidden="true" />
          Reference world
        </button>
        <span>
          {tickLabel(tick)} ·{" "}
          {beforeOrder === undefined
            ? "after recorded events at this tick"
            : `before event order ${beforeOrder}`}
          {decision && (
            <small>
              PINNED EVIDENCE {tickLabel(decision.evidence.tick)} · REVIEW{" "}
              {tickLabel(decision.tick)}
            </small>
          )}
        </span>
      </div>
      {radarOnly && (
        <p className="theatre-fallback-note" role="status">
          2D fallback shows modeled radar reports. 3D reference reconstruction
          is unavailable; after-exercise reference answers remain in Decision
          explanation.
        </p>
      )}
      <div className="theatre-stage">
        <div className="theatre-visual">
          <div className="theatre-viewbar" aria-label="Reconstruction channels">
            {(
              [
                ["ir", "IR"],
                ["eo", "EO"],
                ["radar", "Radar"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                disabled={radarOnly || (referenceLens && id === "radar")}
                title={radarOnly ? "Radar-only fallback is active." : undefined}
                aria-pressed={displayRadar ? id === "radar" : channel === id}
                onClick={() => setChannel(id)}
              >
                {label}
              </button>
            ))}
            {referenceLens && (
              <label>
                Camera
                <select
                  aria-label="Reference camera"
                  value={camera}
                  onChange={(e) => setCamera(e.target.value as CameraPreset)}
                >
                  <option value="overview">Overview</option>
                  <option value="observer">Observer</option>
                  <option value="follow">Follow selected</option>
                </select>
              </label>
            )}
            <button
              aria-pressed={radarOnly}
              disabled={props.quality === "tactical"}
              onClick={() => setTactical((v) => !v)}
            >
              2D fallback
            </button>
          </div>
          <div className={`theatre-canvas scene-container ${vision}`}>
            {displayRadar ? (
              <Radar
                state={modeledSnapshot}
                selected={selected}
                onSelect={props.onSelect}
                large
              />
            ) : (
              <Scene
                state={referenceLens ? snapshot : modeledSnapshot}
                selected={selected}
                vision={vision}
                palette="white"
                quality={props.quality}
                terrain={record.scenario.terrain_id}
                sensorConfig={record.scenario.sensor_config}
                terrainBoxes={record.scenario.terrain_boxes}
                engineVersion={record.scenario.engine_version}
                fog={record.scenario.fog}
                groundTruth={referenceLens}
                cameraPreset={referenceLens ? camera : undefined}
                visibilityKey={`theatre:${record.id}:${referenceLens}:${channel}`}
                onFps={setFps}
                fallback={
                  <button onClick={() => setTactical(true)}>
                    Use 2D reconstruction
                  </button>
                }
              />
            )}
            <div className="theatre-scene-label">
              {displayRadar
                ? "MODELED RADAR REPORTS"
                : referenceLens
                  ? "REFERENCE TRUTH · AFTER EXERCISE"
                  : !frame.modern
                    ? "LEGACY OPTICAL RECONSTRUCTION"
                    : `${channel.toUpperCase()} · MODELED OBSERVATIONS`}
              <small>
                {displayRadar
                  ? "Positions from radar reports; tentative/coasting uncertainty retained"
                  : referenceLens
                    ? "External camera · translucent reference terrain"
                    : !frame.modern
                      ? "EO/IR are presentation styles · separate channel provenance unavailable"
                      : "Sensor-origin view · observed geometry only"}
              </small>
            </div>
            <span className="theatre-frame-rate">
              {displayRadar
                ? "TACTICAL VIEW"
                : fps > 0
                  ? `${fps} fps`
                  : "INITIALIZING RENDERER"}
            </span>
          </div>
          <div className="theatre-transport">
            <button
              aria-label={props.playing ? "Pause replay" : "Play replay"}
              onClick={props.onPlay}
            >
              {props.playing ? (
                <Pause size={18} aria-hidden="true" />
              ) : (
                <Play size={18} aria-hidden="true" />
              )}
            </button>
            <input
              aria-label="Replay time"
              aria-valuetext={`${tickLabel(tick)} of ${tickLabel(endTick)}`}
              type="range"
              min={0}
              max={endTick}
              value={tick}
              onChange={(e) =>
                props.onSeek(Number(e.target.value), undefined, null)
              }
            />
            <span>{tickLabel(endTick)}</span>
          </div>
        </div>
        <aside
          className="theatre-observations"
          aria-label="Evidence at replay cursor"
          tabIndex={0}
        >
          <p className="eyebrow">AT THE PLAYHEAD</p>
          <h3>{tickLabel(tick)}</h3>
          <p className="theatre-limit">
            Modeled availability reconstructed from the frozen engine. This is
            not a recording of gaze, viewport or what the trainee actually
            noticed.
          </p>
          {!frame.modern && (
            <p className="theatre-warning">
              Legacy exercise: separate timestamped EO/IR reports were not
              recorded. Modern channel provenance cannot be inferred.
            </p>
          )}
          <label>
            Reported contact
            <select
              aria-label="Reported contact at cursor"
              value={atCursor?.id ?? ""}
              onChange={(e) => props.onSelect(e.target.value)}
            >
              <option value="">Choose a reported contact</option>
              {frame.contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id} · trainee declaration: {c.declaration}
                </option>
              ))}
            </select>
          </label>
          {atCursor ? (
            <dl>
              {(["radar", "eo", "ir", "rf", "iff"] as const).map((key) => (
                <div key={key}>
                  <dt>{key.toUpperCase()}</dt>
                  <dd>{atCursor[key]}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="theatre-empty">
              {selected
                ? `${selected} has no time-valid report at this playhead.`
                : "Select a decision below or a reported contact."}{" "}
              Absence of a report is not proof of an empty sky.
            </p>
          )}
          <div
            className={`theatre-time-context ${aligned ? "aligned" : ""}`}
            role="status"
          >
            <strong>
              {decision
                ? aligned
                  ? "Decision time and event boundary aligned"
                  : sampleTimeMatches
                    ? "Sample time matches · event boundary unknown"
                    : "Two different moments"
                : "No decision selected"}
            </strong>
            {decision && (
              <>
                <p>
                  Ghost evidence for {decision.track_id} was captured at{" "}
                  {tickLabel(decision.evidence.tick)}. Review moment:{" "}
                  {tickLabel(decision.tick)}
                  {decision.trainee_action && decision.order !== null
                    ? `, before event order ${decision.order}`
                    : ""}
                  . The scene follows the playhead
                  {selected && selected !== decision.track_id
                    ? `; inspected contact ${selected} differs from the pinned decision`
                    : ""}
                  .
                </p>
                {(!aligned || selected !== decision.track_id) && (
                  <button
                    className="button subtle"
                    disabled={decision.evidence.tick > endTick}
                    onClick={() => {
                      props.onDecision(decision);
                      props.onSeek(
                        decision.evidence.tick,
                        decision.trainee_action &&
                          decision.evidence.tick === decision.tick
                          ? (decision.order ?? undefined)
                          : undefined,
                        decision.track_id,
                      );
                    }}
                  >
                    <RotateCcw size={14} aria-hidden="true" />
                    Inspect pinned evidence moment
                  </button>
                )}
              </>
            )}
          </div>
        </aside>
      </div>
      <AcquisitionReview
        record={record}
        onJump={(event) => {
          const point = timelineSeek(event);
          props.onSeek(point.tick, point.beforeOrder, event.track_id);
        }}
      />
      <ObservationAssessmentReview
        record={record}
        onJump={(event) => {
          const point = timelineSeek(event);
          props.onSeek(point.tick, point.beforeOrder, event.track_id);
        }}
      />
      <nav
        className="theatre-decision-rail"
        aria-label="Recorded decision moments"
      >
        {decision && (
          <div
            className="theatre-episode"
            role="group"
            aria-label={`Investigate ${decision.track_id}`}
          >
            {reviewEpisodeMoments(decision, record.timeline ?? [], endTick).map(
              (chapter, index) => (
                <button
                  key={chapter.key}
                  disabled={!chapter.point}
                  onClick={() => {
                    if (!chapter.point) return;
                    props.onDecision(decision);
                    props.onSeek(
                      chapter.point.tick,
                      chapter.point.beforeOrder,
                      decision.track_id,
                    );
                  }}
                >
                  <small>
                    0{index + 1} · {decision.track_id}
                  </small>
                  <strong>{chapter.label}</strong>
                  <span>
                    {chapter.point
                      ? `${tickLabel(chapter.point.tick)} · ${chapter.point.beforeOrder === undefined ? "within-tick order unknown" : `before event order ${chapter.point.beforeOrder}`}`
                      : "Not observed within this recording"}
                  </span>
                </button>
              ),
            )}
          </div>
        )}
        <div className="theatre-rail-heading">
          <h3>
            {record.scenario.engine_version === "vyuha-0.6.0"
              ? "Original tactical rubric moments"
              : "Decision moments"}
          </h3>
          <span>
            {decisions.length
              ? `${offset + 1}–${Math.min(offset + 12, decisions.length)} of ${decisions.length}`
              : record.scenario.engine_version === "vyuha-0.6.0"
                ? "No tactical rubric decision within this interval; explicit Defer is reviewed separately"
                : "No decision within the recorded interval"}
          </span>
        </div>
        <div className="theatre-moments" ref={railRef}>
          {decisions.slice(offset, offset + 12).map((r, index) => (
            <button
              key={r.decision_id}
              aria-pressed={r.decision_id === decision?.decision_id}
              onClick={() => choose(r)}
            >
              <span>
                {String(offset + index + 1).padStart(2, "0")} ·{" "}
                {tickLabel(r.tick)}
              </span>
              <strong>
                {r.track_id} ·{" "}
                {actionLabel(
                  r.trainee_action,
                  record.scenario.engine_version === "vyuha-0.6.0",
                )}
              </strong>
              <small>
                {r.verdict} · {r.decision_kind.replaceAll("_", " ")}
              </small>
            </button>
          ))}
        </div>
        {decisions.length > 12 && (
          <div className="theatre-pages">
            <button
              disabled={offset === 0}
              onClick={() => {
                const r = decisions[Math.max(0, offset - 12)];
                if (r) choose(r);
              }}
            >
              Previous 12 moments
            </button>
            <button
              disabled={offset + 12 >= decisions.length}
              onClick={() => {
                const r = decisions[offset + 12];
                if (r) choose(r);
              }}
            >
              Next 12 moments
            </button>
          </div>
        )}
      </nav>
      <details className="theatre-inspector" open>
        <summary>
          {record.scenario.engine_version === "vyuha-0.6.0"
            ? "Original tactical rubric explanation · Defer is reviewed separately"
            : "Decision explanation · pinned evidence and after-exercise reference"}
        </summary>
        {props.inspector}
      </details>
    </section>
  );
}
