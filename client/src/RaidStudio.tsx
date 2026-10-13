import { useState } from "react";
import { api } from "./storage";
import { defaultResponseConfig } from "./response-v2";
import type { Scenario } from "./types";
export default function RaidStudio({
  onSaved,
}: { onSaved?: (scenario: Scenario) => void } = {}) {
  const [delayed, setDelayed] = useState(true);
  const [fusionMode, setFusionMode] = useState("off");
  const [seed, setSeed] = useState(482913),
    [duration, setDuration] = useState(90),
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
  const configurationKey = JSON.stringify({
    delayed,
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
    setBusy(true);
    setError("");
    setSaved(false);
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
      className="panel advanced-card composer-workbench"
      id="raid-composer"
    >
      <h2>Finale Raid Composer · engine 0.4</h2>
      <p>
        Compile seeded rosters, coordinated formations and motion into a frozen
        exercise. Values are illustrative training assumptions.
      </p>
      <fieldset className="setup-bar raid-controls" disabled={busy}>
        <legend>Raid configuration</legend>
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
                  Math.min(4294967295, Math.trunc(Number(e.target.value) || 0)),
                ),
              )
            }
          />
        </label>
        <label>
          Duration (seconds)
          <input
            type="number"
            min={60}
            max={180}
            value={duration}
            onChange={(e) =>
              setDuration(
                Math.max(
                  60,
                  Math.min(180, Math.trunc(Number(e.target.value) || 60)),
                ),
              )
            }
          />
        </label>
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
          <select value={family} onChange={(e) => setFamily(e.target.value)}>
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
        <label>
          Terrain
          <select value={terrain} onChange={(e) => setTerrain(e.target.value)}>
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
              setFog(Math.max(0, Math.min(0.8, Number(e.target.value) || 0)))
            }
          />
        </label>
      </fieldset>
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
      {error && <p role="alert">{error}</p>}
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
          {saved && (
            <a className="button subtle" href="/">
              Open training ground
            </a>
          )}
          <p>Fingerprint {scenario.raid?.fingerprint}</p>
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
