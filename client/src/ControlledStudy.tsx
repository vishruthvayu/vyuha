import { useEffect, useRef, useState } from "react";
import { api, download } from "./storage";
import { newId, type UnitIdentity } from "./unit-state";
import type { LearningPreparation } from "./learning";
type Study = {
  id: string;
  protocol: {
    version?: string;
    protocol_hash: string;
    retention_hours: number;
    competency: string;
    limitations: string[];
    analysis_contract?: {
      version: string;
      estimand: string;
      population: string;
      primary: { phases: string[]; measure: string; denominator: string };
      secondary: { phases: string[]; measure: string }[];
      allocation: string;
      exclusions: string[];
      missing_data: string;
      terminal_dispositions: string;
      reporting: string;
      power: string;
    };
  };
  participants: {
    id: string;
    participant: string;
    trainee: string;
    arm: string;
    consented_at: string;
    lifecycle_status?: "active" | "withdrawn" | "dropout";
    dispositions?: {
      id: string;
      disposition: "withdrawn" | "dropout";
      reason: string;
      recorded_at: string;
    }[];
    attempts: {
      phase: string;
      status: string;
      session_id: string | null;
      observed_ticks?: number | null;
      exposure_eligible?: boolean;
    }[];
  }[];
  note: string;
};
export default function ControlledStudy({
  identity,
}: {
  identity?: UnitIdentity;
}) {
  return (
    <ControlledStudyWorkspace
      key={identity?.trainee_id ?? "unjoined"}
      identity={identity}
    />
  );
}
function ControlledStudyWorkspace({ identity }: { identity?: UnitIdentity }) {
  const [study, setStudy] = useState<Study | null>(null),
    [id, setId] = useState(""),
    [participant, setParticipant] = useState("P01"),
    [consent, setConsent] = useState(false),
    [question, setQuestion] = useState(
      "Does evidence handling transfer to a different semantic raid?",
    ),
    [competency, setCompetency] = useState("C02"),
    [ready, setReady] = useState<{
      preparation: LearningPreparation;
      study: string;
      participant: string;
      trainee: string | undefined;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [dispositionDrafts, setDispositionDrafts] = useState<
      Record<
        string,
        { disposition: "" | "withdrawn" | "dropout"; reason: string }
      >
    >({});
  const request = useRef(newId());
  const dispositionRequests = useRef<
    Record<string, { key: string; id: string }>
  >({});
  const scope = useRef(0);
  useEffect(
    () => () => {
      scope.current++;
    },
    [],
  );
  function invalidate() {
    scope.current++;
    setReady(null);
    setError("");
    setBusy(false);
  }
  async function perform(work: (current: () => boolean) => Promise<void>) {
    const active = ++scope.current;
    const current = () => active === scope.current;
    setBusy(true);
    setError("");
    setReady(null);
    try {
      await work(current);
    } catch (e) {
      if (current())
        setError(e instanceof Error ? e.message : "Protocol unavailable");
    } finally {
      if (current()) setBusy(false);
    }
  }
  async function refresh(sid: string, current: () => boolean) {
    const next = await api<Study>(
      `/evaluations/controlled/${encodeURIComponent(sid)}`,
    );
    if (current()) {
      setStudy(next);
      setId(next.id);
    }
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
        <input
          value={id}
          onChange={(e) => {
            invalidate();
            setId(e.target.value);
          }}
        />
      </label>
      <button
        className="button subtle"
        disabled={busy || !id}
        onClick={() => void perform((current) => refresh(id, current))}
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
              onChange={(e) => {
                invalidate();
                request.current = newId();
                setQuestion(e.target.value);
              }}
            />
          </label>
          <label>
            Target competency
            <select
              value={competency}
              onChange={(e) => {
                invalidate();
                request.current = newId();
                setCompetency(e.target.value);
              }}
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
              void perform(async (current) => {
                const p = await api<{ id: string }>("/evaluations/controlled", {
                  request_id: request.current,
                  seed: 62147,
                  intended_sample: 2,
                  retention_hours: 24,
                  transfer_question: question,
                  competency,
                });
                if (current()) await refresh(p.id, current);
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
          {study.protocol.analysis_contract ? (
            <details>
              <summary>
                Frozen analysis and exclusion plan ·{" "}
                {study.protocol.analysis_contract.version}
              </summary>
              <p>{study.protocol.analysis_contract.estimand}</p>
              <p>{study.protocol.analysis_contract.population}</p>
              <p>
                Primary (
                {study.protocol.analysis_contract.primary.phases.join(" → ")}):{" "}
                {study.protocol.analysis_contract.primary.measure}
              </p>
              <p>{study.protocol.analysis_contract.primary.denominator}</p>
              <ul>
                {study.protocol.analysis_contract.secondary.map((outcome) => (
                  <li key={outcome.phases.join("-")}>
                    {outcome.phases.join(" → ")}: {outcome.measure}
                  </li>
                ))}
              </ul>
              <p>{study.protocol.analysis_contract.allocation}</p>
              <ul>
                {study.protocol.analysis_contract.exclusions.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
              <p>{study.protocol.analysis_contract.missing_data}</p>
              <p>{study.protocol.analysis_contract.terminal_dispositions}</p>
              <p>{study.protocol.analysis_contract.reporting}</p>
              <p>{study.protocol.analysis_contract.power}</p>
            </details>
          ) : (
            <p>
              Historical protocol: no versioned analysis contract was
              registered. Its original protocol and evidence remain unchanged.
            </p>
          )}
          <label>
            Pseudonymous participant label
            <input
              value={participant}
              pattern="P[0-9]{2,4}"
              onChange={(e) => {
                invalidate();
                setParticipant(e.target.value);
                setConsent(false);
              }}
            />
          </label>
          <label className="study-consent">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => {
                invalidate();
                setConsent(e.target.checked);
              }}
            />
            Facilitator confirms explicit participant agreement for the
            currently joined trainee
          </label>
          <button
            className="button"
            disabled={busy || !consent || !identity}
            onClick={() =>
              void perform(async (current) => {
                await api(`/evaluations/controlled/${study.id}/participants`, {
                  participant,
                  trainee: identity!.trainee_id,
                  consent,
                });
                if (current()) {
                  setConsent(false);
                  await refresh(study.id, current);
                }
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
              <p>
                Participant status: {p.lifecycle_status ?? "active"}. Existing
                exercise evidence is retained.
              </p>
              {!!p.dispositions?.length && (
                <ul aria-label={`Disposition history for ${p.participant}`}>
                  {p.dispositions.map((entry) => (
                    <li key={entry.id}>
                      {entry.disposition} ·{" "}
                      <time dateTime={entry.recorded_at}>
                        {entry.recorded_at}
                      </time>{" "}
                      · {entry.reason}
                    </li>
                  ))}
                </ul>
              )}
              {p.lifecycle_status && p.lifecycle_status !== "active" && (
                <p>
                  New preparation and new session creation are disabled.
                  Already-created sessions may finish; their evidence is
                  preserved with this disposition.
                </p>
              )}
              <details>
                <summary>
                  Record terminal disposition for {p.participant}
                </summary>
                <p>
                  Officer record only: withdrawal or dropout cannot reactivate
                  participation or erase evidence. Record only an actual
                  participant disposition.
                </p>
                <label>
                  Disposition for {p.participant}
                  <select
                    disabled={busy}
                    value={dispositionDrafts[p.id]?.disposition ?? ""}
                    onChange={(event) => {
                      invalidate();
                      setDispositionDrafts((drafts) => ({
                        ...drafts,
                        [p.id]: {
                          disposition: event.target.value as
                            "" | "withdrawn" | "dropout",
                          reason: drafts[p.id]?.reason ?? "",
                        },
                      }));
                    }}
                  >
                    <option value="">Choose a disposition</option>
                    <option value="withdrawn">Withdrawn</option>
                    <option value="dropout">Dropout</option>
                  </select>
                </label>
                <label>
                  Disposition reason for {p.participant}
                  <input
                    maxLength={400}
                    disabled={busy}
                    value={dispositionDrafts[p.id]?.reason ?? ""}
                    onChange={(event) => {
                      invalidate();
                      setDispositionDrafts((drafts) => ({
                        ...drafts,
                        [p.id]: {
                          disposition: drafts[p.id]?.disposition ?? "",
                          reason: event.target.value,
                        },
                      }));
                    }}
                  />
                </label>
                <button
                  className="button subtle"
                  disabled={
                    busy ||
                    !dispositionDrafts[p.id]?.disposition ||
                    !dispositionDrafts[p.id]?.reason.trim()
                  }
                  onClick={() =>
                    void perform(async (current) => {
                      const draft = dispositionDrafts[p.id];
                      const key = JSON.stringify([
                        study.id,
                        p.id,
                        draft.disposition,
                        draft.reason,
                      ]);
                      if (dispositionRequests.current[p.id]?.key !== key)
                        dispositionRequests.current[p.id] = {
                          key,
                          id: newId(),
                        };
                      const recorded = await api<
                        NonNullable<
                          Study["participants"][number]["dispositions"]
                        >[number]
                      >(
                        `/evaluations/controlled/${study.id}/participants/${p.id}/dispositions`,
                        {
                          request_id: dispositionRequests.current[p.id].id,
                          disposition: draft.disposition,
                          reason: draft.reason,
                        },
                      );
                      if (!current()) return;
                      setReady(null);
                      setStudy((previous) =>
                        previous?.id === study.id
                          ? {
                              ...previous,
                              participants: previous.participants.map((row) =>
                                row.id === p.id
                                  ? {
                                      ...row,
                                      lifecycle_status: recorded.disposition,
                                      dispositions: [
                                        ...(row.dispositions ?? []).filter(
                                          (entry) => entry.id !== recorded.id,
                                        ),
                                        recorded,
                                      ],
                                    }
                                  : row,
                              ),
                            }
                          : previous,
                      );
                      setDispositionDrafts((drafts) => ({
                        ...drafts,
                        [p.id]: { disposition: "", reason: "" },
                      }));
                      await refresh(study.id, current);
                    })
                  }
                >
                  Confirm terminal disposition for {p.participant}
                </button>
              </details>
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
                    {p.attempts.find((a) => a.phase === phase)
                      ?.exposure_eligible === false &&
                      "· not exposure-qualified "}
                    <button
                      className="button subtle"
                      disabled={
                        busy ||
                        (p.lifecycle_status !== undefined &&
                          p.lifecycle_status !== "active")
                      }
                      onClick={() =>
                        void perform(async (current) => {
                          const r = await api<LearningPreparation>(
                            `/evaluations/controlled/${study.id}/participants/${p.id}/${phase}/prepare`,
                            {},
                          );
                          if (!current()) return;
                          await refresh(study.id, current);
                          if (current())
                            setReady({
                              preparation: r,
                              study: study.id,
                              participant: p.id,
                              trainee: p.trainee,
                            });
                        })
                      }
                    >
                      Prepare {phase} for {p.participant}
                    </button>
                  </li>
                ))}
              </ol>
            </article>
          ))}
          {ready &&
            ready.study === study.id &&
            ready.trainee === identity?.trainee_id &&
            study.participants.some(
              (p) =>
                p.id === ready.participant &&
                (!p.lifecycle_status || p.lifecycle_status === "active"),
            ) && (
              <a
                className="button"
                href={`/?mode=adaptive&learning=${encodeURIComponent(ready.preparation.preparation_id)}`}
              >
                Open registered attempt
              </a>
            )}
          {ready &&
            ready.study === study.id &&
            ready.trainee !== identity?.trainee_id && (
              <p role="status">
                Prepared for{" "}
                {
                  study.participants.find((p) => p.id === ready.participant)
                    ?.participant
                }
                . Join that participant's trainee identity before opening the
                registered exercise. No exercise has been launched.
              </p>
            )}
          <div className="advanced-nav">
            <button
              className="button subtle"
              disabled={busy}
              onClick={() =>
                void perform((current) => refresh(study.id, current))
              }
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
