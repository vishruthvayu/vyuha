import ControlledStudy from "./ControlledStudy";
import AssessmentDiagnostics from "./AssessmentDiagnostics";
import AssessmentGeneration from "./AssessmentGeneration";
import CurriculumPolicyDiagnostic from "./CurriculumPolicyDiagnostic";
import { PageHeader } from "./UI";
import { useEffect, useRef, useState } from "react";
import { api, download } from "./storage";
import { newId, type UnitIdentity } from "./unit-state";
type Pilot = {
  id: string;
  participant: string;
  drills_required: number;
  drills: { id: string; score: number; failures: Record<string, number> }[];
  pre: Record<string, number> | null;
  post: Record<string, number> | null;
  session_ids: { pre?: string; post?: string };
  observed_difference: Record<string, number> | null;
  note: string;
  protocol: string;
};
export default function Evaluation({ identity }: { identity?: UnitIdentity }) {
  return (
    <EvaluationWorkspace
      key={identity?.trainee_id ?? "unjoined"}
      identity={identity}
    />
  );
}
function EvaluationWorkspace({ identity }: { identity?: UnitIdentity }) {
  const key = `vyuha-evaluation:${identity?.trainee_id ?? "local"}`,
    [eid, setEid] = useState(() => localStorage.getItem(key) ?? ""),
    [pilot, setPilot] = useState<Pilot | null>(null),
    [participant, setParticipant] = useState("P01"),
    [consent, setConsent] = useState(false),
    [drills, setDrills] = useState(3),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const request = useRef(newId());
  const scope = useRef(0);
  const pending = useRef(false);
  useEffect(() => {
    const active = ++scope.current;
    const current = () => active === scope.current;
    if (eid) {
      pending.current = true;
      setBusy(true);
      setPilot((previous) => (previous?.id === eid ? previous : null));
      setError("");
      void api<Pilot>(`/evaluations/${encodeURIComponent(eid)}`)
        .then((next) => {
          if (!current()) return;
          if (next.id !== eid)
            throw new Error("Evaluation response does not match this protocol");
          setPilot(next);
        })
        .catch((e) => {
          if (current()) setError((e as Error).message);
        })
        .finally(() => {
          if (current()) {
            pending.current = false;
            setBusy(false);
          }
        });
    }
    return () => {
      scope.current++;
      pending.current = false;
    };
  }, [eid]);
  async function perform(
    path: string,
    body: unknown | undefined,
    expectedId?: string,
  ) {
    if (pending.current) return;
    const active = ++scope.current;
    const current = () => active === scope.current;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const next = await api<Pilot>(path, body);
      if (!current()) return;
      if (expectedId && next.id !== expectedId)
        throw new Error("Evaluation response does not match this protocol");
      if (!expectedId) {
        localStorage.setItem(key, next.id);
        setEid(next.id);
      }
      setPilot(next);
    } catch (e) {
      if (current()) setError((e as Error).message);
    } finally {
      if (current()) {
        pending.current = false;
        setBusy(false);
      }
    }
  }
  function refresh() {
    if (eid)
      return perform(`/evaluations/${encodeURIComponent(eid)}`, undefined, eid);
  }
  function start() {
    return perform("/evaluations", {
      request_id: request.current,
      trainee_id: identity?.trainee_id ?? "CADET-01",
      participant,
      consent,
      drills,
      seed: 62147,
    });
  }
  function editRequest() {
    request.current = newId();
    setError("");
  }
  return (
    <main className="instructor-page advanced-page utility-page">
      <PageHeader
        eyebrow="CONSENT-BASED PILOT"
        title="Informal evaluation"
        description="Prepare a voluntary evaluation protocol; no study runs automatically."
        actions={
          <nav className="advanced-nav">
            <a href="/">Training home</a>
          </nav>
        }
      />
      <p>
        Support for a small voluntary pilot. No human study is conducted
        automatically. Use pseudonymous participant IDs and record only training
        measures. This protocol does not establish training efficacy or military
        validation.
      </p>
      {error && <p role="alert">{error}</p>}
      {busy && <p role="status">Loading evaluation protocol…</p>}
      {!pilot ? (
        <section className="panel advanced-card">
          <label>
            Participant ID
            <input
              value={participant}
              pattern="P[0-9]{2,4}"
              maxLength={5}
              disabled={busy}
              onChange={(e) => {
                editRequest();
                setParticipant(e.target.value);
              }}
            />
          </label>
          <label>
            Adaptive drills
            <select
              value={drills}
              disabled={busy}
              onChange={(e) => {
                editRequest();
                setDrills(Number(e.target.value));
              }}
            >
              {[3, 4, 5].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={consent}
              disabled={busy}
              onChange={(e) => {
                editRequest();
                setConsent(e.target.checked);
              }}
            />
            Participant has agreed to this informal evaluation
          </label>
          <button
            className="button primary"
            disabled={!consent || busy}
            onClick={() => void start()}
          >
            Create evaluation protocol
          </button>
        </section>
      ) : (
        <section className="panel advanced-card">
          <h2>{pilot.participant}</h2>
          <p>{pilot.protocol}</p>
          <p>{pilot.note}</p>
          {pilot.session_ids.pre && (
            <a
              className="button subtle"
              href={`/rapid-id?session=${pilot.session_ids.pre}`}
            >
              Open 15-round pre-test
            </a>
          )}
          <p>
            Completed adaptive drills after pre-test: {pilot.drills.length} /{" "}
            {pilot.drills_required}
          </p>
          <a className="button subtle" href="/?mode=adaptive">
            Open adaptive training
          </a>
          <button
            className="button subtle"
            disabled={busy}
            onClick={() => void refresh()}
          >
            Refresh protocol results
          </button>
          <button
            className="button primary"
            disabled={
              busy || !pilot.pre || pilot.drills.length < pilot.drills_required
            }
            onClick={() =>
              void perform(
                `/evaluations/${encodeURIComponent(eid)}/post`,
                {},
                eid,
              )
            }
          >
            Prepare post-test
          </button>
          {pilot.session_ids.post && (
            <a
              className="button subtle"
              href={`/rapid-id?session=${pilot.session_ids.post}`}
            >
              Open 15-round post-test
            </a>
          )}
          <table>
            <thead>
              <tr>
                <th>Measure</th>
                <th>Pre</th>
                <th>Post</th>
              </tr>
            </thead>
            <tbody>
              {[
                "accuracy",
                "median_response_ms",
                "friendly_false_hostile",
                "bird_confusion",
              ].map((m) => (
                <tr key={m}>
                  <td>{m}</td>
                  <td>{pilot.pre?.[m] ?? "Pending"}</td>
                  <td>{pilot.post?.[m] ?? "Pending"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {pilot.observed_difference && (
            <p>
              Observed differences:{" "}
              {Object.entries(pilot.observed_difference)
                .map(([k, v]) => `${k}: ${v.toFixed(2)}`)
                .join(" · ")}
              . No causal inference.
            </p>
          )}
          <p>
            Adaptive failure evidence:{" "}
            {pilot.drills
              .map((d) => `${d.id.slice(0, 8)}: ${JSON.stringify(d.failures)}`)
              .join("; ") || "Pending"}
          </p>
          <button
            className="button subtle"
            onClick={() => download("evaluation-summary.json", pilot)}
          >
            Export pseudonymous summary
          </button>
        </section>
      )}
      <ControlledStudy identity={identity} />
      <AssessmentDiagnostics key={key} />
      <AssessmentGeneration key={`generation:${key}`} />
      <CurriculumPolicyDiagnostic key={`policy:${key}`} />
    </main>
  );
}
