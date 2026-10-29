import type { Action } from "./types";
import type { FusionAdvice } from "./fusion";
type Decision = Omit<Action, "tick">;
export type CapturedActionEvidence = {
  action: Decision;
  advice: FusionAdvice | null;
  confidence: number | null;
};
/** Presentation evidence belongs to dispatch, not to whichever panel happens
 * to be visible when an asynchronous worker acknowledgment arrives. Never adds
 * fields to Action or changes event ordering, scoring or server reconstruction. */
export class ActionEvidenceLedger {
  private pending = new Map<
    number,
    CapturedActionEvidence & { scope: string }
  >();
  capture(
    scope: string,
    id: number,
    action: Decision,
    advice: FusionAdvice | null,
    confidence: number | null,
  ) {
    this.pending.set(id, {
      scope,
      action: { ...action },
      advice: advice ? structuredClone(advice) : null,
      confidence,
    });
  }
  take(scope: string, id: number | undefined, action: Action) {
    if (id === undefined) return;
    const entry = this.pending.get(id);
    if (
      !entry ||
      entry.scope !== scope ||
      !(
        [
          "k",
          "track",
          "kind",
          "identity",
          "effector",
          "channel",
          "request_id",
          "decision_version",
          "reason",
        ] as const
      ).every((key) => entry.action[key] === action[key])
    )
      return;
    this.pending.delete(id);
    return entry;
  }
  clear() {
    this.pending.clear();
  }
  get size() {
    return this.pending.size;
  }
}
