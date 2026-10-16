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
    // A piece may carry its own per-vertex shade (seams, contact darkening);
    // it multiplies the tint.
    const shade = geo.getAttribute("color");
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++)
      for (let c = 0; c < 3; c++)
        colors[i * 3 + c] = tint[c] * (shade ? shade.getComponent(i, c) : 1);
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
/** Deterministic value in [0, 1) from a number (same hash as the sandbags). */
function hash01(n: number) {
  const h = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return h - Math.floor(h);
}
/** Deterministic stream of values in [0, 1) for one seed. */
function stream(seed: number) {
  let k = 0;
  return () => hash01(seed * 7.31 + ++k * 1.618);
}

/** Hand-built indexed surface: vertices with metric UVs and a per-vertex shade,
 * quads wound so their face normal agrees with a hint (smooth normals within
 * the piece, hard edges between pieces). */
class Mesh {
  private pos: number[] = [];
  private uv: number[] = [];
  private shade: number[] = [];
  private index: number[] = [];
  vertex(x: number, y: number, z: number, u: number, v: number, s = 1) {
    this.pos.push(x, y, z);
    this.uv.push(u, v);
    this.shade.push(s, s, s);
    return this.pos.length / 3 - 1;
  }
  /** Quad a-b-c-d (a ring); flipped if its normal opposes `hint`. */
  quad(a: number, b: number, c: number, d: number, hint: THREE.Vector3) {
    const p = (i: number) =>
      new THREE.Vector3(
        this.pos[i * 3],
        this.pos[i * 3 + 1],
        this.pos[i * 3 + 2],
      );
    const n = p(b)
      .sub(p(a))
      .cross(p(c).sub(p(a)));
    if (n.dot(hint) >= 0) this.index.push(a, b, c, a, c, d);
    else this.index.push(a, c, b, a, d, c);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.shade, 3));
    g.setIndex(this.index);
    g.computeVertexNormals();
    return g;
  }
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
  round = false,
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
  b.add(
    key,
    round
      ? cylinder(thickness / 2, thickness / 2, len, 3, true)
      : box(thickness, len, thickness),
    m,
    tint,
  );
}
/** Thin round member (wire, handrail): an open three-sided prism, 6 triangles. */
function rod(
  b: Batches,
  key: MaterialKey,
  parent: THREE.Matrix4,
  a: THREE.Vector3,
  c: THREE.Vector3,
  thickness: number,
  tint?: Tint,
) {
  bar(b, key, parent, a, c, thickness, tint, true);
}
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

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

const HANGAR_TRIM: Tint = [0.42, 0.45, 0.45];
/** Framed steel personnel door; `m` is the door's sill centre on the wall,
 * local +z out of the wall. */
function personnelDoor(b: Batches, m: THREE.Matrix4, tint: Tint) {
  b.add("paint", box(1.0, 2.1, 0.06), local(m, 0, 1.05, 0.03), tint);
  for (const sx of [-1, 1])
    b.add(
      "paint",
      box(0.08, 2.2, 0.1),
      local(m, sx * 0.54, 1.1, 0.05),
      HANGAR_TRIM,
    );
  b.add("paint", box(1.16, 0.08, 0.1), local(m, 0, 2.16, 0.05), HANGAR_TRIM);
  b.add("steel", box(0.12, 0.03, 0.05), local(m, 0.34, 1.0, 0.08), PAINT.dark);
  // Rain hood with a bulkhead light under it, and a step down to the apron.
  b.add(
    "paint",
    box(1.5, 0.05, 0.62),
    local(m, 0, 2.5, 0.31, 0.12, 0, 0),
    HANGAR_TRIM,
  );
  b.add("lamp", quad(0.22, 0.12), local(m, 0, 2.33, 0.08));
  b.add("concrete", box(1.3, 0.18, 0.45), local(m, 0, -0.26, 0.45));
}
/** Louvred vent: dark opening, frame and down-sloped blades; `m` is the
 * vent centre on the wall, local +z outward. */
function louvre(b: Batches, m: THREE.Matrix4, w: number, h: number) {
  b.add("rubber", quad(w, h), local(m, 0, 0, 0.015), PAINT.dark);
  const f = 0.07;
  for (const sy of [-1, 1])
    b.add(
      "paint",
      box(w + f * 2, f, 0.1),
      local(m, 0, sy * (h / 2 + f / 2), 0.05),
      HANGAR_TRIM,
    );
  for (const sx of [-1, 1])
    b.add(
      "paint",
      box(f, h, 0.1),
      local(m, sx * (w / 2 + f / 2), 0, 0.05),
      HANGAR_TRIM,
    );
  const n = Math.max(3, Math.round(h / 0.15));
  for (let k = 0; k < n; k++)
    b.add(
      "paint",
      box(w, 0.02, 0.14),
      local(m, 0, -h / 2 + ((k + 0.5) * h) / n, 0.07, 0.65, 0, 0),
      HANGAR_TRIM,
    );
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
  // Roller door with its drum housing on the front.
  const doorH = rise * 0.82;
  b.add(
    "paint",
    box(p.span * 0.62, doorH, 0.1),
    local(m, 0, doorH / 2, L + 0.06),
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
    box(p.span * 0.62 + 0.2, 0.45, 0.4),
    local(m, 0, doorH - 0.12, L + 0.24),
    HANGAR_TRIM,
  );
  b.add(
    "concrete",
    box(p.span + 0.6, 0.35, p.length + 0.6),
    local(m, 0, 0.175, 0),
  );
  // Stem walls under the arch springing along both long sides.
  for (const sx of [-1, 1])
    b.add(
      "concrete",
      box(0.3, 0.62, p.length),
      local(m, sx * (r - 0.1), 0.31, 0),
    );
  // Both end walls are framed: trim along the arch and down the corners,
  // vertical ribs (door jambs on the front), a girt on the rear.
  const archY = (x: number) =>
    0.6 + rise * Math.sqrt(Math.max(0, 1 - (x / r) ** 2));
  for (const end of [-1, 1]) {
    const ze = end * (L + 0.06);
    for (let k = 0; k < segs; k++)
      bar(
        b,
        "paint",
        m,
        new THREE.Vector3(arc[k][0], arc[k][1], ze),
        new THREE.Vector3(arc[k + 1][0], arc[k + 1][1], ze),
        0.16,
        HANGAR_TRIM,
      );
    for (const sx of [-1, 1])
      b.add(
        "paint",
        box(0.18, 0.7, 0.18),
        local(m, sx * (r - 0.02), 0.35, ze),
        HANGAR_TRIM,
      );
    const ribs =
      end > 0
        ? [-(0.62 * r + 0.14), 0.62 * r + 0.14, -0.9 * r, 0.9 * r]
        : [-0.9 * r, -0.62 * r, -0.22 * r, 0.22 * r, 0.62 * r, 0.9 * r];
    for (const x of ribs) {
      const h = archY(x) - 0.12;
      b.add("paint", box(0.14, h, 0.12), local(m, x, h / 2, ze), HANGAR_TRIM);
    }
    const wall = local(m, 0, 0, ze, 0, end > 0 ? 0 : Math.PI, 0);
    if (end > 0) {
      personnelDoor(b, local(wall, r * 0.78, 0.35, 0.02), PAINT.olive);
      // Louvred vent between the drum housing and the apex.
      const housingTop = doorH + 0.1;
      const vh = Math.min(0.9, rise + 0.6 - housingTop - 0.6);
      if (vh > 0.3)
        louvre(
          b,
          local(wall, 0, (housingTop + rise + 0.6) / 2 - 0.1, 0.02),
          1.6,
          vh,
        );
    } else {
      personnelDoor(b, local(wall, r * 0.42, 0.35, 0.02), PAINT.olive);
      const gy = 3.0;
      const gx = r * Math.sqrt(Math.max(0, 1 - ((gy - 0.6) / rise) ** 2)) - 0.1;
      b.add(
        "paint",
        box(gx * 2, 0.12, 0.1),
        local(wall, 0, gy, 0.02),
        HANGAR_TRIM,
      );
      louvre(b, local(wall, 0, 0.6 + rise * 0.66, 0.02), 1.8, 1.1);
      for (const sx of [-1, 1])
        louvre(b, local(wall, sx * r * 0.42, 4.3, 0.02), 1.2, 0.75);
    }
  }
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
  // Door end: two leaves in a frame with locking bars; castings on all eight
  // corners. Some stored boxes stand with the left leaf swung back flat
  // against the side, showing the dark interior.
  const look = hash01(p.x * 3.1 + p.z * 7.7 + level * 13.3 + p.tint);
  const open = !p.office && look < 0.3;
  b.add("steel", box(0.08, 0.18, 2.44), local(m, 3.05, 2.5, 0), PAINT.dark);
  b.add("steel", box(0.08, 0.14, 2.44), local(m, 3.05, 0.07, 0), PAINT.dark);
  for (const s of [-1, 1]) {
    if (open && s < 0) {
      b.add(
        "rubber",
        quad(1.18, 2.3),
        local(m, 3.045, 1.3, -0.595, 0, Math.PI / 2, 0),
        [0.05, 0.05, 0.05],
      );
      b.add("paint", box(1.18, 2.36, 0.05), local(m, 2.44, 1.3, -1.25), tint);
      for (const x of [2.83, 2.43])
        b.add(
          "steel",
          cylinder(0.025, 0.025, 2.3, 5),
          local(m, x, 1.3, -1.3),
          PAINT.dark,
        );
      continue;
    }
    b.add("paint", box(0.05, 2.36, 1.18), local(m, 3.04, 1.3, s * 0.595), tint);
    for (const z of [0.2, 0.6])
      b.add(
        "steel",
        cylinder(0.025, 0.025, 2.4, 5),
        local(m, 3.09, 1.3, s * z),
        PAINT.dark,
      );
  }
  b.add(
    "paint",
    box(0.02, 0.18, 0.5),
    local(m, 3.075, 2.12, 0.6),
    look > 0.65 ? [0.86, 0.72, 0.22] : PAINT.white,
  );
  for (const [x, z] of [
    [-3, -1.2],
    [3, -1.2],
    [-3, 1.2],
    [3, 1.2],
  ] as XZ[])
    for (const y of [0.08, 2.51])
      b.add("steel", box(0.16, 0.16, 0.16), local(m, x, y, z), PAINT.dark);
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
  const half = p.l / 2;
  b.add(
    "rubber",
    quad(1.4, 1.8),
    local(m, 0, 0.9, half + 0.01),
    [0.12, 0.12, 0.1],
  );
  // Eave valances, the ridge pole showing at both ends, guy ropes to stakes
  // along both sides and from each end of the ridge.
  for (const s of [-1, 1])
    b.add(
      "fabric",
      box(0.06, 0.18, p.l + 0.02),
      local(m, s * (w + 0.03), 1.72, 0),
      [0.42, 0.45, 0.33],
    );
  rod(
    b,
    "steel",
    m,
    V(0, 3.12, -half - 0.25),
    V(0, 3.12, half + 0.25),
    0.07,
    PAINT.olive,
  );
  const ROPE: Tint = [0.78, 0.74, 0.62];
  const stake = (x: number, z: number) =>
    b.add(
      "steel",
      box(0.05, 0.35, 0.05),
      local(m, x, 0.1, z, 0, 0, x > 0 ? 0.3 : -0.3),
      PAINT.dark,
    );
  const n = Math.max(2, Math.round(p.l / 2.2) + 1);
  for (let k = 0; k < n; k++) {
    const z = -half + 0.3 + (k / (n - 1)) * (p.l - 0.6);
    for (const s of [-1, 1]) {
      rod(
        b,
        "fabric",
        m,
        V(s * w, 1.8, z),
        V(s * (w + 1.4), 0.03, z),
        0.025,
        ROPE,
      );
      stake(s * (w + 1.45), z);
    }
  }
  for (const e of [-1, 1])
    for (const s of [-1, 1]) {
      const sz = e * (half + 2.4);
      rod(
        b,
        "fabric",
        m,
        V(0, 3.12, e * (half + 0.22)),
        V(s * 1.2, 0.03, sz),
        0.025,
        ROPE,
      );
      stake(s * 1.25, sz);
    }
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

/** HESCO cell: 1.06 m wide, 2.1 m tall. Each unit is a welded-mesh cell lined
 * with geotextile and filled with earth: the faces bulge between the vertical
 * coil joints, the fill sits recessed below the mesh rim, and wires run along
 * the top edges. Local frame of a run: x across, y up, z along. */
const HESCO_HALF = 0.53;
const HESCO_ROWS = [0, 0.3, 1.0, 1.7, 2.1];
/** Bulge against height: fill pressure is highest low down, none at the rim. */
const HESCO_PROFILE = [0.55, 0.95, 1, 0.8, 0];
const HESCO_COLS = [0, 0.045, 0.5, 0.955, 1];
const WIRE: Tint = [0.38, 0.39, 0.37];
function hescoRun(
  b: Batches,
  m: THREE.Matrix4,
  za: number,
  zb: number,
  capEnd: boolean,
  salt: number,
) {
  const n = Math.max(1, Math.round((zb - za) / (HESCO_HALF * 2)));
  const unit = (zb - za) / n;
  const walls = new Mesh(),
    fill = new Mesh();
  const up = new THREE.Vector3(0, 1, 0);
  for (let k = 0; k < n; k++) {
    const z0 = za + k * unit;
    const bulge = 0.045 + hash01(salt + k * 3.7) * 0.025;
    const tone = 0.9 + hash01(salt * 1.3 + k * 5.1) * 0.14;
    for (const s of [-1, 1]) {
      // Face grid: seam columns pulled in (except at the run's ends, which
      // meet the end cap or the crossing run flush), the middle pushed out.
      const grid = HESCO_ROWS.map((y, r) =>
        HESCO_COLS.map((f, c) => {
          const seam = c === 0 || c === HESCO_COLS.length - 1;
          const runEnd =
            (c === 0 && k === 0) ||
            (c === HESCO_COLS.length - 1 && k === n - 1);
          const p = HESCO_PROFILE[r];
          const off = seam
            ? runEnd
              ? 0
              : -0.045 * p
            : c === 2
              ? bulge * p
              : 0;
          const shade =
            tone *
            (seam && !runEnd ? 0.6 : c === 2 ? 1.05 : 0.9) *
            (r === 0 ? 0.78 : 1);
          // u spans exactly one texture repeat per unit so the printed seam
          // lands in the groove; v is metric.
          return walls.vertex(
            s * (HESCO_HALF + off),
            y,
            z0 + f * unit,
            f * HESCO_HALF * 2,
            y,
            shade,
          );
        }),
      );
      const out = new THREE.Vector3(s, 0, 0);
      for (let r = 0; r < HESCO_ROWS.length - 1; r++)
        for (let c = 0; c < HESCO_COLS.length - 1; c++)
          walls.quad(
            grid[r][c],
            grid[r][c + 1],
            grid[r + 1][c + 1],
            grid[r + 1][c],
            out,
          );
      // Inner face of the liner from the rim down to the fill.
      const top = 2.1,
        lip = 1.97,
        inner = HESCO_HALF - 0.03;
      walls.quad(
        walls.vertex(s * HESCO_HALF, top, z0, 0, top, tone * 0.62),
        walls.vertex(s * HESCO_HALF, top, z0 + unit, unit, top, tone * 0.62),
        walls.vertex(s * inner, lip, z0 + unit, unit, lip, tone * 0.45),
        walls.vertex(s * inner, lip, z0, 0, lip, tone * 0.45),
        new THREE.Vector3(-s, 0.25, 0),
      );
    }
    // Earth fill: slightly mounded, darker towards the shaded rim.
    const crown = 1.99 + hash01(salt * 0.7 + k * 9.3) * 0.06;
    const xs = [-(HESCO_HALF - 0.03), 0, HESCO_HALF - 0.03];
    const g = [0, 0.5, 1].map((f, j) =>
      xs.map((x, c) => {
        const centre = c === 1 && j === 1;
        const edge = c !== 1 && j !== 1;
        const y = centre ? crown : edge ? 1.965 : 1.98;
        const z = z0 + f * unit;
        return fill.vertex(x, y, z, x, z, centre ? 1 : edge ? 0.74 : 0.86);
      }),
    );
    for (let j = 0; j < 2; j++)
      for (let c = 0; c < 2; c++)
        fill.quad(g[j][c], g[j][c + 1], g[j + 1][c + 1], g[j + 1][c], up);
  }
  // End walls of the run: always at the start (also the outside face of a
  // corner), at the end only where nothing continues.
  const ends: [number, number][] = [[za, -1]];
  if (capEnd) ends.push([zb, 1]);
  for (const [z, dir] of ends)
    walls.quad(
      walls.vertex(-HESCO_HALF, 0, z, 0, 0, 0.74),
      walls.vertex(HESCO_HALF, 0, z, 1.06, 0, 0.74),
      walls.vertex(HESCO_HALF, 2.1, z, 1.06, 2.1, 0.95),
      walls.vertex(-HESCO_HALF, 2.1, z, 0, 2.1, 0.95),
      new THREE.Vector3(0, 0, dir),
    );
  b.add("hesco", walls.geometry(), m);
  b.add("fabric", fill.geometry(), m, [0.5, 0.42, 0.32]);
  // Mesh wires: top edges of both faces, a cross wire at every joint, and the
  // vertical coil joint between neighbouring cells.
  for (const s of [-1, 1])
    bar(
      b,
      "steel",
      m,
      V(s * HESCO_HALF, 2.1, za),
      V(s * HESCO_HALF, 2.1, zb),
      0.022,
      WIRE,
    );
  for (let k = 0; k <= n; k++) {
    const z = za + k * unit;
    rod(
      b,
      "steel",
      m,
      V(-HESCO_HALF, 2.1, z),
      V(HESCO_HALF, 2.1, z),
      0.022,
      WIRE,
    );
    if (k > 0 && k < n)
      for (const s of [-1, 1])
        rod(
          b,
          "steel",
          m,
          V(s * 0.51, 0.04, z),
          V(s * 0.51, 1.95, z),
          0.026,
          WIRE,
        );
  }
}

/** Concertina coil along the top of a fence run, resting on the outrigger
 * strands (outside, local -x). Two counter-wound low-segment helices of thin
 * double-sided ribbon cross each other like the clipped loops of a deployed
 * coil: 40 triangles per metre of fence. */
export function concertina(
  b: Batches,
  m: THREE.Matrix4,
  len: number,
  salt: number,
) {
  const radius = 0.3,
    cx = -0.17,
    cy = 2.92,
    pitch = 1.2,
    perTurn = 6,
    half = 0.02;
  const steps = Math.max(perTurn, Math.round((len / pitch) * perTurn));
  const coil = new Mesh();
  for (const hand of [1, -1]) {
    const front: [number, number][] = [],
      back: [number, number][] = [];
    const centres: THREE.Vector3[] = [];
    let s = 0;
    for (let j = 0; j <= steps; j++) {
      const a = hand * (j / perTurn) * Math.PI * 2 + Math.PI / 2;
      const jitter = hash01(salt + j * 1.7 + hand * 0.37);
      const r = radius * (0.92 + jitter * 0.16);
      // Loops lean a little out of true, as a stretched coil does.
      const z = Math.min(
        len,
        Math.max(0, (j / steps) * len + (jitter - 0.5) * 0.08),
      );
      const p = new THREE.Vector3(
        cx + Math.cos(a) * r,
        cy + Math.sin(a) * r,
        z,
      );
      if (j) s += p.distanceTo(centres[j - 1]);
      centres.push(p);
      for (const list of [front, back])
        list.push([
          coil.vertex(p.x, p.y, p.z - half, s, 0),
          coil.vertex(p.x, p.y, p.z + half, s, half * 2),
        ]);
    }
    for (let j = 0; j < steps; j++) {
      const mid = centres[j]
        .clone()
        .add(centres[j + 1])
        .multiplyScalar(0.5);
      const radial = new THREE.Vector3(mid.x - cx, mid.y - cy, 0);
      const [a0, a1] = front[j],
        [b0, b1] = front[j + 1];
      coil.quad(a0, a1, b1, b0, radial);
      const [c0, c1] = back[j],
        [d0, d1] = back[j + 1];
      coil.quad(c0, c1, d1, d0, radial.clone().negate());
    }
  }
  b.add("steel", coil.geometry(), m, [0.5, 0.52, 0.54]);
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
        // Outrigger arm leaning out (local -x is outside) under the strands.
        bar(
          b,
          "steel",
          m,
          new THREE.Vector3(0, 2.36, z),
          new THREE.Vector3(-0.3, 2.88, z),
          0.04,
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
      concertina(b, m, len, i * 17 + Math.round(x0 * 3 + z0 * 5));
    } else if (l.kind === "hesco") {
      // Corners: a run that follows another starts half a unit early and the
      // one before it stops half a unit short, so the corner cell is whole.
      const prev = i > 1 || !!l.closed,
        next = i < pts.length - 1 || !!l.closed;
      const za = prev ? -HESCO_HALF : 0,
        zb = len - (next ? HESCO_HALF : 0);
      if (zb - za > 0.3)
        hescoRun(b, m, za, zb, !next, i * 31 + Math.round(x0 * 7 + z0 * 13));
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

/** An authoritative occluder box (scenario `terrain_boxes`). */
export type OccluderBox = {
  x_min: number;
  x_max: number;
  z_min: number;
  z_max: number;
  height: number;
};
const SIGN_TINTS: Tint[] = [
  [0.75, 0.16, 0.12],
  [0.22, 0.36, 0.62],
  [0.86, 0.72, 0.22],
  [0.24, 0.5, 0.32],
  [0.92, 0.92, 0.9],
  [0.3, 0.3, 0.32],
];
/** Four facades of a footprint: a frame on each wall (local +z out, x along). */
function facades(x: number, z: number, w: number, d: number) {
  return (
    [
      [0, d / 2, w],
      [Math.PI, d / 2, w],
      [Math.PI / 2, w / 2, d],
      [-Math.PI / 2, w / 2, d],
    ] as const
  ).map(([rot, half, span]) => ({
    m: frame(x, 0, z, rot).multiply(
      new THREE.Matrix4().makeTranslation(0, 0, half),
    ),
    span,
  }));
}

/** Dressing for one authoritative occluder box: a city block whose every part
 * stays inside the box volume (visual occlusion ⊆ sensor occlusion). */
export function cityBlock(b: Batches, box_: OccluderBox, seed: number) {
  const w = box_.x_max - box_.x_min,
    d = box_.z_max - box_.z_min,
    H = box_.height;
  if (!(w > 1 && d > 1 && H > 1)) return;
  const cx = (box_.x_min + box_.x_max) / 2,
    cz = (box_.z_min + box_.z_max) / 2;
  // Split along the longer axis into masses of different heights (≤ H).
  const along = w >= d;
  const parts = Math.max(1, Math.min(3, Math.round((along ? w : d) / 35)));
  const gap = 3;
  const len = ((along ? w : d) - gap * (parts - 1)) / parts;
  // Facade parts sit up to 10 cm proud of a wall: this skin keeps them inside.
  const skin = Math.min(0.12, w / 8, d / 8);
  for (let i = 0; i < parts; i++) {
    const height =
      i === seed % parts
        ? H
        : Math.min(H, Math.max(9, H * (0.62 + ((seed + i * 3) % 4) * 0.09)));
    const off = -(along ? w : d) / 2 + len / 2 + i * (len + gap);
    cityMass(
      b,
      cx + (along ? off : 0),
      cz + (along ? 0 : off),
      (along ? len : w) - skin * 2,
      (along ? d : len) - skin * 2,
      height,
      H,
      seed,
      i,
    );
  }
}

/** One building of a city block, footprint bw × bd, roof line `height`, all
 * roof plant below `top`. Taller masses get a shop podium on the full
 * footprint and a tower set back far enough to carry balconies. */
function cityMass(
  b: Batches,
  x: number,
  z: number,
  bw: number,
  bd: number,
  height: number,
  top: number,
  seed: number,
  i: number,
) {
  const tint = PLASTER_TINTS[(seed + i) % PLASTER_TINTS.length];
  if (bw < 3 || bd < 3 || height < 3) {
    b.add("plaster", box(bw, height, bd), frame(x, height / 2, z, 0), tint);
    return;
  }
  const rnd = stream(seed * 97 + i * 13 + 5);
  const parapet = Math.min(0.9, height * 0.12);
  const body = height - parapet;
  const podium = body >= 12 && Math.min(bw, bd) >= 16;
  const PH = podium ? 4.2 : 0;
  // Balconies project 1.15 m; the tower is set back 1.3 m.
  const inset = podium ? 1.3 : 0;
  const tw = bw - inset * 2,
    td = bd - inset * 2;
  if (podium) {
    b.add(
      "concrete",
      box(bw, PH, bd),
      frame(x, PH / 2, z, 0),
      [0.95, 0.92, 0.86],
    );
    const up = 0.55;
    for (const s of [-1, 1]) {
      b.add(
        "plaster",
        box(bw, up, 0.25),
        frame(x, PH + up / 2, z + s * (bd / 2 - 0.125), 0),
        tint,
      );
      b.add(
        "plaster",
        box(0.25, up, bd - 0.5),
        frame(x + s * (bw / 2 - 0.125), PH + up / 2, z, 0),
        tint,
      );
    }
    shopfronts(b, x, z, bw, bd, seed, i);
  }
  b.add(
    "plaster",
    box(tw, body - PH, td),
    frame(x, PH + (body - PH) / 2, z, 0),
    tint,
  );
  const m = frame(x, body, z, 0);
  b.add(
    "plaster",
    box(tw, parapet, 0.3),
    local(m, 0, parapet / 2, td / 2 - 0.15),
    tint,
  );
  b.add(
    "plaster",
    box(tw, parapet, 0.3),
    local(m, 0, parapet / 2, -td / 2 + 0.15),
    tint,
  );
  b.add(
    "plaster",
    box(0.3, parapet, td - 0.6),
    local(m, tw / 2 - 0.15, parapet / 2, 0),
    tint,
  );
  b.add(
    "plaster",
    box(0.3, parapet, td - 0.6),
    local(m, -tw / 2 + 0.15, parapet / 2, 0),
    tint,
  );
  b.add("concreteFloor", box(tw - 0.5, 0.06, td - 0.5), local(m, 0, 0.03, 0));
  roofPlant(b, x, z, tw, td, body, top - body, tint, rnd);
  // Floor bands so the facade reads as storeys from a distance.
  for (let y = PH + 3.3; y < body - 1; y += 3.3)
    b.add("concrete", box(tw + 0.1, 0.18, td + 0.1), frame(x, y, z, 0));
  // Windows: glass set 2 cm proud of the wall, with a sill; some lit at night.
  // On a set-back tower some bays carry a stack of balconies instead, in one
  // balustrade style per building.
  const style = BALCONY_KINDS[Math.floor(rnd() * BALCONY_KINDS.length)];
  facades(x, z, tw, td).forEach(({ m: F, span }, f) => {
    const bays = Math.floor((span - 2) / 3.6);
    for (let k = 0; k < bays; k++) {
      const u = -((bays - 1) * 3.6) / 2 + k * 3.6;
      const column = hash01(seed * 977 + i * 131 + f * 31 + k * 7.7);
      const balconies = podium && span >= 12 && column < 0.26;
      for (let floor = 0; PH + floor * 3.3 + 2.6 < body - 0.5; floor++) {
        const yf = PH + floor * 3.3;
        const cell = hash01(column * 91.7 + floor * 3.1);
        const lit = (seed * 31 + f * 17 + floor * 7 + k * 13) % 9 === 0;
        if (balconies && floor >= 1 && cell > 0.06) {
          balcony(b, F, u, yf, style, tint, lit, cell < 0.3);
          continue;
        }
        const wm = local(F, u, yf + 1.75, 0);
        b.add(
          lit ? "glassLit" : "glass",
          quad(1.8, 1.45),
          local(wm, 0, 0, 0.02),
        );
        b.add("concrete", box(2.0, 0.08, 0.08), local(wm, 0, -0.78, 0.04));
        // Split units under some windows of a set-back tower.
        if (podium && cell > 0.88)
          acUnit(b, local(F, u + 0.45, yf + 0.55, 0.17));
      }
    }
  });
}

/** Projecting balcony on a set-back facade: slab, balustrade (solid plaster or
 * steel rails) and a door; every part within 1.15 m of the wall. */
type BalconyKind = "solid" | "rail" | "glass";
const BALCONY_KINDS: BalconyKind[] = ["solid", "solid", "rail", "glass"];
function balcony(
  b: Batches,
  F: THREE.Matrix4,
  u: number,
  yf: number,
  kind: BalconyKind,
  tint: Tint,
  lit: boolean,
  ac: boolean,
) {
  b.add(
    lit ? "glassLit" : "glass",
    quad(1.6, 2.2),
    local(F, u, yf + 1.2, 0.02),
  );
  b.add("concrete", box(3.0, 0.2, 1.15), local(F, u, yf - 0.08, 0.575));
  if (kind === "solid") {
    b.add("plaster", box(3.0, 0.95, 0.1), local(F, u, yf + 0.495, 1.1), tint);
    for (const s of [-1, 1])
      b.add(
        "plaster",
        box(0.1, 0.95, 1.0),
        local(F, u + s * 1.45, yf + 0.495, 0.55),
        tint,
      );
  } else {
    // Handrail on three sides; a mid rail and end posts, or a glass panel.
    const y = yf + 1.0;
    rod(
      b,
      "steel",
      F,
      V(u - 1.5, y, 1.11),
      V(u + 1.5, y, 1.11),
      0.06,
      PAINT.dark,
    );
    for (const s of [-1, 1])
      rod(
        b,
        "steel",
        F,
        V(u + s * 1.47, y, 0.02),
        V(u + s * 1.47, y, 1.11),
        0.05,
        PAINT.dark,
      );
    if (kind === "rail") {
      rod(
        b,
        "steel",
        F,
        V(u - 1.5, yf + 0.5, 1.11),
        V(u + 1.5, yf + 0.5, 1.11),
        0.04,
        PAINT.dark,
      );
      for (const du of [-1.47, -0.5, 0.5, 1.47])
        rod(
          b,
          "steel",
          F,
          V(u + du, yf, 1.11),
          V(u + du, y, 1.11),
          Math.abs(du) > 1 ? 0.05 : 0.035,
          PAINT.dark,
        );
    } else b.add("glass", quad(2.9, 0.9), local(F, u, yf + 0.5, 1.12));
  }
  if (ac) acUnit(b, local(F, u + 1.15, yf + 0.32, 0.55, 0, Math.PI / 2, 0));
}

/** Ground-floor shops on a podium: glazed fronts with fascia signs, roller
 * shutters, or plain wall with a small window; all within 10 cm of the wall. */
function shopfronts(
  b: Batches,
  x: number,
  z: number,
  bw: number,
  bd: number,
  seed: number,
  i: number,
) {
  facades(x, z, bw, bd).forEach(({ m: F, span }, f) => {
    const bays = Math.floor((span - 1.5) / 4.2);
    for (let k = 0; k < bays; k++) {
      const u = -((bays - 1) * 4.2) / 2 + k * 4.2;
      const h = hash01(seed * 613 + i * 71 + f * 23 + k * 5.3);
      const sign = SIGN_TINTS[Math.floor(hash01(h * 47.1) * SIGN_TINTS.length)];
      if (h < 0.58) {
        b.add(
          h < 0.12 ? "glassLit" : "glass",
          quad(3.3, 2.5),
          local(F, u, 1.45, 0.02),
        );
        for (const y of [0.16, 2.74])
          rod(
            b,
            "steel",
            F,
            V(u - 1.7, y, 0.04),
            V(u + 1.7, y, 0.04),
            0.08,
            PAINT.dark,
          );
        rod(
          b,
          "steel",
          F,
          V(u + 0.8, 0.2, 0.04),
          V(u + 0.8, 2.7, 0.04),
          0.06,
          PAINT.dark,
        );
        b.add("paint", box(3.7, 0.7, 0.08), local(F, u, 3.4, 0.04), sign);
      } else if (h < 0.86) {
        b.add(
          "paint",
          box(3.3, 2.7, 0.05),
          local(F, u, 1.35, 0.025),
          PAINT.grey,
        );
        for (let s = 0; s < 3; s++) {
          const y = 0.5 + s * 0.8;
          rod(
            b,
            "steel",
            F,
            V(u - 1.65, y, 0.06),
            V(u + 1.65, y, 0.06),
            0.03,
            PAINT.dark,
          );
        }
        b.add(
          "paint",
          box(3.5, 0.32, 0.09),
          local(F, u, 2.86, 0.045),
          PAINT.grey,
        );
        if (h < 0.75)
          b.add("paint", box(3.7, 0.6, 0.08), local(F, u, 3.45, 0.04), sign);
      } else {
        b.add("glass", quad(1.2, 1.0), local(F, u, 1.9, 0.02));
        b.add("concrete", box(1.4, 0.08, 0.08), local(F, u, 1.36, 0.04));
      }
    }
  });
}

/** Roof plant inside a roof of tw × td at height `body`, all under `room`
 * metres. The roof is cut into zones along its length (more on long slabs)
 * holding, in a shuffled order: stair bulkheads (some with a lift overrun) or
 * roof hatches where there is no headroom, water tanks or solar panels, and
 * condensers with vent stacks and a dish or an antenna. */
type RoofZone = "access" | "tanks" | "plant";
function roofPlant(
  b: Batches,
  x: number,
  z: number,
  tw: number,
  td: number,
  body: number,
  room: number,
  tint: Tint,
  rnd: () => number,
) {
  const A = Math.max(tw, td),
    B = Math.min(tw, td);
  const edge = 0.8;
  const zones = Math.max(3, Math.min(6, Math.floor(A / 13)));
  const zoneLen = (A - edge * 2) / zones;
  const across = B / 2 - edge;
  if (zoneLen < 2 || across < 1.2 || room < 0.7) return;
  // Local x runs along the long side of the roof.
  const m = frame(x, body, z, tw >= td ? 0 : Math.PI / 2);
  const kinds: RoofZone[] = (
    ["access", "tanks", "plant", "plant", "access", "tanks"] as RoofZone[]
  ).slice(0, zones);
  for (let k = kinds.length - 1; k > 0; k--) {
    const j = Math.floor(rnd() * (k + 1));
    [kinds[k], kinds[j]] = [kinds[j], kinds[k]];
  }
  const side = () => (rnd() < 0.5 ? -1 : 1);
  kinds.forEach((kind, slot) => {
    const a0 = -A / 2 + edge + zoneLen * (slot + 0.5);
    if (kind === "access")
      roofAccess(b, m, a0, zoneLen, across, room, tint, rnd);
    else if (kind === "tanks") {
      if (room >= 1.75) {
        const n = Math.max(
          1,
          Math.min(
            Math.floor((zoneLen - 0.4) / 1.5),
            1 + Math.floor(rnd() * 4),
          ),
        );
        const c = side() * (across - 0.8) * (rnd() < 0.3 ? 0 : 1);
        b.add(
          "steel",
          box(n * 1.5, 0.15, 1.6),
          local(m, a0, 0.075, c),
          PAINT.grey,
        );
        for (let k = 0; k < n; k++)
          waterTank(b, local(m, a0 + (k - (n - 1) / 2) * 1.5, 0.15, c));
      } else {
        // No headroom: rows of low-tilt solar panels.
        const rows = Math.max(
          1,
          Math.min(Math.floor((across * 2) / 2.2), 2 + Math.floor(rnd() * 2)),
        );
        const n = Math.max(1, Math.floor((zoneLen - 0.6) / 1.05));
        for (let r = 0; r < rows; r++) {
          const c = (r - (rows - 1) / 2) * 2.2;
          b.add(
            "steel",
            box(n * 1.05, 0.08, 0.08),
            local(m, a0, 0.3, c),
            PAINT.grey,
          );
          for (let k = 0; k < n; k++)
            b.add(
              "glass",
              box(1.0, 0.04, 1.6),
              local(m, a0 + (k - (n - 1) / 2) * 1.05, 0.42, c, 0.32, 0, 0),
            );
        }
      }
    } else {
      // Condensers in one or two rows, vent stacks, a dish or an antenna.
      const per = Math.max(
        1,
        Math.min(Math.floor((zoneLen - 0.6) / 1.1), 2 + Math.floor(rnd() * 5)),
      );
      const rows = rnd() < 0.5 ? 1 : 2;
      const s = side();
      for (let r = 0; r < rows; r++)
        for (let k = 0; k < per; k++)
          acUnit(
            b,
            local(
              m,
              a0 + (k - (per - 1) / 2) * 1.1,
              0.31,
              s * (across - 0.4 - r * 1.3),
            ),
          );
      const vents = 1 + Math.floor(rnd() * 3);
      const vh = Math.min(1.2, room - 0.15);
      for (let k = 0; k < vents; k++)
        b.add(
          "steel",
          cylinder(0.08, 0.08, vh, 6),
          local(
            m,
            a0 + (rnd() - 0.5) * (zoneLen - 1),
            vh / 2,
            -s * (across - 0.3 - rnd() * 1.2),
          ),
          PAINT.grey,
        );
      if (room >= 1.8 && rnd() < 0.6) {
        const dish = new THREE.SphereGeometry(
          0.5,
          12,
          4,
          0,
          Math.PI * 2,
          0,
          Math.PI / 3.2,
        );
        const da = a0 + (rnd() - 0.5) * (zoneLen - 1.6);
        b.add(
          "steel",
          cylinder(0.04, 0.04, 0.9, 6),
          local(m, da, 0.45, 0),
          PAINT.grey,
        );
        b.add(
          "paint",
          dish,
          local(m, da, 1.0, 0, 0, rnd() * Math.PI * 2, 0)
            .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2 - 0.5))
            .multiply(new THREE.Matrix4().makeTranslation(0, -0.3, 0)),
          PAINT.white,
        );
      } else if (room >= 3) {
        const ah = Math.min(4, room - 0.1);
        b.add(
          "steel",
          cylinder(0.035, 0.05, ah, 6),
          local(m, a0 + (rnd() - 0.5) * (zoneLen - 1), ah / 2, 0),
          PAINT.grey,
        );
      }
    }
  });
}
/** Stair bulkhead (with a door, an overhanging lid and sometimes a lift
 * overrun) where there is headroom, otherwise a roof hatch. */
function roofAccess(
  b: Batches,
  m: THREE.Matrix4,
  a0: number,
  zoneLen: number,
  across: number,
  room: number,
  tint: Tint,
  rnd: () => number,
) {
  const side = () => (rnd() < 0.5 ? -1 : 1);
  if (room < 3.3) {
    const c = (rnd() - 0.5) * across;
    b.add("concrete", box(1.0, 0.4, 1.0), local(m, a0, 0.2, c));
    b.add("paint", box(1.15, 0.07, 1.15), local(m, a0, 0.435, c), PAINT.grey);
    return;
  }
  const sw = Math.min(zoneLen - 0.4, 3.0 + rnd() * 1.6),
    sd = Math.min(across * 2 - 0.4, 3.4 + rnd() * 2.2),
    sh = Math.min(room - 0.25, 2.6 + rnd() * 0.5);
  const s = side();
  const c = rnd() < 0.35 ? 0 : s * (across - sd / 2);
  const a = a0 + (rnd() - 0.5) * Math.max(0, zoneLen - sw - 0.4);
  b.add("plaster", box(sw, sh, sd), local(m, a, sh / 2, c), tint);
  b.add("concrete", box(sw + 0.3, 0.12, sd + 0.3), local(m, a, sh + 0.06, c));
  const doorFace = c === 0 ? side() : -s;
  const da = a + (rnd() - 0.5) * Math.max(0, sw - 1.3);
  b.add(
    "paint",
    box(0.95, 2.05, 0.05),
    local(m, da, 1.03, c + doorFace * (sd / 2 + 0.025)),
    rnd() < 0.5 ? PAINT.grey : PAINT.blue,
  );
  if (rnd() < 0.55 && room >= sh + 1.4) {
    const lh = Math.min(room - 0.1, sh + 1.0 + rnd() * 0.8);
    const lw = Math.min(2.4, sw * 0.6),
      ld = Math.min(2.6, sd);
    b.add(
      "plaster",
      box(lw, lh, ld),
      local(m, a + side() * (sw / 2 - lw / 2), lh / 2, c),
      tint,
    );
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
