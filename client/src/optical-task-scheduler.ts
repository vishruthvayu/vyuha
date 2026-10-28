/** Isolated foundation; NOT a registered engine or accepted trainee action.
 * The future adapter must supply trusted observed aliases and reconstruct the
 * world at the oracle's exact logical sample tick. No score is computed. */
export type OpticalPolicy = {
  version: "optical-task-policy-v1";
  dwellTicks: number;
  cadenceTicks: number;
  latencyTicks: number;
  cooldownTicks: number;
  expiryTicks: number;
  maxReportAgeTicks: number;
  maxRequests: number;
};
export type OpticalRequest = {
  id: string;
  trackId: string;
  channel: "eo" | "ir";
};
export type OpticalReading = {
  available: boolean;
  level: "none" | "detect" | "recognise" | "identify";
};
type Query = OpticalRequest & {
  acceptedTick: number;
  acceptedOrder: number;
  sampleTick: number;
  releaseTick: number;
  resultId: string;
};
type Result = Query & {
  releasedOrder: number;
  expiryTick: number;
  reading: OpticalReading;
};
type Event = {
  tick: number;
  order: number;
  kind: "accepted" | "released" | "cancelled";
  requestId: string;
  reason?: "exercise-ended";
};
export type SchedulerReply = {
  status: "accepted" | "duplicate" | "rejected";
  reason?: string;
  query?: Query;
};
const integer = (v: unknown, lo = 0, hi = 1000000): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= lo && v <= hi;
const identifier = (v: unknown): v is string =>
  typeof v === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(v);
const keys = (v: object) => Object.keys(v).sort().join();
/** One slot through publication. All times are logical; wall time is irrelevant.
 * Local order is NOT the production engine's global event order. An adapter must
 * merge due releases before external events; this class does so for requests. */
export class OpticalTaskScheduler {
  readonly policy: OpticalPolicy;
  private tick = 0;
  private order = 0;
  private ended = false;
  private pending: Query | null = null;
  private sampled: OpticalReading | null = null;
  private requests: Query[] = [];
  private results: Result[] = [];
  private events: Event[] = [];
  private cooldownUntil = 0;
  constructor(
    policy: OpticalPolicy,
    private sample: (
      trackId: string,
      channel: "eo" | "ir",
      tick: number,
    ) => OpticalReading,
  ) {
    if (
      !policy ||
      keys(policy) !==
        [
          "version",
          "dwellTicks",
          "cadenceTicks",
          "latencyTicks",
          "cooldownTicks",
          "expiryTicks",
          "maxReportAgeTicks",
          "maxRequests",
        ]
          .sort()
          .join() ||
      policy.version !== "optical-task-policy-v1" ||
      !integer(policy.dwellTicks, 1, 9000) ||
      !integer(policy.cadenceTicks, 1, 900) ||
      !integer(policy.latencyTicks, 0, 9000) ||
      !integer(policy.cooldownTicks, 0, 9000) ||
      !integer(policy.expiryTicks, 1, 9000) ||
      !integer(policy.maxReportAgeTicks, 0, 9000) ||
      !integer(policy.maxRequests, 1, 128)
    )
      throw Error("Invalid optical scheduling policy");
    this.policy = Object.freeze({ ...policy });
  }
  snapshot() {
    return structuredClone({
      version: "optical-task-scheduler-v1",
      tick: this.tick,
      ended: this.ended,
      pending: this.pending,
      requests: this.requests,
      results: this.results,
      events: this.events,
      cooldownUntil: this.cooldownUntil,
    });
  }
  advance(tick: number) {
    if (
      !integer(tick) ||
      tick < this.tick ||
      (this.ended && tick !== this.tick)
    )
      throw Error("Invalid logical scheduler advance");
    const q = this.pending;
    let reading = this.sampled;
    if (q && !reading && q.sampleTick <= tick) {
      const r = this.sample(q.trackId, q.channel, q.sampleTick);
      if (
        !r ||
        keys(r) !== "available,level" ||
        typeof r.available !== "boolean" ||
        !["none", "detect", "recognise", "identify"].includes(r.level) ||
        (!r.available && r.level !== "none")
      )
        throw Error("Invalid sanitized optical reading");
      reading = Object.freeze({ ...r });
    }
    this.sampled = reading;
    if (q && q.releaseTick <= tick && reading) {
      const releasedOrder = ++this.order;
      this.results.push({
        ...q,
        releasedOrder,
        expiryTick: q.releaseTick + this.policy.expiryTicks,
        reading,
      });
      this.events.push({
        tick: q.releaseTick,
        order: releasedOrder,
        kind: "released",
        requestId: q.id,
      });
      this.cooldownUntil = q.releaseTick + this.policy.cooldownTicks;
      this.pending = null;
      this.sampled = null;
    }
    this.tick = tick;
  }
  request(
    tick: number,
    request: OpticalRequest,
    observed: readonly { trackId: string; reportTick: number }[],
  ): SchedulerReply {
    if (!integer(tick)) throw Error("Invalid logical scheduler advance");
    if (
      !request ||
      keys(request) !== "channel,id,trackId" ||
      !identifier(request.id) ||
      !identifier(request.trackId) ||
      !["eo", "ir"].includes(request.channel)
    )
      throw Error("Invalid optical request");
    if (
      !Array.isArray(observed) ||
      observed.length > 200 ||
      observed.some(
        (r) =>
          !r ||
          keys(r) !== "reportTick,trackId" ||
          !identifier(r.trackId) ||
          !integer(r.reportTick) ||
          r.reportTick > tick,
      ) ||
      new Set(observed.map((r) => r.trackId)).size !== observed.length
    )
      throw Error("Invalid observed prefix");
    this.advance(tick);
    const prior = this.requests.find((q) => q.id === request.id);
    if (prior)
      return prior.trackId === request.trackId &&
        prior.channel === request.channel
        ? { status: "duplicate", query: structuredClone(prior) }
        : { status: "rejected", reason: "id-conflict" };
    if (this.ended) return { status: "rejected", reason: "ended" };
    if (
      !observed.some(
        (r) =>
          r.trackId === request.trackId &&
          tick - r.reportTick <= this.policy.maxReportAgeTicks,
      )
    )
      return { status: "rejected", reason: "unavailable-or-stale" };
    if (this.pending) return { status: "rejected", reason: "busy" };
    if (tick < this.cooldownUntil)
      return { status: "rejected", reason: "cooldown" };
    if (this.requests.length >= this.policy.maxRequests)
      return { status: "rejected", reason: "request-limit" };
    const sampleTick =
      Math.ceil((tick + this.policy.dwellTicks) / this.policy.cadenceTicks) *
      this.policy.cadenceTicks;
    if (
      this.requests.some(
        (q) =>
          q.trackId === request.trackId &&
          q.channel === request.channel &&
          q.sampleTick === sampleTick,
      )
    )
      return { status: "rejected", reason: "sample-already-requested" };
    const q: Query = {
      ...request,
      acceptedTick: tick,
      acceptedOrder: ++this.order,
      sampleTick,
      releaseTick: sampleTick + this.policy.latencyTicks,
      resultId: `result_${request.id}`,
    };
    this.requests.push(q);
    this.pending = q;
    this.events.push({
      tick,
      order: q.acceptedOrder,
      kind: "accepted",
      requestId: q.id,
    });
    return { status: "accepted", query: structuredClone(q) };
  }
  end(tick: number) {
    this.advance(tick);
    if (this.ended) return;
    if (this.pending)
      this.events.push({
        tick,
        order: ++this.order,
        kind: "cancelled",
        requestId: this.pending.id,
        reason: "exercise-ended",
      });
    this.pending = null;
    this.sampled = null;
    this.ended = true;
  }
  availableResults(tick: number) {
    this.advance(tick);
    return structuredClone(
      this.results.filter((r) => tick >= r.releaseTick && tick < r.expiryTick),
    );
  }
}
