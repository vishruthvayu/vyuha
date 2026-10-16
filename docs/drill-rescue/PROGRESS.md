# Drill experience rescue — progress

Branch `feature/vyuha-drill-experience-rescue`, created from
`integration/vyuha-ultimate-finale` @ `db0ff23` (verified head on 2026-10-16; 287/287
frontend tests pass there). Integration is owner-controlled: this branch is never
merged into the integration branch by this work.

## File ownership (proposed to the integration owner)

| Area | Files | Status |
|---|---|---|
| 3D presentation (owned here) | `Scene.tsx`, `ContactRenderer.tsx`, `airframe-geometry.ts`, `render-contacts.ts`, `surface-textures.ts`, `scene-presentation.ts`, new `client/src/world/**`, new art sources under `art/` | changed here |
| Trainee decision UX (owned here) | `DecisionWorkspace.tsx`, new `GuidedDecision*.tsx`, the decision dock section of `App.tsx`, `premium/training.css` | changed here |
| Shared, additive only | `sim.worker.ts` (one extra `rejected` message; no change to simulation semantics), `presentation.ts` (labels only) | coordinate before merge |
| Not touched | `sim*.ts`, `sensors-v2.ts`, `response-v2.ts`, `visibility.ts` semantics, `types.ts`, `server/**`, scoring, replay, parity fixtures | — |

At the time of branching, the newest commit touching any renderer file was the
integration merge itself (`db0ff23` / `75cc97f`). The engine branch
(`feature/vyuha-engine-closure` @ `ea641a2`) had only documentation commits after
the merge, so no conflicting renderer work was in flight.

## Milestones

| # | Milestone | State |
|---|---|---|
| 1 | Audit, baseline, research | done — `BASELINE-DEFECTS.md`, `RESEARCH-AND-ASSET-SELECTION.md`, `bench/` |
| 2 | Guided trainee workflow + evidence-based camera / interpolation fixes | done — see below |
| 3 | Environment upgrade | done — pushed `b7706cc` |
| 4 | Aircraft upgrade | done — see below |
| 5 | Camera, sensors, polish | in progress — sensor close-up done (below) |
| 6 | Final validation | planned |

## Milestone 2 — guided workflow, camera and motion fixes

What changed:

* **Guided decision dock** (`GuidedDecision.tsx`). Steps Select → Designate →
  Classify → Respond → Outcome, one at a time:
  * no pre-selected answer: Confirm stays disabled with a visible reason until a
    type and an identity are chosen (fixes E1);
  * option cards with one-line definitions; the evidence that bears on each choice
    (camera shape and level, control link, IFF) sits beside its legend (E2);
  * effector cards show the engine's own reach (`engagementRule` maximum, applied
    to the reported position), the restricted zone, rounds, channels and cooldown
    (E3);
  * every action is acknowledged: submitted → accepted at T / not accepted with a
    reason (E4). `sim.worker.ts` now also emits `rejected` (additive; simulation
    semantics unchanged);
  * outcomes come from the public response state: pending, took effect, no
    observable effect, blocked (E5);
  * a dismissable Guidance line explains process per step, remembered per device;
  * "Nearest undesignated contact" / "Next contact" is a selection convenience
    only.
* **Evidence-based camera** (`camera-view.ts`, `Scene.tsx`). Track the displayed
  pose; otherwise slew to the latest reported position (radar cue, shown as an amber
  dashed ring); otherwise hold the bearing. It never returns to the default sector
  while a contact is selected, and is no longer remounted on sensor change (A1, A3,
  B1). Slews use spherical interpolation at about 150°/s.
* **Interpolation instead of chasing** (`render-contacts.ts`). Each observed sample
  starts a linear segment of about one sample interval from the displayed position
  (A4). The camera and the model read the same pose buffer, which a `PoseDriver`
  advances once per frame before both (A5).
* Fixed instanced-mesh capacity (no re-creation at power-of-two counts, part of
  A6). The asset box is lowered below the sensor's eye line (A2).
* View annotations say what the camera is doing: TRACKING, CUED BY RADAR · NOT SEEN
  BY THIS CAMERA, or NO CURRENT REPORT · HOLDING BEARING. DAY TV states when it has
  no picture (night or fault).

Measured on the built app (Chrome, Intel UHD, port 8031):

| Check | Baseline `db0ff23` | Milestone 2 |
|---|---|---|
| Display speed of a constant 15 m/s contact | mean 14.97, SD 8.75, min 3.6, max 32.0 m/s | mean 15.0, SD 0.25 (1.3 with ±12 ms delivery jitter), min 13.0, max 17.2 |
| Tracking burst, mean frame difference | up to 103 (camera swings) | 0.05–0.12 |
| Sensor switch, first frames | 23.6, 11.1 (re-swing) | 1.6, 1.5 (contact motion only) |
| axe WCAG 2.0–2.2 A/AA, live dock at every step (1440 and 390) | — | 0 violations |
| Frontend tests | 287 | 301 (14 new) |

Screenshots: `screenshots/m2/`.

## Milestone 3 — environment

What changed (details and file map in `HANDOFF.md` §5):

* **Sky and light.** Photographed Poly Haven pure-sky backdrops (day, and night with
  stars). The day sun direction is measured from the HDR (47.9° elevation). The
  environment map is rebuilt from the sky with ground below. FogExp2 haze comes from
  the scenario fog value (display only). Lighting follows the scenario's night state;
  the vision mode only chooses EO or IR rendering (fixes B2).
* **Terrain.** Exactly flat to 1 700 m (beyond EO/IR range), relief rings out to
  14 km. The ground is blended world-space PBR (dry earth at two scales, aerial
  macro layer, splat-mapped laterite tracks, patchy gravel and grass from the
  layout) instead of a flat plane and grid (C1).
* **Base.** Original procedural kit (`world/kit.ts`):
  - **urban outpost:** two-storey control building, arched hangar, office and storage
    containers, four watchtowers, radar mast (head turns once per radar sweep,
    from logical time), comms mast, generator, fuel tanks, helipad, floodlights,
    gatehouse with boom and jersey-barrier chicane, perimeter fence with barbed wire,
    HESCO blast walls, sandbagged C2 bunker under the sensor mast;
  - **rural forward base:** tents, a hamlet beyond the depot, groves;
  - plus decimated CC0 props (barrels, crates, covered vehicles, utility boxes,
    jersey barriers, boulders) and CC0 tree and shrub impostors (C2–C4).
* **Authoritative boxes.** Urban boxes are dressed as mid-rise blocks with windows,
  floor bands, parapets and roof plant; the rural box as a gable-roof depot. Dressing
  is always inside the box, and the box itself is drawn as a depth-only proxy.
* **Scenery never hides evidence.** Three-pass `LayeredRender`:
  1. world;
  2. clear depth, then authoritative occluders depth-only;
  3. contacts.
  The static shadow map renders once.
* **Night EO.** Dark scene with lit windows, floodlight pools and town glow.
  DAY TV at night says it has no picture.
* **Thermal.** An illustrative per-surface apparent-temperature model with day/night
  values and a fixed display range (like imager gain). Cold sky, warm asphalt by day,
  cold metal roofs and lit windows at night. White-hot, black-hot, amber and the IR
  night display; no material is recompiled when switching (all variants are compiled
  at load). Fixes B3.
* **Assets.** 2.6 MB in total, all CC0 or original (`ASSET-PROVENANCE.md`). The CC0
  notice ships in `dist/licenses/`.
* **Benchmark page.** A World selector (urban/rural × day/night with the raid boxes).

Tests: `world.test.ts` (6) covers:
* flat ground within optical range and upward-facing terrain;
* scenery clear of occluders and below the sensor eye line;
* dressing inside its boxes;
* merged batches with a thermal class for every material;
* thermal range bounds;
* haze monotonic with fog.

Frontend total: 307/307.

Screenshots: `screenshots/m3/` (before/after pairs, thermal day, AAR overview, drill
page).

### Milestone 3 performance (measured, not hidden)

Method: `/system/benchmark`, 20 s per cell, first 3 s discarded, 1 267 × 400 canvas,
rAF intervals and draw calls from an injected probe. **GPU ms** is the median GPU time
per frame from `EXT_disjoint_timer_query_webgl2` (`tools/drill-rescue/gpu-timer.js`).
Rows are in `bench/m3-igpu.jsonl` (new world, urban day, EO) and `bench/m3-nvidia.jsonl`.
The baseline rows in `m3-igpu.jsonl` are the old renderer's default benchmark scene,
which is all the old build offers.

Intel UHD 770 iGPU, shared with the desktop (KDE, Xwayland, VS Code and a desktop
browser also render on it):

| Trainee camera | Baseline: fps / GPU ms | New world: fps mean / 1 % low / GPU ms |
|---|---|---|
| Low, 8 / 50 / 200 contacts | 60 / 0.36 | 59.1–59.2 / 27–30 / 2.0–2.5 (8.4 at 200) |
| Medium, 8 / 50 / 200 | 60 / 0.53 | 50.9–54.1 / 27–30 / 2.9–3.0 |
| High, 8 / 50 / 200 | 58.7–59.5 / 1.1 | 38.6–39.2 / 18–20 / 7.3–11.8 |

NVIDIA RTX 5060 Laptop (idle GPU): every tier, both cameras, 8–200 contacts: 60 fps,
1 % low 59.5 (one warm-up row lower).

Reading:

* The new world costs about 2.5 ms more GPU per frame at Medium: 35–47 draw calls and
  ~115–137 k triangles, against 6–11 draw calls and < 8 k triangles before.
* On a dedicated GPU that is invisible. On this shared iGPU, about 10 % of frames take
  12–15 ms of GPU, so Medium misses vsync and averages ~50–54 fps; Low holds ~59.
  The light baseline did not show those spikes, so they are not purely desktop
  contention. The cause is still open; see `HANDOFF.md`.
* High uses a 1.5× pixel ratio and soft shadows; it is not meant for iGPUs.
* **Tradeoff today:** integrated-GPU users should pick Low (or Medium at ~50 fps).
  Automatic quality only steps down below 20 fps; that policy is unchanged.

### Independent review of M3 (fresh reviewer agent, screenshots only)

Fixed after the review:
* dimmer night town glow;
* window glass now cool in thermal (glass is opaque in long-wave IR);
* trees no longer black in day thermal;
* khaki rather than terracotta ground;
* fog colour matched to the sky's horizon (removes the pale seam);
* irregular sandbags;
* foliage halos removed (colour bleed in the atlas);
* varied plaster tints on the city blocks.

Still open:
* no per-face sun heating in day thermal;
* HESCO is a textured box, not modelled cells;
* fence has no concertina wire;
* hangar back wall plain;
* shadow detail of lattice masts;
* AAR overview too high to read the base;
* no sensor noise or vignetting;
* city blocks lack balconies and low buildings between them.

## Milestone 4 — aircraft (+ the M5 sensor close-up)

* **Original airframes** (`airframe-geometry.ts`), real proportions:
  - **generic multirotor**, 0.82 m motor to motor: rounded hull and canopy, battery
    bay, carbon arms, motor mounts and bells, two-blade pitched props, skids,
    gimbal ball and lens;
  - **fixed-wing**, 2.4 m span: lathed fuselage, tapered high wing with dihedral,
    tail, pusher motor pod, camera ball;
  - **bird**, 0.95 m: lathed body, head, beak, fan tail, fingered wings hinged at
    the shoulder;
  - **unresolved blob**.
  Each has a close and a medium level of detail. Every vertex carries an
  illustrative heat index: motors and engines hot, battery bay warm, structure
  ambient.
* **Renderer** (`ContactRenderer.tsx`):
  - one instanced batch per shape/LOD/part;
  - LOD chosen per contact by projected size, with 25 % hysteresis;
  - contacts under 3 px become fixed-size point markers;
  - props spin and show blur discs; bird wings flap; all driven by logical time and
    static under reduced motion;
  - multirotors tilt into travel and bank in turns; fixed wings and birds bank with
    turn rate and pitch with climb. Attitude comes only from the displayed
    (observed) path.
  - Thermal: a per-vertex heat shader on the selected palette and display range.
* **Hidden truth.** The airframe depends only on the observed silhouette class. There
  is exactly one multirotor for quad, no-RF FPV and friendly UAV. LOD depends only on
  projected size. Tests: `render-contacts.test.ts` ("Airframe choice depends only on
  the observed silhouette…"), `guided-decision.test.tsx` (dock invariance).
* **Sensor-limited close-up (M5)** (`InspectionPass.tsx`). For the selected contact
  at observation level *recognise* or *identify*, a 168 px inset (top right of the
  live view) shows it at the pixel count the sensor actually puts on target:
  - pixel count = span / (range × IFOV), using `eo_ifov_rad` / `ir_ifov_rad` from
    `sensors-v2.json`;
  - rendered 4× supersampled, box-filtered to that resolution, then enlarged
    nearest-neighbour;
  - captioned, e.g. "EO CLOSE-UP · 24 PX ON TARGET · 280 M".
  It can never show detail the sensor could not resolve, and it is not shown in
  reference-truth review.
* The C2 bunker is lowered to a 1 m bermed structure, and the foreground sandbag ring
  is replaced by a short entrance wall, so rear bearings stay open (review item).

Measured (`bench/m4.jsonl`, urban day, EO):
* NVIDIA: 60 fps, 1 % low 59.5 at Medium and High, 8 and 200 contacts, both cameras.
* Intel iGPU (run alone): Low 59.9–60, Medium 53.6–57.6 at trainee 8/200.
* Draw calls 35–41 and ~108–120 k triangles, unchanged from M3: at these distances
  the airframes are mostly far markers.

Tests: 310/310 (new: airframe structure and silhouette invariance, LOD hysteresis,
pixels-on-target maths, attitude bounds).

Screenshots: `screenshots/m4/`:
* EO and IR close-ups at 24–142 px on target;
* a 2.4 m fixed-wing at 141 m in the 6× main view;
* the IR pusher motor hot against cooler wings.
