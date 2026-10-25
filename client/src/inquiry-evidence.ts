/** A local, ungraded observation notebook. It is not an accepted-action receipt.
 * Only the whitelisted SensorObservation projection enters a capture; canonical
 * Track, scenario roster, expected answer and Fusion advice are not inputs.
 */
import type { SensorObservation } from "./sensors-v2";

export type InquiryContext = Readonly<{
  scopeId: string;
  trackId: string;
  tick: number;
}>;
export type InquiryChannel = "eo" | "ir" | "radar" | "rf" | "iff";
export type InquiryChannelStatus =
  "unavailable" | "not_detected" | "reported" | "undated" | "invalid";
export type InquiryReading = Readonly<{
  channel: InquiryChannel;
  status: InquiryChannelStatus;
  /** Time of the containing report; RF/IFF have no separate sample timestamp. */
  reportTick: number;
  sampleTick: number | null;
  ageTicks: number | null;
  reportAgeTicks: number;
  value: string;
  detail: string;
}>;
export type InquiryMoment = Readonly<{
  schemaVersion: 1;
  scopeId: string;
  trackId: string;
  capturedTick: number;
  reportTick: number;
  readings: readonly InquiryReading[];
}>;
export type InquiryCapture =
  | Readonly<{ status: "captured"; moment: InquiryMoment }>
  | Readonly<{
      status: "missing" | "out_of_scope" | "future" | "invalid";
      reason: string;
    }>;
export type InquiryComparison = Readonly<{
  status: "comparable" | "out_of_scope";
  elapsedTicks: number | null;
  channels: readonly Readonly<{
    channel: InquiryChannel;
    change: "same_report" | "changed_report" | "not_comparable";
    before: InquiryReading;
    after: InquiryReading;
  }>[];
  /** Questions about evidence, never a type/identity/response recommendation. */
  prompts: readonly string[];
}>;
const CHANNELS = ["eo", "ir", "radar", "rf", "iff"] as const;
const LEVELS = ["none", "detect", "recognise", "identify"] as const;
const SHAPES = ["bird", "fixed_wing", "multirotor"] as const;
const RADAR_STATES = ["none", "tentative", "confirmed", "lost"] as const;
const CUES = [
  "friendly_reply",
  "registered_civil",
  "no_reply",
  "unavailable",
] as const;
const tick = (n: unknown): n is number =>
  typeof n === "number" &&
  Number.isInteger(n) &&
  n >= 0 &&
  Number.isSafeInteger(n);
const identifier = (s: unknown): s is string =>
  typeof s === "string" && s.trim().length > 0 && s.length <= 200;
const has = <T extends string>(
  items: readonly T[],
  value: unknown,
): value is T => typeof value === "string" && items.includes(value as T);
const finitePosition = (position: unknown): boolean => {
  if (!position || typeof position !== "object") return false;
  const p = position as { x?: unknown; z?: unknown; altitude?: unknown };
  return [p.x, p.z, p.altitude].every(
    (n) => typeof n === "number" && Number.isFinite(n),
  );
};
const copyReading = (reading: InquiryReading) => Object.freeze({ ...reading });

/** Invalid/future reports never enter the notebook. Individual invalid channels
 * remain explicitly invalid without disclosing their payload. A missing sample
 * timestamp is not replaced with capture time or report time.
 */
export function captureInquiryMoment(
  context: InquiryContext,
  observation: SensorObservation | null | undefined,
): InquiryCapture {
  if (
    !identifier(context.scopeId) ||
    !identifier(context.trackId) ||
    !tick(context.tick)
  )
    return { status: "invalid", reason: "Invalid capture context." };
  if (!observation)
    return { status: "missing", reason: "No observation report is available." };
  if (observation.track_id !== context.trackId)
    return {
      status: "out_of_scope",
      reason: "The observation belongs to another contact.",
    };
  if (observation.version !== "vyuha-0.4.0" || !tick(observation.tick))
    return {
      status: "invalid",
      reason: "Unsupported or invalid observation report.",
    };
  if (observation.tick > context.tick)
    return {
      status: "future",
      reason: "The report is later than the capture boundary.",
    };
  const reportTick = observation.tick;
  const reportAgeTicks = context.tick - reportTick;
  const reading = (
    channel: InquiryChannel,
    status: InquiryChannelStatus,
    value: string,
    detail: string,
    sampleTick: number | null = null,
  ): InquiryReading =>
    copyReading({
      channel,
      status,
      reportTick,
      sampleTick,
      ageTicks: sampleTick === null ? null : context.tick - sampleTick,
      reportAgeTicks,
      value,
      detail,
    });
  const invalid = (channel: InquiryChannel) =>
    reading(
      channel,
      "invalid",
      "Invalid report",
      "Payload withheld; its time or fields could not be validated.",
    );
  const optical = (channel: "eo" | "ir"): InquiryReading => {
    const o = observation[channel];
    if (!o || typeof o.available !== "boolean") return invalid(channel);
    if (!o.available)
      return reading(
        channel,
        "unavailable",
        "Unavailable",
        "No channel observation is available.",
      );
    if (!has(LEVELS, o.level)) return invalid(channel);
    if (o.level === "none")
      return reading(
        channel,
        "not_detected",
        "No detection",
        "No optical detection is reported; this does not establish absence.",
      );
    // A positive optical cue requires an actual finite observed point. A valid
    // enum/timestamp cannot make a contradictory empty/NaN report trustworthy.
    if (
      !finitePosition(o.position) ||
      (o.level === "detect"
        ? o.silhouette !== null
        : !has(SHAPES, o.silhouette))
    )
      return invalid(channel);
    if (o.sample_tick === null || o.sample_tick === undefined)
      return reading(
        channel,
        "undated",
        "Undated observation",
        "The report has no sample timestamp; shape and level are withheld.",
      );
    if (!tick(o.sample_tick) || o.sample_tick > reportTick)
      return invalid(channel);
    const shape =
      o.level !== "detect" && has(SHAPES, o.silhouette)
        ? o.silhouette.replaceAll("_", " ")
        : null;
    return reading(
      channel,
      "reported",
      o.level,
      shape
        ? `${shape} silhouette; affiliation is not established by shape.`
        : "Detection alone does not establish type or affiliation.",
      o.sample_tick,
    );
  };
  const radar = (): InquiryReading => {
    const r = observation.radar;
    if (!r || typeof r.available !== "boolean") return invalid("radar");
    if (!r.available)
      return reading(
        "radar",
        "unavailable",
        "Unavailable",
        "No radar report is available.",
      );
    if (
      !has(RADAR_STATES, r.state) ||
      typeof r.detected !== "boolean" ||
      typeof r.fresh !== "boolean" ||
      r.detected !== (r.state === "confirmed") ||
      (r.state === "confirmed" || r.state === "tentative"
        ? !finitePosition(r.position)
        : r.position !== null) ||
      r.fresh !== (r.sample_tick === reportTick)
    )
      return invalid("radar");
    if (r.state === "none")
      return reading(
        "radar",
        "not_detected",
        "No radar report",
        "No reported track does not establish absence.",
      );
    if (r.sample_tick === null || r.sample_tick === undefined)
      return reading(
        "radar",
        "undated",
        "Undated track report",
        "The report has no sample timestamp; track state is withheld.",
      );
    if (!tick(r.sample_tick) || r.sample_tick > reportTick)
      return invalid("radar");
    return reading(
      "radar",
      "reported",
      r.state,
      r.state === "lost"
        ? "The track is reported lost; its last sample is historical."
        : "Radar track state does not establish type or affiliation.",
      r.sample_tick,
    );
  };
  const rf = (): InquiryReading => {
    const r = observation.rf;
    if (!r || typeof r.available !== "boolean") return invalid("rf");
    if (!r.available)
      return reading(
        "rf",
        "unavailable",
        "Unavailable",
        "No RF report is available.",
      );
    if (typeof r.detected !== "boolean") return invalid("rf");
    return reading(
      "rf",
      r.detected ? "reported" : "not_detected",
      r.detected ? "Emission detected" : "No emission detected",
      "Separate RF sample time is not recorded. RF silence does not establish a control medium or intent.",
    );
  };
  const iff = (): InquiryReading => {
    const i = observation.iff;
    if (!i || typeof i.available !== "boolean") return invalid("iff");
    if (!i.available)
      return reading(
        "iff",
        "unavailable",
        "Unavailable",
        "No IFF report is available.",
      );
    if (!has(CUES, i.cue) || i.cue === "unavailable") return invalid("iff");
    const value =
      i.cue === "friendly_reply"
        ? "Friendly reply"
        : i.cue === "registered_civil"
          ? "Registered civil cue"
          : "No reply";
    return reading(
      "iff",
      i.cue === "no_reply" ? "not_detected" : "reported",
      value,
      "Separate IFF sample time is not recorded. No reply does not establish hostile intent.",
    );
  };
  return Object.freeze({
    status: "captured",
    moment: Object.freeze({
      schemaVersion: 1,
      scopeId: context.scopeId,
      trackId: context.trackId,
      capturedTick: context.tick,
      reportTick,
      readings: Object.freeze([
        optical("eo"),
        optical("ir"),
        radar(),
        rf(),
        iff(),
      ]),
    }),
  });
}

/** Compare snapshots without treating two correlated channels/repeated samples as
 * independent votes. Samples with unknown/invalid time cannot support a change.
 * Ordering is chronological even when the caller selects B before A.
 */
export function compareInquiryMoments(
  a: InquiryMoment,
  b: InquiryMoment,
): InquiryComparison {
  if (a.scopeId !== b.scopeId || a.trackId !== b.trackId)
    return Object.freeze({
      status: "out_of_scope",
      elapsedTicks: null,
      channels: Object.freeze([]),
      prompts: Object.freeze([
        "Choose two captures from the same exercise and contact.",
      ]),
    });
  const [before, after] = a.capturedTick <= b.capturedTick ? [a, b] : [b, a];
  const channels = CHANNELS.map((channel) => {
    const left = before.readings.find((r) => r.channel === channel)!;
    const right = after.readings.find((r) => r.channel === channel)!;
    const comparable = ![left.status, right.status].some(
      (s) => s === "invalid" || s === "undated",
    );
    // Dates stay visible in their own fields. A new timestamp alone is not a
    // changed cue, nor is an unchanged cue a new independent evidence vote.
    const same =
      left.status === right.status &&
      left.value === right.value &&
      left.detail === right.detail;
    return Object.freeze({
      channel,
      change: !comparable
        ? ("not_comparable" as const)
        : same
          ? ("same_report" as const)
          : ("changed_report" as const),
      before: copyReading(left),
      after: copyReading(right),
    });
  });
  const prompts = [
    "Which cue changed, and which is an earlier sample?",
    "Do the captures answer the same question, or leave it unresolved?",
    "Repeated or correlated reports are not independent confirmation.",
  ];
  if (
    channels.some(
      (c) =>
        c.before.status === "unavailable" || c.after.status === "unavailable",
    )
  )
    prompts.push("An unavailable channel is not a negative observation.");
  if (
    channels.some(
      (c) => c.channel === "rf" && c.after.status === "not_detected",
    ) ||
    channels.some(
      (c) => c.channel === "iff" && c.after.status === "not_detected",
    )
  )
    prompts.push(
      "RF silence or no IFF reply does not establish hostile intent.",
    );
  return Object.freeze({
    status: "comparable",
    elapsedTicks: after.capturedTick - before.capturedTick,
    channels: Object.freeze(channels),
    prompts: Object.freeze(prompts),
  });
}
