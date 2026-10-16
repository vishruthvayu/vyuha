# Drill experience rescue — handoff

This is the document to read first if you are picking this work up. It says what
exists, how to run and measure it, what is left, and how to finish. It is updated at
every milestone; the state below is current as of the commit that last touched it.

## 1. Mission in one paragraph

Make the live VYUHA drill a convincing, smooth, guided 3D counter-drone trainer
without changing simulation, scoring, sensor truth or offline behaviour. That means a
believable base and terrain, recognisable aircraft with levels of detail, sensible
lighting and night/IR, no visual glitches, and a trainee flow where the next action is
always obvious. The full brief is the owner's "ULTIMATE 3D REALISM & TRAINING
EXPERIENCE TRANSFORMATION" prompt. Its non-negotiables are in §3.

## 2. Where things are

| Item | Value |
|---|---|
| Branch | `feature/vyuha-drill-experience-rescue` (push only here; never force-push; no tags; never merge into integration or release branches) |
| Base | `integration/vyuha-ultimate-finale` @ `db0ff23` |
| Milestone commits | M1 `63a2a04` · M2 `b489741` · M3 see `PROGRESS.md` |
| Unpushed work | If `PROGRESS.md` does not list a milestone as pushed, its work in progress is uncommitted in the local worktree `/home/naveen/vyuha-drill-rescue` on the owner's machine (`git status` there). |
| Docs | `docs/drill-rescue/` — `BASELINE-DEFECTS.md`, `RESEARCH-AND-ASSET-SELECTION.md`, `PROGRESS.md`, `ASSET-PROVENANCE.md` (from M3), this file |
| Browser harness | `tools/drill-rescue/` (README inside) |
| Art pipeline | `art/` (Python + headless Blender scripts that regenerate every committed asset) |
| Runtime world code | `client/src/world/` |

## 3. Rules that must not be broken

* **Hidden truth.** Rendering may use only observation fields: `visual_level`,
  `visual_shape` (`bird` / `fixed_wing` / `multirotor`), observed positions and public
  state. One generic multirotor stands for quad, no-RF FPV and friendly UAV. Never read
  `kind`, `identity`, `rf` or `engagementRule(...).effective/success` for anything the
  trainee sees. The test `guided-decision.test.tsx` → "hidden kind, identity and RF
  truth cannot change what the dock shows" guards the dock; add an equivalent for
  airframes in M4.
* **Authoritative geometry.** Scenario `terrain_boxes` are the only sensor occluders.
  Box dressing must stay inside each box (`kit.ts` → `cityBlock`, `warehouse`). Terrain
  is exactly flat inside `FLAT_RADIUS` (1 700 m, beyond EO/IR range). Decorative
  scenery can never hide a reported contact, because of the layered render in
  `Scene.tsx`:
  1. world;
  2. clear depth, then draw the box proxies depth-only;
  3. contacts.
* **No new simulation semantics.** Engine files (`sim*.ts`, `sensors-v2.ts`,
  `response-v2.ts`, `visibility.ts`, `types.ts`, `server/**`) are untouched. The single
  shared edit is additive: `sim.worker.ts` also posts `{type:'rejected'}`. Flag it to
  the integration owner.
* **Offline.** All assets ship in the build; `scripts/offline.mjs` precaches all of
  `dist/`. Do not add CDNs or remote decoders. World asset budget: ≤ 6 MB (now ≈ 2.7 MB).
* **Licences.** Only CC0 (Poly Haven) or original assets. No Sketchfab, BlenderKit,
  CGTrader or Quaternius files (reasons in the research doc). Never open downloaded
  `.blend` files. Import glTF and images only.
* **Credentials.** The officer password lives only in a file in the work folder (mode
  600). Pass the file path; never print it or commit it.
* **Honesty.** Report measured numbers, including bad ones. Do not call WIP done.

## 4. Running it

```bash
# one-time
git worktree add -b <branch> <dir> origin/feature/vyuha-drill-experience-rescue   # or clone
cd <dir>/client && npm ci
# server + built client (creates .venv, asks for an officer password on first run)
bash scripts/start-local.sh --port 8031
# tests (backend parity needs the venv)
cd client && VYUHA_TEST_PYTHON=../.venv/bin/python npm test && npm run lint && npm run format:check
npx prettier --check "src/world/*.ts" "src/world/*.tsx" src/GuidedDecision.tsx src/camera-view.ts
```

After a client change, run `npm run build` in `client/`; the running server serves the
new `dist/` immediately.

Real-browser checks use headless Chrome over CDP. `tools/drill-rescue/README.md`
covers flags, the scripts and their arguments. Two instances were used:
* `--remote-debugging-port=9351`, normal vsync: the user experience;
* `9352` with `--disable-gpu-vsync --disable-frame-rate-limit`: GPU headroom, read
  from the app's own FPS.

The GPU is shared with the desktop, so run every benchmark twice; one run was an
outlier at about −20 fps.

Library scenarios for night and rural acceptance must be authored as an officer:
`node tools/drill-rescue/author-scenarios.mjs http://127.0.0.1:8031 <password-file>`.
Those are legacy-engine (v1) scenarios. Adaptive drills are v2 (`vyuha-0.4.0`), urban,
and night only when the Director focuses on degraded sensors. `/system/benchmark` now
has a **World** selector (urban/rural × day/night, with the raid occluder boxes) and is
the quickest way to look at any terrain/time/sensor/camera combination
(`tools/drill-rescue/world-shot.mjs`).

## 5. What is done

### M1 — audit (pushed)
Baseline reproduction, root causes and benchmark: `BASELINE-DEFECTS.md`,
`bench/baseline-*.jsonl`, `screenshots/baseline/`.

### M2 — guided workflow + glitch fixes (pushed)
* `GuidedDecision.tsx`: step dock, no pre-selected answer, option cards with
  definitions, evidence beside each choice, effector eligibility from
  `engagementRule` maximum/inRange/restricted on the *reported* position, public
  resources, acknowledgement, and outcome from `state.response.attempts`.
* `App.tsx`: feedback state, guidance toggle (`localStorage['vyuha.guidance']`),
  next-contact helper, honest camera annotations.
* `camera-view.ts`: `liveCameraMode` (track → cue → hold → sector) and `ViewBlend`
  (slerp, ~150°/s).
* `render-contacts.ts`: `ObservedPoseBuffer` segment interpolation (`SEGMENT_STRETCH`
  1.15), `displayTick` for cosmetic animation, `pose()` / `each()`.
* `Scene.tsx`: `PoseDriver` advances poses before the camera; `CameraRig` rewritten;
  `CueMarker`.
* Tests: `guided-decision.test.tsx` (14 tests).

### M3 — environment (see `PROGRESS.md` for whether it has been pushed)
* `world/terrain.ts`: flat disc + relief rings; `terrainHeight` is 0 inside 1 700 m.
* `world/layout.ts`: urban outpost and rural forward base layouts (pure data),
  `withoutBoxes`, `placementHeight`, `SENSOR_CLEARING`.
* `world/kit.ts`: procedural architecture with metric UVs and vertex tints, merged per
  material (`Batches`). Pieces: building, hangar, container, watchtower, masts,
  genset, fuel, helipad, lamps, gatehouse, boom, tent, house, warehouse, bunker,
  sensor mast, fence/HESCO/sandbag lines, `cityBlock` (box dressing with windows).
* `world/materials.ts`: PBR kit materials; Lambert ground shader (world-space
  multi-scale blending + canvas splat map); foliage; `ThermalTwins`.
* `world/thermal.ts`: illustrative thermal classes (day/night index, variation),
  palettes including the IR night display, `createThermalMaterial` (`toneMapped:false`).
* `world/procedural-textures.ts`: splat map, HESCO, chain-link, light pools.
* `world/Environment.tsx`: loads assets (Suspense), builds the world, sky dome (the
  photographed sky rotated by `skyYaw`), sun from the HDRI, PMREM from a
  reconstructed equirect, FogExp2 from scenario fog, mode switching without
  recompiles (warm-up compile at load), radar head rotation from logical time, night
  light pools, occluder depth proxies (layer 2).
* `Scene.tsx`: `LayeredRender` (the three passes; static shadow map;
  `gl.info.autoReset=false`); the camera far plane is 20 km.
* `art/`: `process_sky.py`, `process_textures.py`, `blender_props.py`,
  `blender_impostors.py`, `build_vegetation_atlas.py`. Sources are listed in
  `tools/drill-rescue/ph-spec.json` and downloaded by `ph-download.py`, which writes
  a ledger with MD5s.

## 6. What is left (in order)

### M3 finish
1. **Performance on Medium.** Measured on the Intel UHD iGPU at a ~1 268 × 400
   canvas:
   - Low ≈ 59–60 fps;
   - Medium ≈ 43–54 fps (noisy; 4× MSAA alone costs ~7 fps);
   - High ≈ 38–40 fps.

   The GPU is fill-rate bound. Options already tried: branching ground layers, PCF
   instead of PCF-soft shadows on Medium, Lambert ground, ground normals only on
   High, sky anisotropy 1. Next candidates:
   - drop the broad second macro sample;
   - render Medium without MSAA but with FXAA (`three/addons/postprocessing`, no new
     package);
   - reduce foliage overdraw (alphaTest cards);
   - verify that `gl.render` ×3 does not re-sort/re-upload;
   - measure on the NVIDIA dGPU as an upper bound, by starting Chrome with
     `__NV_PRIME_RENDER_OFFLOAD=1 __GLX_VENDOR_LIBRARY_NAME=nvidia`.

   Record a clear tradeoff in `PROGRESS.md` if Medium cannot reach 60 on this iGPU.
   The owner's reference machine is an M1, roughly 3× this GPU.
2. Visual fixes: corrugated metal too dark (lower metalness ~0.35, lighter tint),
   sandbags too dark, check the night EO and thermal looks (`world-shot.mjs` with
   `night` / `thermal`), check the AAR overview/observer/follow cameras.
3. Tests (new `world.test.ts`):
   - terrain height is 0 inside `FLAT_RADIUS`;
   - no placement intersects the boxes after `withoutBoxes`;
   - only items ≤ 1.6 m inside `SENSOR_CLEARING`;
   - `cityBlock` / `warehouse` geometry stays inside its box (check the merged
     bounding box of a `Batches` built for one box);
   - every kit material key has a thermal class;
   - `displayVisibility` is monotonic.
4. `docs/drill-rescue/ASSET-PROVENANCE.md` from `art/*.json`, the download ledger and
   `client/src/world/assets/{props,vegetation,textures,sky}.json`. Also ship
   `client/public/licenses/POLYHAVEN-CC0.txt`; `public/` is copied to `dist/` and
   precached.
5. Before/after screenshots into `docs/drill-rescue/screenshots/m3/`; full
   test/lint/format/build; commit and push; update `PROGRESS.md` and this file.

### M4 — aircraft
* Author original models in Blender with a new `art/blender_airframes.py`:
  - **generic multirotor:** body shell, 4 arms, motor bells, 2-blade props as separate
    nodes, skids, small gimbal ball; ~0.7 m span;
  - **fixed-wing:** lofted fuselage, tapered wings, V or H tail, pusher prop; ~2.4 m
    span;
  - **bird:** body plus two wing halves hinged at the shoulder;
  - LOD0 ~3–6 k triangles, LOD1 ~400–800, LOD2 ~60, plus a minimum-pixel glint for
    far contacts. Export GLB (no textures, or one small atlas; vertex colours are
    fine) into `client/src/world/assets/`.
* Replace `airframe-geometry.ts` / `ContactRenderer.tsx` internals:
  - instanced per LOD and part, LOD chosen per contact by projected size with
    hysteresis;
  - rotor discs spin from `poses.displayTick` (static blur discs under reduced motion);
  - attitude from `RenderPose.velocity*` / `yawRate`: multirotor pitch with speed and
    bank with yaw rate; fixed-wing bank with turn rate.
* Thermal: per-part classes (`motor` hot, `airframeWarm` battery bay, `feathers` for
  birds) via `ThermalTwins`. Night EO: contacts are dark silhouettes (no artificial
  light).
* Keep `renderContacts` descriptor tests. Add a test that the airframe chosen for a
  contact depends only on `shape` (and LOD on distance), never on kind or identity.
* Fixed capacity is already in place; keep it.

### M5 — camera and sensors
* Sensor-resolution inspection inset:
  - for the selected contact at observation level `recognise` or `identify`, render a
    small view at the pixel count the EO/IR IFOV gives at the observed range
    (`eo_ifov_rad`/`ir_ifov_rad` in `sensors-v2.json`), then upscale it;
  - label it with "observed at <range>, <level>".
* Radar picture and track list already share the selection; add a matching accent on
  the 3D reticle.
* Thermal grain overlay (CSS, static under reduced motion).
* Verify sensor switch, zoom and observation loss with `switch-burst.mjs`, and
  tracking at 6× with the burst analysis in `guided-drill.mjs`.

### M6 — final validation
* Benchmark matrix for both builds: 8/25/50/100/200 × Low/Medium/High × trainee/overview
  with `bench.mjs`, twice each, on world `urban_outpost:day` and
  `rural_forward_base:night`. Include uncapped headroom.
* Long session: the 180 s benchmark plus a full drill; watch the JS heap and
  `gl.info.memory` for leaks after repeated sensor switches and quality changes.
* Acceptance screenshots for the 17 states in the brief, at 1440 and 390.
* axe on every guided step at both widths; keyboard walk through the dock.
* Independent visual review: ask a fresh reviewer agent to list what still looks
  prototype-like, then fix the major findings.
* Final `docs/drill-rescue/REPORT.md`: SHA, before/after images, benchmarks, asset
  sizes, licences, hidden-truth verification, tradeoffs, outstanding issues, and
  integration notes. Integration notes cover the worker change, possible conflicts
  in `App.tsx` / `Scene.tsx` / `training.css`, and that the owner should rerun
  parity/history tests after merging.

## 7. Gotchas met so far

* Headless Chrome needs `Page.bringToFront` before screenshots.
  `captureBeyondViewport` resizes the layout, so later clicks miss. Use plain
  viewport screenshots when clicking afterwards.
* three.js flips double-sided normals on back faces. Foliage cards override
  `normal_fragment_begin`.
* Check triangle winding of hand-built geometry. The terrain and hangar roof were
  initially inverted and back-face culled, which showed as a pale ground.
* Vite inlines assets under 4 KB as data URLs. That is fine.
* `new URL(\`./assets/${name}\`, import.meta.url)` works in Vite (glob-like).
* R3F: a `useFrame` with priority > 0 takes over rendering. `LayeredRender` uses
  priority 1. Lights are on all layers (`layers.enableAll()`), or contacts render
  unlit.
* Thermal materials must be `toneMapped:false`, or ACES shifts palette colours.
* The adaptive Director almost never picks rural. Use the benchmark World selector or
  officer-authored library scenarios.
