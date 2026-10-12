import React, { useEffect, useState } from "react";
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
  async function load() {
    try {
      setResult(await api<Review>(`/sessions/${record.id}/fusion-review`));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    setResult(null);
    if (record.verified && record.scenario.fusion) void load();
  }, [record.id, record.verified]);
  async function sync() {
    setBusy(true);
    try {
      await api(
        `/sessions/${record.id}/fusion-exposures`,
        { exposures: record.fusionExposures ?? [] },
        RECONSTRUCTION_TIMEOUT_MS,
      );
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!record.scenario.fusion) return null;
  return (
    <section className="panel">
      <h2>Fusion advice and confidence review</h2>
      <p>
        Mode: {record.scenario.fusion.mode}; exercise:{" "}
        {record.scenario.fusion.exercise}. Advice and reported associations do
        not establish human viewing or cognitive reliance.
      </p>
      {record.verified && record.fusionExposures?.length ? (
        <button className="button" disabled={busy} onClick={() => void sync()}>
          Synchronize retained Fusion receipts
        </button>
      ) : null}
      {error && <p role="alert">{error}</p>}
      {result && (
        <>
          <p>
            {result.exposures.length} reconstructed receipts. Optional
            confidence diagnostics: {result.confidence_diagnostic.count}; mean
            Brier {result.confidence_diagnostic.mean_brier ?? "not logged"} (0
            ideal, 2 maximally wrong). {result.confidence_diagnostic.scope}.
          </p>
          {result.exposures.map((e) => (
            <details key={e.advice.exposure_id}>
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
