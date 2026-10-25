import { InspectionCadence } from "./render-work";
import { useEffect, useMemo, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { AIRFRAME_SPAN } from "./airframe-geometry";
import type { ObservedPoseBuffer, RenderShape } from "./render-contacts";
import {
  defaultSensorConfig,
  sensorConfiguration,
  type SensorConfig,
} from "./sensors-v2";
import type { SceneryObstruction } from "./world/obstruction";

/** How many sensor pixels the selected contact covers at its observed range:
 * span / (range × IFOV), with the EO or IR IFOV from the frozen sensor config. */
export function pixelsOnTarget(
  shape: RenderShape,
  range: number,
  channel: "eo" | "ir",
  config: Pick<
    SensorConfig,
    "eo_ifov_rad" | "ir_ifov_rad"
  > = defaultSensorConfig,
) {
  const ifov = channel === "eo" ? config.eo_ifov_rad : config.ir_ifov_rad;
  return AIRFRAME_SPAN[shape] / (Math.max(1, range) * ifov);
}
/** Inset resolution so the target fills FILL of the inset width at the sensor's
 * own pixel count: the close-up can never show detail the sensor could not
 * resolve. Bounded for very near and very far contacts. */
export const INSPECTION_FILL = 0.45;
export function inspectionResolution(pixels: number) {
  return Math.round(Math.min(192, Math.max(8, pixels / INSPECTION_FILL)));
}

/** Keep the inset outside a 32px clearance around the main sight centre.
 * This only changes painted size; sensor sampling resolution stays unchanged. */
export function inspectionDisplaySize(
  width: number,
  height: number,
  preferred = 168,
) {
  return Math.max(
    16,
    Math.floor(Math.min(preferred, width / 2 - 46, height / 2 - 46)),
  );
}

/** Sensor-limited close-up of the selected contact, drawn into a corner of the
 * canvas after the main passes. Only for observation levels that resolve a
 * shape (recognise / identify); the airframe is the generic one for the observed
 * silhouette. */
export function InspectionPass({
  poses,
  selected,
  shape,
  channel,
  enabled,
  insetCss = 168,
  label,
  obstruction,
  displayKey,
  frame,
  sensorConfig,
}: {
  sensorConfig?: Partial<SensorConfig>;
  frame?: RefObject<HTMLDivElement | null>;
  displayKey: string;
  poses: ObservedPoseBuffer;
  selected: string | null;
  shape: RenderShape | null;
  channel: "eo" | "ir";
  enabled: boolean;
  insetCss?: number;
  /** DOM caption updated directly (no React state per frame). */
  label?: RefObject<HTMLDivElement | null>;
  /** Decorative scenery in the line of sight hides the close-up. */
  obstruction?: SceneryObstruction;
}) {
  const { gl, scene, camera, size } = useThree();
  const parameters = useMemo(
    () => sensorConfiguration(sensorConfig),
    [sensorConfig],
  );
  const configurationKey = useMemo(
    () => JSON.stringify(parameters),
    [parameters],
  );
  // A sensor pixel integrates the scene over its footprint: render at 4× the
  // sensor resolution, box-filter down (mipmapped minification), then show the
  // sensor-resolution image enlarged with nearest-neighbour sampling.
  const SS = 4;
  const fine = useMemo(
    () =>
      new THREE.WebGLRenderTarget(32 * SS, 32 * SS, {
        minFilter: THREE.LinearMipmapLinearFilter,
        magFilter: THREE.LinearFilter,
        generateMipmaps: true,
        depthBuffer: true,
        colorSpace: THREE.SRGBColorSpace,
      }),
    [],
  );
  const target = useMemo(
    () =>
      new THREE.WebGLRenderTarget(32, 32, {
        magFilter: THREE.NearestFilter,
        minFilter: THREE.NearestFilter,
        depthBuffer: false,
        colorSpace: THREE.SRGBColorSpace,
      }),
    [],
  );
  const inset = useMemo(() => {
    const cam = new THREE.PerspectiveCamera(5, 1, 0.5, 20000);
    const quadScene = new THREE.Scene();
    const quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshBasicMaterial({ map: target.texture, toneMapped: false }),
    );
    quadScene.add(quad);
    const downScene = new THREE.Scene();
    const down = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshBasicMaterial({ map: fine.texture, toneMapped: false }),
    );
    downScene.add(down);
    const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    return { cam, quadScene, quad, downScene, down, ortho };
  }, [target, fine]);
  useEffect(
    () => () => {
      target.dispose();
      fine.dispose();
      for (const m of [inset.quad, inset.down]) {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
    },
    [target, fine, inset],
  );
  const v = useMemo(() => new THREE.Vector3(), []);
  const cadence = useMemo(() => new InspectionCadence(), []);
  useFrame(({ clock }) => {
    const pose = selected ? poses.pose(selected) : undefined;
    const caption = label?.current;
    const border = frame?.current;
    if (!enabled || !pose || !shape || shape === "unresolved") {
      cadence.invalidate();
      if (border) border.style.display = "none";
      if (caption && caption.style.display !== "none")
        caption.style.display = "none";
      return;
    }
    v.set(pose.displayX, pose.displayY, pose.displayZ);
    const range = camera.position.distanceTo(v);
    const displaySize = inspectionDisplaySize(
      size.width,
      size.height,
      insetCss,
    );
    if (selected && obstruction?.blocked.has(selected)) {
      cadence.invalidate();
      if (border) border.style.display = "none";
      // Decorative scenery stands in the way: no picture of the airframe through it.
      if (caption) {
        caption.style.display = "block";
        caption.style.top = "14px";
        caption.style.width = `${displaySize}px`;
        caption.textContent = `${channel.toUpperCase()} CLOSE-UP · VIEW BLOCKED BY SCENERY · ${Math.round(range)}\u00a0M`;
      }
      return;
    }
    if (border) {
      border.style.display = "block";
      const extent = `${displaySize}px`;
      if (border.style.width !== extent)
        border.style.width = border.style.height = extent;
    }
    const pixels = pixelsOnTarget(shape, range, channel, parameters);
    const res = inspectionResolution(pixels);
    const key = `${displayKey}:${selected}:${shape}:${channel}:${res}:${configurationKey}:${camera.position.x}:${camera.position.y}:${camera.position.z}`;
    if (cadence.refresh(clock.elapsedTime, key)) {
      if (target.width !== res) {
        target.setSize(res, res);
        fine.setSize(res * SS, res * SS);
      }
      const span = AIRFRAME_SPAN[shape] / INSPECTION_FILL;
      inset.cam.position.copy(camera.position);
      inset.cam.fov = THREE.MathUtils.radToDeg(2 * Math.atan(span / 2 / range));
      inset.cam.near = Math.max(0.5, range * 0.5);
      inset.cam.far = 20000;
      inset.cam.updateProjectionMatrix();
      inset.cam.lookAt(v);
      // Same three passes as the main view, supersampled, then box-filtered down.
      gl.setRenderTarget(fine);
      gl.clear(true, true, true);
      for (const layer of [0, 2, 1]) {
        if (layer === 2) gl.clearDepth();
        inset.cam.layers.set(layer);
        gl.render(scene, inset.cam);
      }
      gl.setRenderTarget(target);
      gl.render(inset.downScene, inset.ortho);
      gl.setRenderTarget(null);
    }
    // Blit into the top-right corner with nearest-neighbour upscaling
    // (viewport units are CSS pixels; origin bottom-left).
    const margin = 14;
    const x = size.width - displaySize - margin;
    const y = size.height - displaySize - margin;
    gl.setScissorTest(true);
    gl.setScissor(x, y, displaySize, displaySize);
    gl.setViewport(x, y, displaySize, displaySize);
    gl.clearDepth();
    gl.render(inset.quadScene, inset.ortho);
    gl.setScissorTest(false);
    gl.setViewport(0, 0, size.width, size.height);
    if (caption) {
      caption.style.display = "block";
      caption.style.top = `${margin + displaySize + 4}px`;
      caption.style.width = `${displaySize}px`;
      const text = `${channel.toUpperCase()} CLOSE-UP · ${Math.max(1, Math.round(pixels))} PX ACROSS TARGET · ${Math.round(range)}\u00a0M`;
      if (caption.textContent !== text) caption.textContent = text;
    }
  }, 2);
  return null;
}
