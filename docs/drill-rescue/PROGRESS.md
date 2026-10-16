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
| 2 | Guided trainee workflow + evidence-based camera / interpolation fixes | in progress |
| 3 | Environment upgrade | planned |
| 4 | Aircraft upgrade | planned |
| 5 | Camera, sensors, polish | planned |
| 6 | Final validation | planned |
