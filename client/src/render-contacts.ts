import { opticalRenderShape, type VisibleTrack } from "./visibility";

export type RenderShape = ReturnType<typeof opticalRenderShape>;
/** Deliberately excludes truth, identity, RF, doctrine, motion and classification. */
export type RenderContact = Readonly<{
  id: string;
  x: number;
  y: number;
  z: number;
  shape: RenderShape;
}>;
export function renderContacts(
  tracks: readonly VisibleTrack[],
): RenderContact[] {
  return tracks
    .filter(
      (t) =>
        t.active &&
        Number.isFinite(t.x) &&
        Number.isFinite(t.altitude) &&
        Number.isFinite(t.z),
    )
    .map((t) => ({
      id: t.id,
      x: t.x,
      y: t.altitude,
      z: t.z,
      shape: opticalRenderShape(t),
    }));
}
export type RenderPose = {
  -readonly [K in keyof RenderContact]: RenderContact[K];
} & {
  displayX: number;
  displayY: number;
  displayZ: number;
  heading: number;
  displayHeading: number;
  anchorX: number;
  anchorZ: number;
};
/** Cosmetic phase comes from logical time, so pauses and repeated seeks agree. */
export function wingAngle(id: string, tick: number) {
  let hash = 0;
  for (let i = 0; i < id.length; i++)
    hash = (Math.imul(hash, 31) + id.charCodeAt(i)) >>> 0;
  return Math.sin((tick / 30) * 9 + (hash % 628) / 100) * 0.38;
}
export function opticalFov(base: number, zoom = 1) {
  const bounded = Number.isFinite(zoom) ? Math.min(6, Math.max(1, zoom)) : 1;
  return (
    (2 * Math.atan(Math.tan((base * Math.PI) / 360) / bounded) * 180) / Math.PI
  );
}
/** A new context starts a complete window, rather than measuring from Canvas epoch0. */
export class RenderFrameMeter {
  private start: number | null = null;
  private last: number | null = null;
  private frames = 0;
  private pendingIntervals: number[] = [];
  private completedIntervals: number[] = [];
  sample(elapsed: number): number | null {
    if (!Number.isFinite(elapsed)) return null;
    if (this.start === null || elapsed < this.start) {
      this.start = elapsed;
      this.last = elapsed;
      this.frames = 0;
      this.pendingIntervals = [];
      this.completedIntervals = [];
      return null;
    }
    if (this.last !== null && elapsed > this.last) {
      this.pendingIntervals.push((elapsed - this.last) * 1000);
      if (this.pendingIntervals.length > 240) this.pendingIntervals.shift();
    }
    this.last = elapsed;
    this.frames++;
    const duration = elapsed - this.start;
    if (duration < 1) return null;
    const fps = Math.round(this.frames / duration);
    this.start = elapsed;
    this.frames = 0;
    this.completedIntervals = this.pendingIntervals;
    this.pendingIntervals = [];
    return fps;
  }
  /** Renderer callback intervals; not GPU execution times or total process memory. */
  frameIntervals() {
    const sorted = [...this.completedIntervals].sort((a, b) => a - b),
      n = sorted.length;
    if (!n) return null;
    return {
      samples: n,
      medianMs:
        (sorted[Math.floor((n - 1) / 2)] + sorted[Math.floor(n / 2)]) / 2,
      p95Ms: sorted[Math.max(0, Math.ceil(n * 0.95) - 1)],
      maxMs: sorted[n - 1],
    };
  }
}
/** Interpolate only between supplied observations. Never extrapolate a hidden trajectory. */
export class ObservedPoseBuffer {
  private poses = new Map<string, RenderPose>();
  private tick: number | null = null;
  private context = "";
  private input: readonly RenderContact[] | null = null;
  update(contacts: readonly RenderContact[], tick: number, context: string) {
    if (
      contacts === this.input &&
      tick === this.tick &&
      context === this.context
    )
      return;
    if (
      context !== this.context ||
      (this.tick !== null && (tick < this.tick || tick - this.tick > 6))
    )
      this.poses.clear();
    this.context = context;
    const ids = new Set(contacts.map((t) => t.id));
    for (const id of this.poses.keys()) if (!ids.has(id)) this.poses.delete(id);
    for (const t of contacts) {
      const old = this.poses.get(t.id);
      if (!old || old.shape !== t.shape) {
        this.poses.set(t.id, {
          ...t,
          displayX: t.x,
          displayY: t.y,
          displayZ: t.z,
          heading: 0,
          displayHeading: 0,
          anchorX: t.x,
          anchorZ: t.z,
        });
      } else {
        // Bearing is line-of-sight, not heading. Estimate only from supplied samples.
        const dx = t.x - old.anchorX,
          dz = t.z - old.anchorZ;
        if (dx * dx + dz * dz >= 1) {
          old.heading = Math.atan2(dx, dz);
          old.anchorX = t.x;
          old.anchorZ = t.z;
        }
        old.x = t.x;
        old.y = t.y;
        old.z = t.z;
      }
    }
    this.tick = tick;
    this.input = contacts;
  }
  forEachFrame(
    dt: number,
    visit: (pose: Readonly<RenderPose>) => void,
    reducedMotion = false,
  ) {
    const alpha =
      reducedMotion || !Number.isFinite(dt) || dt > 0.25
        ? 1
        : 1 - Math.exp(-Math.max(0, dt) * 21.4);
    for (const p of this.poses.values()) {
      p.displayX += (p.x - p.displayX) * alpha;
      p.displayY += (p.y - p.displayY) * alpha;
      p.displayZ += (p.z - p.displayZ) * alpha;
      const angle = Math.atan2(
        Math.sin(p.heading - p.displayHeading),
        Math.cos(p.heading - p.displayHeading),
      );
      p.displayHeading += angle * alpha;
      visit(p);
    }
  }
  snapshot() {
    return [...this.poses.values()].map((p) => ({ ...p }));
  }
}
