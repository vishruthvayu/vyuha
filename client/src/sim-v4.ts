/** Versioned declared uncertainty; no sensor, tactical score or effector change. */
import * as base from "./sim-v3";
import { HZ } from "./sim_v1_0_1";
import type { Action, AppliedCommand, Scenario, ScoreCard } from "./types";
export const ENGINE_VERSION = "vyuha-0.6.0";
export const DECISION_VERSION = "uncertainty-decisions-v1";
export const REASONS = [
  "type_unresolved",
  "affiliation_unresolved",
  "conflicting_reports",
] as const;
export function validateDecisionScenario(scenario: Scenario) {
  if (
    scenario.engine_version !== ENGINE_VERSION ||
    !scenario.decision_policy ||
    Object.keys(scenario.decision_policy).sort().join(",") !==
      "reasons,version" ||
    scenario.decision_policy.version !== DECISION_VERSION ||
    JSON.stringify(scenario.decision_policy.reasons) !== JSON.stringify(REASONS)
  )
    throw Error("Unsupported uncertainty decision engine/policy");
  base.validateAcquisitionScenario({
    ...scenario,
    engine_version: base.ENGINE_VERSION,
  });
}
export class Simulation extends base.Simulation {
  constructor(scenario: Scenario) {
    validateDecisionScenario(scenario);
    super({ ...scenario, engine_version: base.ENGINE_VERSION });
    this.scenario = scenario;
  }
  override act(input: Action) {
    if (input.k !== "defer") return super.act(input);
    const a = { ...input, order: input.order ?? this.nextOrder };
    if (
      Object.keys(a).sort().join(",") !==
        "decision_version,k,order,reason,tick,track" ||
      a.decision_version !== DECISION_VERSION ||
      !REASONS.includes(a.reason!) ||
      !Number.isInteger(a.tick) ||
      !Number.isInteger(a.order) ||
      a.tick !== this.state.tick ||
      a.order !== this.nextOrder ||
      this.state.done ||
      this.state.paused ||
      this.state.acquisition?.ended
    )
      return false;
    const t = this.state.tracks.find((t) => t.id === a.track);
    if (
      !t?.active ||
      t.detected === null ||
      this.events.some(
        (e) => e.k === "defer" && e.track === a.track && e.tick === a.tick,
      )
    )
      return false;
    this.events.push(a);
    this.globalOrder++;
    this.note(a.track, "Unclassified uncertainty declared: " + a.reason);
    this.project();
    return true;
  }
}
export function replay(
  scenario: Scenario,
  events: Action[],
  endTick: number,
  commands: AppliedCommand[] = [],
  beforeOrder?: number,
  acquisitionEndTick?: number,
) {
  const sim = new Simulation(scenario);
  const timeline = [
    ...events.map((a) => ({
      tick: a.tick,
      order: a.order,
      action: a,
      command: null as AppliedCommand | null,
    })),
    ...commands.map((c) => ({
      tick: c.tick,
      order: c.order,
      action: null as Action | null,
      command: c,
    })),
  ]
    .filter(
      (e) =>
        e.tick < endTick ||
        (e.tick === endTick &&
          (beforeOrder === undefined ||
            (e.order !== undefined && e.order < beforeOrder))),
    )
    .sort((a, b) => a.tick - b.tick || (a.order ?? -1) - (b.order ?? -1));
  let i = 0;
  if (
    acquisitionEndTick !== undefined &&
    (!Number.isInteger(acquisitionEndTick) ||
      acquisitionEndTick < 0 ||
      acquisitionEndTick > Math.round(scenario.duration * HZ))
  )
    throw Error("Invalid acquisition completion horizon");
  while (sim.state.tick <= endTick) {
    while (i < timeline.length && timeline[i].tick === sim.state.tick) {
      const e = timeline[i++];
      if (
        e.command
          ? !sim.control(e.command, e.tick, e.order)
          : !sim.act(e.action!)
      )
        throw Error(
          `Invalid active-observation event at tick ${sim.state.tick}`,
        );
    }
    if (
      sim.state.tick === acquisitionEndTick &&
      (beforeOrder === undefined || sim.nextOrder < beforeOrder)
    )
      sim.endAcquisition();
    if (sim.state.tick === endTick || sim.state.done) break;
    sim.step(true);
  }
  if (i !== timeline.length)
    throw Error("Unreconstructed active-observation event");
  return sim;
}
export function score(sim: Simulation): ScoreCard {
  return { ...base.score(sim), engine_version: ENGINE_VERSION };
}
