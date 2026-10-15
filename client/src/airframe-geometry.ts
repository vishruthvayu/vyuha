import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Quality } from "./quality";
import type { RenderShape } from "./render-contacts";

export type AirframePart = {
  shape: RenderShape;
  layer: "body" | "trim" | "rotor";
  wing?: -1 | 1;
  geometry: THREE.BufferGeometry;
};
type V3 = [number, number, number];
function placed(
  g: THREE.BufferGeometry,
  position: V3 = [0, 0, 0],
  rotation: V3 = [0, 0, 0],
  scale: V3 = [1, 1, 1],
) {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
    new THREE.Vector3(...scale),
  );
  const result = g.index ? g.toNonIndexed() : g.clone();
  g.dispose();
  return result.applyMatrix4(m);
}
function merged(parts: THREE.BufferGeometry[]) {
  const result = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  if (!result)
    throw new Error("Incompatible original procedural airframe geometry");
  result.computeBoundingBox();
  result.computeBoundingSphere();
  return result;
}
function foil(points: [number, number][], thickness: number) {
  const path = new THREE.Shape();
  points.forEach(([x, z], i) => (i ? path.lineTo(x, z) : path.moveTo(x, z)));
  path.closePath();
  return placed(
    new THREE.ExtrudeGeometry(path, {
      depth: thickness,
      bevelEnabled: false,
      steps: 1,
    }),
    [0, thickness / 2, 0],
    [Math.PI / 2, 0, 0],
  );
}
/** Original locally generated artwork. Illustrative metres, never a recognition/thermal calibration. */
export function createAirframeParts(quality: Quality): AirframePart[] {
  const segments = quality === "high" ? 12 : quality === "medium" ? 8 : 6;
  const parts: AirframePart[] = [];
  const add = (
    shape: RenderShape,
    layer: AirframePart["layer"],
    geometries: THREE.BufferGeometry[],
    wing?: -1 | 1,
  ) =>
    parts.push({
      shape,
      layer,
      geometry: merged(geometries),
      ...(wing ? { wing } : {}),
    });
  add("unresolved", "body", [placed(new THREE.SphereGeometry(0.7, 6, 4))]);
  const frame: THREE.BufferGeometry[] = [
    placed(new THREE.BoxGeometry(0.62, 0.24, 0.9)),
    placed(new THREE.BoxGeometry(0.28, 0.11, 0.65), [0, 0.17, -0.1]),
  ];
  const trim: THREE.BufferGeometry[] = [],
    rotors: THREE.BufferGeometry[] = [];
  for (const x of [-1, 1])
    for (const z of [-1, 1]) {
      const angle = Math.atan2(x, z);
      frame.push(
        placed(
          new THREE.BoxGeometry(0.11, 0.09, 0.94),
          [x * 0.38, 0, z * 0.38],
          [0, angle, 0],
        ),
      );
      trim.push(
        placed(new THREE.CylinderGeometry(0.12, 0.12, 0.16, segments), [
          x * 0.72,
          0.08,
          z * 0.72,
        ]),
      );
      rotors.push(
        placed(new THREE.CylinderGeometry(0.38, 0.38, 0.012, segments), [
          x * 0.72,
          0.18,
          z * 0.72,
        ]),
      );
    }
  trim.push(
    placed(
      new THREE.SphereGeometry(0.15, segments, 6),
      [0, -0.12, 0.42],
      [0, 0, 0],
      [1, 0.8, 0.7],
    ),
  );
  add("multirotor", "body", frame);
  add("multirotor", "trim", trim);
  add("multirotor", "rotor", rotors);
  add("fixed_wing", "body", [
    placed(
      new THREE.CapsuleGeometry(0.25, 2.35, 4, segments),
      [0, 0.02, 0],
      [Math.PI / 2, 0, 0],
    ),
    foil(
      [
        [-2.5, -0.8],
        [-0.28, 0.65],
        [0.28, 0.65],
        [2.5, -0.8],
        [2.5, -1.12],
        [0.2, -0.45],
        [-0.2, -0.45],
        [-2.5, -1.12],
      ],
      0.09,
    ),
    foil(
      [
        [-0.85, -1.4],
        [0, -1.1],
        [0.85, -1.4],
        [0.85, -1.65],
        [-0.85, -1.65],
      ],
      0.065,
    ),
    placed(
      new THREE.BoxGeometry(0.075, 0.6, 0.55),
      [0, 0.33, -1.37],
      [-0.25, 0, 0],
    ),
  ]);
  add("fixed_wing", "trim", [
    placed(
      new THREE.SphereGeometry(0.26, segments, 6),
      [0, 0.18, 0.45],
      [0, 0, 0],
      [0.8, 0.55, 1.7],
    ),
  ]);
  add("bird", "body", [
    placed(
      new THREE.SphereGeometry(0.3, segments, 6),
      [0, 0, 0],
      [0, 0, 0],
      [0.65, 0.8, 1.8],
    ),
    placed(new THREE.SphereGeometry(0.17, segments, 6), [0, 0.07, 0.47]),
    placed(
      new THREE.ConeGeometry(0.07, 0.22, 5),
      [0, 0.06, 0.67],
      [Math.PI / 2, 0, 0],
    ),
    foil(
      [
        [-0.18, -0.4],
        [0, -0.85],
        [0.18, -0.4],
      ],
      0.025,
    ),
  ]);
  for (const side of [-1, 1] as const)
    add(
      "bird",
      "body",
      [
        foil(
          [
            [0, 0.15],
            [side * 0.48, 0.08],
            [side * 1.05, -0.32],
            [side * 0.8, -0.5],
            [side * 0.28, -0.25],
            [0, -0.2],
          ],
          0.028,
        ),
      ],
      side,
    );
  return parts;
}
