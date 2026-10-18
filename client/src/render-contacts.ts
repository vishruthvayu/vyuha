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
  /** Start of the current display segment and the logical tick of its target sample. */
  fromX: number;
  fromY: number;
  fromZ: number;
  sampleTick: number;
  /** Segment duration in seconds and progress through it (0..1). */
  segment: number;
  progress: number;
  /** Smoothed displayed velocity (m/s) and yaw rate (rad/s): cosmetic attitude only. */
  velocityX: number;
  velocityY: number;
  velocityZ: number;
  yawRate: number;
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
/** Display segment length relative to the interval between two observed samples.
 * Slightly longer than the sample interval, so delivery jitter never produces a
 * stop-and-go: each new sample starts from the current display position. */
export const SEGMENT_STRETCH = 1.15;
const TICK_SECONDS = 1 / 30;
/** Interpolate only between supplied observations. Never extrapolate a hidden trajectory.
 * Each new observed sample starts a linear segment from the current displayed
 * position to that sample, lasting about one sample interval. The display therefore
 * moves at the observed speed with roughly one sample of latency, and stops at the
 * latest sample when no newer one arrives. */
export class ObservedPoseBuffer {
  private poses = new Map<string, RenderPose>();
  private tick: number | null = null;
  private sinceUpdate = 0;
  /** Logical time for cosmetic animation: the latest snapshot tick, advanced by
   * wall time for at most one publish interval (3 ticks). It therefore stops
   * when the exercise pauses and follows seeks. */
  displayTick = 0;
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
          fromX: t.x,
          fromY: t.y,
          fromZ: t.z,
          sampleTick: tick,
          segment: 0,
          progress: 1,
          velocityX: 0,
          velocityY: 0,
          velocityZ: 0,
          yawRate: 0,
        });
      } else if (old.x !== t.x || old.y !== t.y || old.z !== t.z) {
        // Bearing is line-of-sight, not heading. Estimate only from supplied samples.
        const dx = t.x - old.anchorX,
          dz = t.z - old.anchorZ;
        if (dx * dx + dz * dz >= 1) {
          old.heading = Math.atan2(dx, dz);
          old.anchorX = t.x;
          old.anchorZ = t.z;
        }
        const interval = Math.min(15, Math.max(1, tick - old.sampleTick));
        old.fromX = old.displayX;
        old.fromY = old.displayY;
        old.fromZ = old.displayZ;
        old.segment = interval * TICK_SECONDS * SEGMENT_STRETCH;
        old.progress = 0;
        old.sampleTick = tick;
        old.x = t.x;
        old.y = t.y;
        old.z = t.z;
      }
    }
    if (tick !== this.tick) this.sinceUpdate = 0;
    this.tick = tick;
    this.displayTick = tick;
    this.input = contacts;
  }
  forEachFrame(
    dt: number,
    visit: (pose: Readonly<RenderPose>) => void,
    reducedMotion = false,
  ) {
    const step = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    const snap = reducedMotion || !Number.isFinite(dt) || dt > 0.25;
    this.sinceUpdate += step;
    this.displayTick = (this.tick ?? 0) + Math.min(3, this.sinceUpdate * 30);
    for (const p of this.poses.values()) {
      const beforeX = p.displayX,
        beforeY = p.displayY,
        beforeZ = p.displayZ;
      p.progress =
        snap || p.segment <= 0 ? 1 : Math.min(1, p.progress + step / p.segment);
      p.displayX = p.fromX + (p.x - p.fromX) * p.progress;
      p.displayY = p.fromY + (p.y - p.fromY) * p.progress;
      p.displayZ = p.fromZ + (p.z - p.fromZ) * p.progress;
      // Attitude cues come from the displayed (observed) path only.
      const smooth = snap || step <= 0 ? 1 : 1 - Math.exp(-step * 6);
      if (step > 0) {
        p.velocityX += ((p.displayX - beforeX) / step - p.velocityX) * smooth;
        p.velocityY += ((p.displayY - beforeY) / step - p.velocityY) * smooth;
        p.velocityZ += ((p.displayZ - beforeZ) / step - p.velocityZ) * smooth;
      }
      const angle = Math.atan2(
        Math.sin(p.heading - p.displayHeading),
        Math.cos(p.heading - p.displayHeading),
      );
      const turn = snap ? 1 : 1 - Math.exp(-step * 7);
      p.displayHeading += angle * turn;
      if (step > 0) p.yawRate += ((angle * turn) / step - p.yawRate) * smooth;
      if (snap) {
        p.velocityX = p.velocityY = p.velocityZ = p.yawRate = 0;
      }
      visit(p);
    }
  }
  /** Visit the current displayed poses without advancing them. */
  each(visit: (pose: Readonly<RenderPose>) => void) {
    for (const p of this.poses.values()) visit(p);
  }
  /** Current displayed pose of one contact, for camera framing. */
  pose(id: string): Readonly<RenderPose> | undefined {
    return this.poses.get(id);
  }
  snapshot() {
    return [...this.poses.values()].map((p) => ({ ...p }));
  }
}
