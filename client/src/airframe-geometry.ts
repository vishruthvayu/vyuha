import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { Quality } from "./quality";
import type { RenderShape } from "./render-contacts";

/** Original, locally generated airframes (no external models). Real proportions
 * in metres; nose along +Z, up +Y. One generic airframe per *observed* silhouette
 * class: the multirotor is the same for every multirotor contact whatever its
 * hidden identity, control link or type. Each vertex carries a colour and an
 * illustrative apparent-temperature index ("heat") used only by the thermal
 * display; neither is a sensor measurement. */
export type AirframeLod = 0 | 1;
export type AirframeRole = "body" | "rotor" | "disc" | "wing";
export type AirframePart = {
  shape: RenderShape;
  lod: AirframeLod;
  role: AirframeRole;
  /** For rotors and discs: one pivot per rotor (instanced once per pivot) and spin axis. */
  pivots?: [number, number, number][];
  axis?: "y" | "z";
  /** For flapping wings: side and shoulder hinge. */
  wing?: -1 | 1;
  pivot?: [number, number, number];
  geometry: THREE.BufferGeometry;
};
/** Overall span in metres, used to choose a level of detail by projected size. */
export const AIRFRAME_SPAN: Record<RenderShape, number> = {
  multirotor: 0.82,
  fixed_wing: 2.4,
  bird: 0.95,
  unresolved: 0.7,
};

type V3 = [number, number, number];
const HEAT = {
  motor: 0.93,
  engine: 0.95,
  battery: 0.76,
  body: 0.62,
  arm: 0.55,
  prop: 0.5,
  skin: 0.58,
  wing: 0.52,
  birdBody: 0.74,
  birdHead: 0.78,
  feather: 0.62,
  beak: 0.5,
};
const COLOR = {
  hull: "#3a3e42",
  shell: "#4d5257",
  battery: "#25272a",
  carbon: "#232528",
  motor: "#6a7077",
  mount: "#2f3235",
  prop: "#9aa0a6",
  lens: "#0d0f10",
  airframe: "#c7cacc",
  airframeDark: "#8f9599",
  feather: "#5f4b3b",
  featherDark: "#45362a",
  beak: "#b89a5e",
  blob: "#2e3134",
};

class Builder {
  private parts: THREE.BufferGeometry[] = [];
  add(g: THREE.BufferGeometry, m: THREE.Matrix4, color: string, heat: number) {
    const geo = (g.index ? g.toNonIndexed() : g.clone()).applyMatrix4(m);
    g.dispose();
    for (const name of Object.keys(geo.attributes))
      if (name !== "position" && name !== "normal") geo.deleteAttribute(name);
    if (!geo.getAttribute("normal")) geo.computeVertexNormals();
    const n = geo.getAttribute("position").count;
    const c = new THREE.Color(color);
    const colors = new Float32Array(n * 3);
    const heats = new Float32Array(n).fill(heat);
    for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.setAttribute("heat", new THREE.BufferAttribute(heats, 1));
    this.parts.push(geo);
    return this;
  }
  build() {
    const count = this.parts.reduce(
      (s, g) => s + g.getAttribute("position").count,
      0,
    );
    const out = new THREE.BufferGeometry();
    for (const [name, size] of [
      ["position", 3],
      ["normal", 3],
      ["color", 3],
      ["heat", 1],
    ] as const) {
      const arr = new Float32Array(count * size);
      let o = 0;
      for (const g of this.parts) {
        const a = g.getAttribute(name).array as Float32Array;
        arr.set(a, o);
        o += a.length;
      }
      out.setAttribute(name, new THREE.BufferAttribute(arr, size));
    }
    this.parts.forEach((g) => g.dispose());
    this.parts = [];
    out.computeBoundingBox();
    out.computeBoundingSphere();
    return out;
  }
}
const M = (p: V3 = [0, 0, 0], r: V3 = [0, 0, 0], s: V3 = [1, 1, 1]) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(...p),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)),
    new THREE.Vector3(...s),
  );
/** Cylinder between two points. */
function rod(
  b: Builder,
  a: V3,
  c: V3,
  r: number,
  seg: number,
  color: string,
  heat: number,
) {
  const va = new THREE.Vector3(...a),
    vc = new THREE.Vector3(...c);
  const dir = vc.clone().sub(va);
  const m = new THREE.Matrix4().compose(
    va.clone().add(vc).multiplyScalar(0.5),
    new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.clone().normalize(),
    ),
    new THREE.Vector3(1, 1, 1),
  );
  b.add(new THREE.CylinderGeometry(r, r, dir.length(), seg, 1), m, color, heat);
}
/** Thin lifting surface from a planform (x outward, z along the chord). */
function surface(points: [number, number][], thickness: number) {
  const shape = new THREE.Shape(
    points.map(([x, z]) => new THREE.Vector2(x, -z)),
  );
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 4,
  });
  // Shape space (x, y) → planform (x, z); extrusion becomes thickness along Y.
  g.rotateX(-Math.PI / 2);
  g.translate(0, -thickness / 2, 0);
  return g;
}
function lathe(profile: [number, number][], segments: number) {
  // profile: [radius, z] from nose to tail; lathe axis becomes +Z.
  const g = new THREE.LatheGeometry(
    profile.map(([r, z]) => new THREE.Vector2(Math.max(r, 1e-4), z)),
    segments,
  );
  g.rotateX(Math.PI / 2);
  return g;
}

const MOTOR = 0.29; // motor offset on each diagonal axis (≈0.82 m motor-to-motor)
const QUAD_PIVOTS: V3[] = [
  [MOTOR, 0.045, MOTOR],
  [-MOTOR, 0.045, MOTOR],
  [-MOTOR, 0.045, -MOTOR],
  [MOTOR, 0.045, -MOTOR],
];

function multirotor(quality: Quality): AirframePart[] {
  const seg = quality === "high" ? 16 : quality === "medium" ? 12 : 8;
  const b = new Builder();
  b.add(
    new RoundedBoxGeometry(0.2, 0.07, 0.3, 2, 0.022),
    M(),
    COLOR.hull,
    HEAT.body,
  );
  b.add(
    new RoundedBoxGeometry(0.16, 0.035, 0.22, 2, 0.014),
    M([0, 0.045, 0.005]),
    COLOR.shell,
    HEAT.body,
  );
  b.add(
    new RoundedBoxGeometry(0.08, 0.045, 0.15, 2, 0.01),
    M([0, 0.08, -0.03]),
    COLOR.battery,
    HEAT.battery,
  );
  // Gimbal and camera under the nose.
  b.add(
    new THREE.BoxGeometry(0.05, 0.03, 0.02),
    M([0, -0.045, 0.125]),
    COLOR.mount,
    HEAT.body,
  );
  b.add(
    new THREE.SphereGeometry(0.034, seg, Math.max(6, seg / 2)),
    M([0, -0.075, 0.13]),
    COLOR.carbon,
    HEAT.body,
  );
  b.add(
    new THREE.CylinderGeometry(0.014, 0.014, 0.012, seg),
    M([0, -0.075, 0.164], [Math.PI / 2, 0, 0]),
    COLOR.lens,
    HEAT.body,
  );
  for (const [x, , z] of QUAD_PIVOTS) {
    const root: V3 = [Math.sign(x) * 0.075, 0.005, Math.sign(z) * 0.1];
    rod(b, root, [x, 0, z], 0.012, 8, COLOR.carbon, HEAT.arm);
    b.add(
      new THREE.BoxGeometry(0.04, 0.025, 0.04),
      M(root),
      COLOR.mount,
      HEAT.arm,
    );
    b.add(
      new THREE.CylinderGeometry(0.022, 0.024, 0.012, seg),
      M([x, 0.003, z]),
      COLOR.mount,
      HEAT.arm,
    );
    b.add(
      new THREE.CylinderGeometry(0.023, 0.025, 0.028, seg),
      M([x, 0.023, z]),
      COLOR.motor,
      HEAT.motor,
    );
  }
  // Landing skids.
  for (const sx of [-1, 1]) {
    rod(
      b,
      [sx * 0.05, -0.03, 0.07],
      [sx * 0.1, -0.13, 0.085],
      0.006,
      6,
      COLOR.carbon,
      HEAT.arm,
    );
    rod(
      b,
      [sx * 0.05, -0.03, -0.07],
      [sx * 0.1, -0.13, -0.085],
      0.006,
      6,
      COLOR.carbon,
      HEAT.arm,
    );
    rod(
      b,
      [sx * 0.1, -0.13, -0.15],
      [sx * 0.1, -0.13, 0.15],
      0.007,
      6,
      COLOR.carbon,
      HEAT.arm,
    );
  }
  const body0 = b.build();
  // Two-blade propeller at the origin; instanced at each motor and spun about Y.
  const blade = (dir: 1 | -1) => {
    const g = surface(
      [
        [0.012, -0.012],
        [0.06, -0.016],
        [0.118, -0.008],
        [0.125, 0.004],
        [0.06, 0.012],
        [0.012, 0.01],
      ],
      0.003,
    );
    g.rotateX(0.16); // blade pitch
    if (dir < 0) g.rotateY(Math.PI);
    return g;
  };
  const pb = new Builder();
  pb.add(blade(1), M(), COLOR.prop, HEAT.prop);
  pb.add(blade(-1), M(), COLOR.prop, HEAT.prop);
  pb.add(
    new THREE.CylinderGeometry(0.009, 0.009, 0.012, 8),
    M([0, 0.002, 0]),
    COLOR.motor,
    HEAT.motor,
  );
  const rotor0 = pb.build();
  const disc = () => {
    const db = new Builder();
    db.add(
      new THREE.CircleGeometry(0.128, 20).rotateX(-Math.PI / 2),
      M(),
      COLOR.prop,
      HEAT.prop,
    );
    return db.build();
  };
  // Medium detail: same silhouette, a fraction of the triangles.
  const lb = new Builder();
  lb.add(new THREE.BoxGeometry(0.2, 0.08, 0.3), M(), COLOR.hull, HEAT.body);
  lb.add(
    new THREE.BoxGeometry(0.08, 0.045, 0.15),
    M([0, 0.06, -0.03]),
    COLOR.battery,
    HEAT.battery,
  );
  for (const [x, , z] of QUAD_PIVOTS) {
    rod(
      lb,
      [Math.sign(x) * 0.07, 0, Math.sign(z) * 0.1],
      [x, 0, z],
      0.013,
      4,
      COLOR.carbon,
      HEAT.arm,
    );
    lb.add(
      new THREE.CylinderGeometry(0.025, 0.025, 0.04, 6),
      M([x, 0.02, z]),
      COLOR.motor,
      HEAT.motor,
    );
  }
  for (const sx of [-1, 1])
    lb.add(
      new THREE.BoxGeometry(0.012, 0.012, 0.3),
      M([sx * 0.1, -0.12, 0]),
      COLOR.carbon,
      HEAT.arm,
    );
  const body1 = lb.build();
  return [
    { shape: "multirotor", lod: 0, role: "body", geometry: body0 },
    {
      shape: "multirotor",
      lod: 0,
      role: "rotor",
      pivots: QUAD_PIVOTS,
      axis: "y",
      geometry: rotor0,
    },
    {
      shape: "multirotor",
      lod: 0,
      role: "disc",
      pivots: QUAD_PIVOTS,
      axis: "y",
      geometry: disc(),
    },
    { shape: "multirotor", lod: 1, role: "body", geometry: body1 },
    {
      shape: "multirotor",
      lod: 1,
      role: "disc",
      pivots: QUAD_PIVOTS,
      axis: "y",
      geometry: disc(),
    },
  ];
}

function fixedWing(quality: Quality): AirframePart[] {
  const seg = quality === "high" ? 18 : quality === "medium" ? 14 : 10;
  const profile: [number, number][] = [
    [0.004, 0.84],
    [0.04, 0.8],
    [0.075, 0.7],
    [0.098, 0.52],
    [0.102, 0.25],
    [0.096, 0.0],
    [0.078, -0.3],
    [0.05, -0.58],
    [0.032, -0.74],
    [0.004, -0.76],
  ];
  const b = new Builder();
  b.add(lathe(profile, seg), M(), COLOR.airframe, HEAT.skin);
  // High wing with slight sweep, taper and dihedral.
  for (const side of [-1, 1]) {
    const w = surface(
      [
        [0.06, 0.2],
        [1.18, 0.12],
        [1.2, 0.02],
        [1.18, -0.04],
        [0.06, -0.08],
      ],
      0.022,
    );
    if (side < 0) w.scale(-1, 1, 1);
    b.add(
      w,
      M([0, 0.08, 0.06], [0, 0, side * 0.05]),
      COLOR.airframe,
      HEAT.wing,
    );
    b.add(
      new THREE.BoxGeometry(0.02, 0.05, 0.14),
      M([side * 1.19, 0.11, 0.08]),
      COLOR.airframeDark,
      HEAT.wing,
    );
  }
  // Tail: horizontal stabiliser and fin.
  for (const side of [-1, 1]) {
    const t = surface(
      [
        [0.02, -0.5],
        [0.36, -0.56],
        [0.37, -0.62],
        [0.02, -0.66],
      ],
      0.012,
    );
    if (side < 0) t.scale(-1, 1, 1);
    b.add(t, M([0, 0.02, 0]), COLOR.airframe, HEAT.wing);
  }
  const fin = surface(
    [
      [0.0, -0.48],
      [0.24, -0.6],
      [0.25, -0.68],
      [0.0, -0.68],
    ],
    0.012,
  );
  b.add(fin, M([0, 0.03, 0], [0, 0, Math.PI / 2]), COLOR.airframe, HEAT.wing);
  // Pusher motor pod and camera ball.
  b.add(
    new THREE.CylinderGeometry(0.03, 0.036, 0.08, seg),
    M([0, 0, -0.78], [Math.PI / 2, 0, 0]),
    COLOR.airframeDark,
    HEAT.engine,
  );
  b.add(
    new THREE.SphereGeometry(0.048, seg, Math.max(6, seg / 2)),
    M([0, -0.085, 0.42]),
    COLOR.carbon,
    HEAT.body,
  );
  const body0 = b.build();
  const pb = new Builder();
  for (const dir of [1, -1]) {
    const blade = surface(
      [
        [0.015, -0.02],
        [0.17, -0.014],
        [0.18, 0.004],
        [0.015, 0.016],
      ],
      0.004,
    );
    blade.rotateX(0.2);
    if (dir < 0) blade.rotateY(Math.PI);
    // Spin plane is XY (axis Z).
    blade.rotateX(Math.PI / 2);
    pb.add(blade, M(), COLOR.carbon, HEAT.prop);
  }
  const rotor0 = pb.build();
  const disc = () => {
    const d = new Builder();
    d.add(new THREE.CircleGeometry(0.185, 20), M(), COLOR.prop, HEAT.prop);
    return d.build();
  };
  const lb = new Builder();
  lb.add(
    lathe(
      profile.filter((_, i) => i % 2 === 0 || i === profile.length - 1),
      6,
    ),
    M(),
    COLOR.airframe,
    HEAT.skin,
  );
  lb.add(
    new THREE.BoxGeometry(2.36, 0.022, 0.24),
    M([0, 0.09, 0.06]),
    COLOR.airframe,
    HEAT.wing,
  );
  lb.add(
    new THREE.BoxGeometry(0.72, 0.012, 0.12),
    M([0, 0.025, -0.6]),
    COLOR.airframe,
    HEAT.wing,
  );
  lb.add(
    new THREE.BoxGeometry(0.012, 0.24, 0.16),
    M([0, 0.14, -0.6]),
    COLOR.airframe,
    HEAT.wing,
  );
  lb.add(
    new THREE.CylinderGeometry(0.03, 0.03, 0.08, 6),
    M([0, 0, -0.78], [Math.PI / 2, 0, 0]),
    COLOR.airframeDark,
    HEAT.engine,
  );
  const body1 = lb.build();
  const pivot: V3[] = [[0, 0, -0.83]];
  return [
    { shape: "fixed_wing", lod: 0, role: "body", geometry: body0 },
    {
      shape: "fixed_wing",
      lod: 0,
      role: "rotor",
      pivots: pivot,
      axis: "z",
      geometry: rotor0,
    },
    {
      shape: "fixed_wing",
      lod: 0,
      role: "disc",
      pivots: pivot,
      axis: "z",
      geometry: disc(),
    },
    { shape: "fixed_wing", lod: 1, role: "body", geometry: body1 },
    {
      shape: "fixed_wing",
      lod: 1,
      role: "disc",
      pivots: pivot,
      axis: "z",
      geometry: disc(),
    },
  ];
}

function bird(quality: Quality): AirframePart[] {
  const seg = quality === "high" ? 12 : quality === "medium" ? 10 : 8;
  const b = new Builder();
  b.add(
    lathe(
      [
        [0.004, 0.16],
        [0.035, 0.13],
        [0.055, 0.06],
        [0.056, -0.02],
        [0.042, -0.1],
        [0.02, -0.17],
        [0.004, -0.19],
      ],
      seg,
    ),
    M(),
    COLOR.feather,
    HEAT.birdBody,
  );
  b.add(
    new THREE.SphereGeometry(0.036, seg, Math.max(6, seg / 2)),
    M([0, 0.02, 0.18]),
    COLOR.featherDark,
    HEAT.birdHead,
  );
  b.add(
    new THREE.ConeGeometry(0.012, 0.04, 6),
    M([0, 0.012, 0.225], [Math.PI / 2, 0, 0]),
    COLOR.beak,
    HEAT.beak,
  );
  b.add(
    surface(
      [
        [-0.05, -0.16],
        [0.05, -0.16],
        [0.085, -0.33],
        [0.0, -0.36],
        [-0.085, -0.33],
      ],
      0.006,
    ),
    M(),
    COLOR.featherDark,
    HEAT.feather,
  );
  const body0 = b.build();
  // Wing: broad arm with fingered primaries; hinged at the shoulder (local origin).
  const wing = (side: -1 | 1, detail: boolean) => {
    const pts: [number, number][] = detail
      ? [
          [0.0, 0.06],
          [0.16, 0.07],
          [0.3, 0.04],
          [0.42, -0.01],
          [0.47, -0.06],
          [0.44, -0.08],
          [0.46, -0.11],
          [0.41, -0.11],
          [0.42, -0.14],
          [0.36, -0.13],
          [0.3, -0.12],
          [0.16, -0.1],
          [0.0, -0.06],
        ]
      : [
          [0.0, 0.05],
          [0.44, -0.03],
          [0.4, -0.12],
          [0.0, -0.06],
        ];
    const g = surface(pts, 0.008);
    if (side < 0) g.scale(-1, 1, 1);
    const wb = new Builder();
    wb.add(g, M(), COLOR.feather, HEAT.feather);
    return wb.build();
  };
  const lb = new Builder();
  lb.add(
    new THREE.SphereGeometry(0.06, 6, 4).scale(0.9, 0.8, 3),
    M(),
    COLOR.feather,
    HEAT.birdBody,
  );
  const body1 = lb.build();
  const parts: AirframePart[] = [
    { shape: "bird", lod: 0, role: "body", geometry: body0 },
    { shape: "bird", lod: 1, role: "body", geometry: body1 },
  ];
  for (const side of [-1, 1] as const) {
    const pivot: V3 = [side * 0.04, 0.03, 0.04];
    parts.push({
      shape: "bird",
      lod: 0,
      role: "wing",
      wing: side,
      pivot,
      geometry: wing(side, true),
    });
    parts.push({
      shape: "bird",
      lod: 1,
      role: "wing",
      wing: side,
      pivot,
      geometry: wing(side, false),
    });
  }
  return parts;
}

function unresolved(quality: Quality): AirframePart[] {
  const make = (w: number, h: number) => {
    const b = new Builder();
    b.add(
      new THREE.SphereGeometry(0.32, w, h).scale(1, 0.7, 1),
      M(),
      COLOR.blob,
      0.68,
    );
    return b.build();
  };
  const w = quality === "low" ? 8 : 12;
  return [
    { shape: "unresolved", lod: 0, role: "body", geometry: make(w, w / 2) },
    { shape: "unresolved", lod: 1, role: "body", geometry: make(6, 4) },
  ];
}

export function createAirframeParts(quality: Quality): AirframePart[] {
  return [
    ...multirotor(quality),
    ...fixedWing(quality),
    ...bird(quality),
    ...unresolved(quality),
  ];
}

/** Projected size of an airframe in pixels across. */
export function projectedPixels(
  shape: RenderShape,
  distance: number,
  fovDeg: number,
  viewportPx: number,
) {
  return (
    (AIRFRAME_SPAN[shape] /
      Math.max(0.01, distance) /
      (2 * Math.tan((fovDeg * Math.PI) / 360))) *
    viewportPx
  );
}
/** Level of detail from projected size: 0 close (≥ 36 px), 1 medium, 2 far
 * marker (< 3 px). Hysteresis: stepping up needs 25 % more than stepping down,
 * so a contact on a boundary does not flicker between levels. */
export function airframeLod(px: number, previous?: 0 | 1 | 2): 0 | 1 | 2 {
  const up = 1.25,
    down = 1;
  const near = 36,
    far = 3;
  if (previous === 0) return px >= near * down * 0.8 ? 0 : px >= far ? 1 : 2;
  if (px >= near * (previous === undefined ? 1 : up)) return 0;
  if (previous === 2) return px >= far * up ? 1 : 2;
  return px >= far ? 1 : 2;
}
