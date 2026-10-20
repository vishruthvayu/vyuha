import type { InstancedMesh } from "three";

/** Cache only the offscreen close-up, not the main view or its camera. Sensor
 * resolution and 4x integration stay unchanged; the display texture refreshes
 * at 30 Hz and is blitted at every display frame. Context changes invalidate it. */
export class InspectionCadence {
  private key: string | null = null;
  private last = -Infinity;
  invalidate() {
    this.key = null;
  }
  refresh(time: number, key: string) {
    if (
      key !== this.key ||
      time < this.last ||
      time - this.last >= 1 / 30 - 1e-6
    ) {
      this.key = key;
      this.last = time;
      return true;
    }
    return false;
  }
}

/** Upload the populated prefix, not all 200 contacts' reserved GPU capacity.
 * Zero visible instances need no upload; count alone hides the previous data. */
export function uploadInstances(mesh: InstancedMesh, count: number) {
  mesh.count = count;
  if (!count) return;
  mesh.instanceMatrix.clearUpdateRanges();
  mesh.instanceMatrix.addUpdateRange(0, count * 16);
  mesh.instanceMatrix.needsUpdate = true;
}
