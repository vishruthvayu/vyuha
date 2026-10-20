import type { Identity, Snapshot } from "./types";
export type RadarPlot = {
  id: string;
  x: number;
  z: number;
  declared: Identity | null;
  state: "tentative" | "confirmed" | "lost";
  fresh: boolean;
  sampleTick: number | null;
};
const finite = (p: { x: number; z: number } | null | undefined) =>
  p !== null && p !== undefined && Number.isFinite(p.x) && Number.isFinite(p.z);
/** Radar-only position. Never substitute EO, IR or canonical coordinates in v0.4. */
export function radarPicture(snapshot: Snapshot) {
  // v0.4 always carries falseContacts, even when empty. A damaged observation
  // cannot opt that snapshot back into legacy canonical-position presentation.
  const observationContract =
    snapshot.falseContacts !== undefined ||
    snapshot.tracks.some((t) => t.observation !== undefined);
  const status =
    snapshot.radarStatus === "failed"
      ? "failed"
      : snapshot.jammed || snapshot.radarStatus === "jammed"
        ? "jammed"
        : "normal";
  const contacts: RadarPlot[] = [];
  if (status !== "failed")
    for (const t of snapshot.tracks) {
      if (!t.active) continue;
      const r = t.observation?.radar;
      if (t.observation) {
        if (
          !r ||
          !r.available ||
          !finite(r.position) ||
          r.state === "none" ||
          (r.sample_tick !== null && r.sample_tick > snapshot.tick)
        )
          continue;
        contacts.push({
          id: t.id,
          x: r.position!.x,
          z: r.position!.z,
          declared: t.declared,
          state: r.state,
          fresh: r.fresh,
          sampleTick: r.sample_tick,
        });
      } else if (!observationContract && t.radar && finite(t))
        contacts.push({
          id: t.id,
          x: t.x,
          z: t.z,
          declared: t.declared,
          state: "confirmed",
          fresh: true,
          sampleTick: snapshot.tick,
        });
    }
  const tentative =
    status === "failed"
      ? []
      : (snapshot.falseContacts ?? []).flatMap((t) => {
          const r = t.radar;
          return r.available &&
            finite(r.position) &&
            (r.sample_tick === null || r.sample_tick <= snapshot.tick)
            ? [{ id: t.track_id, x: r.position!.x, z: r.position!.z }]
            : [];
        });
  return { status, sweep: status === "normal", contacts, tentative };
}
