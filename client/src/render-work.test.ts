import test from "node:test";
import assert from "node:assert/strict";
import { BoxGeometry, InstancedMesh, MeshBasicMaterial } from "three";
import { InspectionCadence, uploadInstances } from "./render-work";

test("close-up cache caps refreshes at 30 Hz while context changes and reappearance invalidate immediately", () => {
  for (const hz of [60, 90, 120, 144]) {
    const gate = new InspectionCadence();
    let refreshed = 0;
    for (let i = 0; i < hz * 2; i++)
      if (gate.refresh(i / hz, "contact/eo/palette")) refreshed++;
    assert.ok(refreshed <= 61 && refreshed >= 56, `${hz} Hz: ${refreshed}`);
  }
  const gate = new InspectionCadence();
  assert.equal(gate.refresh(1, "T1/ir"), true);
  assert.equal(gate.refresh(1.001, "T1/ir"), false);
  assert.equal(
    gate.refresh(1.002, "T2/ir"),
    true,
    "new selected contact never reuses the old image",
  );
  assert.equal(
    gate.refresh(1.003, "T2/eo"),
    true,
    "sensor/palette context refreshes immediately",
  );
  gate.invalidate();
  assert.equal(
    gate.refresh(1.004, "T2/eo"),
    true,
    "after loss or obstruction no stale image is displayed",
  );
  assert.equal(
    gate.refresh(0.5, "T2/eo"),
    true,
    "backward replay time invalidates",
  );
});
test("only live instance data is uploaded and zero-count transitions do not upload reserved capacity", () => {
  const mesh = new InstancedMesh(
    new BoxGeometry(),
    new MeshBasicMaterial(),
    800,
  );
  uploadInstances(mesh, 3);
  assert.equal(mesh.count, 3);
  assert.deepEqual(mesh.instanceMatrix.updateRanges, [{ start: 0, count: 48 }]);
  const version = mesh.instanceMatrix.version;
  uploadInstances(mesh, 0);
  assert.equal(mesh.count, 0);
  assert.equal(mesh.instanceMatrix.version, version);
  uploadInstances(mesh, 2);
  assert.deepEqual(mesh.instanceMatrix.updateRanges, [{ start: 0, count: 32 }]);
  assert.ok(mesh.instanceMatrix.version > version);
  mesh.geometry.dispose();
  (mesh.material as MeshBasicMaterial).dispose();
});
