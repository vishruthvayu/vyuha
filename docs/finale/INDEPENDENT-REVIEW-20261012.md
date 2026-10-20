# Independent current-candidate audit — 12 October 2026

**82/100 provisional: PS coverage 45.5/50; realism/AI 18/25; engineering/demo 18.5/25. Final stable release acceptance is NOT granted.** These are engineering judgement weights under the original 50/25/25 rubric, not official SIH marks or a winning probability. The prior 81/100 is a different dated snapshot and remains historical.

Scope: current working tree on feature/vyuha-finale-edition, checkpoint HEAD 038dd12521578b82cc6a8bab540f62757afb215f, including uncommitted changes. Read all 93 retained findings (51 scoped PASS/41 PARTIAL/1 N/A), original allocation, current source, and relevant receipts. No shared source or documents were edited by this reviewer. Native Windows/Linux and new physical multi-device acceptance were not executed and are not invented. The official desktop OR VR alternative makes VR N/A.

## Independent checks

Executed from repository root:

`PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -m pytest -q -p no:cacheprovider server/tests/test_finale_security.py server/tests/test_crew.py server/tests/test_sensors_v2.py server/tests/test_finale_integration.py server/tests/test_expert_run.py server/tests/test_expert_run_api.py`

Result: **72 passed, 0 failed, 31.76s**. One Starlette/httpx deprecation warning; no skip/xfail. This specifically covers 28 anonymous/forged officer-route cases, Crew capabilities and immutable retry/state behavior, completed Crew whole-database read-only reconnect, coordination attribution, sensor bounds/configuration and per-tick changes, individual cohort isolation, and autonomous reference policies/API. It is a focused suite and is not added to the broad-suite count.

Executed from client:

`node --import tsx --test src/crew-coordination.test.tsx src/finale-evidence.test.tsx src/reference-run.test.tsx src/fusion-persistence.test.ts`

Result: **6 passed, 0 failed, 685.086ms**. Verifies coordination labels/null timings, candidate evidence claim boundaries, pending Fusion preservation with authoritative AAR refresh, session/scenario isolation and both reference labels/horizons. An initial `./node_modules/.bin/tsx --test ...` attempt failed before tests with sandbox IPC `listen EPERM`; the direct Node import invocation above passed without permission escalation.

Root separately reports completed final **453 backend/0 fail/451.77s; 132 frontend/0 fail/91363.281ms; production build PASS, 26 assets/cache 776beb4652c2**, with no later application edits. These are attributed root results, not independently rerun here. Historical receipt independently read: 18 baseline and 22 total stored cards exactly preserved; frozen source checksums retained. No mutable history was substituted by newly recomputed scores.

## Source and evidence findings

- `server/auth.py` protects unit roster/dashboard/analytics/heatmap, individual analytics, evaluations and officer mutation paths. Credential hashes, explicit expiring/revocable bearers and forged-token denials are substantive. Ordinary trainee callsign/UUID/session access remains a trusted-LAN identity model, disclosed in source/UI/docs; this is not per-account authentication or secure examination assurance.
- `server/units.py`, `server/advanced.py`, `server/heatmap.py` exclude shared Crew aggregates from individual rosters, means, trends, heatmaps and new individual exercises. Shared outcomes are neither copied into member profiles nor presented as individual competence.
- `server/crew.py` returns completed runtime before checkpoint/command mutation. Restart/cache eviction reconstruction yields frozen accepted history. The focused whole-database dump regression passes after repeated completed-role state reads. `crew_metrics.py` derives counts and first-stage logical-tick handoffs from accepted log/attribution; absent stage pairs remain null, and pause/outage wall time is excluded. This is coordination telemetry, not individual tactical credit or demonstrated coordination learning. The client stops completed polling.
- `server/sensors_v2.py` preserves strict public-entry configuration/environment validation. `engine_v2.py` prepares shared tick configuration without global cache, revalidates changed configuration and retains per-contact copied memory. Direct public-versus-engine and mutation/session-isolation regressions pass. The exact pre/post complete review/card receipt supports unchanged output for the measured reconstruction, separately from broad parity.
- Completed-only reference rollout/API has independently generated actions and replay/export, explicit canonical truth versus evidence-only modes, original profile/history preservation and bounded caches/action logs. Evidence-only does not infer hostility or fiber control from missing RF/IFF; canonical truth is visibly after-AAR and hypothetical. Original instructor payload/ticks are replayed with new autonomous ordering, so score deltas are not matched human performance. Fusion weights are openly heuristic, optional Brier remains diagnostic, and descriptive alignment does not establish cognitive reliance.
- Process-outage receipt records real macOS service shutdown, three offline accepted decisions and three persisted Fusion receipts after recovery. Six concurrent HTTP completions are software clients, not six physical devices. Three-minute 200-contact fixed-Medium render receipt is 60 median FPS, **34 minimum FPS**, 4.4ms median/10.3ms p95 tick, and 181 main-page heap samples; heap ranges 14.3–102.8MB and ends 31.9MB. This gives scoped endurance evidence, not a frame-time guarantee, leak proof or total Worker/GPU/process-memory measurement.
- Reconstruction receipt: direct post-change median 11.025s over three samples versus earlier one HTTP observation 27.381s. These are different measurement methods and must not be advertised as a paired percentage speedup. Instrumented cumulative costs overlap. Exact review/card equality is the stronger correctness evidence.
- App formatting/readability improved materially; large components and broader dashboard caching remain refinement opportunities. Compliance per-row links still share the audit matrix rather than direct saved live examples. All 93 rows remain traceable; this audit does not automatically turn their explicit limitations into PASS.

## Exact scoring and deductions

| PS criterion | Earned / available | Deduction |
|---|---:|---|
| Desktop |3/3|0|
| Single-drone recognition/classification/response |5.5/6|0.5 fresh physical/mobile breadth|
| Swarm |4/5|1 operational/resource-area depth and human-load evidence|
| Day/night |5/5|0: channel effects implemented|
| Degraded sensors |4.5/5|0.5 broader physical/UI validation|
| Terrain |3.5/4|0.5 simplified geometry/effector/collateral depth|
| Scripted exercises |3/3|0|
| Procedural exercises |4.5/5|0.5 human anti-rote evidence|
| Decision-tree scoring |5.5/6|0.5 full graphical path/comprehension breadth|
| Individual/unit repeated AAR |4.5/5|0.5 role longitudinal validation|
| Minimal hardware/unit use |2.5/3|0.5 new physical unit deployment validation|

PS total **45.5/50**, deduction **4.5**. One measured M1/8GB workload strengthens hardware evidence but does not close fresh multi-device unit acceptance.

| Realism/AI criterion | Earned / available | Deduction |
|---|---:|---|
| Sensors/Fusion |6/8|2 empirical likelihood/equipment calibration and posterior validation|
| Swarm/motion |4/5|1 closed-form coordinated behavior/limited area doctrine|
| Response resources |3/4|1 only three effectors and illustrative parameters|
| Adaptive AI |3/6|3 no fitted Elo/context posterior or measured human advantage|
| Scientific claim discipline |2/2|0: explicit assumptions and boundaries|

Realism/AI total **18/25**, deduction **7**. The successful reference rollout closes software absence but does not erase realism or learning-validity deductions.

| Engineering/demo criterion | Earned / available | Deduction |
|---|---:|---|
| Regression/history |8/8|0: current broad results + focused audits/history receipts|
| Access boundaries |4/5|1 trusted ordinary learner identity and pending physical TLS trust|
| Recovery/performance |4.5/5|0.5 wider Crew interaction/ACK latency and total-memory/longer acceptance|
| Platform execution |1.5/3|1.5 native current Windows/Linux execution pending|
| Release/demo/media |0.5/4|3.5 final pin/clean-clone, stable release, validated media/rehearsal/submission incomplete|

Engineering/demo total **18.5/25**, deduction **6.5**. Increase from prior 17.5 is +0.5 current final regression/history and +0.5 actual scoped recovery/performance. Overall deduction **18**, giving **82/100**.

## Release decision and remaining scope

**Mandatory before stable Finale acceptance:** finalize exact source/assets/commit/evidence and clean-clone reconciliation; execute acceptance-level role/White Cell interaction and latency/recovery/accessibility checks with scope-specific receipts; complete new physical multi-device LAN/WAN/HTTPS trust/cold-reload acceptance; complete current native Windows/Linux startup/install/backup/restore checks when those environments are available; then make the explicit stable acceptance decision. A candidate commit/push can remain honestly provisional while these gates are pending. Source freshness check observed mismatched current manifest hash during this review; root is finalizing pinning. The current clean-clone receipt is checkpoint 038dd12 with prepared dependencies, not a fresh final-source online installation.

**Mandatory for the requested competition submission package, after stable acceptance:** validated-source demo/video, official six-slide PPT/PDF, rehearsed role/seed/fallback script and submission receipts. These are unfinished deliverables, not backend correctness defects.

**Unavailable/pending external validation:** native Windows/Linux remains pending by user instruction; new physical device HTTPS/LAN/WAN scope must remain pending until actually executed. Historical team-confirmed WAN success and old Android receipts are retained with their dates/build limits, and cannot stand in for Finale acceptance.

**Optional future refinements for a correctly labelled prototype:** trained/calibrated Fusion, causal over-trust/learning studies, fitted Elo/context mastery, push transport, GIS/area-effector breadth, separate red-side/planner mode, further component decomposition/dashboard caching and per-row one-click live proof. These deductions remain visible; they are not invented verbatim PS requirements or automatic blockers to a research/training prototype. Any stronger claim of calibrated equipment, human efficacy, expert optimality, adversarial learner authentication or operational readiness would require additional evidence first.

No new stable tag, 100/100, military/human efficacy or final release approval is awarded.
