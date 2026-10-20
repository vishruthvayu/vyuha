import { useEffect, useMemo, useRef, useState } from "react";
import { RECONSTRUCTION_TIMEOUT_MS, api, download } from "./storage";
import { replay } from "./sim";
import { Radar } from "./Radar";
import type {
  Action,
  AppliedCommand,
  Record as TrainingRecord,
  ScoreCard,
} from "./types";
export type ReferenceResult = {
  session_id: string;
  version: string;
  mode: "canonical_reference" | "evidence_only";
  basis: string;
  original_score: ScoreCard;
  reference_score: ScoreCard;
  delta: number;
  reference_actions: Action[];
  reference_commands: AppliedCommand[];
  rollout_horizon: {
    scoring_end_tick: number;
    original_observed_end_tick: number | null;
    reference_is_hypothetical: true;
  };
  fingerprint: string;
  original_history_unchanged: true;
  limitations: string[];
};
export function ReferenceSummary({ result }: { result: ReferenceResult }) {
  return (
    <>
      <h3>{result.basis}</h3>
      <div className="review-result-grid">
        <article className="metric">
          <span>Recorded exercise</span>
          <strong>{`Original ${result.original_score.score}/100`}</strong>
          <small>Immutable training evidence</small>
        </article>
        <article className="metric">
          <span>Separate simulation</span>
          <strong>{`hypothetical reference ${result.reference_score.score}/100`}</strong>
          <small>
            Simulated difference {result.delta > 0 ? "+" : ""}
            {result.delta}
          </small>
        </article>
      </div>
      <p>
        {result.reference_actions.length} independently generated accepted
        decisions; {result.reference_commands.length} replayed instructor
        commands. The original score, actions and learning profile remain
        unchanged.
      </p>
      <p className="footnote">
        This is a projected simulation through T+
        {(result.rollout_horizon.scoring_end_tick / 30).toFixed(2)}s. Original
        observed horizon:{" "}
        {result.rollout_horizon.original_observed_end_tick === null
          ? "unknown"
          : `T+${(result.rollout_horizon.original_observed_end_tick / 30).toFixed(2)}s`}
        . It is not a certified human expert or an optimal result.
      </p>
    </>
  );
}
export default function ReferenceRun({ record }: { record: TrainingRecord }) {
  const [mode, setMode] = useState<"canonical_reference" | "evidence_only">(
      "canonical_reference",
    ),
    [result, setResult] = useState<ReferenceResult | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [tick, setTick] = useState(0);
  const generation = useRef(0);
  useEffect(() => {
    generation.current++;
    setResult(null);
    setTick(0);
    setError("");
    setBusy(false);
    return () => {
      generation.current++;
    };
  }, [record.id]);
  const bound =
    result?.session_id === record.id && result.mode === mode ? result : null;
  const picture = useMemo(
    () =>
      bound
        ? replay(
            record.scenario,
            bound.reference_actions,
            tick,
            bound.reference_commands,
          ).snapshot()
        : null,
    [record.scenario, bound, tick],
  );
  async function run() {
    const request = ++generation.current;
    const id = record.id,
      requestedMode = mode;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const reply = await api<ReferenceResult>(
        `/sessions/${encodeURIComponent(record.id)}/expert-run?mode=${mode}`,
        undefined,
        RECONSTRUCTION_TIMEOUT_MS,
      );
      if (generation.current !== request) return;
      if (reply.session_id !== id || reply.mode !== requestedMode)
        throw new Error(
          "Reference response does not belong to this session and policy",
        );
      setResult(reply);
      setTick(0);
    } catch (e) {
      if (generation.current === request) setError((e as Error).message);
    } finally {
      if (generation.current === request) setBusy(false);
    }
  }
  if (!record.verified) return null;
  return (
    <section className="panel advanced-card review-reference-run">
      <div className="eyebrow">SEPARATE HYPOTHETICAL POLICY RUN</div>
      <h2>Autonomous reference replay</h2>
      <p className="review-evidence-boundary">
        Generate a separate policy run on this frozen exercise. Canonical mode
        consults truth after the exercise; evidence-only mode may abstain when
        type or intent cannot be established.
      </p>
      <label>
        Reference policy
        <select
          disabled={busy}
          value={mode}
          onChange={(e) => {
            setMode(e.target.value as typeof mode);
            setResult(null);
          }}
        >
          <option value="canonical_reference">
            Canonical rubric truth · after AAR
          </option>
          <option value="evidence_only">Evidence-only · conservative</option>
        </select>
      </label>
      <button
        className="button subtle"
        disabled={busy}
        onClick={() => void run()}
      >
        {busy ? "Reconstructing reference…" : "Run autonomous reference"}
      </button>
      {error && (
        <p role="alert">{error} The original result remains unchanged.</p>
      )}
      {bound && (
        <>
          <ReferenceSummary result={bound} />
          <label>
            Reference replay time
            <input
              type="range"
              min={0}
              max={bound.rollout_horizon.scoring_end_tick}
              value={tick}
              onChange={(e) => setTick(Number(e.target.value))}
            />
          </label>
          <p>
            T+{(tick / 30).toFixed(2)}s · hypothetical policy sensor picture and
            own labels
          </p>
          {picture && (
            <Radar state={picture} selected={null} onSelect={() => {}} large />
          )}
          <details className="review-decision">
            <summary>Reference decision timeline</summary>
            <p>
              Export the report for every accepted decision. These controls seek
              the first 200 decisions.
            </p>
            {bound.reference_actions.slice(0, 200).map((a) => (
              <button
                className="text-button"
                key={a.order}
                onClick={() => setTick(a.tick)}
              >
                T+{(a.tick / 30).toFixed(2)}s · {a.track} · {a.k}{" "}
                {a.effector ?? a.kind ?? ""}
              </button>
            ))}
          </details>
          <details>
            <summary>Reference scope and limitations</summary>
            <ul>
              {bound.limitations.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </details>
          <button
            className="button subtle"
            onClick={() =>
              download(`vyuha-reference-${record.id}-${mode}.json`, bound)
            }
          >
            Export hypothetical reference
          </button>
        </>
      )}
    </section>
  );
}
