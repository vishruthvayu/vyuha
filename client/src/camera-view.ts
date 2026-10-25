import * as THREE from "three";
import type { SensorPosition } from "./sensors-v2";

export type CameraMode =
  "track" | "cue" | "hold" | "sector" | "preset" | "manual";
/** Where the live sensor camera points. Evidence only:
 *  - "track": a camera observes the selected contact and its model is drawn;
 *  - "cue": no camera observes it, but some sensor (usually radar) reports it;
 *  - "hold": it is selected but nothing reports it now, so keep the last bearing;
 *  - "sector": nothing is selected.
 * A selected contact never sends the camera back to the default sector. */
export function liveCameraMode(
  drawn: boolean,
  selectedId: string | null,
  cue: SensorPosition | null | undefined,
): CameraMode {
  if (drawn) return "track";
  if (selectedId && cue) return "cue";
  if (selectedId) return "hold";
  return "sector";
}
/** Smooth, bounded change of view: blend from where the camera points now to a
 * (possibly moving) goal over a fixed time, then lock onto the goal. */
/** Slew time for a change of view: about 150°/s like a fast pan-tilt head,
 * bounded so short corrections stay brisk and long ones stay readable. */
export function slewSeconds(angleRadians: number) {
  const degrees = THREE.MathUtils.radToDeg(Math.abs(angleRadians));
  return Math.min(0.9, Math.max(0.25, degrees / 150));
}
export class ViewBlend {
  private from = new THREE.Vector3();
  private t = 1;
  private duration = 0.4;
  start(current: THREE.Vector3, duration: number) {
    this.from.copy(current);
    this.t = 0;
    this.duration = duration;
  }
  get active() {
    return this.t < 1;
  }
  /** Writes the blended point into `out`, interpolating directions around `origin`. */
  apply(
    out: THREE.Vector3,
    goal: THREE.Vector3,
    origin: THREE.Vector3 | null,
    dt: number,
  ) {
    this.t = Math.min(1, this.t + Math.max(0, dt) / this.duration);
    const e = this.t * this.t * (3 - 2 * this.t);
    if (!origin) return out.lerpVectors(this.from, goal, e);
    const a = this.from.clone().sub(origin),
      b = goal.clone().sub(origin);
    const la = a.length(),
      lb = b.length();
    if (la < 1e-6 || lb < 1e-6) return out.lerpVectors(this.from, goal, e);
    a.divideScalar(la);
    b.divideScalar(lb);
    // Spherical interpolation: constant angular progress for a given ease.
    const angle = a.angleTo(b);
    const axis = new THREE.Vector3().crossVectors(a, b);
    const dir =
      angle < 1e-6 || axis.lengthSq() < 1e-12
        ? b.clone()
        : a.clone().applyAxisAngle(axis.normalize(), angle * e);
    return out
      .copy(origin)
      .addScaledVector(dir.normalize(), la + (lb - la) * e);
  }
}
