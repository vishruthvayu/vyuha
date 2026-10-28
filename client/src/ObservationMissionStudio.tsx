import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./storage";
import { replay } from "./sim";
import type { Scenario } from "./types";
import {
  initialMissionRequest,
  type CompiledObservationMission,
  type ObservationMissionCatalog,
  type ObservationMissionRequest,
  type ObservationTemplate,
} from "./observation-missions";
const AuthorScene = lazy(() =>
  import("./Scene").then((m) => ({ default: m.Scene })),
);
const seconds = (tick: number) => (tick / 30).toFixed(2);
export default function ObservationMissionStudio() {
  const [catalog, setCatalog] = useState<ObservationMissionCatalog | null>(
      null,
    ),
    [form, setForm] = useState(initialMissionRequest);
  const [compiled, setCompiled] = useState<CompiledObservationMission | null>(
      null,
    ),
    [published, setPublished] = useState<Scenario | null>(null);
  const [busy, setBusy] = useState<false | "compile" | "publish">(false),
    [error, setError] = useState(""),
    [tick, setTick] = useState(0),
    [track, setTrack] = useState("T1"),
    [channel, setChannel] = useState("eo"),
    [reference, setReference] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    let alive = true;
    void api<ObservationMissionCatalog>("/observation-missions/catalog")
      .then((r) => {
        if (alive) setCatalog(r);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
      generation.current++;
    };
  }, []);
  function update<K extends keyof ObservationMissionRequest>(
    key: K,
    value: ObservationMissionRequest[K],
  ) {
    generation.current++;
    setForm((f) => ({ ...f, [key]: value }));
    setCompiled(null);
    setPublished(null);
    setBusy(false);
    setError("");
  }
  async function compile() {
    const request = ++generation.current;
    setBusy("compile");
    setError("");
    setPublished(null);
    try {
      const result = await api<CompiledObservationMission>(
        "/observation-missions/compile",
        form,
        120000,
      );
      if (request !== generation.current) return;
      setCompiled(result);
      setTick(0);
      setTrack(result.scenario.tracks[0].id);
    } catch (e) {
      if (request === generation.current) setError((e as Error).message);
    } finally {
      if (request === generation.current) setBusy(false);
    }
  }
  async function publish() {
    if (!compiled) return;
    const request = ++generation.current;
    setBusy("publish");
    setError("");
    try {
      const result = await api<Scenario>(
        "/observation-missions/publish",
        form,
        120000,
      );
      if (request !== generation.current) return;
      if (result.id !== compiled.scenario.id)
        throw Error("Published mission differs from inspected compilation");
      setPublished(result);
    } catch (e) {
      if (request === generation.current) setError((e as Error).message);
    } finally {
      if (request === generation.current) setBusy(false);
    }
  }
  const state = useMemo(
    () =>
      compiled
        ? replay(
            compiled.scenario,
            compiled.rehearsal.request_schedule,
            tick,
          ).snapshot()
        : null,
    [compiled, tick],
  );
  const selected = state?.tracks.find((t) => t.id === track),
    cue = selected?.observation?.radar.position ?? null;
  const template = catalog?.templates.find((t) => t.id === form.template);
  const intervals =
    compiled?.rehearsal.passive_intervals.filter(
      (v) => v.track === track && v.channel === channel && v.active,
    ) ?? [];
  return (
    <main className="observation-mission-studio">
      <header className="oms-introduction">
        <span className="eyebrow">MISSION DESIGN / EVIDENCE CONTRACT 01</span>
        <h1>Author the information problem.</h1>
        <p>
          Design what a trainee must investigate, then inspect an actual request
          schedule under the frozen simulation rules. A possible modeled report
          is not guaranteed human notice or solvability.
        </p>
      </header>
      <section
        className="oms-template-grid"
        aria-label="Choose an observation challenge"
      >
        {catalog?.templates.map((t, i) => (
          <button
            key={t.id}
            aria-pressed={form.template === t.id}
            onClick={() => update("template", t.id as ObservationTemplate)}
          >
            <span>
              0{i + 1} / {t.competencies.join(" · ")}
            </span>
            <h2>{t.title}</h2>
            <p>{t.summary}</p>
          </button>
        ))}
      </section>
      <div className="oms-author-workspace">
        <section
          className="oms-configuration"
          aria-label="Mission authoring controls"
        >
          <header>
            <span className="eyebrow">FROZEN INPUTS</span>
            <h2>{template?.title ?? "Observation mission"}</h2>
          </header>
          <label>
            Mission title
            <input
              value={form.title}
              maxLength={70}
              placeholder="Use the challenge title"
              onChange={(e) => update("title", e.target.value)}
            />
          </label>
          <label>
            Learning objectives
            <textarea
              rows={4}
              value={(form.objectives ?? template?.objectives ?? []).join("\n")}
              onChange={(e) => update("objectives", e.target.value.split("\n"))}
            />
          </label>
          <div className="oms-field-pair">
            <label>
              Reproducible seed
              <input
                type="number"
                min={0}
                max={4294967295}
                value={form.seed}
                onChange={(e) => update("seed", Number(e.target.value))}
              />
            </label>
            <label>
              Duration (seconds)
              <input
                type="number"
                min={60}
                max={120}
                value={form.duration}
                onChange={(e) => update("duration", Number(e.target.value))}
              />
            </label>
          </div>
          <label>
            Training evidence mode
            <select
              value={form.mode}
              onChange={(e) =>
                update("mode", e.target.value as typeof form.mode)
              }
            >
              <option value="practice">
                Guided practice · separate evidence
              </option>
              <option value="assessment">
                Independent software form · no live Fusion advice
              </option>
            </select>
          </label>
          <div className="oms-field-pair">
            <label>
              Environment
              <select
                value={form.terrain ?? ""}
                onChange={(e) =>
                  update(
                    "terrain",
                    e.target.value
                      ? (e.target.value as "urban" | "rural")
                      : null,
                  )
                }
              >
                <option value="">Challenge default</option>
                <option value="urban">Urban outpost</option>
                <option value="rural">Rural forward base</option>
              </select>
            </label>
            <label>
              Light conditions
              <select
                value={form.night === null ? "" : String(form.night)}
                onChange={(e) =>
                  update(
                    "night",
                    e.target.value === "" ? null : e.target.value === "true",
                  )
                }
              >
                <option value="">Challenge default</option>
                <option value="false">Day</option>
                <option value="true">Night</option>
              </select>
            </label>
          </div>
          <div className="oms-field-pair">
            <label>
              Fog (modeled)
              <input
                type="number"
                min={0}
                max={0.8}
                step={0.05}
                value={form.fog ?? ""}
                placeholder={String(template?.default_conditions.fog ?? 0.15)}
                onChange={(e) =>
                  update(
                    "fog",
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
              />
            </label>
            <label>
              Extra distractor contacts
              <select
                value={form.extra_contacts}
                onChange={(e) =>
                  update("extra_contacts", Number(e.target.value))
                }
              >
                <option value={0}>Default roster</option>
                <option value={1}>One extra bird</option>
                <option value={2}>Two extra birds</option>
              </select>
            </label>
          </div>
          <div className="oms-field-pair">
            <label>
              Optical dwell (ticks)
              <input
                type="number"
                min={15}
                max={150}
                value={form.dwell_ticks}
                onChange={(e) => update("dwell_ticks", Number(e.target.value))}
              />
            </label>
            <label>
              Evidence lifetime (ticks)
              <input
                type="number"
                min={30}
                max={600}
                value={form.expiry_ticks ?? ""}
                placeholder="Challenge default"
                onChange={(e) =>
                  update(
                    "expiry_ticks",
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
              />
            </label>
          </div>
          <p>
            30 ticks = one logical second. Missing or expired optics do not by
            themselves invalidate positive RF/IFF evidence. Extra requests never
            award mastery.
          </p>
          <button
            className="button primary"
            disabled={!!busy}
            onClick={() => void compile()}
          >
            {busy === "compile"
              ? "Reconstructing authored conditions…"
              : "Compile and rehearse"}
          </button>
          {error && <p role="alert">{error}</p>}
        </section>
        <section className="oms-rehearsal" aria-label="Frozen author rehearsal">
          {compiled && state ? (
            <>
              <header>
                <div>
                  <span className="eyebrow">
                    AUTHOR-ONLY /{" "}
                    {reference ? "REFERENCE WORLD" : "PROBE OBSERVATIONS"}
                  </span>
                  <h2>Inspect the evidence opportunity.</h2>
                </div>
                <span>T+{seconds(tick)}s</span>
              </header>
              <div className="oms-world">
                <Suspense
                  fallback={<p>Loading local synthetic environment…</p>}
                >
                  <AuthorScene
                    state={state}
                    selected={track}
                    onFps={() => {}}
                    vision={channel === "ir" ? "thermal" : "day"}
                    fallback={
                      <p>
                        3D unavailable. Exact report intervals and publication
                        ledger remain below.
                      </p>
                    }
                    terrain={compiled.scenario.terrain_id}
                    terrainBoxes={compiled.scenario.terrain_boxes}
                    sensorConfig={compiled.scenario.sensor_config}
                    engineVersion={compiled.scenario.engine_version}
                    fog={compiled.scenario.fog}
                    groundTruth={reference}
                    cue={cue}
                    visibilityKey={compiled.scenario.id}
                  />
                </Suspense>
              </div>
              <div className="oms-inspect-controls">
                <label>
                  Contact
                  <select
                    value={track}
                    onChange={(e) => setTrack(e.target.value)}
                  >
                    {compiled.scenario.tracks.map((t) => (
                      <option key={t.id}>{t.id}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Observation channel
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value)}
                  >
                    {["eo", "ir", "radar", "rf", "iff"].map((c) => (
                      <option key={c} value={c}>
                        {c.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="oms-reference-toggle">
                  <input
                    type="checkbox"
                    checked={reference}
                    onChange={(e) => setReference(e.target.checked)}
                  />
                  Author reference world · canonical geometry
                </label>
              </div>
              <label className="oms-seek">
                Author reconstruction time
                <input
                  type="range"
                  min={0}
                  max={compiled.scenario.duration * 30}
                  value={tick}
                  onChange={(e) => setTick(Number(e.target.value))}
                />
              </label>
              <p className="oms-probe-disclaimer">
                This world follows one deterministic author probe. It is never
                copied into a trainee session. EO/IR intervals represent
                released probe observations; radar/RF/IFF remain passive.
              </p>
              <div
                className="oms-intervals"
                aria-label="Modeled report intervals"
              >
                {intervals.map((v, i) => (
                  <button
                    key={i}
                    onClick={() => setTick(v.start_tick)}
                    data-available={v.available}
                    aria-current={
                      v.start_tick <= tick && tick < v.end_tick
                        ? "true"
                        : undefined
                    }
                  >
                    <span>
                      T+{seconds(v.start_tick)}–{seconds(v.end_tick)}s
                    </span>
                    <strong>{v.available ? v.state : "Unavailable"}</strong>
                  </button>
                ))}
              </div>
              <section
                className="oms-compiler-checks"
                aria-label="Compiler opportunity checks"
              >
                <h3>Obtainability under this probe</h3>
                {compiled.rehearsal.checks.map((c) => (
                  <p key={c.id}>
                    <b>{c.passed ? "OBSERVED" : "NOT OBSERVED"}</b>{" "}
                    {c.description}
                  </p>
                ))}
                <p>
                  {compiled.rehearsal.attainable_probe
                    ? "The intended modeled opportunities occurred in this schedule."
                    : "One or more intended opportunities were not observed; review conditions before publishing."}{" "}
                  This is not a human-solvability certificate.
                </p>
              </section>
              <details>
                <summary>Request, sample and publication ledger</summary>
                <ol>
                  {compiled.rehearsal.results.map((r) => (
                    <li key={r.id}>
                      <button
                        onClick={() => {
                          setTrack(r.trackId);
                          setChannel(r.channel);
                          setTick(r.releaseTick);
                        }}
                      >
                        {r.trackId} / {r.channel.toUpperCase()} · request{" "}
                        {seconds(r.acceptedTick)}s → sample{" "}
                        {seconds(r.sampleTick)}s → release{" "}
                        {seconds(r.releaseTick)}s ·{" "}
                        {r.reading.available ? r.reading.level : "unavailable"}
                      </button>
                    </li>
                  ))}
                </ol>
              </details>
              <footer className="oms-publish">
                <div>
                  <b>{compiled.scenario.id}</b>
                  <p>
                    The complete authored definition, mission policy and engine
                    configuration are frozen into this content hash.
                  </p>
                </div>
                <button
                  className="button primary"
                  disabled={!!busy}
                  onClick={() => void publish()}
                >
                  {busy === "publish"
                    ? "Saving frozen mission…"
                    : "Publish frozen mission"}
                </button>
                {published && (
                  <a
                    className="button primary"
                    href={`/?observation_mission=${encodeURIComponent(published.id)}`}
                  >
                    Open published mission in Training
                  </a>
                )}
              </footer>
            </>
          ) : (
            <div className="oms-empty">
              <span className="eyebrow">COMPILE → INVESTIGATE → PUBLISH</span>
              <h2>Give uncertainty a purpose.</h2>
              <p>
                Choose a challenge and author its evidence conditions. Compile
                to reconstruct a bounded sequence of actual observations,
                compare it with the reference world, and publish one immutable
                mission.
              </p>
              <p>
                Practice and independent evidence stay separate. The original
                outcome rubric remains unchanged.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
