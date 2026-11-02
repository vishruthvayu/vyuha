# Shared browser/XR observation adapter v1

Integrated development slice, not physical-headset acceptance or a completed flagship.

The existing cockpit now admits complete frozen v0.5/v0.6 contracts through `vr-observation.ts`. It emits the same `inspect` and explicit `defer` actions as the browser. App owns request IDs, worker/server timestamps, receipt persistence, completion and recovery. No engine, score, sensor model, original report, mastery profile or historical session is changed.

## User-visible workflow

Prepare the mission; open the desktop VR cockpit; explicitly Start. Observe requests EO/IR against a valid current radar report and shows accepted/sample/release/expiry boundaries. A retained last report is list context, not current geometry. Decide requires explicit type and identity; only a recorded classification rehydrates. v0.6 offers an explicit reasoned Defer without inventing classification. Session exposes pause, exit and separately confirmed completion. Assigned preview retains the exact frozen assignment and calls its existing start path.

Readiness distinguishes preparation, restoring/busy worker, supported engine and policy, secure origin, missing WebXR API and no available immersive session. Desktop preview remains available without a headset. Acquisition worlds and instruments face the modern forward direction. Legacy presentation retains its direction. Reduced-motion preference reaches world/contact presentation. Shared spatial rectangles test all nine decision controls and four contacts for overlap. Neither eye rendering nor controller implementation is replaced.

Exact request-ID plus payload matching prevents unrelated/delayed receipts unlocking actions. Synchronous selection/session/suspend intent rejects stale callbacks. An App-owned pending receipt survives cockpit exit/re-entry. Finish confirmation expires after eight seconds, clears on context/phase change and is synchronously consumed once. Browser and XR share strict released/pending metadata filters; malformed/future recovery DTOs cannot become observations or crash the readout.

## Focused evidence

`vr-observation.test.ts` compiles real Python v0.5 day/night and v0.6 practice/assessment fixtures, emits actual adapter actions, and compares TypeScript/Python reconstructed acquisition/events/full score. Separate tests exercise publication/expiry, prior alias Defer, policy/lifecycle admission and malformed/future metadata. Actual cockpit DOM tests exercise explicit choices, wrong sequence/payload receipts, same-turn contact changes, re-entry, duplicate suppression and expired/context-changed completion. `vr-layout.test.ts` tests the rectangles used by rendered surfaces. Existing XR lifecycle tests remain in `vr.test.ts`.

The independent integrated review reproduced a null-channel pending DTO crash; the shared structural validator and adversarial tests close it. It also prompted latest-context guards for finish. Browser receipts, rendered captures, final command totals and source hashes belong to ACCEPTANCE.md, not this design description.

## Limits

Physical headset operation, comfort, headset FPS, separate-device trusted HTTPS and hand input are not validated here. Authoritative illustration is not empirical sensor calibration. Fusion advice remains the browser panel; VR exposure is not inferred. The test-only IWER proxy is outside production assets and now targets the new instrument pages. Earlier emulation evidence is not reused as current-source acceptance.
