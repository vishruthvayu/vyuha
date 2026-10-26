import { useEffect, useId, useRef, useState } from "react";
import { api, RECONSTRUCTION_TIMEOUT_MS } from "./storage";
import { newId } from "./unit-state";

type Choice = "supported" | "not_established";
type Report = {
  tick: number;
  radar: { available: boolean; state: string; detected: boolean | null };
  rf: { available: boolean; signal: boolean | null; iff: string };
  visual: { available: boolean; silhouette: string | null };
  range_m: number | null;
  night: boolean;
};
type Question = {
  id: string;
  decision_id: string;
  track_id: string;
  tick: number;
  order: number | null;
  concept: string;
  prompt: string;
  evidence: Report;
  options: Choice[];
};
type Answer = {
  question_id: string;
  choice: Choice;
  matches_report: boolean;
  explanation: string;
};
type Envelope = {
  version: "evidence-investigation-v1";
  mission_id: string;
  session_id: string;
  trainee: string;
  review_hash: string;
  questions: Question[];
  answers: Answer[];
  note: string;
};
type Context = {
  sessionId: string;
  trainee: string;
  reviewHash: string;
  onInspectDecision?: (id: string) => void;
  readOnly?: boolean;
};
type Pending = { request_id: string; question_id: string; choice: Choice };
type Draft = { start_id: string; pending?: Pending };
const isChoice = (v: unknown): v is Choice =>
  v === "supported" || v === "not_established";
const finite = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
function initialDraft(key: string): Draft {
  try {
    const raw = localStorage.getItem(key);
    if (raw && raw.length <= 2048) {
      const value = JSON.parse(raw);
      if (
        /^[A-Za-z0-9_-]{8,80}$/.test(value.start_id) &&
        (!value.pending ||
          (/^[A-Za-z0-9_-]{8,80}$/.test(value.pending.request_id) &&
            typeof value.pending.question_id === "string" &&
            value.pending.question_id.length <= 120 &&
            isChoice(value.pending.choice)))
      )
        return value;
    }
  } catch {
    /* A local draft cannot change server evidence. */
  }
  return { start_id: newId() };
}
function accepted(value: Envelope, context: Context): Envelope {
  if (
    value.version !== "evidence-investigation-v1" ||
    value.session_id !== context.sessionId ||
    value.trainee !== context.trainee ||
    value.review_hash !== context.reviewHash ||
    typeof value.mission_id !== "string" ||
    !value.mission_id ||
    !Array.isArray(value.questions) ||
    value.questions.length < 2 ||
    value.questions.length > 4 ||
    !Array.isArray(value.answers) ||
    value.answers.length > value.questions.length ||
    new Set(value.questions.map((q) => q.id)).size !== value.questions.length ||
    new Set(value.answers.map((a) => a.question_id)).size !==
      value.answers.length ||
    value.questions.some((q) => {
      const e = q.evidence;
      return (
        typeof q.id !== "string" ||
        typeof q.decision_id !== "string" ||
        typeof q.track_id !== "string" ||
        typeof q.prompt !== "string" ||
        !Number.isInteger(q.tick) ||
        q.tick < 0 ||
        (q.order !== null && (!Number.isInteger(q.order) || q.order < 0)) ||
        !Array.isArray(q.options) ||
        q.options.join(",") !== "supported,not_established" ||
        !e ||
        e.tick !== q.tick ||
        !e.radar ||
        !e.rf ||
        !e.visual ||
        typeof e.radar.available !== "boolean" ||
        typeof e.radar.state !== "string" ||
        (e.radar.detected !== null && typeof e.radar.detected !== "boolean") ||
        typeof e.rf.available !== "boolean" ||
        (e.rf.signal !== null && typeof e.rf.signal !== "boolean") ||
        typeof e.rf.iff !== "string" ||
        typeof e.visual.available !== "boolean" ||
        (e.visual.silhouette !== null &&
          typeof e.visual.silhouette !== "string") ||
        (e.range_m !== null && (!finite(e.range_m) || e.range_m < 0)) ||
        typeof e.night !== "boolean"
      );
    }) ||
    value.answers.some(
      (a) =>
        !value.questions.some((q) => q.id === a.question_id) ||
        !isChoice(a.choice) ||
        typeof a.matches_report !== "boolean" ||
        typeof a.explanation !== "string",
    ) ||
    typeof value.note !== "string"
  )
    throw new Error(
      "Investigation response does not match this original review.",
    );
  return value;
}
const choiceLabel = (choice: Choice) =>
  choice === "supported"
    ? "Supported by this report"
    : "Not established by this report";
const flag = (available: boolean, value: boolean | null) =>
  !available
    ? "Unavailable"
    : value === null
      ? "Not reported"
      : value
        ? "Present"
        : "Absent";

export default function EvidenceInvestigation(context: Context) {
  return (
    <InvestigationWorkspace
      key={`${context.sessionId}:${context.trainee}:${context.reviewHash}:${context.readOnly ? "officer" : "learner"}`}
      {...context}
    />
  );
}
function InvestigationWorkspace(context: Context) {
  const {
    sessionId,
    trainee,
    reviewHash,
    onInspectDecision,
    readOnly = false,
  } = context;
  const key = `vyuha-investigation-v1:${sessionId}:${trainee}:${reviewHash}`;
  const draft = useRef(
    readOnly ? ({ start_id: newId() } as Draft) : initialDraft(key),
  );
  const [report, setReport] = useState<Envelope | null>(null);
  const [index, setIndex] = useState(0);
  const [selection, setSelection] = useState<Choice | "">("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [draftIssue, setDraftIssue] = useState("");
  const epoch = useRef(0),
    heading = useRef<HTMLHeadingElement>(null);
  const labelId = useId();
  const path = `/learning/sessions/${encodeURIComponent(sessionId)}/investigation`;
  useEffect(
    () => () => {
      epoch.current++;
    },
    [],
  );
  useEffect(() => {
    if (report) heading.current?.focus();
  }, [index, report?.mission_id]);
  function preserve(next: Draft) {
    draft.current = next;
    if (readOnly) return;
    try {
      localStorage.setItem(key, JSON.stringify(next));
      setDraftIssue("");
    } catch {
      setDraftIssue(
        "This browser cannot retain an unsent answer after closing. Keep this review open until the server confirms it.",
      );
    }
  }
  function install(value: Envelope, preferred?: number) {
    const next = accepted(value, context);
    if (
      report &&
      (next.mission_id !== report.mission_id ||
        JSON.stringify(next.questions) !== JSON.stringify(report.questions))
    )
      throw new Error(
        "The returned investigation differs from the frozen mission. Your pending answer is retained.",
      );
    const pending = draft.current.pending;
    if (pending) {
      const answer = next.answers.find(
        (a) => a.question_id === pending.question_id,
      );
      if (answer) {
        preserve({ start_id: draft.current.start_id });
        if (answer.choice !== pending.choice)
          setDraftIssue(
            "The server already holds a different first answer. That saved answer is shown; the local retry was cleared.",
          );
      } else if (!next.questions.some((q) => q.id === pending.question_id)) {
        throw new Error(
          "The pending answer belongs to another investigation. It has not been submitted.",
        );
      }
    }
    const firstUnanswered = next.questions.findIndex(
      (q) => !next.answers.some((a) => a.question_id === q.id),
    );
    setReport(next);
    const pendingIndex = next.questions.findIndex(
      (q) => q.id === draft.current.pending?.question_id,
    );
    setIndex(
      preferred ??
        (pendingIndex >= 0
          ? pendingIndex
          : firstUnanswered < 0
            ? next.questions.length - 1
            : firstUnanswered),
    );
    setSelection("");
  }
  async function load(recover = false) {
    if (busy) return;
    const active = ++epoch.current;
    setBusy(true);
    setError("");
    preserve(draft.current);
    try {
      const next = await api<Envelope>(
        readOnly
          ? `/instructor/sessions/${encodeURIComponent(sessionId)}/investigation`
          : recover
            ? `${path}?trainee=${encodeURIComponent(trainee)}`
            : `${path}/start`,
        recover || readOnly
          ? undefined
          : {
              request_id: draft.current.start_id,
              trainee,
              review_hash: reviewHash,
            },
        RECONSTRUCTION_TIMEOUT_MS,
      );
      if (epoch.current === active) install(next);
    } catch (failure) {
      if (epoch.current === active)
        setError(
          failure instanceof Error
            ? failure.message
            : "Investigation unavailable. No original evidence was changed.",
        );
    } finally {
      if (epoch.current === active) setBusy(false);
    }
  }
  async function save() {
    if (readOnly) return;
    const question = report?.questions[index];
    if (
      busy ||
      !question ||
      report!.answers.some((a) => a.question_id === question.id)
    )
      return;
    const old = draft.current.pending;
    if (old && old.question_id !== question.id) {
      setError("Recover the pending answer before continuing.");
      return;
    }
    if (!old && !selection) return;
    const pending: Pending = old ?? {
      request_id: newId(),
      question_id: question.id,
      choice: selection as Choice,
    };
    preserve({ ...draft.current, pending });
    const active = ++epoch.current;
    setBusy(true);
    setError("");
    try {
      const next = accepted(
        await api<Envelope>(`${path}/answers`, {
          ...pending,
          trainee,
          review_hash: reviewHash,
          mission_id: report!.mission_id,
        }),
        context,
      );
      if (epoch.current !== active) return;
      if (
        !next.answers.some(
          (a) =>
            a.question_id === pending.question_id &&
            a.choice === pending.choice,
        )
      )
        throw new Error(
          "Server acknowledgment is incomplete. Your exact answer is retained for retry.",
        );
      install(next, index);
    } catch (failure) {
      if (epoch.current === active)
        setError(
          failure instanceof Error
            ? failure.message
            : "Answer not confirmed. Your exact answer is retained for retry.",
        );
    } finally {
      if (epoch.current === active) setBusy(false);
    }
  }
  const question = report?.questions[index];
  const answer = report?.answers.find((a) => a.question_id === question?.id);
  const pending = draft.current.pending;
  const complete =
    !!report && report.answers.length === report.questions.length;
  return (
    <section
      className="evidence-investigation"
      aria-label="Evidence investigation"
    >
      <header>
        <p className="eyebrow">
          {readOnly
            ? "Officer review · recorded reasoning"
            : "Post-exercise reasoning practice"}
        </p>
        <h4 ref={heading} tabIndex={-1}>
          {question
            ? `Case ${index + 1} of ${report!.questions.length}`
            : "What does the evidence establish?"}
        </h4>
        <p>
          {readOnly
            ? "Inspect the learner's frozen reports and first recorded answers. This view cannot create a mission or change an answer."
            : "Revisit the reports behind your decisions. Separate a supported conclusion from one the available cues cannot establish."}
        </p>
      </header>
      {!report && (
        <button className="button" disabled={busy} onClick={() => void load()}>
          {readOnly
            ? "Review learner investigation"
            : "Open evidence investigation"}
        </button>
      )}
      {busy && (
        <p role="status">
          {readOnly
            ? "Loading recorded investigation…"
            : report
              ? "Confirming your answer on the unit server…"
              : "Reconstructing the original verified reports…"}
        </p>
      )}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <p>
            {readOnly
              ? "Read-only review is unavailable. Original score and evidence are unchanged."
              : "Original score and evidence are unchanged. Any unconfirmed answer is retained."}
          </p>
          <button
            className="button subtle"
            disabled={busy}
            onClick={() => void load(true)}
          >
            {readOnly
              ? "Reload recorded investigation"
              : "Recover saved investigation"}
          </button>
        </div>
      )}
      {draftIssue && <p role="status">{draftIssue}</p>}
      {question && (
        <>
          <nav
            className="investigation-progress"
            aria-label="Investigation cases"
          >
            {report!.questions.map((q, i) => (
              <button
                key={q.id}
                className="button subtle"
                disabled={busy || !!pending}
                aria-current={i === index ? "step" : undefined}
                onClick={() => {
                  setIndex(i);
                  setSelection("");
                  setError("");
                }}
              >
                Case {i + 1}
                {report!.answers.some((a) => a.question_id === q.id)
                  ? " · recorded"
                  : ""}
              </button>
            ))}
          </nav>
          <p id={labelId} className="investigation-proposition">
            {question.prompt}
          </p>
          <div className="investigation-case">
            <div className="investigation-source">
              <p className="eyebrow">Original report · {question.track_id}</p>
              <strong>T+{(question.tick / 30).toFixed(2)} s</strong>
              <dl>
                <div>
                  <dt>Radar return</dt>
                  <dd>
                    {flag(
                      question.evidence.radar.available,
                      question.evidence.radar.detected,
                    )}{" "}
                    · {question.evidence.radar.state}
                  </dd>
                </div>
                <div>
                  <dt>RF link</dt>
                  <dd>
                    {flag(
                      question.evidence.rf.available,
                      question.evidence.rf.signal,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>IFF response</dt>
                  <dd>
                    {question.evidence.rf.available
                      ? question.evidence.rf.iff.replaceAll("_", " ")
                      : "Unavailable"}
                  </dd>
                </div>
                <div>
                  <dt>Visual cue</dt>
                  <dd>
                    {!question.evidence.visual.available
                      ? "Unavailable"
                      : (question.evidence.visual.silhouette?.replaceAll(
                          "_",
                          " ",
                        ) ?? "No silhouette reported")}
                  </dd>
                </div>
                <div>
                  <dt>Range</dt>
                  <dd>
                    {question.evidence.range_m === null
                      ? "Unavailable"
                      : `${question.evidence.range_m.toFixed(0)} m`}
                  </dd>
                </div>
              </dl>
              {onInspectDecision && (
                <button
                  className="button subtle"
                  onClick={() => onInspectDecision(question.decision_id)}
                >
                  Inspect original moment
                </button>
              )}
              <small>
                The stored report is pinned to this time. Later evidence and
                reference truth do not replace it.
              </small>
            </div>
            <div className="investigation-reasoning">
              <fieldset
                disabled={readOnly || busy || !!answer || !!pending}
                aria-labelledby={labelId}
              >
                <legend>Does this report support the statement?</legend>
                {question.options.map((choice) => (
                  <label key={choice} className="investigation-choice">
                    <input
                      type="radio"
                      name={`${labelId}-choice`}
                      value={choice}
                      checked={
                        (answer?.choice ?? pending?.choice ?? selection) ===
                        choice
                      }
                      onChange={() => setSelection(choice)}
                    />
                    {choiceLabel(choice)}
                  </label>
                ))}
              </fieldset>
              {!answer && readOnly && (
                <p>No first answer has been recorded for this case.</p>
              )}
              {!answer && !readOnly && (
                <button
                  className="button"
                  disabled={busy || (!selection && !pending)}
                  onClick={() => void save()}
                >
                  {pending ? "Retry exact answer" : "Record answer"}
                </button>
              )}
              {pending && !busy && (
                <p role="status">
                  The first submitted answer is fixed. Retry it or recover its
                  server receipt before moving to another case.
                </p>
              )}
              {answer && (
                <div className="investigation-feedback" role="status">
                  <strong>
                    {answer.matches_report
                      ? "Consistent with this report"
                      : "Reconsider the evidence boundary"}
                  </strong>
                  <p>{answer.explanation}</p>
                  <small>
                    First answer recorded. Exercise score and assessment
                    evidence are unchanged.
                  </small>
                </div>
              )}
              {answer && index < report!.questions.length - 1 && (
                <button
                  className="button subtle"
                  onClick={() => {
                    setIndex(index + 1);
                    setSelection("");
                  }}
                >
                  Next case
                </button>
              )}
            </div>
          </div>
          {complete && (
            <div className="investigation-complete">
              <strong>Investigation responses recorded</strong>
              <p>
                These are post-exercise reasoning responses, not a mastery score
                or evidence of improved learning.
              </p>
              {!readOnly && (
                <a href="/academy?competency=C02">
                  Continue evidence practice in Academy
                </a>
              )}
            </div>
          )}
          <p className="footnote">{report!.note}</p>
        </>
      )}
    </section>
  );
}
