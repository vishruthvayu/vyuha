import type { FacilityLayout, Placement } from "./layout";
import { placementHeight } from "./layout";

/** Solid core of one decorative object, as an oriented box (rotation about Y).
 * Slightly inside the visible geometry, so a line of sight that only grazes an
 * edge is not counted as blocked. */
export type Obstacle = {
  x: number;
  z: number;
  cos: number;
  sin: number;
  hx: number;
  hz: number;
  y0: number;
  y1: number;
};

const box = (
  p: { x: number; z: number; rot?: number },
  hx: number,
  hz: number,
  y0: number,
  y1: number,
): Obstacle => ({
  x: p.x,
  z: p.z,
  cos: Math.cos(p.rot ?? 0),
  sin: Math.sin(p.rot ?? 0),
  hx,
  hz,
  y0,
  y1,
});

function placementObstacle(p: Placement): Obstacle | null {
  switch (p.kind) {
    case "terminal":
      return box(p, p.w / 2 - 1, p.d / 2 - 2, 0.22, p.h - 1.1);
    case "logisticsShed":
      // Only the solid core below the sawtooth eaves; not the open roof silhouette.
      return box(p, p.w / 2 - 0.3, p.d / 2 - 0.3, 0, p.h * 0.72);
    case "waterTower": {
      // Inscribed tank core; open support legs must not become a solid wall.
      const radius = Math.min(p.w, p.d) * 0.42;
      const floor = p.h * 0.78 - 0.2;
      return box(p, radius * 0.45, radius * 0.45, floor, p.h - 0.2);
    }
    case "building":
      return box(p, p.w * 0.47, p.d * 0.47, 0, p.floors * 3.4 + 0.4);
    case "house":
      return box(p, p.w * 0.47, p.d * 0.47, 0, p.h);
    case "warehouse":
      return box({ ...p, rot: 0 }, p.w * 0.47, p.d * 0.47, 0, p.h * 0.72);
    case "hangar":
      // Arched roof: the solid core under the arch.
      return box(p, p.span * 0.36, p.length * 0.48, 0, p.span * 0.36);
    case "container": {
      const base = (p.level ?? 0) * 2.6;
      return box(p, 2.9, 1.1, base, base + 2.5);
    }
    case "gatehouse":
      return box(p, 1.9, 1.6, 0.3, 3.0);
    case "genset":
      return box(p, 2.5, 1.05, 0.2, 2.6);
    case "fuelTank":
      return box(p, 2.5, 0.95, 0.5, 2.4);
    case "tent":
      return box(p, p.w * 0.45, p.l * 0.47, 0, 2.2);
    case "watchtower":
      // Open legs; only the cabin blocks.
      return box(p, 1.2, 1.2, p.h + 0.2, p.h + 2.6);
    case "plant": {
      const h = placementHeight(p);
      if (h < 2.5) return null;
      const big = p.species === "tree-jacaranda";
      return box(
        p,
        h * (big ? 0.26 : 0.3),
        h * (big ? 0.26 : 0.3),
        h * (big ? 0.4 : 0.25),
        h * 0.9,
      );
    }
    default:
      // Masts, poles, booms, pads, props and the bunker are thin or lower
      // than the 2 m sensor eye.
      return null;
  }
}

/** Decorative obstacles of a facility layout: structures, tree canopies and
 * HESCO walls. Not used by the simulation, which does not model them. */
export function sceneryObstacles(layout: FacilityLayout): Obstacle[] {
  const out: Obstacle[] = [];
  for (const p of layout.placements) {
    const o = placementObstacle(p);
    if (o) out.push(o);
  }
  for (const l of layout.lines) {
    if (l.kind !== "hesco") continue;
    const pts = l.closed ? [...l.path, l.path[0]] : l.path;
    for (let i = 1; i < pts.length; i++) {
      const [x0, z0] = pts[i - 1],
        [x1, z1] = pts[i];
      const len = Math.hypot(x1 - x0, z1 - z0);
      if (len < 0.5) continue;
      // Local z along the run (matches the kit's frame for line segments).
      const rot = Math.atan2(x1 - x0, z1 - z0);
      out.push(
        box(
          { x: (x0 + x1) / 2, z: (z0 + z1) / 2, rot },
          0.45,
          len / 2,
          0,
          2.05,
        ),
      );
    }
  }
  return out;
}

/** Does the segment a→b pass through the obstacle? Slab test in box space. */
export function segmentHits(
  o: Obstacle,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
) {
  // World → local: rotate by -rot about Y (frame() rotates local by +rot).
  const lx = (x: number, z: number) => (x - o.x) * o.cos - (z - o.z) * o.sin;
  const lz = (x: number, z: number) => (x - o.x) * o.sin + (z - o.z) * o.cos;
  const p0 = [lx(ax, az), ay, lz(ax, az)],
    p1 = [lx(bx, bz), by, lz(bx, bz)];
  const lo = [-o.hx, o.y0, -o.hz],
    hi = [o.hx, o.y1, o.hz];
  let t0 = 0,
    t1 = 1;
  for (let k = 0; k < 3; k++) {
    const d = p1[k] - p0[k];
    if (Math.abs(d) < 1e-9) {
      if (p0[k] < lo[k] || p0[k] > hi[k]) return false;
      continue;
    }
    let ta = (lo[k] - p0[k]) / d,
      tb = (hi[k] - p0[k]) / d;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return false;
  }
  return true;
}

/** Line-of-sight test from the camera against decorative scenery. A contact the
 * sensor reports but scenery would hide is drawn as a "behind scenery" marker,
 * never as an airframe painted on a wall. */
export class SceneryObstruction {
  private obstacles: Obstacle[] = [];
  /** Highest elevation (rise over horizontal distance) any obstacle reaches
   * from the last camera position: lines of sight steeper than this are clear. */
  private maxSlope = 0;
  private cx = NaN;
  private cy = NaN;
  private cz = NaN;
  readonly blocked = new Set<string>();

  set(obstacles: Obstacle[]) {
    this.obstacles = obstacles;
    this.cx = NaN;
  }

  private prepare(cx: number, cy: number, cz: number) {
    if (cx === this.cx && cy === this.cy && cz === this.cz) return;
    this.cx = cx;
    this.cy = cy;
    this.cz = cz;
    let slope = 0;
    for (const o of this.obstacles) {
      const r = Math.max(
        1,
        Math.hypot(o.x - cx, o.z - cz) - Math.hypot(o.hx, o.hz),
      );
      slope = Math.max(slope, (o.y1 - cy) / r);
    }
    this.maxSlope = slope;
  }

  /** Recompute `blocked` for the given contacts from the camera position. */
  update(
    camera: { x: number; y: number; z: number },
    each: (
      visit: (id: string, x: number, y: number, z: number) => void,
    ) => void,
  ) {
    this.blocked.clear();
    if (!this.obstacles.length) return;
    this.prepare(camera.x, camera.y, camera.z);
    each((id, x, y, z) => {
      const run = Math.hypot(x - camera.x, z - camera.z);
      if (run < 1 || (y - camera.y) / run > this.maxSlope) return;
      for (const o of this.obstacles)
        if (segmentHits(o, camera.x, camera.y, camera.z, x, y, z)) {
          this.blocked.add(id);
          return;
        }
    });
  }
}
