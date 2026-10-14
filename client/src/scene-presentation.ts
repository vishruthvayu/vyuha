import { Color } from "three";
import type { Track } from "./types";
import type { TerrainBox } from "./sensors-v2";
import {
  cameraPose,
  palettes,
  type CameraPreset,
  type ThermalPalette,
} from "./presentation";
import type { Vision } from "./visibility";
import type { Quality } from "./quality";
export type TerrainPresentationBox = {
  x: number;
  z: number;
  w: number;
  h: number;
  d: number;
};
/** Render the exact frozen occlusion box. Roof detail is vertex color, not added geometry. */
export function terrainPresentationBounds(
  boxes: readonly TerrainBox[],
): TerrainPresentationBox[] {
  return boxes.map((box) => ({
    x: (box.x_min + box.x_max) / 2,
    z: (box.z_min + box.z_max) / 2,
    w: box.x_max - box.x_min,
    h: box.height,
    d: box.z_max - box.z_min,
  }));
}
export function terrainMaterialState(
  referenceTruth: boolean,
  preset?: CameraPreset,
) {
  const transparent = referenceTruth && preset !== undefined;
  return {
    transparent,
    opacity: transparent ? 0.35 : 1,
    depthWrite: !transparent,
  };
}
/** Static appearance, not radiometry, sensor evidence or a source of contact identity. */
export function buildingSurfaceColors(
  index: number,
  vision: Vision,
  rural: boolean,
  palette: ThermalPalette = "white",
) {
  if (vision === "thermal")
    return {
      facade: index % 3 === 0 ? "#738079" : "#3b4944",
      side: "#3b4944",
      roof: palette === "black" ? "#8b968f" : "#727c75",
    };
  if (vision === "night")
    return { facade: "#26393a", side: "#203133", roof: "#3c514c" };
  return rural
    ? {
        facade: index % 3 === 0 ? "#a4aa97" : "#899482",
        side: "#647761",
        roof: "#bec2ad",
      }
    : {
        facade: index % 3 === 0 ? "#afb8b2" : "#82938f",
        side: "#667975",
        roof: "#bac5bd",
      };
}
/** BoxGeometry has24 vertices: right,left,top,bottom,front,back. One material/draw call. */
export function buildingVertexColors(
  colors: ReturnType<typeof buildingSurfaceColors>,
) {
  const array = new Float32Array(24 * 3);
  [
    colors.side,
    colors.side,
    colors.roof,
    colors.side,
    colors.facade,
    colors.facade,
  ].forEach((hex, face) => {
    const color = new Color(hex);
    for (let vertex = 0; vertex < 4; vertex++)
      array.set([color.r, color.g, color.b], (face * 4 + vertex) * 3);
  });
  return array;
}
/** Flat paint on the existing road, with no vertical dimensions or modeled occluders. */
export function roadPaint(finale: boolean, quality: Quality) {
  if (quality === "low" || quality === "tactical") return [];
  return [-8.6, 8.6].map((x) => ({
    position: [x, 0.055, 155] as [number, number, number],
    size: [0.22, finale ? 8000 : 400] as [number, number],
  }));
}
/** World supplies exactly the scope rendered by ObservationVisibility.
 * Live/observer/follow semantics remain identical. Only the explicitly labelled
 * after-review overview opts into fitting that supplied geometry. No history inferred. */
export function sceneCameraPose(
  preset: CameraPreset,
  tracks: readonly Track[],
  selected: string | null,
  referenceTruth = false,
  aspect = 1,
) {
  if (!referenceTruth || preset !== "overview")
    return cameraPose(preset, tracks, selected);
  const points = tracks.filter(
    (track) =>
      track.active &&
      Number.isFinite(track.x) &&
      Number.isFinite(track.z) &&
      Number.isFinite(track.altitude),
  );
  if (!points.length) return cameraPose(preset, [], null);
  const minX = Math.min(...points.map((t) => t.x)),
    maxX = Math.max(...points.map((t) => t.x));
  const minZ = Math.min(...points.map((t) => t.z)),
    maxZ = Math.max(...points.map((t) => t.z));
  const minY = Math.min(...points.map((t) => t.altitude)),
    maxY = Math.max(...points.map((t) => t.altitude));
  const aim: [number, number, number] = [
    (minX + maxX) / 2,
    (minY + maxY) / 2,
    (minZ + maxZ) / 2,
  ];
  const radius = Math.max(
    90,
    Math.hypot((maxX - minX) / 2, (maxY - minY) / 2, (maxZ - minZ) / 2),
  );
  const verticalHalf = (52 * Math.PI) / 360;
  const finiteAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const limitingHalf = Math.min(
    verticalHalf,
    Math.atan(Math.tan(verticalHalf) * finiteAspect),
  );
  const distance = (radius / Math.sin(limitingHalf)) * 1.15;
  return {
    effective: "overview" as CameraPreset,
    position: [aim[0], aim[1] + distance * 0.8, aim[2] + distance * 0.6] as [
      number,
      number,
      number,
    ],
    aim,
    fallback: false,
  };
}
export function sceneGroundColor(
  vision: Vision,
  rural: boolean,
  palette: ThermalPalette = "white",
) {
  return vision === "thermal"
    ? palettes[palette].ground
    : vision === "night"
      ? "#142b2b"
      : rural
        ? "#617153"
        : "#66756c";
}

/** A fitted truth-review camera must not be clipped by the unchanged live display envelope.
 * This changes review rendering only; modeled sensor range and weather remain untouched. */
export function sceneReviewEnvelope(
  tracks: readonly Track[],
  selected: string | null,
  referenceTruth: boolean,
  preset: CameraPreset | undefined,
  aspect: number,
  original: { far: number; fogNear: number; fogFar: number },
) {
  if (!referenceTruth || preset !== "overview") return original;
  const pose = sceneCameraPose(
    preset,
    tracks,
    selected,
    referenceTruth,
    aspect,
  );
  const distances = tracks
    .filter(
      (t) =>
        t.active &&
        Number.isFinite(t.x) &&
        Number.isFinite(t.z) &&
        Number.isFinite(t.altitude),
    )
    .map((t) =>
      Math.hypot(
        t.x - pose.position[0],
        t.altitude - pose.position[1],
        t.z - pose.position[2],
      ),
    );
  if (!distances.length) return original;
  const furthest = Math.max(...distances);
  return {
    far: Math.max(original.far, furthest + 100),
    fogNear: Math.max(original.fogNear, furthest + 100),
    fogFar: Math.max(original.fogFar, furthest + 500),
  };
}
