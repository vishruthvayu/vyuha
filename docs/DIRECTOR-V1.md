# AI Threat Director v1 — Stage 3

Completed 3 October 2026 for Team WhiteList&0. Individual, local-server adaptive training; no LLM. Stage 4 has not started.

## Repository and baseline audit

Branch `feature/director-v1` starts directly from Stage 2 commit `42aa63167795118d4d7f7811a9f0ee758d8bf7d5`. Main and peeled `v0.1.0` stay at `654681611bf0028fa40f38e9f116d03c64ca3a8b`. Before source changes: **32 backend tests** passed (2.86 s), **20 frontend tests** passed (2298.203 ms), production build passed (1606 modules, 3.71 s), **7 offline assets**, **51 cross-language checkpoints**. Existing backend deprecation and build chunk-size warnings were already present.

The existing `/trainees/{trainee}/profile` derived two Beta(1,1) estimates, `recognition` and `response`, from completed scorecard percentages. Adaptive generation sampled those estimates; response focus added a no-RF contact. Profiles were reconstructed rather than independently persisted. SQLite already stored issued scenario specifications, trainee/session IDs, actions, instructor commands and completion scores. Scenario specifications retained seed, night, fog, radar-gap timing and every contact's type, identity, RF link, spawn, bearing, distance, speed and altitude.

Stage 2 Ghost already supplies canonical decision kinds, verdicts, reason codes, available-sensor evidence and the four required skill tags. Its summary chooses a review focus by deduplicated node-point loss; that summary is not the Director. The Stage 3 update reuses `build_review` and the same simulation/scoring/replay. Those engines, instructor architecture and worker are unchanged. The existing profile endpoint and scenario generator are extended; SQLite gains three additive tables, not another storage service. The original two scorecard percentages remain legacy session metrics and do not drive Director v1.

## Stage 3 file manifest

26 files changed: implementation/contracts, tests, benchmark, documentation and recorded QA evidence. Installed dependencies, generated build output and SQLite training history are excluded by the existing ignore rules.

- `README.md`
- `client/src/App.tsx`
- `client/src/Ghost.tsx`
- `client/src/style.css`
- `client/src/types.ts`
- `server/main.py`
- `server/storage.py`
- `client/src/Director.tsx`
- `client/src/director.test.tsx`
- `docs/DIRECTOR-V1.md`
- `docs/qa/director-anti-rote.jpg`
- `docs/qa/director-benchmark.json`
- `docs/qa/director-choice.jpg`
- `docs/qa/director-correct-aar.jpg`
- `docs/qa/director-error-aar.jpg`
- `docs/qa/director-final.jpg`
- `docs/qa/director-instructor-aar.jpg`
- `docs/qa/director-walk-after-correct.json`
- `docs/qa/director-walk-after-error.json`
- `docs/qa/director-walk-after-smoke.json`
- `docs/qa/director-walk-before.json`
- `docs/qa/director-walkthrough.json`
- `scripts/benchmark-director.py`
- `server/director.py`
- `server/director_models.py`
- `server/tests/test_director.py`

## Skill model and evidence

Exactly four canonical skills are used across backend, database, API and frontend:

| Skill | Successful authoritative evidence | Failed authoritative evidence |
| --- | --- | --- |
| `detection` | Ghost judges timely designation correct | Late designation or missed threat within the observed interval |
| `classification_iff` | Correct type and friend/neutral/hostile classification | Incorrect type or identity, including bird/friendly errors |
| `effector_choice` | Correct hold, RF jammer or kinetic decision under the existing rule | No-RF jammer, wrong response, range or restricted-zone violation judged incorrect |
| `degraded_sensor_response` | Correct decisions with radar non-normal or RF sensor unavailable | Incorrect decisions under those same actual sensor conditions |

**All four preserve the existing Beta(1,1) prior.** The proposed Beta(2,2) would change the stable prior's strength; no such silent change is made. Historical two-skill percentage posteriors are not numerically relabelled as four new skills. Instead, completed historical sessions are reconstructed with authoritative Ghost evidence and processed once using this mapping.

For every skill:

```text
alpha = 1 + sum(session successes)
beta = 1 + sum(session failures)
observations = alpha + beta - 2
mastery_estimate = alpha / (alpha + beta)
```

The aggregation unit is **one contact × skill × session**. Multiple correct actions for one contact do not multiply successes. Any evidenced incorrect decision makes that contact's skill observation a failure even if corrected later; repeated errors also remain one failure. `unassessable` verdicts are excluded. Untouched classification and effector skills receive no observation. Early completions review only the recorded execution horizon: projected future impacts in the preserved 75-second score do not become fabricated future skill observations. Degraded evidence intentionally overlaps a base skill but is deduplicated across all decisions for the contact. No sensor fault means no degraded-sensor observation.

These percentages are **VYUHA training mastery estimates, not validated operational competence**. The UI shows Beta parameters and observation counts. Zero observations is labelled “Baseline prior”; fewer than five is labelled “limited evidence”. This five-observation label is a simple disclosure threshold, not a statistical confidence interval.

## Persistence, transactions and provenance

- `skill_profiles`: `(trainee, skill)` primary key; alpha, beta, updated_at, last_session_id.
- `skill_outcomes`: unique session_id, trainee, compact four-skill successes/failures, processed_at and mapping version `director-v1`.
- `director_history`: unique started session_id, trainee and issued decision including fingerprint/profile snapshot.

Completion uses one `BEGIN IMMEDIATE` transaction: reconstruct the server-issued scenario and accepted action/command log, compute Ghost and authoritative score, persist completion, insert session outcome, update all four posteriors, commit. A failure rolls everything back. A completed-session retry returns the stored score; the unique outcome key prevents double increments. Preview generation, live sessions and device-only scores cannot update mastery.

The profile endpoint backfills unprocessed completed history in deterministic chronological order after comparing reconstructed and stored scorecards. Corrupt/unreconstructable legacy sessions are excluded and listed as `unprocessed_sessions`; they are not silently converted into observations. The read includes all compact session outcomes, making every alpha/beta rebuildable by the formulas above. Rebuildability is provenance plus tested reconstruction, not an operator-facing reset tool. New tables are created additively on normal startup.

Historical reconstruction can make the first profile read slower than a warm read. Profile results and recent history are read separately during generation; v1 is intended for local individual use, not a concurrently administered authenticated fleet.

## Director contract, selection and difficulty

`POST /api/v1/scenarios/generate` extends the existing endpoint:

```json
{"mode":"adaptive","trainee":"CADET-01","seed":2}
```

It returns the complete existing Scenario with additive `director_decision`. Scripted generation retains its previous behavior. `/api/v1/contracts` exposes `TrainingProfile` and `DirectorDecision` schemas. The decision contains individual mode, trainee, Director seed, canonical focus, Beta mean, observations, difficulty/label, heuristic target, reason code/text, recent counts, template, simulation seed/features, fingerprint, anti-rote result, debug samples and profile snapshot. Creating an adaptive session under another trainee ID is rejected.

The backend alone uses `random.Random(director_seed)` and draws one Beta value per skill in the canonical fixed order. It selects the **lowest sampled mastery**, with that fixed order breaking ties. It then shuffles three templates, applies anti-rote filtering and derives a 32-bit simulation seed from the same RNG. No LLM, independent client Director or uncontrolled selection randomness is used.

| Selected skill's Beta mean | Difficulty |
| --- | --- |
| `< 0.40` | 1 — foundational |
| `0.40 ≤ mean < 0.70` | 2 — standard |
| `mean ≥ 0.70` | 3 — challenging |

Approximately 70% success is a **heuristic difficulty target, not a predicted success probability or calibrated educational optimization**. There is no fitted performance model or training-efficacy experiment.

The UI displays the Beta **mean**, never the Thompson draw as mastery. Debug samples remain in the API for tests. Fresh profiles receive `INITIAL_ASSESSMENT` and limited-history language. Otherwise `LOWEST_SAMPLED_MASTERY` explains that seeded sampling selected the skill and quotes actual successes/failures in its last five processed sessions. A selected skill with no observations is explicitly a baseline prior. The text does not invent semantic mistake patterns from aggregate counts.

Given an identical profile (including provenance metadata), last-five history, seed, candidate definitions and backend runtime, the full decision and scenario are reproducible. Different posteriors or started history can change a repeated seed. Python Beta RNG implementation is backend-only; cross-language parity applies to the generated simulation, not Beta draws. Versioned candidate definitions/runtime must be retained when replaying the selection itself; issued scenario specifications are persisted for simulation replay regardless.

## Scenario adaptation matrix

There are **12 template IDs**, each parameterized at **three difficulty levels**: 36 distinct world configurations checked as playable. All parameter changes use existing simulator fields.

Shared level controls: initial base contact count 5/6/8 (background variants add one), fog 0.08/0.25/0.50, hostile speed multiplier 0.75/1/1.15 and hostile starting-distance offset +15/0/−12 m. Level 3 uses night. Template variants also offset spawn timing by −30/0/+30 ticks and bearings by 0/12/24 degrees before focus-specific overrides.

| Focus | Three templates | Material changes |
| --- | --- | --- |
| Detection | `wide_watch`, `compressed_warning`, `background_watch` | Hostile starting distance +5/+20/+35 m by variant; compressed-warning variant adds ×1.2 speed; background variant adds a bird. Level 3 adds a radar gap at T+15–27 s, night and higher fog. |
| Classification / IFF | `mixed_identity`, `multirotor_mix`, `bird_screen` | Baseline bird/friendly/hostile mix; multirotor variant replaces neutral bird and fixed-wing with visually similar quad contacts, with differing identity/link; bird-screen adds a second bird. Level 3 adds T+20–26 s radar gap. |
| Effector choice | `link_contrast`, `restricted_approach`, `range_check` | Early RF-linked T3 at T+2 s / 130 m and no-RF FPV T5 at T+3 s / 135 m, friendly contact included. Restricted variant puts the fixed-wing on bearing 325° / 150 m; range variant starts the RF target at 185 m, requiring a range wait. |
| Degraded sensor response | `radar_gap`, `night_gap`, `mixed_gap` | Gap begins T+4/2/1 s by variant and ends T+12/20/30 s by difficulty; hostile spawns move into the gap. Night-gap and mixed-gap use night even below level 3, with different timing, spawn and bearing patterns. |

The scripted radar-gap field in the existing engine produces zero radar detections during the window; the existing instructor “jammed” command instead reduces the radar factor. The card therefore says **radar gap**, not a newly invented sensor model. RF/IFF remain available during these generated gaps. No built-in RF-failure scenario field exists, so generated templates do not pretend to fail RF; instructor RF failure/restoration continues to work. Altitude remains a scene parameter and is not used as an invented detection difficulty knob. Night is the existing visual environment, not an added detector-performance model. Fog and range affect existing sensor observations. Signatures, ranges, threats and responses remain illustrative.

## Anti-rote and launch flow

Each issued decision has a SHA-256 categorical fingerprint over template, difficulty, day/night, kind/identity/RF contact mix and radar-gap timings. The decision/fingerprint is stored when a drill **starts**, not whenever a user previews it. Filtering uses the stronger categorical **template-history rule**: reject any of the selected skill's three templates used in the last five started Director sessions for that trainee. If all collide, choose the least-recent template deterministically. An immediately repeated template is avoided whenever alternatives exist. Filtering does not block generation. It is not semantic/embedding similarity.

The training ground loads the authoritative four-skill profile. Choose Adaptive, optionally set the Director seed, then **Prepare adaptive drill**. Review focus, mean, evidence, reason, level, actual conditions, scenario seed and repetition result before starting. Conditions are Director-selected. Launch submits the exact returned scenario ID and initializes the worker with that same specification; it never regenerates the drill client-side. Completion clears the preview; Next drill returns to preparation. Adaptive generation requires the original local server. Existing scripted device practice remains available.

## Validation and browser proof

Final source checks on 3 October 2026:

| Check | Result |
| --- | --- |
| Backend | **50 passed**, 1 existing Starlette/httpx deprecation warning, 7.90 s; all original 32 tests retained |
| Frontend | **25 passed**, zero failures, 3004.353 ms; all original 20 retained |
| Existing parity | **51 checkpoints** retained and passing |
| New Director parity | 12 server templates × 6 checkpoints = **72 additional checkpoints**, passing |
| Production | TypeScript + Vite passed; 1607 modules; 3.83 s; 7 precached assets; hash `b4aa86626d4f` |
| Build size | Main bundle 1193.52 kB / gzip 331.90 kB; existing >500 kB warning remains |
| Scenario matrix | 36 distinct configurations; careful expert completes all with no major Ghost errors |
| Persistence | Full profile equality before/after local server restart passed |

Tests cover idempotent completion, provenance rebuild, rollback, active-session exclusion, corrupt legacy exclusion, each skill's success/failure mapping, correction deduplication, prior uncertainty, exact difficulty boundaries, deterministic focus and scenario, strongly weak-skill fixed-seed targeting, preview/history separation, anti-rote fallback, owner validation, exact prepared launch and updated UI values.

### Actual closed loop — `QA-DIRECTOR-WALK`

No manual database edits. Existing history was established by one ordinary API-created, server-verified full expert drill (`0a8b442b-30e9-4261-bd92-99ddc7777875`), not by fabricating posterior rows. The subsequent exercises, instructor controls, adaptive preparation and engagements used the trainee/instructor browser UI.

1. Before the mistake, detection/classification/effector were Beta(9,1), mean 90%, eight observations; degraded was Beta(1,1), zero observations.
2. Night Watch (`339aa070-5686-483c-9fd6-e5985247d3b9`): instructor injected no-RF T9 at tick 6 (T+0.20 s). Trainee designated at T+0.77, classified at 1.17 and wrongly jammed at 1.47. Completed at tick 52 (1.73 s). Server Ghost returned **`NO_RF_JAM_INEFFECTIVE`**, tagged **`effector_choice`**. One effector failure changed Beta(9,1) → **Beta(9,2), 81.818%, nine observations**. Detection/classification became Beta(10,1); unobserved future contacts did not add skill outcomes.
3. Validation **Director seed 2**, explicitly chosen for reproducible effector focus, selected `effector_choice/link_contrast`, challenging level 3, simulation seed **4018851090**. Card showed mean 82%, nine observations, eight recent successes/one failure, actual night/fog/RF/no-RF/friendly conditions. This is not a claim that every seed forces the last mistake's skill.
4. Started that exact returned scenario (`afde8e0e-3fb0-49fb-aff6-0ca44c30cea5`). Correct RF jammer resolved T3 at T+2.93 s; correct kinetic resolved no-RF T5 at **T+14.63 s**, range 84.2 m. Completed at tick 447 (14.90 s). Ghost verified both choices. Effector became **Beta(11,2), 84.615%, eleven observations**. The same session honestly recorded T5 late detection and T4 missed: detection became Beta(11,3), 78.571%; classification Beta(12,1), 92.308%. This early-ended session scored 1/100 after projected future impacts; successful effector observations are not a claim of a full-session pass.
5. The same seed 2 with the updated profile selected the then-unobserved degraded skill rather than forcing effector. Validation seed **30** selected effector and avoided the started link-contrast template: `effector_choice/restricted_approach`, simulation seed **3788461615**, **one recent template rejected**.
6. Started this adaptive drill (`1409b5c5-f45c-4590-8485-ef13804942d9`), injected no-RF T9 and jammed radar through Instructor at tick 7 (T+0.23 s). Correct kinetic at **T+1.37 s**, range 135.7 m; completed tick 51 (1.70 s). Ghost verified the response with degraded radar/no RF link evidence. Effector became **Beta(12,2), 85.714%**, degraded **Beta(2,1), 66.667%, one observation**; detection Beta(12,3), 80%; classification Beta(13,1), 92.857%. The early 0/100 projected score remains visible and is not hidden.
7. After server restart and final UI reload, the four estimates persisted and rendered 80/93/86/67%. Seed 2 prepared a Day standard degraded drill, radar gap T+4–20 s, simulation seed 117874757; the single degraded observation was labelled limited evidence. No additional session was started.

Evidence: [before](qa/director-walk-before.json), [after error](qa/director-walk-after-error.json), [after correct practice](qa/director-walk-after-correct.json), [after instructor smoke](qa/director-walk-after-smoke.json), [session evidence](qa/director-walkthrough.json). Screenshots: [mistake AAR](qa/director-error-aar.jpg), [Director choice](qa/director-choice.jpg), [correct AAR](qa/director-correct-aar.jpg), [anti-rote](qa/director-anti-rote.jpg), [adaptive instructor AAR](qa/director-instructor-aar.jpg), [final profile/card](qa/director-final.jpg). Earlier screenshots precede the final UI wording/seed-label polish; JSON retains the verified facts.

## Measured performance

Reproduce the production runtime measurements with `scripts/benchmark-director.py`:

```sh
.venv/bin/python scripts/benchmark-director.py afde8e0e-3fb0-49fb-aff6-0ca44c30cea5 --runs 50 --output /tmp/director-benchmark.json
```

The source session must exist in the local database. The script uses a disposable database and does not alter real trainee history. It is a runtime microbenchmark, not the deferred simulated-learner training experiment.

| Path | Median, 50 measurements |
| --- | ---: |
| Profile update: aggregation + SQLite transaction/commit | **0.423 ms** |
| Director: pure fixed-profile/history seeded selection | **0.031 ms** |
| Scenario generation: production profile/history reads, selection, adaptation and SQLite scenario insert | **1.410 ms** |

[Raw result and scope](qa/director-benchmark.json). Timing excludes prior authoritative AAR reconstruction, HTTP round-trip and browser rendering. Stage 2's separate AAR/Ghost medians (79.488/78.730 ms) remain historical measurements, not newly remeasured here. Host load, history size, cold backfill and filesystem affect timings.

## Limits and next stage

No validated competence percentage, calibrated success probability, training-efficacy claim, new threat/sensor model or LLM. Thompson sampling explores uncertainty; it does not always select the lowest mean or the last error. Contact outcomes are conditionally based on the existing Ghost/rubric and model evidence; logs remain reproducible rather than tamper-proof. IDs are local pseudonyms, without authentication. History/profile payloads are unpaginated and anti-rote considers only five started Director sessions. Generated degradation covers existing radar gaps; instructor controls supply RF failure. Current two-metric unit overview remains the existing local dashboard, not full Unit Mode.

No Stage 4 features, JWT, MongoDB, Rapid ID, doctrine editor, VR, monitoring, USB sync, Kendall-tau, learner experiment, final deck or video were built.

**Next: Stage 4 — Real Unit Mode + Multi-Laptop LAN Training.** Stop at tested, committed and pushed Stage 3; start Stage 4 only on a new request.
