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
| 3 | Environment upgrade | planned |
| 4 | Aircraft upgrade | planned |
| 5 | Camera, sensors, polish | planned |
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
