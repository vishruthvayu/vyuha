import * as THREE from "three";
import type { FacilityLayout } from "./layout";
import { FLAT_RADIUS } from "./terrain";

export type Foundation = {
  x: number;
  z: number;
  rx: number;
  rz: number;
  rot: number;
};
/** Static scenery only. Soft contact shading grounds large structures; it does
 * not receive contacts, modify sensor boxes, or invent thermal evidence. */
export function foundations(layout: FacilityLayout): Foundation[] {
  return layout.placements.flatMap((p) => {
    let w = 0,
      d = 0;
    switch (p.kind) {
      case "terminal":
      case "logisticsShed":
      case "waterTower":
      case "building":
      case "house":
        w = p.w;
        d = p.d;
        break;
      case "warehouse":
        w = p.w;
        d = p.d;
        break;
      case "container":
        if (p.level) return [];
        w = 6;
        d = 2.4;
        break;
      case "genset":
        w = 5.5;
        d = 2.4;
        break;
      case "tent":
        w = p.w;
        d = p.l;
        break;
      default:
        return [];
    }
    const rx = w / 2 + 1.5,
      rz = d / 2 + 1.5;
    if (Math.hypot(p.x, p.z) + Math.hypot(rx, rz) > FLAT_RADIUS) return [];
    return [{ x: p.x, z: p.z, rx, rz, rot: "rot" in p ? (p.rot ?? 0) : 0 }];
  });
}
export function contactShadeData(size = 64) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const edge = Math.max(
        Math.abs(((x + 0.5) / size) * 2 - 1),
        Math.abs(((y + 0.5) / size) * 2 - 1),
      );
      const fade = Math.max(0, Math.min(1, (1 - edge) / 0.36));
      const alpha = Math.round(255 * fade * fade * (3 - 2 * fade));
      data.set([16, 21, 24, alpha], (y * size + x) * 4);
    }
  return data;
}
export function createContactShading(
  layout: FacilityLayout,
  authored: Foundation[] = [],
) {
  const places = [...foundations(layout), ...authored];
  const texture = new THREE.DataTexture(contactShadeData(), 64, 64);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  const geometry = new THREE.PlaneGeometry(1, 1);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    toneMapped: false,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, places.length);
  mesh.name = "foundation-contact-shading";
  mesh.renderOrder = 1;
  const transform = new THREE.Object3D();
  places.forEach((p, i) => {
    transform.position.set(p.x, 0.045, p.z);
    transform.rotation.set(-Math.PI / 2, p.rot, 0, "YXZ");
    transform.scale.set(p.rx * 2, p.rz * 2, 1);
    transform.updateMatrix();
    mesh.setMatrixAt(i, transform.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.matrixAutoUpdate = false;
  return {
    mesh,
    dispose: () => {
      mesh.dispose();
      geometry.dispose();
      material.dispose();
      texture.dispose();
    },
  };
}
