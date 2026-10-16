import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createAirframeParts } from "./airframe-geometry";
import { palettes, type ThermalPalette } from "./presentation";
import type { Quality } from "./quality";
import {
  wingAngle,
  type ObservedPoseBuffer,
  type RenderShape,
} from "./render-contacts";
import type { Vision } from "./visibility";

/** All instances share original procedural geometry. Only observation-scoped descriptors enter. */
export function ContactRenderer({
  poses,
  vision,
  palette,
  quality,
  selected,
  reducedMotion = false,
}: {
  /** Shared with the camera rig; advanced once per frame before either reads it. */
  poses: ObservedPoseBuffer;
  vision: Vision;
  palette: ThermalPalette;
  quality: Quality;
  selected: string | null;
  reducedMotion?: boolean;
}) {
  const parts = useMemo(() => createAirframeParts(quality), [quality]);
  const meshes = useRef<(THREE.InstancedMesh | null)[]>([]);
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
  // Fixed capacity: re-creating instanced meshes when the count crossed a power of
  // two caused allocation and upload spikes (baseline A6).
  const [capacity, setCapacity] = useState(256);
  const counters = useMemo(() => new Uint32Array(parts.length), [parts]);
  const indices = useMemo(() => {
    const result = new Map<RenderShape, number[]>();
    parts.forEach((part, i) =>
      result.set(part.shape, [...(result.get(part.shape) ?? []), i]),
    );
    return result;
  }, [parts]);
  const scratch = useMemo(
    () => ({
      position: new THREE.Vector3(),
      rotation: new THREE.Quaternion(),
      euler: new THREE.Euler(),
      scale: new THREE.Vector3(1, 1, 1),
      base: new THREE.Matrix4(),
      matrix: new THREE.Matrix4(),
      wing: new THREE.Matrix4(),
    }),
    [],
  );
  const materials = useMemo(() => {
    // Appearance assumptions only. Never read hidden type, identity, RF or reference heat.
    if (vision === "thermal") {
      const color = palettes[palette].hot;
      return {
        body: new THREE.MeshBasicMaterial({ color }),
        trim: new THREE.MeshBasicMaterial({ color }),
        rotor: new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
        }),
      };
    }
    const night = vision === "night";
    return {
      body: new THREE.MeshStandardMaterial({
        color: night ? "#a0c7ae" : "#b3bdc2",
        roughness: 0.58,
        metalness: 0.24,
      }),
      trim: new THREE.MeshStandardMaterial({
        color: night ? "#658c76" : "#303d46",
        roughness: 0.45,
        metalness: 0.32,
      }),
      rotor: new THREE.MeshStandardMaterial({
        color: night ? "#91b99c" : "#73808a",
        roughness: 0.8,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    };
  }, [vision, palette]);
  useEffect(() => () => parts.forEach((p) => p.geometry.dispose()), [parts]);
  useEffect(
    () => () => Object.values(materials).forEach((m) => m.dispose()),
    [materials],
  );

  useFrame(({ camera, size }) => {
    counters.fill(0);
    if (marker.current) marker.current.visible = false;
    let count = 0;
    poses.each((p) => {
      count++;
      scratch.position.set(p.displayX, p.displayY, p.displayZ);
      scratch.rotation.setFromEuler(scratch.euler.set(0, p.displayHeading, 0));
      scratch.base.compose(scratch.position, scratch.rotation, scratch.scale);
      for (const i of indices.get(p.shape) ?? []) {
        const mesh = meshes.current[i];
        if (!mesh) continue;
        scratch.matrix.copy(scratch.base);
        const side = parts[i].wing;
        if (side)
          scratch.matrix.multiply(
            scratch.wing.makeRotationZ(
              side * (reducedMotion ? 0 : wingAngle(p.id, poses.displayTick)),
            ),
          );
        if (counters[i] < capacity)
          mesh.setMatrixAt(counters[i]++, scratch.matrix);
      }
      if (marker.current && p.id === selected) {
        marker.current.visible = true;
        marker.current.position.copy(scratch.position);
        marker.current.quaternion.copy(camera.quaternion);
        const distance = camera.position.distanceTo(scratch.position);
        const minimum =
          camera instanceof THREE.PerspectiveCamera
            ? (distance * Math.tan((camera.fov * Math.PI) / 360) * 12) /
              Math.max(1, size.height)
            : 0;
        marker.current.scale.setScalar(
          Math.max(p.shape === "fixed_wing" ? 3 : 1.5, minimum),
        );
      }
    });
    if (count > capacity) setCapacity(2 ** Math.ceil(Math.log2(count)));
    parts.forEach((_, i) => {
      const mesh = meshes.current[i];
      if (!mesh) return;
      mesh.count = counters[i];
      mesh.instanceMatrix.needsUpdate = true;
      // Instanced bounds must follow observed world positions, not the local airframe origin.
      mesh.computeBoundingSphere();
    });
  });
  return (
    <group>
      {parts.map((part, i) => (
        <instancedMesh
          key={`${part.shape}-${part.layer}-${part.wing ?? 0}`}
          ref={(mesh) => {
            meshes.current[i] = mesh;
            if (mesh) {
              mesh.layers.set(1);
              mesh.count = 0;
              mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            }
          }}
          args={[part.geometry, materials[part.layer], capacity]}
        />
      ))}
      <lineSegments ref={marker} visible={false} renderOrder={20} layers={1}>
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
