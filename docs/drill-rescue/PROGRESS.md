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
| 4 | Aircraft upgrade | done — pushed `868e0ed` |
| 5 | Camera, sensors, polish | done — close-up in `868e0ed`, IR treatment and resource release in `6c4518c` |
| 6 | Final validation | in progress — see below |

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

## Milestone 5 — polish (`6c4518c`)

* The legacy night-vision canvas filter (`style.css`: sepia + hue-rotate +
  saturate) tinted the in-shader IR palette a second time; it is removed for the
  live views. IR views get a faint static detector grain and a lens vignette; EO a
  light vignette. CSS only; nothing animates.
* Resource release on world rebuild: instanced meshes and the per-build white
  texture.

## Milestone 6 — validation (in progress)

* **Soak** (`tools/drill-rescue/soak.mjs`): a live drill with 12 cycles of
  THERMAL / IR / DAY TV and High / Low / Medium switching plus re-selection. Live
  WebGL objects: buffers 251→257, textures 55→59, framebuffers 6→8. JS heap after
  forced GC stays near 41 MB. Programs grow 78→121 as three.js caches shader
  variants across 33 forced quality changes.
* **Long session** (`tools/drill-rescue/longrun.mjs`, `bench/longrun-nvidia-urban-day.json`):
  180 s, 200 contacts, Medium, urban day, NVIDIA:
  - median 60 fps, 5th percentile 60 (one 24 fps sample);
  - simulation tick median 0.5 ms, p95 1 ms;
  - textures 51 and buffers 251, constant for the whole run;
  - heap oscillates with GC and does not grow.

### Environment polish (`59a4fac`, from a parallel agent on `agent/env-polish`)

Modelled HESCO cells, concertina coil on the fence, framed hangar ends, city-block
podiums, balconies and roof zones (all inside the authoritative boxes), tents and
container details. Five new world tests, including per-vertex containment of every
city-block shape and a facility bound of < 200 k triangles. Urban facility
triangles rose from ~108–137 k to ~178–191 k on screen.

### Fixes after the M3 review items and the final captures (`df7de54`)

* **Day sun heating in thermal.** Scenery thermal twins warm faces turned to the
  day sun and cool the shaded side (`solarShift`, bounded per class to a fifth of
  the display range, zero at night; sky, lamps, exhausts and contacts do not
  respond). Horizontal faces keep their class value.
* **AAR overview markers.** In the reference-truth overview only, every contact
  gets a fixed-size ring and a stalk to the ground in one neutral colour, so
  positions read from 2–3 km up. Live views never show them.
* **Non-repeating ground.** From raised cameras the 26 m macro tile showed as a
  regular dot lattice and the 1 130 m broad tile as a grid of identical light
  patches (measured by autocorrelation of the captures: a peak at the tile period).
  Both tiles now take per-cell offsets from a smooth value-noise field and blend
  between neighbours with explicit gradients (no mip seams).

Tests: 317/317.

### Final benchmark on the Intel iGPU, desktop idle (`bench/final-igpu.jsonl`)

Measured on the env-polish build (`d4f18f8`) with the laptop panel switched off,
so the desktop compositor and other windows were not drawing on the shared iGPU.
60 cells: urban day EO and rural night thermal × trainee/overview × Low/Medium/High
× 8/25/50/100/200 contacts, 20 s each.

| World | Camera | Low: fps / GPU ms | Medium: fps / GPU ms | High: fps / GPU ms |
|---|---|---|---|---|
| urban day, EO | trainee | 60 / 2.9–3.2 | 60 / 4.6–4.8 | 60 / 7.9–8.6 |
| urban day, EO | overview | 60 / 2.9–3.0 | 60 / 4.0–4.2 | 60 / 5.8–6.1 |
| rural night, thermal | trainee | 60 / 1.4 | 60 / 2.4 | 60 / 5.7 |
| rural night, thermal | overview | 60 / 1.6–1.7 | 60 / 2.4 | 60 / 4.1–4.2 |

Every cell: 1 % low 59.5 fps, worst frame 16.8 ms, no frame over 33 ms. The
contact count does not change GPU time (instanced airframes).

Reading, together with the M3/M4 runs on the same machine with the desktop active
(Medium ~51–57 fps, ~10 % of frames at 12–15 ms):
* the renderer itself fits the frame on this iGPU at every tier: median GPU time
  at Medium is under 5 ms of the 16.7 ms frame, and High under 9 ms;
* the earlier drops track desktop GPU load, consistent with the time-slicing
  hypothesis in `HANDOFF.md`. A trainee machine running only the browser should
  see the idle numbers; a busy shared desktop will not. The automatic-quality
  policy question in `REPORT.md` still stands.

### Second independent visual review (fresh reviewer agent, final-build screenshots)

The reviewer listed 8 major and 11 minor items. Each was checked on the pixels;
fixed in `b403077` unless noted:

| Finding | Verdict | Change |
|---|---|---|
| Contact drawn on a wall: T1 at 1 096 m, 8 m up, behind a two-storey decorative building | real — the sensors do not model decorative scenery, and contacts are drawn over it so evidence is never hidden | Line-of-sight test against decorative scenery (`world/obstruction.ts`: oriented solid cores of buildings, hangars, containers, tents, tower cabins, tree canopies, HESCO). A contact behind it is a hollow "behind scenery" diamond at the reported position; its close-up reads VIEW BLOCKED BY SCENERY. Contacts behind authoritative boxes are already not reported. |
| HUD says NOT SEEN while the dot is still drawn | real — the 3D view holds an observation for 6 ticks (200 ms), the HUD did not | The HUD now reads the same held observation (`ObservationVisibility`) as the 3D view. No hidden truth was shown: the dot was the held observation. |
| Track box 9 px below the reticle at every zoom | real — CSS put the reticle at `top: 48%` | Reticle at the canvas centre, open centre (20 px gap), dark outline. |
| Target harder to see when zooming in | real — far marker was a hard dark 3 px square; the mesh took over at 3 px where every part is sub-pixel, and was metallic | Far marker is a soft round blob in the airframe's mean tone (EO dark grey, IR body-plus-motor); mesh from 6 px; matte EO airframe. |
| Hangar invisible on the IR night display | real — bare metal at night was set as cold as the sky | Metal roofs: colder than ground, warmer than sky. Thermal sky warms toward the horizon (zenith cold), so the horizon is no longer a hard step. |
| Tree card seams | real — crossed and top cards seen edge-on | Cards fade with the angle to the camera before the alpha test (EO and thermal). |
| Lamp heads black at night | real | Soft additive glare in front of each luminaire (night EO only); lights nothing else. |
| Small labels lost over cloud | real | Dark halo on view annotations. "PX ON TARGET" now reads "PX ACROSS TARGET". |
| AAR follow and observer identical | harness, not product — the replay had no active selection at the seek time; the app says so ("Selected contact is absent or ended; showing Overview") | none |
| Bright line across the AAR frame | not a defect — the asphalt access road, warm in day thermal | none |
| AAR overview omits the protected asset | owner's design — the overview fits "only its supplied active scope" (tested in `scene-presentation.test.tsx`) | noted for the owner |
| Observer framing, "urban" reads as a few blocks, same sky in both worlds, distant ridge flat, identical parked cars, sensor-adjacent mast, cloud softness at 6× | open — art scope, not defects | listed in `HANDOFF.md` |

Tests: 319/319 (new: scenery line-of-sight; review, obstruction and far-marker sprites).

## Ownership takeover checkpoint (17 October)

User transferred the inactive developer's drill branch to root. Preserved inherited
WIP, recovered the external acceptance harness, and corrected CI ordering so builds
precede backend startup tests (the hardening branch already verifies this fix).
Inherited acceptance captures are available outside Git; they expose an AAR timeline
accessible-name failure, so acceptance remains open. Final report is explicitly draft.
No application-branch integration or release ref changes.

## Takeover: decision receipts and accessibility

Fixed two independently reproduced worker/App defects: same-contact same-kind rapid
submissions could settle the wrong feedback, and pause/end races could leave a
submission pending forever. The UI now matches an opaque request ID echoed by the
worker. Paused/ended requests reject explicitly. The actual-worker regression
checks rapid payloads, old-scope isolation and exact saved action/order fields with
no request metadata. Two mounted App regressions protect older-receipt rejection.

AAR timeline buttons now retain their complete visible text as their native
accessible names (the inherited WCAG2.5.3 failure). Active-drill document scroll
padding prevents phone keyboard focus under the sticky header. Keyboard-submitted
decisions transfer focus to a labelled next-step group on acceptance, preserving
pointer behavior and deliberate external focus. Five mounted focus regressions.

Full frontend327/parity, ESLint, configured formatting and production build pass;
72 offline assets. Refreshed preliminary1440/390 guided/AAR axe passes and phone
focus scan finds0 obscured controls (previously4). Final source-matched photos,
keyboard walkthrough and performance matrix follow this checkpoint. No engine,
scoring, backend, integration branch or release ref changes.

## Takeover: second pixel pass and phone recovery

Independent pixel review reproduced two phone defects: the fixed168px close-up
occluded the main crosshair, and the44px wrapping footer hid fog/2D fallback under
the radar. Close-up painted size now fits outside a32px central clearance without
changing sensor sampling or eligible detail. The footer contributes its wrapped
height; an inherited100% badge width is overridden locally. A real-browser check
at360/390/428/768/1024/1280/1440/1920 confirms no document overflow, uncovered footer
controls, and successful2D fallback/3D recovery. Five inset geometry/sample tests.
Full frontend328/parity/lint/format/build pass. Close-up capture harness now scrolls
the actual view into frame (phone offscreen crops had produced blank images), can
require a minimum observed sensor pixel count and pauses before zoom comparisons.
AAR capture respects existing scroll margins instead of bypassing them with a
hardcoded offset. These harness changes do not change observations or scoring.
Graphics measurements and final source-matched evidence remain the next gate.
