# Research and asset selection

Date: 2026-10-16. Branch: `feature/vyuha-drill-experience-rescue` (from
`integration/vyuha-ultimate-finale` @ `db0ff23`).

"Inspected" below means the source was actually queried or read in this session.
API queries were made with `curl` / Python from the work folder (outside the
repository); results were saved there (`research/*.json`). Where a page could not be
fetched, that is stated.

## 1. Constraints that shaped every choice

* **Offline, local only.** Every runtime asset ships in the build and is precached by
  `scripts/offline.mjs`, which adds *every* file under `dist/`. The baseline `dist/`
  is 2.0 MB. Budget for new world and aircraft assets: **≤ 6 MB** on disk.
* **Redistribution.** The repository and the built bundle redistribute asset files in
  their original or converted form. Only licences that allow that are acceptable:
  CC0 or the team's own original work. CC-BY would be legally acceptable with
  attribution, but see 3.1 for why it was not used.
* **Hardware.** Owner's reference: MacBook Air M1, 8 GB, Medium tier. Local proxy for
  "modest": Intel Raptor Lake-S UHD (32 EU) through ANGLE/Mesa, which is weaker
  than the M1 GPU. Budgets for Medium at 1440 × 900 and 1× DPR: ≤ 150 draw calls,
  ≤ 400 k triangles, ≤ 64 MB of texture memory.
* **Hidden truth.** The renderer may only use `visual_shape` / `visual_level` from the
  observation. One generic multirotor must represent quad, no-RF FPV and friendly
  UAV. Real, recognisable products (a branded quadcopter, a named military UAV)
  would encode identity, so they are excluded regardless of licence.
* **Authoritative geometry.** Terrain boxes in a scenario are the sensor model's
  occluders. Scenery may dress them but must not create occlusion that the sensor
  does not model.

## 2. Environment, materials and lighting

### 2.1 Poly Haven — selected (CC0)

Inspected: `api.polyhaven.com/assets` (997 HDRIs, 869 textures, 521 models),
`/info/<id>` and `/files/<id>` for every selected asset, and the licence page
<https://polyhaven.com/license> — "You can use our assets for any purpose, including
commercial work", "You can redistribute them … include them when sharing your own
work", "You do not need to give credit or attribution". Every file has an API MD5,
which is recorded in the ledger.

**Skies.** The "pure skies" category (59 HDRIs with the ground removed) is exactly
what a sensor scene needs: our own terrain replaces the photographed ground.

| Asset | Why | Source size | Use |
|---|---|---|---|
| `kloofendal_48d_partly_cloudy_puresky` (Greg Zaal, Jarod Guest) | midday, partly cloudy, high contrast; the most-used pure sky (879 k downloads), so lighting response is well understood | 4K HDR 20.2 MB | day sky backdrop (tone-mapped LDR, upper hemisphere only), sun direction, PMREM environment |
| `qwantani_night_puresky` (Greg Zaal, Jarod Guest) | clear night, low contrast, stars | 2K HDR 5.3 MB | night sky for DAY TV at night (EO unavailable) |

Rejected skies: `kloppenheim_02_puresky` (high-contrast moon would read as a light
source in IR), all HDRIs with photographed ground (horizon would not match our
terrain), and using full HDR files at runtime (a 4K `.hdr` is 20 MB; a 1K one is too
soft as a visible backdrop at a 38° field of view).

**Textures** (all CC0, 1K unless noted, Diffuse + normal (GL) + roughness/AO):

| Asset | Real size of one tile | Use |
|---|---|---|
| `dry_ground_01` | 4 m | near-field dry earth (both terrains) |
| `aerial_ground_rock` (2K) | 20 m | macro layer that breaks tiling at range |
| `red_laterite_soil_stones` | 2 m | unpaved tracks and rural yard (laterite fits Indian plains) |
| `gravelly_sand` | 2.5 m | gravel apron around the sensor and shelters |
| `asphalt_02` | 3 m | access road, gate apron |
| `concrete_floor_worn_001` | 3 m | hardstands, helipad, pads |
| `concrete_wall_008` | 2.7 m | bunker and blast walls, urban facades |
| `beige_wall_001` | 3 m | plastered buildings (urban outpost, control building) |
| `corrugated_iron_02` | 2.7 m | hangar and shed cladding |
| `painted_metal_shutter` | 2 m | roller doors, containers |
| `sparse_grass` | 2 m | grass verges inside the perimeter |

**Models** (CC0, photoscans; all need decimation, from 1K glTF sources):

| Asset | Source triangles | Use |
|---|---|---|
| `concrete_road_barrier_02` | 42 578 | gate chicane, jersey barriers |
| `street_lamp_02` | 20 338 | facility lighting |
| `utility_box_02`, `power_box_01` | 6 268 / 21 272 | technical installations |
| `barrel_03` | 1 473 | fuel point |
| `wooden_crate_02` | 5 176 | storage area |
| `covered_car` | 12 592 | parked vehicles under covers |
| `namaqualand_boulder_02`, `_05` | 183 681 / 117 622 | terrain rocks (decimated) |
| `jacaranda_tree`, `island_tree_02` | 312 356 / 1 762 064 | baked into billboard impostors |
| `shrub_04`, `wild_rooibos_bush`, `dead_tree_trunk_02` | 47 813 / 76 521 / 155 864 | low vegetation impostors |

### 2.2 ambientCG — inspected, kept as the fallback

Inspected through `ambientcg.com/api/v2/full_json` (Ground103–112, Gravel043,
Asphalt031/033, Road007/008A/012A). CC0, good quality, comparable to Poly Haven.
Downloads are ZIPs only (1K JPG ZIP ≈ 9–10 MB, including displacement maps that are
not needed). Not used, to keep a single source and ledger; `Road007` is the
alternative if painted road markings are wanted as a texture.

### 2.3 Kenney — rejected for this purpose

<https://kenney.nl/assets/city-kit-industrial>: licence "Creative Commons CC0". The
3D kits are low-poly, flat-colour building blocks. The text fetch could not judge the
preview images, so this verdict rests on the published kit style, not a re-inspection.
CC0 is ideal, but the style is exactly the "assembled from toy blocks" look the
owner rejected.

### 2.4 Quaternius — rejected

<https://quaternius.com/license.html>: assets are now under the *Quaternius Asset
License v1.0*, which forbids redistributing the assets as assets. Shipping GLB files
in the repository and in an unpacked web bundle is that kind of redistribution. The
packs are also stylised (tags include "Ghibli", "Toon", "Cube World").

### 2.5 Blender — used for original work

Blender 5.2.2 LTS (installed). It is used, scripted in `bpy` and kept in the
repository's art-source folder, for:
* original airframes (multirotor, fixed-wing, bird) with close / medium / far LODs;
* the facility kit (bunker, control building, hangar, towers, shelters, fence, gate);
* decimating the Poly Haven photoscans;
* baking tree and shrub impostors.

It runs headless with `--factory-startup` and auto-run scripts disabled. Only glTF
and image files are imported; no downloaded `.blend` file is ever opened.

## 3. Aircraft sources

### 3.1 Sketchfab — inspected, rejected

Inspected through the public search API (`api.sketchfab.com/v3/search`,
`downloadable=true`) for "quadcopter", "dji drone", "fpv drone" and "fixed wing
uav". Of the 56 listed results: 44 CC-BY, 11 CC-BY-NC, 1 CC-BY-SA. Reasons for
rejection:

* **Identity leakage.** Most candidates replicate real, recognisable systems ("DJI
  FPV", "DJI Inspire 2", "Matrice 300 RTK", "Orlan-10", "ZALA 421", "Bayraktar …").
  A real product silhouette tells the trainee *which* aircraft it is, which the
  observation model cannot know. Trademark and design rights are a second problem.
* **Inconsistent style and cost.** 4 k to 904 k faces per model (e.g. "Quadcopter
  DJI Matrice 300 RTK" 904 053; "Dji FPV by SDC" 429 806), each from a different
  artist and material workflow.
* **Access.** Downloads need a logged-in account / API token. This project must not
  store such credentials, and a model fetched once by hand leaves no reproducible
  pipeline.
* NC and SA licences are incompatible with an unrestricted bundle.

### 3.2 BlenderKit — inspected, rejected

<https://www.blendkit.com/docs/licenses/>: "Royalty Free" allows commercial use but
"doesn't allow for re-sale of the asset in the same form"; CC0 assets exist but are
mixed in with RF ones. Downloading requires the BlenderKit add-on and an account.
The licence page does not cover shipping raw GLB files in a repository.

### 3.3 Poly Pizza — inspected, rejected

<https://poly.pizza/search/drone>: the results are low-poly ("Drone", "Stinger
Drone", "Predator Drone", "camera drone" …) under mixed CC0 / CC-BY 3.0, many from
the Google Poly archive. Too stylised, and the "Predator Drone" result is again a real
system.

### 3.4 CGTrader — inspected, rejected

<https://www.cgtrader.com/pages/terms-and-conditions>, Royalty Free licence:
"Products may not be sold, given, or assigned to another person or entity in the
form it is downloaded from the Site" (21A.1); the buyer must "take all commercially
reasonable measures to prevent the end user from gaining access to the Product"
(21A.3). A web bundle exposes the files, and a repository distributes them.

### 3.5 Decision

Author original airframes in Blender (§5). That gives one consistent style, exact
control of polygon budgets and LODs, rotor pivots built for animation, and full
rights. It also guarantees the hidden-truth boundary: there is exactly one generic
multirotor.

## 4. Rendering technology

| Source (inspected) | What it changes here |
|---|---|
| R3F *Performance pitfalls* (<https://r3f.docs.pmnd.rs/advanced/pitfalls>) | Never `setState` in `useFrame`; preallocate vectors; share geometry and materials through `useMemo`; keep components mounted and toggle `visible` instead of unmounting. A6 (rebuilt materials and instanced meshes) breaks the last two. |
| R3F *Scaling performance* (`docs/advanced/scaling-performance.mdx` in pmndrs/react-three-fiber; the docs site refused automated fetch) | Instancing ("no more than 1000 [draw calls] as the very maximum, and optimally a few hundred or less"); LOD through `<Detailed>` (a thin wrapper over `THREE.LOD`); `PerformanceMonitor` / DPR regression. The app already has its own FPS-sample quality regression (`qualityAfterSamples`); that stays. |
| three.js `LOD` (<https://threejs.org/docs/pages/LOD.html>) | `addLevel(object, distance, hysteresis)`; hysteresis avoids flicker at boundaries. `THREE.LOD` does not work per instance, so contacts get LOD selection per contact inside our own instanced renderer, with hysteresis. Static scenery uses distance-banded instanced meshes. |
| three.js `GLTFLoader` + `examples/jsm/libs/meshopt_decoder.module.js` | GLB loading with `EXT_meshopt_compression`, decoded by a WASM module that ships with three — no new npm dependency and no remote decoder. |
| glTF-Transform README / gltfpack README (meshoptimizer) | `meshopt` compression of geometry; `-tw` WebP or `-tc` KTX2 textures; three.js supports `EXT_meshopt_compression` after `setMeshoptDecoder`. |
| MDN *WebGL best practices* | Compile shaders before they are needed (`KHR_parallel_shader_compile`), upload textures before drawing, mipmaps for 3D textures ("only 30% overhead"), batch draws, compressed textures for colour only, and plan VRAM per pixel. |

Dependencies considered and **not** added:

* **drei** — `<Detailed>`, `useGLTF` and `<Sky>` are thin wrappers over three.js
  classes we can use directly; the package would add surface area for a few helpers.
* **postprocessing** — full-screen passes (bloom, SSAO) cost the most on iGPUs and
  are where the "neon game" look comes from. The few effects needed (haze, thermal
  grain, sensor-resolution limit) are done inside materials or with a cheap overlay.
* **KTX2 / Basis** — saves VRAM, but needs the Basis transcoder (~0.6 MB of WASM
  and JS) shipped and cached, plus a `toktx` / `basisu` toolchain that is not
  installed. With 1K WebP textures, mipmaps and an 11-material library, the texture
  memory estimate is ~45 MB, inside budget. Revisit if more materials are added.
* **Draco** — meshopt gives comparable size for these meshes, decodes faster, and its
  decoder already ships inside three.

## 5. Implementation strategy (what the research led to)

1. **Evidence-based camera.** The live camera stays at the sensor origin (the
   authoritative viewpoint). It aims at the selected contact's *displayed* pose
   while optically observed. Otherwise it aims at the contact's latest *reported*
   position from any sensor, as a radar cue slews a real EO/IR head. It never
   swings to a default sector while a contact is selected, and it is never remounted
   on sensor change.
2. **Interpolation, not chasing.** Positions are interpolated between observed samples
   on the logical clock, with a fixed one-sample render delay and no extrapolation.
   Heading, pitch and bank come from the interpolated path.
3. **Scenery cannot hide evidence.** Decorative scenery is drawn first. The depth
   buffer is then cleared and refilled with only the authoritative occluders (exact
   terrain boxes, depth-only) before contacts are drawn. A contact the sensor reports
   is therefore never hidden by a decorative tower, tree or fence, and is still
   hidden by an authoritative box. Building dressing stays inside each box's volume,
   so visual occlusion is always a subset of sensor occlusion.
4. **Terrain.** Flat ground (height exactly 0) inside 1.6 km of the sensor, which
   covers the full EO/IR range. Relief rises only beyond that, so hills are always
   behind every drawable contact. Ground uses multi-scale blended PBR layers with
   macro variation to hide tiling.
5. **Lighting.** Scene lighting follows the scenario's day/night state. Vision mode
   selects only the sensor rendering. Day: photographed sky, sun direction measured
   from the HDRI, PMREM environment, ACES tone mapping, soft sun shadows on High
   and a shortened cascade on Medium. Night EO: dark sky, facility lights, and an
   explicit "EO unavailable at night" state.
6. **Thermal appearance model.** Each surface class has an *apparent temperature
   index* (sky cold … motors and exhausts hot), mapped through the selected palette
   with texture-derived variation and IR-specific haze. It is documented as
   illustrative, never radiometric.
7. **Sensor-resolution inspection.** The close-up of a selected contact is rendered at
   the pixel count the EO/IR IFOV would put on target at the observed range, then
   upscaled. It cannot show detail the sensor could not resolve, and it is offered
   only when the observation level is *recognise* or better.
8. **Airframe LODs.** Close: ~3–6 k triangles with spinning rotors. Medium: ~300–800.
   Far: a minimum-pixel glint. All are instanced, with LOD hysteresis.

## 6. Training UX research

Inspected: NN/g *10 usability heuristics*
(<https://www.nngroup.com/articles/ten-usability-heuristics/>) and WCAG 2.2 SC 2.5.8
*Target Size (Minimum)* (24 × 24 CSS px, with spacing / equivalent / inline / user
agent / essential exceptions). The project already ships Radix-like hand-written
primitives and Lucide icons; Carbon, Radix and Motion were reviewed as pattern
references only, and no dependency was added.

How the heuristics map onto the baseline defects in `BASELINE-DEFECTS.md`:

| Heuristic | Baseline problem | Change |
|---|---|---|
| Visibility of system status | No acknowledgement after actions (E4, E5) | Submitted → accepted / not accepted → pending → resolved / no effect, from the worker and the public response state |
| Error prevention | Pre-selected "Quadcopter / Hostile" (E1) | No default answer; Confirm stays disabled until both choices are made |
| Recognition rather than recall | Bare dropdowns (E2) | Option cards with one-line descriptions, next to the evidence that bears on them |
| Help users recognise errors | Silent rejections, tooltip-only reasons (E4, E6) | Visible reason text, linked by `aria-describedby` |
| Aesthetic and minimalist design | Seven controls in one row (E6) | Show the current step; earlier steps collapse into a confirmed summary |
| User control and freedom | — | Guidance can be dismissed and is remembered per device |

Scored-training rule kept throughout: guidance explains **process** (what each
choice means, which evidence bears on it, which rule disables a control). It never
states which answer is correct.
