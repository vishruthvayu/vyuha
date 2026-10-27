import {
  createMissionPlan,
  projectMission,
  type MissionScope,
  type ReportedContact,
} from "./mission-conductor";
import type { SensorObservation } from "./sensors-v2";
import type { Action } from "./types";
/** Whitelist adapter at the existing correlated worker boundary. This accepts
 * observations, never the scenario's canonical roster/type/identity fields.
 * Missing legacy contracts produce no synthetic mission guidance. */
export function missionFromReports({
  scope,
  tick,
  selected,
  observations,
  accepted,
  durationTicks,
  worldId,
  assistance,
  completed,
}: {
  scope: MissionScope;
  tick: number;
  selected: string | null;
  observations: SensorObservation[];
  accepted: Action[];
  durationTicks: number;
  worldId: string;
  assistance: "full" | "faded" | "none";
  completed: boolean;
}) {
  const plan = createMissionPlan(scope, { worldId, durationTicks, assistance });
  const contacts: ReportedContact[] = observations.map((o) => {
    if (o.version !== scope.engineVersion || o.tick !== tick)
      throw new Error("Uncorrelated mission observation");
    return {
      scope,
      id: o.track_id,
      reportTick: o.tick,
      iff: o.iff.available ? o.iff.cue : "unavailable",
      channels: [
        {
          channel: "radar",
          available: o.radar.available,
          level: o.radar.detected ? "detect" : "none",
          sampleTick: o.radar.sample_tick,
        },
        ...(["eo", "ir"] as const).map((channel) => ({
          channel,
          available: o[channel].available,
          level:
            o[channel].level === "none"
              ? ("none" as const)
              : o[channel].level === "detect"
                ? ("detect" as const)
                : ("shape" as const),
          sampleTick: o[channel].sample_tick,
        })),
      ],
    };
  });
  const decisions = accepted.map((a) => {
    if (a.order == null)
      throw new Error("Mission guidance requires recorded action order");
    return {
      scope,
      tick: a.tick,
      order: a.order,
      trackId: a.track,
      action: a.k,
      status: "accepted" as const,
    };
  });
  return projectMission(plan, {
    version: "mission-frame-v1",
    scope,
    tick,
    selectedTrackId: selected,
    contacts,
    accepted: decisions,
    completed,
  });
}

/** Selected-task fast path. Full-frame projection remains available to tooling;
 * unrelated reports/receipts cannot influence the selected advisory task. */
export function missionTaskFromReports(
  input: Parameters<typeof missionFromReports>[0],
) {
  if (input.assistance === "none") return null;
  return missionFromReports({
    ...input,
    observations: input.observations.filter(
      (o) => o.track_id === input.selected,
    ),
    accepted: input.accepted.filter((a) => a.track === input.selected),
  }).task;
}
