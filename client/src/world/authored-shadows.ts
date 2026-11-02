import * as THREE from "three";
import type { TrainingSite } from "../training-site-contract";

/** Static daylight fit in the actual sun camera's axes. Public presentation
 * bounds only: neither trainee cameras nor contacts steer the shadow map.
 * Includes decorative avenues and every structure's projected ground shadow. */
export function authoredShadowFit(site: TrainingSite, sun: THREE.Vector3) {
  if (![sun.x, sun.y, sun.z].every(Number.isFinite) || sun.y <= 0.05)
    throw new RangeError("Authored daylight shadows require an upward sun");
  const direction = sun.clone().normalize();
  const support: THREE.Vector3[] = [];
  const box = (
    x0: number,
    x1: number,
    z0: number,
    z1: number,
    height: number,
  ) => {
    for (const x of [x0, x1])
      for (const z of [z0, z1])
        for (const y of [0, height]) {
          support.push(new THREE.Vector3(x, y, z));
          support.push(
            new THREE.Vector3(
              x - (direction.x * y) / direction.y,
              0,
              z - (direction.z * y) / direction.y,
            ),
          );
        }
  };
  // Existing training-site.ts avenue limits, enlarged for mature tree cards.
  box(-410, 410, -320, 590, 48);
  for (const b of site.structures)
    box(b.x_min - 36, b.x_max + 36, b.z_min - 50, b.z_max + 36, b.height + 2);
  const bounds = new THREE.Box3().setFromPoints(support);
  const target = bounds.getCenter(new THREE.Vector3());
  const distance = bounds.getSize(new THREE.Vector3()).length() + 120;
  const position = target.clone().addScaledVector(direction, distance);
  const camera = new THREE.OrthographicCamera();
  camera.position.copy(position);
  camera.lookAt(target);
  camera.updateMatrixWorld(true);
  const lightBounds = new THREE.Box3().setFromPoints(
    support.map((p) => p.clone().applyMatrix4(camera.matrixWorldInverse)),
  );
  const padding = 12;
  return {
    position,
    target,
    left: lightBounds.min.x - padding,
    right: lightBounds.max.x + padding,
    bottom: lightBounds.min.y - padding,
    top: lightBounds.max.y + padding,
    near: Math.max(1, -lightBounds.max.z - padding),
    far: -lightBounds.min.z + padding,
    bias: -0.00008,
    normalBias: 0.08,
  };
}
