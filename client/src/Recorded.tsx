import { PageHeader } from "./UI";
import { useEffect, useRef, useState } from "react";
import { api, download } from "./storage";
import { parseJSONImport } from "./import-json";
import {
  recordedState,
  recordedObservations,
  type Recording,
} from "./observations";
import { Radar } from "./Radar";
import { newId, type UnitIdentity } from "./unit-state";
import type { Action, Kind, Identity, Effector } from "./types";
export default function Recorded({ identity }: { identity?: UnitIdentity }) {
  const [list, setList] = useState<{ id: string; title: string }[]>([]),
    [rid, setRid] = useState(""),
    [record, setRecord] = useState<{
      id: string;
      import_hash: string;
      recording: Recording;
    } | null>(null),
    [tick, setTick] = useState(0),
    [playing, setPlaying] = useState(false),
    [track, setTrack] = useState(""),
    [kind, setKind] = useState<Kind>("quad"),
    [category, setCategory] = useState<Identity>("hostile"),
    [effector, setEffector] = useState<Effector>("hold"),
    [actions, setActions] = useState<Action[]>([]),
    [error, setError] = useState(""),
    [result, setResult] = useState<unknown>(null),
    [saving, setSaving] = useState(false);
  const upload = useRef<HTMLInputElement>(null),
    request = useRef(newId()),
    context = useRef(0),
    importRequest = useRef(0),
    pendingSave = useRef(false);
  async function refresh(scope = context.current) {
    const r = await api<{ recordings: { id: string; title: string }[] }>(
      "/recordings",
    );
    if (context.current === scope) setList(r.recordings);
  }
  useEffect(() => {
    const scope = context.current;
    void refresh(scope).catch((e) => {
      if (context.current === scope) setError(e.message);
    });
  }, []);
  function selectRecording(id: string) {
    if (id === rid) return;
    context.current++;
    setRid(id);
    setPlaying(false);
    pendingSave.current = false;
    setSaving(false);
    setRecord(null);
    setTick(0);
    setTrack("");
    setActions([]);
    setResult(null);
    setError("");
    request.current = newId();
  }
  useEffect(() => {
    const scope = context.current;
    let stopped = false;
    if (rid)
      void api<typeof record>(`/recordings/${rid}`)
        .then((r) => {
          if (!stopped && context.current === scope) setRecord(r);
        })
        .catch((e) => {
          if (!stopped && context.current === scope) setError(e.message);
        });
    return () => {
      stopped = true;
    };
  }, [rid]);
  useEffect(
    () => () => {
      context.current++;
    },
    [],
  );
  useEffect(() => {
    if (!playing || !record) return;
    const timer = setInterval(
      () =>
        setTick((t) => {
          if (t >= record.recording.duration_ticks) {
            setPlaying(false);
            return t;
          }
          return t + 1;
        }),
      1000 / 30,
    );
    return () => clearInterval(timer);
  }, [playing, record]);
  async function importFile() {
    const f = upload.current?.files?.[0];
    if (!f) return;
    const scope = context.current,
      importId = ++importRequest.current;
    try {
      if (f.size > 7 * 1024 * 1024) throw new Error("Import exceeds 7 MiB");
      const r = await api<{ id: string }>(
        "/recordings",
        parseJSONImport(await f.text(), 7 * 1024 * 1024),
      );
      if (context.current !== scope || importRequest.current !== importId)
        return;
      await refresh(scope);
      if (context.current !== scope || importRequest.current !== importId)
        return;
      selectRecording(r.id);
      setError("");
    } catch (e) {
      if (context.current === scope && importRequest.current === importId)
        setError((e as Error).message);
    }
  }
  const state = record ? recordedState(record.recording, tick) : null,
    ev = record
      ? recordedObservations(record.recording, tick).filter(
          (o) => o.track_id === track,
        )
      : [];
  const currentTrack = !!state?.tracks.some((t) => t.id === track);
  function decide(k: Action["k"]) {
    if (pendingSave.current || result !== null || !currentTrack) return;
    setActions((a) => [
      ...a,
      {
        tick,
        order: a.length,
        k,
        track,
        ...(k === "classify"
          ? { kind, identity: category }
          : k === "engage"
            ? { effector }
            : {}),
      },
    ]);
  }
  return (
    <main className="instructor-page advanced-page utility-page">
      <PageHeader
        eyebrow="OBSERVATION PRACTICE"
        title="Recorded practice"
        description="Replay recorded observations and practise responses without a tactical score."
        actions={
          <nav className="advanced-nav">
            <a href="/instructor">Instructor</a>
          </nav>
        }
      />
      <p>
        Recorded samples are held for at most one second, with no invented
        motion between samples. No tactical score, impact simulation or skill
        updates. Supplied ground truth is unverified; missing ground truth
        remains unassessable.
      </p>
      {error && <p role="alert">{error}</p>}
      <section className="panel advanced-card">
        <label>
          Recorded JSON
          <input type="file" accept=".json,application/json" ref={upload} />
        </label>
        <button className="button subtle" onClick={() => void importFile()}>
          Validate and import JSON
        </button>
        <label>
          Recorded exercise
          <select value={rid} onChange={(e) => selectRecording(e.target.value)}>
            <option value="">Select recording</option>
            {list.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </label>
        <a href="/examples/recorded-exercise.json" download>
          Download schema example
        </a>
      </section>
      {record && state && (
        <section className="panel advanced-card">
          <h2>{record.recording.title}</h2>
          <p>
            Source: recorded · schema 1 · hash {record.import_hash.slice(0, 16)}
          </p>
          <button
            className="button primary"
            disabled={saving}
            onClick={() => setPlaying((p) => !p)}
          >
            {playing ? "Pause playback" : "Play recording"}
          </button>
          <p>
            T+{(tick / 30).toFixed(2)}s /{" "}
            {(record.recording.duration_ticks / 30).toFixed(2)}s
          </p>
          <Radar state={state} selected={track} onSelect={setTrack} large />
          <label>
            Observed track
            <select
              disabled={saving}
              value={track}
              onChange={(e) => setTrack(e.target.value)}
            >
              <option value="">Select track</option>
              {state.tracks.map((t) => (
                <option key={t.id}>{t.id}</option>
              ))}
            </select>
          </label>
          <p>
            {ev
              .map(
                (e) =>
                  `${e.sensor}: ${e.detected ? "observed" : "no return"}${e.iff ? " · " + e.iff : ""}`,
              )
              .join(" · ")}
          </p>
          {track && !currentTrack && (
            <p role="status">
              No current recorded observation for {track}. Wait for a new sample
              or choose an observed track.
            </p>
          )}
          <button
            className="button subtle"
            disabled={saving || result !== null || !currentTrack}
            onClick={() => decide("designate")}
          >
            Designate
          </button>
          <label>
            Type
            <select
              disabled={saving}
              value={kind}
              onChange={(e) => setKind(e.target.value as Kind)}
            >
              {["bird", "quad", "fixed_wing", "fiber_fpv"].map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <label>
            Identity
            <select
              disabled={saving}
              value={category}
              onChange={(e) => setCategory(e.target.value as Identity)}
            >
              {["friendly", "neutral", "hostile"].map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <button
            className="button subtle"
            disabled={
              saving ||
              !currentTrack ||
              result !== null ||
              !actions.some((a) => a.track === track && a.k === "designate")
            }
            onClick={() => decide("classify")}
          >
            Record classification
          </button>
          <label>
            Response
            <select
              disabled={saving}
              value={effector}
              onChange={(e) => setEffector(e.target.value as Effector)}
            >
              {["hold", "rf_jam", "kinetic"].map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <button
            className="button subtle"
            disabled={
              saving ||
              !currentTrack ||
              result !== null ||
              !actions.some((a) => a.track === track && a.k === "classify")
            }
            onClick={() => decide("engage")}
          >
            Record response
          </button>
          <p>
            {actions.length} recorded decisions. Responses do not alter the
            imported track history.
          </p>
          <button
            className="button primary"
            disabled={saving || result !== null}
            onClick={() => {
              if (pendingSave.current) return;
              pendingSave.current = true;
              setSaving(true);
              setError("");
              setPlaying(false);
              const scope = context.current;
              void api(`/recordings/${rid}/practice`, {
                request_id: request.current,
                trainee_id: identity?.trainee_id ?? "CADET-01",
                actions,
              })
                .then((review) => {
                  if (context.current === scope) setResult(review);
                })
                .catch((e) => {
                  if (context.current === scope) setError(e.message);
                })
                .finally(() => {
                  if (context.current === scope) {
                    pendingSave.current = false;
                    setSaving(false);
                  }
                });
            }}
          >
            {saving ? "Saving practice review…" : "Save practice review"}
          </button>
        </section>
      )}
      {result !== null && (
        <section className="panel advanced-card">
          <h2>Recorded practice review</h2>
          <button
            className="button subtle"
            onClick={() => {
              context.current++;
              setPlaying(false);
              setTick(0);
              setTrack("");
              setActions([]);
              setResult(null);
              setError("");
              request.current = newId();
            }}
          >
            Start new practice
          </button>
          <pre>{JSON.stringify(result, null, 2)}</pre>
          <button
            className="button subtle"
            onClick={() => download("recorded-practice.json", result)}
          >
            Export decisions and reference review
          </button>
        </section>
      )}
    </main>
  );
}
