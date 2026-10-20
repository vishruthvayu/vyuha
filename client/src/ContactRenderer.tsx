import { uploadInstances } from "./render-work";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  airframeLod,
  createAirframeParts,
  projectedPixels,
  type AirframePart,
} from "./airframe-geometry";
import type { ThermalPalette } from "./presentation";
import type { Quality } from "./quality";
import {
  wingAngle,
  type ObservedPoseBuffer,
  type RenderPose,
} from "./render-contacts";
import type { Vision } from "./visibility";
import {
  THERMAL_GLSL,
  displayThermal,
  setThermalUniforms,
  thermalColor,
  thermalUniforms,
} from "./world/thermal";

import type { SceneryObstruction } from "./world/obstruction";

/** Contacts on layer 1 (drawn after the world; see LayeredRender in Scene.tsx). */
const LAYER = 1;
const CAPACITY = 256;
/** Cosmetic prop spin (rev/s of the *displayed* blades, chosen to read as motion). */
const SPIN_RPS = 7.3;

/** Attitude cues from the displayed (observed) path only: multirotors tilt into
 * their direction of travel and bank in turns; fixed wings and birds bank and
 * pitch with the flight path. Bounded, never from hidden truth. */
export function attitude(
  pose: Pick<
    RenderPose,
    "shape" | "velocityX" | "velocityY" | "velocityZ" | "yawRate"
  >,
) {
  const v = Math.hypot(pose.velocityX, pose.velocityZ);
  // "+ 0" turns -0 into 0 so a still contact has exactly level attitude.
  const clamp = (x: number, m: number) => Math.max(-m, Math.min(m, x)) + 0;
  if (pose.shape === "multirotor")
    return {
      pitch: Math.min(0.32, v * 0.016),
      roll: clamp(-pose.yawRate * v * 0.05, 0.35),
    };
  if (pose.shape === "fixed_wing" || pose.shape === "bird") {
    const k = pose.shape === "bird" ? 0.7 : 1;
    return {
      pitch: clamp(-Math.atan2(pose.velocityY, Math.max(1, v)) * 0.8, 0.35),
      roll: clamp(-Math.atan((pose.yawRate * v) / 9.81) * k, 0.6),
    };
  }
  return { pitch: 0, roll: 0 };
}

function thermalAirframeMaterial(transparent: boolean) {
  const uniforms = thermalUniforms();
  const material = new THREE.MeshBasicMaterial({
    transparent,
    opacity: transparent ? 0.3 : 1,
    depthWrite: !transparent,
    side: transparent ? THREE.DoubleSide : THREE.FrontSide,
    toneMapped: false,
  });
  material.userData.uniforms = uniforms;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute float heat;\nvarying float vHeat;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvHeat = heat;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>\nvarying float vHeat;\n${THERMAL_GLSL}`,
      )
      .replace(
        "#include <map_fragment>",
        "diffuseColor.rgb = thermalRamp(vHeat + uTemp);",
      )
      .replace("#include <color_fragment>", "");
  };
  material.customProgramCacheKey = () =>
    `vyuha-airframe-ir-${transparent ? "disc" : "body"}`;
  return material;
}

/** Alpha ring with a dark rim for after-action review markers (RGBA, size²). */
export function reviewRing(size = 32) {
  const data = new Uint8Array(size * size * 4);
  const c = (size - 1) / 2,
    r = size / 2;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c) / r;
      const ring = d > 0.56 && d < 0.8;
      const rim = (d >= 0.44 && d <= 0.56) || (d >= 0.8 && d < 0.94);
      const o = (y * size + x) * 4;
      const v = ring ? 255 : 0;
      data.set([v, v, v, ring ? 255 : rim ? 200 : 0], o);
    }
  return data;
}

/** Soft round blob for an unresolved contact (white RGB, alpha falls off at
 * the edge), instead of a hard square that reads as a dead pixel. */
export function softDisc(size = 16) {
  const data = new Uint8Array(size * size * 4);
  const c = (size - 1) / 2;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c) / (size / 2);
      const a = Math.round(255 * Math.min(1, Math.max(0, (1 - d) / 0.35)));
      data.set([255, 255, 255, a], (y * size + x) * 4);
    }
  return data;
}

/** Hollow diamond with a dark rim: a reported contact behind decorative scenery
 * (RGBA, size²). The simulation does not model scenery, so the report stands;
 * the marker says where it is without painting an airframe on a wall. */
export function obstructedDiamond(size = 32) {
  const data = new Uint8Array(size * size * 4);
  const c = (size - 1) / 2,
    r = size / 2;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const d = (Math.abs(x - c) + Math.abs(y - c)) / r;
      const band = d > 0.6 && d < 0.82;
      const rim = (d >= 0.46 && d <= 0.6) || (d >= 0.82 && d < 0.98);
      const v = band ? 255 : 0;
      data.set([v, v, v, band ? 255 : rim ? 210 : 0], (y * size + x) * 4);
    }
  return data;
}

/** Instanced airframes for every observed contact. Only observation-scoped
 * descriptors reach this component (shape, position); never kind or identity. */
export function ContactRenderer({
  poses,
  vision,
  palette,
  quality,
  selected,
  focusId = null,
  night = false,
  reducedMotion = false,
  review = false,
  obstruction,
}: {
  /** Shared with the camera rig; advanced once per frame before either reads it. */
  poses: ObservedPoseBuffer;
  vision: Vision;
  palette: ThermalPalette;
  quality: Quality;
  selected: string | null;
  /** Contact drawn at full detail whatever its size (the close-up subject). */
  focusId?: string | null;
  night?: boolean;
  reducedMotion?: boolean;
  /** After-action overview of reference truth: every contact gets a fixed-size
   * ring and a stalk to the ground, in one neutral colour, so positions and
   * heights read from far above. Never used in a live view. */
  review?: boolean;
  /** Line-of-sight test against decorative scenery (not modelled by sensors). */
  obstruction?: SceneryObstruction;
}) {
  const parts = useMemo(() => createAirframeParts(quality), [quality]);
  useEffect(() => () => parts.forEach((p) => p.geometry.dispose()), [parts]);
  const thermal = vision !== "day";
  const materials = useMemo(
    () => ({
      // Matte plastics and composites: little sky reflection, so a small
      // airframe reads as a dark shape against the sky, as the far marker does.
      eoBody: new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.68,
        metalness: 0.1,
        envMapIntensity: 0.55,
      }),
      eoDisc: new THREE.MeshBasicMaterial({
        color: "#9aa0a6",
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      irBody: thermalAirframeMaterial(false),
      irDisc: thermalAirframeMaterial(true),
    }),
    [],
  );
  useEffect(
    () => () => Object.values(materials).forEach((m) => m.dispose()),
    [materials],
  );
  useEffect(() => {
    const display = vision === "night" ? "night" : palette;
    for (const m of [materials.irBody, materials.irDisc])
      setThermalUniforms(
        m.userData.uniforms,
        { day: 0, night: -0.03, variation: 0 },
        night,
        display,
      );
  }, [materials, vision, palette, night]);
  const materialFor = (part: AirframePart) =>
    part.role === "disc"
      ? thermal
        ? materials.irDisc
        : materials.eoDisc
      : thermal
        ? materials.irBody
        : materials.eoBody;

  const meshes = useRef<(THREE.InstancedMesh | null)[]>([]);
  const counters = useMemo(() => new Uint32Array(parts.length), [parts]);
  const byShapeLod = useMemo(() => {
    const map = new Map<string, number[]>();
    parts.forEach((p, i) => {
      const key = `${p.shape}:${p.lod}`;
      map.set(key, [...(map.get(key) ?? []), i]);
    });
    return map;
  }, [parts]);
  const lods = useRef(new Map<string, 0 | 1 | 2>());

  // Far marker: a fixed-size point for contacts smaller than a few pixels, as a
  // real imager still shows a small contrasting blob. Observed position only.
  const far = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(CAPACITY * 3), 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    geometry.setDrawRange(0, 0);
    const disc = new THREE.DataTexture(softDisc(), 16, 16);
    disc.magFilter = THREE.LinearFilter;
    disc.needsUpdate = true;
    const material = new THREE.PointsMaterial({
      size: 4,
      sizeAttenuation: false,
      map: disc,
      transparent: true,
      alphaTest: 0.02,
      depthWrite: false,
      color: "#2a2e32",
      toneMapped: false,
    });
    const points = new THREE.Points(geometry, material);
    points.layers.set(LAYER);
    points.frustumCulled = false;
    points.renderOrder = 5;
    return points;
  }, []);
  useEffect(
    () => () => {
      far.geometry.dispose();
      (far.material as THREE.PointsMaterial).map?.dispose();
      (far.material as THREE.Material).dispose();
    },
    [far],
  );
  useEffect(() => {
    const m = far.material as THREE.PointsMaterial;
    if (thermal)
      m.color.copy(
        thermalColor(
          // Mean of a small airframe: body near ambient plus a little motor heat.
          displayThermal(0.68, night),
          vision === "night" ? "night" : palette,
        ),
      );
    else m.color.set(night ? "#05070a" : "#2a2e32");
  }, [far, thermal, night, vision, palette]);

  const reviewMarks = useMemo(() => {
    const ring = new THREE.DataTexture(reviewRing(), 32, 32);
    ring.magFilter = THREE.LinearFilter;
    ring.minFilter = THREE.LinearFilter;
    ring.needsUpdate = true;
    const dots = new THREE.BufferGeometry();
    dots.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(CAPACITY * 3), 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    const stalks = new THREE.BufferGeometry();
    stalks.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(CAPACITY * 6), 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    const points = new THREE.Points(
      dots,
      new THREE.PointsMaterial({
        size: 13,
        sizeAttenuation: false,
        map: ring,
        color: "#ffe3ad",
        transparent: true,
        depthTest: false,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      }),
    );
    const lines = new THREE.LineSegments(
      stalks,
      new THREE.LineBasicMaterial({
        color: "#ffe3ad",
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      }),
    );
    for (const o of [points, lines]) {
      o.layers.set(LAYER);
      o.frustumCulled = false;
      o.renderOrder = 6;
      o.visible = false;
      o.geometry.setDrawRange(0, 0);
    }
    const diamond = new THREE.DataTexture(obstructedDiamond(), 32, 32);
    diamond.magFilter = THREE.LinearFilter;
    diamond.minFilter = THREE.LinearFilter;
    diamond.needsUpdate = true;
    const hiddenDots = new THREE.BufferGeometry();
    hiddenDots.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(CAPACITY * 3), 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    hiddenDots.setDrawRange(0, 0);
    const hidden = new THREE.Points(
      hiddenDots,
      new THREE.PointsMaterial({
        size: 12,
        sizeAttenuation: false,
        map: diamond,
        color: "#f1eee4",
        transparent: true,
        depthTest: false,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      }),
    );
    hidden.layers.set(LAYER);
    hidden.frustumCulled = false;
    hidden.renderOrder = 6;
    return { points, lines, ring, hidden, diamond };
  }, []);
  useEffect(
    () => () => {
      for (const o of [
        reviewMarks.points,
        reviewMarks.lines,
        reviewMarks.hidden,
      ]) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
      reviewMarks.ring.dispose();
      reviewMarks.diamond.dispose();
    },
    [reviewMarks],
  );

  const marker = useRef<THREE.LineSegments>(null);
  const bracket = useMemo(
    () =>
      new Float32Array([
        -1, 0.6, 0, -1, 1, 0, -1, 1, 0, -0.6, 1, 0, 0.6, 1, 0, 1, 1, 0, 1, 1, 0,
        1, 0.6, 0, 1, -0.6, 0, 1, -1, 0, 1, -1, 0, 0.6, -1, 0, -0.6, -1, 0, -1,
        -1, 0, -1, -1, 0, -1, -0.6, 0,
      ]),
    [],
  );
  const s = useMemo(
    () => ({
      position: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      euler: new THREE.Euler(0, 0, 0, "YXZ"),
      one: new THREE.Vector3(1, 1, 1),
      base: new THREE.Matrix4(),
      local: new THREE.Matrix4(),
      matrix: new THREE.Matrix4(),
      axisY: new THREE.Vector3(0, 1, 0),
      axisZ: new THREE.Vector3(0, 0, 1),
    }),
    [],
  );

  const seen = useMemo(() => new Set<string>(), []);
  useFrame(({ camera, size }) => {
    counters.fill(0);
    let farCount = 0;
    const farPos = far.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    if (marker.current) marker.current.visible = false;
    const fov = camera instanceof THREE.PerspectiveCamera ? camera.fov : 38;
    const spin = reducedMotion
      ? 0
      : (poses.displayTick / 30) * SPIN_RPS * Math.PI * 2;
    seen.clear();
    let reviewCount = 0;
    const dotPos = reviewMarks.points.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const stalkPos = reviewMarks.lines.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const hiddenPos = reviewMarks.hidden.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    let hiddenCount = 0;
    obstruction?.update(camera.position, (visit) =>
      poses.each((p) => visit(p.id, p.displayX, p.displayY, p.displayZ)),
    );
    poses.each((p) => {
      seen.add(p.id);
      s.position.set(p.displayX, p.displayY, p.displayZ);
      if (review && reviewCount < CAPACITY) {
        dotPos.setXYZ(reviewCount, p.displayX, p.displayY, p.displayZ);
        stalkPos.setXYZ(reviewCount * 2, p.displayX, p.displayY, p.displayZ);
        stalkPos.setXYZ(reviewCount * 2 + 1, p.displayX, 0, p.displayZ);
        reviewCount++;
      }
      const distance = camera.position.distanceTo(s.position);
      const px = projectedPixels(p.shape, distance, fov, size.height);
      const sized = airframeLod(px, lods.current.get(p.id));
      lods.current.set(p.id, sized);
      // Behind decorative scenery: a marker at the reported position, no airframe.
      const hidden = obstruction?.blocked.has(p.id) === true;
      if (hidden && hiddenCount < CAPACITY)
        hiddenPos.setXYZ(hiddenCount++, p.displayX, p.displayY, p.displayZ);
      if (!hidden && sized === 2 && farCount < CAPACITY)
        farPos.setXYZ(farCount++, s.position.x, s.position.y, s.position.z);
      const lod = hidden ? 2 : p.id === focusId ? 0 : sized;
      if (lod !== 2) {
        const { pitch, roll } = reducedMotion
          ? { pitch: 0, roll: 0 }
          : attitude(p);
        s.quaternion.setFromEuler(
          s.euler.set(pitch, p.displayHeading, roll, "YXZ"),
        );
        s.base.compose(s.position, s.quaternion, s.one);
        for (const i of byShapeLod.get(`${p.shape}:${lod}`) ?? []) {
          const part = parts[i];
          const mesh = meshes.current[i];
          if (!mesh) continue;
          const room = mesh.instanceMatrix.count;
          if (part.role === "body") {
            if (counters[i] < room) mesh.setMatrixAt(counters[i]++, s.base);
          } else if (part.role === "wing" && part.pivot) {
            const flap = reducedMotion
              ? 0.12
              : wingAngle(p.id, poses.displayTick) + 0.1;
            s.local.makeRotationZ(-(part.wing ?? 1) * flap);
            s.local.setPosition(...part.pivot);
            s.matrix.multiplyMatrices(s.base, s.local);
            if (counters[i] < room) mesh.setMatrixAt(counters[i]++, s.matrix);
          } else if (part.pivots) {
            part.pivots.forEach((pv, k) => {
              const angle =
                part.role === "rotor" ? spin * (k % 2 ? -1 : 1) + k * 0.9 : 0;
              s.local.makeRotationAxis(
                part.axis === "z" ? s.axisZ : s.axisY,
                angle,
              );
              s.local.setPosition(pv[0], pv[1], pv[2]);
              s.matrix.multiplyMatrices(s.base, s.local);
              if (counters[i] < room) mesh.setMatrixAt(counters[i]++, s.matrix);
            });
          }
        }
      }
      if (marker.current && p.id === selected) {
        marker.current.visible = true;
        marker.current.position.copy(s.position);
        marker.current.quaternion.copy(camera.quaternion);
        // At least 12 px across, and never tighter than the airframe itself.
        const minimum =
          (distance * Math.tan((fov * Math.PI) / 360) * 12) /
          Math.max(1, size.height);
        marker.current.scale.setScalar(
          Math.max(minimum, p.shape === "fixed_wing" ? 1.4 : 0.6),
        );
      }
    });
    for (const id of lods.current.keys())
      if (!seen.has(id)) lods.current.delete(id);
    far.geometry.setDrawRange(0, farCount);
    farPos.needsUpdate = true;
    reviewMarks.points.visible = reviewMarks.lines.visible = review;
    reviewMarks.hidden.geometry.setDrawRange(0, hiddenCount);
    if (hiddenCount) hiddenPos.needsUpdate = true;
    reviewMarks.points.geometry.setDrawRange(0, reviewCount);
    reviewMarks.lines.geometry.setDrawRange(0, reviewCount * 2);
    if (review) dotPos.needsUpdate = stalkPos.needsUpdate = true;
    parts.forEach((_, i) => {
      const mesh = meshes.current[i];
      if (!mesh) return;
      uploadInstances(mesh, counters[i]);
    });
  });
  return (
    <group>
      {parts.map((part, i) => (
        <instancedMesh
          key={`${part.shape}-${part.lod}-${part.role}-${part.wing ?? 0}`}
          ref={(mesh) => {
            meshes.current[i] = mesh;
            if (mesh) {
              mesh.layers.set(LAYER);
              mesh.count = 0;
              mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
              // Instances span the whole scene; per-instance culling is not worth it.
              mesh.frustumCulled = false;
            }
          }}
          args={[
            part.geometry,
            materialFor(part),
            CAPACITY * (part.pivots?.length ?? 1),
          ]}
          material={materialFor(part)}
        />
      ))}
      <primitive object={far} />
      <primitive object={reviewMarks.lines} />
      <primitive object={reviewMarks.points} />
      <primitive object={reviewMarks.hidden} />
      <lineSegments
        ref={marker}
        visible={false}
        renderOrder={20}
        layers={LAYER}
      >
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[bracket, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          color="#8ed6ff"
          transparent
          depthTest={false}
          depthWrite={false}
          opacity={0.8}
        />
      </lineSegments>
    </group>
  );
}
