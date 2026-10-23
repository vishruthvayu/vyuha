import { useEffect, useRef, useState } from "react";
import { api } from "./storage";

type Diagnostic = {
  status: "SATISFIED" | "UNSATISFIED";
  item_id: string;
  seed: number;
  version: string;
  engine_version: string;
  observed_frames: number;
  catalog_hash: string;
  scenario_sha256: string;
  projected_observation_sha256: string;
  first_qualifying_window: {
    track_id: string;
    start_tick: number;
    end_tick: number;
  } | null;
  visible_ambiguous_identity_frames: number;
  stale_channel_samples: number;
  limitation: string;
};

export default function AssessmentDiagnostics() {
  const [seed, setSeed] = useState("7");
  const [report, setReport] = useState<Diagnostic | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const valid = /^\d{1,10}$/.test(seed) && Number(seed) <= 4294967295;
  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );

  async function run() {
    if (!valid || busy) return;
    const request = ++generation.current;
    setReport(null);
    setError("");
    setBusy(true);
    try {
      const next = await api<Diagnostic>(
        `/evaluations/assessment-diagnostics/c01?seed=${Number(seed)}`,
        undefined,
        30000,
      );
      if (request === generation.current) setReport(next);
    } catch (failure) {
      if (request === generation.current)
        setError(
          (failure as Error).message ||
            "Diagnostic unavailable; retry when the server is ready.",
        );
    } finally {
      if (request === generation.current) setBusy(false);
    }
  }

  return (
    <section
      className="panel advanced-card"
      aria-labelledby="assessment-diagnostic-title"
    >
      <h2 id="assessment-diagnostic-title">
        Assessment opportunity diagnostic · pilot
      </h2>
      <p>
        Officer-only, read-only check of one frozen C01 assessment:
        C01_BASELINE-A_A. Run a passive simulation and inspect whether an
        observed contact supplies a proposed 15-tick detection window (0.5
        simulation seconds), with samples no older than 30 ticks. No participant
        is enrolled.
      </p>
      <p>
        This partial diagnostic does not grade a trainee or establish human
        solvability, classification support, empirical difficulty or learning
        benefit. Identity ambiguity is allowed. Original evidence and scores
        stay unchanged.
      </p>
      <label>
        Diagnostic seed
        <input
          type="text"
          inputMode="numeric"
          value={seed}
          maxLength={10}
          aria-invalid={!valid}
          aria-describedby="assessment-diagnostic-seed-help"
          onChange={(event) => {
            generation.current += 1;
            setSeed(event.target.value);
            setReport(null);
            setError("");
            setBusy(false);
          }}
        />
      </label>
      <p id="assessment-diagnostic-seed-help">
        Whole number from 0 to 4294967295. Editing it discards any pending
        result.
      </p>
      {!valid && <p role="alert">Enter a seed within the stated range.</p>}
      <button
        className="button secondary"
        disabled={busy || !valid}
        onClick={() => void run()}
      >
        {busy
          ? "Running observation diagnostic…"
          : "Run observation diagnostic"}
      </button>
      {busy && (
        <p role="status">
          Reconstructing passive observations; no score writes.
        </p>
      )}
      {error && (
        <p role="alert">{error} Use Run observation diagnostic to retry.</p>
      )}
      {report && (
        <div aria-label="Assessment diagnostic result">
          <h3>
            {report.status === "SATISFIED"
              ? "Proposed opportunity present"
              : "No qualifying window in this passive run"}
          </h3>
          <p role="status">
            {report.item_id} · seed {report.seed} · {report.observed_frames}{" "}
            observation rows.
          </p>
          {report.first_qualifying_window && (
            <p>
              First qualifying window: {report.first_qualifying_window.track_id}
              , ticks {report.first_qualifying_window.start_tick}–
              {report.first_qualifying_window.end_tick}.
            </p>
          )}
          <p>
            Ambiguous-identity visible rows:{" "}
            {report.visible_ambiguous_identity_frames}. Excluded stale channel
            samples: {report.stale_channel_samples}.
          </p>
          <dl style={{ overflowWrap: "anywhere" }}>
            <dt>Diagnostic / engine</dt>
            <dd>
              {report.version} / {report.engine_version}
            </dd>
            <dt>Frozen catalog SHA-256</dt>
            <dd>{report.catalog_hash}</dd>
            <dt>Scenario SHA-256</dt>
            <dd>{report.scenario_sha256}</dd>
            <dt>Projected observation SHA-256</dt>
            <dd>{report.projected_observation_sha256}</dd>
          </dl>
          <p>{report.limitation}</p>
        </div>
      )}
    </section>
  );
}
