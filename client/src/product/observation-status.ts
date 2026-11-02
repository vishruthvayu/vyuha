import type { Snapshot } from "../types";

type Acquisition = NonNullable<Snapshot["acquisition"]>;
export type ObservationDockSnapshot = {
  tick: Snapshot["tick"];
  acquisition?: Pick<Acquisition, "pending" | "results">;
};

/** Summarises already published worker state, without requesting evidence or
 * interpreting optical shape as affiliation. Text changes at phase boundaries,
 * rather than announcing every simulation tick. */
export function observationDockStatus(snapshot?: ObservationDockSnapshot) {
  const acquisition = snapshot?.acquisition;
  if (
    !snapshot ||
    !acquisition ||
    !Number.isSafeInteger(snapshot.tick) ||
    snapshot.tick < 0
  )
    return undefined;
  const pending = pendingObservation(snapshot);
  if (pending) {
    const { channel, trackId } = pending;
    return {
      text: `${channel.toUpperCase()} task pending · ${trackId}`,
      tone: "info",
    };
  }
  // A presentation adapter cannot turn a future or malformed result into a
  // released observation, even if a caller supplies a partial recovery DTO.
  const result = publishedObservations(snapshot).at(-1);
  if (!result) return { text: "No optical publication yet", tone: "neutral" };
  const subject = `${result.channel.toUpperCase()} · ${result.trackId}`;
  if (snapshot.tick >= result.expiryTick)
    return { text: `Expired evidence · ${subject}`, tone: "caution" };
  if (!result.reading.available)
    return { text: `Channel unavailable · ${subject}`, tone: "caution" };
  return { text: `Published evidence · ${subject}`, tone: "ready" };
}

/** One presentation boundary for browser and XR. Only released, structurally
 * valid worker observations enter either evidence readout. */
export function publishedObservations(snapshot?: ObservationDockSnapshot) {
  if (
    !snapshot?.acquisition ||
    !Number.isSafeInteger(snapshot.tick) ||
    snapshot.tick < 0
  )
    return [];
  return (
    Array.isArray(snapshot.acquisition.results)
      ? snapshot.acquisition.results
      : []
  ).filter(
    (item) =>
      item &&
      ["eo", "ir"].includes(item.channel) &&
      typeof item.trackId === "string" &&
      item.trackId.length > 0 &&
      Number.isSafeInteger(item.acceptedTick) &&
      item.acceptedTick >= 0 &&
      Number.isSafeInteger(item.sampleTick) &&
      item.sampleTick >= item.acceptedTick &&
      Number.isSafeInteger(item.releaseTick) &&
      item.releaseTick >= item.sampleTick &&
      item.releaseTick <= snapshot.tick &&
      Number.isSafeInteger(item.expiryTick) &&
      item.expiryTick > item.releaseTick &&
      typeof item.reading?.available === "boolean" &&
      ["none", "detect", "recognise", "identify"].includes(
        item.reading.level,
      ) &&
      (item.reading.available || item.reading.level === "none"),
  );
}

/** Pending task metadata is a public schedule, never a future reading. */
export function pendingObservation(snapshot?: ObservationDockSnapshot) {
  const p = snapshot?.acquisition?.pending;
  if (
    !snapshot ||
    !p ||
    !Number.isSafeInteger(snapshot.tick) ||
    snapshot.tick < 0
  )
    return undefined;
  return ["eo", "ir"].includes(p.channel) &&
    typeof p.trackId === "string" &&
    p.trackId.length > 0 &&
    Number.isSafeInteger(p.acceptedTick) &&
    p.acceptedTick >= 0 &&
    p.acceptedTick <= snapshot.tick &&
    Number.isSafeInteger(p.sampleTick) &&
    p.sampleTick >= p.acceptedTick &&
    Number.isSafeInteger(p.releaseTick) &&
    p.releaseTick >= p.sampleTick &&
    p.releaseTick > snapshot.tick
    ? p
    : undefined;
}
