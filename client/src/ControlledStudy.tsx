import { useRef, useState } from "react";
import { api, download } from "./storage";
import { newId, type UnitIdentity } from "./unit-state";
import type { LearningPreparation } from "./learning";
type Study = {
  id: string;
  protocol: {
    protocol_hash: string;
    retention_hours: number;
    competency: string;
    limitations: string[];
  };
  participants: {
    id: string;
    participant: string;
    arm: string;
    consented_at: string;
    attempts: { phase: string; status: string; session_id: string | null }[];
  }[];
  note: string;
};
export default function ControlledStudy({
  identity,
}: {
  identity?: UnitIdentity;
}) {
  const [study, setStudy] = useState<Study | null>(null),
    [id, setId] = useState(""),
    [participant, setParticipant] = useState("P01"),
    [consent, setConsent] = useState(false),
    [question, setQuestion] = useState(
      "Does evidence handling transfer to a different semantic raid?",
    ),
    [competency, setCompetency] = useState("C02"),
    [ready, setReady] = useState<LearningPreparation | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const request = useRef(newId());
  async function perform(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Protocol unavailable");
    } finally {
      setBusy(false);
    }
  }
  async function refresh(sid: string) {
    const next = await api<Study>(
      `/evaluations/controlled/${encodeURIComponent(sid)}`,
    );
    setStudy(next);
    setId(next.id);
  }
  return (
    <details className="panel advanced-card controlled-study">
      <summary>
        Controlled retention and transfer protocol · infrastructure
      </summary>
      <p>
        Officer-operated, consent-based pilot infrastructure. No people are
        enrolled automatically. This does not demonstrate learning gains, fair
        form difficulty or operational readiness. Obtain appropriate consent and
        research review before using it with people.
      </p>
      {error && <p role="alert">{error}</p>}
      <label>
        Existing protocol ID
        <input value={id} onChange={(e) => setId(e.target.value)} />
      </label>
      <button
        className="button subtle"
        disabled={busy || !id}
        onClick={() => void perform(() => refresh(id))}
      >
        Load registered protocol
      </button>
      {!study ? (
        <>
          <label>
            Prespecified transfer question
            <input
              maxLength={400}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
          </label>
          <label>
            Target competency
            <select
              value={competency}
              onChange={(e) => setCompetency(e.target.value)}
            >
              {["C01", "C02", "C03", "C04", "C05"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <p>
            Frozen defaults: two-person pilot capacity, three practice blocks,
            24-hour minimum retention interval and 54 seconds of observed
            exercise time per block. Early ends remain ineligible in the record.
            Paired arms differ in full versus faded scaffolding; structural
            matching is not empirical equivalence.
          </p>
          <button
            className="button"
            disabled={busy || question.length < 15}
            onClick={() =>
              void perform(async () => {
                const p = await api<{ id: string }>("/evaluations/controlled", {
                  request_id: request.current,
                  seed: 62147,
                  intended_sample: 2,
                  retention_hours: 24,
                  transfer_question: question,
                  competency,
                });
                await refresh(p.id);
              })
            }
          >
            Register frozen protocol
          </button>
        </>
      ) : (
        <>
          <h3>Protocol {study.id}</h3>
          <p>
            Hash: <code>{study.protocol.protocol_hash}</code> ·{" "}
            {study.protocol.competency} · retention ≥
            {study.protocol.retention_hours} hours
          </p>
          <label>
            Pseudonymous participant label
            <input
              value={participant}
              pattern="P[0-9]{2,4}"
              onChange={(e) => {
                setParticipant(e.target.value);
                setConsent(false);
              }}
            />
          </label>
          <label className="study-consent">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            Facilitator confirms explicit participant agreement for the
            currently joined trainee
          </label>
          <button
            className="button"
            disabled={busy || !consent || !identity}
            onClick={() =>
              void perform(async () => {
                await api(`/evaluations/controlled/${study.id}/participants`, {
                  participant,
                  trainee: identity!.trainee_id,
                  consent,
                });
                setConsent(false);
                await refresh(study.id);
              })
            }
          >
            Enroll joined trainee
          </button>
          {!identity && (
            <p>Join a trainee identity before enrolling a participant.</p>
          )}
          {study.participants.map((p) => (
            <article key={p.id}>
              <h4>
                {p.participant} · {p.arm} scaffolding
              </h4>
              <ol>
                {[
                  "baseline",
                  "practice1",
                  "practice2",
                  "practice3",
                  "immediate",
                  "retention",
                  "transfer",
                ].map((phase) => (
                  <li key={phase}>
                    {phase} ·{" "}
                    {p.attempts.find((a) => a.phase === phase)?.status ??
                      "not started"}{" "}
                    <button
                      className="button subtle"
                      disabled={busy}
                      onClick={() =>
                        void perform(async () => {
                          const r = await api<LearningPreparation>(
                            `/evaluations/controlled/${study.id}/participants/${p.id}/${phase}/prepare`,
                            {},
                          );
                          setReady(r);
                          await refresh(study.id);
                        })
                      }
                    >
                      Prepare {phase}
                    </button>
                  </li>
                ))}
              </ol>
            </article>
          ))}
          {ready && (
            <a
              className="button"
              href={`/?mode=adaptive&learning=${encodeURIComponent(ready.preparation_id)}`}
            >
              Open registered attempt
            </a>
          )}
          <div className="advanced-nav">
            <button
              className="button subtle"
              disabled={busy}
              onClick={() => void perform(() => refresh(study.id))}
            >
              Refresh registered evidence
            </button>
            <button
              className="button subtle"
              disabled={busy}
              onClick={() => download("VYUHA-registered-protocol.json", study)}
            >
              Export protocol and observed evidence
            </button>
          </div>
          <p>{study.note}</p>
          <ul>
            {study.protocol.limitations.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <p>
            Protocol enrollment data stays on this server and its database
            backup; ordinary training transfer carries learning context, not
            participant consent or allocation records.
          </p>
        </>
      )}
    </details>
  );
}
