# Drill experience — baseline defects

Source under test: `integration/vyuha-ultimate-finale` at `db0ff23a67692d3db5dce07a031d17ea50a409b3`
(fetched 2026-10-16, still the branch head when this branch was created). Production
build served by `scripts/start-local.sh` on Linux; Chrome 14x headless with hardware
WebGL (ANGLE → Mesa, Intel Raptor Lake-S UHD Graphics). The same build passed
287/287 frontend tests, so none of the problems below are visible to the test suite.

Each entry gives what a trainee sees, how it was reproduced, the measured or captured
evidence, and the root cause found in the code. Screenshots are in
`screenshots/baseline/` (WebP copies of the real captures).

## How the baseline was reproduced

| Run | Scenario | Path |
|---|---|---|
| Adaptive day | Director-prepared v2 raid, *Urban outpost · Day*, engine `vyuha-0.4.0`, two authoritative terrain boxes | Training → Prepare adaptive drill → Start → select nearest contact → 6× magnification → THERMAL / IR NIGHT DISPLAY / DAY TV → Designate → Confirm ID → RF jammer → End exercise → AAR |
| Urban night | Officer-authored library scenario (schema 2, legacy engine, night) | same flow, library mode |
| Rural day | Officer-authored library scenario (rural forward base) | same flow |
| Sensor switch | Library day scenario, contact at 82 m | select, then THERMAL → DAY TV with 40 ms frame bursts |
| AAR | the adaptive record | Review → record → OVERVIEW / OBSERVER / FOLLOW TARGET |
| Performance | `/system/benchmark` (Finale 0.4 synthetic fixture) | 8 / 25 / 50 / 100 / 200 contacts × Low / Medium / High × trainee / overview camera, 20 s each, frame intervals and WebGL draw calls recorded by an injected probe |

All drills used the real UI (trusted CDP input events), a real server session and
the real worker. Scripts live outside the repository in the work folder
(`baseline-drill.mjs`, `switch-burst.mjs`, `aar-shot.mjs`, `bench.mjs`).

## A. Motion and camera glitches (reproduced, root causes confirmed)

### A1 — Camera swings to a default sector whenever optical observation flickers
* **Seen:** while tracking a contact at 6× magnification the view jumps between the
  target bearing and the fixed "observation sector" several times per second
  (`14-burst-6x-camera-swing-sheet.webp`: 16 frames, 60 ms apart). Mean absolute
  frame difference: 10, 10, **66**, 34, 0, **103**, 17, **57**, 47, 0, **33**, 25 …
  (a still view differs by < 1).
* **Cause:** `Scene` nulls `selected` whenever the selected contact is absent from
  the optical visibility set (`Scene.tsx`, `tracks.some(t => t.id === props.selected)`),
  and `CameraRig` then aims at the hard-coded default `(0, 18, 1500)`. Optical
  levels drop out for single samples near range limits (reliability 0.95, 3-tick
  sampling, 6-tick hold), so the aim alternates between target and default. The
  radar still reports the contact during these gaps, so the trainee's evidence never
  justified leaving the bearing.

### A2 — The "protected asset" block fills the camera for rear bearings
* **Seen:** selecting a contact at bearing 234° turns two-thirds of the EO view into a
  flat dark green wall (`03-selected-blocked-by-asset-box.webp`).
* **Cause:** the asset is a 10 × 4 × 6 m box at `(0, 2, -4)` (z −7…−1), and the live
  camera sits at the sensor origin `(0, 2, 0)` — 1 m in front of its face. Any aim
  toward −z looks straight into it.

### A3 — Every sensor switch resets and re-swings the camera
* **Seen:** after DAY TV is pressed, the first frame shows the default road sector and
  the view then pans back to the contact over ~150 ms
  (`15-sensor-switch-swing-sheet.webp`; frame differences 23.6, 11.1, 4.0 … then ~2).
* **Cause:** `<CameraRig key={contextKey}>` where `contextKey` includes the vision
  mode, so switching THERMAL / DAY TV / IR remounts the rig and its aim restarts at
  `(40, 18, 150)`.

### A4 — Contacts surge and stall ten times a second
* **Measured:** `ObservedPoseBuffer` fed a contact flying a constant 15 m/s, observed
  every 3 logical ticks (the worker publishes every 3 ticks) and rendered at 60 Hz:
  displayed speed mean 14.97 m/s but **SD 8.75 m/s, min 3.6, max 32.0**; mean lag 1.2 m.
* **Cause:** the buffer chases the newest sample with an exponential filter
  (`1 − e^(−21.4·dt)`), not interpolation between samples. Each new sample produces
  a burst of speed that decays before the next one arrives.

### A5 — Camera and model use different filters, so the target shakes in frame
* **Cause:** the camera aims at the raw snapshot position (`target.x/altitude/z`,
  exponential factor 7.67) while the mesh is drawn at the separately filtered pose
  (factor 21.4). At 6× the difference between the two filters is visible as the
  contact wobbling around the crosshair.

### A6 — Frame spikes on selection and sensor switching
* **Measured (rAF intervals, adaptive drill):** selecting a contact produced a 116.6 ms
  frame; switching to IR NIGHT DISPLAY a 66.7 ms frame. Steady state is 16.7 ms.
* **Causes found:** materials are rebuilt per vision mode (`useMemo([vision, palette])`
  in `ContactRenderer`, new `meshStandardMaterial` props in `World`), so each switch
  compiles shaders on the main thread; `instancedMesh` is constructed with
  `args=[…, capacity]` and `capacity` is the next power of two of the contact count,
  so crossing 8/16/32/64 contacts re-creates every instanced mesh.

## B. Sensor-state and observation presentation

### B1 — "TRACKING T4" while the camera is not tracking
* **Seen:** in THERMAL the annotation reads `TRACKING T4` while the view shows the
  default sector and the footer says "Select a radar contact to focus the camera"
  (`05-thermal-default-sector-while-tracking.webp`). T4 was at 1 433 m, beyond the
  1 200 m IR limit, so IR had no observation.
* **Cause:** the annotation reads `selected`; the camera reads the optical visibility
  set. Nothing tells the trainee that this sensor cannot see the contact.

### B2 — DAY TV at night renders a daylight scene
* **Seen:** library night scenario, DAY TV: blue sky, sunlit facades
  (`11-legacy-daytv-at-night-lit-as-day.webp`).
* **Cause:** lighting and sky are chosen from the *vision mode*, not from the
  scenario's night state. The v2 sensor model makes EO unavailable at night, so the
  view should be dark and should say that EO is unavailable.

### B3 — Thermal is a flat recolour
* **Seen:** sky, ground and buildings are single palette colours; every contact is one
  flat "hot" colour (`MeshBasicMaterial`) with no internal structure
  (`10-legacy-thermal-closeup-airframe.webp`).

## C. Environment

### C1 — Flat placeholder ground
A 12 km single-colour plane with a 100 m `gridHelper` overlay, one 18 m road
running 8 km to the horizon with two painted lines, and a 32-px procedural noise
texture (`02-active-day-workstation.webp`, `12-legacy-rural-day.webp`).

### C2 — Buildings are untextured boxes
* **Finale (v2):** each authoritative terrain box (urban: 90 × 90 × 28 m and
  100 × 110 × 35 m; rural: 70 × 60 × 10 m) is rendered as one `boxGeometry` with
  vertex colours and a repeated 32-px "panel" texture.
* **Legacy:** 20 generated boxes (4–22 m tall) are placed 35–165 m in front of the
  sensor. These are not used by the legacy sensor model, so they hide contacts that
  the sensor is reporting (`09-legacy-night-thermal-boxes.webp`).

### C3 — Sky is a 256 × 128 gradient
The background is a generated `DataTexture`; the rural horizon "hills" are a sine wave
painted into it (blurry at any zoom).

### C4 — No facility
Apart from the asset box there is no base: no perimeter, gate, towers, shelters,
roads layout, vegetation or distant landscape. Rural trees are 6-sided cones.

## D. Aircraft

| Shape | Baseline construction |
|---|---|
| Multirotor | box body + box "battery", 4 box arms, 4 cylinders, 4 static translucent discs, one squashed sphere |
| Fixed-wing | capsule fuselage, two flat extruded polygons, a box fin, a squashed sphere |
| Bird | squashed spheres + flat 2-mm "foil" wings flapping by yaw-plane rotation |
| Unresolved | 6 × 4 sphere |

All are drawn 2–3× real size, flat-shaded, with yaw only (no pitch or bank) and
no propeller rotation. At the 6× close-up the multirotor reads as a white cut-out
(`10-legacy-thermal-closeup-airframe.webp`).

Hidden-truth check of the baseline: shapes come from `opticalRenderShape`, which uses
`visual_shape` (`bird` / `fixed_wing` / `multirotor`) from the observation, so quad,
no-RF FPV and friendly UAV share one multirotor model. **This boundary is correct and
must be preserved.**

## E. Trainee decision workflow

### E1 — Pre-selected "Quadcopter / Hostile"
* **Seen:** after designation both selects already read *Quadcopter* and *Hostile*;
  one click on Confirm ID records that classification. In the adaptive run the script
  pressed Confirm ID then RF jammer on a contact whose IFF read **Friendly reply**, and
  the session failed for non-hostile engagement (`07-response-no-feedback.webp`,
  `08-complete-aar.webp`).
* **Cause:** `choose()` sets `kind = t.classification || "quad"` and
  `identity = t.declared || "hostile"`.

### E2 — Classification is two unexplained dropdowns
Contact type (Bird / Quadcopter / Fixed-wing / No-RF FPV) and identity
(Hostile / Friendly / Neutral) have no descriptions. Nothing links them to the evidence
the trainee is looking at (silhouette, control link, IFF reply).

### E3 — Response buttons explain nothing about eligibility
The three effectors have one-line hints ("RF-link threats only", "Check range and
ROE"). Range limits, rounds remaining, channels in use, cooldown and the restricted
zone are hidden in a collapsed "Response resources" disclosure.

### E4 — No acknowledgement after an action
* **Seen:** after RF jammer only the button outline changes
  (`07-response-no-feedback.webp`).
* **Cause:** the worker emits `accepted` but never `rejected`
  (`sim.worker.ts`: `if (sim.act(a)) { … emit({type:'accepted'}) }`); the UI shows
  neither, and pending → resolved / no-effect transitions are only listed inside the
  collapsed resources disclosure.

### E5 — A resolved contact is reported as "no current sensor observation"
Four seconds after the jam, the dock read "T4: no current sensor observation.
Selection retained; wait for reacquisition." and fell back to step "1 Select a
contact". The response state already contained the attempt outcome; the guidance
ignores it.

### E6 — Step indicator and controls disagree
The dock heading shows step 1 / 2 / 3, but all seven controls (Designate, two selects,
Confirm ID, three effectors) stay in one row with most of them disabled. The only
explanation of a disabled control is a `title` tooltip (not available to touch or
keyboard users).

## F. AAR replay
`OVERVIEW` places the camera ~2.5 km above contacts 1–1.7 km away: contacts are
sub-pixel specks over a dark grid and two tiny squares
(`13-aar-overview-reference.webp`). `OBSERVER` falls back to overview when the
selected contact has ended.

## G. Performance baseline

The baseline renderer is very light, which is part of why it looks primitive:
6–11 WebGL draw calls and 280–6 300 triangles per frame for 8–200 contacts.

Capped (vsync 60 Hz) on the Intel UHD iGPU, trainee camera, thermal, 20 s per cell,
first 3 s discarded:

| Contacts | Low: mean fps / 1 % low | Medium | High |
|---|---|---|---|
| 8 | 60.0 / 59.5 | 59.9 / 54.6 | 60.0 / 59.5 |
| 25 | 59.6 / 38.7 | 59.7 / 41.1 | 60.0 / 59.5 |
| 50 | 60.0 / 59.5 | 59.8 / 43.8 | 60.0 / 59.5 |
| 100 | 59.8 / 46.9 | 59.9 / 54.6 | 60.0 / 59.5 |
| 200 | 59.5 / 34.6 | 60.0 / 59.5 | **55.6 / 12.5** (21 frames > 33 ms, max 183 ms) |

Overview camera, High: 1 % low 20.7–36.6 fps at every contact count (shadow map at
1.5× pixel ratio). Overview, Medium, 50 contacts: one 250 ms stall (19 frames > 33 ms).
So the baseline already stutters at High and occasionally at Medium, despite a
median of 60 fps everywhere.

The full matrix (both cameras, every tier, frame-interval percentiles, draw calls,
triangles, JS heap) is in `bench/baseline-capped.jsonl` and
`bench/baseline-uncapped.jsonl` in this folder. The uncapped runs (`--disable-gpu-vsync
--disable-frame-rate-limit`) are used only to compare GPU headroom between builds
by the app's own renderer FPS; rAF intervals are not reliable without vsync.

## Summary of root causes to fix

1. Camera aim follows a different, flickering evidence set from the one shown on
   the radar and drops to a default sector (A1, A3, B1).
2. Exponential chasing instead of sample interpolation (A4, A5).
3. Rebuilt materials and instanced meshes cause shader-compile and allocation
   spikes (A6).
4. A world built from untextured boxes, a gradient sky and a grid (C1–C4).
5. Airframes built from boxes and discs, with no rotor or attitude animation (D).
6. Decision controls that pre-select an answer, explain nothing and acknowledge
   nothing (E1–E6).
