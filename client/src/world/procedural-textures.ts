import * as THREE from "three";
import type { FacilityLayout, Surface, XZ } from "./layout";
import { fbm } from "./terrain";
import { applySplatPatch, SPLAT_SIZE, type SplatData } from "./splat-kernel";
export { SPLAT_SIZE } from "./splat-kernel";

/** Small runtime textures drawn on a canvas: nothing to download, nothing that
 * stands for sensor data. All deterministic. */
function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return { c, g: c.getContext("2d")! };
}

/** Ground splat map around the facility: R laterite, G gravel, B grass,
 * A worn/darkened earth. Covers SPLAT_SIZE metres centred on the sensor. */
export function createSplatTexture(
  layout: FacilityLayout,
  resolution = 1024,
  prepared?: SplatData,
) {
  if (
    prepared &&
    (prepared.terrain !== layout.terrain ||
      prepared.resolution !== resolution ||
      prepared.base.length !== resolution ** 2 * 4 ||
      prepared.patch.length !== resolution ** 2)
  )
    throw new RangeError("Prepared splat context mismatch");
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
  const grassy = layout.terrain === "rural_forward_base" ? 0.5 : 0.62;
  if (prepared) image.data.set(prepared.base);
  else {
    for (let py = 0; py < resolution; py++)
      for (let px = 0; px < resolution; px++) {
        const x = px / scale - SPLAT_SIZE / 2,
          z = SPLAT_SIZE / 2 - py / scale;
        const n = fbm(x / 90 + 13, z / 90 + 5, 4);
        const m = fbm(x / 35 - 3, z / 35 + 9, 3);
        const i = (py * resolution + px) * 4;
        image.data[i + 2] = Math.max(
          0,
          Math.min(255, (n - grassy) * 900 + (m - 0.5) * 160),
        );
        image.data[i + 3] = Math.max(0, Math.min(255, (m - 0.55) * 500));
      }
  }
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
  if (prepared) applySplatPatch(drawn.data, prepared.patch);
  else {
    for (let py = 0; py < resolution; py++)
      for (let px = 0; px < resolution; px++) {
        const x = px / scale - SPLAT_SIZE / 2,
          z = SPLAT_SIZE / 2 - py / scale;
        const i = (py * resolution + px) * 4;
        const patch = fbm(x / 16 + 7, z / 16 - 2, 3);
        drawn.data[i + 1] *= Math.min(1, Math.max(0.25, patch * 1.6 - 0.15));
        drawn.data[i + 2] *= Math.min(1, Math.max(0, patch * 1.9 - 0.45));
      }
  }
  g.putImageData(drawn, 0, 0);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 4;
  return texture;
}

/** HESCO-style gabion: welded mesh over a sandy fill, one unit per 1.06 m. */
export function createHescoTexture() {
  const { c, g } = canvas(256, 256);
  for (let y = 0; y < 256; y += 4)
    for (let x = 0; x < 256; x += 4) {
      const n = fbm(x / 28, y / 28, 3);
      const v = 118 + n * 70;
      g.fillStyle = `rgb(${v + 22},${v + 10},${v - 18})`;
      g.fillRect(x, y, 4, 4);
    }
  g.strokeStyle = "rgba(70,72,66,0.95)";
  g.lineWidth = 2;
  for (let i = 0; i <= 256; i += 18) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i, 256);
    g.stroke();
    g.beginPath();
    g.moveTo(0, i);
    g.lineTo(256, i);
    g.stroke();
  }
  g.fillStyle = "rgba(40,40,36,0.9)";
  g.fillRect(0, 0, 6, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Chain-link diamonds with alpha; drawn once at 64 px per 0.5 m tile. */
export function createChainLinkTexture() {
  const { c, g } = canvas(128, 128);
  g.clearRect(0, 0, 128, 128);
  g.strokeStyle = "rgba(170,176,172,1)";
  g.lineWidth = 2.2;
  for (let i = -128; i <= 256; i += 16) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + 128, 128);
    g.stroke();
    g.beginPath();
    g.moveTo(i, 128);
    g.lineTo(i + 128, 0);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Soft radial pool for lamp light on the ground at night (additive decal). */
export function createLightPoolTexture() {
  const { c, g } = canvas(128, 128);
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,226,170,0.9)");
  grad.addColorStop(0.35, "rgba(255,214,150,0.45)");
  grad.addColorStop(1, "rgba(255,200,140,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Red/white boom-barrier and helipad paint come from vertex colours; this is a
 * neutral 1 px texture so painted parts can share textured materials. */
export function createWhiteTexture() {
  const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  t.needsUpdate = true;
  return t;
}
