import { Component, useEffect, useMemo, useRef, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Snapshot, Track } from "./types";
import { pixelRatio, type Quality } from "./quality";
import {
  palettes,
  type CameraPreset,
  type ThermalPalette,
} from "./presentation";
import { ObservationVisibility, type Vision } from "./visibility";
import {
  SENSOR_VERSION,
  type TerrainBox,
  type SensorPosition,
} from "./sensors-v2";
import {
  terrainPresentationBounds,
  terrainMaterialState,
  buildingSurfaceColors,
  buildingVertexColors,
  roadPaint,
  sceneCameraPose,
  sceneGroundColor,
  sceneReviewEnvelope,
  type TerrainPresentationBox,
} from "./scene-presentation";
import { ContactRenderer } from "./ContactRenderer";
import {
  opticalFov,
  renderContacts,
  RenderFrameMeter,
} from "./render-contacts";
import { createSkyTexture, createSurfaceTexture } from "./surface-textures";
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
function CameraRig({
  target,
  onFps,
  preset,
  tracks,
  selected,
  finale = false,
  sensorOrigin,
  referenceTruth = false,
  opticalZoom = 1,
  reducedMotion = false,
  onMetrics,
}: {
  target: Track | undefined;
  onFps: (n: number) => void;
  preset?: CameraPreset;
  tracks: Track[];
  selected: string | null;
  finale?: boolean;
  sensorOrigin?: SensorPosition;
  referenceTruth?: boolean;
  opticalZoom?: number;
  reducedMotion?: boolean;
  onMetrics?: (metrics: RendererMetrics) => void;
}) {
  const { camera, size, gl } = useThree();
  const frameMeter = useRef(new RenderFrameMeter());
  const aim = useRef(new THREE.Vector3(40, 18, 150));
  const desiredPosition = useMemo(() => new THREE.Vector3(), []);
  const desiredAim = useMemo(() => new THREE.Vector3(), []);
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
    if (preset && pose) {
      camera.position.lerp(
        desiredPosition.set(...pose.position),
        reducedMotion ? 1 : 1 - Math.exp(-dt * 5),
      );
      aim.current.lerp(
        desiredAim.set(...pose.aim),
        reducedMotion ? 1 : 1 - Math.exp(-dt * 5),
      );
    } else {
      const next =
        target && target.active
          ? desiredAim.set(target.x, target.altitude, target.z)
          : desiredAim.set(finale ? 0 : 40, 18, finale ? 1500 : 150);
      aim.current.lerp(next, reducedMotion ? 1 : 1 - Math.exp(-dt * 7.67));
      camera.position.set(
        sensorOrigin?.x ?? 0,
        sensorOrigin?.altitude ?? (finale ? 2 : 14),
        sensorOrigin?.z ?? (finale ? 0 : 4),
      );
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
function TerrainStructure({
  box,
  index,
  vision,
  rural,
  palette,
  material,
  texture,
  shadows = false,
}: {
  box: TerrainPresentationBox;
  index: number;
  vision: Vision;
  rural: boolean;
  palette: ThermalPalette;
  material: ReturnType<typeof terrainMaterialState>;
  texture: THREE.Texture;
  shadows?: boolean;
}) {
  const colors = useMemo(
    () =>
      buildingVertexColors(
        buildingSurfaceColors(index, vision, rural, palette),
      ),
    [index, vision, rural, palette],
  );
  return (
    <mesh
      position={[box.x, box.h / 2, box.z]}
      castShadow={shadows}
      receiveShadow={shadows}
    >
      <boxGeometry args={[box.w, box.h, box.d]}>
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </boxGeometry>
      <meshStandardMaterial
        color="#ffffff"
        vertexColors
        map={vision === "thermal" ? undefined : texture}
        roughness={0.95}
        metalness={0}
        {...material}
      />
    </mesh>
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
  reducedMotion,
  onMetrics,
}: {
  state: Snapshot;
  vision: Vision;
  selected: string | null;
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
      far: finale ? 20000 : cameraPreset ? 1200 : 800,
      fogNear: finale ? 8000 : cameraPreset ? 650 : 160 - fog * 100,
      fogFar: finale ? 18000 : cameraPreset ? 1200 : 550 - fog * 300,
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
  const hot = vision === "thermal";
  const night = vision !== "day";
  const bg = hot ? palettes[palette].background : night ? "#07191d" : "#91b2c2";
  const rural = terrain === "rural_forward_base";
  const detail = quality === "high" ? 32 : quality === "medium" ? 20 : 10;
  const contacts = useMemo(() => renderContacts(state.tracks), [state.tracks]);
  const sky = useMemo(
    () => createSkyTexture(vision, rural, palette),
    [vision, rural, palette],
  );
  const groundTexture = useMemo(() => {
    const texture = createSurfaceTexture(quality, "ground");
    texture.repeat.set(finale ? 48 : 6, finale ? 48 : 6);
    return texture;
  }, [quality, finale]);
  const facadeTexture = useMemo(
    () => createSurfaceTexture(quality, "facade"),
    [quality],
  );
  useEffect(() => () => sky.dispose(), [sky]);
  useEffect(() => () => groundTexture.dispose(), [groundTexture]);
  useEffect(() => () => facadeTexture.dispose(), [facadeTexture]);
  const shadows = quality === "high" && vision === "day";
  const buildings = useMemo(
    () =>
      finale
        ? terrainPresentationBounds(terrainBoxes ?? [])
        : Array.from(
            { length: rural ? Math.max(2, Math.floor(detail / 5)) : detail },
            (_, i) => {
              const side = i % 2 === 0 ? -1 : 1;
              return {
                x: side * (20 + ((i * 17) % 55)),
                z: 35 + Math.floor(i / 2) * 13,
                w: 7 + ((i * 3) % 8),
                h: 4 + ((i * 7) % 18),
                d: 8 + ((i * 5) % 8),
              };
            },
          ),
    [rural, detail, finale, terrainBoxes],
  );
  const paint = useMemo(() => roadPaint(finale, quality), [finale, quality]);
  const material = useMemo(
    () => terrainMaterialState(referenceTruth, cameraPreset),
    [referenceTruth, cameraPreset],
  );
  return (
    <>
      <primitive attach="background" object={sky} />
      <fog attach="fog" args={[bg, envelope.fogNear, envelope.fogFar]} />
      <ambientLight intensity={hot ? 1.4 : night ? 0.55 : 0.7} />
      <hemisphereLight
        args={[
          night ? "#31535a" : "#d4e2e4",
          "#293627",
          hot ? 0 : night ? 0.15 : 0.5,
        ]}
      />
      <directionalLight
        position={[40, 100, -40]}
        intensity={hot ? 0.2 : night ? 0.6 : 2.1}
        castShadow={shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-300}
        shadow-camera-right={300}
        shadow-camera-top={300}
        shadow-camera-bottom={-300}
        shadow-camera-far={600}
        shadow-bias={-0.0004}
        color={hot ? "#ffffff" : night ? "#c1dadb" : "#fff4db"}
      />
      <CameraRig
        key={contextKey}
        opticalZoom={opticalZoom}
        reducedMotion={reducedMotion}
        onMetrics={onMetrics}
        target={state.tracks.find((t) => t.id === selected)}
        onFps={onFps}
        preset={cameraPreset}
        tracks={state.tracks}
        selected={selected}
        finale={finale}
        sensorOrigin={sensorOrigin}
        referenceTruth={referenceTruth}
      />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.1, 150]}
        receiveShadow={shadows}
      >
        <planeGeometry args={finale ? [12000, 12000] : [700, 700]} />
        <meshStandardMaterial
          color={sceneGroundColor(vision, rural, palette)}
          map={hot ? undefined : groundTexture}
          roughness={1}
          metalness={0}
        />
      </mesh>
      <gridHelper
        args={[
          finale ? 12000 : 600,
          finale ? 120 : 60,
          hot ? "#3e4944" : "#31433b",
          hot ? "#303a35" : "#23312c",
        ]}
        position={[0, 0, 160]}
        onUpdate={(grid) => {
          const materials = Array.isArray(grid.material)
            ? grid.material
            : [grid.material];
          materials.forEach((value) => {
            value.transparent = true;
            value.opacity = 0.12;
            value.depthWrite = false;
          });
        }}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 155]}>
        <planeGeometry args={[18, finale ? 8000 : 400]} />
        <meshStandardMaterial color={hot ? "#262e2c" : "#343b3c"} />
      </mesh>
      {!hot &&
        paint.map((mark, index) => (
          <mesh
            key={`road-paint-${index}`}
            rotation={[-Math.PI / 2, 0, 0]}
            position={mark.position}
          >
            <planeGeometry args={mark.size} />
            <meshStandardMaterial
              color={night ? "#526b67" : "#c6c8b2"}
              roughness={1}
            />
          </mesh>
        ))}
      {rural &&
        !finale &&
        Array.from({ length: Math.floor(detail / 2) }, (_, i) => (
          <group
            key={`tree-${i}`}
            position={[
              (i % 2 ? -1 : 1) * (85 + ((i * 17) % 70)),
              0,
              25 + i * 12,
            ]}
          >
            <mesh position={[0, 3, 0]}>
              <cylinderGeometry args={[0.5, 0.7, 6, 5]} />
              <meshStandardMaterial color={hot ? "#59625c" : "#574c34"} />
            </mesh>
            <mesh position={[0, 8, 0]}>
              <coneGeometry args={[5, 10, 6]} />
              <meshStandardMaterial color={hot ? "#70776b" : "#354e2c"} />
            </mesh>
          </group>
        ))}
      {buildings.map((box, index) => (
        <TerrainStructure
          key={index}
          box={box}
          index={index}
          vision={vision}
          rural={rural}
          palette={palette}
          material={material}
          texture={facadeTexture}
          shadows={shadows}
        />
      ))}
      <mesh position={[0, 2, -4]}>
        <boxGeometry args={[10, 4, 6]} />
        <meshStandardMaterial color={hot ? "#94a397" : "#5f705f"} />
      </mesh>
      <ContactRenderer
        contacts={contacts}
        tick={state.tick}
        contextKey={contextKey}
        vision={vision}
        selected={selected}
        palette={palette}
        quality={quality}
        reducedMotion={reducedMotion}
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
  return (
    <Boundary fallback={props.fallback}>
      <Canvas
        dpr={pixelRatio[props.quality ?? "medium"]}
        shadows={props.quality === "high" && props.vision === "day"}
        camera={{
          position: props.cameraPreset
            ? [0, 240, 144]
            : [
                props.sensorOrigin?.x ?? 0,
                props.sensorOrigin?.altitude ?? (finale ? 2 : 14),
                props.sensorOrigin?.z ?? (finale ? 0 : 4),
              ],
          fov: props.cameraPreset ? 52 : 38,
          near: 0.1,
          far: finale ? 20000 : props.cameraPreset ? 1200 : 800,
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
          finale={finale}
          referenceTruth={props.groundTruth === true}
          contextKey={`${props.visibilityKey ?? "legacy-scene"}:${props.vision}:${props.groundTruth === true}`}
        />
      </Canvas>
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
