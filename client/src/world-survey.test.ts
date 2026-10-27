import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { PerspectiveCamera, Vector3 } from "three";
import {
  publicSurveyPose,
  surveyPosition,
  SURVEY_BOUNDS,
  isSurveyCommand,
  type SurveyCommand,
} from "./world-survey";
import { createWorldSurveyController } from "./WorldSurveyControls";
const near = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
for (const terrain of [
  "urban_outpost",
  "rural_forward_base",
  "logistics_quarter",
]) {
  test(`survey commands remain bounded and contact-independent for ${terrain}`, () => {
    const preset = publicSurveyPose(terrain);
    let position = { ...preset.position };
    for (let i = 0; i < 1200; i++) {
      const action = (
        ["left", "right", "up", "down", "closer", "farther"] as SurveyCommand[]
      )[Math.floor(i / 200)];
      position = surveyPosition(position, action, terrain);
      const delta = new Vector3(
        position.x - preset.target.x,
        position.y - preset.target.y,
        position.z - preset.target.z,
      );
      const radius = delta.length(),
        polar = Math.acos(delta.y / radius);
      assert.ok(
        radius >= SURVEY_BOUNDS.minRadius - 1e-8 &&
          radius <= SURVEY_BOUNDS.maxRadius + 1e-8,
      );
      assert.ok(
        polar >= SURVEY_BOUNDS.minPolar - 1e-8 &&
          polar <= SURVEY_BOUNDS.maxPolar + 1e-8,
      );
    }
    assert.deepEqual(
      surveyPosition(position, "reset", terrain),
      preset.position,
    );
    assert.deepEqual(
      surveyPosition({ x: NaN, y: Infinity, z: 0 }, "left", terrain),
      preset.position,
    );
    assert.equal(isSurveyCommand("classify"), false);
    const again = publicSurveyPose(terrain);
    again.target.x = 9000;
    assert.notEqual(publicSurveyPose(terrain).target.x, 9000);
  });
}

test("installed OrbitControls listener lease, stale commands and camera restoration are isolated and disposable", () => {
  const dom = new JSDOM("<canvas></canvas>");
  const surface = dom.window.document.querySelector("canvas")!;
  surface.style.touchAction = "pan-y";
  const active = new Map<
    EventTarget,
    Map<string, Set<EventListenerOrEventListenerObject>>
  >();
  for (const target of [surface, dom.window.document]) {
    const add = target.addEventListener.bind(target),
      remove = target.removeEventListener.bind(target);
    const map = new Map<string, Set<EventListenerOrEventListenerObject>>();
    active.set(target, map);
    target.addEventListener = ((
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ) => {
      if (
        [
          "pointerdown",
          "pointercancel",
          "wheel",
          "contextmenu",
          "keydown",
          "keyup",
        ].includes(type)
      ) {
        if (!map.has(type)) map.set(type, new Set());
        map.get(type)!.add(listener);
      }
      add(type, listener, options);
    }) as typeof target.addEventListener;
    target.removeEventListener = ((
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | EventListenerOptions,
    ) => {
      map.get(type)?.delete(listener);
      remove(type, listener, options);
    }) as typeof target.removeEventListener;
  }
  const camera = new PerspectiveCamera(54, 16 / 9, 0.1, 5000);
  camera.position.set(40, 18, -120);
  camera.lookAt(0, 4, 50);
  const oldPosition = camera.position.clone(),
    oldQuaternion = camera.quaternion.clone();
  try {
    for (let cycle = 0; cycle < 8; cycle++) {
      const lease = createWorldSurveyController(
        camera,
        surface,
        "urban_outpost",
        cycle % 2 === 0,
        10,
      );
      assert.equal(surface.style.touchAction, "none");
      const initial = camera.position.clone();
      lease.apply({ revision: 10, action: "left" });
      assert.ok(camera.position.equals(initial));
      lease.apply({ revision: 11, action: "left" });
      assert.equal(camera.position.equals(initial), false);
      const moved = camera.position.clone();
      lease.apply({ revision: 11, action: "right" });
      lease.apply({ revision: 9, action: "farther" });
      assert.ok(camera.position.equals(moved));
      lease.apply({ revision: 12, action: "reset" });
      const preset = publicSurveyPose("urban_outpost");
      near(camera.position.x, preset.position.x);
      near(camera.position.y, preset.position.y);
      near(camera.position.z, preset.position.z);
      lease.dispose();
      lease.dispose();
      assert.equal(surface.style.touchAction, "pan-y");
      assert.ok(camera.position.equals(oldPosition));
      assert.ok(camera.quaternion.equals(oldQuaternion));
      lease.apply({ revision: 13, action: "farther" });
      lease.update(1);
      assert.ok(camera.position.equals(oldPosition));
      for (const map of active.values())
        for (const listeners of map.values()) assert.equal(listeners.size, 0);
    }
  } finally {
    dom.window.close();
  }
});

test("live-rig handoff can dispose the survey without any pose or projection write", () => {
  const dom = new JSDOM("<canvas></canvas>");
  const surface = dom.window.document.querySelector("canvas")!;
  const camera = new PerspectiveCamera(54, 16 / 9, 0.1, 5000);
  const lease = createWorldSurveyController(
    camera,
    surface,
    "urban_outpost",
    false,
    0,
    false,
  );
  lease.apply({ revision: 1, action: "left" });
  // Model the authoritative live rig taking its sensor-origin camera first.
  camera.position.set(0, 2, 0);
  camera.lookAt(150, 45, 900);
  camera.zoom = 1.2;
  camera.updateProjectionMatrix();
  const position = camera.position.clone(),
    orientation = camera.quaternion.clone(),
    projection = camera.projectionMatrix.clone();
  lease.dispose();
  assert.ok(camera.position.equals(position));
  assert.ok(camera.quaternion.equals(orientation));
  assert.equal(camera.zoom, 1.2);
  assert.ok(camera.projectionMatrix.equals(projection));
  lease.apply({ revision: 2, action: "reset" });
  lease.update(0.1);
  assert.ok(camera.position.equals(position));
  assert.ok(camera.quaternion.equals(orientation));
  assert.ok(camera.projectionMatrix.equals(projection));
  dom.window.close();
});

test("documented upstream r180 held-Control release listener is bounded and cannot change the handed-off camera", () => {
  const dom = new JSDOM("<canvas></canvas>");
  const document = dom.window.document;
  const surface = document.querySelector("canvas")!;
  const releases = new Set<EventListenerOrEventListenerObject>();
  const add = document.addEventListener.bind(document),
    remove = document.removeEventListener.bind(document);
  document.addEventListener = ((
    type: string,
    callback: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) => {
    if (type === "keyup") releases.add(callback);
    add(type, callback, options);
  }) as typeof document.addEventListener;
  document.removeEventListener = ((
    type: string,
    callback: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ) => {
    if (type === "keyup") releases.delete(callback);
    remove(type, callback, options);
  }) as typeof document.removeEventListener;
  const camera = new PerspectiveCamera(54, 16 / 9, 0.1, 5000);
  const lease = createWorldSurveyController(
    camera,
    surface,
    "urban_outpost",
    false,
    0,
    false,
  );
  document.dispatchEvent(
    new dom.window.KeyboardEvent("keydown", { key: "Control", bubbles: true }),
  );
  assert.equal(releases.size, 1);
  camera.position.set(0, 2, 0);
  camera.lookAt(100, 20, 900);
  camera.zoom = 1.4;
  camera.updateProjectionMatrix();
  const position = camera.position.clone(),
    orientation = camera.quaternion.clone(),
    projection = camera.projectionMatrix.clone();
  lease.dispose();
  // This is an explicitly retained upstream limitation, not a cleanup-pass claim.
  assert.equal(releases.size, 1);
  document.dispatchEvent(
    new dom.window.KeyboardEvent("keyup", { key: "Control", bubbles: true }),
  );
  assert.equal(releases.size, 0);
  lease.update(0.1);
  lease.apply({ revision: 99, action: "reset" });
  assert.ok(camera.position.equals(position));
  assert.ok(camera.quaternion.equals(orientation));
  assert.ok(camera.projectionMatrix.equals(projection));
  assert.equal(camera.zoom, 1.4);
  dom.window.close();
});
