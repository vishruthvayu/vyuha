import type { TerrainBox } from "../sensors-v2";
import { FLAT_RADIUS, fbm, type TerrainKind } from "./terrain";

/** Decorative facility layout. x = east, z = north (bearing 0 = +z), metres.
 * The sensor is at the origin. Nothing here is sensor geometry: the only
 * occluders the sensor models are the scenario's authoritative terrain boxes,
 * which are dressed separately and strictly inside their own volumes. */
export type XZ = [number, number];
export type PropModel =
  | "barrel"
  | "jersey-barrier"
  | "covered-car"
  | "boulder-a"
  | "boulder-b"
  | "utility-box"
  | "crate";
export type Species =
  "tree-jacaranda" | "tree-island" | "shrub-rooibos" | "shrub-broad";
export type Placement =
  | { kind: "bunker"; x: number; z: number; rot: number }
  | { kind: "sensorMast"; x: number; z: number }
  | {
      kind: "building";
      x: number;
      z: number;
      rot: number;
      w: number;
      d: number;
      floors: number;
      finish: "plaster" | "concrete";
    }
  | {
      kind: "hangar";
      x: number;
      z: number;
      rot: number;
      span: number;
      length: number;
    }
  | {
      kind: "container";
      x: number;
      z: number;
      rot: number;
      tint: number;
      level?: number;
      office?: boolean;
    }
  | { kind: "watchtower"; x: number; z: number; rot: number; h: number }
  | { kind: "radarMast"; x: number; z: number; h: number }
  | { kind: "commsMast"; x: number; z: number; h: number }
  | { kind: "genset"; x: number; z: number; rot: number }
  | { kind: "fuelTank"; x: number; z: number; rot: number }
  | { kind: "helipad"; x: number; z: number; size: number }
  | { kind: "lightPole"; x: number; z: number; rot: number }
  | { kind: "gatehouse"; x: number; z: number; rot: number }
  | { kind: "boom"; x: number; z: number; rot: number; length: number }
  | { kind: "tent"; x: number; z: number; rot: number; w: number; l: number }
  | {
      kind: "house";
      x: number;
      z: number;
      rot: number;
      w: number;
      d: number;
      h: number;
      roof: "flat" | "gable";
    }
  | {
      kind: "warehouse";
      x: number;
      z: number;
      rot: number;
      w: number;
      d: number;
      h: number;
    }
  | {
      kind: "prop";
      model: PropModel;
      x: number;
      z: number;
      rot: number;
      scale: number;
    }
  | {
      kind: "plant";
      species: Species;
      x: number;
      z: number;
      rot: number;
      scale: number;
    };
export type Line = {
  kind: "fence" | "hesco" | "sandbags";
  path: XZ[];
  closed?: boolean;
};
export type Surface = {
  kind: "asphalt" | "concrete" | "gravel" | "laterite" | "grass" | "worn";
  /** A road centreline with width, or a closed polygon. */
  path: XZ[];
  width?: number;
};
export type FacilityLayout = {
  terrain: TerrainKind;
  placements: Placement[];
  lines: Line[];
  surfaces: Surface[];
  /** Compound outline used to keep scattered vegetation out. */
  compound: XZ[];
};

/** Sensor clearing: only low items (≤ 1.6 m, under the 2 m sensor eye line). */
export const SENSOR_CLEARING = 16;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0;
    s = Math.imul(s ^ (s >>> 13), 3266489909) >>> 0;
    return ((s ^ (s >>> 16)) >>> 0) / 4294967296;
  };
}
const rect = (x0: number, z0: number, x1: number, z1: number): XZ[] => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];
export function insidePolygon([x, z]: XZ, poly: XZ[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i],
      [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi)
      inside = !inside;
  }
  return inside;
}
function nearSegment([x, z]: XZ, a: XZ, b: XZ) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1];
  const t = Math.max(
    0,
    Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)),
  );
  return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
}
function nearSurface(p: XZ, s: Surface, margin: number) {
  if (s.width !== undefined)
    return s.path.some(
      (a, i) =>
        i > 0 && nearSegment(p, s.path[i - 1], a) < s.width! / 2 + margin,
    );
  return insidePolygon(p, s.path);
}
function inBox([x, z]: XZ, b: TerrainBox, margin: number) {
  return (
    x > b.x_min - margin &&
    x < b.x_max + margin &&
    z > b.z_min - margin &&
    z < b.z_max + margin
  );
}

const COMMON_CORE = (placements: Placement[], lines: Line[]) => {
  placements.push(
    { kind: "bunker", x: 0, z: -9, rot: 0 },
    { kind: "sensorMast", x: 0, z: 0 },
  );
  // A short sandbag wall shielding the bunker entrance (south side), low and
  // off the sensor's forward views.
  lines.push({
    kind: "sandbags",
    path: [
      [0.6, -11.4],
      [3.4, -11.4],
      [4.4, -10.6],
    ],
  });
};

function urbanOutpost(): FacilityLayout {
  const placements: Placement[] = [];
  const lines: Line[] = [];
  const compound = rect(-92, -64, 92, 74);
  COMMON_CORE(placements, lines);
  placements.push(
    { kind: "radarMast", x: 17, z: 9, h: 11 },
    { kind: "commsMast", x: -21, z: -14, h: 22 },
    {
      kind: "building",
      x: -52,
      z: 38,
      rot: 0,
      w: 26,
      d: 12,
      floors: 2,
      finish: "plaster",
    },
    {
      kind: "building",
      x: -66,
      z: 4,
      rot: Math.PI / 2,
      w: 16,
      d: 9,
      floors: 1,
      finish: "concrete",
    },
    { kind: "hangar", x: 52, z: 36, rot: 0, span: 20, length: 28 },
    { kind: "helipad", x: 6, z: 50, size: 22 },
    { kind: "genset", x: 66, z: -36, rot: Math.PI / 2 },
    { kind: "fuelTank", x: 76, z: -44, rot: 0 },
    { kind: "fuelTank", x: 76, z: -36, rot: 0 },
    { kind: "gatehouse", x: 9, z: -60, rot: 0 },
    { kind: "boom", x: -4, z: -66, rot: 0, length: 7 },
  );
  // Accommodation and office containers, and a two-high storage stack.
  for (let i = 0; i < 5; i++)
    placements.push({
      kind: "container",
      x: 22 + i * 7.2,
      z: -30,
      rot: Math.PI / 2,
      tint: 0,
      office: true,
    });
  for (let i = 0; i < 4; i++)
    for (let level = 0; level < (i % 3 === 0 ? 1 : 2); level++)
      placements.push({
        kind: "container",
        x: -60 + i * 3,
        z: -40,
        // Side by side: 2.44 m wide boxes on a 3 m pitch.
        rot: Math.PI / 2,
        tint: (i * 2 + level) % 4,
        level,
      });
  for (const [x, z] of [
    [-78, -12],
    [36, -52],
    [-30, 62],
    [80, 10],
    [-8, 30],
    [28, 12],
    [-36, -52],
    [62, 62],
  ] as XZ[])
    placements.push({ kind: "lightPole", x, z, rot: Math.atan2(-x, -z) });
  for (const [x, z, rot] of [
    [-92, -64, Math.PI / 4],
    [92, -64, -Math.PI / 4],
    [92, 74, (-3 * Math.PI) / 4],
    [-92, 74, (3 * Math.PI) / 4],
  ] as [number, number, number][])
    placements.push({ kind: "watchtower", x, z, rot, h: 8 });
  for (let i = 0; i < 5; i++)
    placements.push({
      kind: "prop",
      model: "covered-car",
      x: -36 + i * 3.4,
      z: 20,
      rot: Math.PI / 2 + (i % 2) * 0.05,
      scale: 1,
    });
  for (let i = 0; i < 14; i++)
    placements.push({
      kind: "prop",
      model: "barrel",
      x: 70 + (i % 5) * 0.75,
      z: -52 + Math.floor(i / 5) * 0.75,
      rot: i,
      scale: 1,
    });
  for (let i = 0; i < 10; i++)
    placements.push({
      kind: "prop",
      model: "crate",
      x: -44 + (i % 4) * 1.4,
      z: -52 + Math.floor(i / 4) * 0.8,
      rot: (i % 2) * Math.PI,
      scale: 1,
    });
  for (const [x, z, rot] of [
    [-2, -74, 0.2],
    [6, -80, -0.15],
    [-3, -86, 0.1],
    [-12, -66, Math.PI / 2],
    [14, -66, Math.PI / 2],
  ] as [number, number, number][])
    placements.push({
      kind: "prop",
      model: "jersey-barrier",
      x,
      z,
      rot,
      scale: 1,
    });
  for (const [x, z] of [
    [-40, 31],
    [-64, 30],
    [40, 22],
    [60, -27],
    [-70, 12],
  ] as XZ[])
    placements.push({
      kind: "prop",
      model: "utility-box",
      x,
      z,
      rot: 0,
      scale: 1,
    });
  lines.push(
    {
      kind: "fence",
      closed: false,
      path: [
        [-14, -64],
        [-92, -64],
        [-92, 74],
        [92, 74],
        [92, -64],
        [14, -64],
      ],
    },
    // Blast walls around generator, fuel and the storage stack.
    {
      kind: "hesco",
      path: [
        [58, -28],
        [58, -58],
        [86, -58],
      ],
    },
    {
      kind: "hesco",
      path: [
        [-66, -30],
        [-66, -48],
        [-34, -48],
      ],
    },
    {
      kind: "hesco",
      path: [
        [30, 52],
        [30, 58],
        [74, 58],
      ],
    },
  );
  const surfaces: Surface[] = [
    {
      kind: "asphalt",
      width: 8,
      path: [
        [0, -64],
        [0, -120],
        [0, -150],
      ],
    },
    {
      kind: "asphalt",
      width: 11,
      path: [
        [-1600, -156],
        [-400, -150],
        [0, -150],
        [500, -144],
        [1600, -132],
      ],
    },
    {
      kind: "asphalt",
      width: 6,
      path: [
        [0, -64],
        [0, 22],
        [-30, 22],
        [-30, 30],
      ],
    },
    { kind: "concrete", path: rect(36, 10, 68, 22) },
    { kind: "concrete", path: rect(-8, -16, 8, 2) },
    { kind: "gravel", path: rect(-90, -62, 90, 72) },
    {
      kind: "worn",
      width: 4,
      path: [
        [0, 22],
        [40, 22],
        [52, 22],
      ],
    },
  ];
  scatter(placements, surfaces, compound, "urban_outpost", 22);
  return { terrain: "urban_outpost", placements, lines, surfaces, compound };
}

function ruralForwardBase(): FacilityLayout {
  const placements: Placement[] = [];
  const lines: Line[] = [];
  const compound = rect(-110, -80, 110, 90);
  COMMON_CORE(placements, lines);
  placements.push(
    { kind: "radarMast", x: -16, z: 10, h: 11 },
    { kind: "commsMast", x: 22, z: -12, h: 20 },
    { kind: "hangar", x: -60, z: 46, rot: Math.PI, span: 18, length: 24 },
    {
      kind: "building",
      x: 56,
      z: 44,
      rot: 0,
      w: 18,
      d: 10,
      floors: 1,
      finish: "plaster",
    },
    { kind: "helipad", x: 60, z: -40, size: 24 },
    { kind: "genset", x: -70, z: -40, rot: 0 },
    { kind: "fuelTank", x: -84, z: -50, rot: Math.PI / 2 },
    { kind: "gatehouse", x: 118, z: 6, rot: -Math.PI / 2 },
    { kind: "boom", x: 124, z: -6, rot: Math.PI / 2, length: 7 },
  );
  for (let i = 0; i < 4; i++)
    placements.push({
      kind: "tent",
      x: 20 + i * 12,
      z: 22,
      rot: 0,
      w: 6,
      l: 9,
    });
  for (let i = 0; i < 3; i++)
    placements.push({
      kind: "container",
      x: -30 + i * 7.2,
      z: -42,
      rot: Math.PI / 2,
      tint: 1,
      office: i === 1,
    });
  for (const [x, z, rot] of [
    [-110, -80, Math.PI / 4],
    [110, -80, -Math.PI / 4],
    [110, 90, (-3 * Math.PI) / 4],
    [-110, 90, (3 * Math.PI) / 4],
  ] as [number, number, number][])
    placements.push({ kind: "watchtower", x, z, rot, h: 8 });
  for (const [x, z] of [
    [-40, 16],
    [40, -22],
    [80, 30],
    [-86, -16],
    [0, 66],
  ] as XZ[])
    placements.push({ kind: "lightPole", x, z, rot: Math.atan2(-x, -z) });
  for (let i = 0; i < 4; i++)
    placements.push({
      kind: "prop",
      model: "covered-car",
      x: 76 + i * 3.4,
      z: 6,
      rot: 0,
      scale: 1,
    });
  for (let i = 0; i < 10; i++)
    placements.push({
      kind: "prop",
      model: "barrel",
      x: -78 + (i % 4) * 0.75,
      z: -62 + Math.floor(i / 4) * 0.75,
      rot: i,
      scale: 1,
    });
  lines.push(
    {
      kind: "fence",
      path: [
        [110, 0],
        [110, -80],
        [-110, -80],
        [-110, 90],
        [110, 90],
        [110, 14],
      ],
    },
    {
      kind: "hesco",
      path: [
        [-60, -30],
        [-96, -30],
        [-96, -66],
      ],
    },
    {
      kind: "hesco",
      path: [
        [-74, 64],
        [-46, 64],
      ],
    },
  );
  const surfaces: Surface[] = [
    {
      kind: "laterite",
      width: 7,
      path: [
        [110, 7],
        [300, 20],
        [700, 60],
        [1600, 140],
      ],
    },
    {
      kind: "laterite",
      width: 5,
      path: [
        [110, 7],
        [0, 7],
        [-60, 28],
        [-60, 30],
      ],
    },
    {
      kind: "laterite",
      width: 4,
      path: [
        [-200, 600],
        [-120, 300],
        [-125, 230],
      ],
    },
    { kind: "concrete", path: rect(-8, -16, 8, 2) },
    { kind: "concrete", path: rect(48, -52, 72, -28) },
    {
      kind: "worn",
      width: 3,
      path: [
        [0, 7],
        [44, 22],
      ],
    },
    { kind: "grass", path: rect(-100, -76, 100, 84) },
  ];
  // A hamlet beyond the authoritative storage depot: low decorative houses.
  const r = rng(77);
  for (let i = 0; i < 9; i++) {
    const a = -0.5 + r() * 0.9,
      d = 480 + r() * 160;
    placements.push({
      kind: "house",
      x: Math.sin(a + Math.PI * 1.75) * d,
      z: Math.cos(a + Math.PI * 1.75) * d,
      rot: r() * Math.PI,
      w: 7 + r() * 5,
      d: 6 + r() * 3,
      h: 3.2 + r() * 1.2,
      roof: r() < 0.6 ? "flat" : "gable",
    });
  }
  scatter(placements, surfaces, compound, "rural_forward_base", 60);
  return {
    terrain: "rural_forward_base",
    placements,
    lines,
    surfaces,
    compound,
  };
}

/** Deterministic vegetation and rocks outside the compound and off the roads. */
function scatter(
  placements: Placement[],
  surfaces: Surface[],
  compound: XZ[],
  terrain: TerrainKind,
  density: number,
) {
  const r = rng(terrain === "rural_forward_base" ? 9157 : 4231);
  const roads = surfaces.filter((s) => s.width !== undefined);
  const count = Math.round(density * 12);
  for (let i = 0, made = 0; made < count && i < count * 20; i++) {
    const a = r() * Math.PI * 2;
    const d = 130 + Math.pow(r(), 0.7) * (FLAT_RADIUS - 200);
    const p: XZ = [Math.sin(a) * d, Math.cos(a) * d];
    // Groves: accept where low-frequency noise is high, so trees cluster.
    if (fbm(p[0] / 260 + 3, p[1] / 260 - 1, 3) < 0.5) continue;
    if (insidePolygon(p, compound) || roads.some((s) => nearSurface(p, s, 6)))
      continue;
    made++;
    const pick = r();
    const species: Species =
      terrain === "rural_forward_base"
        ? pick < 0.45
          ? "tree-jacaranda"
          : pick < 0.75
            ? "tree-island"
            : "shrub-rooibos"
        : pick < 0.35
          ? "tree-jacaranda"
          : pick < 0.6
            ? "tree-island"
            : "shrub-rooibos";
    placements.push({
      kind: "plant",
      species,
      x: p[0],
      z: p[1],
      rot: r() * Math.PI * 2,
      scale:
        species === "tree-jacaranda"
          ? 0.38 + r() * 0.3
          : species === "tree-island"
            ? 1.3 + r() * 1.2
            : 0.9 + r() * 0.8,
    });
    if (r() < 0.25)
      placements.push({
        kind: "prop",
        model: r() < 0.5 ? "boulder-a" : "boulder-b",
        x: p[0] + 6 * (r() - 0.5),
        z: p[1] + 6 * (r() - 0.5),
        rot: r() * Math.PI * 2,
        scale: 0.6 + r() * 1.2,
      });
  }
}

const LAYOUTS: Partial<Record<TerrainKind, FacilityLayout>> = {};
export function facilityLayout(terrain: TerrainKind): FacilityLayout {
  return (LAYOUTS[terrain] ??=
    terrain === "rural_forward_base" ? ruralForwardBase() : urbanOutpost());
}

/** Scenery must keep clear of the authoritative boxes, so the dressing that
 * represents them reads as one structure and nothing decorative overlaps it. */
export function withoutBoxes(
  layout: FacilityLayout,
  boxes: readonly TerrainBox[],
): FacilityLayout {
  if (!boxes.length) return layout;
  return {
    ...layout,
    placements: layout.placements.filter(
      (p) => !boxes.some((b) => inBox([p.x, p.z], b, 12)),
    ),
  };
}

/** Approximate top height of a placement, used by layout tests. */
export function placementHeight(p: Placement) {
  switch (p.kind) {
    case "bunker":
      return 1.04;
    case "sensorMast":
      return 1.9;
    case "building":
      return p.floors * 3.4 + 1;
    case "hangar":
      return p.span * 0.45;
    case "container":
      return 2.6 * ((p.level ?? 0) + 1);
    case "watchtower":
      return p.h + 3.2;
    case "radarMast":
    case "commsMast":
      return p.h + 1;
    case "genset":
      return 3.4;
    case "fuelTank":
      return 2.6;
    case "helipad":
      return 0.1;
    case "lightPole":
      return 9.5;
    case "gatehouse":
      return 3.2;
    case "boom":
      return 1.2;
    case "tent":
      return 3.2;
    case "house":
      return p.h + (p.roof === "gable" ? 1.8 : 0.6);
    case "warehouse":
      return p.h;
    case "prop":
      return p.model === "covered-car" ? 1.4 : 1.2 * p.scale;
    case "plant":
      return p.species === "tree-jacaranda"
        ? 19.5 * p.scale
        : p.species === "tree-island"
          ? 3.4 * p.scale
          : 1;
  }
}
