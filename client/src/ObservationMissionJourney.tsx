import { useEffect, useState } from "react";
import { api, RECONSTRUCTION_TIMEOUT_MS } from "./storage";
import type {
  MissionMode,
  ObservationMissionCatalog,
} from "./observation-missions";
type Counts = {
  supported: number;
  unsupported: number;
  inconclusive: number;
  unassessable: number;
};
export type ObservationProgression = {
  version: string;
  practice: { sessions: number; competencies: Record<string, Counts> };
  assessment: { sessions: number; competencies: Record<string, Counts> };
  recommendation: {
    template: string;
    competency: string;
    reason: string;
    href: string;
    based_on: {
      session_id: string;
      mode: string;
      competency: string;
      status: string;
    }[];
  };
  limitations: string[];
};
export function missionPracticeHref(
  template: string,
  mode: MissionMode,
  seed: number,
) {
  return (
    "/?" +
    new URLSearchParams({
      mission_template: template,
      mission_mode: mode,
      seed: String(seed),
    }).toString()
  );
}
export default function ObservationMissionJourney({
  trainee,
}: {
  trainee: string;
}) {
  const [catalog, setCatalog] = useState<ObservationMissionCatalog | null>(
      null,
    ),
    [progress, setProgress] = useState<ObservationProgression | null>(null);
  const [mode, setMode] = useState<MissionMode>("practice"),
    [seed, setSeed] = useState("482913"),
    [error, setError] = useState(""),
    [progressError, setProgressError] = useState(""),
    [reload, setReload] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setError("");
    setProgressError("");
    setProgress(null);
    void api<ObservationMissionCatalog>("/observation-missions/catalog")
      .then((v) => {
        if (!cancelled) setCatalog(v);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      });
    void api<ObservationProgression>(
      `/observation-learning/trainees/${encodeURIComponent(trainee)}/progression`,
      undefined,
      RECONSTRUCTION_TIMEOUT_MS,
    )
      .then((v) => {
        if (!cancelled) setProgress(v);
      })
      .catch((e) => {
        if (!cancelled) setProgressError((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [trainee, reload]);
  const n = Number(seed),
    valid =
      /^\d{1,10}$/.test(seed) &&
      Number.isInteger(n) &&
      n >= 0 &&
      n <= 4294967295;
  return (
    <section
      className="observation-mission-journey"
      aria-labelledby="observation-mission-journey-title"
    >
      <header>
        <div>
          <span className="eyebrow">
            AUTHORED EVIDENCE / OBSERVATION MISSIONS
          </span>
          <h2 id="observation-mission-journey-title">
            Different information. Different decisions.
          </h2>
          <p>
            Enter a frozen mission, investigate its evidence, then separate
            outcome accuracy from what your decision was actually supported by.
          </p>
        </div>
        <a href="/observation-missions" className="button subtle">
          Instructor mission studio
        </a>
      </header>
      <div className="mission-launch-controls">
        <fieldset>
          <legend>Evidence mode</legend>
          <label>
            <input
              type="radio"
              name="observation-mission-mode"
              checked={mode === "practice"}
              onChange={() => setMode("practice")}
            />
            Practice
          </label>
          <label>
            <input
              type="radio"
              name="observation-mission-mode"
              checked={mode === "assessment"}
              onChange={() => setMode("assessment")}
            />
            Independent assessment
          </label>
        </fieldset>
        <label>
          Reproducible seed
          <input
            inputMode="numeric"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            aria-invalid={!valid}
          />
        </label>
      </div>
      <p className="mission-contract-note">
        {mode === "assessment"
          ? "Independent mode suppresses Fusion coaching and keeps this contract’s evidence separate from practice. It is not a calibrated assessment form or certification."
          : "Practice evidence guides the next exercise; it does not update the historical individual mastery profile."}{" "}
        Original rubric scores are preserved.
      </p>
      {!valid && <p role="alert">Use a seed from 0 to 4294967295.</p>}
      {error ? (
        <p role="alert">Mission catalogue unavailable: {error}</p>
      ) : !catalog ? (
        <p role="status">Loading frozen mission briefs…</p>
      ) : (
        <div className="mission-brief-grid">
          {catalog.templates.map((m, i) => (
            <article key={m.id} data-mission={m.id}>
              <span className="mission-sequence">
                0{i + 1} / {m.default_conditions.night ? "NIGHT" : "DAY"} ·{" "}
                {m.default_conditions.terrain.toUpperCase()}
              </span>
              <h3>{m.title}</h3>
              <p>{m.summary}</p>
              <ol>
                {m.objectives.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ol>
              <p className="mission-competencies">
                Competency evidence: {m.competencies.join(" · ")}
              </p>
              <a
                className="button primary"
                aria-disabled={!valid}
                href={valid ? missionPracticeHref(m.id, mode, n) : undefined}
              >
                Brief this mission
              </a>
            </article>
          ))}
        </div>
      )}
      {!!catalog?.missions.length && (
        <details>
          <summary>Saved frozen missions · {catalog.missions.length}</summary>
          <ul>
            {catalog.missions.map((m) => (
              <li key={m.id}>
                <a href={`/?observation_mission=${encodeURIComponent(m.id)}`}>
                  {m.title}
                </a>{" "}
                · {m.mode} · frozen {m.id.slice(-8)}
              </li>
            ))}
          </ul>
        </details>
      )}
      {progress && (
        <section
          className="observation-next-practice"
          aria-label="Evidence-guided observation practice"
        >
          <span className="eyebrow">
            EVIDENCE-GAP DIRECTOR / EXPLAINABLE HEURISTIC
          </span>
          <h3>Your next information problem</h3>
          <p>
            <strong>{progress.recommendation.competency}</strong> ·{" "}
            {progress.recommendation.reason}
          </p>
          <a className="button primary" href={progress.recommendation.href}>
            Prepare recommended observation practice
          </a>
          <p>
            {progress.practice.sessions} practice sessions ·{" "}
            {progress.assessment.sessions} independent sessions in the bounded
            evidence window. These are descriptive evidence observations, not
            mastery levels or measured learning gains.
          </p>
          {!!progress.recommendation.based_on.length && (
            <details>
              <summary>Show the evidence behind this recommendation</summary>
              <ul>
                {progress.recommendation.based_on.map((r, i) => (
                  <li key={i}>
                    <a
                      href={`/?view=aar&session=${encodeURIComponent(r.session_id)}`}
                    >
                      {r.session_id.slice(0, 12)}
                    </a>{" "}
                    · {r.mode} · {r.competency} · {r.status}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}
      {progressError && (
        <p role="status">
          Evidence-guided practice is unavailable: {progressError}. The frozen
          mission briefs remain usable.
        </p>
      )}
      {(error || progressError) && (
        <button
          className="button subtle"
          onClick={() => setReload((x) => x + 1)}
        >
          Retry mission evidence
        </button>
      )}
    </section>
  );
}
