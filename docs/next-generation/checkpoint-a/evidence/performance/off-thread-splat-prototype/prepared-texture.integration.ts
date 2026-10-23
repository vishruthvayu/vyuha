// TEMP-ONLY integration sketch. Copy beside existing procedural-textures.ts,
// retain production layout import, and share the original canvas helper.
import * as THREE from "three";
import type { FacilityLayout, Surface, XZ } from "./layout";
import { applyPatch, type SplatData } from "./kernel";
function canvas(w: number, h: number) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  return { c, g: c.getContext("2d")! };
}
/** Ground splat map around the facility: R laterite, G gravel, B grass,
 * A worn/darkened earth. Covers SPLAT_SIZE metres centred on the sensor. */
export const SPLAT_SIZE = 1600;
export function createPreparedSplatTexture(layout: FacilityLayout, prepared: SplatData) {
  const resolution = prepared.resolution;
  if (prepared.terrain !== layout.terrain || prepared.base.length !== resolution ** 2 * 4 || prepared.patch.length !== resolution ** 2) throw new RangeError("Prepared splat context mismatch");
  const { c, g } = canvas(resolution, resolution);
  const scale = resolution / SPLAT_SIZE;
  const toPx = ([x, z]: XZ): [number, number] => [
    (x + SPLAT_SIZE / 2) * scale,
    (SPLAT_SIZE / 2 - z) * scale,
  ];
  g.fillStyle = "rgba(0,0,0,0)";
  g.clearRect(0, 0, resolution, resolution);
  // Natural variation first: grass and bare patches from low-frequency noise.
  const image = g.getImageData(0, 0, resolution, resolution);
  image.data.set(prepared.base);
  g.putImageData(image, 0, 0);
  const channel: Record<Surface["kind"], string | null> = {
    laterite: "rgba(255,0,0,1)",
    gravel: "rgba(0,255,0,1)",
    grass: "rgba(0,0,255,0.9)",
    worn: "rgba(0,0,0,0)",
    asphalt: "rgba(0,170,0,1)",
    concrete: "rgba(0,200,0,1)",
  };
  g.globalCompositeOperation = "source-over";
  for (const s of layout.surfaces) {
    const style = channel[s.kind];
    if (s.width !== undefined) {
      g.lineCap = "round";
      g.lineJoin = "round";
      // Soft verge first, then the track itself.
      for (const [w, alpha] of [
        [s.width * 2.4, 0.35],
        [s.width * 1.15, 1],
      ] as const) {
        g.strokeStyle =
          s.kind === "worn"
            ? `rgba(0,0,0,${alpha})`
            : style!.replace(",1)", `,${alpha})`);
        g.lineWidth = Math.max(1, w * scale);
        g.beginPath();
        s.path.forEach((p, i) =>
          i ? g.lineTo(...toPx(p)) : g.moveTo(...toPx(p)),
        );
        g.stroke();
      }
    } else if (style) {
      g.fillStyle = style;
      g.beginPath();
      s.path.forEach((p, i) =>
        i ? g.lineTo(...toPx(p)) : g.moveTo(...toPx(p)),
      );
      g.closePath();
      g.fill();
    }
  }
  // Break up drawn yards and grass into patches; keep tracks continuous.
  const drawn = g.getImageData(0, 0, resolution, resolution);
  applyPatch(drawn.data, prepared.patch);
  g.putImageData(drawn, 0, 0);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 4;
  return texture;
}

