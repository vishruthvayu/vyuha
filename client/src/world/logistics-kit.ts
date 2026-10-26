import * as THREE from "three";
import { Batches, box, cylinder, frame, quad, type Tint } from "./kit";

/** Original metric synthetic architecture. Presentation scenery, never sensor
 * geometry. h includes roof plant; w/d include canopy and apron. */
export type AuthoredStructure = {
  kind: "terminal" | "logisticsShed" | "waterTower";
  x: number;
  z: number;
  rot: number;
  w: number;
  d: number;
  h: number;
};
export function isAuthoredStructure(p: {
  kind: string;
}): p is AuthoredStructure {
  return (
    p.kind === "terminal" ||
    p.kind === "logisticsShed" ||
    p.kind === "waterTower"
  );
}
const TEAL: Tint = [0.16, 0.43, 0.46];
const SLATE: Tint = [0.22, 0.28, 0.3];
const STONE: Tint = [0.8, 0.77, 0.68];
const PALE: Tint = [0.9, 0.91, 0.85];

function validate(p: AuthoredStructure) {
  if (
    ![p.x, p.z, p.rot, p.w, p.d, p.h].every(Number.isFinite) ||
    p.w < 6 ||
    p.w > 100 ||
    p.d < 6 ||
    p.d > 100 ||
    p.h < 5 ||
    p.h > 45
  )
    throw new RangeError("Unsupported authored structure envelope");
}
function at(m: THREE.Matrix4, x: number, y: number, z: number, rx = 0, ry = 0) {
  return m
    .clone()
    .multiply(
      new THREE.Matrix4().compose(
        new THREE.Vector3(x, y, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0)),
        new THREE.Vector3(1, 1, 1),
      ),
    );
}

/** Recessed glazed front, colonnade, deep visor and roof plant. */
export function logisticsTerminal(b: Batches, p: AuthoredStructure) {
  validate(p);
  const m = frame(p.x, 0, p.z, p.rot);
  const W = p.w,
    D = p.d,
    H = p.h - 1.3,
    front = D / 2 - 2;
  b.add("concreteFloor", box(W, 0.22, D), at(m, 0, 0.11, 0), STONE);
  b.add(
    "plaster",
    box(W - 1, H - 0.4, 0.32),
    at(m, 0, H / 2 + 0.2, -D / 2 + 0.5),
    PALE,
  );
  for (const s of [-1, 1]) {
    b.add(
      "plaster",
      box(0.32, H - 0.4, D - 2.8),
      at(m, s * (W / 2 - 0.5), H / 2 + 0.2, -0.7),
      PALE,
    );
    b.add(
      "paint",
      box(0.45, H + 0.2, 2.4),
      at(m, s * (W / 2 - 0.6), (H + 0.2) / 2, front - 0.8),
      TEAL,
    );
  }
  // Dark solid backing provides depth without a transparent sorting pass.
  b.add(
    "paint",
    box(W - 1.6, H - 0.7, 0.15),
    at(m, 0, H / 2, front - 1),
    SLATE,
  );
  const bays = Math.max(2, Math.ceil((W - 2) / 4)),
    pitch = (W - 2) / bays;
  const floors = Math.max(1, Math.floor(H / 3.5));
  for (let level = 0; level < floors; level++) {
    const y0 = 0.4 + level * ((H - 0.8) / floors),
      height = (H - 0.8) / floors - 0.25;
    // Pale horizontal reveals keep a shaded facade legible at station distance.
    b.add(
      "concrete",
      box(W - 1.8, 0.24, 0.7),
      at(m, 0, y0 + 0.12, front - 0.15),
      STONE,
    );
    for (let i = 0; i < bays; i++) {
      const x = -W / 2 + 1 + (i + 0.5) * pitch;
      b.add(
        "glass",
        quad(pitch - 0.16, height),
        at(m, x, y0 + height / 2, front - 0.5),
      );
      b.add(
        "steel",
        box(0.09, height, 0.18),
        at(m, x - pitch / 2 + 0.08, y0 + height / 2, front - 0.42),
        SLATE,
      );
      b.add(
        "paint",
        box(pitch, 0.13, 0.28),
        at(m, x, y0 + height, front - 0.4),
        TEAL,
      );
    }
  }
  for (let i = 0; i <= bays; i++) {
    const x = -W / 2 + 1 + i * pitch;
    b.add(
      "concrete",
      box(0.26, H - 0.2, 0.32),
      at(m, x, H / 2, D / 2 - 0.6),
      STONE,
    );
    b.add(
      "steel",
      box(0.12, 0.18, 1.7),
      at(m, x, H - 0.3, front + 0.55),
      SLATE,
    );
  }
  b.add("paint", box(W, 0.28, 2.4), at(m, 0, H - 0.05, D / 2 - 1.2), TEAL);
  b.add("lamp", box(W - 2, 0.035, 0.08), at(m, 0, H - 0.21, D / 2 - 0.9));
  b.add("concreteFloor", box(W, 0.22, D - 1), at(m, 0, H + 0.2, -0.5), STONE);
  for (const s of [-1, 1])
    b.add(
      "concrete",
      box(W, 0.5, 0.18),
      at(m, 0, H + 0.55, s * (D / 2 - 0.65)),
      PALE,
    );
  for (const x of [-W * 0.22, W * 0.22]) {
    b.add(
      "paint",
      box(Math.min(3, W / 6), 0.5, Math.min(2.2, D / 4)),
      at(m, x, H + 1, -D * 0.12),
      SLATE,
    );
    b.add(
      "steel",
      cylinder(0.48, 0.48, 0.04, 12),
      at(m, x, H + 1.27, -D * 0.12),
      PALE,
    );
  }
  const doorH = Math.min(2.5, H * 0.7);
  b.add(
    "paint",
    box(Math.min(2.2, W / 4), doorH, 0.12),
    at(m, 0, doorH / 2 + 0.25, front - 0.39),
    TEAL,
  );
  b.add(
    "glass",
    quad(Math.min(1.8, W / 4 - 0.2), doorH - 0.3),
    at(m, 0, doorH / 2 + 0.25, front - 0.32),
  );
}

function triangle(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) {
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([...a, ...b, ...c], 3),
  );
  g.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute([a.x, a.y, b.x, b.y, c.x, c.y], 2),
  );
  g.computeVertexNormals();
  return g;
}

/** Real sawtooth roofs, vertical clerestories, end walls and loading bays. */
export function logisticsShed(b: Batches, p: AuthoredStructure) {
  validate(p);
  const m = frame(p.x, 0, p.z, p.rot);
  const W = p.w,
    D = p.d,
    eave = p.h * 0.72,
    rise = p.h - eave;
  b.add("concreteFloor", box(W, 0.2, D), at(m, 0, 0.1, 0), STONE);
  for (const s of [-1, 1]) {
    b.add(
      "plaster",
      box(0.25, eave, D),
      at(m, s * (W / 2 - 0.125), eave / 2, 0),
      STONE,
    );
    b.add(
      "corrugated",
      box(W - 0.5, eave, 0.22),
      at(m, 0, eave / 2, s * (D / 2 - 0.11)),
      PALE,
    );
  }
  const teeth = Math.max(2, Math.ceil(W / 9)),
    pitch = W / teeth;
  for (let i = 0; i < teeth; i++) {
    const x0 = -W / 2 + i * pitch,
      x1 = x0 + pitch;
    const slope = Math.atan2(rise, pitch);
    b.add(
      "corrugated",
      quad(Math.hypot(pitch, rise), D),
      at(m, (x0 + x1) / 2, eave + rise / 2, 0)
        .multiply(new THREE.Matrix4().makeRotationZ(slope))
        .multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2)),
      PALE,
    );
    b.add(
      "glass",
      quad(D - 0.3, rise - 0.1),
      at(m, x1 - 0.02, eave + rise / 2, 0, 0, Math.PI / 2),
    );
    b.add("steel", box(0.1, 0.1, D), at(m, x1 - 0.05, p.h - 0.05, 0), TEAL);
    for (const s of [-1, 1]) {
      const a = new THREE.Vector3(x0, eave, (s * D) / 2);
      const high = new THREE.Vector3(x1, p.h, (s * D) / 2),
        low = new THREE.Vector3(x1, eave, (s * D) / 2);
      b.add(
        "plaster",
        s > 0 ? triangle(a, low, high) : triangle(a, high, low),
        m,
        STONE,
      );
    }
  }
  const bays = Math.max(1, Math.floor((W - 2) / 6));
  for (let i = 0; i < bays; i++) {
    const x = (i - (bays - 1) / 2) * ((W - 2) / bays);
    const dw = Math.min(3.7, (W - 2) / bays - 0.5),
      dh = eave * 0.76;
    b.add(
      "rubber",
      box(dw + 0.3, dh + 0.2, 0.18),
      at(m, x, dh / 2 + 0.2, D / 2 - 0.02),
      SLATE,
    );
    b.add(
      "paint",
      box(dw, dh, 0.1),
      at(m, x, dh / 2 + 0.2, D / 2 + 0.08),
      TEAL,
    );
    for (let y = 0.5; y < dh; y += 0.45)
      b.add(
        "steel",
        box(dw, 0.035, 0.06),
        at(m, x, y + 0.2, D / 2 + 0.15),
        SLATE,
      );
    b.add("lamp", box(dw * 0.5, 0.08, 0.12), at(m, x, dh + 0.45, D / 2 + 0.12));
  }
}

/** Civic-scale orientation landmark: raised storage, support grid and pipe. */
export function waterTower(b: Batches, p: AuthoredStructure) {
  validate(p);
  const m = frame(p.x, 0, p.z, p.rot);
  const radius = Math.min(p.w, p.d) * 0.42;
  const tankHeight = p.h * 0.22,
    floor = p.h - tankHeight - 0.2;
  b.add("concreteFloor", box(p.w, 0.25, p.d), at(m, 0, 0.125, 0), STONE);
  for (const x of [-radius * 0.65, radius * 0.65])
    for (const z of [-radius * 0.65, radius * 0.65]) {
      b.add("concrete", box(0.44, floor, 0.44), at(m, x, floor / 2, z), PALE);
      b.add("concrete", box(1, 0.45, 1), at(m, x, 0.225, z), STONE);
    }
  b.add(
    "paint",
    cylinder(radius, radius * 0.65, tankHeight * 0.35, 24),
    at(m, 0, floor + tankHeight * 0.175, 0),
    TEAL,
  );
  b.add(
    "paint",
    cylinder(radius, radius, tankHeight * 0.65, 24),
    at(m, 0, floor + tankHeight * 0.675, 0),
    PALE,
  );
  b.add(
    "steel",
    cylinder(radius * 1.015, radius * 1.015, 0.12, 24),
    at(m, 0, p.h - 0.2, 0),
    TEAL,
  );
  for (const y of [floor * 0.35, floor * 0.7]) {
    for (const z of [-radius * 0.65, radius * 0.65])
      b.add("steel", box(radius * 1.3, 0.18, 0.18), at(m, 0, y, z), SLATE);
    for (const x of [-radius * 0.65, radius * 0.65])
      b.add("steel", box(0.18, 0.18, radius * 1.3), at(m, x, y, 0), SLATE);
  }
  b.add(
    "paint",
    cylinder(0.09, 0.09, floor, 8),
    at(m, radius * 0.4, floor / 2, radius * 0.4),
    TEAL,
  );
}

export function addLogisticsArchitecture(
  b: Batches,
  structures: readonly AuthoredStructure[],
) {
  for (const p of structures) {
    if (p.kind === "terminal") logisticsTerminal(b, p);
    else if (p.kind === "logisticsShed") logisticsShed(b, p);
    else waterTower(b, p);
  }
}
export function buildLogisticsArchitecture(
  structures: readonly AuthoredStructure[],
) {
  const b = new Batches();
  addLogisticsArchitecture(b, structures);
  return b;
}
