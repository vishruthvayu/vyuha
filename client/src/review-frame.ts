import type {
  DecisionReview,
  Record as TrainingRecord,
  Snapshot,
  TimelineItem,
} from "./types";

export type ReviewContact = {
  id: string;
  declaration: string;
  radar: string;
  eo: string;
  ir: string;
  rf: string;
  iff: string;
};
const position = (p: { x: number; z: number; altitude: number } | null) =>
  p != null && [p.x, p.z, p.altitude].every(Number.isFinite);
const validTime = (sample: number | null, tick: number) =>
  sample !== null && Number.isInteger(sample) && sample >= 0 && sample <= tick;
const age = (sample: number, tick: number) =>
  `${((tick - sample) / 30).toFixed(2)}s old`;

/** Keep the observation lens and its table on one fail-closed contract.
 * Do not change shared live/VR presentation or reinterpret legacy histories. */
export function reviewObservationSnapshot(snapshot: Snapshot): Snapshot {
  const modern =
    snapshot.falseContacts !== undefined ||
    snapshot.tracks.some((t) => t.observation !== undefined);
  if (!modern) return snapshot;
  return {
    ...snapshot,
    messages: [],
    falseContacts: (snapshot.falseContacts ?? []).filter(
      (c) =>
        c.tick === snapshot.tick &&
        c.radar.available &&
        snapshot.radarStatus !== "failed" &&
        position(c.radar.position) &&
        validTime(c.radar.sample_tick, snapshot.tick),
    ),
    tracks: snapshot.tracks.flatMap((track) => {
      const o = track.observation;
      if (
        !o ||
        o.version !== "vyuha-0.4.0" ||
        o.track_id !== track.id ||
        o.tick !== snapshot.tick
      )
        return [];
      const optical = (channel: typeof o.eo) =>
        channel.available && channel.level === "none"
          ? { ...channel, position: null, silhouette: null }
          : channel.available &&
              channel.level !== "none" &&
              position(channel.position) &&
              validTime(channel.sample_tick, snapshot.tick)
            ? { ...channel, position: { ...channel.position! } }
            : {
                ...channel,
                available: false,
                level: "none" as const,
                position: null,
                silhouette: null,
                sample_tick: null,
              };
      const eo = optical(o.eo),
        ir = optical(o.ir);
      const radar =
        o.radar.available &&
        snapshot.radarStatus !== "failed" &&
        o.radar.state === "none"
          ? {
              ...o.radar,
              position: null,
              detected: false,
              fresh: false,
              sample_tick: null,
            }
          : o.radar.available &&
              snapshot.radarStatus !== "failed" &&
              o.radar.state !== "none" &&
              position(o.radar.position) &&
              validTime(o.radar.sample_tick, snapshot.tick)
            ? { ...o.radar, position: { ...o.radar.position! } }
            : {
                ...o.radar,
                available: false,
                state: "none" as const,
                position: null,
                detected: false,
                fresh: false,
                sample_tick: null,
              };
      return [
        {
          ...track,
          radar: radar.detected,
          thermal: eo.level !== "none" || ir.level !== "none",
          observation: {
            ...o,
            radar,
            eo,
            ir,
            rf: { ...o.rf, available: o.rf.available && snapshot.rfAvailable },
            iff: snapshot.rfAvailable
              ? { ...o.iff }
              : {
                  ...o.iff,
                  available: false,
                  cue: "unavailable" as const,
                  registration_id: null,
                },
          },
        },
      ];
    }),
  };
}

/** Whitelist a cursor-time UI projection. No canonical kind/identity/position,
 * scenario answer key, future samples or replay messages leave this adapter.
 * This reconstructs modeled availability, never actual gaze/viewport exposure. */
export function reviewObservationFrame(snapshot: Snapshot) {
  snapshot = reviewObservationSnapshot(snapshot);
  const modern =
    snapshot.falseContacts !== undefined ||
    snapshot.tracks.some((t) => t.observation !== undefined);
  const contacts: ReviewContact[] = [];
  for (const track of snapshot.tracks) {
    if (!track.active) continue;
    const o = track.observation;
    if (!o) {
      if (modern || !(track.radar || track.thermal)) continue;
      contacts.push({
        id: track.id,
        declaration: track.declared ?? "Unclassified",
        radar: track.radar ? "Reported · sample time unavailable" : "No report",
        eo: "Separate EO not recorded",
        ir: track.thermal
          ? "Legacy optical report · sample time unavailable"
          : "No report",
        rf: "Not recorded",
        iff: "Not recorded",
      });
      continue;
    }
    if (
      o.version !== "vyuha-0.4.0" ||
      o.track_id !== track.id ||
      o.tick !== snapshot.tick
    )
      continue;
    const radar =
      snapshot.radarStatus !== "failed" &&
      o.radar.available &&
      o.radar.state !== "none" &&
      position(o.radar.position) &&
      validTime(o.radar.sample_tick, snapshot.tick);
    const optical = (channel: typeof o.eo) =>
      channel.available &&
      channel.level !== "none" &&
      position(channel.position) &&
      validTime(channel.sample_tick, snapshot.tick);
    const eo = optical(o.eo),
      ir = optical(o.ir);
    const rf = o.rf.available && o.rf.detected;
    const iff =
      o.iff.available &&
      ["friendly_reply", "registered_civil"].includes(o.iff.cue);
    if (!(radar || eo || ir || rf || iff)) continue;
    const opticalText = (channel: typeof o.eo, usable: boolean) =>
      !channel.available
        ? "Unavailable"
        : usable
          ? `${channel.level}${channel.silhouette ? ` · ${channel.silhouette}` : ""} · ${age(channel.sample_tick!, snapshot.tick)}`
          : "No time-valid optical report";
    contacts.push({
      id: track.id,
      declaration: track.declared ?? "Unclassified",
      radar:
        !o.radar.available || snapshot.radarStatus === "failed"
          ? "Unavailable"
          : radar
            ? `${o.radar.state}${o.radar.fresh ? "" : " · coasting"} · ${age(o.radar.sample_tick!, snapshot.tick)}`
            : "No time-valid radar report",
      eo: opticalText(o.eo, eo),
      ir: opticalText(o.ir, ir),
      rf: !o.rf.available
        ? "Unavailable"
        : rf
          ? "Signal reported"
          : "No signal reported",
      iff: !o.iff.available
        ? "Unavailable"
        : o.iff.cue === "friendly_reply"
          ? "Friendly reply"
          : o.iff.cue === "registered_civil"
            ? "Registered civil reply"
            : "No reply · identity remains uncertain",
    });
  }
  return {
    tick: snapshot.tick,
    modern,
    radar: snapshot.radarStatus,
    rfAvailable: snapshot.rfAvailable,
    contacts,
  };
}

export function selectedReviewDecision(
  record: TrainingRecord,
  id: string | null,
) {
  return (
    record.decision_reviews?.find(
      (r) =>
        r.decision_id ===
        (id ??
          record.ghost_summary?.largest_loss ??
          record.ghost_summary?.strongest_decision),
    ) ??
    record.decision_reviews?.[0] ??
    null
  );
}
export function decisionMoment(review: DecisionReview) {
  return {
    tick: review.tick,
    beforeOrder: review.trainee_action
      ? (review.order ?? undefined)
      : undefined,
    track: review.track_id,
  };
}
/** Shared replay boundary semantics for the timeline and investigation chapters. */
export function timelineSeek(item: TimelineItem) {
  return {
    tick: item.tick,
    beforeOrder:
      item.order == null
        ? undefined
        : item.seek_before
          ? item.order
          : item.order + 1,
  };
}

export function reviewEpisodeMoments(
  review: DecisionReview,
  timeline: TimelineItem[],
  endTick: number,
) {
  const inRange = (tick: number | null): tick is number =>
    tick !== null && Number.isInteger(tick) && tick >= 0 && tick <= endTick;
  const at = (tick: number | null, category: TimelineItem["category"]) => {
    if (!inRange(tick)) return null;
    const event = timeline.find(
      (item) =>
        item.track_id === review.track_id &&
        item.tick === tick &&
        item.category === category,
    );
    return event ? timelineSeek(event) : { tick, beforeOrder: undefined };
  };
  const first = at(review.evidence.first_detectable_tick, "contact_detection");
  const evidence = inRange(review.evidence.tick)
    ? {
        tick: review.evidence.tick,
        beforeOrder:
          review.trainee_action && review.evidence.tick === review.tick
            ? (review.order ?? undefined)
            : undefined,
      }
    : null;
  const outcome =
    review.consequence.kind === "resolved"
      ? at(review.consequence.tick, "contact_resolution")
      : review.consequence.kind === "asset_impact"
        ? at(review.consequence.tick, "asset_impact")
        : null;
  return [
    { key: "first", label: "First modeled detectability", point: first },
    { key: "evidence", label: "Decision evidence", point: evidence },
    { key: "outcome", label: "Observed outcome", point: outcome },
  ];
}
export function evidenceAtCursor(
  review: DecisionReview | null,
  tick: number,
  beforeOrder?: number,
) {
  if (!review) return false;
  // A missing-action review can be placed at exercise end while its stored
  // evidence came from first detectability. Its within-tick boundary is unknown.
  if (
    !review.trainee_action ||
    !Number.isInteger(review.order) ||
    review.evidence.tick !== review.tick
  )
    return false;
  return review.evidence.tick === tick && review.order === beforeOrder;
}
