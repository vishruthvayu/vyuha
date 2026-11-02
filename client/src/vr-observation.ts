import type { Action, Scenario, Snapshot } from "./types";
import { isAcquisitionEngine } from "./engine-contracts";
import type { VRPhase } from "./vr";
import {
  publishedObservations,
  pendingObservation,
  observationDockStatus,
} from "./product/observation-status";
export const VR_OBSERVATION_ADAPTER = "vr-observation-adapter-v1";
export const vrDeferReasons = [
  "type_unresolved",
  "affiliation_unresolved",
  "conflicting_reports",
] as const;
export function vrEngineReason(scenario: Scenario): string | null {
  const version = scenario.engine_version;
  if (
    version === undefined ||
    version === "vyuha-0.2.0" ||
    version === "vyuha-0.3.0"
  )
    return scenario.version === 1
      ? null
      : "Unsupported historical scenario schema.";
  if (!["vyuha-0.4.0", "vyuha-0.5.0", "vyuha-0.6.0"].includes(version))
    return "No VR adapter is admitted for this engine version.";
  if (scenario.version !== 2)
    return "Unsupported scenario schema for this engine.";
  if (
    isAcquisitionEngine(version) &&
    scenario.acquisition_policy?.version !== "optical-task-policy-v1"
  )
    return "The frozen acquisition policy is missing or unsupported.";
  if (
    version === "vyuha-0.6.0" &&
    (scenario.decision_policy?.version !== "uncertainty-decisions-v1" ||
      JSON.stringify(scenario.decision_policy.reasons) !==
        JSON.stringify(vrDeferReasons))
  )
    return "The frozen uncertainty decision policy is missing or unsupported.";
  return null;
}
export function vrLaunchReadiness(
  scenario: Scenario,
  phase: VRPhase,
  prepared: boolean,
  busy: boolean,
) {
  const reason =
    phase === "restoring"
      ? "Wait for saved evidence reconstruction."
      : phase === "complete"
        ? "Prepare the next exercise to open the cockpit."
        : busy
          ? "Wait for the current request to finish."
          : phase === "ready" && !prepared
            ? "Prepare the mission before opening its VR cockpit."
            : vrEngineReason(scenario);
  return {
    allowed: !reason,
    reason:
      reason ??
      "Desktop cockpit preview is ready. Headset support is checked inside the cockpit.",
  };
}
export function vrInspectAction(
  state: Snapshot,
  phase: VRPhase,
  scenario: Scenario,
  selected: string | null,
  channel: "eo" | "ir",
  requestId: string,
): Omit<Action, "tick"> | undefined {
  if (
    vrEngineReason(scenario) ||
    !isAcquisitionEngine(scenario.engine_version) ||
    phase !== "running" ||
    state.done ||
    state.paused ||
    !state.acquisition ||
    state.acquisition.ended ||
    state.acquisition.pending ||
    !["eo", "ir"].includes(channel) ||
    !/^[A-Za-z0-9_-]{1,80}$/.test(requestId)
  )
    return;
  const t = state.tracks.find((t) => t.id === selected && t.active),
    r = t?.observation?.radar;
  if (
    !r?.available ||
    !r.detected ||
    !Number.isSafeInteger(r.sample_tick) ||
    r.sample_tick === null ||
    r.sample_tick < 0 ||
    r.sample_tick > state.tick
  )
    return;
  return { k: "inspect", track: t!.id, channel, request_id: requestId };
}
export function vrDeferAction(
  state: Snapshot,
  phase: VRPhase,
  scenario: Scenario,
  selected: string | null,
  reason: Action["reason"] | null,
): Omit<Action, "tick"> | undefined {
  if (
    vrEngineReason(scenario) ||
    scenario.engine_version !== "vyuha-0.6.0" ||
    phase !== "running" ||
    state.done ||
    state.paused ||
    !state.acquisition ||
    state.acquisition.ended ||
    !reason ||
    !vrDeferReasons.includes(reason)
  )
    return;
  // Same browser/engine boundary: a previously detected active alias may retain
  // uncertainty even if its current radar report has disappeared.
  const t = state.tracks.find(
    (t) => t.id === selected && t.active && t.detected !== null,
  );
  if (!t) return;
  return {
    k: "defer",
    track: t.id,
    reason,
    decision_version: "uncertainty-decisions-v1",
  };
}
export function vrObservationEvidence(
  state: Snapshot,
  selected: string | null,
) {
  const a = state.acquisition;
  if (!a) return [] as string[];
  const lines: string[] = [];
  const pending = pendingObservation(state);
  if (pending)
    lines.push(
      `Pending ${pending.channel.toUpperCase()} / ${pending.trackId}`,
      `Request ${(pending.acceptedTick / 30).toFixed(2)}s → sample ${(pending.sampleTick / 30).toFixed(2)}s → release ${(pending.releaseTick / 30).toFixed(2)}s`,
    );
  const results = publishedObservations(state)
    .filter((r) => r.trackId === selected)
    .slice(-2)
    .reverse();
  for (const r of results) {
    const expired = state.tick >= r.expiryTick;
    lines.push(
      `${r.channel.toUpperCase()} / ${r.trackId} · ${expired ? "EXPIRED" : !r.reading.available ? "UNAVAILABLE" : "RELEASED"}`,
      `Sample ${(r.sampleTick / 30).toFixed(2)}s · published ${(r.releaseTick / 30).toFixed(2)}s · expiry ${(r.expiryTick / 30).toFixed(2)}s`,
      expired
        ? "Past result; not current evidence"
        : !r.reading.available
          ? "Channel unavailable"
          : r.reading.level === "none"
            ? "No modeled detection"
            : r.reading.level === "detect"
              ? "Detection only"
              : `Shape ${r.reading.level}; affiliation unresolved`,
    );
  }
  if (!results.length) lines.push("No released observation for this contact.");
  return lines;
}
export function vrObservationStatus(state: Snapshot) {
  return observationDockStatus(state)?.text ?? "Passive observation engine";
}
