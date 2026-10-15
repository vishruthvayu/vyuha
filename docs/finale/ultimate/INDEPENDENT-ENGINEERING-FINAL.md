# Independent engineering acceptance review — 15 October 2026

Inspected the existing `feature/vyuha-ultimate-experience` workspace, HEAD `b1c84db083ce730b3b6190ae4b6aecfd3eff1013`, with the preserving working tree. No reset, protected-ref mutation, production database write, release tag or external physical acceptance occurred. The exact inspected file hashes and review scope are in `receipt.json`. Source is still changing under the integration owner; this report is scoped engineering evidence, not final full-tree acceptance or a new weighted audit score.

## Reproduced blockers

| ID | Actual defect and reproduction | Resolution / evidence |
|---|---|---|
| HISTORY-OBSERVED-01 | `AARHistory.tsx` used observed metadata/executionTick, but `server/main.py:aar(include_review=False)` omitted the observed horizon. Both trainee session history and unit dashboard use that lightweight response. `mergeServerRecord` accepts the remote response and retains only local event batches/Fusion receipts, so a refresh also discarded local executionTick. An early-ended one-second exercise therefore appeared to have its entire scoring horizon observed, even on the original device. Real API reproduction failed before modification. | Scoped overlay moved the existing observed-horizon inference before the lightweight return and added authoritative `executionTick=observed`. Root integrated this correction and four tests. Canonical regression independently passed **4 / zero failed in 2.92s**. Explicit completion, telemetry fallback, last-action fallback and zero-observation legacy cases verify full/lightweight/trainee/dashboard consistency; repeated GETs preserve every logical database row, card, event and command. No historical score or scoring horizon changed. |
| RECORDED-LIFETIME-01 | The actual mounted `Recorded` component permitted late recording A fetches to replace recording B after the user selected B. A deferred-fetch test resolved B then A: dropdown remained B while the heading became A. Actions would then be collected from A while save targets `/recordings/B/practice`. Save result/error promises also lacked a selection lifetime. | Dedicated UI owner implemented context epochs, effect cleanup, scoped imports/saves, synchronous pending-save duplicate exclusion, reset semantics and observation-expiry disabled actions. Integrated source independently passed nine canonical lifetime tests plus the original reproducer (10/10, zero failed, 8.805s); the original deferred-A/B scenario also passed separately inside React StrictMode. `recorded-race.test.tsx` / `recorded-race.log` preserve the original failure; `integrated-recorded-tests.log` and `recorded-strict.log` show the correction. This is a source/UI lifecycle defect, not a file-picker permission issue or a physical-platform limitation. |

## Independently tested boundaries

**114 backend checks passed, zero failed, in 98.66 seconds.** These are selected tests against the recovered canonical implementation before integration-owner modifications. They overlap the full backend suite and must not be added to full-suite totals. The existing Starlette TestClient deprecation was the only warning. Log: `targeted-tests.log`.

- Raw ASGI arbitrary Latin-1/non-ASCII header bytes fail closed without unhandled authorization errors; valid officer/Crew credentials retain their intended scope.
- Source-input policy v2 invalidates freshness for runtime/build/asset/deployment changes and excludes private/generated files.
- Evidence-only reference comparison receives operator evidence rather than hidden canonical truth; references remain separate hypothetical results and do not rewrite original evidence.
- Expert-run API cases preserve original training evidence and reject invalid unsupported histories.
- Crew aggregate owners remain outside individual learning profiles, including transfer and cohort histories.
- Applied/pending teaching-note archives preserve status and ordered attribution; malformed/conflicting signed histories reject atomically, duplicate archives do not accumulate credit.
- JSON transfer survives ordinary JavaScript numeric serialization while preserving integrity, strict schema, re-scoring and duplicate gates.
- Historical acceptance disaggregates tactical, Rapid ID and shared Crew evidence without changing historical scorecards.

Selected files: `server/tests/test_raw_header_authorization.py`, `test_evidence_source_inputs.py`, `test_reference_policy.py`, `test_expert_run_api.py`, `test_mission_crew_cohort.py`, `test_mission_crew_teaching_transfer.py`, `test_portable_browser.py`, `test_history_acceptance.py`.

No new reproduced production authorization, Fusion/Crew cohort isolation, evidence-only reference or archive-integrity defect was found in this scope. This does not certify adversarial security, human readiness, sensor calibration or the full final source.

## Final integrated regression and live acceptance follow-up

Root froze policy-v2 source hash `931ab608c99bb95b011635136709a1d585251a67e2ddc025d57b77cec4bf23c9`. Independent verification compared all **291** source-under-test input hashes with current files: **zero mismatches**, and recomputed the identical policy-v2 aggregate. HEAD remains b1c84db plus the explicitly tracked integration changes; a final code commit is still required. Documentation changes do not alter this source-input hash.

The actual durable final logs independently inspected under project `work/finale/ultimate-experience/final-acceptance-20261015` show:

| Check | Actual result |
|---|---|
| Complete backend | **690 passed**, zero failures, **425.12s**. One known Starlette TestClient/httpx deprecation. |
| Complete frontend | **249 passed**, zero failed/skipped/cancelled, **59,520.156916ms**. |
| Python/TypeScript parity | Final frontend log contains full integrated544 checkpoints, response288, sensors1920, motion eightfamilies, advanced135, rural54, Director twelve templates and original engine/control parity. These overlap the249 tests; do not add checkpoint counts to test totals. |
| ESLint | Passed with max-warnings0. |
| Prettier | All matched files passed. |
| TypeScript/Vite/production cache | Build passed5.62s. **28** cached local URLs; cache/index SHA prefix `46d9d7ac0ec7`. All cached files exist. Vite retains a large lazy Scene-chunk advisory; this is disclosed, not a build failure or evidence of measured startup speed. |
| Baseline historical source | Final history log validates original18 immutable aggregate `cce52299fb319073feb81fc0d3f2420a867ff7393421ca9f69940e9aef051b45` unchanged;25 current tactical AARs/cards/Ghost/four-skill profiles readable;25training+1RapidID=26heatmap entries. A fresh independent exact-original22 rerun also passed against the same931ab608 source: unique original18 plus four of seven later rows (35 combinations, one match) reproduced original22 digest `f9dc8cd8d96e059d03f8759eb9fb80a440d94241f0e6aea302fbc0bee718ea44`. All25 current AARs/cards/Ghost/four-skill profiles were revalidated against this22 baseline without changing source evidence. Receipt: `history-final/receipt.json`. |

### Actual HTTPS, populated transfer and restore

The root executed the independently prepared `live_acceptance.py` in its permitted localhost context. I inspected the actual final receipt at `docs/finale/ultimate/LIVE-ACCEPTANCE.json` and its raw log. **PASS_SCOPED**, 06:30:48–06:31:22 UTC on15October2026, policy-v2 source931ab608 unchanged across the measurement.

- Four actual HTTPS health/HTML requests succeeded with **CA and hostname verification** at127.0.0.1 andlocalhost. The default system CA context rejected the generated private CA. No system/device trust store changed.
- All **35 independently inventoried registered protected route/method pairs ×4 negative credential modes =140** actual requests returned401. Modes were anonymous, forged Latin-1 bearer, actually revoked token and ambient cookie. Donor logical DB remained unchanged. Expired-token handling is tested in the backend suite, not falsely labelled a live eight-hour wait.
- Actual HTTPS export/import into a fresh receiver retained **three completed sessions**, **six Fusion receipts**, **one teaching note**, **two frozen Director histories** and **one shared Crew archive**. Ordinary JavaScript JSON numeric conversion was exercised.
- Re-exported complete payload matched exactly, including scores, profiles, actions, commands, observed horizons, notes and Fusion data. Actual receiver AARs preserved original scorecards/actions/commands/horizons.
- Duplicate import inserted0/skipped3, without changing receiver evidence. Altered score returned422 and changed no logical rows.
- Shared Crew imported as archive with **zero live crews/members/capabilities**, and no shared session entered the individual outcome ledger. Receiver contains two individual outcome rows and four individual skill-profile rows.
- Online backup and new-file restore matched all logical tables exactly, integrityok; overwrite was refused. Receiver/restored table SHA256 both `e569f3ac1696d8ec69f84530d0bb6c3e92ea577e215f30895ca2264a868d53e3`.

Independent follow-up also opened the actual private receiver/restored databases read-only: every table matched, with the same e569f3ac digest. Actual server logs contain140 donor401responses, three receiver import POSTs and one422, corroborating the transport receipt without exporting private records.

This is software loopback transport/archive/durability evidence. It does not close browser/device CA trust, native platform or physical LAN/WAN-off gates. The harness privatekeys/auth/database directory must not enter Git or public evidence.

## Reconciliation and release gates

The earlier207-row reconciliation was stale; the documentation owner has now preserved all207 original identities and added FIX18/FIX19, yielding209rows, refreshed to b1c84db plus identified working-tree source. It defines six dispositions and archives RC2 acceptance without rewriting its bytes. The current table still needs final690/249/live workflow receipts and the final source commit before acceptance closure. Each updated closure needs the real commit, current implementation references, specific tests and actual workflow evidence; planned/deferred model proposals remain unimplemented functionality.

The old RC2 gate files are now explicitly archived under `rc2/pre-ultimate-acceptance/`. Living Ultimate gates remain OPEN, which is accurate until the remaining browser/performance/clone/manifest/remote acceptance is sealed. They currently carry older685/240 checkpoint metadata; update this to final frozen-source receipts before publishing a candidate. Correct source-mismatch reporting in `/system/evidence` is not itself a final current manifest.

The rain/dust, active optical pointing, GNSS/interceptor/loitering, acoustic/micro-Doppler, automatic weak-sector and calibrated difficulty proposals retain technically justified deferrals in `FEATURE-SELECTION-DECISIONS.md`. Their adjacent existing code/tests do not prove these proposals implemented. Additional functionality should require a distinct training decision, frozen contract, dual-engine parity and historical/transfer compatibility, rather than inflate the roster during release acceptance.

The remaining work is **not only Crew scrolling and final tests**: this independent review found two real data-presentation/lifetime defects, now fixed and in the final690/249 run. Actual live transfer/restore/HTTPS is now passed within the stated loopback scope. Remaining release acceptance includes browser/responsive/100%-zoom workflows, bounded performance, clean clone, exact manifest/final commit/remote pin and integrated source/rendered review. Root's other independent workstreams may close these with current evidence; they cannot be passed by historical test totals alone.

## Protected refs and external boundaries

Read-only verification preserved:

- `release/v1.0.1` and peeled `v1.0.1`: `2ca96105044ad6a14952d74db619e20006c26eca`.
- Peeled `v1.1.0-rc.1`: `a2183e1a5746c8a04fa25ff81af952faa76b27aa`.
- Peeled `v1.1.0-rc.2`: `bfe221fb5ad3ac2519277e342761bd770b3e80d8`.

Final exact-candidate native Windows/Linux, Android, browser/device CA trust, separate physical LAN/WAN-off acceptance remain pending. Current loopback, CSS viewport and jsdom checks cannot close them. No stable release approval or new numeric audit score is assigned.

## Current gate verdict

No unresolved reproduced release-blocking runtime-source defect remains in this independent engineering scope after the history/Recorded fixes. **This is conditional engineering PASS_SCOPED, not approval to seal an RC yet.**

| Gate | Current engineering disposition | What still blocks a new software candidate |
|---|---|---|
| G01 full final regression/build/lint/format | PASS for exact931ab608 source | Publish source/log receipt and final commit pin; rerun only if source changes. |
| G02 parity/original history/profile isolation | PASS_SCOPED: final parity, original18 exact, original22 exact and25current records revalidated | Retain both original aggregate digests and the new sanitized22 receipt; no runtime blocker remains in this scope. |
| G03 security/Crew/replay/transfer/durability | PASS_SCOPED: final suites plus actual140authorization/three-session transfer/restore | Preserve exact receipt and explicit loopback/device limits. |
| G04 meaningful browser/responsive/accessibility | OPEN under root browser owner | Complete final state workflows, current screenshots/geometry/keyboard proof and independent rendered acceptance. |
| G05 bounded performance/recovery/resource lifecycle | OPEN until current source-specific measurements/unchanged-module carryforward are explicit | Do not re-label dated a2040fb timings as new931ab608 runs. FPS, replay and HTTP measurements remain distinct; retain exact outage/Fusion ordering receipt. |
| G06 clean clone/assets/locks/source/remote seal | OPEN | Reproduce final committed source from a clean clone, verify byte-equal assets/locks and manifest; confirm exact pushed commit. |
| G07 independent reviews/reconciliation | Engineering findings closed within measured scope; rendered/document finalization OPEN | Update209rows and living gates from actual final receipts, complete independent UI review and source seal; no fabricated numeric score. |
| G08/G09 physical exact-candidate acceptance | EXTERNALLY PENDING | Mandatory for stable approval; do not falsely block a software-only RC once G01–G07 appropriately pass. |

Optional rain/dust/newthreat/effector/activeoptics/newAI/VR proposals remain explicit justified deferrals, not additional mandatory runtime defects. Native/device/network/scientific limits remain unperformed evidence, not fabricated architectural failures.
