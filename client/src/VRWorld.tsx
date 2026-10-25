import { useCallback, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Environment } from "./world/Environment";
import { ContactRenderer } from "./ContactRenderer";
import { facilityLayout, withoutBoxes } from "./world/layout";
import { SceneryObstruction, sceneryObstacles } from "./world/obstruction";
import { ObservedPoseBuffer } from "./render-contacts";
import { ObservationVisibility, type Vision } from "./visibility";
import { vrRenderContacts, modernSensors } from "./vr";
import type { Scenario, Snapshot } from "./types";
import type { Quality } from "./quality";

/** XR uses native per-eye depth, not the browser's three monocular passes.
 * Three reserves layers 1/2 for eyes; modern meshes are normalized to shared
 * layer 0 inside THIS world only. Sensor occlusion occurs before projection;
 * decorative obstruction retains the same observed-position diamond fallback.
 * No follow camera, truth review, optical zoom or monocular inspection pass. */
export function VRWorld({
  state,
  scenario,
  vision,
  selected,
  context,
  quality,
}: {
  state: Snapshot;
  scenario: Scenario;
  vision: Vision;
  selected: string | null;
  context: string;
  quality: Quality;
}) {
  const root = useRef<THREE.Group>(null);
  const visibility = useRef(new ObservationVisibility());
  const contacts = vrRenderContacts(
    state,
    scenario,
    vision,
    visibility.current,
    context,
  );
  const poses = useMemo(() => new ObservedPoseBuffer(), []);
  const logicalTick = useCallback(() => poses.displayTick, [poses]);
  const terrain =
    scenario.terrain_id === "rural_forward_base"
      ? "rural_forward_base"
      : "urban_outpost";
  const boxes = useMemo(
    () => scenario.terrain_boxes ?? [],
    [scenario.terrain_boxes],
  );
  const obstruction = useMemo(() => {
    const o = new SceneryObstruction();
    o.set(sceneryObstacles(withoutBoxes(facilityLayout(terrain), boxes)));
    return o;
  }, [terrain, boxes]);
  useFrame((_, dt) => {
    poses.update(contacts, state.tick, context + ":" + vision);
    poses.forEachFrame(dt, () => {}, false);
    // Includes imperatively created marker objects and asynchronously loaded props.
    root.current?.traverse((o) => o.layers.set(0));
  }, -2);
  return (
    <group ref={root} name="observed-xr-world">
      <Environment
        sensorConfig={scenario.sensor_config}
        terrain={terrain}
        boxes={boxes}
        legacy={!modernSensors(scenario)}
        night={state.night}
        vision={vision}
        palette="white"
        quality={quality}
        fog={scenario.fog}
        logicalTick={logicalTick}
        reducedMotion={false}
        translucentOccluders={false}
      />
      <ContactRenderer
        poses={poses}
        vision={vision}
        palette="white"
        quality={quality}
        selected={contacts.some((t) => t.id === selected) ? selected : null}
        night={state.night}
        obstruction={obstruction}
      />
    </group>
  );
}
