# Stage 5 — Advanced Training Intelligence & Exercise System

## Baseline and audit

Branch starts at `5852628086a199cb483865875fe0dffd0b1992ef`. Before editing: backend 65 passed (7.66 s, existing Starlette/httpx warning); frontend 32 passed (5274.84 ms), including unchanged 51 simulation and 72 Director parity checkpoints; production build passed (1609 modules, 4.66 s, seven assets, cb75efb6b806). The first npm launch was blocked by sandbox IPC permissions; it passed after permission was granted.

The existing scenario holds a deterministic seed, 75-second horizon, contact IDs/type/identity/RF, spawn ticks, bearing, distance, speed and altitude, plus fog and radar-jam window. Hostiles move toward one asset; birds/friendlies follow a deterministic drifting path. Instructor injection adds one no-RF FPV/quad or six RF quads at the applied command tick. Working radar/thermal observations determine first detectability; arrival within 8 m triggers impact. Urban buildings are visual scenery, with no physical occlusion or pathfinding. Low Approach therefore changes illustrative sensor-warning range, not terrain masking.

Stage 3 has 12 focus templates and three difficulty levels, four Beta profiles and per-trainee recent history. Its Thompson selection remains unchanged. Existing doctrine values are embedded demonstration constants, not a loaded pack system. The 15-point node currently awards timely resolution; a versioned new scenario path will replace that node with auditable ordering agreement. Legacy scenarios retain their old scoring. There is no authored scenario library. SQLite session/command/event/profile tables, Ghost's replay observer, Unit Mode assignment and the Instructor are the extension points; no parallel tactical simulator or database replacement is needed.

Stage 4's physical WAN-off reload/start validation remains pending by user choice. Stage 5 does not claim to close it.

## Implementation and preserved architecture

All six required systems are implemented on `feature/advanced-training-v1`, directly from the baseline above. No database migration, replacement simulator, LLM, hardware ingestion or external service was added. Four additive SQLite tables hold unit pack preferences, immutable library entries, Rapid ID sessions and answers. Existing training records and tables remain intact.

The existing Instructor → FastAPI/SQLite → independent sessions → 30 Hz worker → authoritative reconstruction → score → Ghost/AAR → four-skill profile → Director pipeline remains the tactical path. Authored/library drills use it too. Rapid ID reuses modeled contact observations and the same transactional skill-outcome ledger, with a compact recognition review. Crew training remains future scope; independent sessions remain the default.

Legacy scenarios retain `vyuha-0.2.0` scoring and their timely-resolution prioritisation. New advanced scenarios explicitly carry `prioritisation_version: 1` and frozen pack rules; their scorecards identify `vyuha-0.3.0`. Original Night Watch remains available. A saved scenario is fetched by immutable ID for recovery; an unavailable advanced scenario is never silently substituted with a legacy drill.

## Red Force v1

The canonical `red_force` snapshot stores version, tactic, tactic seed and phases containing applied spawn ticks, roles and contact IDs. The compiler changes the existing track representation; neither language needs a second movement model.

| Tactic | Actual supported mechanics |
| --- | --- |
| DIRECT | Non-hostiles at tick 0; hostile contact at tick `60 + 15 × original contact index`, then radial approach. |
| SATURATION | Hostiles at ticks 90/96/102, within 0.4 s; three bearing bands near 35°/90°/145° with seeded 0–7° offsets. |
| DECOY_THEN_STRIKE | Non-hostiles at 0, RF/other hostile decoys at 8 s, no-RF FPV strike at 16 s from a different seeded bearing band. |
| STAGGERED_WAVES | Contact index modulo three produces distinct 0/8/16 s waves. |
| LOW_APPROACH | Hostile altitude 4 m, initial range 150 m, speed at least 3.8 m/s, effective radar/thermal warning range 100 m. This is illustrative reduced warning, with no terrain occlusion. |

Director still selects focus, template, difficulty and broad conditions through unchanged Stage 3 Thompson logic. Red Force then selects from three focus-appropriate patterns, avoiding the last two patterns where possible. The public preparation card shows focus, difficulty, pattern and pack; it does not disclose strike timings. Ghost's new tactic-phase timeline only includes phases within the actual observed interval.

## Doctrine Packs @1

All values are **illustrative threat and sensor parameters** and **illustrative training configurations**, not official Army/CAPF doctrine. Each session freezes ID, version, defaults, resolved range/ROE/effectors/risk/rubric and allowed tactics. Changing the selected unit pack affects subsequently generated adaptive exercises; a library entry retains its original snapshot.

| Pack | RF / kinetic range (m) | Restricted kinetic sector | Default mix | Fog / default time | Risk weights: quad / fixed / no-RF FPV; asset multiplier |
| --- | --- | --- | --- | --- | --- |
| Army Forward Post | 180 / 160 | x < −30, z > 20 | bird, friendly, RF quad, FPV, fixed wing, RF quad | 0.20 / night | 1 / 1.2 / 1.5; ×1 |
| CAPF / Border Post | 150 / 130 | x < −30, z > 20 | bird, friendly, friendly, RF quad, FPV | 0.15 / day | 1 / 1.1 / 1.3; ×1 |
| Critical Infrastructure | 140 / 110 | x < −15, z > 0 | bird, friendly, RF quad, FPV, fixed wing | 0.10 / day | 1 / 1.4 / 1.8; ×1.2 |

All three expose Hold, RF jammer and kinetic; the availability configuration is actually enforced by worker, server and Ghost. Hold is allowed regardless of effector range in new pack snapshots. The common rubric remains 25/25/15/35. Advanced distance comparisons use the frozen nine-decimal precision rule to keep sensor-boundary decisions identical between languages. Older snapshots lacking either optional rule retain their historical behavior.

## Scenario Authoring Lite

Open `/exercises` from Instructor. Select a unit and apply its pack for future adaptive drills. Author name, local instructor label, pack, seed, one of four training focuses, urban terrain, day/night, one of five patterns, a counted mix of five contact presets, fault, restricted sector, duration and difficulty label. Preview validates and compiles the form; save requires a current successful preview. Saved immutable scenarios show name, pack/version, focus, pattern, label, unverified author identifier and version. Instructor group assignment and trainee Scripted / Library selection launch the exact stored snapshot.

Supported constraints: 3–70-character name with at least three non-space characters; ASCII local author label 1–24 characters; unsigned 32-bit seed; 1–18 contacts; urban only; **75 seconds only**. Difficulty is a descriptive label in authored scenarios, not an extra physics control. Saturation requires at least three hostiles; decoy/strike requires both RF hostile quad and no-RF FPV; staggered requires at least three contacts; low approach requires a hostile. Unknown packs, types, extra fields and malformed values are rejected. Fault choices are none, radar degradation, radar failure and RF failure; authored fault windows are fixed at 6–22 s. Restricted sectors use the chosen pack's existing axis-aligned preset. No free-form paths, mission editor or GIS is implied.

## Real prioritisation: 15-point node

For each active, previously detected hostile at a decision:

```text
time_to_impact = max(0, (current_range − 8 m) / modeled_speed)
risk = pack_kind_weight × pack_asset_risk
priority = risk / max(time_to_impact, 1/30 s)
```

The reference sorts descending priority, with contact ID providing stable display order. The trainee ordering uses the **first accepted non-Hold engagement action per hostile**; an ineffective attempt still declares attention. Hold does not. Each unordered hostile pair is compared once, at its first co-observed choice. Birds and friendlies are excluded. Newly spawned/injected contacts enter only after actual detection and are not compared retroactively with a contact already resolved.

```text
tau = (concordant − inverted) / (concordant + inverted)
agreement = (tau + 1) / 2
coverage = observed hostile contacts with a first engagement / observed hostiles
points = round_half_up(15 × agreement × coverage)
```

Equal priorities within 1e−9 are ties and excluded. With no comparable pairs, agreement is neutral 1; coverage still applies. Zero relevant hostiles gives 0; one engaged hostile gives 15; one unengaged gives 0. Missing engagements reduce coverage. A single global 0–15 result is used for each hostile row, so hostile averaging preserves the overall 25/25/15/35 rubric, asset-impact penalties and non-hostile engagement failure. Card evidence stores choices, available reference facts, pair outcomes, tau, coverage and unengaged IDs. This is pairwise Kendall agreement over contemporaneous available choices, not a static ranking of threats that never coexisted.

Ghost adds grounded priority decision rows with contact-specific range/risk/TTI, expected attention order and permitted response. Prioritising a contact does not waive identification, range or ROE. These rows do not introduce a fifth skill or double-count the four existing profile outcomes. Early ending still runs the established 75-second scoring projection; future projected observations can lower coverage, while AAR never claims later phases were observed.

## Rapid ID

`/rapid-id` supports 10–20 rounds (default 15), each with a five-second active clock. A seeded balanced shuffle produces bird, friendly UAV, RF hostile quad, no-RF FPV and fixed-wing examples. Evidence comes from an actual working modeled thermal observation with radar, RF, IFF and flight description. Quad and FPV share the modeled multirotor silhouette; RF/IFF and explicit exercise identity briefing supply their distinction. No IFF reply alone proves hostility.

The API returns the current evidence package and already answered reviews; no current answer label or future answer key is sent before a decision. Sequential immutable answers store active `round_start_ms`, response duration and answer. Pause, hidden-page suspension and reload preserve elapsed active time; reload resumes paused. Pending answer bodies are saved before upload and retried unchanged. Changed duplicates conflict. A timeout or answer at the deadline is a failure.

Server-owned reference answers determine accuracy, median response duration, friendly false-hostile, bird confusion and most common errors. Timing is **client monotonic time, not server-attested reaction time**. Final answer, summary, outcome ledger and profile update are one transaction. Each correct round adds one classification/IFF success; each incorrect/timeout adds one failure. All other skills receive zero observations and retain their prior evidence timestamps. Completion/retry cannot double-update the profile. Compact review exposes every answered round and reference evidence. There is no Rapid ID detection task or tactical Time Machine.

## Historical analytics

`/analytics` reconstructs exact Beta(1,1) estimates from persisted outcomes in processing-time/row sequence. It includes actual tactical and Rapid ID entries, visible priors and evidence limitations. Session A/B comparisons use stored hostile-node averages, failure reasons, asset impacts, pack, seed and observed horizon. They describe differences rather than training causation. Director focus history uses real started adaptive decisions and before/after mastery values. Unit trends average the **currently registered cohort**, retaining unobserved trainees at prior 50%; sequence windows are retrospective estimates, not invented calendar trends or historical roster reconstruction.

## Integrated browser proof — 3 October 2026

All Stage 5 browser observations below used a disposable isolated database and synthetic `ADV-BROWSER` trainee, without changing real Unit Mode history. Machine-readable evidence: [qa-stage5-walkthrough.json](qa-stage5-walkthrough.json).

1. Instructor selected Critical Infrastructure and confirmed RF 140 m, kinetic 110 m and the broader restricted sector. The UI authored **Night Mixed Incursion**, seed 482913, night, decoy then strike, bird + friendly + two RF quads + no-RF FPV, radar degradation and restricted sector. Save, library display and roster assignment succeeded.
2. Trainee held friendly T2 correctly and RF-jammed T4 correctly. At T+29 s, trainee chose RF quad T5 before no-RF FPV T3, then wrongly jammed T3. Server verified **61/100**, with hostile averages **14.33/25 detection, 25/25 classification, 8/15 prioritisation, 23.33/35 engagement**, zero ROE breaches and one projected impact. Observed interval ended at 30.50 s.
3. Priority facts at the inversion: T5 TTI **36.60 s**, risk **1.20**; T3 TTI **27.26 s**, risk **2.16**. One earlier concordant pair and this inverted pair gave tau 0, agreement 0.5, coverage 1 and rounded **8/15**. T3 was 111.6 m away at that exact priority decision, outside the pack's 110 m kinetic range; Ghost correctly permitted Hold until range while explaining that T3 deserved attention first. It separately explained the later no-RF jammer failure. Pack version and 0/8/16 s tactic phases were visible.
4. Authoritative profile became detection 33.33%, classification 83.33%, effector 66.67%, degraded response 33.33%. With Director seed 482914, unchanged Stage 3 selection chose **Detection / Foundational / compressed_warning**, simulation seed 990307611, enriched with **LOW_APPROACH** and the selected pack. It launched successfully. Leaving it unattended until 75 s produced 0/100 and detection 22.22%; this deliberately unattended QA session is not learner improvement evidence.
5. Rapid ID paused and reloaded with its saved 4.7 seconds remaining, then completed ten UI decisions: **8/10 (80%)**, **349 ms median**, one friendly false-hostile and one bird confusion. Classification alone received eight successes and two failures: Beta(13,3), **81.25%** with 14 observations. Other skills remained unchanged at this point. The A/B view displayed exact 61 vs 0 sessions and the Director's actual 33.33% → 22.22% decrease, with no efficacy claim.
6. A separate library drill survived a **real server-process outage** on secure loopback: cached reload, indexed draft recovery, local decisions, pending completion, restart against the same database, immutable uploads and subsequent server verification/Ghost succeeded. Its additional outcomes are recorded as the fourth ledger point, separately from the preceding integrated proof.

The authored QA snapshot predates the final optional Hold/range-precision defaults and intentionally remains frozen. Historical scoring stayed 61; final compilation includes the explicit new defaults. Physical **LAN WAN-off cached reload/start remains pending by user choice**. Secure-loopback process-outage recovery does not close that acceptance item; plain HTTP LAN service-worker restrictions also remain documented in Unit Mode.

## Automated validation

Before coding: backend **65**, frontend **32**, simulation **51**, Director **72**, production build passed. Final source: backend **106 passed** (41 new), frontend **36 passed** (4 new), unchanged original suites plus **135 advanced parity checkpoints** across every 3-pack × 5-tactic combination. Total simulation/Director checkpoint coverage is **258**. Existing tests were not weakened. Advanced parity compares complete scorecards and prioritisation evidence as well as sensor/action outcomes, including injected swarm and sensor commands.

```sh
.venv/bin/python -m pytest server/tests -q
(cd client && npm test)
(cd client && npm run build)
.venv/bin/python scripts/benchmark-advanced.py http://127.0.0.1:8002/api/v1
```

Final backend run: 8.82 s, one existing Starlette/httpx deprecation warning. Frontend: 5972.73 ms, zero failures. Build: 1613 modules, 5.77 s, main JS 1238.84 kB (344.79 kB gzip), worker 8.07 kB, CSS 31.99 kB (7.74 kB gzip). Seven offline assets, fingerprint `7991a719efad`. Existing large-chunk warning remains; no production build failure. Baseline main JS was 1207.70 kB (335.86 kB gzip).

| Requested coverage | Concrete regression evidence |
| --- | --- |
| A–G tactics/determinism | `test_tactics_reproduce_and_change_contact_mechanics` × five; `advanced.test.tsx` 135 cross-language checkpoints. |
| H–M Rapid ID | `test_rapid_rounds_seeded_real_evidence_and_balanced`; authoritative metrics/ledger/retry and sequence/bounds/timeout/conflict tests; frontend monotonic-clock test; ten-round browser proof. |
| N–R packs | Three defaults/invalid selector; material rule effect and frozen reconstruction test after mutating current pack configuration; unavailable-effector and out-of-range Hold tests. |
| S–X authoring | Twelve invalid-contract parameter cases; fault window/restore cases; immutable library save, normal completion/Ghost, group launch and complete-card parity. |
| Y–AE priority | Full/inverted order, empty/single/unengaged, ties/late spawn/injection/ineffective choice, bird/friendly exclusion, safety failure and bounded scores; grounded Ghost evidence. |
| AF–AI analytics | Exact stored comparison, ledger profile reconstruction, current cohort aggregation and actual Director history tests; exact-value frontend table test; browser A/B view. |
| Stage 1–4 regression | All original backend/frontend tests and 51/72 parity checkpoints; six concurrent isolated clients; real process-outage browser recovery. Prior physical Stage 4 evidence remains historical rather than claimed newly repeated. |

## Measured performance

Raw final quiet-run measurements: [qa-stage5-performance.json](qa-stage5-performance.json). Fifty sequential warm microbenchmarks: Red Force enrichment **0.2285 ms**, 15-round Rapid generation **0.1719 ms**, author validation/compilation **0.2807 ms**, six-choice priority calculation **0.0174 ms** median. Unit analytics endpoint: 30 requests, **2.2972 ms** median, 5.6402 ms maximum.

Six simulated trainees, three sessions each, fresh SQLite per legacy/advanced workload. Both completed and verified all **18 sessions**, with duplicate upload ACKs, isolated queued command responses, profile idempotency and database integrity checks. The command was queued rather than applied in this load benchmark; command execution parity is tested separately.

| HTTP operation | Legacy median / maximum (ms) | Advanced median / maximum (ms) |
| --- | --- | --- |
| Event upload | 4.85 / 122.30 | 4.97 / 156.70 |
| Command poll | 2.57 / 70.33 | 2.87 / 102.66 |
| Active session list | 10.33 / 56.81 | 12.92 / 136.63 |
| Unit dashboard | 74.29 / 238.46 | 105.83 / 317.14 |
| Completion / verified scoring | 69.96 / 190.68 | 117.17 / 264.33 |

The advanced workload adds **31.54 ms dashboard** and **47.21 ms completion** median overhead versus the same-run legacy workload; relative increases are about 42% and 67%. This is measurable and is not described as zero degradation. Requests remained sub-second for this six-client run, with correct results and isolation. This limited loopback test does not establish larger-scale or weak-laptop performance. Read-only established profile retrieval avoids unnecessary SQLite writer locks while preserving consistent snapshots. CPU and RSS were unavailable/unmeasured. Earlier development measurements overlapped test/build load; the committed numbers come from the predefined final quiet run, without those processes running alongside it.

## Scope and remaining limitations

All six mandatory Stage 5 acceptance groups have implementation and regression/browser evidence. Optional crew mode is deferred. No classified/validated signatures, official doctrine, combat-readiness score or efficacy claim is made. Sensor ranges and risk weights are illustrative. Urban scenery has no real terrain masking. Authoring is bounded, 75-second urban drills only; the authored difficulty is a label. Beta estimates reflect finite modeled decisions, not real competence. Rapid timing is client-reported and not tamper-proof. Current-cohort unit trends do not reconstruct membership changes. Prototype Instructor/library/pack APIs remain trusted-LAN interfaces without production role authentication. After an ignored SQLite backup and server restart, all 18 existing real session rows remained byte-equivalent by canonical digest, and every stored scorecard/Ghost AAR reconstructed successfully (14 stored v0.2.0 cards and four v0.1.0 cards); SQLite quick_check passed. QA library and skill observations were not copied into the real database. Device queues require the original server and frozen scenario for authoritative completion.

Stage 4's **physical WAN-off cached reload/start remains pending by user choice**; Stage 5 has not declared full Stage 4 acceptance. Stage 6 — **Validation, Resilience, Evidence & Advanced Platform Hardening** — will close that item, evaluate Director versus random selection, support human pilots, scale stress tests, weak-laptop and clean-machine deployment checks, rural terrain/spatial audio, recorded-session import, common sensor/track adapters, portable signed export/import if practical, and submission-candidate hardening. **Stage 6 has not started.**
