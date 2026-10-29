import type { TrainingSite } from "./world/training-site";
import { useLayoutEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  isSurveyCommand,
  publicSurveyPose,
  surveyPosition,
  surveyBounds,
  type SurveyIntent,
} from "./world-survey";

/** A disposable presentation lease on the existing camera. Never constructs a
 * camera/renderer, reads a contact or changes the simulation clock.
 * Installed Three r180 may retain its private modifier-key release listener
 * until Control is released after disposal. That handler only clears its own
 * modifier flag; no simulation or camera action is connected to it. See the
 * explicit upstream-lifecycle test; do not claim full held-modifier cleanup. */
export function createWorldSurveyController(
  camera: PerspectiveCamera,
  surface: HTMLElement,
  terrain?: string,
  reducedMotion = false,
  initialRevision = 0,
  restorePose = true,
  trainingSite?: TrainingSite,
) {
  const previousTouchAction = surface.style.touchAction;
  const previousCamera = {
    position: camera.position.clone(),
    quaternion: camera.quaternion.clone(),
    zoom: camera.zoom,
  };
  const preset = publicSurveyPose(terrain, trainingSite);
  const limits = surveyBounds(trainingSite);
  camera.position.set(preset.position.x, preset.position.y, preset.position.z);
  const controls = new OrbitControls(camera, surface);
  controls.target.set(preset.target.x, preset.target.y, preset.target.z);
  controls.enablePan = false;
  controls.autoRotate = false;
  controls.enableDamping = !reducedMotion;
  controls.dampingFactor = 0.09;
  controls.rotateSpeed = 0.5;
  controls.zoomSpeed = 0.7;
  controls.minDistance = limits.minRadius;
  controls.maxDistance = limits.maxRadius;
  controls.minPolarAngle = limits.minPolar;
  controls.maxPolarAngle = limits.maxPolar;
  controls.update();
  controls.saveState();
  let alive = true,
    lastRevision =
      Number.isSafeInteger(initialRevision) && initialRevision >= 0
        ? initialRevision
        : 0;
  return {
    apply(intent: SurveyIntent) {
      if (
        !alive ||
        !Number.isSafeInteger(intent.revision) ||
        intent.revision <= lastRevision ||
        !isSurveyCommand(intent.action)
      )
        return;
      lastRevision = intent.revision;
      // Clear pointer inertia before applying a deliberate keyboard/button step.
      const damping = controls.enableDamping;
      controls.enableDamping = false;
      controls.update();
      const next = surveyPosition(
        camera.position,
        intent.action,
        terrain,
        trainingSite,
      );
      camera.position.set(next.x, next.y, next.z);
      controls.update();
      controls.enableDamping = damping;
    },
    update(delta: number) {
      if (alive && controls.enableDamping)
        controls.update(
          Number.isFinite(delta) ? Math.max(0, Math.min(delta, 0.1)) : 0,
        );
    },
    dispose() {
      if (!alive) return;
      alive = false;
      controls.dispose();
      surface.style.touchAction = previousTouchAction;
      if (restorePose) {
        camera.position.copy(previousCamera.position);
        camera.quaternion.copy(previousCamera.quaternion);
        camera.zoom = previousCamera.zoom;
        camera.updateProjectionMatrix();
      }
    },
  };
}
/** Mount ONLY during contact-free briefing survey. Parent CameraRig must yield
 * its camera writes while enabled, then resume the briefing/sensor camera on exit. */
export function WorldSurveyControls({
  enabled,
  terrain,
  trainingSite,
  reducedMotion = false,
  command,
  restorePose = true,
}: {
  enabled: boolean;
  terrain?: string;
  trainingSite?: TrainingSite;
  reducedMotion?: boolean;
  command?: SurveyIntent;
  /** Disable when a new live CameraRig takes ownership at the same boundary. */
  restorePose?: boolean;
}) {
  const { camera, gl } = useThree();
  const latestCommand = useRef(command);
  useLayoutEffect(() => {
    latestCommand.current = command;
  }, [command]);
  const controller = useRef<ReturnType<
    typeof createWorldSurveyController
  > | null>(null);
  useLayoutEffect(() => {
    if (!enabled || !(camera instanceof PerspectiveCamera)) return;
    const lease = createWorldSurveyController(
      camera,
      gl.domElement,
      terrain,
      reducedMotion,
      latestCommand.current?.revision,
      restorePose,
      trainingSite,
    );
    controller.current = lease;
    return () => {
      controller.current = null;
      lease.dispose();
    };
  }, [
    enabled,
    camera,
    gl.domElement,
    terrain,
    reducedMotion,
    restorePose,
    trainingSite,
  ]);
  useLayoutEffect(() => {
    if (enabled && command) controller.current?.apply(command);
  }, [command, enabled, terrain, reducedMotion, trainingSite]);
  useFrame((_, dt) => controller.current?.update(dt));
  return null;
}
