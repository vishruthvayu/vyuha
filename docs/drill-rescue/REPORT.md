> DRAFT RECOVERED DURING TAKEOVER — historical milestone numbers below are not final-source acceptance. See PROGRESS.md for latest implementation and the forthcoming ACCEPTANCE.md.

# Drill experience rescue — report

Branch `feature/vyuha-drill-experience-rescue`, based on
`integration/vyuha-ultimate-finale` @ `db0ff23`. The final SHA is in §1. This report
summarises; the evidence is in the sibling documents:

* `BASELINE-DEFECTS.md` — what was wrong, how it was reproduced, root causes;
* `RESEARCH-AND-ASSET-SELECTION.md` — sources inspected, accepted and rejected;
* `ASSET-PROVENANCE.md` — every bundled asset, licence, author, processing, MD5;
* `PROGRESS.md` — milestone by milestone, with measurements;
* `ACCEPTANCE.md` — real-browser acceptance states, accessibility and keyboard;
* `HANDOFF.md` — how to run, measure and continue; open items in order.

## 1. Source

| Milestone | Commit | Content |
|---|---|---|
| M1 | `63a2a04` | baseline reproduction, defects, research, benchmark baseline |
| M2 | `b489741` | guided decision dock, evidence-based camera, sample interpolation |
| — | `8e26e8d` | handoff document, browser harness |
| M3 | `b7706cc` | environment: sky, terrain, base, occluder dressing, night, thermal |
| M4 | `868e0ed` | airframes with LODs and motion cues; sensor-limited close-up (M5) |
| M5 | `6c4518c` | IR display treatment, resource release on rebuild |
| M6 | see PROGRESS.md | acceptance, review fixes, final measurements |

Every commit was pushed to `origin/feature/vyuha-drill-experience-rescue`, and the
remote SHA was checked after each push. Nothing was merged, tagged or force-pushed.

## 2. Visual quality (before → after)

Screenshots are real captures from the built app in Chrome.
* `screenshots/baseline/` — before;
* `screenshots/m3/` — before/after pairs for urban day, rural day, night EO, thermal,
  IR night display and AAR;
* `screenshots/m4/` — airframes and close-ups;
* `screenshots/acceptance/` — the 17 states.

* **World.**
  - Before: a grid plane, a gradient sky and untextured boxes.
  - After: a photographed sky; flat-then-rolling terrain with blended PBR ground; a
    procedural base for both terrains (buildings, hangar, towers, masts, containers,
    fence, HESCO, gate, lights); decimated CC0 props; tree impostors; authoritative
    occluders dressed as buildings *inside* their volume.
* **Aircraft.**
  - Before: boxes and flat discs at 2–3× scale.
  - After: an original generic multirotor, fixed-wing, bird and unresolved blob at
    real scale, with close/medium detail and far markers; spinning props and blur
    discs, flapping wings; attitude from the observed path.
* **Lighting and atmosphere.** Lighting follows the scenario's day/night state. The
  sun direction is measured from the sky photograph. Haze comes from scenario fog.
  Night EO is dark with facility lights.
* **Thermal.** An illustrative per-surface temperature model with a fixed display
  range: cold sky, warm asphalt, sun-heated metal, cool glass, hot motors and
  engines. The IR night display is a green phosphor image with grain and vignette.
* **Camera.**
  - Track the displayed pose, slew to the radar cue, or hold the bearing; never swing
    to a default sector, never remount on sensor change.
  - Slews are spherical at about 150°/s.
* **Sensor close-up.** The selected contact is shown at the pixel count the sensor's
  IFOV puts on target. It can never show unobservable detail.

## 3. Training UX

Guided **Select → Designate → Classify → Respond → Outcome** dock:
* no pre-selected answer;
* option cards with definitions, and evidence beside each choice;
* effector reach and restricted zone from the engine's own rule on the *reported*
  position;
* public resources (rounds, channels, cooldown);
* every action acknowledged as submitted, accepted or not accepted;
* outcomes from the public response state;
* optional guidance (remembered per device);
* next-contact helper;
* honest view annotations (TRACKING / CUED BY RADAR / HOLDING BEARING / DAY TV HAS NO
  PICTURE).

Guidance explains process, never the answer; a test checks it names no identity.

Accessibility: axe WCAG 2.0–2.2 A/AA found 0 violations at every guided step, at 1440
and 390. Native radio groups and buttons; focus ring on cards. Details in
`ACCEPTANCE.md`.

## 4. Engineering

* **Tests:** 310/310 frontend (287 at the base). Added tests cover:
  - guided dock states and hidden-truth invariance;
  - camera mode and slew bounds;
  - motion smoothness;
  - world invariants (flat ground in optical range, scenery clear of occluders,
    dressing inside boxes, batches and thermal classes);
  - airframe silhouette invariance and LOD hysteresis;
  - pixels-on-target maths;
  - attitude bounds.

  Backend parity tests run inside the suite with the server venv.
* **Motion:** displayed speed of a 15 m/s contact had SD 8.75 m/s (min 3.6, max 32);
  it is now 0.25 m/s (1.3 with ±12 ms delivery jitter).
* **Performance (measured, `PROGRESS.md` M3/M4, `bench/`):**
  - NVIDIA RTX 5060 Laptop: 60 fps, 1 % low 59.5, every tier, both cameras, 8–200
    contacts.
  - Intel UHD 770 iGPU, shared with the desktop: Low 59–60; Medium ~51–57; High ~39.
    The baseline held 60 there.
  - Median GPU time at Medium is ~3 ms per frame, but ~10 % of frames take 12–15 ms
    on this iGPU. The cause is open (see `HANDOFF.md`).
  - The world costs 35–47 draw calls and ~108–137 k triangles.
* **Resources:** 12 cycles of sensor and quality switching leave buffers and textures
  stable (251→257 and 55→59) and the heap stable after GC. Instanced meshes and
  per-build textures are released on rebuild.
* **Assets:** 2.6 MB of world assets. All are Poly Haven CC0 or original; the CC0
  notice ships in `dist/licenses/`. `dist/` is 4.8 MB in total and precached offline.
* **Hidden truth:**
  - the renderer reads only `visual_shape`, `visual_level` and observed positions;
  - one multirotor stands for quad, no-RF FPV and friendly UAV;
  - LOD depends only on projected size;
  - the dock reads only observations, public state and the trainee's own decisions
    (tested by rendering every hidden kind × identity and comparing output);
  - the close-up is limited to sensor resolution;
  - no artificial illumination of contacts at night.
* **Unchanged:** simulation, sensors, scoring, replay, parity fixtures, server. The worker transport also echoes request IDs and explicitly rejects paused/ended
  actions; receipt metadata never enters authoritative event records.

## 5. Integration notes for the owner

* **Merge risk:**
  - `App.tsx`: the decision dock section is replaced; selection and
    acknowledgement state were added;
  - `Scene.tsx`, `ContactRenderer.tsx` and `airframe-geometry.ts` are rewritten;
  - `render-contacts.ts`: the pose buffer is rewritten, API compatible;
  - `premium/training.css`: dock styles replaced, IR overlay added;
  - `sim.worker.ts`: one line.
* **After merge, re-run:**
  - full frontend tests with the backend parity venv;
  - backend pytest (untouched by this branch);
  - a drill on a real device;
  - `tools/drill-rescue/bench.mjs` on the reference M1.
* **Product decision needed:** on integrated GPUs, ask whether automatic quality
  should step down at sustained < 55 fps instead of < 20. That policy lives in
  `quality.ts` and was deliberately not changed.

## 6. Outstanding issues and limitations

See `HANDOFF.md` §6 and `PROGRESS.md`. Main items:
* the iGPU frame-time spikes;
* AAR overview altitude;
* reviewer items still open (per-face sun heating in day thermal, shadow detail on
  lattice masts, city-block streetscape, sensor noise in EO);
* no physical-device or screen-reader test in this work;
* the thermal model is illustrative, not radiometric.
