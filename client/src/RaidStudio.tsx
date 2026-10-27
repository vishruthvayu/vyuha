import { useId, useRef, useState } from "react";
import { api } from "./storage";
import { defaultResponseConfig } from "./response-v2";
import type { Scenario } from "./types";
import { RaidRehearsal, type ReferenceInspection } from "./RaidRehearsal";
import EpisodeOpportunities from "./EpisodeOpportunities";
import {
  RAID_PROFILES,
  initialRaidRoster,
  rosterMix,
  type RaidRoster,
} from "./raid-rehearsal";
export default function RaidStudio({
  onSaved,
}: { onSaved?: (scenario: Scenario) => void } = {}) {
  const [delayed, setDelayed] = useState(true);
  const [fusionMode, setFusionMode] = useState("off");
  const [seed, setSeed] = useState(482913),
    [durationDraft, setDurationDraft] = useState("90"),
    [difficulty, setDifficulty] = useState("standard"),
    [family, setFamily] = useState(""),
    [night, setNight] = useState(false),
    [fog, setFog] = useState(0.15),
    [terrain, setTerrain] = useState("urban"),
    [name, setName] = useState("Procedural local raid"),
    [scenario, setScenario] = useState<Scenario | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false),
    [compiledKey, setCompiledKey] = useState("");
  const [referenceInspection, setReferenceInspection] =
    useState<ReferenceInspection | null>(null);
  const [focus, setFocus] = useState("effector_choice");
  const [exactRoster, setExactRoster] = useState(false);
  const [roster, setRoster] = useState<RaidRoster>({ ...initialRaidRoster });
  const [sectorDraft, setSectorDraft] = useState("90");
  const [durationError, setDurationError] = useState("");
  const durationInput = useRef<HTMLInputElement>(null);
  const durationErrorId = `${useId()}-duration-error`;
  const duration = Number(durationDraft);
  const validDuration =
    durationDraft.trim() !== "" &&
    Number.isInteger(duration) &&
    duration >= 60 &&
    duration <= 180;
  const durationMessage =
    "Enter a whole-number duration from 60 to 180 seconds.";
  const configurationKey = JSON.stringify({
    delayed,
    focus,
    exactRoster,
    roster,
    sectorDraft,
    fusionMode,
    seed,
    duration,
    difficulty,
    family,
    night,
    fog,
    terrain,
    name,
  });
  const stale = !!scenario && compiledKey !== configurationKey;
  async function generate(save = false) {
    if (!validDuration) {
      setDurationError(durationMessage);
      durationInput.current?.focus();
      return;
    }
    let mix: ReturnType<typeof rosterMix> | null = null;
    const sector = Number(sectorDraft);
    try {
      if (exactRoster) mix = rosterMix(roster);
      if (
        family === "BLIND_SECTOR" &&
        (sectorDraft.trim() === "" ||
          !Number.isFinite(sector) ||
          sector < 0 ||
          sector >= 360)
      )
        throw new Error(
          "Weak-sector bearing must be from 0 up to, but not including, 360 degrees.",
        );
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const body = {
        response_model: delayed ? defaultResponseConfig : null,
        schema_version: 2,
        seed,
        duration,
        name,
        difficulty,
        terrain,
        night,
        fog,
        family: family || null,
        focus,
        mix,
        weak_sector_deg: family === "BLIND_SECTOR" ? sector : null,
        fusion:
          fusionMode === "off"
            ? null
            : {
                version: "fusion-1",
                mode: fusionMode === "assessment" ? "assessment" : "training",
                exercise: fusionMode === "bias" ? "rf_overweight" : "normal",
                bias_seed: seed,
              },
      };
      const result = await api<Scenario>(
        save ? "/raids" : "/raids/preview",
        body,
        30000,
      );
      setScenario(result);
      setCompiledKey(configurationKey);
      setSaved(save);
      if (save) onSaved?.(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="panel advanced-card composer-workbench authoring-composer"
      aria-busy={busy}
      id="raid-composer"
    >
      <div className="authoring-section-heading">
        <div>
          <span className="eyebrow">01 / COMPOSE</span>
          <h2>Raid composer</h2>
        </div>
        <span className="authoring-meta">
          Engine 0.4 · seeded & reproducible
        </span>
      </div>
      <p>
        Design a repeatable training challenge, compile its synthetic reference
        world, then rehearse paths and wave timing before publishing. Author
        reference geometry is separate from the trainee’s available sensor
        evidence.
      </p>
      <fieldset className="setup-bar raid-controls" disabled={busy}>
        <legend>Raid configuration</legend>
        <div className="authoring-field-group">
          <h3>Exercise identity</h3>
          <p>Name the exercise and set its repeatable starting conditions.</p>
          <div className="authoring-field-grid">
            <label>
              Name
              <input
                value={name}
                maxLength={70}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              Seed
              <input
                type="number"
                min={0}
                max={4294967295}
                value={seed}
                onChange={(e) =>
                  setSeed(
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
            <label>
              Duration (seconds)
              <input
                ref={durationInput}
                type="number"
                min={60}
                max={180}
                step={1}
                required
                value={durationDraft}
                aria-invalid={durationError ? true : undefined}
                aria-describedby={durationError ? durationErrorId : undefined}
                onChange={(e) => {
                  setDurationDraft(e.target.value);
                  setDurationError("");
                }}
                onBlur={() =>
                  setDurationError(validDuration ? "" : durationMessage)
                }
              />
            </label>
          </div>
        </div>
        <div className="authoring-field-group">
          <h3>Training challenge</h3>
          <p>
            Choose workload, response constraints and the assistance trainees
            receive.
          </p>
          <div className="authoring-field-grid">
            <label>
              Difficulty
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              >
                {["foundational", "standard", "challenging"].map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
            <label>
              Raid family
              <select
                value={family}
                onChange={(e) => setFamily(e.target.value)}
              >
                <option value="">Seeded selection</option>
                {[
                  "DIRECT",
                  "SATURATION",
                  "DECOY_THEN_STRIKE",
                  "STAGGERED_WAVES",
                  "LOW_APPROACH",
                  "SPLIT_SWARM",
                  "PROBE_AND_RETREAT",
                  "BLIND_SECTOR",
                ].map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
            <label>
              Training objective
              <select value={focus} onChange={(e) => setFocus(e.target.value)}>
                <option value="detection">Detection and designation</option>
                <option value="classification_iff">
                  Classification and identity evidence
                </option>
                <option value="effector_choice">Response selection</option>
                <option value="degraded_sensor_response">
                  Degraded-sensor response
                </option>
              </select>
            </label>
            {family === "BLIND_SECTOR" && (
              <label>
                Weak-sector bearing (degrees)
                <input
                  type="number"
                  min={0}
                  max={359.999}
                  step="any"
                  value={sectorDraft}
                  onChange={(e) => setSectorDraft(e.target.value)}
                />
              </label>
            )}
            <label className="authoring-check">
              <input
                type="checkbox"
                checked={delayed}
                onChange={(e) => setDelayed(e.target.checked)}
              />
              Finite resources and delayed effects
            </label>
            <label>
              Fusion mode
              <select
                value={fusionMode}
                onChange={(e) => setFusionMode(e.target.value)}
              >
                <option value="off">Off</option>
                <option value="training">Training advice</option>
                <option value="assessment">Assessment (hidden)</option>
                <option value="bias">Automation-bias exercise</option>
              </select>
            </label>
          </div>
        </div>
        <div className="authoring-field-group">
          <h3>Roster composition</h3>
          <p>
            Choose exact training opportunities or keep the generator’s seeded
            roster. Wave capacity and approach constraints are checked by the
            server.
          </p>
          <div className="authoring-field-grid">
            <label className="authoring-check">
              <input
                type="checkbox"
                checked={exactRoster}
                onChange={(e) => setExactRoster(e.target.checked)}
              />
              Set an exact roster
            </label>
            {exactRoster &&
              RAID_PROFILES.map(([profile, label]) => (
                <label key={profile}>
                  {label}
                  <input
                    type="number"
                    min={0}
                    max={200}
                    step={1}
                    value={roster[profile]}
                    onChange={(e) =>
                      setRoster((previous) => ({
                        ...previous,
                        [profile]: Number(e.target.value),
                      }))
                    }
                  />
                </label>
              ))}
            {exactRoster && (
              <p className="raid-roster-total" role="status">
                {Object.values(roster).reduce((sum, count) => sum + count, 0)}{" "}
                planned contacts · at least two total and one hostile · up to
                200; feasible workload depends on duration and difficulty.
              </p>
            )}
          </div>
        </div>
        <div className="authoring-field-group">
          <h3>Environment</h3>
          <p>Set the terrain and visibility used by the compiled exercise.</p>
          <div className="authoring-field-grid">
            <label>
              Terrain
              <select
                value={terrain}
                onChange={(e) => setTerrain(e.target.value)}
              >
                <option>urban</option>
                <option>rural</option>
              </select>
            </label>
            <label>
              Conditions
              <select
                value={night ? "night" : "day"}
                onChange={(e) => setNight(e.target.value === "night")}
              >
                <option value="day">Day</option>
                <option value="night">Night</option>
              </select>
            </label>
            <label>
              Fog
              <input
                type="number"
                min={0}
                max={0.8}
                step={0.05}
                value={fog}
                onChange={(e) =>
                  setFog(
                    Math.max(0, Math.min(0.8, Number(e.target.value) || 0)),
                  )
                }
              />
            </label>
          </div>
        </div>
      </fieldset>
      {durationError && (
        <p id={durationErrorId} role="alert">
          {durationError}
        </p>
      )}
      <div className="authoring-actions">
        <button
          className="button subtle"
          disabled={busy}
          onClick={() => void generate()}
        >
          {busy ? "Compiling raid…" : "Preview raid"}
        </button>
        <button
          className="button primary"
          disabled={busy}
          onClick={() => void generate(true)}
        >
          Compile and save frozen raid
        </button>
      </div>
      {busy && (
        <p role="status" className="authoring-notice">
          Compiling the seeded exercise. Configuration is held until the server
          responds.
        </p>
      )}
      {error && (
        <p role="alert" className="recovery-banner">
          {error} Your configuration is retained; retry preview or save.
        </p>
      )}
      {stale && (
        <p className="composer-stale" role="status">
          Configuration changed. The result below belongs to the previous
          configuration; preview or compile again to apply your changes.
        </p>
      )}
      {scenario && (
        <section className="composer-preview" aria-label="Compiled raid result">
          <h3>
            {saved ? "Frozen raid saved" : "Raid preview"}
            {stale ? " · previous configuration" : ""}
          </h3>
          <p>
            {scenario.tracks.length} contacts · {scenario.duration}s ·{" "}
            {scenario.raid?.family} · {scenario.engine_version}
          </p>
          <RaidRehearsal
            key={scenario.id}
            scenario={scenario}
            inspection={referenceInspection}
          />
          <EpisodeOpportunities
            scenario={scenario}
            stale={stale}
            onInspect={(moment) => {
              if (stale || moment.scenarioId !== scenario.id) return;
              setReferenceInspection((current) => ({
                ...moment,
                revision: (current?.revision ?? 0) + 1,
              }));
            }}
          />
          {saved && (
            <a className="button subtle" href="/">
              Open training ground
            </a>
          )}
          <details className="authoring-provenance">
            <summary>Reproducibility fingerprint</summary>
            <code>{scenario.raid?.fingerprint}</code>
          </details>
          <p>
            {saved
              ? "Saved. Open Training ground → Scripted / Library, then select this raid."
              : "Preview only; compile and save to add this raid to the library."}
          </p>
          <p className="footnote">
            Geometric response windows validate declared ranges and workload
            bounds. They do not certify sensor reliability or human solvability.
          </p>
        </section>
      )}
    </section>
  );
}
