import type { TerrainBox } from "../sensors-v2";
import type { FacilityLayout, Placement } from "./layout";
import { facilityLayout, withoutBoxes } from "./layout";
import type { TerrainKind } from "./terrain";
import {
  validateTrainingSite,
  type TrainingSite,
} from "../training-site-contract";
export {
  validateTrainingSite,
  siteSurveyPose,
  siteArrivalPose,
  type TrainingSite,
} from "../training-site-contract";

/** One shared layout for browser, XR and decorative obstruction handling. */
export function trainingSiteLayout(
  terrain: TerrainKind,
  boxes: readonly TerrainBox[],
  site?: TrainingSite,
): FacilityLayout {
  if (!site) return withoutBoxes(facilityLayout(terrain), boxes);
  validateTrainingSite(site, boxes);
  const placements: Placement[] = [
    { kind: "sensorMast", x: 0, z: 0 },
    { kind: "bunker", x: -12, z: -10, rot: 0 },
    { kind: "helipad", x: -40, z: -24, size: 18 },
    { kind: "radarMast", x: 25, z: -24, h: 8 },
  ];
  // Local landmarks mark the public site, not targets or modeled evidence.
  site.landmarks.forEach((l, i) => {
    if (Math.hypot(l.position.x, l.position.z) > 20)
      placements.push({
        kind: "lightPole",
        x: l.position.x,
        z: l.position.z,
        rot: i % 2 ? Math.PI : 0,
      });
  });
  // A stable, bounded dressing grammar gives the large site readable scale.
  // These are explicitly decorative; only structures become sensor boxes.
  site.structures.forEach((b, index) => {
    const cx = (b.x_min + b.x_max) / 2,
      front = b.z_min - 22;
    for (const offset of [-0.28, 0.28])
      placements.push({
        kind: "container",
        x: cx + (b.x_max - b.x_min) * offset,
        z: front,
        rot: Math.PI / 2,
        tint: index % 2 ? 0.35 : 0.65,
      });
    placements.push({
      kind: "prop",
      model: "covered-car",
      x: cx - 12,
      z: front - 13,
      rot: Math.PI / 2,
      scale: 1,
    });
    placements.push({
      kind: "prop",
      model: "utility-box",
      x: b.x_max + 18,
      z: b.z_min + 8,
      rot: 0,
      scale: 1,
    });
  });
  for (let i = 0; i < 13; i++)
    for (const side of [-1, 1])
      placements.push({
        kind: "plant",
        species: i % 3 === 0 ? "tree-island" : "tree-jacaranda",
        x: side * (355 + (i % 2) * 12),
        z: -280 + i * 68,
        rot: (i * 0.73) % 6.28,
        scale: i % 3 === 0 ? 1.9 : 0.65,
      });
  for (let i = 0; i < 9; i++)
    placements.push({
      kind: "lightPole",
      x: -320 + i * 80,
      z: site.id === "freight_corridor" ? 180 : 210,
      rot: 0,
    });
  return withoutBoxes(
    {
      terrain,
      placements,
      lines: [
        {
          kind: "fence",
          path: [
            [-330, 240],
            [-330, 520],
          ],
        },
        {
          kind: "fence",
          path: [
            [330, 240],
            [330, 520],
          ],
        },
        {
          kind: "fence",
          path: [
            [-65, -50],
            [65, -50],
          ],
        },
      ],
      surfaces: site.surfaces.map((s) => ({
        ...s,
        path: s.path.map((p) => [...p] as [number, number]),
      })),
      compound: [],
    },
    boxes,
  );
}
