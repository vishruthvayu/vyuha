import * as THREE from "three";
import type { Quality } from "./quality";
import type { Vision } from "./visibility";
import type { ThermalPalette } from "./presentation";
import { palettes } from "./presentation";

/** Fixed seeded paint/weathering only: no new occluders, remote imagery or thermal evidence. */
export function surfacePixels(size: number, style: "ground" | "facade") {
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let h = Math.imul(x + 13, 374761393) ^ Math.imul(y + 29, 668265263);
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      const noise = (h ^ (h >>> 16)) >>> 0;
      let shade = 216 + (noise % 27);
      if (style === "facade") {
        const mortar = x % 32 === 0 || y % 32 === 0;
        shade = mortar ? 208 : 230 + (noise % 12);
        // Original surface-painted maintenance panels remain flush with the frozen box.
        if (x % 32 >= 6 && x % 32 <= 25 && y % 32 >= 11 && y % 32 <= 18)
          shade = 173 + (noise % 10);
      } else if (x % 64 === 0 || y % 64 === 0) shade -= 10;
      const i = (y * size + x) * 4;
      pixels[i] = pixels[i + 1] = pixels[i + 2] = shade;
      pixels[i + 3] = 255;
    }
  return pixels;
}
export function createSurfaceTexture(
  quality: Quality,
  style: "ground" | "facade",
) {
  const size = quality === "high" ? 256 : quality === "medium" ? 128 : 64;
  const texture = new THREE.DataTexture(
    surfacePixels(size, style),
    size,
    size,
    THREE.RGBAFormat,
  );
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}
/** Background is a distant painted panorama; it never participates in geometry/LOS/depth. */
export function skyPixels(
  vision: Vision,
  rural: boolean,
  palette: ThermalPalette = "white",
) {
  const width = 256,
    height = 128;
  const data = new Uint8Array(width * height * 4);
  const thermal = vision === "thermal";
  const high = new THREE.Color(
    thermal
      ? palettes[palette].background
      : vision === "night"
        ? "#061217"
        : "#6b9db8",
  );
  const low = new THREE.Color(
    thermal
      ? palettes[palette].ground
      : vision === "night"
        ? "#263a3c"
        : "#d8d2b8",
  );
  const shade = new THREE.Color();
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      // DataTexture rows begin at the lower UV edge; north/zenith is the last row.
      const latitude = 1 - y / (height - 1);
      shade.copy(high).lerp(low, Math.pow(latitude, 1.8));
      // Seamless, low-contrast horizon illustration: not mapped terrain or a target.
      if (
        !thermal &&
        rural &&
        latitude >
          0.49 +
            0.025 * Math.sin((x / (width - 1)) * Math.PI * 8) +
            0.012 * Math.sin((x / (width - 1)) * Math.PI * 18)
      )
        shade.lerp(low, 0.45).multiplyScalar(0.76);
      shade.convertLinearToSRGB();
      const i = (y * width + x) * 4;
      data[i] = Math.round(shade.r * 255);
      data[i + 1] = Math.round(shade.g * 255);
      data[i + 2] = Math.round(shade.b * 255);
      data[i + 3] = 255;
    }
  return { data, width, height };
}
export function createSkyTexture(
  vision: Vision,
  rural: boolean,
  palette: ThermalPalette,
) {
  const image = skyPixels(vision, rural, palette);
  const texture = new THREE.DataTexture(
    image.data,
    image.width,
    image.height,
    THREE.RGBAFormat,
  );
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.wrapS = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
