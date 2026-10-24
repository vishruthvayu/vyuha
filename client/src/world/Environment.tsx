import { diagnosticSpan } from "../diagnostics";
import { splatResources } from "./splat-preparation";
import { texturePreparationMode } from "./texture-preparation-mode";
import { createContactShading } from "./contact-shading";
import { memo, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { ThermalPalette } from "../presentation";
import type { Quality } from "../quality";
import type { TerrainBox } from "../sensors-v2";
import { FOLIAGE, PROP_URLS, SKY, TEXTURE_URLS } from "./assets";
import {
  Batches,
  buildFacility,
  cityBlock,
  frame,
  warehouse,
  type MaterialKey,
} from "./kit";
import {
  facilityLayout,
  withoutBoxes,
  type FacilityLayout,
  type Placement,
  type PropModel,
  type Species,
} from "./layout";
import {
  MATERIAL_THERMAL,
  ThermalTwins,
  createFoliageMaterial,
  createGroundMaterial,
  createKitMaterials,
  setGroundMode,
  type Mode,
  type WorldTextures,
} from "./materials";
import {
  createChainLinkTexture,
  createHescoTexture,
  createLightPoolTexture,
  createSplatTexture,
  createWhiteTexture,
} from "./procedural-textures";
import {
  THERMAL_CLASSES,
  displayThermal,
  thermalColor,
  type ThermalClassName,
} from "./thermal";
import { createTerrainGeometry, type TerrainKind } from "./terrain";
import { displayVisibility } from "./displayVisibility";

export const LAYER_WORLD = 0;
export const LAYER_CONTACTS = 1;
export const LAYER_OCCLUDERS = 2;

function useWorldTextures(quality: Quality, layout: FacilityLayout) {
  const flat = useMemo(() => Object.values(TEXTURE_URLS).flat(), []);
  const loaded = useLoader(THREE.TextureLoader, flat);
  const { gl } = useThree();
  // Suspend before allocating GPU textures: retries share a finite CPU resource,
  // and the scene is revealed only after the exact map is ready.
  const splat =
    texturePreparationMode(
      typeof window === "undefined" ? "" : window.location.search,
    ) === "chunked"
      ? splatResources.read({
          terrain: layout.terrain,
          resolution: quality === "low" ? 512 : 1024,
        })
      : undefined;
  return useMemo(() => {
    const finish = diagnosticSpan("world_textures");
    const byUrl = new Map(flat.map((u, i) => [u, loaded[i]]));
    const anisotropy = Math.min(
      gl.capabilities.getMaxAnisotropy(),
      quality === "high" ? 8 : quality === "medium" ? 4 : 1,
    );
    const tex = (u: string, color: boolean) => {
      const t = byUrl.get(u)!;
      t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = anisotropy;
      t.needsUpdate = true;
      return t;
    };
    const set = (urls: string[]) => ({
      albedo: tex(urls[0], true),
      normal: urls[1] ? tex(urls[1], false) : undefined,
      orm: urls[2] ? tex(urls[2], false) : undefined,
    });
    const vegetation = tex(TEXTURE_URLS.vegetation[0], true);
    vegetation.wrapS = vegetation.wrapT = THREE.ClampToEdgeWrapping;
    const textures: WorldTextures = {
      groundDry: set(TEXTURE_URLS.groundDry),
      groundMacro: tex(TEXTURE_URLS.groundMacro[0], true),
      laterite: set(TEXTURE_URLS.laterite),
      gravel: set(TEXTURE_URLS.gravel),
      grass: tex(TEXTURE_URLS.grass[0], true),
      asphalt: set(TEXTURE_URLS.asphalt),
      concreteFloor: set(TEXTURE_URLS.concreteFloor),
      concreteWall: set(TEXTURE_URLS.concreteWall),
      plaster: set(TEXTURE_URLS.plaster),
      corrugated: set(TEXTURE_URLS.corrugated),
      paintedMetal: set(TEXTURE_URLS.paintedMetal),
      vegetation,
      hesco: createHescoTexture(),
      chainLink: createChainLinkTexture(),
      white: createWhiteTexture(),
      splat: createSplatTexture(layout, quality === "low" ? 512 : 1024, splat),
    };
    finish();
    return textures;
  }, [flat, loaded, gl, quality, layout, splat]);
}

/** Ribbon along a centreline with metric UVs (u across, v along). */
function ribbon(path: [number, number][], width: number, y: number) {
  const pos: number[] = [],
    uv: number[] = [];
  let along = 0;
  for (let i = 1; i < path.length; i++) {
    const [x0, z0] = path[i - 1],
      [x1, z1] = path[i];
    const len = Math.hypot(x1 - x0, z1 - z0);
    const nx = (-(z1 - z0) / len) * (width / 2),
      nz = ((x1 - x0) / len) * (width / 2);
    const a = [x0 + nx, y, z0 + nz],
      b = [x0 - nx, y, z0 - nz],
      c = [x1 + nx, y, z1 + nz],
      d = [x1 - nx, y, z1 - nz];
    pos.push(...a, ...b, ...c, ...b, ...d, ...c);
    const v0 = along,
      v1 = along + len;
    uv.push(0, v0, width, v0, 0, v1, width, v0, width, v1, 0, v1);
    along = v1;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  // Ribbons are built facing down for one winding; force normals up.
  const n = g.getAttribute("normal") as THREE.BufferAttribute;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  return g;
}
/** Flip any triangle of a flat ground-level geometry that faces down. */
function faceUp(g: THREE.BufferGeometry) {
  const geo = g.index ? g.toNonIndexed() : g;
  const p = geo.getAttribute("position") as THREE.BufferAttribute;
  const uv = geo.getAttribute("uv") as THREE.BufferAttribute | undefined;
  const a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i);
    b.fromBufferAttribute(p, i + 1);
    c.fromBufferAttribute(p, i + 2);
    const ny = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z);
    if (ny < 0)
      for (const attr of [p, uv]) {
        if (!attr) continue;
        for (let k = 0; k < attr.itemSize; k++) {
          const t = attr.getComponent(i + 1, k);
          attr.setComponent(i + 1, k, attr.getComponent(i + 2, k));
          attr.setComponent(i + 2, k, t);
        }
      }
  }
  geo.computeVertexNormals();
  return geo;
}
function polygon(points: [number, number][], y: number) {
  const shape = new THREE.Shape(
    points.map(([x, z]) => new THREE.Vector2(x, -z)),
  );
  const g = new THREE.ShapeGeometry(shape);
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  const p = g.getAttribute("position") as THREE.BufferAttribute;
  const uv = g.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i), p.getZ(i));
  return g;
}

/** Two crossed side cards (+ an optional top card) for one plant species. */
function foliageGeometry(species: Species) {
  const f = FOLIAGE[species];
  const parts: THREE.BufferGeometry[] = [];
  f.sides.forEach((cell, i) => {
    const g = new THREE.PlaneGeometry(cell.width_m, cell.height_m);
    g.translate(0, cell.height_m / 2, 0);
    if (i) g.rotateY(Math.PI / 2);
    parts.push(g);
  });
  if (f.top) {
    const g = new THREE.PlaneGeometry(f.top.width_m, f.top.height_m);
    g.rotateX(-Math.PI / 2);
    g.translate(0, f.height * 0.72, 0);
    parts.push(g);
  }
  const cellsFor = [...f.sides, ...(f.top ? [f.top] : [])];
  parts.forEach((g, i) => {
    const [u0, v0, u1, v1] = cellsFor[i].uv;
    const uv = g.getAttribute("uv") as THREE.BufferAttribute;
    for (let k = 0; k < uv.count; k++)
      uv.setXY(k, u0 + uv.getX(k) * (u1 - u0), v0 + uv.getY(k) * (v1 - v0));
    // Soft, mostly-up normals: cards light like foliage, not like walls.
    const n = g.getAttribute("normal") as THREE.BufferAttribute;
    for (let k = 0; k < n.count; k++) {
      const v = new THREE.Vector3(
        n.getX(k) * 0.35,
        0.95,
        n.getZ(k) * 0.35,
      ).normalize();
      n.setXYZ(k, v.x, v.y, v.z);
    }
  });
  const merged = new THREE.BufferGeometry();
  const all = parts.map((g) => g.toNonIndexed());
  const count = all.reduce((s, g) => s + g.getAttribute("position").count, 0);
  for (const attr of ["position", "normal", "uv"]) {
    const size = attr === "uv" ? 2 : 3;
    const arr = new Float32Array(count * size);
    let o = 0;
    for (const g of all) {
      const a = g.getAttribute(attr).array as Float32Array;
      arr.set(a, o);
      o += a.length;
    }
    merged.setAttribute(attr, new THREE.BufferAttribute(arr, size));
  }
  parts.forEach((g) => g.dispose());
  all.forEach((g) => g.dispose());
  return merged;
}

function instanceMatrices(items: Placement[]) {
  return items.map((p) => {
    const scale = "scale" in p ? p.scale : 1;
    return new THREE.Matrix4().compose(
      new THREE.Vector3(p.x, 0, p.z),
      new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        "rot" in p ? p.rot : 0,
      ),
      new THREE.Vector3(scale, scale, scale),
    );
  });
}

type Built = {
  group: THREE.Group;
  /** Meshes whose material is swapped for the thermal palette, with their class. */
  swappable: { mesh: THREE.Mesh; eo: THREE.Material; cls: ThermalClassName }[];
  dispose: () => void;
};

export type EnvironmentProps = {
  terrain: TerrainKind;
  boxes: readonly TerrainBox[];
  /** Pre-0.4 scenarios have no authoritative boxes; scenery is decorative only. */
  legacy: boolean;
  night: boolean;
  vision: "thermal" | "day" | "night";
  palette: ThermalPalette;
  quality: Quality;
  fog: number;
  /** AAR external cameras show authoritative dressing translucent. */
  translucentOccluders: boolean;
  logicalTick: () => number;
  reducedMotion: boolean;
};

export const Environment = memo(function Environment(props: EnvironmentProps) {
  const { terrain, boxes, legacy, quality } = props;
  // Resolve every later asset read before allocating procedural textures. An
  // initial suspension discards memo caches; constructing first repeated this
  // expensive work on each GLTF/sky loading retry.
  const props3d = useLoader(GLTFLoader, Object.values(PROP_URLS));
  const [skyDay, skyNight] = useLoader(THREE.TextureLoader, [
    SKY.day,
    SKY.night,
  ]);
  const layout = useMemo(() => {
    const base = withoutBoxes(facilityLayout(terrain), boxes);
    if (!legacy || terrain !== "urban_outpost") return base;
    // Legacy scenarios: a decorative skyline well outside the compound.
    return base;
  }, [terrain, boxes, legacy]);
  const textures = useWorldTextures(quality, layout);
  const { gl, scene } = useThree();

  const built = useMemo<Built>(() => {
    const finish = diagnosticSpan("world_build");
    const group = new THREE.Group();
    group.name = "vyuha-environment";
    const swappable: Built["swappable"] = [];
    const disposables: { dispose: () => void }[] = [];
    const kit = createKitMaterials(textures, quality);
    Object.values(kit).forEach((m) => disposables.push(m));
    const shadows = quality !== "low";
    const addMesh = (
      geometry: THREE.BufferGeometry,
      material: THREE.Material,
      cls: ThermalClassName,
      opts: { cast?: boolean; receive?: boolean; name?: string } = {},
    ) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = shadows && (opts.cast ?? true);
      mesh.receiveShadow = shadows && (opts.receive ?? true);
      mesh.name = opts.name ?? "";
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
      swappable.push({ mesh, eo: material, cls });
      disposables.push(geometry);
      return mesh;
    };
    // One inexpensive EO-only batch. No shadow decals enter thermal imagery.
    if (quality !== "low") {
      const shade = createContactShading(layout);
      group.add(shade.mesh);
      disposables.push(shade);
    }
    // Terrain.
    const ground = createGroundMaterial(textures, quality, terrain, false);
    const groundThermal = createGroundMaterial(
      textures,
      quality,
      terrain,
      true,
    );
    disposables.push(
      ground,
      groundThermal,
      textures.splat,
      textures.hesco,
      textures.chainLink,
      textures.white,
    );
    const terrainMesh = new THREE.Mesh(
      createTerrainGeometry(terrain, quality === "low" ? 0.6 : 1),
      ground,
    );
    terrainMesh.receiveShadow = shadows;
    terrainMesh.matrixAutoUpdate = false;
    terrainMesh.name = "terrain";
    terrainMesh.userData.thermalMaterial = groundThermal;
    terrainMesh.userData.eoMaterial = ground;
    group.add(terrainMesh);
    disposables.push(terrainMesh.geometry);
    // Paved surfaces.
    const paved = new Map<MaterialKey, THREE.BufferGeometry[]>();
    for (const s of layout.surfaces) {
      const key: MaterialKey | null =
        s.kind === "asphalt"
          ? "asphalt"
          : s.kind === "concrete"
            ? "concreteFloor"
            : null;
      if (!key) continue;
      const g = faceUp(
        s.width !== undefined
          ? ribbon(s.path, s.width, 0.03)
          : polygon(s.path, key === "concreteFloor" ? 0.05 : 0.03),
      );
      const n = g.getAttribute("position").count;
      g.setAttribute(
        "color",
        new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3),
      );
      paved.set(key, [...(paved.get(key) ?? []), g]);
    }
    for (const [key, raw] of paved) {
      const list = raw.map((g) => (g.index ? g.toNonIndexed() : g));
      const merged = new THREE.BufferGeometry();
      const count = list.reduce(
        (s, g) => s + g.getAttribute("position").count,
        0,
      );
      for (const attr of ["position", "normal", "uv", "color"]) {
        const size = attr === "uv" ? 2 : 3;
        const arr = new Float32Array(count * size);
        let o = 0;
        for (const g of list) {
          const src = g.getAttribute(attr).array as Float32Array;
          arr.set(src, o);
          o += src.length;
        }
        merged.setAttribute(attr, new THREE.BufferAttribute(arr, size));
      }
      raw.forEach((g) => g.dispose());
      list.forEach((g) => g.dispose());
      const material =
        key === "concreteFloor" ? kit.concreteFloor.clone() : kit.asphalt;
      if (key === "concreteFloor") {
        material.polygonOffset = true;
        material.polygonOffsetFactor = -2;
        material.polygonOffsetUnits = -2;
        disposables.push(material);
      }
      addMesh(merged, material, MATERIAL_THERMAL[key], {
        cast: false,
        name: `surface-${key}`,
      });
    }
    // Facility architecture: one merged mesh per material.
    const facility = buildFacility(layout.placements, layout.lines);
    for (const [key, geometry] of facility.merged())
      addMesh(geometry, kit[key], MATERIAL_THERMAL[key], {
        cast: key !== "fence" && key !== "marking",
        name: `facility-${key}`,
      });
    // Authoritative occluders: dressing inside each box, plus exact depth proxies.
    const dressing = new Batches();
    boxes.forEach((b, i) => {
      if (terrain === "rural_forward_base")
        warehouse(
          dressing,
          (b.x_min + b.x_max) / 2,
          (b.z_min + b.z_max) / 2,
          b.x_max - b.x_min,
          b.z_max - b.z_min,
          b.height,
        );
      else cityBlock(dressing, b, i * 7 + 3);
    });
    for (const [key, geometry] of dressing.merged()) {
      const material = kit[key].clone();
      material.userData.occluderDressing = true;
      disposables.push(material);
      addMesh(geometry, material, MATERIAL_THERMAL[key], {
        name: `occluder-${key}`,
      });
    }
    const proxyMaterial = new THREE.MeshBasicMaterial({ colorWrite: false });
    disposables.push(proxyMaterial);
    for (const b of boxes) {
      const g = new THREE.BoxGeometry(
        b.x_max - b.x_min,
        b.height,
        b.z_max - b.z_min,
      );
      const proxy = new THREE.Mesh(g, proxyMaterial);
      proxy.position.set(
        (b.x_min + b.x_max) / 2,
        b.height / 2,
        (b.z_min + b.z_max) / 2,
      );
      proxy.updateMatrix();
      proxy.matrixAutoUpdate = false;
      proxy.layers.set(LAYER_OCCLUDERS);
      proxy.name = "occluder-depth";
      group.add(proxy);
      disposables.push(g);
    }
    // Instanced props (decimated CC0 scans).
    const byModel = new Map<PropModel, Placement[]>();
    for (const p of layout.placements)
      if (p.kind === "prop")
        byModel.set(p.model, [...(byModel.get(p.model) ?? []), p]);
    const models = Object.keys(PROP_URLS) as PropModel[];
    models.forEach((model, i) => {
      const items = byModel.get(model);
      if (!items?.length) return;
      const matrices = instanceMatrices(items);
      props3d[i].scene.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        const material = o.material as THREE.MeshStandardMaterial;
        material.envMapIntensity = 0.7;
        const im = new THREE.InstancedMesh(
          o.geometry,
          material,
          matrices.length,
        );
        matrices.forEach((m, k) =>
          im.setMatrixAt(k, m.clone().multiply(o.matrixWorld)),
        );
        im.castShadow = shadows;
        im.receiveShadow = shadows;
        im.computeBoundingSphere();
        im.name = `prop-${model}`;
        group.add(im);
        swappable.push({
          mesh: im,
          eo: material,
          cls: model.startsWith("boulder")
            ? "concrete"
            : model === "covered-car"
              ? "fabric"
              : "paintedMetal",
        });
      });
    });
    // Vegetation cards.
    const foliage = createFoliageMaterial(textures);
    disposables.push(foliage);
    const bySpecies = new Map<Species, Placement[]>();
    const density = quality === "low" ? 0.45 : quality === "medium" ? 0.8 : 1;
    layout.placements.forEach((p, i) => {
      if (p.kind !== "plant") return;
      if (((i * 2654435761) >>> 0) / 4294967296 > density) return;
      bySpecies.set(p.species, [...(bySpecies.get(p.species) ?? []), p]);
    });
    for (const [species, items] of bySpecies) {
      const geometry = foliageGeometry(species);
      disposables.push(geometry);
      const im = new THREE.InstancedMesh(geometry, foliage, items.length);
      instanceMatrices(items).forEach((m, k) => im.setMatrixAt(k, m));
      im.castShadow = shadows;
      im.receiveShadow = false;
      im.computeBoundingSphere();
      im.name = `plants-${species}`;
      group.add(im);
      swappable.push({ mesh: im, eo: foliage, cls: "vegetation" });
    }
    // Night light pools under lamps (additive, EO at night only).
    const poolTexture = createLightPoolTexture();
    const poolMaterial = new THREE.MeshBasicMaterial({
      map: poolTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -6,
      polygonOffsetUnits: -6,
      opacity: 0.85,
    });
    disposables.push(poolTexture, poolMaterial);
    const lamps = layout.placements.filter((p) => p.kind === "lightPole");
    const poolGeometry = new THREE.PlaneGeometry(26, 26).rotateX(-Math.PI / 2);
    disposables.push(poolGeometry);
    const pools = new THREE.InstancedMesh(
      poolGeometry,
      poolMaterial,
      Math.max(1, lamps.length),
    );
    lamps.forEach((p, k) =>
      pools.setMatrixAt(
        k,
        new THREE.Matrix4().makeTranslation(
          p.x + Math.sin(p.rot) * 4,
          0.06,
          p.z + Math.cos(p.rot) * 4,
        ),
      ),
    );
    pools.count = lamps.length;
    pools.name = "night-light-pools";
    pools.visible = false;
    group.add(pools);
    // The luminaires themselves at night: a soft additive glare at each head,
    // world-sized so it shrinks with distance. Lights the scene, never contacts.
    const heads: number[] = [];
    for (const p of lamps) {
      if (p.kind !== "lightPole") continue;
      const c = Math.cos(p.rot),
        sn = Math.sin(p.rot);
      for (const lx of [-0.6, 0.6])
        heads.push(p.x + lx * c + 0.62 * sn, 8.62, p.z - lx * sn + 0.62 * c);
    }
    const glowGeometry = new THREE.BufferGeometry();
    glowGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(heads, 3),
    );
    const glowMaterial = new THREE.PointsMaterial({
      map: poolTexture,
      color: "#fff3da",
      size: 2.6,
      sizeAttenuation: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    });
    disposables.push(glowGeometry, glowMaterial);
    const glow = new THREE.Points(glowGeometry, glowMaterial);
    glow.name = "night-lamp-glow";
    glow.visible = false;
    group.add(glow);
    finish();
    return {
      group,
      swappable,
      dispose: () => {
        disposables.forEach((d) => d.dispose());
        // Instanced meshes own their instance-matrix buffers (shared prop
        // geometry from the loader cache is intentionally kept).
        group.traverse((o) => {
          if (o instanceof THREE.InstancedMesh) o.dispose();
        });
      },
    };
  }, [textures, quality, terrain, layout, boxes, props3d]);
  useEffect(() => () => built.dispose(), [built]);

  // Radar head: rotates once per sweep (logical time), cosmetic only.
  const radar = useMemo(() => {
    const p = layout.placements.find((q) => q.kind === "radarMast");
    if (!p || p.kind !== "radarMast") return null;
    const b = new Batches();
    b.add(
      "paint",
      new THREE.BoxGeometry(2.6, 1.1, 0.16),
      frame(0, 0.55, 0.1),
      [0.92, 0.92, 0.9],
    );
    b.add(
      "paint",
      new THREE.BoxGeometry(0.3, 0.6, 0.3),
      frame(0, -0.1, 0),
      [0.4, 0.42, 0.43],
    );
    const geometry = b.merged().get("paint")!;
    return { x: p.x, z: p.z, y: p.h + 0.85, geometry };
  }, [layout]);
  const radarMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.4,
        metalness: 0.2,
      }),
    [],
  );
  useEffect(() => () => radar?.geometry.dispose(), [radar]);
  useEffect(() => () => radarMaterial.dispose(), [radarMaterial]);
  const radarRef = useRef<THREE.Mesh>(null);

  // Sky dome and sun.
  const sun = SKY.meta.skies["sky-day"].sun.direction as number[];
  const skyYaw = -2.35; // rotate the photographed sky so the sun stands south-west
  const sunDirection = useMemo(
    () =>
      new THREE.Vector3(sun[0], sun[1], sun[2])
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), skyYaw)
        .normalize(),
    [sun],
  );
  const skyGeometry = useMemo(() => {
    const below = (SKY.meta.below_horizon_deg * Math.PI) / 180;
    const g = new THREE.SphereGeometry(
      15000,
      64,
      24,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2 + below,
    );
    g.rotateY(skyYaw);
    return g;
  }, []);
  const skyMaterials = useMemo(() => {
    for (const t of [skyDay, skyNight]) {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 1; // smooth sky; anisotropic taps cost fill rate for nothing
    }
    return {
      day: new THREE.MeshBasicMaterial({
        map: skyDay,
        side: THREE.BackSide,
        fog: false,
        toneMapped: false,
        depthWrite: false,
      }),
      // The night photograph keeps a town glow; dimmed so the ground lights dominate.
      night: new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.3, 0.3, 0.3),
        map: skyNight,
        side: THREE.BackSide,
        fog: false,
        toneMapped: false,
        depthWrite: false,
      }),
    };
  }, [skyDay, skyNight]);
  useEffect(
    () => () => {
      skyGeometry.dispose();
      skyMaterials.day.dispose();
      skyMaterials.night.dispose();
    },
    [skyGeometry, skyMaterials],
  );
  const skyRef = useRef<THREE.Mesh>(null);

  // PMREM environment from the photographed sky (reflections on glass/metal).
  const envMaps = useMemo(() => {
    const finish = diagnosticSpan("environment_reflections");
    const pmrem = new THREE.PMREMGenerator(gl);
    // The sky images stop 5 degrees below the horizon; rebuild a full equirect
    // (sky on top, ground colour below) so reflections see ground below them.
    const make = (t: THREE.Texture, ground: string) => {
      const c = document.createElement("canvas");
      c.width = 512;
      c.height = 256;
      const g = c.getContext("2d")!;
      g.fillStyle = ground;
      g.fillRect(0, 0, 512, 256);
      const rows = (256 * (90 + SKY.meta.below_horizon_deg)) / 180;
      g.drawImage(t.image as CanvasImageSource, 0, 0, 512, rows);
      const full = new THREE.CanvasTexture(c);
      full.colorSpace = THREE.SRGBColorSpace;
      full.mapping = THREE.EquirectangularReflectionMapping;
      const rt = pmrem.fromEquirectangular(full);
      full.dispose();
      return rt;
    };
    const maps = {
      day: make(skyDay, "#6e6150"),
      night: make(skyNight, "#0a0a09"),
    };
    pmrem.dispose();
    finish();
    return maps;
  }, [gl, skyDay, skyNight]);
  useEffect(
    () => () => {
      envMaps.day.dispose();
      envMaps.night.dispose();
    },
    [envMaps],
  );

  const twins = useMemo(() => new ThermalTwins(sunDirection), [sunDirection]);
  useEffect(() => () => twins.dispose(), [twins]);
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);

  const mode: Mode = useMemo(
    () => ({
      night: props.night,
      thermal:
        props.vision === "thermal"
          ? props.palette
          : props.vision === "night"
            ? "night"
            : null,
    }),
    [props.night, props.vision, props.palette],
  );

  // Apply the display mode: thermal twins, emissive night lighting, fog, sky,
  // environment lighting. No material is rebuilt, so switching never recompiles
  // after the first warm-up (see the effect below).
  useLayoutEffect(() => {
    const thermal = mode.thermal;
    for (const s of built.swappable) {
      s.mesh.material = thermal ? twins.get(s.eo, s.cls) : s.eo;
      if (!thermal && s.eo instanceof THREE.MeshStandardMaterial) {
        const lit = s.eo.emissive && s.eo.emissive.getHex() !== 0;
        if (lit)
          s.eo.emissiveIntensity = mode.night
            ? s.cls === "lamp"
              ? 3
              : 1.15
            : 0;
      }
      if (s.eo.userData.occluderDressing) {
        const m = s.mesh.material as THREE.Material;
        m.transparent = props.translucentOccluders;
        m.opacity = props.translucentOccluders ? 0.35 : 1;
        m.depthWrite = !props.translucentOccluders;
      }
    }
    twins.update(mode);
    const terrainMesh = built.group.getObjectByName("terrain") as THREE.Mesh;
    const groundThermal = terrainMesh.userData
      .thermalMaterial as THREE.Material;
    if (thermal) setGroundMode(groundThermal, mode);
    terrainMesh.material = thermal
      ? groundThermal
      : (terrainMesh.userData.eoMaterial as THREE.Material);
    const contactShade = built.group.getObjectByName(
      "foundation-contact-shading",
    );
    if (contactShade) contactShade.visible = !thermal;
    const pools = built.group.getObjectByName("night-light-pools");
    if (pools) pools.visible = !thermal && mode.night;
    const glow = built.group.getObjectByName("night-lamp-glow");
    if (glow) glow.visible = !thermal && mode.night;
    const sky = skyRef.current;
    if (sky) {
      const eo = mode.night ? skyMaterials.night : skyMaterials.day;
      sky.material = thermal ? twins.get(eo, "sky") : eo;
    }
    twins.update(mode);
    const visibility = displayVisibility(props.fog) * (thermal ? 1 / 0.45 : 1);
    const density = 1.6 / visibility;
    const fogColor = thermal
      ? thermalColor(
          displayThermal(
            THERMAL_CLASSES.terrainFar[mode.night ? "night" : "day"] - 0.04,
            mode.night,
          ),
          thermal,
        )
      : mode.night
        ? new THREE.Color("#121515")
        : new THREE.Color("#a3a7b2"); // measured sky colour 1° above the horizon
    scene.fog = new THREE.FogExp2(fogColor.getHex(), density);
    gl.setClearColor(fogColor);
    scene.environment = thermal
      ? null
      : mode.night
        ? envMaps.night.texture
        : envMaps.day.texture;
    scene.environmentIntensity = mode.night ? 0.25 : 0.65;
    if (sunRef.current) {
      sunRef.current.intensity = thermal ? 0 : mode.night ? 0.12 : 2.6;
      sunRef.current.color.set(mode.night ? "#9fb4d6" : "#fff2dc");
      sunRef.current.castShadow = !thermal && !mode.night && quality !== "low";
    }
    if (hemiRef.current) {
      hemiRef.current.intensity = thermal ? 0 : mode.night ? 0.06 : 0.55;
      hemiRef.current.color.set(mode.night ? "#33445e" : "#d6e2ec");
      hemiRef.current.groundColor.set(mode.night ? "#0e0d0b" : "#5d5240");
    }
    gl.shadowMap.needsUpdate = true;
  }, [
    built,
    mode,
    twins,
    skyMaterials,
    envMaps,
    scene,
    gl,
    props.fog,
    props.translucentOccluders,
    quality,
  ]);
  useEffect(
    () => () => {
      scene.fog = null;
      scene.environment = null;
    },
    [scene],
  );

  // Warm up every material variant once, so the first sensor switch does not
  // compile shaders mid-exercise (baseline A6).
  const { camera } = useThree();
  useEffect(() => {
    const warm = new THREE.Scene();
    const quadG = new THREE.PlaneGeometry(1, 1);
    const all = [
      ...built.swappable.map((s) => s.eo),
      ...built.swappable.map((s) => twins.get(s.eo, s.cls)),
      (built.group.getObjectByName("terrain") as THREE.Mesh).userData
        .thermalMaterial as THREE.Material,
      twins.get(skyMaterials.day, "sky"),
      twins.get(skyMaterials.night, "sky"),
    ];
    for (const m of new Set(all)) warm.add(new THREE.Mesh(quadG, m));
    warm.fog = scene.fog;
    // Synchronous on purpose: this runs once while the scene loads, not mid-drill.
    gl.compile(warm, camera, scene);
    quadG.dispose();
  }, [built, twins, gl, camera, scene, skyMaterials]);

  useFrame(({ camera: cam }) => {
    if (skyRef.current) skyRef.current.position.copy(cam.position);
    if (radarRef.current) {
      const turns = props.reducedMotion ? 0 : props.logicalTick() / 30;
      radarRef.current.rotation.y = (turns % 1) * Math.PI * 2;
    }
  });

  return (
    <>
      <mesh
        ref={skyRef}
        geometry={skyGeometry}
        material={skyMaterials.day}
        renderOrder={-10}
        frustumCulled={false}
      />
      <primitive object={built.group} />
      {radar && (
        <mesh
          ref={radarRef}
          geometry={radar.geometry}
          position={[radar.x, radar.y, radar.z]}
          material={radarMaterial}
        />
      )}
      <hemisphereLight
        ref={hemiRef}
        args={["#d6e2ec", "#5d5240", 0.55]}
        onUpdate={(l) => l.layers.enableAll()}
      />
      <ambientLight intensity={0.06} onUpdate={(l) => l.layers.enableAll()} />
      <directionalLight
        ref={sunRef}
        position={sunDirection.clone().multiplyScalar(400).toArray()}
        intensity={2.6}
        color="#fff2dc"
        castShadow={quality !== "low"}
        shadow-mapSize={quality === "high" ? [2048, 2048] : [1024, 1024]}
        shadow-camera-left={-170}
        shadow-camera-right={170}
        shadow-camera-top={170}
        shadow-camera-bottom={-170}
        shadow-camera-near={10}
        shadow-camera-far={900}
        shadow-bias={-0.0006}
        shadow-normalBias={0.04}
        onUpdate={(l) => l.layers.enableAll()}
      />
    </>
  );
});
