# Independent integrated engineering review — 15 October 2026

Reviewed canonical `feature/vyuha-ultimate-experience` at `a2040fb91fd6954573f638180a54951ecf915ea3` plus the preserving working tree. The production backend and simulator modules listed in the accompanying source manifest match a2040fb exactly. Root-owned UI changes continue; these measurements are a scoped checkpoint, not final whole-tree software acceptance. No new weighted audit score is assigned. The supplied 89/100 describes RC2.

## Reproduced actionable finding

`HIST-GATE-01`: `scripts/check-finale-history.py` incorrectly equated total heatmap sessions with ordinary completed training sessions. The heatmap deliberately includes Rapid ID. The actual current database contains 24 completed normal sessions and one completed Rapid ID outcome, so the original script fails at its aggregate assertion after successfully checking all 24 AARs and cards. This is an acceptance-tool defect, not evidence of score or learning-profile contamination.

The proposed correction independently counts eligible individual training and Rapid ID results and verifies both components and the exact total. Shared Crew owners are excluded, with a separate count. It retains all immutable-row checks and strict equality; no historical card, API, scoring rule or existing test is changed. Four new regression cases passed in **7.23 seconds**: real mixed training/Rapid ID succeeds, altered ordinary counts reject, altered Rapid ID counts reject, and completed Crew remains readable while yielding no individual heatmap credit.

Files proposed for integration: `scripts/check-finale-history.py`, `server/tests/test_history_acceptance.py`. Overlay source was tested before integration; rerun after root integrates it and in final combined regression.

## Verified scoped evidence

| Boundary | Source | Independent result and limits |
|---|---|---|
| Malformed/non-ASCII HTTP authorization | `server/auth.py`, `server/crew.py`; `test_raw_header_authorization.py` | Raw ASGI tests passed; Latin-1 decoding covers unrelated arbitrary HTTP-header bytes without bypassing officer or Crew checks. |
| Source freshness | `server/evidence.py`; `test_evidence_source_inputs.py` | Build/runtime/deployment-input mutations invalidate policy-v2 freshness; private/generated outputs do not. Historical manifest policies remain unchanged. Current `docs/finale/evidence.json` is historical and must be regenerated only after acceptance. |
| Frozen engine dispatch | `server/engine.py`, frozen modules; `test_historical_dispatch.py` | Legacy traces/cards match frozen engines; unsupported versions and invalid horizons reject. |
| Crew cohort isolation | `server/crew.py`, `director.py`, `units.py`, `heatmap.py`; `test_mission_crew_cohort.py` | Shared history, roster continuity and transfer do not grant individual Beta credit. |
| Teaching-note archive integrity | `portable_teaching.py`, `portable.py`; `test_mission_crew_teaching_transfer.py` | Applied/pending notes retain their real status, bad signed metadata rolls back, conflicting duplicate history rejects and identical duplicate history does not accumulate. |
| Evidence-only reference | `expert_run.py`, `expert_run_api.py`, `reference_policy.py`; corresponding tests | Conservative evidence policy, resource limits, original-history immutability and explicit unsupported archived-card errors passed. Canonical reference remains deliberately distinguished from available evidence and is hypothetical. |
| Mutable sensor boundaries | `server/sensors_v2.py`; `test_sensor_memory_copy.py` | Prepared internal scalar copies remain detached; unknown/nested extensions retain deepcopy and incomplete input is not silently repaired. |

These eight groups together yielded **116 passed / zero failed in 95.89 seconds**, with the existing Starlette TestClient deprecation and an environmental pytest-cache write warning. The counts overlap complete-suite coverage and are not additive to 681. No independently reproducible new production authorization, Crew/Fusion/replay or transfer defect was found in this scope; this statement is not an adversarial penetration-test certification.

## Historical preservation

A source filesystem copy was made only after establishing that its WAL was absent or empty. Testing then used a disposable SQLite backup. Original source database bytes were rehashed and remained unchanged.

- Original baseline **18** immutable-row digest: `cce52299fb319073feb81fc0d3f2420a867ff7393421ca9f69940e9aef051b45` — exact.
- Original stored **22** immutable-row digest: `f9dc8cd8d96e059d03f8759eb9fb80a440d94241f0e6aea302fbc0bee718ea44` — exact.
- The original22 set was recovered by its pre-existing full immutable aggregate digest: the baseline18 plus a unique four-record subset among six later rows (15 combinations), without changing or hiding any score.
- Current database has **24** completed ordinary sessions, including two later additions. All 24 authoritative AARs, stored cards, Ghost timelines and four-skill profiles were readable.
- Disaggregated heatmap: **24 training + 1 Rapid ID = 25**. Shared completed sessions in this particular source: zero. Crew exclusion is exercised separately by real fixture workflows.

The current24 digest is `025d2a0d42ded21fe423affaddc81c64e9e0907383deced6de63b46d336a48b0`; it must not replace the original22 baseline or be portrayed as the earlier22 fixture.

## Replay performance reproduced separately

The Node harness copies the exact current replay-module inputs and compares only the parent/current sensor implementation. It uses identical frozen rural DIRECT scenarios, three hostile contacts and remaining birds, a 60-second/1800-tick horizon, no actions/commands, an excluded warm-up pair and three alternating measured pairs. Timer wraps replay only. Full snapshot, event, command and scorecard SHA256s match in every repeat.

| Contacts | Parent sensor median | Current sensor median | Full replay equality |
|---:|---:|---:|---|
| 8 | 351.957 ms | 151.016 ms | PASS |
| 50 | 1710.496 ms | 699.745 ms | PASS |
| 200 | 7134.092 ms | 3089.943 ms | PASS |

Node v25.2.1; source sensor hashes: parent `6b72c184a4ea051b0a03e2fc4f5b37bb362266b58ed752563daaa222e519c92b`; current `61a22919e30a58df5d7042d64f0053b1670792342a8d697cc9d9c5de5a882ea0`. Shared workstation work affected runtime and variance; these are new measured values, not a restatement or replacement of the October14 205/37, 1254/184, 6172/773 checkpoint. They are neither browser FPS nor server HTTP latency. Public configuration validation remains active; the full sensor-parity/malformed-input tests still belong in final regression.

Python sensor source `d53d7fb14e44485db97961fd7d2426bafb7f54e3c7b9409286f5e828bf99768f` already contains the Cycle2 optimized implementation. Reintroducing that optimization would duplicate existing code. The official direct/actual-HTTP benchmark was attempted in the child sandbox and failed on localhost bind permission before measuring any sample. Root must execute it in its granted context; no synthetic replacement is labelled HTTP evidence.

## Software work remaining beyond Crew keyboard scrolling

| Requirement | Current disposition |
|---|---|
| Historical acceptance helper | Confirmed defect, tested overlay correction awaiting integration and final regression. |
| Ten manual UI/UX findings | Root implementation in progress; meaningful real states and before/after screenshots at actual 100% zoom remain acceptance requirements. |
| Every major route, active training, authenticated Instructor, shared Crew, completed AAR, Analytics | Actual browser interaction and independent visual critique remain open; source rendering alone is insufficient. |
| Current server reconstruction, current fixed-tier browser FPS and bounded performance | Final source-specific receipts remain required; dated Node/Python/FPS values must stay separated. |
| Outage ordering/deduplication, Fusion receipts, notes and populated Transfer/restore | Existing checkpoint tests/evidence are useful; final actual-server/browser workflows and durable receipts remain required. |
| Complete combined regression after last source change | Mandatory; 681/234 and this116 are prior/scoped checkpoints. |
| Clean clone, production assets, exact evidence/source hash | Mandatory before immutable candidate. |
| Release documentation freshness | `PERFORMANCE-REPORT.md` opens with historical e07a384 current/frozen wording; other RC1/RC2 acceptance documents retain earlier current language. Archive/label those scopes and publish a separate accurate latest receipt. |
| Scientific/new-model proposals | Explicit selection decisions remain deferred/rejected, not implemented. Versioned contracts, independent observation value, parity, historical and transfer compatibility are required before adding rain/dust, active optics, acoustic/micro-Doppler, GNSS/interceptor/loitering or calibrated difficulty models. Their absence must be acknowledged; no field or learning efficacy is inferred. |
| Physical final-candidate Linux/Windows/Android/HTTPS/LAN/WAN tests | Externally pending; earlier loopback and emulated widths cannot pass these gates. No stable release approval. |

This is **not** a finding that only Crew accessibility and final verification remain. The user’s new UI findings, a genuine acceptance-tool bug, final source-specific workflow/measurement receipts and documentation reconciliation are still actionable. Optional model research does not justify holding the software candidate indefinitely, but cannot be counted as completed functionality.
