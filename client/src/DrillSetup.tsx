import { RotateCcw } from "lucide-react";
import { ProfilePanel, DirectorCard } from "./Director";
import type { TrainingProfile, Scenario } from "./types";
import type { UnitIdentity } from "./unit-state";
import { nextTrainingSeed, type TrainingMode } from "./training-setup";
export default function DrillSetup({
  mode,
  onMode,
  night,
  onNight,
  seed,
  onSeed,
  trainee,
  onTrainee,
  identity,
  profile,
  prepared,
  busy,
  frozenLearning = false,
  library,
  libraryId,
  onLibrary,
}: {
  mode: TrainingMode;
  onMode: (mode: TrainingMode) => void;
  night: boolean;
  onNight: (value: boolean) => void;
  seed: number;
  onSeed: (value: number) => void;
  trainee: string;
  onTrainee: (value: string) => void;
  identity?: UnitIdentity;
  profile: TrainingProfile | null;
  prepared: Scenario | null;
  onStart: () => void;
  busy: boolean;
  frozenLearning?: boolean;
  library: Scenario[];
  libraryId: string;
  onLibrary: (value: string) => void;
}) {
  return (
    <>
      {" "}
      {
        <details className="evidence-disclosure drill-settings" open>
          <summary>Drill settings</summary>
          <div className="setup-bar">
            <label>
              {identity ? "Callsign" : "Trainee ID"}
              <input
                aria-label={identity ? "Callsign" : "Trainee ID"}
                disabled={busy || frozenLearning}
                readOnly={!!identity}
                value={identity?.callsign ?? trainee}
                maxLength={24}
                onChange={(e) =>
                  onTrainee(
                    e.target.value.replace(/[^A-Za-z0-9_-]/g, "") || "CADET-01",
                  )
                }
              />
            </label>
            <label>
              Drill
              <select
                disabled={busy || frozenLearning}
                aria-label="Drill"
                value={mode}
                onChange={(e) => onMode(e.target.value as typeof mode)}
              >
                <option value="scripted">Original Night Watch · legacy</option>
                <option value="library">Scripted / Library</option>
                <option value="adaptive">Adaptive / Skill practice</option>
              </select>
            </label>
            {mode === "adaptive" && (
              <label>
                {frozenLearning ? "Curriculum seed" : "Director seed"}
                <input
                  disabled={busy || frozenLearning}
                  type="number"
                  min={0}
                  max={4294967295}
                  value={seed}
                  onChange={(e) =>
                    onSeed(
                      Math.max(
                        0,
                        Math.min(
                          4294967295,
                          Math.trunc(Number(e.target.value) || 0),
                        ),
                      ),
                    )
                  }
                />
              </label>
            )}
            <label>
              Conditions
              {mode === "adaptive" && (
                <small>
                  {" "}
                  · {frozenLearning ? "Frozen curriculum" : "Director selected"}
                </small>
              )}
              <select
                aria-label="Conditions"
                disabled={busy || frozenLearning || mode !== "scripted"}
                title={
                  mode === "adaptive"
                    ? "Conditions are selected by the Director."
                    : mode === "library"
                      ? "Conditions are frozen in the saved scenario."
                      : undefined
                }
                value={night ? "night" : "day"}
                onChange={(e) => onNight(e.target.value === "night")}
              >
                <option value="night">Night · light fog</option>
                <option value="day">Day · light fog</option>
              </select>
            </label>
            <button
              className="text-button"
              disabled={busy || frozenLearning || mode === "library"}
              title={
                mode === "library"
                  ? "The library scenario has a frozen seed."
                  : undefined
              }
              onClick={() => onSeed(nextTrainingSeed(seed))}
            >
              <RotateCcw size={14} /> New seed
            </button>
          </div>
        </details>
      }
      {
        <>
          <details className="evidence-disclosure" id="director-profile">
            <summary>Skill evidence & history</summary>
            <ProfilePanel profile={profile} />
          </details>
          {mode === "adaptive" && prepared?.director_decision && (
            <details className="evidence-disclosure director-selection">
              <summary>
                Training focus ·{" "}
                {prepared.director_decision.focus_skill.replaceAll("_", " ")}
              </summary>
              <DirectorCard decision={prepared.director_decision} busy={busy} />
            </details>
          )}
          {mode === "adaptive" && prepared?.director_v2 && (
            <details className="panel evidence-disclosure">
              <summary>Director selection evidence</summary>
              <h3>Procedural Director v2</h3>
              <p>
                {prepared.director_v2.basis}. Family:{" "}
                {prepared.director_v2.family}.
              </p>
              <p>
                Baseline comparison:{" "}
                {prepared.director_v2.baseline_comparison.focus_skill} /{" "}
                {prepared.director_v2.baseline_comparison.difficulty_label}.
              </p>
              {Object.entries(prepared.director_v2.skill_evidence).map(
                ([skill, e]) => (
                  <p key={skill}>
                    {skill}: uncertainty {e.beta_standard_deviation.toFixed(3)},
                    recent progress {e.learning_progress.toFixed(3)}, retention
                    gap {e.retention_gap.toFixed(2)}
                  </p>
                ),
              )}
              <p className="footnote">
                {prepared.director_v2.limitations.join("; ")}.
              </p>
            </details>
          )}
        </>
      }
      {mode === "library" && (
        <section className="panel advanced-card">
          <h2>Scripted exercise</h2>
          <label>
            Scenario library
            <select
              disabled={busy || frozenLearning}
              aria-label="Scenario library"
              value={libraryId}
              onChange={(e) => onLibrary(e.target.value)}
            >
              {library.map((s) => (
                <option key={s.id} value={s.id}>
                  {[
                    s.title,
                    s.doctrine?.name,
                    s.red_force?.tactic?.replaceAll("_", " "),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </option>
              ))}
            </select>
          </label>
          {!library.length && (
            <p>
              No saved exercises. <a href="/exercises">Open exercise studio</a>.
            </p>
          )}
        </section>
      )}
    </>
  );
}
