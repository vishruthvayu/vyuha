# Finale candidate integration — 12 October 2026

Branch `feature/vyuha-finale-edition`; original `release/v1.0.1` and annotated tag `v1.0.1` still resolve to `2ca96105044ad6a14952d74db619e20006c26eca`. No Finale stable tag has been created.

Implemented and integrated: versioned historical dispatch; observation-only live geometry; bounded 30 Hz worker clock; Sensor Truth 0.4; seeded Raid Composer and frozen configuration; authenticated White Cell; read-only command-aware What-if; evidence-constrained response comparison; decision-path/Ghost AAR; Director v2; optional Fusion advice, confidence and durable exposure reconstruction; shared server-owned Crew Mode; optional finite ammunition/cooldowns/jammer channels/delayed seeded effects; officer authentication; signed portable transfer including Director/crew/Fusion metadata; compliance board; platform startup and certificate helpers.

The original immediate contract remains frozen. Optional delayed effects are frozen per scenario; older 0.4 scenarios without response_model retain their original immediate behavior. Director and new Studio exercises enable the new model explicitly. Process credit is separated from stochastic resolution, with non-hostile safety rules. These are illustrative training assumptions, not calibrated weapon or sensor performance.

Combined regression before the last presentation fixes: 415 backend PASS and 123 frontend PASS. Full parity includes original 312 checkpoints, immediate Finale 544 checkpoints/32 scenarios, delayed-response 288 checkpoints/18 scenarios, sensor component 1,920 and motion component 7,452 checks. Subsequent complete-suite reruns are recorded in TEST-RESULTS.md when finished. Historical read-only backup validation: 18/18 baseline and 22/22 currently stored scorecards exact; source database unchanged. All frozen legacy source checksums match.

Real disposable-database browser acceptance exercised new raid creation, trainee designation/classification/response, pending logical effect paused, reload and matching-trainee draft recovery, server scoring/AAR, persisted Fusion confidence, What-if, Expert comparison and Time Machine. Two role clients recorded a shared designation/classification/response; instructor pause/radar degradation/injection and White Cell reconstruction were observed. These are local browser clients, not separate physical trainee-device evidence.

Known audit gaps remain explicit: scientifically trained/calibrated Fusion and causal over-trust assessment; Elo/context-aware mastery; push transport rather than polling; full dashboard caching/readability refactor; complete current-build performance/concurrency/outage/clean-clone/mobile checks and claims review. Native Windows/Linux execution is PENDING at the user's request on 12 October. Current-build physical LAN/HTTPS trust checks remain distinct from historical team reports. Director synthetic comparison did not establish a learning advantage. Final independent release approval and new tag are pending. Final PPT/video must wait for validated source.

Later checkpoint: full418 backend/125 frontend and build PASS. Fixed-Medium Sensor Truth benchmarks on M1/8GB, local test-CA HTTPS,390px responsive AAR and prepared macOS clean-clone launch are now documented in dedicated receipts. Full autonomous reference-run is now integrated and checked as a later candidate milestone. Its canonical/evidence-only modes and projection limits are documented.

Latest full software receipts:434 backend/127 frontend/build PASS. Crew neutral priors excluded from individual cohort metrics; full eight-family heatmap and bound autonomous reference playback verified. All93 audit rows retained,51 scoped PASS/41 PARTIAL/1 N/A. Stable approval and remaining research/deployment/endurance/submission work are not complete.

## Reconstruction, durability and process-recovery checkpoint — 12 October 2026

Latest backend source suite: **434 PASS, 0 FAIL, 367.35s**. After all subsequent client edits: **129 frontend PASS, 0 FAIL, 87538.394ms**, production build PASS, **26 local assets / cache 3e5dbd427cab**. Backend source did not change during these client fixes. No tests were skipped or disabled.

Completed AAR refresh preserves matching-session pending Fusion requests and upload batches while taking the authoritative server score. Completion, AAR, What-if and reference reconstruction requests use a 120-second budget; ordinary tactical requests retain six seconds. A verified session is retained even if optional Fusion receipt upload fails. Analytics now checks officer sign-in before mounting its unit controls.

Actual macOS process outage: health connection refused after shutdown; three browser decisions were recorded offline and a device-only AAR saved. After restart, automatic resynchronization produced a server-verified completed record, exact three accepted decisions and three persisted Fusion receipts. Ghost loaded. See PROCESS-OUTAGE-RECEIPT.json and before/after screenshots. This does not attest WAN loss or another physical device.

Six synthetic HTTP clients completed concurrently in 5.231s total. A 200-contact roster (197 birds / three hostiles) took 27,381.25ms to reconstruct and its full 200-row server-verified AAR loaded in the browser. See RUNTIME-LOAD-RECEIPT.json. These are scoped throughput observations, not a full endurance or physical multi-device certificate.

All 93 audit rows are retained: 51 scoped PASS, 41 PARTIAL, one justified N/A. The dated provisional assessment remains 81/100; final score/release approval are unset. Native Windows/Linux validation remains pending by user instruction. Scientific calibration, remaining implementation/identity/cache/readability/live-proof gaps, endurance/accessibility/physical acceptance and final media/submission are still open. Stable release/v1.0.1 and tag v1.0.1 remain unchanged.

## Final runtime correction and source checkpoint

After the completed-Crew readonly/coordination changes: **453 backend PASS, 0 FAIL, 451.77s**. After all client changes and formatting: **132 frontend PASS, 0 FAIL, 91363.281ms; build PASS, 26 local assets / cache776beb4652c2**. One existing Starlette/httpx deprecation warning; no skipped or disabled checks. Earlier434/129 and452/130 results above are historical checkpoints.

Analytics mounts after officer sign-in; its route does not enroll an officer as a trainee. All28 registered officer-protected API route/method pairs rejected anonymous and forged bearer requests in a real disposable service. Unit roster/means/trends exclude Crew aggregates; individual analytics, Rapid ID and evaluation enrollment reject aggregate owners without changing profiles.

A failed whole-service immutability probe exposed completed Crew polls updating telemetry. Completed runtime reads now preserve every stored field after cache/process recovery; a whole-database-dump regression passed. Completed browser roles display counts by member and logical handoff medians, no individual tactical score or profile credit, and stop polling after completion. Whole target-session evidence (scenario, inputs, card, personal profiles/outcomes, Fusion and statistics) remained exact across actual evidence-only and What-if UI requests.

Profiling identified1,093,022 repeated sensor-configuration validations. Parameters are now validated once per logical tick, with public entry-point validation intact; complete review/card equality and full Python/TypeScript parity pass. Three direct200-contact review reconstructions measured11.025263/11.001499/11.892299s (median11.025263s). Earlier27.38125s is a real HTTP completion observation, not a paired direct benchmark.

Actual180-second200-contact thermal-overview/fixed-Medium browser run: median60FPS;5376logical ticks; tick median4.4ms/p9510.3ms;181 main-page heap samples. The run overlaps software checks and captures allocation/collection, not total process/Worker/GPU memory or a leak-free certification. Raw receipt retained.

App and advanced modules are formatted for walkthrough; App is2538 lines with172-character maximum line. Further hook decomposition, linter and broader maintainability remain refinements. Source is still a candidate until exact source/deployment/independent acceptance reconciliation. Native Windows/Linux remains pending; no new physical test or final competition media is asserted.
