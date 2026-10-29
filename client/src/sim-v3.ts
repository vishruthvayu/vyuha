/** Opt-in acquisition engine. Frozen v0.4 motion/response arithmetic is reused,
 * while optical publication, detection and event ordering are explicitly v0.5. */
import * as finale from "./sim-v2";
import { HZ } from "./sim_v1_0_1";
import { OpticalTaskScheduler } from "./optical-task-scheduler";
import { sensorConfiguration, type OpticalObservation } from "./sensors-v2";
import type {
  Action,
  AppliedCommand,
  InstructorCommand,
  Scenario,
  ScoreCard,
} from "./types";
export const ENGINE_VERSION = "vyuha-0.5.0";
type SchedulerSnapshot = ReturnType<OpticalTaskScheduler["snapshot"]>;
export type OpticalAcquisitionSnapshot = SchedulerSnapshot & {
  ordering: "scheduled-before-external-v1";
  next_order: number;
  samples: { resultId: string; observation: OpticalObservation }[];
};
export function validateAcquisitionScenario(scenario: Scenario) {
  if (
    scenario.engine_version !== ENGINE_VERSION ||
    scenario.version !== 2 ||
    !Number.isInteger(scenario.duration) ||
    scenario.duration < 60 ||
    scenario.duration > 180 ||
    !scenario.acquisition_policy ||
    scenario.tracks.length < 1 ||
    scenario.tracks.length > 20
  )
    throw Error("Unsupported active-observation scenario");
  const config = sensorConfiguration(scenario.sensor_config);
  new OpticalTaskScheduler(scenario.acquisition_policy, () => ({
    available: false,
    level: "none",
  }));
  if (scenario.acquisition_policy.cadenceTicks !== config.optical_sample_ticks)
    throw Error(
      "Acquisition cadence must match the frozen optical sensor cadence",
    );
}
export class Simulation extends finale.Simulation {
  declare private scheduler: OpticalTaskScheduler;
  declare private radarPrefix: Map<string, number>;
  declare private raw: Map<
    string,
    { eo: OpticalObservation; ir: OpticalObservation }
  >;
  declare private sampled: Map<string, OpticalObservation>;
  declare private orderMap: Map<number, number>;
  declare private schedulerCursor: number;
  declare protected globalOrder: number;
  constructor(scenario: Scenario) {
    validateAcquisitionScenario(scenario);
    super(scenario);
  }
  get nextOrder() {
    return this.globalOrder ?? 0;
  }
  private initialize() {
    this.raw ??= new Map();
    this.radarPrefix ??= new Map();
    this.sampled ??= new Map();
    this.orderMap ??= new Map();
    this.schedulerCursor ??= 0;
    this.globalOrder ??= 0;
    this.scheduler ??= new OpticalTaskScheduler(
      this.scenario.acquisition_policy!,
      (track, channel, tick) => {
        if (tick !== this.state.tick)
          throw Error(
            "Optical sampling must reconstruct the exact logical tick",
          );
        const value = this.raw.get(track)?.[channel];
        const observation: OpticalObservation = value
          ? structuredClone(value)
          : {
              available: false,
              level: "none",
              position: null,
              silhouette: null,
              sample_tick: null,
            };
        if (!this.state.tracks.find((t) => t.id === track)?.active)
          Object.assign(observation, {
            level: "none",
            position: null,
            silhouette: null,
            sample_tick: null,
          });
        this.sampled.set(`${track}:${channel}:${tick}`, observation);
        return { available: observation.available, level: observation.level };
      },
    );
  }
  private syncEvents(acceptedOrder?: number) {
    const events = this.scheduler.snapshot().events;
    for (; this.schedulerCursor < events.length; this.schedulerCursor++) {
      const e = events[this.schedulerCursor];
      const order = e.kind === "accepted" ? acceptedOrder : this.globalOrder;
      if (order === undefined || order !== this.globalOrder)
        throw Error("Acquisition event order mismatch");
      this.orderMap.set(e.order, order);
      this.globalOrder++;
    }
  }
  private evidence(): OpticalAcquisitionSnapshot {
    const data = this.scheduler.snapshot();
    const map = (value: number) => {
      const order = this.orderMap.get(value);
      if (order === undefined) throw Error("Missing acquisition event order");
      return order;
    };
    const query = <T extends { acceptedOrder: number }>(q: T) => ({
      ...q,
      acceptedOrder: map(q.acceptedOrder),
    });
    return {
      ...data,
      ordering: "scheduled-before-external-v1",
      next_order: this.nextOrder,
      pending: data.pending ? query(data.pending) : null,
      requests: data.requests.map(query),
      results: data.results.map((r) => ({
        ...query(r),
        releasedOrder: map(r.releasedOrder),
      })),
      events: data.events.map((e) => ({ ...e, order: map(e.order) })),
      samples: data.results.map((r) => ({
        resultId: r.resultId,
        observation: structuredClone(
          this.sampled.get(`${r.trackId}:${r.channel}:${r.sampleTick}`)!,
        ),
      })),
    };
  }
  protected project() {
    const results = this.scheduler
      .snapshot()
      .results.filter(
        (r) =>
          r.releaseTick <= this.state.tick && this.state.tick < r.expiryTick,
      );
    for (const track of this.state.tracks) {
      const observation = track.observation!;
      for (const channel of ["eo", "ir"] as const) {
        const raw = this.raw.get(track.id)![channel];
        const result = results
          .filter((r) => r.trackId === track.id && r.channel === channel)
          .at(-1);
        observation[channel] = result
          ? structuredClone(
              this.sampled.get(`${track.id}:${channel}:${result.sampleTick}`)!,
            )
          : {
              available: raw.available,
              level: "none",
              position: null,
              silhouette: null,
              sample_tick: null,
            };
      }
      track.thermal =
        observation.eo.level !== "none" || observation.ir.level !== "none";
      if (track.detected === null && (track.radar || track.thermal))
        track.detected = this.state.tick;
    }
    this.state.acquisition = this.evidence();
  }
  override observe() {
    this.initialize();
    const prior = new Map(this.state.tracks.map((t) => [t.id, t.detected]));
    super.observe();
    for (const t of this.state.tracks) {
      this.raw.set(t.id, {
        // The frozen base engine replaces observation objects every tick.
        // project() replaces public channels; the sampling callback owns the
        // deep copy at the actual cadence boundary, not at every 30 Hz tick.
        eo: t.observation!.eo,
        ir: t.observation!.ir,
      });
      const radar = t.observation!.radar;
      if (
        radar.position &&
        radar.sample_tick !== null &&
        ["tentative", "confirmed"].includes(radar.state)
      )
        this.radarPrefix.set(t.id, radar.sample_tick);
      t.detected = prior.get(t.id) ?? null;
      if (t.detected === null && t.radar) t.detected = this.state.tick;
    }
    if (!this.scheduler.snapshot().ended)
      this.scheduler.advance(this.state.tick);
    this.syncEvents();
    this.project();
  }
  override act(action: Action) {
    if (
      action.decision_version !== undefined ||
      action.reason !== undefined ||
      action.k === "defer"
    )
      return false;
    action = { ...action, order: action.order ?? this.nextOrder };
    if (
      action.tick !== this.state.tick ||
      action.order !== this.nextOrder ||
      this.state.done ||
      this.scheduler.snapshot().ended ||
      this.state.paused
    )
      return false;
    if (action.k === "inspect") {
      if (
        !action.channel ||
        !action.request_id ||
        action.kind !== undefined ||
        action.identity !== undefined ||
        action.effector !== undefined
      )
        return false;
      if (
        Object.keys(action).some(
          (k) =>
            !["tick", "order", "k", "track", "channel", "request_id"].includes(
              k,
            ),
        )
      )
        return false;
      const observed = [...this.radarPrefix].map(([trackId, reportTick]) => ({
        trackId,
        reportTick,
      }));
      let reply;
      try {
        reply = this.scheduler.request(
          this.state.tick,
          {
            id: action.request_id,
            trackId: action.track,
            channel: action.channel,
          },
          observed,
        );
      } catch {
        return false;
      }
      if (reply.status !== "accepted") return false;
      this.events.push({ ...action });
      this.syncEvents(action.order);
      this.project();
      return true;
    }
    if (action.channel !== undefined || action.request_id !== undefined)
      return false;
    if (!super.act(action)) return false;
    this.globalOrder++;
    this.project();
    return true;
  }
  override control(
    command: InstructorCommand,
    tick = this.state.tick,
    order = this.nextOrder,
  ) {
    if (order !== this.nextOrder) return false;
    // Reserve external order before super.control calls our observe override.
    this.globalOrder++;
    if (!super.control(command, tick, order)) {
      this.globalOrder--;
      return false;
    }
    this.project();
    return true;
  }
  endAcquisition() {
    this.scheduler.end(this.state.tick);
    this.syncEvents();
    this.project();
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
  return { ...finale.score(sim), engine_version: ENGINE_VERSION };
}
