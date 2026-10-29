import type { TerrainBox } from "./sensors-v2";
/** Public authored scenery. Never contains a contact, route or future report. */
export type TrainingSite = {
  version: "training-site-v1";
  id: "freight_corridor" | "open_campus";
  title: string;
  summary: string;
  structures: (TerrainBox & {
    id: string;
    label: string;
    style: "warehouse" | "block";
  })[];
  surfaces: {
    kind: "asphalt" | "concrete" | "gravel";
    path: [number, number][];
    width?: number;
  }[];
  landmarks: {
    id: string;
    label: string;
    position: { x: number; y: number; z: number };
  }[];
};
const boxKeys = ["x_min", "x_max", "z_min", "z_max", "height"] as const;
export function validateTrainingSite(
  site: TrainingSite,
  boxes: readonly TerrainBox[],
) {
  if (
    site.version !== "training-site-v1" ||
    !["freight_corridor", "open_campus"].includes(site.id) ||
    site.structures.length < 1 ||
    site.structures.length > 12 ||
    site.structures.length !== boxes.length ||
    site.surfaces.length > 24 ||
    site.landmarks.length > 12
  )
    throw new RangeError("Unsupported authored training site");
  site.structures.forEach((b, i) => {
    if (
      boxKeys.some((k) => !Number.isFinite(b[k]) || b[k] !== boxes[i][k]) ||
      b.x_min >= b.x_max ||
      b.z_min >= b.z_max ||
      b.height < 2 ||
      b.height > 60 ||
      Math.max(...boxKeys.map((k) => Math.abs(b[k]))) > 1200 ||
      !["warehouse", "block"].includes(b.style) ||
      (b.x_min < 16 && b.x_max > -16 && b.z_min < 16 && b.z_max > -16)
    )
      throw new RangeError(
        "Training-site footprints disagree with authoritative occlusion",
      );
  });
  for (const s of site.surfaces)
    if (
      !["asphalt", "concrete", "gravel"].includes(s.kind) ||
      s.path.length < 2 ||
      s.path.length > 24 ||
      s.path.some(
        (p) =>
          p.length !== 2 ||
          p.some((v) => !Number.isFinite(v) || Math.abs(v) > 1200),
      ) ||
      (s.width !== undefined &&
        (!Number.isFinite(s.width) || s.width <= 0 || s.width > 80))
    )
      throw new RangeError("Unsupported training-site surface");
  for (const l of site.landmarks)
    if (
      Object.values(l.position).some(
        (v) => !Number.isFinite(v) || Math.abs(v) > 1200,
      )
    )
      throw new RangeError("Unsupported public landmark");
}

export function siteSurveyPose(site: TrainingSite) {
  const bounds = site.structures.reduce(
    (a, b) => ({
      x0: Math.min(a.x0, b.x_min),
      x1: Math.max(a.x1, b.x_max),
      z0: Math.min(a.z0, b.z_min),
      z1: Math.max(a.z1, b.z_max),
    }),
    { x0: 0, x1: 0, z0: 0, z1: 0 },
  );
  const x = (bounds.x0 + bounds.x1) / 2,
    z = (bounds.z0 + bounds.z1) / 2;
  const radius = Math.min(
    1050,
    Math.max(
      350,
      Math.hypot(bounds.x1 - bounds.x0, bounds.z1 - bounds.z0) * 1.05,
    ),
  );
  return {
    target: { x, y: 8, z },
    position: { x: x - radius * 0.55, y: radius * 0.75, z: z - radius * 0.8 },
  };
}
