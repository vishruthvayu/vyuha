import { PageHeader } from "./UI";
import { useEffect, useRef, useState } from "react";
import { api } from "./storage";
import { newId, type UnitIdentity } from "./unit-state";
import type { AvailableEvidence } from "./types";
import { ProfilePanel } from "./Director";
import type { TrainingProfile } from "./types";
export type RapidLabel =
  "bird" | "friendly_uav" | "hostile_quad" | "no_rf_fpv" | "fixed_wing";
export const RAPID_LABELS: Record<RapidLabel, string> = {
  bird: "Bird",
  friendly_uav: "Friendly UAV",
  hostile_quad: "Hostile RF quad",
  no_rf_fpv: "No-RF FPV",
  fixed_wing: "Hostile fixed wing",
};
type Round = {
  index: number;
  time_limit_ms: number;
  snapshot_tick: number;
  evidence: AvailableEvidence;
  flight: string;
  briefing: string;
};
type Answer = {
  round_index: number;
  answer: RapidLabel | null;
  round_start_ms: number;
  response_time_ms: number;
};
type Review = Answer & {
  correct_answer: RapidLabel;
  correct: boolean;
  explanation: string;
};
type Rapid = {
  id: string;
  trainee_id: string;
  round_count: number;
  current: Round | null;
  reviews: Review[];
  result: null | {
    rounds: number;
    correct: number;
    accuracy: number;
    median_response_ms: number;
    friendly_false_hostile: number;
    bird_confusion: number;
    most_common_error: string | null;
    profile_mapping: string;
  };
  timing_basis: string;
};
type Draft = {
  start?: {
    request_id: string;
    trainee_id: string;
    seed: number;
    rounds: number;
  };
  session?: Rapid;
  elapsed: number;
  activeStart: number;
  pending?: Answer;
};
export function activeElapsed(
  saved: number,
  started: number | null,
  now: number,
) {
  return Math.min(
    5000,
    Math.max(0, saved + (started === null ? 0 : now - started)),
  );
}
export function Silhouette({
  shape,
}: {
  shape: AvailableEvidence["visual"]["silhouette"];
}) {
  return (
    <svg
      viewBox="0 0 240 100"
      role="img"
      aria-label={`${shape ?? "unavailable"} thermal silhouette`}
      className="rapid-silhouette"
    >
      <rect width="240" height="100" fill="#151d2a" />
      {shape === "bird" ? (
        <path
          d="M22 40 Q70 10 120 57 Q170 10 218 40 Q158 24 120 68 Q80 25 22 40"
          fill="#edf3ec"
        />
      ) : shape === "fixed_wing" ? (
        <path
          d="M116 10 H124 L130 40 L220 60 V69 L130 54 L126 85 L156 92 H84 L114 85 L110 54 L20 69 V60 L110 40 Z"
          fill="#edf3ec"
        />
      ) : shape === "multirotor" ? (
        <g stroke="#edf3ec" strokeWidth="5" fill="none">
          <path d="M80 30 L160 70 M160 30 L80 70" />
          <ellipse cx="80" cy="30" rx="28" ry="9" />
          <ellipse cx="160" cy="30" rx="28" ry="9" />
          <ellipse cx="80" cy="70" rx="28" ry="9" />
          <ellipse cx="160" cy="70" rx="28" ry="9" />
          <rect x="108" y="40" width="24" height="20" fill="#edf3ec" />
        </g>
      ) : (
        <text x="25" y="55" fill="white">
          No modeled observation
        </text>
      )}
    </svg>
  );
}
export default function RapidID({ identity }: { identity?: UnitIdentity }) {
  const trainee = identity?.trainee_id ?? "CADET-01",
    importedSession = new URLSearchParams(window.location.search).get(
      "session",
    ),
    key = `vyuha-rapid-v1:${trainee}${importedSession ? ":" + importedSession : ""}`;
  const initial = () => {
    try {
      return JSON.parse(localStorage.getItem(key) || "null") as Draft | null;
    } catch {
      return null;
    }
  };
  const d = useRef<Draft>(initial() ?? { elapsed: 0, activeStart: 0 });
  const [session, setSession] = useState<Rapid | null>(
      d.current.session ?? null,
    ),
    [paused, setPaused] = useState(true),
    [elapsed, setElapsed] = useState(d.current.elapsed),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [roundCount, setRoundCount] = useState(15),
    [profile, setProfile] = useState<TrainingProfile | null>(null);
  const clock = useRef<number | null>(null),
    sending = useRef(false),
    pausedRef = useRef(true);
  pausedRef.current = paused;
  function persist() {
    localStorage.setItem(key, JSON.stringify(d.current));
  }
  function elapsedNow() {
    return activeElapsed(d.current.elapsed, clock.current, performance.now());
  }
  function pause() {
    d.current.elapsed = elapsedNow();
    clock.current = null;
    persist();
    setElapsed(d.current.elapsed);
    setPaused(true);
  }
  function resume() {
    if (busy || d.current.pending) return;
    clock.current = performance.now();
    setPaused(false);
  }
  async function sync() {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError("");
    try {
      const draft = d.current;
      let next = draft.session;
      if (!next && draft.start)
        next = await api<Rapid>("/rapid-id", draft.start);
      if (!next) throw new Error("Start a session first");
      if (draft.pending)
        next = await api<Rapid>(`/rapid-id/${next.id}/answers`, draft.pending);
      else next = await api<Rapid>(`/rapid-id/${next.id}`);
      if (next.trainee_id !== trainee)
        throw new Error("This Rapid ID session belongs to another trainee");
      const advanced =
        next.reviews.length > (draft.session?.reviews.length ?? 0);
      if (draft.pending && advanced) {
        draft.activeStart =
          draft.pending.round_start_ms + draft.pending.response_time_ms;
        draft.elapsed = 0;
        delete draft.pending;
      }
      draft.session = next;
      persist();
      setSession(next);
      setElapsed(draft.elapsed);
      if (next.result) {
        setPaused(true);
        clock.current = null;
        setProfile(await api<TrainingProfile>(`/trainees/${trainee}/profile`));
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Server unavailable. Answer retained for retry.",
      );
      setPaused(true);
      clock.current = null;
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  async function start() {
    pause();
    d.current = {
      elapsed: 0,
      activeStart: 0,
      start: {
        request_id: newId(),
        trainee_id: trainee,
        seed: crypto.getRandomValues(new Uint32Array(1))[0],
        rounds: roundCount,
      },
    };
    persist();
    setSession(null);
    await sync();
  }
  function answer(label: RapidLabel | null) {
    if (
      !session?.current ||
      pausedRef.current ||
      sending.current ||
      d.current.pending
    )
      return;
    const ms = Math.round(elapsedNow());
    clock.current = null;
    d.current.elapsed = ms;
    d.current.pending = {
      round_index: session.current.index,
      answer: ms >= 5000 ? null : label,
      round_start_ms: d.current.activeStart,
      response_time_ms: ms >= 5000 ? 5000 : ms,
    };
    persist();
    setPaused(true);
    void sync();
  }
  useEffect(() => {
    const timer = setInterval(() => {
      if (clock.current === null) return;
      const ms = elapsedNow();
      setElapsed(ms);
      d.current.elapsed = ms;
      clock.current = performance.now();
      persist();
      if (ms >= 5000) answer(null);
    }, 50);
    return () => clearInterval(timer);
  }, [session?.current?.index]);
  useEffect(() => {
    const visibility = () => {
      if (document.hidden) pause();
    };
    document.addEventListener("visibilitychange", visibility);
    const unload = () => pause();
    window.addEventListener("pagehide", unload);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", unload);
    };
  }, []);
  useEffect(() => {
    if (d.current.start || d.current.session) void sync();
    else if (importedSession)
      void api<Rapid>(`/rapid-id/${importedSession}`)
        .then((s) => {
          if (s.trainee_id !== trainee)
            throw new Error("Evaluation belongs to another trainee");
          d.current = {
            session: s,
            elapsed: 0,
            activeStart: s.reviews.reduce((n, r) => n + r.response_time_ms, 0),
          };
          persist();
          setSession(s);
          void sync();
        })
        .catch((e) => setError(e.message));
  }, []);
  const round = session?.current,
    last = session?.reviews.at(-1),
    result = session?.result;
  return (
    <main className="instructor-page advanced-page">
      <PageHeader
        eyebrow="CLASSIFICATION / IFF"
        title="Rapid ID"
        description={`Short recognition practice · ${identity?.callsign ?? trainee}`}
        actions={
          <nav className="advanced-nav">
            <a href="/">Tactical training</a>
            <a href="/analytics">Training history</a>
            <a href="/evaluation">Evaluation protocol</a>
          </nav>
        }
      />
      <p>
        Visuals represent the simulator’s observed silhouette. Quad and FPV
        share a multirotor silhouette; use RF evidence. Identity briefings are
        exercise cues. No IFF reply alone does not establish hostility.
      </p>
      {error && (
        <div className="recovery-banner" role="alert">
          {error}{" "}
          <button
            className="button subtle"
            disabled={busy}
            title={busy ? "A server request is in progress." : undefined}
            onClick={() => void sync()}
          >
            Retry saved answer
          </button>
        </div>
      )}
      {!session && (
        <section className="panel advanced-card">
          <h2>Recognition session</h2>
          <label>
            Rounds{" "}
            <select
              value={roundCount}
              onChange={(e) => setRoundCount(Number(e.target.value))}
            >
              {[10, 15, 20].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <p>
            Five active seconds per round. Pause or switching tabs stops the
            clock. Reload returns paused; a pending answer keeps its original
            payload.
          </p>
          <button
            className="button primary"
            disabled={busy}
            title={busy ? "A server request is in progress." : undefined}
            onClick={() => void start()}
          >
            Start Rapid ID
          </button>
          {d.current.start && (
            <button className="button subtle" onClick={() => void sync()}>
              Resume saved session
            </button>
          )}
        </section>
      )}
      {round && (
        <section className="panel advanced-card rapid-card">
          <div className="page-heading">
            <h2>
              Round {round.index + 1} / {session!.round_count}
            </h2>
            <strong role="timer">
              {((5000 - elapsed) / 1000).toFixed(1)} seconds
            </strong>
          </div>
          <Silhouette
            shape={
              round.evidence.visual.available
                ? round.evidence.visual.silhouette
                : null
            }
          />
          <p>{round.briefing}</p>
          <dl className="ghost-evidence">
            <div>
              <dt>Radar</dt>
              <dd>
                {round.evidence.radar.state} ·{" "}
                {round.evidence.radar.detected
                  ? "return observed"
                  : "no return"}
              </dd>
            </div>
            <div>
              <dt>RF</dt>
              <dd>
                {round.evidence.rf.signal
                  ? "Control link detected"
                  : "No control link detected"}
              </dd>
            </div>
            <div>
              <dt>IFF</dt>
              <dd>
                {round.evidence.rf.iff === "friendly_reply"
                  ? "Friendly reply"
                  : "No reply"}
              </dd>
            </div>
            <div>
              <dt>Flight</dt>
              <dd>{round.flight}</dd>
            </div>
          </dl>
          <div className="control-buttons">
            {Object.entries(RAPID_LABELS).map(([id, label]) => (
              <button
                key={id}
                className="button subtle"
                disabled={paused || busy}
                title={
                  busy
                    ? "Saving the current answer."
                    : paused
                      ? "Begin or resume this round first."
                      : undefined
                }
                onClick={() => answer(id as RapidLabel)}
              >
                {label}
              </button>
            ))}
          </div>
          <p>
            <button
              className="button primary"
              disabled={busy || !!d.current.pending}
              title={
                busy
                  ? "A request is in progress."
                  : d.current.pending
                    ? "Synchronize the saved answer before resuming."
                    : undefined
              }
              onClick={paused ? resume : pause}
            >
              {paused ? "Begin / resume round" : "Pause round"}
            </button>
          </p>
          {last && (
            <p className={last.correct ? "status" : "amber-text"}>
              Previous round: {last.correct ? "Correct" : "Review"} ·{" "}
              {RAPID_LABELS[last.correct_answer]} ·{" "}
              {(last.response_time_ms / 1000).toFixed(2)}s
            </p>
          )}
        </section>
      )}
      {result && (
        <>
          <section className="panel advanced-card">
            <h2>Rapid ID review · Server verified answers</h2>
            <div className="ghost-skill-grid">
              <div>
                Accuracy
                <strong>
                  {result.correct} / {result.rounds} ·{" "}
                  {Math.round(result.accuracy * 100)}%
                </strong>
              </div>
              <div>
                Median response
                <strong>
                  {(result.median_response_ms / 1000).toFixed(2)}s
                </strong>
              </div>
              <div>
                Friendly false-hostile
                <strong>{result.friendly_false_hostile}</strong>
              </div>
              <div>
                Bird confusion<strong>{result.bird_confusion}</strong>
              </div>
            </div>
            <p>Most common error: {result.most_common_error ?? "None"}</p>
            <p>{result.profile_mapping}</p>
            <p>{session!.timing_basis}</p>
            <button className="button primary" onClick={() => void start()}>
              New recognition session
            </button>
          </section>
          <ProfilePanel profile={profile} />
        </>
      )}
      {!!session?.reviews.length && (
        <section className="panel advanced-card">
          <h2>Round review</h2>
          {session.reviews.map((r) => (
            <details key={r.round_index}>
              <summary>
                Round {r.round_index + 1}: {r.correct ? "Correct" : "Incorrect"}{" "}
                · {RAPID_LABELS[r.correct_answer]} ·{" "}
                {(r.response_time_ms / 1000).toFixed(2)}s
              </summary>
              <p>
                Your answer: {r.answer ? RAPID_LABELS[r.answer] : "Timeout"}.{" "}
                {r.explanation}
              </p>
            </details>
          ))}
        </section>
      )}
    </main>
  );
}
