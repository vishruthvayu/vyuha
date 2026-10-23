import { useEffect, useRef, useState } from "react";
import { api } from "./storage";
import { newId } from "./unit-state";
type Fields = {
  observed_cue: string;
  remaining_uncertainty: string;
  next_check: string;
};
type Reflection = Fields & {
  id: string;
  request_id: string;
  session_id: string;
  trainee: string;
  review_hash: string;
  prompt_version: string;
  created_at: string;
};
type Envelope = {
  session_id: string;
  trainee: string;
  review_hash: string;
  prompt_version: string;
  reflections: Reflection[];
  note: string;
};
type Context = { sessionId: string; trainee: string; reviewHash: string };
const blank = (): Fields => ({
  observed_cue: "",
  remaining_uncertainty: "",
  next_check: "",
});
function draftFor(key: string) {
  if (typeof window === "undefined")
    return { request_id: newId(), fields: blank() };
  try {
    const raw = localStorage.getItem(key);
    if (raw && raw.length <= 8192) {
      const saved = JSON.parse(raw);
      if (
        /^[A-Za-z0-9_-]{8,80}$/.test(saved.request_id) &&
        ["observed_cue", "remaining_uncertainty", "next_check"].every(
          (k) =>
            typeof saved.fields?.[k] === "string" &&
            saved.fields[k].length <= 800,
        )
      )
        return saved as { request_id: string; fields: Fields };
    }
  } catch {
    /* A failed draft read must not affect the authoritative review. */
  }
  return { request_id: newId(), fields: blank() };
}
export default function LearnerReflection(context: Context) {
  return (
    <ReflectionWorkspace
      key={`${context.sessionId}:${context.trainee}:${context.reviewHash}`}
      {...context}
    />
  );
}
function ReflectionWorkspace({ sessionId, trainee, reviewHash }: Context) {
  const draftKey = `vyuha-reflection-v1:${sessionId}:${trainee}:${reviewHash}`;
  const [initial] = useState(() => draftFor(draftKey));
  const [fields, setFields] = useState<Fields>(initial.fields);
  const requestId = useRef(initial.request_id);
  const [open, setOpen] = useState(false),
    [reload, setReload] = useState(0);
  const [report, setReport] = useState<Envelope | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false),
    [draftIssue, setDraftIssue] = useState("");
  const generation = useRef(0);
  const path = `/learning/sessions/${encodeURIComponent(sessionId)}/reflections`;
  function accepted(next: Envelope) {
    if (
      next.session_id !== sessionId ||
      next.trainee !== trainee ||
      next.review_hash !== reviewHash ||
      !Array.isArray(next.reflections) ||
      next.reflections.length > 20 ||
      next.reflections.some(
        (r) =>
          r.session_id !== sessionId ||
          r.trainee !== trainee ||
          r.review_hash !== reviewHash ||
          [r.observed_cue, r.remaining_uncertainty, r.next_check].some(
            (v) => typeof v !== "string" || v.length > 800,
          ),
      )
    )
      throw new Error("Reflection response does not match this review.");
    return next;
  }
  function clearDraft() {
    try {
      localStorage.removeItem(draftKey);
    } catch {
      /* Saved server receipt remains authoritative for this note. */
    }
    requestId.current = newId();
    setFields(blank());
    setDraftIssue("");
  }
  useEffect(() => {
    if (!open) return;
    const active = ++generation.current;
    setBusy(true);
    setError("");
    setReport(null);
    void api<Envelope>(`${path}?trainee=${encodeURIComponent(trainee)}`)
      .then((next) => {
        if (active !== generation.current) return;
        const value = accepted(next);
        setReport(value);
        if (value.reflections.some((r) => r.request_id === requestId.current)) {
          clearDraft();
          setSaved(true);
        }
      })
      .catch((failure) => {
        if (active === generation.current)
          setError(
            failure instanceof Error
              ? failure.message
              : "Reflection unavailable",
          );
      })
      .finally(() => {
        if (active === generation.current) setBusy(false);
      });
    return () => {
      generation.current++;
    };
  }, [open, reload, path, trainee, reviewHash]);
  function edit(name: keyof Fields, value: string) {
    const next = { ...fields, [name]: value };
    setFields(next);
    setSaved(false);
    requestId.current = newId();
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({ request_id: requestId.current, fields: next }),
      );
      setDraftIssue("");
    } catch {
      setDraftIssue(
        "This browser cannot preserve the unsaved draft. Keep this review open until it is saved.",
      );
    }
  }
  async function save() {
    if (
      busy ||
      !report ||
      !fields.observed_cue.trim() ||
      !fields.next_check.trim() ||
      report.reflections.length >= 20
    )
      return;
    const active = ++generation.current,
      dispatchedId = requestId.current;
    setBusy(true);
    setError("");
    try {
      const next = await api<Envelope>(path, {
        request_id: dispatchedId,
        trainee,
        review_hash: reviewHash,
        ...fields,
      });
      if (active !== generation.current) return;
      const value = accepted(next);
      if (!value.reflections.some((r) => r.request_id === dispatchedId))
        throw new Error(
          "Server did not acknowledge this reflection. The draft is retained.",
        );
      setReport(value);
      clearDraft();
      setSaved(true);
    } catch (failure) {
      if (active === generation.current)
        setError(
          failure instanceof Error
            ? failure.message
            : "Save failed; the draft is retained.",
        );
    } finally {
      if (active === generation.current) setBusy(false);
    }
  }
  return (
    <details
      className="learner-reflection"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>Reflect on your decision</summary>
      <p>
        Optional learning note. Your draft stays in this browser until you save
        it on the unit server. Unit administrators can access local data;
        ordinary training transfer excludes these notes. Reflection never
        changes scores, assessed evidence or mastery estimates.
      </p>
      {open && (
        <>
          {busy && <p role="status">Loading or saving reflection…</p>}
          {error && (
            <div role="alert">
              <p>{error} Your draft is retained.</p>
              <button
                className="button subtle"
                disabled={busy}
                onClick={() => setReload((v) => v + 1)}
              >
                Reload saved reflections
              </button>
            </div>
          )}
          {draftIssue && <p role="status">{draftIssue}</p>}
          {saved && (
            <p role="status">
              Reflection saved. Original score and assessment are unchanged.
            </p>
          )}
          <label>
            What observed cue supported your decision?
            <textarea
              maxLength={800}
              rows={3}
              disabled={busy || !report}
              value={fields.observed_cue}
              onChange={(event) => edit("observed_cue", event.target.value)}
            />
          </label>
          <label>
            What remained uncertain? (optional)
            <textarea
              maxLength={800}
              rows={2}
              disabled={busy || !report}
              value={fields.remaining_uncertainty}
              onChange={(event) =>
                edit("remaining_uncertainty", event.target.value)
              }
            />
          </label>
          <label>
            What would you check or practise next?
            <textarea
              maxLength={800}
              rows={3}
              disabled={busy || !report}
              value={fields.next_check}
              onChange={(event) => edit("next_check", event.target.value)}
            />
          </label>
          <button
            className="button subtle"
            disabled={
              busy ||
              !report ||
              !fields.observed_cue.trim() ||
              !fields.next_check.trim() ||
              report.reflections.length >= 20
            }
            onClick={() => void save()}
          >
            Save reflection
          </button>
          {!!report?.reflections.length && (
            <>
              <h4>Saved reflections · {report.reflections.length}</h4>
              <ol>
                {report.reflections.map((entry) => (
                  <li key={entry.id}>
                    <time dateTime={entry.created_at}>{entry.created_at}</time>
                    <dl>
                      <dt>Observed cue</dt>
                      <dd>{entry.observed_cue}</dd>
                      {entry.remaining_uncertainty && (
                        <>
                          <dt>Uncertainty</dt>
                          <dd>{entry.remaining_uncertainty}</dd>
                        </>
                      )}
                      <dt>Next check</dt>
                      <dd>{entry.next_check}</dd>
                    </dl>
                  </li>
                ))}
              </ol>
            </>
          )}
          {report?.reflections.length === 20 && (
            <p>
              This review has reached its 20-note limit. Existing notes remain
              available.
            </p>
          )}
        </>
      )}
    </details>
  );
}
