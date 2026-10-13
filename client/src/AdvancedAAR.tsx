import { useEffect, useRef, useState } from "react";
import { RECONSTRUCTION_TIMEOUT_MS, api } from "./storage";
import type {
  Action,
  DecisionReview,
  Record as TrainingRecord,
  ScoreCard,
} from "./types";
import DecisionPath from "./review-DecisionPath";
type WhatIf = {
  kind: "counterfactual";
  branch_id: string;
  original_score: ScoreCard;
  hypothetical_score: ScoreCard;
  delta: number;
  rejected_later_actions: unknown[];
  reference_policy: { action: string; confidence: string; cues: string[] };
  note: string;
};
export default function AdvancedAAR({
  record,
  onReview,
}: {
  record: TrainingRecord;
  onReview?: (review: DecisionReview) => void;
}) {
  const [track, setTrack] = useState(record.scorecard.rows[0]?.id ?? ""),
    [index, setIndex] = useState(0),
    [alternative, setAlternative] = useState("hold"),
    [result, setResult] = useState<WhatIf | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    generation.current++;
    setBusy(false);
    setTrack(record.scorecard.rows[0]?.id ?? "");
    setIndex(0);
    setResult(null);
    setError("");
    return () => {
      generation.current++;
    };
  }, [record.id]);
  const decisions = record.events
    .map((a, index) => ({ a, index }))
    .filter(({ a }) => a.k === "engage" && a.track === track);
  const selected = decisions.find((d) => d.index === index) ?? decisions[0];
  async function run() {
    if (!selected || !record.verified) return;
    const request = ++generation.current;
    setBusy(true);
    setResult(null);
    setError("");
    try {
      const action: Action = {
        ...selected.a,
        effector: alternative as Action["effector"],
      };
      const reply = await api<WhatIf>(
        `/sessions/${encodeURIComponent(record.id)}/what-if`,
        { decision_index: selected.index, action },
        RECONSTRUCTION_TIMEOUT_MS,
      );
      if (generation.current === request) setResult(reply);
    } catch (e) {
      if (generation.current === request) setError((e as Error).message);
    } finally {
      if (generation.current === request) setBusy(false);
    }
  }
  return (
    <section className="panel advanced-card">
      <h2>Decision path and What-if replay</h2>
      <label>
        Reviewed contact
        <select
          disabled={busy}
          value={track}
          onChange={(e) => {
            setTrack(e.target.value);
            setResult(null);
            setIndex(0);
          }}
        >
          {record.scorecard.rows.map((r) => (
            <option key={r.id}>{r.id}</option>
          ))}
        </select>
      </label>
      <DecisionPath record={record} track={track} onReview={onReview} />
      <h3>Try a different response</h3>
      <p>
        The server branches the frozen exercise at the recorded decision. The
        original score and training profile remain unchanged.
      </p>
      {!record.verified ? (
        <p>Server verification is required for What-if.</p>
      ) : !decisions.length ? (
        <p>No recorded engagement is available to replace for this contact.</p>
      ) : (
        <>
          <label>
            Recorded response
            <select
              disabled={busy}
              value={selected?.index ?? 0}
              onChange={(e) => {
                setIndex(Number(e.target.value));
                setResult(null);
              }}
            >
              {decisions.map((d) => (
                <option key={d.index} value={d.index}>
                  {d.a.track} · T+{(d.a.tick / 30).toFixed(2)}s · {d.a.effector}
                </option>
              ))}
            </select>
          </label>
          <label>
            Hypothetical response
            <select
              disabled={busy}
              value={alternative}
              onChange={(e) => {
                setAlternative(e.target.value);
                setResult(null);
              }}
            >
              <option value="hold">Hold</option>
              <option value="rf_jam">RF jammer</option>
              <option value="kinetic">Kinetic</option>
            </select>
          </label>
          <button
            className="button primary"
            disabled={busy}
            onClick={() => void run()}
          >
            {busy ? "Reconstructing…" : "Run hypothetical branch"}
          </button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      {result && (
        <div role="status" className="review-counterfactual-result">
          <div className="eyebrow">COUNTERFACTUAL · ORIGINAL UNCHANGED</div>
          <h3>Hypothetical simulated result</h3>
          <div className="review-result-grid">
            <article className="metric">
              <span>Original verified outcome</span>
              <strong>{result.original_score.score}/100</strong>
              <small>Recorded history preserved</small>
            </article>
            <article className="metric">
              <span>Hypothetical branch</span>
              <strong>{result.hypothetical_score.score}/100</strong>
              <small>
                Simulated difference {result.delta > 0 ? "+" : ""}
                {result.delta}
              </small>
            </article>
          </div>
          <p>
            Asset impacts: {result.original_score.leakers} →{" "}
            {result.hypothetical_score.leakers}. Subsequent actions invalidated
            by this branch: {result.rejected_later_actions.length}.
          </p>
          <p>
            Evidence-constrained training policy:{" "}
            {result.reference_policy.action} (
            {result.reference_policy.confidence}).{" "}
            {result.reference_policy.cues.join("; ")}.
          </p>
          <p className="footnote">{result.note}</p>
        </div>
      )}
    </section>
  );
}
