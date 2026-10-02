# Ghost Expert + Time-Machine AAR v2

## Baseline and audit

Branch `feature/ghost-aar-v2` starts directly from `7fc31a6bcdec0e7a684345827375255b7d05ac7a`. Before edits: pytest 16 passed (1 existing warning); npm test 11 passed, including both three-seed parity tests (51 checkpoints); production build passed, seven offline assets. `main` and `v0.1.0` remain at `6546816`.

- `GET /api/v1/sessions/{id}/aar` returns SQLite session/scenario/action/command records and its independently reconstructed score. Unit history calls this endpoint internally.
- Replay merges instructor commands and trainee actions by 30 Hz tick/shared order; the worker is the live authority, and Python independently reconstructs the same world.
- Sensor detectability is first successful radar OR EO/IR observation (`detected`), not spawn. Instructor radar overrides and RF/IFF failures are replayed.
- Detection scores 25 points at <=3 seconds, tapering to 0 at 20 seconds. Classification scores 25 for exact type+identity, 12 for correct identity with wrong type, otherwise 0. Final classification is used.
- Reference `ideal` is Hold for non-hostiles, RF jammer for RF-linked hostiles, kinetic for no-RF hostiles. Effective ranges: jammer 180 m, kinetic 160 m. Kinetic is blocked where x<-30 and z>20. Effective non-hostile engagement fails the session. No-RF targets are immune to jamming.
- Engagement is per contact: a successful reference response earns 35 less seven per wrong effector attempt. Timely resolution/holding earns the existing 15-point node. Hostile rows are averaged; each asset impact subtracts 10. There is no Kendall-tau ranking.
- Existing reference debrief is per-contact feedback from the scorer, not an evidence-at-action review. The current two-skill Beta/Thompson profile is derived in `server.main.profile`; Stage 2 does not change it.
- Early ending still scores a 75-second projection. Stage 2 must record the actual finish tick separately to review only the observed interval, and label projected penalties.

## Architecture

The existing Python replay exposes an optional observer, called at initial state, each simulation step, before accepted actions and after actions/commands. Decision extraction reads those reconstructed facts. Execution, scoring and review share the same engagement constraints; there is no parallel simulator or LLM. The canonical Pydantic review contract is `server/review_models.py` and is exposed by the contracts endpoint. The frontend only presents server-generated expectations/explanations.

## Contract and evidence

AAR extends the existing response with `timeline`, `decision_reviews`, `ghost_summary`, `replay_metadata` and hostile `node_averages`. Review IDs are stable within a session. A decision has its track, tick/order, actual action (or explicit omission), expected decision and basis, verdict, reason code, deterministic explanation, observed consequence, final per-contact score node, skill tags and preceding sensor/environment command references.

Available evidence contains sensor availability and current detections, RF signal/IFF response, modeled EO/IR silhouette, observed range/restricted sector and first detectable tick. Failed RF masks both RF and IFF. Previously undetected contacts have no exposed RF/IFF/range evidence. No IFF reply establishes no hostile identity. Quad/FPV geometry is a shared multirotor silhouette; the review does not invent a visually distinct FPV cue. Exact type, identity, physical control link and spawn belong to the separately labelled ground-truth section. Expected classification/hostile response is labelled a ground-truth rubric reference, conditional on establishing identity; explanations do not assert unavailable sensor evidence should have been known.

Detection uses the first reconstructed working-sensor observation, never spawn. A designation within three simulation seconds gets full credit; pause issue timestamps never enter the calculation. Missing observations are unassessable. Ending before the three-second reaction window expires yields `DETECTION_PENDING`, not a missed-threat accusation.

## Reasons and decisions

- Detection: `DETECTION_ON_TIME`, `DETECTION_LATE`, `THREAT_MISSED`, `DETECTION_PENDING`, `NO_EVIDENCE_AVAILABLE`.
- Combined classification/identity review: `CORRECT_CLASSIFICATION`, `WRONG_TYPE`, `WRONG_CATEGORY`, `FRIENDLY_MISIDENTIFIED`, `BIRD_MISIDENTIFIED`, `CLASSIFICATION_NOT_RECORDED`. Identity/IFF shares the real 25-point classification node; no extra identity score is invented.
- Engagement: `CORRECT_HOLD`, `CORRECT_RF_JAM`, `CORRECT_KINETIC`, `NO_RF_JAM_INEFFECTIVE`, `FRIENDLY_ENGAGED`, `NEUTRAL_ENGAGED`, `KINETIC_OUT_OF_RANGE`, `RF_JAM_OUT_OF_RANGE`, `KINETIC_ROE_RESTRICTED`, `WRONG_EFFECTOR`, `RESPONSE_NOT_RECORDED`.
- Consequences: `THREAT_RESOLVED`, `CONTACT_RESOLVED`, `THREAT_IMPACTED_ASSET`, `NO_CONSEQUENCE_YET`. Endings are linked conservatively by contact and observed time, not claimed as single-action causes of an entire session result.

Expectations reuse `ideal` and shared `engagement_rule` constraints. Out-of-range/restricted kinetic reference falls back to Hold; RF-linked targets can have a permitted jammer alternative. A correct defensive Hold can coexist with a lower final engagement node, because the preserved rubric scores eventual reference success and attempts per contact. The UI explains that scope.

## Timeline, scoring and replay

Seven categories distinguish trainee actions, instructor actions, sensor transitions, first contact detection, resolution, asset impacts and score-relevant errors. This is a compact meaningful-event timeline, not a tick dump. Commands use their actual execution tick/order. Decision jumps reconstruct immediately before that action; other ordered events jump after it. Arbitrary scrubbing uses the same TypeScript replay and play/pause advance simulation ticks. Evidence stays pinned to the explicitly selected decision while the replay cursor moves.

`execution_tick` is an optional backwards-compatible completion field, persisted additively in SQLite. AAR review/timeline stop at that actual finish tick. Final score retains the original 75-second projection; projected asset penalties are labelled and future contacts/impacts are excluded from observed review. Older records use final telemetry if present, otherwise only their last recorded event; the finish horizon source is explicit. No finish time is fabricated. Omission reviews retain evidence and instructor context from first detectability, with an explicit evidence tick; a later sensor fault cannot erase earlier evidence or create a false sensor-context mistake tag. Observed impacts that occurred before the end-of-session omission review are still linked.

Score effects show final contact/node values shared across all attempts, never additive per-action points. Hostile-node averages match the scorer's pre-penalty granularity. Impact penalties and effective non-hostile session failure are separate. Mistake counts deduplicate contacts per skill; lost points deduplicate contact/node losses. Sensor-context tags overlap other skills without claiming a causal fault. Focus ranks lost points, then contact error counts, then fixed skill order (detection, classification/IFF, effector choice, degraded response). Ties for largest loss/strongest decision retain stable extraction order. This summary does not change the existing Director/profile.

Verified server reviews are cached with IndexedDB records and exported with the session. Device-only results show verification pending and do not create Ghost expectations. The selected AAR endpoint reconstructs on demand; dashboard/history keeps compact records to avoid reconstructing every saved exercise during polling.

## Limitations

No LLM or external inference is used. All explanations are templates over reconstructed facts. Threat/sensor parameters remain illustrative; this is not validated military doctrine. Prioritisation remains the original simplified timely-resolution/holding metric, with no Kendall-tau ranking. Only recorded accepted actions are reviewed; clicks rejected by the worker are not logged. Legacy finish time may be unknown, and those reviews use a conservative recorded interval. RF availability does not alter a physical RF link. AAR remains tactical 2D replay; it does not reproduce exact camera aim/pixels. Cached reviews can be read offline; generating a new authoritative review requires the original local server. Authentication, LAN Unit Mode, Rapid ID and Stage 3 are unchanged.

## Validation — 3 October 2026

| Check | Result |
| --- | --- |
| `.venv/bin/python -m pytest server/tests -q` | 32 passed, 1 existing deprecation warning, 3.18 s |
| `cd client && npm test` | 20 passed, 0 failed, 1.733 s |
| Existing parity | Both tests unchanged; three seeds, 51 deterministic checkpoints passed |
| `cd client && npm run build` | TypeScript, Vite and offline generation passed; 1606 modules, Vite 3.69 s, seven offline assets |
| Build caveat | Existing large-chunk warning; main bundle 1189.05 kB (330.81 kB gzip) |
| Browser | Instructor commands, FPV error, successful jammer, pause/reload recovery, timeline jumps, scrub/play/pause, cached outage review passed |

Added backend coverage exercises injected contacts, failed RF/IFF masking, radar context, first-detectable timing, never-visible evidence, classification, friendly/neutral safety failure, range/ROE, successful effectors, early-end projection, deterministic summary, serialization/reload equivalence, unfinished/malformed sessions, invalid horizons and stored-score inconsistency. Omission evidence is tested against a later RF fault. Frontend fixtures come from Python-generated authoritative reviews and test actual/expected rendering, unavailable/degraded evidence, instructor events, grounded explanations, device-only fallback, same-tick pre-action seeking and observed contact history. Existing tests were retained.

### Manual night swarm exercise

The repository has a **Night watch** scripted scenario rather than a literal **Night Swarm** scenario. The walkthrough used that existing night scenario plus the existing six-drone swarm injection, without adding a new scenario. Seed 482913, trainee `QA-GHOST-SWARM`, completed session `bd42c670-09f0-42fc-b669-f73654985a60`: 15 contacts, six trainee actions, five instructor commands, 52 timeline items and 17 decision reviews.

1. Started the trainee drill in the in-app browser and selected it in the Chrome instructor console.
2. Jammed radar at T+1.23 s, injected no-RF FPV T9 at T+1.73 s, injected six RF-linked quads at T+1.77 s.
3. Designated/classified T9 and incorrectly used RF jam at T+18.37 s. The live worker showed the attempt had no effect; T9 remained active and impacted the asset at T+35.97 s.
4. Designated/classified T10 and correctly used RF jam at T+19.70 s; the live contact stopped.
5. Paused at T+43.73 s, reloaded the trainee, resumed the saved drill at the same simulation tick, then resumed through the instructor and completed 75 seconds.
6. Opened the server-verified AAR (0/100, nine impacts; intentionally unhandled contacts). T9 showed available radar DEGRADED/no current detection, no RF control link, IFF no reply/identity unconfirmed, multirotor silhouette, 74.8 m and outside the restricted sector. Actual RF jammer / expected kinetic was labelled conditional ground-truth reference, with `NO_RF_JAM_INEFFECTIVE`, observed impact, 0/35 and −10 observed contact penalty, effector-choice and degraded-context tags. T10 showed `CORRECT_RF_JAM`, 35/35 and resolution at T+19.70 s.
7. Jumped to the radar command (tick 37), FPV injection (tick 52), T9 engagement (tick 551) and T10 engagement (tick 591). Pre-engagement reconstruction showed active contacts; play advanced past T10's resolution. Scrubbing Home/End changed the world from T9 absent at tick 0 to T9 impacted/T10 resolved at tick 2250. Pause stopped playback.
8. Stopped the local server, reloaded the service-worker-cached app and reopened the cached verified AAR in device-only mode. The same canonical evidence, explanation, scores and timeline remained readable. Restarted the server and reopened the review successfully. Repeated authoritative HTTP AAR responses were identical (canonical sorted JSON SHA256 `6dc7fa7891cefff80e10b6487996823baf1019fce0893a86a830211ed19a1890`). Stage 1's completion retry remains in place; Stage 2 adds horizon persistence on both completion and retry, with backend reconstruction/reload tests.

Screenshots: [FPV decision](qa/ghost-fpv-review.jpg), [FPV consequence](qa/ghost-fpv-consequence.jpg), [successful jammer](qa/ghost-success-review.jpg). The Ghost panel scrolls internally to reveal consequences and score impact; the timeline also scrolls internally.

### Measured performance

Read-only command: `.venv/bin/python scripts/benchmark-aar.py bd42c670-09f0-42fc-b669-f73654985a60 --output docs/qa/ghost-aar-benchmark.json`. After one warm-up, 20 uncached in-process endpoint runs on this development laptop:

| Measurement | Median | Maximum |
| --- | --- | --- |
| Complete AAR generation | 79.488 ms | 88.891 ms |
| Decision review generation, including authoritative replay/extraction/model validation | 78.730 ms | 88.158 ms |

Full AAR payload: **44,352 bytes** compact UTF-8 JSON, including scenario, action/command logs, scorecard and canonical reviews. Measurements exclude HTTP round-trip and browser rendering, represent this 15-contact session only, and are not a deployment SLA. Raw results are in [qa/ghost-aar-benchmark.json](qa/ghost-aar-benchmark.json). No new runtime dependencies were added.

## Acceptance and changed files

Stage 2 acceptance is satisfied by the automated and browser evidence above. Main, `v0.1.0` and baseline history remain preserved; changes belong exclusively to `feature/ghost-aar-v2` with parent `7fc31a6bcdec0e7a684345827375255b7d05ac7a`. The implementation stays within Stage 2.

- Backend: `server/engine.py`, `server/main.py`, `server/models.py`, `server/storage.py`, new `server/review.py`, `server/review_models.py`, `server/tests/test_ghost.py`.
- Client: `client/src/App.tsx`, `client/src/sim.ts`, `client/src/types.ts`, `client/src/style.css`, `client/package.json`, new `client/src/Ghost.tsx`, `client/src/ghost.test.tsx`.
- Evidence/docs: `README.md`, `docs/GHOST-AAR.md`, `scripts/benchmark-aar.py`, `docs/qa/ghost-aar-benchmark.json`, three `docs/qa/ghost-*.jpg` screenshots.

Next stage: **Stage 3 — AI Threat Director v1: 4-skill adaptive closed loop**. It has not been started.
