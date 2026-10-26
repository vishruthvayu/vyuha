import { Batches, box, frame, type Tint } from "./kit";
import type { FacilityLayout } from "./layout";

/** Original metric streetscape. All additions are static, decorative world-layer
 * geometry and use the existing thermal/material classes. No arrows, symbols or
 * activity imply a target identity, detection, response or scenario outcome. */
export function addStreetscape(b: Batches, layout: FacilityLayout) {
  if (layout.terrain !== "urban_outpost") return;
  const add = (
    key: "concrete" | "marking" | "paint",
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    tint: Tint = [1, 1, 1],
  ) => b.add(key, box(w, h, d), frame(x, y, z), tint);
  // Continuous pavements and contrasting curb joints along the main east/west avenue.
  for (const z of [-166, -150]) {
    add("concrete", 0, 0.08, z, 920, 0.16, 2.2, [0.79, 0.8, 0.77]);
    for (let i = 0; i < 92; i++)
      add("paint", -455 + i * 10, 0.17, z, 0.09, 0.015, 2.2, [0.24, 0.29, 0.3]);
  }
  for (let x = -450; x <= 450; x += 12)
    add("marking", x, 0.047, -158, 5, 0.008, 0.14, [0.83, 0.73, 0.43]);
  // Two deliberate pedestrian crossings connect service/public courts.
  for (const cx of [-125, 125])
    for (let i = 0; i < 8; i++)
      add(
        "marking",
        cx - 4.2 + i * 1.2,
        0.05,
        -158,
        0.65,
        0.01,
        9,
        [0.88, 0.87, 0.78],
      );
  for (const x of [-136, 136])
    add("concrete", x, 0.08, 81, 2, 0.16, 130, [0.75, 0.78, 0.75]);
  // A clean public forecourt: scale cues and spatial structure without moving clutter.
  add("concrete", -68, 0.12, 44, 78, 0.24, 24, [0.83, 0.83, 0.78]);
  for (let i = 0; i < 15; i++)
    add("paint", -104 + i * 5, 0.247, 44, 0.07, 0.01, 24, [0.39, 0.43, 0.43]);
  // Six small loading/parking bays, warm marking tone distinct from dark asphalt.
  for (let i = 0; i < 7; i++)
    add("marking", -83 + i * 4, 0.265, 38, 0.1, 0.01, 5, [0.82, 0.77, 0.55]);
  for (const [x, z] of [
    [-106, 51],
    [-30, 51],
    [-106, 34],
    [-30, 34],
  ]) {
    add("concrete", x, 0.35, z, 2.8, 0.7, 2.8, [0.72, 0.75, 0.69]);
    add("paint", x, 0.715, z, 2.3, 0.03, 2.3, [0.22, 0.28, 0.18]);
  }
  // Drainage/service edges tie large sheds to their aprons.
  for (let i = 0; i < 18; i++)
    add("paint", 47 + i * 4, 0.065, 61, 2.8, 0.03, 0.22, [0.19, 0.22, 0.23]);
}
