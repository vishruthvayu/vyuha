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
| Milestone commits | M1 `63a2a04` · M2 `b489741` · M3 `b7706cc` · M4 `868e0ed` · M5 `6c4518c` · env polish `59a4fac` · M6 `d4f18f8`, `df7de54`, `b403077` and later (see `PROGRESS.md` and `REPORT.md`) |
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
  A reported contact whose line of sight crosses decorative scenery is drawn as a
  hollow "behind scenery" marker, not as an airframe on the wall
  (`world/obstruction.ts`); its close-up says VIEW BLOCKED BY SCENERY.
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

### M3 — environment (pushed; see `PROGRESS.md`)
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

### M4–M6 (pushed; see `PROGRESS.md` and `REPORT.md`)
* M4: original airframes with LODs (`airframe-geometry.ts`), motion cues and attitude
  from the observed path (`ContactRenderer.tsx`), sensor-limited close-up
  (`InspectionPass.tsx`).
* M5: IR grain/vignette (CSS), resource release on rebuild.
* Env polish (`59a4fac`): HESCO cells, concertina coil, hangar ends, city-block
  podiums and balconies.
* M6: day sun heating and sky gradient in thermal, AAR overview markers,
  non-repeating ground, scenery line-of-sight markers, held HUD visibility, centred
  reticle, consistent small-target rendering, lamp glare, foliage edge fade; final
  benchmark matrices (NVIDIA and idle iGPU), soak, long run; two independent visual
  reviews; real-browser acceptance captures (external inherited evidence; final `ACCEPTANCE.md` pending).

## 6. What is left (in order)

Major implementation milestones are pushed. Final source-matched acceptance, report
reconciliation and the items below remain open; this is not yet an integration-ready claim.
In priority order:

1. **Owner decisions** (do not change without the owner):
   * automatic quality steps down only below 20 fps (`quality.ts`); on a busy shared
     iGPU, High and Medium can sit at 40–55 fps while an idle iGPU holds 60
     everywhere (`PROGRESS.md`, final benchmark);
   * the AAR overview fits only the active tracks (`scene-presentation.ts`, tested);
     including the protected asset would keep it in frame;
   * the AAR follow/observer presets fall back to Overview when the selected track
     has ended (product behaviour, stated in the UI).
2. **Art polish** found by the second review and not done:
   * observer camera framing on `/system/benchmark` and in the AAR (mostly ground);
   * the urban outpost reads as a base beside a few blocks rather than a town; more
     low buildings and walls would need care, because any decorative object above
     the 2 m sensor eye can stand between the sensor and a contact (it is then
     drawn as a "behind scenery" marker);
   * parked covered cars are identical and in a row (`layout.ts` props);
   * the same sky in both worlds; the rural far ridge is flat-shaded;
   * the red/white lattice mast beside the sensor fills part of some views;
   * cloud softness at 6× (sky texture resolution); per-face lattice-mast shadows;
   * fixed-wing panel lines, rotor blur fading with spin rate, bird texture.
3. **Validation on real hardware**: a drill on a physical laptop and phone, and a
   screen reader pass (not done here).
4. **Re-run after integration** (owner): full frontend tests with the backend
   parity venv, backend pytest, `tools/drill-rescue/bench.mjs` on the reference
   machine, `tools/drill-rescue/acceptance.mjs` (see `ACCEPTANCE.md`).

How to continue any item: §4 for running, `tools/drill-rescue/README.md` for the
harness, `PROGRESS.md` for the measured state. Commit to this branch only, push,
check the remote SHA, and record the change in `PROGRESS.md`.

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
* Tiled ground layers that look fine from the sensor repeat as a lattice from raised
  cameras (observer, overview, AAR). Check those views. An autocorrelation of a
  capture shows a clear peak at the tile period. Per-cell tile offsets from smooth
  noise (`materials.ts`) remove it.
* On this laptop the iGPU is shared with the desktop. For renderer-only numbers,
  switch the panel off (`kscreen-doctor --dpms off` on KDE Wayland) and run one
  benchmark at a time.
* To check a change without disturbing a run against port 8031, build into another
  folder (`npx vite build --outDir <dir>`) and serve it with `vite preview` on
  another port. Use a config whose `preview.proxy` sends `/api` to 8031.
* The HUD and the 3D view must read the same held observation
  (`ObservationVisibility`); otherwise a contact near a detection threshold makes
  the annotation flicker against the drawing.

## Ownership takeover — 17 October 2026

The user explicitly handed the drill branch to the hardening developer after the
previous developer stopped. Inherited uncommitted test/docs/report were backed up
outside Git before editing. The acceptance harness was recovered from the external
work directory. Pushed b403077 independently passes318 tests; the inherited sprite
regression makes319. The final report remains a draft until source-matched browser,
accessibility and performance checks complete. The missing-dist CI order is repaired
using the already verified hardening workflow, without merging application branches.
Inherited acceptance logs expose an AAR timeline accessible-name failure at both
widths; resolving and retesting it is part of this continuation.
