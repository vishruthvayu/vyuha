import sky from "./assets/sky.json";
import vegetation from "./assets/vegetation.json";
import type { PropModel, Species } from "./layout";

/** Every runtime asset is bundled locally (hashed by Vite, precached for offline
 * use by scripts/offline.mjs). No CDN, no remote decoder. Sources and licences:
 * docs/drill-rescue/ASSET-PROVENANCE.md. */
const url = (name: string) => new URL(`./assets/${name}`, import.meta.url).href;

export const SKY = {
  day: url("sky-day.webp"),
  night: url("sky-night.webp"),
  meta: sky,
};
export const TEXTURES = {
  groundDry: [
    "ground-dry-albedo.webp",
    "ground-dry-normal.webp",
    "ground-dry-orm.webp",
  ],
  groundMacro: ["ground-macro-albedo.webp"],
  laterite: ["ground-laterite-albedo.webp", "ground-laterite-normal.webp"],
  gravel: ["ground-gravel-albedo.webp", "ground-gravel-normal.webp"],
  grass: ["ground-grass-albedo.webp"],
  asphalt: ["asphalt-albedo.webp", "asphalt-normal.webp", "asphalt-orm.webp"],
  concreteFloor: [
    "concrete-floor-albedo.webp",
    "concrete-floor-normal.webp",
    "concrete-floor-orm.webp",
  ],
  concreteWall: [
    "concrete-wall-albedo.webp",
    "concrete-wall-normal.webp",
    "concrete-wall-orm.webp",
  ],
  plaster: ["plaster-albedo.webp", "plaster-normal.webp", "plaster-orm.webp"],
  corrugated: [
    "corrugated-albedo.webp",
    "corrugated-normal.webp",
    "corrugated-orm.webp",
  ],
  paintedMetal: [
    "painted-metal-albedo.webp",
    "painted-metal-normal.webp",
    "painted-metal-orm.webp",
  ],
  vegetation: ["vegetation-atlas.webp"],
} as const;
export const TEXTURE_URLS = Object.fromEntries(
  Object.entries(TEXTURES).map(([k, files]) => [k, files.map(url)]),
) as { [K in keyof typeof TEXTURES]: string[] };

export const PROP_URLS: Record<PropModel, string> = {
  barrel: url("barrel.glb"),
  "jersey-barrier": url("jersey-barrier.glb"),
  "covered-car": url("covered-car.glb"),
  "boulder-a": url("boulder-a.glb"),
  "boulder-b": url("boulder-b.glb"),
  "utility-box": url("utility-box.glb"),
  crate: url("crate.glb"),
};

type Cell = { uv: number[]; width_m: number; height_m: number };
const cells = vegetation.cells as Record<string, Cell>;
/** Atlas cells for each species: two crossed side cards and an optional top card. */
export const FOLIAGE: Record<
  Species,
  { sides: Cell[]; top?: Cell; height: number }
> = {
  "tree-jacaranda": {
    sides: [cells["tree-jacaranda-side-a"], cells["tree-jacaranda-side-b"]],
    top: cells["tree-jacaranda-top"],
    height: 19.47,
  },
  "tree-island": {
    sides: [cells["tree-island-side-a"], cells["tree-island-side-b"]],
    top: cells["tree-island-top"],
    height: 3.41,
  },
  "shrub-rooibos": {
    sides: [cells["shrub-rooibos-side"], cells["shrub-rooibos-side"]],
    height: 0.54,
  },
  "shrub-broad": {
    sides: [cells["shrub-broad-side"], cells["shrub-broad-side"]],
    height: 0.22,
  },
};
