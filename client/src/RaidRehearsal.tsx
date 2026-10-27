import { useId, useMemo, useState } from "react";
import {
  buildRaidRehearsal,
  referenceTrackAt,
  waveSeek,
} from "./raid-rehearsal";
import { KIND_LABEL, type Scenario } from "./types";

/** A compiled reference-world planning view, isolated from trainee observations. */
export function RaidRehearsal({ scenario }: { scenario: Scenario }) {
  const [tick, setTick] = useState(0),
    [selected, setSelected] = useState("");
  const id = useId();
  const result = useMemo(() => {
    try {
      return { model: buildRaidRehearsal(scenario), error: "" };
    } catch (e) {
      return { model: null, error: (e as Error).message };
    }
  }, [scenario]);
  const model = result.model;
  if (!model)
    return (
      <p className="raid-rehearsal-unavailable">
        Reference rehearsal unavailable. {result.error} The original compiled
        result is retained.
      </p>
    );
  const at = Math.min(tick, model.endTick),
    subject = model.paths.find((p) => p.track.id === selected);
  const scale = 230 / model.radius;
  const project = (p: { x: number; z: number }) =>
    `${256 + p.x * scale},${256 - p.z * scale}`;
  const waveTicks = model.waves.map((w) => w.tick);
  const seek = (next: number) =>
    setTick(Math.max(0, Math.min(model.endTick, Math.round(next))));
  return (
    <section className="raid-rehearsal" aria-labelledby={`${id}-heading`}>
      <header>
        <div>
          <span className="eyebrow">02 / SPATIAL & TEMPORAL REHEARSAL</span>
          <h3 id={`${id}-heading`}>Inspect the exercise before publishing</h3>
        </div>
        <strong className="raid-truth-label">
          AUTHOR REFERENCE · ALL PLANNED CONTACTS
        </strong>
      </header>
      <p id={`${id}-scope`}>
        This planning view reveals the frozen roster and analytic paths. It does
        not simulate sensor reports, instructor interventions, response effects
        or scores. A geometric approach window does not establish trainee
        detectability or human solvability.
      </p>
      <div className="raid-rehearsal-workspace">
        <div className="raid-reference-map">
          <svg
            viewBox="0 0 512 512"
            role="group"
            aria-label="North-up reference paths"
            aria-describedby={`${id}-scope`}
          >
            <rect width="512" height="512" fill="#0d1c25" />
            {[0.25, 0.5, 0.75, 1].map((r) => (
              <circle
                key={r}
                cx="256"
                cy="256"
                r={230 * r}
                fill="none"
                stroke="#39545e"
                strokeDasharray="3 6"
              />
            ))}
            <path d="M256 20V492M20 256H492" stroke="#486373" strokeWidth="1" />
            <text x="256" y="18" textAnchor="middle">
              N
            </text>
            <text x="490" y="249" textAnchor="end">
              E
            </text>
            <text x="256" y="509" textAnchor="middle">
              S
            </text>
            <text x="20" y="249">
              W
            </text>
            {model.paths.map(({ track, points }) => (
              <polyline
                key={track.id}
                points={points.map(project).join(" ")}
                fill="none"
                stroke={track.id === selected ? "#f0d494" : "#8ba5ae"}
                opacity={track.id === selected ? 1 : 0.35}
                strokeWidth={track.id === selected ? 2.5 : 1.2}
                strokeDasharray={
                  track.identity === "hostile" ? undefined : "4 5"
                }
              />
            ))}
            <rect x="250" y="250" width="12" height="12" fill="#d8e5dd" />
            <text x="267" y="275">
              Protected asset
            </text>
            {model.paths.map(({ track }) => {
              const p = referenceTrackAt(track, at),
                x = 256 + p.x * scale,
                y = 256 - p.z * scale;
              if (!p.scheduled || p.nearAsset) return null;
              return (
                <g
                  key={track.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Inspect reference ${track.id}: ${KIND_LABEL[track.kind]}, ${track.identity}`}
                  aria-pressed={selected === track.id}
                  onClick={() => setSelected(track.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected(track.id);
                    }
                  }}
                >
                  <circle cx={x} cy={y} r={22} fill="transparent" />
                  <circle
                    cx={x}
                    cy={y}
                    r={track.id === selected ? 8 : 6}
                    fill={track.id === selected ? "#f0d494" : "#bdd3d8"}
                    stroke="#0b1720"
                    strokeWidth="2"
                  />
                  <text x={x + 9} y={y - 7}>
                    {track.id}
                  </text>
                </g>
              );
            })}
          </svg>
          <div className="raid-map-caption">
            <span>Analytic paths · nominal truth</span>
            <span>Outer ring {Math.round(model.radius)} m</span>
          </div>
          <div className="raid-rehearsal-transport">
            <label htmlFor={`${id}-time`}>
              Reference time{" "}
              <output>
                {(at / 30).toFixed(2)} / {scenario.duration} s
              </output>
            </label>
            <input
              id={`${id}-time`}
              type="range"
              min={0}
              max={model.endTick}
              step={1}
              value={at}
              onChange={(e) => seek(Number(e.target.value))}
            />
            <div>
              <button type="button" onClick={() => seek(0)}>
                Beginning
              </button>
              <button
                type="button"
                disabled={!waveTicks.some((t) => t < at)}
                onClick={() => seek(waveSeek(waveTicks, at, -1))}
              >
                Previous wave
              </button>
              <button
                type="button"
                disabled={!waveTicks.some((t) => t > at)}
                onClick={() => seek(waveSeek(waveTicks, at, 1))}
              >
                Next wave
              </button>
            </div>
          </div>
        </div>
        <div className="raid-rehearsal-inspector">
          <section aria-label="Wave schedule">
            <h4>Wave schedule</h4>
            {model.waves.length ? (
              model.waves.map((w) => (
                <button
                  type="button"
                  key={w.index}
                  onClick={() => seek(w.tick)}
                >
                  <span>T+{(w.tick / 30).toFixed(1)} s</span>
                  <strong>{w.role.replaceAll("_", " ")}</strong>
                  <small>{w.contacts.length} contacts</small>
                </button>
              ))
            ) : (
              <p>No scheduled waves were supplied.</p>
            )}
          </section>
          <section aria-label="Reference roster">
            <h4>Reference roster</h4>
            <div className="raid-reference-roster">
              {model.paths.map(({ track }) => (
                <button
                  type="button"
                  key={track.id}
                  aria-pressed={selected === track.id}
                  onClick={() => setSelected(track.id)}
                >
                  <strong>{track.id}</strong>
                  <span>
                    {KIND_LABEL[track.kind]} · {track.identity}
                  </span>
                  <small>T+{(track.spawn / 30).toFixed(1)}s</small>
                </button>
              ))}
            </div>
          </section>
          <section
            className="raid-reference-properties"
            aria-label="Selected reference contact"
          >
            {subject ? (
              <>
                <h4>{subject.track.id} · author reference</h4>
                <button type="button" onClick={() => seek(subject.track.spawn)}>
                  Jump to spawn
                </button>
                <dl>
                  <div>
                    <dt>Type / identity</dt>
                    <dd>
                      {KIND_LABEL[subject.track.kind]} /{" "}
                      {subject.track.identity}
                    </dd>
                  </div>
                  <div>
                    <dt>Motion</dt>
                    <dd>
                      {subject.track.motion?.primitive.replaceAll("_", " ")}
                    </dd>
                  </div>
                  <div>
                    <dt>Start bearing / altitude</dt>
                    <dd>
                      {subject.track.bearing}° / {subject.track.altitude} m
                    </dd>
                  </div>
                  <div>
                    <dt>Speed / RF link</dt>
                    <dd>
                      {subject.track.speed} m/s /{" "}
                      {subject.track.rf ? "present" : "absent"}
                    </dd>
                  </div>
                  <div>
                    <dt>Reference at this time</dt>
                    <dd>
                      {at < subject.track.spawn
                        ? "Not yet scheduled"
                        : !referenceTrackAt(subject.track, at).scheduled
                          ? "Schedule ended"
                          : referenceTrackAt(subject.track, at).nearAsset
                            ? "At asset approach; no outcome inferred"
                            : `${Math.round(Math.hypot(referenceTrackAt(subject.track, at).x, referenceTrackAt(subject.track, at).z))} m from asset`}
                    </dd>
                  </div>
                </dl>
                {subject.responseWindow && (
                  <p className="raid-geometric-window">
                    <strong>Server geometric check:</strong> first eligible tick
                    T+{(subject.responseWindow.firstTick / 30).toFixed(2)}s;
                    last T+{(subject.responseWindow.lastTick / 30).toFixed(2)}s;{" "}
                    {(subject.responseWindow.usableTicks / 30).toFixed(2)}s of
                    qualifying geometry in total. There may be gaps between
                    first and last. This is not an observed sensor window or a
                    guaranteed opportunity to act.
                  </p>
                )}
                <p>
                  Compiled paths are frozen. Change the exercise properties and
                  compile again to produce a new scenario.
                </p>
              </>
            ) : (
              <p>
                Select a roster entry to inspect its timing, path and reference
                properties.
              </p>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}
