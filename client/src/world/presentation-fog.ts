import * as THREE from "three";
/** Only the explicitly labelled after-exercise overview receives expanded fog
 * bounds. Live/sensor rendering keeps its exact modeled display density. */
export function presentationFog(
  color: THREE.ColorRepresentation,
  density: number,
  reviewNear?: number,
  reviewFar?: number,
) {
  return Number.isFinite(reviewNear) &&
    Number.isFinite(reviewFar) &&
    reviewNear! > 0 &&
    reviewFar! > reviewNear!
    ? new THREE.Fog(color, reviewNear, reviewFar)
    : new THREE.FogExp2(color, density);
}
