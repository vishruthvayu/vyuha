import { Batches, box, frame, type MaterialKey, type Tint } from "./kit";
import type { TrainingSite } from "./training-site";
import type { Quality } from "../quality";
import { ArchitectureCache } from "./architecture-cache";
import { SITE_PRESENTATION_VERSION } from "./presentation-profile";
const architectureCache = new ArchitectureCache();

export function siteArchitecture(
  s: TrainingSite["structures"][number],
  quality: Quality = "medium",
) {
  const key = JSON.stringify([SITE_PRESENTATION_VERSION, quality, s]);
  return {
    merged: () =>
      architectureCache.get(key, () =>
        buildSiteArchitecture(s, quality).merged(),
      ),
  };
}

/** Original industrial architectural grammar. All built detail stays inside
 * the admitted AABB; openings are visual recesses, never new sensor apertures. */
function buildSiteArchitecture(
  s: TrainingSite["structures"][number],
  quality: Quality = "medium",
) {
  const b = new Batches(),
    w = s.x_max - s.x_min,
    d = s.z_max - s.z_min,
    h = s.height;
  const cx = (s.x_min + s.x_max) / 2,
    cz = (s.z_min + s.z_max) / 2;
  const add = (
    key: MaterialKey,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    tint: Tint,
    yaw = 0,
  ) => b.add(key, box(sx, sy, sz), frame(cx + x, y, cz + z, yaw), tint);
  const freight = s.style === "warehouse";
  const mineral: Tint = freight ? [0.88, 0.91, 0.88] : [0.92, 0.88, 0.78],
    metal: Tint = [0.4, 0.52, 0.56],
    ink: Tint = [0.28, 0.33, 0.35];
  add("concrete", 0, 0.3, 0, w - 0.1, 0.6, d - 0.1, [0.63, 0.65, 0.61]);
  add("plaster", 0, (h - 2) / 2 + 0.6, 0, w - 2, h - 2, d - 2, mineral);
  add("concrete", 0, 1, 0, w - 0.8, 1.4, d - 0.8, [0.51, 0.55, 0.53]);
  // A stepped roof and raised perimeter give the mass a readable silhouette.
  add("corrugated", 0, h - 1.25, 0, w - 0.3, 0.35, d - 0.3, [0.8, 0.85, 0.84]);
  for (const side of [-1, 1]) {
    add("steel", 0, h - 0.65, side * (d / 2 - 0.18), w - 0.2, 0.85, 0.2, metal);
    add("steel", side * (w / 2 - 0.18), h - 0.65, 0, 0.2, 0.85, d - 0.2, metal);
  }
  if (quality === "low" || quality === "tactical") return b;
  const faces = [
    { span: w, x: 0, z: -d / 2 + 0.22, yaw: 0, dx: 1, dz: 0 },
    { span: w, x: 0, z: d / 2 - 0.22, yaw: 0, dx: 1, dz: 0 },
    { span: d, x: -w / 2 + 0.22, z: 0, yaw: Math.PI / 2, dx: 0, dz: 1 },
    { span: d, x: w / 2 - 0.22, z: 0, yaw: Math.PI / 2, dx: 0, dz: 1 },
  ];
  faces.forEach((f, face) => {
    const n = Math.max(2, Math.min(26, Math.floor(f.span / (freight ? 9 : 7)))),
      step = f.span / n;
    for (let i = 0; i < n; i++) {
      const at = -f.span / 2 + (i + 0.5) * step,
        x = f.x + f.dx * at,
        z = f.z + f.dz * at;
      const tint: Tint = [
        mineral[0] * (0.94 + (i % 3) * 0.025),
        mineral[1] * (0.94 + (i % 3) * 0.025),
        mineral[2] * (0.94 + (i % 3) * 0.025),
      ];
      add(
        "plaster",
        x,
        h * 0.54,
        z,
        step - 0.35,
        Math.max(1, h * 0.6),
        0.12,
        tint,
        f.yaw,
      );
      add(
        "steel",
        x + f.dx * (step / 2 - 0.16),
        h / 2,
        z + f.dz * (step / 2 - 0.16),
        0.24,
        h - 1.4,
        0.28,
        metal,
        f.yaw,
      );
      if (freight) {
        const doorH = Math.min(6.4, h * 0.37);
        add(
          "paint",
          x,
          doorH / 2 + 0.62,
          z,
          Math.min(5.8, step - 0.8),
          doorH + 0.24,
          0.28,
          ink,
          f.yaw,
        );
        add(
          "corrugated",
          x,
          doorH / 2 + 0.62,
          z,
          Math.min(5.3, step - 1.3),
          doorH,
          0.31,
          [0.66, 0.73, 0.73],
          f.yaw,
        );
        add(
          "paint",
          x,
          0.68,
          z,
          Math.min(5.3, step - 1.3),
          0.16,
          0.34,
          [0.87, 0.66, 0.25],
          f.yaw,
        );
        add(
          "glass",
          x,
          h * 0.78,
          z,
          step - 0.9,
          Math.min(2.1, h * 0.12),
          0.25,
          [0.65, 0.83, 0.88],
          f.yaw,
        );
        if (face === 0 && i % 3 === 1) {
          // Loading-canopy frame is inset into the modeled volume.
          add("steel", x, doorH + 1.1, z, step - 0.6, 0.18, 0.36, metal, f.yaw);
        }
      } else {
        const floors = Math.max(2, Math.min(4, Math.floor(h / 3.4)));
        for (let floor = 0; floor < floors; floor++) {
          const y = 2.1 + (floor * (h - 3)) / floors;
          add("paint", x, y, z, step - 0.8, 2.1, 0.28, ink, f.yaw);
          add(
            "glass",
            x,
            y,
            z,
            step - 1.1,
            1.8,
            0.31,
            [0.7, 0.85, 0.87],
            f.yaw,
          );
          add("steel", x, y, z, 0.1, 1.9, 0.35, metal, f.yaw);
          add(
            "concrete",
            x,
            y - 1.15,
            z,
            step - 0.5,
            0.14,
            0.32,
            [0.83, 0.85, 0.79],
            f.yaw,
          );
        }
      }
      if (quality === "high")
        add(
          "steel",
          x,
          h * 0.54,
          z,
          0.07,
          Math.max(1, h * 0.6),
          0.36,
          [0.63, 0.69, 0.68],
          f.yaw,
        );
    }
  });
  // Rooftop plant, skylights and piping stay below the maximum roof height.
  const plantCount = Math.min(8, Math.max(2, Math.floor(w / 22)));
  for (let i = 0; i < plantCount; i++) {
    const x = (-0.35 + (i * 0.7) / Math.max(1, plantCount - 1)) * w;
    add("steel", x, h - 0.65, 0, 3.5, 0.9, 4.5, [0.64, 0.69, 0.67]);
    add("paint", x, h - 0.12, 0, 2.6, 0.12, 3.6, [0.28, 0.36, 0.38]);
    add(
      "glass",
      x,
      h - 0.98,
      d * 0.24,
      5,
      0.08,
      Math.min(8, d * 0.2),
      [0.68, 0.8, 0.8],
    );
    if (quality === "high")
      for (let fin = 0; fin < 5; fin++)
        add("steel", x - 1.2 + fin * 0.6, h - 0.08, 0, 0.12, 0.1, 3.8, metal);
  }
  return b;
}

/** Metric surface composition: joints, lane edges, loading courts and tactile
 * scale cues follow public surfaces only. Everything remains decorative. */
export function addSiteStreetscape(
  b: Batches,
  site: TrainingSite,
  quality: Quality = "medium",
) {
  for (const surface of site.surfaces) {
    if (surface.width === undefined) {
      if (surface.kind !== "concrete" || quality === "low") continue;
      const xs = surface.path.map((p) => p[0]),
        zs = surface.path.map((p) => p[1]);
      const x0 = Math.min(...xs),
        x1 = Math.max(...xs),
        z0 = Math.min(...zs),
        z1 = Math.max(...zs);
      // Canonical site polygons are rectangles; no free-form author geometry.
      for (let x = x0 + 5; x < x1; x += 5)
        b.add(
          "paint",
          box(0.035, 0.012, z1 - z0),
          frame(x, 0.062, (z0 + z1) / 2),
          [0.38, 0.43, 0.42],
        );
      for (let z = z0 + 5; z < z1; z += 5)
        b.add(
          "paint",
          box(x1 - x0, 0.012, 0.035),
          frame((x0 + x1) / 2, 0.062, z),
          [0.38, 0.43, 0.42],
        );
      continue;
    }
    for (let i = 1; i < surface.path.length; i++) {
      const [ax, az] = surface.path[i - 1],
        [bx, bz] = surface.path[i],
        dx = bx - ax,
        dz = bz - az,
        len = Math.hypot(dx, dz);
      if (len < 1) continue;
      const yaw = Math.atan2(dx, dz),
        nx = dz / len,
        nz = -dx / len;
      for (let at = 6; at < len; at += 14)
        b.add(
          "marking",
          box(0.16, 0.015, 5),
          frame(ax + (dx * at) / len, 0.07, az + (dz * at) / len, yaw),
          [0.89, 0.77, 0.48],
        );
      for (const side of [-1, 1]) {
        b.add(
          "concrete",
          box(1.3, 0.12, len),
          frame(
            (ax + bx) / 2 + side * nx * (surface.width / 2 + 0.7),
            0.06,
            (az + bz) / 2 + side * nz * (surface.width / 2 + 0.7),
            yaw,
          ),
          [0.77, 0.79, 0.75],
        );
        if (quality !== "low")
          b.add(
            "marking",
            box(0.1, 0.014, len),
            frame(
              (ax + bx) / 2 + side * nx * (surface.width / 2 - 0.35),
              0.065,
              (az + bz) / 2 + side * nz * (surface.width / 2 - 0.35),
              yaw,
            ),
            [0.78, 0.8, 0.74],
          );
      }
    }
  }
}
