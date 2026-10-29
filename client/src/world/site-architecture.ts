import { Batches, box, frame, type MaterialKey, type Tint } from "./kit";
import type { TrainingSite } from "./training-site";

/** Original metric architecture, strictly inside the frozen sensor footprint.
 * No new material/shader or per-frame geometry. At most one mesh per kit material.
 */
export function siteArchitecture(
  structure: TrainingSite["structures"][number],
) {
  const b = new Batches();
  const s = structure,
    w = s.x_max - s.x_min,
    d = s.z_max - s.z_min,
    h = s.height;
  const cx = (s.x_min + s.x_max) / 2,
    cz = (s.z_min + s.z_max) / 2;
  const part = (
    key: MaterialKey,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    tint: Tint,
  ) => b.add(key, box(sx, sy, sz), frame(cx + x, y, cz + z), tint);
  const freight = s.style === "warehouse";
  part("concrete", 0, 0.3, 0, w - 0.1, 0.6, d - 0.1, [0.58, 0.6, 0.58]);
  part(
    "plaster",
    0,
    h / 2,
    0,
    w - 0.5,
    h - 0.5,
    d - 0.5,
    freight ? [0.9, 0.94, 0.93] : [0.88, 0.86, 0.78],
  );
  part("steel", 0, h - 0.3, 0, w - 0.1, 0.35, d - 0.1, [0.24, 0.32, 0.35]);
  const bays = Math.max(2, Math.min(14, Math.floor(w / 14)));
  const bayW = Math.min(8, ((w - 4) / bays) * 0.63),
    bayH = Math.min(7, h * 0.45);
  for (let i = 0; i < bays; i++) {
    const x = -w / 2 + ((i + 0.5) * w) / bays;
    // Facing the observation apron. All doors, glazing and ribs are inset.
    part(
      "paint",
      x,
      bayH / 2 + 0.65,
      -d / 2 + 0.14,
      bayW + 0.5,
      bayH + 0.4,
      0.12,
      [0.22, 0.29, 0.32],
    );
    part(
      freight ? "corrugated" : "glass",
      x,
      bayH / 2 + 0.65,
      -d / 2 + 0.065,
      bayW,
      bayH,
      0.04,
      freight ? [0.34, 0.39, 0.4] : [0.3, 0.51, 0.57],
    );
    part("paint", x, 0.7, -d / 2 + 0.07, bayW, 0.12, 0.05, [0.85, 0.65, 0.22]);
    part(
      "glass",
      x,
      h * 0.76,
      -d / 2 + 0.065,
      bayW * 0.8,
      Math.min(1.4, h * 0.1),
      0.04,
      [0.37, 0.58, 0.62],
    );
    part(
      "steel",
      x + (w / bays) * 0.45,
      h / 2,
      -d / 2 + 0.1,
      0.12,
      h - 0.8,
      0.12,
      [0.44, 0.5, 0.51],
    );
  }
  // Roof ventilation gives the survey view useful architectural scale.
  for (let i = 0; i < Math.min(5, bays); i++)
    part(
      "steel",
      (-0.35 + i * 0.15) * w,
      h - 0.08,
      0,
      Math.min(4, w / 12),
      0.12,
      Math.min(5, d / 8),
      [0.37, 0.43, 0.44],
    );
  return b;
}

/** Road markings follow frozen public surface coordinates, never an unrelated
 * historic quarter layout. Curbs/paint are decorative, below the sensor eye. */
export function addSiteStreetscape(b: Batches, site: TrainingSite) {
  for (const road of site.surfaces) {
    if (road.width === undefined) continue;
    for (let i = 1; i < road.path.length; i++) {
      const [ax, az] = road.path[i - 1],
        [bx, bz] = road.path[i];
      const dx = bx - ax,
        dz = bz - az,
        len = Math.hypot(dx, dz);
      if (len < 1) continue;
      const yaw = Math.atan2(dx, dz),
        nx = dz / len,
        nz = -dx / len;
      for (let at = 6; at < len; at += 14) {
        const t = at / len;
        b.add(
          "marking",
          box(0.16, 0.015, 5),
          frame(ax + dx * t, 0.07, az + dz * t, yaw),
          [0.89, 0.77, 0.48],
        );
      }
      for (const side of [-1, 1]) {
        const x = (ax + bx) / 2 + side * nx * (road.width / 2 + 0.7),
          z = (az + bz) / 2 + side * nz * (road.width / 2 + 0.7);
        b.add(
          "concrete",
          box(1.3, 0.12, len),
          frame(x, 0.06, z, yaw),
          [0.77, 0.79, 0.75],
        );
      }
    }
  }
}
