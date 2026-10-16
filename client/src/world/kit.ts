import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Placement, Line, XZ } from "./layout";

/** Procedural architecture kit. Every piece is original geometry with metric
 * UVs (1 UV unit = 1 m, so tiling textures keep real scale) and a vertex tint,
 * merged into one mesh per material: the whole facility costs a few draw calls. */
export type MaterialKey =
  | "plaster"
  | "concrete"
  | "concreteFloor"
  | "corrugated"
  | "paint"
  | "steel"
  | "glass"
  | "glassLit"
  | "fabric"
  | "hesco"
  | "rubber"
  | "lamp"
  | "asphalt"
  | "marking"
  | "fence"
  | "exhaust";
export type Tint = [number, number, number];
const WHITE: Tint = [1, 1, 1];

export class Batches {
  private parts = new Map<MaterialKey, THREE.BufferGeometry[]>();
  triangles = 0;
  add(
    key: MaterialKey,
    g: THREE.BufferGeometry,
    m: THREE.Matrix4,
    tint: Tint = WHITE,
  ) {
    const geo = (g.index ? g.toNonIndexed() : g.clone()).applyMatrix4(m);
    g.dispose();
    const n = geo.getAttribute("position").count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) colors.set(tint, i * 3);
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    for (const name of Object.keys(geo.attributes))
      if (!["position", "normal", "uv", "color"].includes(name))
        geo.deleteAttribute(name);
    this.triangles += n / 3;
    const list = this.parts.get(key) ?? [];
    list.push(geo);
    this.parts.set(key, list);
  }
  merged() {
    const out = new Map<MaterialKey, THREE.BufferGeometry>();
    for (const [key, list] of this.parts) {
      const geo = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      if (!geo) continue;
      geo.computeBoundingSphere();
      geo.computeBoundingBox();
      out.set(key, geo);
    }
    this.parts.clear();
    return out;
  }
}

const tmp = {
  m: new THREE.Matrix4(),
  q: new THREE.Quaternion(),
  e: new THREE.Euler(),
  v: new THREE.Vector3(),
  s: new THREE.Vector3(1, 1, 1),
};
/** Local-to-world: rotate about Y by `rot` around (x, z), then offset. */
export function frame(x: number, y: number, z: number, rot = 0) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot),
    new THREE.Vector3(1, 1, 1),
  );
}
function local(
  parent: THREE.Matrix4,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0,
) {
  tmp.e.set(rx, ry, rz);
  return parent
    .clone()
    .multiply(
      tmp.m.compose(tmp.v.set(x, y, z), tmp.q.setFromEuler(tmp.e), tmp.s),
    );
}

/** Box with metric UVs on every face, centred on its local origin. */
export function box(w: number, h: number, d: number) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.getAttribute("uv") as THREE.BufferAttribute;
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z; 4 vertices each.
  const size: [number, number][] = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  for (let f = 0; f < 6; f++)
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, uv.getX(i) * size[f][0], uv.getY(i) * size[f][1]);
    }
  return g;
}
export function cylinder(
  rTop: number,
  rBottom: number,
  h: number,
  segments = 10,
  open = false,
) {
  const g = new THREE.CylinderGeometry(rTop, rBottom, h, segments, 1, open);
  const uv = g.getAttribute("uv") as THREE.BufferAttribute;
  const circumference = Math.PI * (rTop + rBottom);
  for (let i = 0; i < uv.count; i++)
    uv.setXY(i, uv.getX(i) * circumference, uv.getY(i) * h);
  return g;
}
export function quad(w: number, h: number) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++)
    uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h);
  return g;
}
/** Thin bar between two local points (lattice members, rails, braces). */
function bar(
  b: Batches,
  key: MaterialKey,
  parent: THREE.Matrix4,
  a: THREE.Vector3,
  c: THREE.Vector3,
  thickness: number,
  tint?: Tint,
) {
  const dir = c.clone().sub(a);
  const len = dir.length();
  const mid = a.clone().add(c).multiplyScalar(0.5);
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.normalize(),
  );
  const m = parent
    .clone()
    .multiply(new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1)));
  b.add(key, box(thickness, len, thickness), m, tint);
}

const PAINT = {
  olive: [0.42, 0.45, 0.33] as Tint,
  sand: [0.78, 0.7, 0.55] as Tint,
  grey: [0.55, 0.58, 0.6] as Tint,
  rust: [0.62, 0.33, 0.24] as Tint,
  blue: [0.33, 0.43, 0.52] as Tint,
  white: [0.92, 0.92, 0.9] as Tint,
  red: [0.75, 0.16, 0.12] as Tint,
  dark: [0.22, 0.23, 0.24] as Tint,
};
const PLASTER_TINTS: Tint[] = [
  [1.12, 1.1, 1.04], // whitewash
  [1.08, 0.96, 0.82], // cream
  [1.05, 0.9, 0.8], // peach
  [0.94, 0.98, 1.02], // pale blue-grey
  [1.04, 1.0, 0.82], // pale yellow
  [0.88, 0.86, 0.82], // weathered grey
];

function windowUnit(
  b: Batches,
  m: THREE.Matrix4,
  w: number,
  h: number,
  lit: boolean,
  shade = true,
) {
  b.add(lit ? "glassLit" : "glass", quad(w, h), local(m, 0, 0, 0.03));
  const f = 0.06;
  b.add("steel", box(w + f, f, f), local(m, 0, h / 2, 0.05), PAINT.dark);
  b.add("steel", box(w + f, f, f), local(m, 0, -h / 2, 0.05), PAINT.dark);
  b.add("steel", box(f, h, f), local(m, -w / 2, 0, 0.05), PAINT.dark);
  b.add("steel", box(f, h, f), local(m, w / 2, 0, 0.05), PAINT.dark);
  b.add("steel", box(f * 0.7, h, f * 0.7), local(m, 0, 0, 0.05), PAINT.dark);
  b.add("concrete", box(w + 0.2, 0.08, 0.2), local(m, 0, -h / 2 - 0.06, 0.1));
  if (shade)
    b.add(
      "concrete",
      box(w + 0.5, 0.09, 0.55),
      local(m, 0, h / 2 + 0.32, 0.27),
    );
}
function acUnit(b: Batches, m: THREE.Matrix4) {
  b.add("paint", box(0.85, 0.6, 0.32), m, PAINT.white);
  b.add("rubber", quad(0.42, 0.42), local(m, 0.12, 0, 0.165));
}
function waterTank(b: Batches, m: THREE.Matrix4) {
  b.add(
    "rubber",
    cylinder(0.62, 0.62, 1.15, 14),
    local(m, 0, 0.58, 0),
    PAINT.dark,
  );
  b.add(
    "rubber",
    cylinder(0.25, 0.62, 0.22, 14),
    local(m, 0, 1.26, 0),
    PAINT.dark,
  );
}

/** Office / operations building with banded windows, sun shades and roof plant. */
export function building(
  b: Batches,
  p: Extract<Placement, { kind: "building" }>,
  seed: number,
) {
  const m = frame(p.x, 0, p.z, p.rot);
  const H = p.floors * 3.4 + 0.3;
  const key = p.finish === "plaster" ? "plaster" : "concrete";
  const tint = PLASTER_TINTS[seed % PLASTER_TINTS.length];
  b.add("concrete", box(p.w + 0.4, 0.45, p.d + 0.4), local(m, 0, 0.225, 0));
  b.add(key, box(p.w, H, p.d), local(m, 0, H / 2 + 0.2, 0), tint);
  for (let f = 1; f <= p.floors; f++)
    b.add(
      "concrete",
      box(p.w + 0.08, 0.2, p.d + 0.08),
      local(m, 0, f * 3.4 + 0.15, 0),
    );
  // Parapet and roof deck.
  const top = H + 0.2;
  b.add(
    key,
    box(p.w, 0.9, 0.25),
    local(m, 0, top + 0.45, p.d / 2 - 0.125),
    tint,
  );
  b.add(
    key,
    box(p.w, 0.9, 0.25),
    local(m, 0, top + 0.45, -p.d / 2 + 0.125),
    tint,
  );
  b.add(
    key,
    box(0.25, 0.9, p.d - 0.5),
    local(m, p.w / 2 - 0.125, top + 0.45, 0),
    tint,
  );
  b.add(
    key,
    box(0.25, 0.9, p.d - 0.5),
    local(m, -p.w / 2 + 0.125, top + 0.45, 0),
    tint,
  );
  b.add(
    "concreteFloor",
    box(p.w - 0.5, 0.06, p.d - 0.5),
    local(m, 0, top + 0.03, 0),
  );
  // Windows on both long faces, door and canopy on the front.
  const bays = Math.max(1, Math.floor((p.w - 2) / 3.4));
  for (let f = 0; f < p.floors; f++)
    for (let i = 0; i < bays; i++) {
      const x = -((bays - 1) * 3.4) / 2 + i * 3.4;
      const y = f * 3.4 + 0.2 + 1.85;
      const door = f === 0 && i === Math.floor(bays / 2);
      if (!door)
        windowUnit(
          b,
          local(m, x, y, p.d / 2),
          1.7,
          1.35,
          (seed + i * 7 + f * 3) % 5 === 0,
        );
      windowUnit(
        b,
        local(m, x, y, -p.d / 2, 0, Math.PI, 0),
        1.7,
        1.35,
        (seed + i * 5 + f) % 4 === 0,
      );
    }
  const cx = 0;
  b.add(
    "paint",
    box(1.4, 2.3, 0.08),
    local(m, cx, 1.35, p.d / 2 + 0.02),
    PAINT.grey,
  );
  b.add("concrete", box(3.2, 0.16, 1.6), local(m, cx, 2.85, p.d / 2 + 0.8));
  b.add("concrete", box(2.4, 0.3, 1.2), local(m, cx, 0.15, p.d / 2 + 0.6));
  for (let f = 0; f < p.floors; f++) {
    windowUnit(
      b,
      local(m, p.w / 2, f * 3.4 + 2.05, 0, 0, Math.PI / 2, 0),
      1.2,
      1.2,
      false,
      false,
    );
    windowUnit(
      b,
      local(m, -p.w / 2, f * 3.4 + 2.05, 0, 0, -Math.PI / 2, 0),
      1.2,
      1.2,
      false,
      false,
    );
  }
  // Wall-mounted AC units and downpipes.
  for (let i = 0; i < Math.min(4, bays); i++)
    acUnit(b, local(m, -p.w / 2 + 2 + i * 3.4 * 1.6, 3.0, -p.d / 2 - 0.2));
  for (const sx of [-1, 1])
    b.add(
      "steel",
      cylinder(0.05, 0.05, H, 6),
      local(m, sx * (p.w / 2 - 0.3), H / 2, p.d / 2 + 0.06),
      PAINT.grey,
    );
  // Roof plant: stair bulkhead, water tanks, condensers.
  b.add(key, box(3.2, 2.6, 3), local(m, -p.w / 2 + 2.6, top + 1.3, 0), tint);
  b.add(
    "steel",
    box(2.6, 0.12, 1.6),
    local(m, p.w / 2 - 3, top + 0.9, 0.5),
    PAINT.grey,
  );
  for (let i = 0; i < 4; i++)
    b.add(
      "steel",
      box(0.08, 0.9, 0.08),
      local(
        m,
        p.w / 2 - 4.2 + (i % 2) * 2.4,
        top + 0.45,
        0 + Math.floor(i / 2) * 1,
      ),
      PAINT.grey,
    );
  waterTank(b, local(m, p.w / 2 - 3.6, top + 0.96, 0.5));
  waterTank(b, local(m, p.w / 2 - 2.3, top + 0.96, 0.5));
  for (let i = 0; i < 3; i++)
    acUnit(b, local(m, -1 + i * 1.3, top + 0.36, -p.d / 2 + 1.2));
}

/** Arched steel shelter with roller doors. */
export function hangar(b: Batches, p: Extract<Placement, { kind: "hangar" }>) {
  const m = frame(p.x, 0, p.z, p.rot);
  const r = p.span / 2,
    rise = p.span * 0.42,
    segs = 18;
  const pos: number[] = [],
    uvs: number[] = [];
  const arc: [number, number, number][] = [];
  let s = 0;
  for (let i = 0; i <= segs; i++) {
    const a = Math.PI - (i / segs) * Math.PI;
    const x = Math.cos(a) * r,
      y = Math.sin(a) * rise + 0.6;
    if (i) s += Math.hypot(x - arc[i - 1][0], y - arc[i - 1][1]);
    arc.push([x, y, s]);
  }
  const L = p.length / 2;
  for (let i = 0; i < segs; i++) {
    const [x0, y0, s0] = arc[i],
      [x1, y1, s1] = arc[i + 1];
    // Wound so faces point outward (seen from outside the shelter).
    pos.push(x0, y0, -L, x1, y1, L, x1, y1, -L);
    pos.push(x0, y0, -L, x0, y0, L, x1, y1, L);
    uvs.push(-L, s0, L, s1, -L, s1, -L, s0, L, s0, L, s1);
  }
  const roof = new THREE.BufferGeometry();
  roof.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  roof.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  roof.computeVertexNormals();
  // Corrugations must run around the arch: swap the texture axes.
  b.add("corrugated", roof, m, [0.86, 0.88, 0.86]);
  // End walls: arch profile, ribs vertical.
  const shape = new THREE.Shape();
  shape.moveTo(-r, 0);
  arc.forEach(([x, y]) => shape.lineTo(x, y));
  shape.lineTo(r, 0);
  shape.closePath();
  for (const end of [-1, 1]) {
    const wall = new THREE.ShapeGeometry(shape, 1);
    const uv = wall.getAttribute("uv") as THREE.BufferAttribute;
    const posA = wall.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, posA.getX(i), posA.getY(i));
    b.add(
      "corrugated",
      wall,
      local(m, 0, 0, end * L, 0, end > 0 ? 0 : Math.PI, 0),
      [0.8, 0.82, 0.8],
    );
  }
  // Roller door and personnel door on the front, sill and ribs.
  b.add(
    "paint",
    box(p.span * 0.62, rise * 0.82, 0.1),
    local(m, 0, (rise * 0.82) / 2, L + 0.06),
    PAINT.grey,
  );
  for (let i = 0; i < 12; i++)
    b.add(
      "steel",
      box(p.span * 0.62, 0.035, 0.03),
      local(m, 0, 0.3 + i * ((rise * 0.78) / 12), L + 0.13),
      PAINT.dark,
    );
  b.add(
    "paint",
    box(1, 2.1, 0.08),
    local(m, r * 0.78, 1.05, L + 0.05),
    PAINT.olive,
  );
  b.add(
    "concrete",
    box(p.span + 0.6, 0.35, p.length + 0.6),
    local(m, 0, 0.175, 0),
  );
  for (let i = 0; i <= 6; i++) {
    const z = -L + (i / 6) * p.length;
    for (let k = 0; k < segs; k += 3) {
      const [x0, y0] = arc[k],
        [x1, y1] = arc[k + 3] ?? arc[segs];
      bar(
        b,
        "steel",
        m,
        new THREE.Vector3(x0 * 1.01, y0 * 1.01 + 0.02, z),
        new THREE.Vector3(x1 * 1.01, y1 * 1.01 + 0.02, z),
        0.08,
        PAINT.grey,
      );
    }
  }
  for (const x of [-r * 0.4, 0, r * 0.4])
    b.add(
      "steel",
      cylinder(0.25, 0.3, 0.6, 10),
      local(m, x, rise + 0.85, 0),
      PAINT.grey,
    );
}

/** ISO 20 ft container; office variant adds window, door, steps and AC. */
const CONTAINER_TINTS: Tint[] = [
  PAINT.sand,
  PAINT.olive,
  PAINT.blue,
  PAINT.rust,
];
export function container(
  b: Batches,
  p: Extract<Placement, { kind: "container" }>,
) {
  const level = p.level ?? 0;
  const m = frame(p.x, level * 2.6, p.z, p.rot);
  const tint = p.office
    ? PAINT.sand
    : CONTAINER_TINTS[p.tint % CONTAINER_TINTS.length];
  b.add("corrugated", box(6.06, 2.59, 2.44), local(m, 0, 1.295, 0), tint);
  b.add("paint", box(0.05, 2.5, 2.36), local(m, 3.04, 1.3, 0), tint);
  for (const z of [-0.6, -0.2, 0.2, 0.6])
    b.add(
      "steel",
      cylinder(0.025, 0.025, 2.4, 5),
      local(m, 3.09, 1.3, z),
      PAINT.dark,
    );
  for (const [x, z] of [
    [-3, -1.2],
    [3, -1.2],
    [-3, 1.2],
    [3, 1.2],
  ] as XZ[])
    b.add("steel", box(0.16, 0.16, 0.16), local(m, x, 2.51, z), PAINT.dark);
  if (p.office) {
    windowUnit(
      b,
      local(m, -1.2, 1.5, 1.22),
      1.2,
      0.95,
      p.tint % 2 === 0,
      false,
    );
    b.add("paint", box(0.9, 2.05, 0.06), local(m, 1.4, 1.1, 1.24), PAINT.white);
    b.add("concrete", box(1.2, 0.2, 0.8), local(m, 1.4, 0.1, 1.7));
    acUnit(b, local(m, -2.4, 1.9, 1.42));
  }
}

export function watchtower(
  b: Batches,
  p: Extract<Placement, { kind: "watchtower" }>,
) {
  const m = frame(p.x, 0, p.z, p.rot);
  const h = p.h,
    base = 1.5,
    topHalf = 1.25;
  const legs: THREE.Vector3[][] = [];
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ]) {
    const a = new THREE.Vector3(sx * base, 0, sz * base),
      c = new THREE.Vector3(sx * topHalf, h, sz * topHalf);
    bar(b, "steel", m, a, c, 0.16, PAINT.olive);
    legs.push([a, c]);
  }
  for (let level = 0; level < 3; level++) {
    const y0 = (level / 3) * h,
      y1 = ((level + 1) / 3) * h;
    for (let i = 0; i < 4; i++) {
      const [a0, a1] = legs[i],
        [b0, b1] = legs[(i + 1) % 4];
      const pa = a0.clone().lerp(a1, y0 / h),
        pb = b0.clone().lerp(b1, y1 / h);
      const pc = a0.clone().lerp(a1, y1 / h),
        pd = b0.clone().lerp(b1, y0 / h);
      bar(b, "steel", m, pa, pb, 0.07, PAINT.olive);
      bar(b, "steel", m, pc, pd, 0.07, PAINT.olive);
      bar(b, "steel", m, pc, b0.clone().lerp(b1, y1 / h), 0.08, PAINT.olive);
    }
  }
  b.add("concreteFloor", box(3.4, 0.2, 3.4), local(m, 0, h + 0.1, 0));
  // Cabin: low wall, window band, corner posts, overhanging roof.
  b.add("paint", box(3.2, 1.05, 3.2), local(m, 0, h + 0.72, 0), PAINT.sand);
  for (const r of [0, Math.PI / 2, Math.PI, -Math.PI / 2])
    b.add(
      "glass",
      quad(3.0, 0.95),
      local(m, 0, h + 1.75, 0, 0, r, 0).multiply(
        new THREE.Matrix4().makeTranslation(0, 0, 1.58),
      ),
    );
  for (const [x, z] of [
    [-1.55, -1.55],
    [1.55, -1.55],
    [1.55, 1.55],
    [-1.55, 1.55],
  ] as XZ[])
    b.add("steel", box(0.12, 1.1, 0.12), local(m, x, h + 1.8, z), PAINT.olive);
  b.add("paint", box(4, 0.16, 4), local(m, 0, h + 2.4, 0), PAINT.olive);
  b.add(
    "fabric",
    box(3.2, 0.5, 0.3),
    local(m, 0, h + 0.45, 1.75),
    [0.82, 0.74, 0.58],
  );
  // Ladder.
  for (const x of [-0.25, 0.25])
    bar(
      b,
      "steel",
      m,
      new THREE.Vector3(x, 0, base + 0.3),
      new THREE.Vector3(x, h, topHalf + 0.3),
      0.05,
      PAINT.grey,
    );
  for (let i = 1; i < h / 0.4; i++) {
    const t = (i * 0.4) / h;
    const z = base + 0.3 + (topHalf - base) * t;
    b.add("steel", box(0.5, 0.03, 0.03), local(m, 0, i * 0.4, z), PAINT.grey);
  }
}

/** Lattice mast; returns where the rotating radar head sits. */
export function lattice(
  b: Batches,
  x: number,
  z: number,
  h: number,
  spread: number,
  tint: Tint,
) {
  const m = frame(x, 0, z, 0.4);
  const legs: THREE.Vector3[][] = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const p0 = new THREE.Vector3(Math.cos(a) * spread, 0, Math.sin(a) * spread);
    const p1 = new THREE.Vector3(
      Math.cos(a) * spread * 0.45,
      h,
      Math.sin(a) * spread * 0.45,
    );
    bar(b, "steel", m, p0, p1, 0.09, tint);
    legs.push([p0, p1]);
  }
  const steps = Math.max(4, Math.round(h / 1.6));
  for (let s = 0; s < steps; s++)
    for (let i = 0; i < 3; i++) {
      const [a0, a1] = legs[i],
        [b0, b1] = legs[(i + 1) % 3];
      bar(
        b,
        "steel",
        m,
        a0.clone().lerp(a1, s / steps),
        b0.clone().lerp(b1, (s + 1) / steps),
        0.04,
        tint,
      );
      bar(
        b,
        "steel",
        m,
        a0.clone().lerp(a1, (s + 1) / steps),
        b0.clone().lerp(b1, (s + 1) / steps),
        0.04,
        tint,
      );
    }
  return m;
}
export function radarMast(
  b: Batches,
  p: Extract<Placement, { kind: "radarMast" }>,
) {
  const m = lattice(b, p.x, p.z, p.h, 1.3, PAINT.grey);
  b.add("concreteFloor", box(2.4, 0.15, 2.4), local(m, 0, p.h + 0.08, 0));
  b.add(
    "steel",
    cylinder(0.3, 0.38, 0.7, 12),
    local(m, 0, p.h + 0.5, 0),
    PAINT.white,
  );
  b.add("concrete", box(3.4, 0.3, 3.4), local(m, 0, 0.15, 0));
}
export function commsMast(
  b: Batches,
  p: Extract<Placement, { kind: "commsMast" }>,
) {
  const m = lattice(b, p.x, p.z, p.h, 0.9, [0.82, 0.3, 0.22]);
  for (const [y, r] of [
    [p.h * 0.7, 0],
    [p.h * 0.85, 2.1],
  ] as [number, number][]) {
    const dish = new THREE.SphereGeometry(
      0.55,
      14,
      6,
      0,
      Math.PI * 2,
      0,
      Math.PI / 3.2,
    );
    b.add(
      "paint",
      dish,
      local(m, 0, y, 0, Math.PI / 2, r, 0).multiply(
        new THREE.Matrix4().makeTranslation(0, -0.4, 0),
      ),
      PAINT.white,
    );
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.6;
    b.add(
      "steel",
      cylinder(0.02, 0.02, 3, 4),
      local(m, Math.cos(a) * 0.4, p.h + 1.5, Math.sin(a) * 0.4),
      PAINT.dark,
    );
  }
  b.add("concrete", box(2.6, 0.3, 2.6), local(m, 0, 0.15, 0));
}
export function genset(b: Batches, p: Extract<Placement, { kind: "genset" }>) {
  const m = frame(p.x, 0, p.z, p.rot);
  b.add("paint", box(5.2, 2.5, 2.3), local(m, 0, 1.45, 0), PAINT.olive);
  b.add("concrete", box(6, 0.2, 3), local(m, 0, 0.1, 0));
  for (const side of [-1, 1])
    for (let i = 0; i < 3; i++)
      b.add(
        "rubber",
        quad(1.1, 0.8),
        local(
          m,
          -1.6 + i * 1.6,
          1.6,
          side * 1.16,
          0,
          side > 0 ? 0 : Math.PI,
          0,
        ),
      );
  b.add(
    "exhaust",
    cylinder(0.14, 0.14, 1.4, 10),
    local(m, 1.8, 3.35, 0),
    PAINT.dark,
  );
  b.add(
    "steel",
    cylinder(0.2, 0.14, 0.15, 10),
    local(m, 1.8, 4.1, 0),
    PAINT.dark,
  );
}
export function fuelTank(
  b: Batches,
  p: Extract<Placement, { kind: "fuelTank" }>,
) {
  const m = frame(p.x, 0, p.z, p.rot);
  b.add(
    "paint",
    cylinder(1.05, 1.05, 5.2, 18),
    local(m, 0, 1.45, 0, 0, 0, Math.PI / 2),
    PAINT.white,
  );
  for (const x of [-1.6, 1.6])
    b.add("concrete", box(0.4, 0.7, 1.8), local(m, x, 0.35, 0));
  b.add("concrete", box(7.2, 0.6, 0.2), local(m, 0, 0.3, 2.2));
  b.add("concrete", box(7.2, 0.6, 0.2), local(m, 0, 0.3, -2.2));
}
export function helipad(
  b: Batches,
  p: Extract<Placement, { kind: "helipad" }>,
) {
  const m = frame(p.x, 0.04, p.z, 0);
  b.add("concreteFloor", box(p.size, 0.08, p.size), local(m, 0, 0, 0));
  const s = p.size * 0.3;
  b.add("marking", box(s * 0.2, 0.01, s), local(m, -s * 0.4, 0.045, 0));
  b.add("marking", box(s * 0.2, 0.01, s), local(m, s * 0.4, 0.045, 0));
  b.add("marking", box(s * 0.6, 0.01, s * 0.18), local(m, 0, 0.045, 0));
  const ring = new THREE.RingGeometry(p.size * 0.38, p.size * 0.42, 40);
  b.add(
    "marking",
    ring,
    local(m, 0, 0.046, 0, -Math.PI / 2, 0, 0),
    [1, 0.85, 0.3],
  );
}
export function lightPole(
  b: Batches,
  p: Extract<Placement, { kind: "lightPole" }>,
) {
  const m = frame(p.x, 0, p.z, p.rot);
  b.add("steel", cylinder(0.07, 0.11, 9, 8), local(m, 0, 4.5, 0), PAINT.grey);
  b.add("steel", box(1.6, 0.08, 0.08), local(m, 0, 8.9, 0.1), PAINT.grey);
  for (const x of [-0.6, 0.6]) {
    b.add(
      "paint",
      box(0.5, 0.18, 0.36),
      local(m, x, 8.95, 0.25, -0.45, 0, 0),
      PAINT.dark,
    );
    b.add(
      "lamp",
      quad(0.42, 0.28),
      local(m, x, 8.86, 0.38, Math.PI / 2 + 0.45, 0, 0),
    );
  }
  b.add("concrete", cylinder(0.3, 0.35, 0.5, 10), local(m, 0, 0.25, 0));
}
export function gatehouse(
  b: Batches,
  p: Extract<Placement, { kind: "gatehouse" }>,
) {
  const m = frame(p.x, 0, p.z, p.rot);
  b.add("concrete", box(4.6, 0.3, 4), local(m, 0, 0.15, 0));
  b.add("plaster", box(4, 2.7, 3.4), local(m, 0, 1.65, 0), PLASTER_TINTS[1]);
  b.add("concrete", box(4.8, 0.18, 4.2), local(m, 0, 3.1, 0));
  for (const [r, w] of [
    [0, 2.4],
    [Math.PI, 2.4],
    [Math.PI / 2, 1.8],
    [-Math.PI / 2, 1.8],
  ] as [number, number][])
    windowUnit(
      b,
      local(m, 0, 1.9, 0, 0, r, 0).multiply(
        new THREE.Matrix4().makeTranslation(0, 0, r % Math.PI === 0 ? 1.7 : 2),
      ),
      w,
      1.1,
      r === 0,
      false,
    );
}
export function boom(b: Batches, p: Extract<Placement, { kind: "boom" }>) {
  const m = frame(p.x, 0, p.z, p.rot);
  b.add("paint", box(0.5, 1.1, 0.5), local(m, 0, 0.55, 0), PAINT.dark);
  const n = Math.round(p.length / 0.6);
  for (let i = 0; i < n; i++)
    b.add(
      "paint",
      box(0.6, 0.1, 0.1),
      local(m, 0.55 + i * 0.6, 1.0, 0),
      i % 2 ? PAINT.white : PAINT.red,
    );
}
export function tent(b: Batches, p: Extract<Placement, { kind: "tent" }>) {
  const m = frame(p.x, 0, p.z, p.rot);
  const w = p.w / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-w, 0);
  shape.lineTo(w, 0);
  shape.lineTo(w, 1.8);
  shape.lineTo(0, 3.1);
  shape.lineTo(-w, 1.8);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: p.l,
    bevelEnabled: false,
  });
  g.translate(0, 0, -p.l / 2);
  const uv = g.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++)
    uv.setXY(i, uv.getX(i) * 0.5, uv.getY(i) * 0.5);
  b.add("fabric", g, m, [0.55, 0.58, 0.43]);
  b.add("rubber", quad(1.4, 1.8), local(m, 0, 0.9, p.l / 2 + 0.01), PAINT.dark);
}
export function house(
  b: Batches,
  p: Extract<Placement, { kind: "house" }>,
  seed: number,
) {
  const m = frame(p.x, 0, p.z, p.rot);
  const tint = PLASTER_TINTS[seed % PLASTER_TINTS.length];
  b.add("plaster", box(p.w, p.h, p.d), local(m, 0, p.h / 2, 0), tint);
  if (p.roof === "flat") {
    b.add(
      "plaster",
      box(p.w + 0.1, 0.5, p.d + 0.1),
      local(m, 0, p.h + 0.25, 0),
      tint,
    );
    waterTank(b, local(m, p.w / 2 - 1, p.h, 0));
  } else {
    const rise = 1.6;
    const len = Math.hypot(p.d / 2 + 0.4, rise);
    const a = Math.atan2(rise, p.d / 2 + 0.4);
    for (const s of [-1, 1])
      b.add(
        "corrugated",
        box(p.w + 0.6, 0.06, len),
        local(m, 0, p.h + rise / 2, (s * (p.d / 2 + 0.4)) / 2, s * -a, 0, 0),
        [0.7, 0.4, 0.3],
      );
  }
  b.add(
    "paint",
    box(1, 2, 0.06),
    local(m, -p.w / 4, 1, p.d / 2 + 0.02),
    PAINT.blue,
  );
  windowUnit(b, local(m, p.w / 4, 1.6, p.d / 2), 1.1, 1, seed % 3 === 0, false);
}
/** Gable-roof storage shed filling a rectangle (used for authoritative dressing). */
export function warehouse(
  b: Batches,
  x: number,
  z: number,
  w: number,
  d: number,
  h: number,
) {
  const m = frame(x, 0, z, 0);
  const eave = h * 0.72;
  b.add("concrete", box(w, 0.6, d), local(m, 0, 0.3, 0));
  b.add(
    "corrugated",
    box(w - 0.1, eave - 0.6, d - 0.1),
    local(m, 0, 0.6 + (eave - 0.6) / 2, 0),
    [0.82, 0.84, 0.82],
  );
  const rise = h - eave;
  const half = d / 2;
  const len = Math.hypot(half, rise);
  const a = Math.atan2(rise, half);
  for (const s of [-1, 1])
    b.add(
      "corrugated",
      box(w, 0.08, len),
      local(m, 0, eave + rise / 2, (s * half) / 2, s * -a, 0, 0),
      [0.62, 0.36, 0.28],
    );
  // Gable ends.
  const tri = new THREE.Shape();
  tri.moveTo(-half, 0);
  tri.lineTo(half, 0);
  tri.lineTo(0, rise);
  tri.closePath();
  for (const s of [-1, 1]) {
    const g = new THREE.ShapeGeometry(tri);
    b.add(
      "corrugated",
      g,
      local(m, (s * (w - 0.1)) / 2, eave, 0, 0, (s * Math.PI) / 2, 0),
      [0.8, 0.82, 0.8],
    );
  }
  for (let i = 0; i < Math.floor(w / 14); i++)
    b.add(
      "paint",
      box(4, Math.min(5, eave - 1), 0.1),
      local(
        m,
        -w / 2 + 7 + i * 14,
        Math.min(5, eave - 1) / 2 + 0.6,
        half + 0.02,
      ),
      PAINT.grey,
    );
}
export function bunker(b: Batches, p: Extract<Placement, { kind: "bunker" }>) {
  const m = frame(p.x, 0, p.z, p.rot);
  // Low, earth-bermed command bunker: roof well below the 2 m sensor eye so it
  // never fills a rear bearing. Sloped berms instead of vertical walls.
  b.add("concrete", box(7, 0.9, 4.6), local(m, 0, 0.45, 0));
  b.add("concreteFloor", box(7.4, 0.14, 5), local(m, 0, 0.97, 0));
  for (const side of [-1, 1]) {
    // Berm on the long sides: a sloped earth/sandbag face down to the ground.
    b.add(
      "fabric",
      box(7.6, 0.12, 1.6),
      local(m, 0, 0.45, side * 2.95, side * -0.62, 0, 0),
      [0.62, 0.55, 0.42],
    );
    b.add(
      "fabric",
      box(1.6, 0.12, 5.4),
      local(m, side * 4.1, 0.45, 0, 0, 0, side * 0.62),
      [0.62, 0.55, 0.42],
    );
  }
  // Entrance on the south face with a short sandbag wall.
  b.add("paint", box(1.0, 0.8, 0.08), local(m, 2.0, 0.42, -2.34), PAINT.olive);
  b.add(
    "steel",
    cylinder(0.03, 0.03, 3.6, 4),
    local(m, -3.0, 2.8, 1.6),
    PAINT.dark,
  );
}
export function sensorMast(
  b: Batches,
  p: Extract<Placement, { kind: "sensorMast" }>,
) {
  // Tripod pedestal under the EO/IR head; the camera eye is at 2 m.
  const m = frame(p.x, 0, p.z, 0);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    bar(
      b,
      "steel",
      m,
      new THREE.Vector3(Math.cos(a) * 0.7, 0, Math.sin(a) * 0.7),
      new THREE.Vector3(0, 1.45, 0),
      0.05,
      PAINT.olive,
    );
  }
  b.add(
    "steel",
    cylinder(0.08, 0.08, 0.35, 10),
    local(m, 0, 1.6, 0),
    PAINT.olive,
  );
  b.add("concreteFloor", box(2.6, 0.12, 2.6), local(m, 0, 0.06, 0));
}

/** Lines: fence, HESCO and sandbag walls. */
export function line(b: Batches, l: Line) {
  const pts = l.closed ? [...l.path, l.path[0]] : l.path;
  for (let i = 1; i < pts.length; i++) {
    const [x0, z0] = pts[i - 1],
      [x1, z1] = pts[i];
    const len = Math.hypot(x1 - x0, z1 - z0);
    const rot = Math.atan2(x1 - x0, z1 - z0);
    const m = frame(x0, 0, z0, rot);
    if (l.kind === "fence") {
      const n = Math.max(1, Math.round(len / 3));
      for (let k = 0; k <= n; k++) {
        const z = (k / n) * len;
        b.add(
          "steel",
          cylinder(0.04, 0.04, 2.5, 6),
          local(m, 0, 1.25, z),
          PAINT.grey,
        );
        b.add(
          "steel",
          box(0.04, 0.04, 0.5),
          local(m, 0, 2.6, z - 0.0, 0.6, 0, 0),
          PAINT.grey,
        );
      }
      b.add(
        "fence",
        quad(len, 2.3),
        local(m, 0, 1.2, len / 2, 0, Math.PI / 2, 0),
      );
      for (const [y, off] of [
        [2.45, 0.05],
        [2.62, 0.15],
        [2.8, 0.25],
      ])
        b.add(
          "steel",
          box(0.015, 0.015, len),
          local(m, -off, y, len / 2),
          PAINT.dark,
        );
      b.add(
        "steel",
        cylinder(0.025, 0.025, len, 5),
        local(m, 0, 2.3, len / 2, Math.PI / 2, 0, 0),
        PAINT.grey,
      );
    } else if (l.kind === "hesco") {
      const n = Math.max(1, Math.round(len / 1.06));
      const unit = len / n;
      for (let k = 0; k < n; k++)
        b.add(
          "hesco",
          box(1.06, 2.1, unit),
          local(m, 0, 1.05, (k + 0.5) * unit),
        );
    } else {
      const n = Math.max(1, Math.round(len / 0.55));
      const unit = len / n;
      for (let row = 0; row < 3; row++)
        for (let k = 0; k < n; k++) {
          // Irregular bags: size, sag, yaw and shade vary per bag (deterministic).
          const h =
            Math.sin((i * 131 + row * 17 + k * 7) * 12.9898) * 43758.5453;
          const r = h - Math.floor(h);
          const bag = new THREE.SphereGeometry(1, 7, 4);
          bag.scale(0.27 + r * 0.05, 0.065 + r * 0.02, unit * (0.5 + r * 0.08));
          b.add(
            "fabric",
            bag,
            local(
              m,
              (r - 0.5) * 0.06,
              0.08 + row * 0.135,
              (k + 0.5 + (row % 2) * 0.5) * unit,
              0,
              (r - 0.5) * 0.3,
              (r - 0.5) * 0.08,
            ),
            [0.7 + r * 0.1, 0.64 + r * 0.08, 0.5 + r * 0.06],
          );
        }
    }
  }
}

/** Dressing for one authoritative occluder box: a city block whose every part
 * stays inside the box volume (visual occlusion ⊆ sensor occlusion). */
export function cityBlock(
  b: Batches,
  box_: {
    x_min: number;
    x_max: number;
    z_min: number;
    z_max: number;
    height: number;
  },
  seed: number,
) {
  const w = box_.x_max - box_.x_min,
    d = box_.z_max - box_.z_min,
    H = box_.height;
  const cx = (box_.x_min + box_.x_max) / 2,
    cz = (box_.z_min + box_.z_max) / 2;
  // Split along the longer axis into masses of different heights (≤ H).
  const along = w >= d;
  const parts = Math.max(1, Math.min(3, Math.round((along ? w : d) / 35)));
  const gap = 3;
  const len = ((along ? w : d) - gap * (parts - 1)) / parts;
  for (let i = 0; i < parts; i++) {
    const height =
      i === seed % parts
        ? H
        : Math.max(9, H * (0.62 + ((seed + i * 3) % 4) * 0.09));
    const off = -(along ? w : d) / 2 + len / 2 + i * (len + gap);
    const bw = along ? len : w,
      bd = along ? d : len;
    const x = cx + (along ? off : 0),
      z = cz + (along ? 0 : off);
    const parapet = 0.9;
    const body = height - parapet;
    const tint = PLASTER_TINTS[(seed + i) % PLASTER_TINTS.length];
    b.add("plaster", box(bw, body, bd), frame(x, body / 2, z, 0), tint);
    const m = frame(x, body, z, 0);
    b.add(
      "plaster",
      box(bw, parapet, 0.3),
      local(m, 0, parapet / 2, bd / 2 - 0.15),
      tint,
    );
    b.add(
      "plaster",
      box(bw, parapet, 0.3),
      local(m, 0, parapet / 2, -bd / 2 + 0.15),
      tint,
    );
    b.add(
      "plaster",
      box(0.3, parapet, bd - 0.6),
      local(m, bw / 2 - 0.15, parapet / 2, 0),
      tint,
    );
    b.add(
      "plaster",
      box(0.3, parapet, bd - 0.6),
      local(m, -bw / 2 + 0.15, parapet / 2, 0),
      tint,
    );
    // Roof plant, all below the box top.
    const roomForPlant = H - body;
    if (roomForPlant > 1.6) {
      waterTank(b, local(m, bw / 2 - 3, 0, bd / 2 - 3));
      waterTank(b, local(m, bw / 2 - 4.5, 0, bd / 2 - 3));
    }
    for (let k = 0; k < 4; k++)
      acUnit(b, local(m, -bw / 2 + 3 + k * 2.2, 0.31, -bd / 2 + 2.5));
    // Floor bands so the facade reads as storeys from a distance.
    for (let y = 3.3; y < body - 1; y += 3.3)
      b.add("concrete", box(bw + 0.1, 0.18, bd + 0.1), frame(x, y, z, 0));
    // Windows: glass set 2 cm proud of the wall, with a sill; some lit at night.
    // Every element stays within the box footprint (the parapet line).
    const faces: [number, number, number, number][] = [
      [0, 0, bd / 2, bw],
      [Math.PI, 0, -bd / 2, bw],
      [Math.PI / 2, bw / 2, 0, bd],
      [-Math.PI / 2, -bw / 2, 0, bd],
    ];
    faces.forEach(([rot, fx, fz, span], f) => {
      const bays = Math.floor((span - 2) / 3.6);
      for (let floor = 0; floor * 3.3 + 2.6 < body - 0.5; floor++)
        for (let k = 0; k < bays; k++) {
          const u = -((bays - 1) * 3.6) / 2 + k * 3.6;
          const y = floor * 3.3 + 1.75;
          const lit = (seed * 31 + f * 17 + floor * 7 + k * 13) % 9 === 0;
          const inset = 0;
          const m = frame(x, y, z, rot).multiply(
            new THREE.Matrix4().makeTranslation(
              fx === 0 ? u : 0,
              0,
              (fz !== 0 ? Math.abs(fz) : Math.abs(fx)) - inset,
            ),
          );
          if (fx !== 0)
            m.multiply(new THREE.Matrix4().makeTranslation(u, 0, 0));
          b.add(
            lit ? "glassLit" : "glass",
            quad(1.8, 1.45),
            local(m, 0, 0, 0.02),
          );
          b.add("concrete", box(2.0, 0.08, 0.08), local(m, 0, -0.78, 0.04));
        }
    });
  }
}

export function buildFacility(
  placements: readonly Placement[],
  lines: readonly Line[],
) {
  const b = new Batches();
  placements.forEach((p, i) => {
    switch (p.kind) {
      case "building":
        return building(b, p, i);
      case "hangar":
        return hangar(b, p);
      case "container":
        return container(b, p);
      case "watchtower":
        return watchtower(b, p);
      case "radarMast":
        return radarMast(b, p);
      case "commsMast":
        return commsMast(b, p);
      case "genset":
        return genset(b, p);
      case "fuelTank":
        return fuelTank(b, p);
      case "helipad":
        return helipad(b, p);
      case "lightPole":
        return lightPole(b, p);
      case "gatehouse":
        return gatehouse(b, p);
      case "boom":
        return boom(b, p);
      case "tent":
        return tent(b, p);
      case "house":
        return house(b, p, i);
      case "warehouse":
        return warehouse(b, p.x, p.z, p.w, p.d, p.h);
      case "bunker":
        return bunker(b, p);
      case "sensorMast":
        return sensorMast(b, p);
      default:
        return undefined;
    }
  });
  lines.forEach((l) => line(b, l));
  return b;
}
