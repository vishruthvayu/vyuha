import React, { useEffect, useRef, useState } from "react";
import { RECONSTRUCTION_TIMEOUT_MS, api } from "./storage";
import type { Record as TrainingRecord } from "./types";
type Review = {
  exposures: {
    advice: {
      exposure_id: string;
      bias_injected: boolean;
      evidence: { tick: number; track_id: string };
      hypotheses: { kind: string; score: number }[];
    };
    association: string;
    alignment: { relation: string } | null;
    confidence_diagnostic: { value: number } | null;
    validation_scope: string;
  }[];
  confidence_diagnostic: {
    count: number;
    mean_brier: number | null;
    scope: string;
  };
  limitations: string[];
};
export default function FusionReview({ record }: { record: TrainingRecord }) {
  const [result, setResult] = useState<Review | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const generation = useRef(0);
  async function load(id: string, request: number) {
    try {
      const reply = await api<Review>(
        `/sessions/${encodeURIComponent(id)}/fusion-review`,
      );
      if (generation.current === request) {
        setResult(reply);
        setError("");
      }
    } catch (e) {
      if (generation.current === request) setError((e as Error).message);
    } finally {
      if (generation.current === request) setBusy(false);
    }
  }
  useEffect(() => {
    const request = ++generation.current;
    setResult(null);
    setError("");
    setBusy(Boolean(record.verified && record.scenario.fusion));
    if (record.verified && record.scenario.fusion)
      void load(record.id, request);
    return () => {
      generation.current++;
    };
  }, [record.id, record.verified, record.scenario.fusion]);
  async function sync() {
    if (!record.verified) return;
    const request = ++generation.current;
    const id = record.id;
    setBusy(true);
    setError("");
    try {
      await api(
        `/sessions/${encodeURIComponent(id)}/fusion-exposures`,
        { exposures: record.fusionExposures ?? [] },
        RECONSTRUCTION_TIMEOUT_MS,
      );
      if (generation.current === request) await load(id, request);
    } catch (e) {
      if (generation.current === request) setError((e as Error).message);
    } finally {
      if (generation.current === request) setBusy(false);
    }
  }
  if (!record.scenario.fusion) return null;
  return (
    <section className="panel advanced-card review-fusion-review">
      <div className="eyebrow">ADVICE RECEIPTS · HUMAN RELIANCE UNVERIFIED</div>
      <h2>Fusion advice and confidence review</h2>
      <p className="review-evidence-boundary">
        Mode: {record.scenario.fusion.mode}; exercise:{" "}
        {record.scenario.fusion.exercise}. Advice and reported associations do
        not establish human viewing or cognitive reliance.
      </p>
      {record.verified && record.fusionExposures?.length ? (
        <button className="button" disabled={busy} onClick={() => void sync()}>
          Synchronize retained Fusion receipts
        </button>
      ) : null}
      {!record.verified && (
        <p>
          Server verification is required for reconstructed Fusion receipts.
        </p>
      )}
      {busy && <p role="status">Reconstructing retained Fusion receipts…</p>}
      {error && (
        <>
          <p role="alert">{error}</p>
          <button
            className="button subtle"
            disabled={busy}
            onClick={() => {
              const request = ++generation.current;
              setBusy(true);
              setError("");
              void load(record.id, request);
            }}
          >
            Retry receipt review
          </button>
        </>
      )}
      {result && (
        <>
          <div className="review-result-grid">
            <article className="metric">
              <span>Reconstructed advice receipts</span>
              <strong>{result.exposures.length}</strong>
              <small>Not verified human views</small>
            </article>
            <article className="metric">
              <span>Logged confidence diagnostics</span>
              <strong>{result.confidence_diagnostic.count}</strong>
              <small>Optional operator input</small>
            </article>
            <article className="metric">
              <span>Mean Brier diagnostic</span>
              <strong>
                {result.confidence_diagnostic.mean_brier ?? "Not logged"}
              </strong>
              <small>0 ideal · 2 maximally wrong</small>
            </article>
          </div>
          <p className="footnote">{result.confidence_diagnostic.scope}.</p>
          {result.exposures.map((e) => (
            <details className="review-decision" key={e.advice.exposure_id}>
              <summary>
                {e.advice.evidence.track_id} · T+
                {(e.advice.evidence.tick / 30).toFixed(2)}s ·{" "}
                {e.advice.bias_injected
                  ? "synthetic biased advice"
                  : "training advice"}
              </summary>
              <p>
                Highest type weight: {e.advice.hypotheses[0]?.kind}. Action
                comparison: {e.alignment?.relation ?? "no associated action"}.
                Operator association: {e.association} (self-reported).
              </p>
              <p>
                Confidence Brier:{" "}
                {e.confidence_diagnostic?.value ?? "not logged"}.
              </p>
              <p className="footnote">{e.validation_scope}</p>
            </details>
          ))}
          <p className="footnote">{result.limitations.join(" ")}</p>
        </>
      )}
    </section>
  );
}
