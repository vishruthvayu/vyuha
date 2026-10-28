# Spatial observation and acquisition foundation

Implementation: `2ed666bca5a9e2f982e64ee12c5e2e0fa532aafe`, development branch only.

## Actual user-visible change
Trainees can drag the live observed canvas to scan from the fixed sensor origin, with angular movement tied to the displayed FOV and frozen start pose. Mouse/touch pointer capture retains a gesture outside the scene and cancels on contact/session/instrument/VR ownership changes. Existing keyboard arrows and report reacquisition remain available. No additional world/canvas or sensor result is created. Controls/overlays do not start drag gestures. Camera input never dispatches a training decision, changes sensor sampling, or improves scoring.

A real isolated-server browser exercise was prepared, started and paused at T+11s. Dragging changed the display to AZ351.0/EL4.1; returning to sector restored automatic pointing. Screenshots and AX receipt retained. This is a functional desktop interaction check, not physical touch/XR qualification. Captures reflect the in-app browser's unusual zoom/compositor sizing. Before/after show camera presentation on the same paused exercise, not a renderer-fidelity upgrade.

## New simulation dependency — not live acquisition
New independent Python/TypeScript optical-task schedulers implement positive logical dwell, cadence-aligned sampling, separate publication, bounded shared slot/cooldown/expiry/request limits, immutable receipts, duplicate protection and early-end cancellation. Eight shared transcript fixtures verify exact parity. A trusted injected sample-time oracle supplies only sanitized channel availability/shape-resolution values. IDs cannot reroll the sampling key.

These modules are NOT imported into the production engine. No v0.5 scenario is admitted. Global action/command ordering, actor/session ownership, policy hashes, persistent recovery/Transfer, new catalog admission, Fusion, Ghost, Crew and XR integrations remain required. Snapshot inspection is not a restore format. Current v0.4 evidence/score behavior remains unchanged.

## Targeted evidence
- Optical math and UI:14 tests passed; final UI-only rerun9 passed after a test-canvas accessible label correction. Includes scope/selection/instrument cancellation, one mounted world, FOV-relative bounds, existing capture/compare and focus behavior.
- Scheduler:10 Python tests passed in0.25s;10 TypeScript tests passed in3365.238584ms, including eight cross-language transcripts.
- Changed-file ESLint, final integrated TypeScript and changed-file formatting passed; raw logs retained.
- Rehearsal16 backend/12 frontend checks and historical source-pinned core evidence were retained, not rerun as unrelated full regressions.

No new matched GPU/frame-pacing benchmark is claimed. The existing 200-contact60FPS paired benchmark belongs to2925518 and its recorded scene/DPR. Gesture interaction does not change materials/assets/worker/scoring, but its continuous-input performance and repeated lifecycle/physical touch acceptance still need measurement. No general performance improvement is inferred.

This checkpoint does not complete any of the three whole-product flagships or qualify a release candidate.
