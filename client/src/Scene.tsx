import {
  Component,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Snapshot, Track } from "./types";
import { pixelRatio, type Quality } from "./quality";
import { type CameraPreset, type ThermalPalette } from "./presentation";
import {
  ObservationVisibility,
  opticalRenderShape,
  type Vision,
} from "./visibility";
import {
  SENSOR_VERSION,
  type TerrainBox,
  type SensorPosition,
} from "./sensors-v2";
import { sceneCameraPose, sceneReviewEnvelope } from "./scene-presentation";
import { ContactRenderer } from "./ContactRenderer";
import { InspectionPass } from "./InspectionPass";
import type { RenderShape } from "./render-contacts";
import {
  ViewBlend,
  liveCameraMode,
  slewSeconds,
  type CameraMode,
} from "./camera-view";
import {
  ObservedPoseBuffer,
  opticalFov,
  renderContacts,
  RenderFrameMeter,
  type RenderContact,
} from "./render-contacts";
import {
  Environment,
  LAYER_CONTACTS,
  LAYER_OCCLUDERS,
  LAYER_WORLD,
} from "./world/Environment";
export type { Vision } from "./visibility";
export type RendererMetrics = {
  scope: "previous WebGL frame";
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  observedContacts: number;
  frameIntervals: ReturnType<RenderFrameMeter["frameIntervals"]>;
};
class Boundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
/** Live sensor view: the camera stays at the sensor origin and points at
 *  - the selected contact's displayed pose while a camera observes it ("track");
 *  - otherwise its latest reported position from any sensor ("cue"), as a radar
 *    cue slews a real EO/IR head;
 *  - otherwise the last bearing ("hold"). It never swings to a default sector
 *    while a contact is selected, and is not remounted when the sensor changes. */
function CameraRig({
  onFps,
  preset,
  tracks,
  selected,
  selectedId,
  cue,
  poses,
  finale = false,
  sensorOrigin,
  referenceTruth = false,
  opticalZoom = 1,
  reducedMotion = false,
  onMetrics,
}: {
  onFps: (n: number) => void;
  preset?: CameraPreset;
  tracks: Track[];
  /** Selected contact if it is drawn in this view (optically observed). */
  selected: string | null;
  /** The trainee's selection, whether or not this view can draw it. */
  selectedId: string | null;
  cue?: SensorPosition | null;
  poses: ObservedPoseBuffer;
  finale?: boolean;
  sensorOrigin?: SensorPosition;
  referenceTruth?: boolean;
  opticalZoom?: number;
  reducedMotion?: boolean;
  onMetrics?: (metrics: RendererMetrics) => void;
}) {
  const { camera, size, gl } = useThree();
  const frameMeter = useRef(new RenderFrameMeter());
  const aim = useRef(new THREE.Vector3(0, 18, finale ? 1500 : 150));
  const view = useRef({
    mode: "" as CameraMode | "",
    id: null as string | null,
    cue: new THREE.Vector3(NaN, NaN, NaN),
    aimBlend: new ViewBlend(),
    positionBlend: new ViewBlend(),
  });
  const goal = useMemo(() => new THREE.Vector3(), []);
  const goalPosition = useMemo(() => new THREE.Vector3(), []);
  const origin = useMemo(() => new THREE.Vector3(), []);
  const pose = useMemo(
    () =>
      preset
        ? sceneCameraPose(
            preset,
            tracks,
            selected,
            referenceTruth,
            size.width / Math.max(1, size.height),
          )
        : null,
    [preset, tracks, selected, referenceTruth, size.width, size.height],
  );
  useFrame(({ clock }, dt) => {
    if (camera instanceof THREE.PerspectiveCamera) {
      const desiredFov = opticalFov(preset ? 52 : 38, opticalZoom);
      if (Math.abs(camera.fov - desiredFov) > 0.001) {
        camera.fov = reducedMotion
          ? desiredFov
          : THREE.MathUtils.damp(camera.fov, desiredFov, 8, Math.min(dt, 0.25));
        camera.updateProjectionMatrix();
      }
    }
    const v = view.current;
    let mode: CameraMode;
    if (preset && pose) {
      mode = "preset";
      goal.set(...pose.aim);
      goalPosition.set(...pose.position);
      // Follow and observer framing ride on the displayed pose, so the camera and
      // the model share one smooth path instead of two different filters.
      const shown = selected ? poses.pose(selected) : undefined;
      if (shown && !pose.fallback && pose.effective !== "overview") {
        goalPosition.sub(goal);
        goal.set(shown.displayX, shown.displayY, shown.displayZ);
        goalPosition.add(goal);
      }
    } else {
      origin.set(
        sensorOrigin?.x ?? 0,
        sensorOrigin?.altitude ?? (finale ? 2 : 14),
        sensorOrigin?.z ?? (finale ? 0 : 4),
      );
      goalPosition.copy(origin);
      const shown = selected ? poses.pose(selected) : undefined;
      mode = liveCameraMode(!!shown, selectedId, cue);
      if (shown) goal.set(shown.displayX, shown.displayY, shown.displayZ);
      else if (mode === "cue" && cue) goal.set(cue.x, cue.altitude, cue.z);
      else if (mode === "hold") goal.copy(aim.current);
      else goal.set(finale ? 0 : 40, 18, finale ? 1500 : 150);
    }
    // A cue that jumps (a radar sweep) re-slews; small IR/EO updates are followed.
    const cueJump =
      mode === "cue" &&
      (!Number.isFinite(v.cue.x) ||
        goal.clone().sub(origin).angleTo(v.cue.clone().sub(origin)) >
          THREE.MathUtils.degToRad(1.5));
    const changed = mode !== v.mode || selectedId !== v.id || cueJump;
    if (changed) {
      const duration =
        mode === "preset"
          ? 0.8
          : slewSeconds(
              aim.current
                .clone()
                .sub(goalPosition)
                .angleTo(goal.clone().sub(goalPosition)),
            );
      v.aimBlend.start(aim.current, duration);
      v.positionBlend.start(camera.position, mode === "preset" ? 0.8 : 0.01);
      v.mode = mode;
      v.id = selectedId;
      if (mode === "cue") v.cue.copy(goal);
    }
    if (reducedMotion) {
      aim.current.copy(goal);
      camera.position.copy(goalPosition);
    } else {
      if (v.aimBlend.active)
        v.aimBlend.apply(
          aim.current,
          goal,
          mode === "preset" ? null : goalPosition,
          dt,
        );
      else aim.current.copy(goal);
      if (v.positionBlend.active)
        v.positionBlend.apply(camera.position, goalPosition, null, dt);
      else camera.position.copy(goalPosition);
    }
    camera.lookAt(aim.current);
    const fps = frameMeter.current.sample(clock.elapsedTime);
    if (fps !== null) {
      onFps(fps);
      onMetrics?.({
        scope: "previous WebGL frame",
        drawCalls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
        observedContacts: tracks.length,
        frameIntervals: frameMeter.current.frameIntervals(),
      });
    }
  });
  return null;
}
/** Draws the frame in three passes so decorative scenery can never hide a
 * contact the sensors report, while authoritative occluders still do:
 *  1. world (sky, terrain, facility, vegetation, occluder dressing);
 *  2. depth only, after clearing depth: the exact authoritative terrain boxes;
 *  3. contacts and markers, depth-tested against pass 2 only.
 * The static shadow map is rendered once, not every frame. */
function LayeredRender() {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    gl.info.autoReset = false;
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    return () => {
      gl.info.autoReset = true;
      gl.shadowMap.autoUpdate = true;
    };
  }, [gl]);
  useFrame(() => {
    gl.info.reset();
    gl.autoClear = false;
    gl.clear(true, true, true);
    camera.layers.set(LAYER_WORLD);
    gl.render(scene, camera);
    gl.clearDepth();
    camera.layers.set(LAYER_OCCLUDERS);
    gl.render(scene, camera);
    camera.layers.set(LAYER_CONTACTS);
    gl.render(scene, camera);
    camera.layers.set(LAYER_WORLD);
  }, 1);
  return null;
}
/** Advances the shared observed poses once per frame, before the camera and the
 * contact renderer read them (it is mounted first, so its frame callback runs first). */
function PoseDriver({
  poses,
  contacts,
  tick,
  contextKey,
  reducedMotion,
}: {
  poses: ObservedPoseBuffer;
  contacts: readonly RenderContact[];
  tick: number;
  contextKey: string;
  reducedMotion: boolean;
}) {
  useFrame((_, dt) => {
    poses.update(contacts, tick, contextKey);
    poses.forEachFrame(dt, () => {}, reducedMotion);
  });
  return null;
}
/** Dashed ring at a radar-cued position the cameras cannot see: shows where the
 * camera is pointing and why no airframe is drawn. Evidence position only. */
function CueMarker({ cue }: { cue?: SensorPosition | null }) {
  const ref = useRef<THREE.LineSegments>(null);
  const ring = useMemo(() => {
    const points: number[] = [];
    for (let i = 0; i < 12; i++) {
      const a0 = (i / 12) * Math.PI * 2,
        a1 = a0 + (Math.PI * 2) / 24;
      points.push(Math.cos(a0), Math.sin(a0), 0, Math.cos(a1), Math.sin(a1), 0);
    }
    return new Float32Array(points);
  }, []);
  useFrame(({ camera, size }) => {
    const m = ref.current;
    if (!m) return;
    m.visible = !!cue;
    if (!cue) return;
    m.position.set(cue.x, cue.altitude, cue.z);
    m.quaternion.copy(camera.quaternion);
    const distance = camera.position.distanceTo(m.position);
    const fov = camera instanceof THREE.PerspectiveCamera ? camera.fov : 38;
    m.scale.setScalar(
      (distance * Math.tan((fov * Math.PI) / 360) * 22) /
        Math.max(1, size.height),
    );
  });
  return (
    <lineSegments
      ref={ref}
      visible={false}
      renderOrder={20}
      layers={LAYER_CONTACTS}
    >
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[ring, 3]} />
      </bufferGeometry>
      <lineBasicMaterial
        color="#e6b25e"
        transparent
        depthTest={false}
        depthWrite={false}
        opacity={0.85}
      />
    </lineSegments>
  );
}
function World({
  state,
  vision,
  selected,
  onFps,
  terrain = "urban_outpost",
  quality = "medium",
  fog = 0.2,
  palette = "white",
  cameraPreset,
  finale = false,
  terrainBoxes,
  sensorOrigin,
  referenceTruth = false,
  contextKey,
  opticalZoom,
  reducedMotion = false,
  onMetrics,
  selectedId = null,
  cue,
  inspect,
  inspectLabel,
}: {
  state: Snapshot;
  vision: Vision;
  selected: string | null;
  selectedId?: string | null;
  cue?: SensorPosition | null;
  /** Sensor-limited close-up of the selected contact (live view only). */
  inspect?: { shape: RenderShape; channel: "eo" | "ir" } | null;
  inspectLabel?: RefObject<HTMLDivElement | null>;
  onFps: (n: number) => void;
  terrain?: string;
  quality?: Quality;
  fog?: number;
  palette?: ThermalPalette;
  cameraPreset?: CameraPreset;
  finale?: boolean;
  terrainBoxes?: TerrainBox[];
  sensorOrigin?: SensorPosition;
  referenceTruth?: boolean;
  contextKey: string;
  opticalZoom?: number;
  reducedMotion?: boolean;
  onMetrics?: (metrics: RendererMetrics) => void;
}) {
  const { camera, size } = useThree();
  const envelope = sceneReviewEnvelope(
    state.tracks,
    selected,
    referenceTruth,
    cameraPreset,
    size.width / Math.max(1, size.height),
    {
      // The sky dome (15 km) and the far terrain ring need a long far plane.
      far: 20000,
      fogNear: 0,
      fogFar: 0,
    },
  );
  useEffect(() => {
    if (
      camera instanceof THREE.PerspectiveCamera &&
      camera.far !== envelope.far
    ) {
      camera.far = envelope.far;
      camera.updateProjectionMatrix();
    }
  }, [camera, envelope.far]);
  const contacts = useMemo(() => renderContacts(state.tracks), [state.tracks]);
  const poses = useMemo(() => new ObservedPoseBuffer(), []);
  const boxes = useMemo(
    () => (finale ? (terrainBoxes ?? []) : []),
    [finale, terrainBoxes],
  );
  return (
    <>
      <LayeredRender />
      <Environment
        terrain={
          terrain === "rural_forward_base"
            ? "rural_forward_base"
            : "urban_outpost"
        }
        boxes={boxes}
        legacy={!finale}
        night={state.night}
        vision={vision}
        palette={palette}
        quality={quality}
        fog={fog}
        translucentOccluders={referenceTruth && cameraPreset !== undefined}
        logicalTick={() => poses.displayTick}
        reducedMotion={reducedMotion}
      />
      <PoseDriver
        poses={poses}
        contacts={contacts}
        tick={state.tick}
        contextKey={contextKey}
        reducedMotion={reducedMotion}
      />
      <CameraRig
        opticalZoom={opticalZoom}
        reducedMotion={reducedMotion}
        onMetrics={onMetrics}
        selectedId={selectedId}
        cue={selected ? null : cue}
        poses={poses}
        onFps={onFps}
        preset={cameraPreset}
        tracks={state.tracks}
        selected={selected}
        finale={finale}
        sensorOrigin={sensorOrigin}
        referenceTruth={referenceTruth}
      />
      {!cameraPreset && selectedId && !selected && <CueMarker cue={cue} />}
      <InspectionPass
        poses={poses}
        selected={selected}
        shape={inspect?.shape ?? null}
        channel={inspect?.channel ?? "eo"}
        enabled={!!inspect}
        label={inspectLabel}
      />
      <ContactRenderer
        poses={poses}
        focusId={inspect ? selected : null}
        night={state.night}
        vision={vision}
        selected={selected}
        palette={palette}
        quality={quality}
        reducedMotion={reducedMotion}
        review={referenceTruth && cameraPreset === "overview"}
      />
    </>
  );
}
export type SceneProps = {
  state: Snapshot;
  vision: Vision;
  selected: string | null;
  onFps: (n: number) => void;
  fallback: ReactNode;
  terrain?: string;
  quality?: Quality;
  fog?: number;
  palette?: ThermalPalette;
  cameraPreset?: CameraPreset;
  groundTruth?: boolean;
  visibilityKey?: string;
  opticalAvailable?: boolean;
  terrainBoxes?: TerrainBox[];
  sensorOrigin?: SensorPosition;
  engineVersion?: string;
  /** Display crop only; does not change sensor range, resolution or origin. */
  opticalZoom?: number;
  /** Latest reported position of the selected contact from any sensor (radar,
   * EO or IR). The live camera slews to it when no camera observes the contact. */
  cue?: SensorPosition | null;
  reducedMotion?: boolean;
  onMetrics?: (metrics: RendererMetrics) => void;
};
export function Scene(props: SceneProps) {
  const visibility = useRef(new ObservationVisibility());
  const tracks = visibility.current.tracks(props.state, props.vision, {
    key: props.visibilityKey ?? "legacy-scene",
    groundTruth: props.groundTruth,
    opticalAvailable: props.opticalAvailable,
  });
  const observedState = { ...props.state, tracks };
  const finale =
    props.engineVersion === SENSOR_VERSION ||
    props.terrainBoxes !== undefined ||
    props.state.tracks.some((t) => t.observation?.version === SENSOR_VERSION);
  // Camera framing, follow selection and overview extent must use the same evidence
  // as the meshes. An unobserved selection cannot point the camera at hidden truth.
  const selected = tracks.some((t) => t.id === props.selected)
    ? props.selected
    : null;
  // Close-up only when a camera resolves the shape (recognise / identify) and
  // only in the live sensor view, never in reference-truth review.
  const focus = tracks.find((t) => t.id === selected);
  const level = focus
    ? (focus.visual_level ?? (focus.thermal ? "recognise" : "none"))
    : "none";
  const inspect =
    focus &&
    !props.cameraPreset &&
    props.groundTruth !== true &&
    (level === "recognise" || level === "identify")
      ? {
          shape: opticalRenderShape(focus) as RenderShape,
          channel: (props.vision === "day" ? "eo" : "ir") as "eo" | "ir",
        }
      : null;
  const inspectLabel = useRef<HTMLDivElement>(null);
  return (
    <Boundary fallback={props.fallback}>
      <Canvas
        dpr={pixelRatio[props.quality ?? "medium"]}
        shadows={
          props.quality === "high"
            ? "soft"
            : props.quality === "medium"
              ? "percentage"
              : false
        }
        camera={{
          position: props.cameraPreset
            ? [0, 240, 144]
            : [
                props.sensorOrigin?.x ?? 0,
                props.sensorOrigin?.altitude ?? (finale ? 2 : 14),
                props.sensorOrigin?.z ?? (finale ? 0 : 4),
              ],
          fov: props.cameraPreset ? 52 : 38,
          near: props.cameraPreset ? 1 : 0.5,
          far: 20000,
        }}
        gl={{
          antialias: props.quality !== "low",
          powerPreference: "high-performance",
        }}
      >
        <World
          {...props}
          state={observedState}
          selected={selected}
          selectedId={props.selected}
          inspect={inspect}
          inspectLabel={inspectLabel}
          finale={finale}
          referenceTruth={props.groundTruth === true}
          contextKey={`${props.visibilityKey ?? "legacy-scene"}:${props.vision}:${props.groundTruth === true}`}
        />
      </Canvas>
      {inspect && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            width: 168,
            height: 168,
            border: "1px solid rgba(142, 214, 255, 0.55)",
            pointerEvents: "none",
          }}
        />
      )}
      <div
        ref={inspectLabel}
        className="view-annotation"
        style={{
          display: "none",
          position: "absolute",
          right: 14,
          textAlign: "right",
          lineHeight: 1.3,
        }}
      />
      {props.groundTruth === true && (
        <div
          className="view-annotation"
          role="note"
          style={{
            top: 16,
            right: 16,
            background: "#0d1516dd",
            padding: 8,
            maxWidth: "75%",
            textAlign: "right",
          }}
        >
          AAR / INSTRUCTOR REFERENCE TRUTH
          <span>Full active geometry · not trainee sensor evidence</span>
        </div>
      )}
    </Boundary>
  );
}
