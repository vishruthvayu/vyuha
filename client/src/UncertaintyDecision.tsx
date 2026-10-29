import { useRef, useState } from "react";
import type { ActionFeedback, DecisionAction } from "./GuidedDecision";
import type { Action } from "./types";
export default function UncertaintyDecision({
  track,
  enabled,
  feedback,
  onAct,
}: {
  track: string;
  enabled: boolean;
  feedback: ActionFeedback | null;
  onAct: (action: DecisionAction) => number | void;
}) {
  const [reason, setReason] = useState<NonNullable<Action["reason"]> | "">("");
  const [sent, setSent] = useState<number | null>(null);
  const pending = useRef<number | null>(null);
  const own =
    sent !== null &&
    feedback?.seq === sent &&
    feedback.action.k === "defer" &&
    feedback.action.track === track &&
    feedback.action.decision_version === "uncertainty-decisions-v1" &&
    feedback.action.reason === reason
      ? feedback
      : null;
  if (own && own.status !== "submitted") pending.current = null;
  const waiting = pending.current !== null;
  return (
    <section
      className="uncertainty-decision"
      aria-label="Explicit uncertainty decision"
    >
      <details
        onKeyDown={(event) => {
          if (event.key !== "Escape" || !event.currentTarget.open) return;
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.open = false;
          event.currentTarget.querySelector("summary")?.focus();
        }}
      >
        <summary>
          <strong>Withhold a new declaration</strong>
          <span>
            {own?.status === "accepted"
              ? "RECORDED"
              : waiting
                ? "SUBMITTING"
                : "MONITOR & INVESTIGATE"}
          </span>
        </summary>
        <div className="uncertainty-fields">
          <p>
            Keep this contact unclassified, or retain your previous declaration
            while you investigate. Defer records this choice; it does not
            designate, resolve the contact or use an effector.
          </p>
          <label>
            Declared uncertainty
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as typeof reason)}
              disabled={waiting}
            >
              <option value="">Choose your reason explicitly</option>
              <option value="type_unresolved">Type remains unresolved</option>
              <option value="affiliation_unresolved">
                Affiliation remains unresolved
              </option>
              <option value="conflicting_reports">
                Reports appear to conflict
              </option>
            </select>
          </label>
          <button
            type="button"
            className="button"
            disabled={!enabled || !reason || waiting}
            onClick={() => {
              if (!enabled || !reason || pending.current !== null) return;
              pending.current = -1;
              const id = onAct({
                k: "defer",
                track,
                decision_version: "uncertainty-decisions-v1",
                reason,
              });
              pending.current = typeof id === "number" ? id : null;
              setSent(typeof id === "number" ? id : null);
            }}
          >
            {waiting ? "Submitting Defer…" : "Record Defer"}
          </button>
          {own && (
            <p role="status">
              {own.status === "accepted"
                ? `Defer recorded at T+${((own.tick ?? 0) / 30).toFixed(2)}s. No new classification or response was submitted.`
                : own.status === "rejected"
                  ? `Defer was not accepted. ${own.reason ?? "Check the current contact and resume before trying again."}`
                  : "Waiting for the exercise worker receipt."}
            </p>
          )}
          <small>
            A declared reason is not proof of private reasoning or mastery.
            Inactivity is never interpreted as Defer.
          </small>
        </div>
      </details>
    </section>
  );
}
