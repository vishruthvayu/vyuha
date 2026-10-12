# Remaining audit gaps — individually inspected, 12 October 2026

Snapshot: `8dc840552778a5996aaad52c52573a1c517254b8` on `feature/vyuha-finale-edition`. All **41 PARTIAL findings** are retained below. This inspection does not change the93-row status matrix or automatically rescore the82/100 provisional audit. Physical/native evidence remains pending; hardware simulation and existing macOS receipts are not substitutes.

## Highest-value software changes now

1. **X07 Crew capability lifecycle:** explicit expiry/revocation/rotation across state, actions and shared review. Denial tests must cover wrong crew, expired role, old code after rotation and idempotent retry; original attribution remains immutable.
2. **F06/X15 longitudinal Crew coordination:** officer-only completed-session history with role counts and logical handoffs. Preserve imported archives and exclude shared outcomes from every individual learning endpoint. Trends are descriptive, not validated competency.
3. **X18 requirement-specific live proof:** replace identical matrix-only links with whitelisted working route and targeted receipt/document mappings, preserving all93sourcefindings and explaining required sign-in/setup.
4. **SC18/F01 teach-pause provenance:** persist instructor explanations tied to authoritative session tick/command and show in AAR/transfer without adding trainee score credit.
5. **CH16 dashboard cost:** profile known roster/history query count and latency, then consolidate N+1queries or safely cache only immutable/static portions; do not claim100fullreplays/poll.

X21 legacy difficulty clarification is a smaller justified usability fix: it is authored metadata; Composer already changes concurrency limits. P2-02/CH14 support cohesive hook extraction and enforceable formatting after correctness remains green.

## Stale audit assumptions corrected

- App148/166compressed-line descriptions are historical. Current source is formatted, about2,538lines; decomposition/linter enforcement remain separate gaps.
- Bash-only/noPowerShell descriptions are historical. Current source has setup/local/unit PowerShell scripts and Windows venv paths; actual native execution remains pending.
- Unit dashboard does not normally replay100sessions every poll: completed stats are persisted; missing legacy stats are backfilled. Query cost must be measured before optimization.
- Exact software source/manifests/macOS clean clone were already reconciled for8dc8405. New source edits require fresh receipts, and stable/media approval still differs from software acceptance.

## Priority groups

**mandatory release defect:** X20.

**meaningful improvement implementable now:** SC17, SC18, SC22, P2-01, P2-02, CH14, CH16, F01, F06, F07, X02, X07, X10, X11, X12, X15, X17, X18, X19, X21, X29, X30.

**requires physical validation:** SC14, SC19, SC23, P1-03, P2-03, CH12, CH15, X08, X09, X13, X31.

**requires external real-world evidence:** SC16, CH08, F05, X26.

**requires human study:** X24.

**future capability beyond current proof:** CH10, X27.

Mandatory stable gates are authoritative in `FINAL-RELEASE-GATES.json`. No confirmed source correctness defect is invented here; X20 is release/approval acceptance. Physical and native checks remain explicitly pending by user. All independently executable software improvements continue.

## Finding-by-finding evidence and PASS criteria

### SC14 — Usable at unit level with minimal special hardware

**VALIDATION GAP** · requires physical validation. Additional categories: DOCUMENTATION / DEMO GAP.

**Current:** Unit Mode binds locally hosted services and assets; historical multi-device evidence is separately documented.

**Remaining:** New Finale Director, Fusion, White Cell and Crew physical-client acceptance has not been performed.

**Assumption check:** Original gap remains accurate within the stated scope

**Measurable change:** Prepare exact commit-bound laptop/Android runbook and record genuine results when equipment is available.

**PASS requires:** Separate physical trainee device completes fresh Finale exercise and instructor command, verified AAR; retain measured device/browser/build and HTTPS/WAN evidence as separate subtests.

**Inspected source:** `scripts/start-unit.sh:19`, `scripts/start-unit.ps1:27`, `docs/finale/PHYSICAL-LAN-VALIDATION.md:1`.

### SC16 — Sensor realism and fusion

**EXTERNAL DATA / CALIBRATION GAP** · requires external real-world evidence.

**Current:** Strict deterministic radar, optical, RF and IFF models, LOS and per-channel hold are executable; model configuration is frozen.

**Remaining:** Illustrative parameters have no equipment calibration, measured false-alarm curve or external validity.

**Assumption check:** Original gap remains accurate within the stated scope

**Measurable change:** Provide licensed data/instrument/units/evaluation contract and evaluate received teammate data without silently replacing synthetic assumptions.

**PASS requires:** Instrument-specific held-out metrics, provenance and uncertainty justify only the measured modality/conditions; parity remains exact after separately versioned changes.

**Inspected source:** `server/sensors_v2.py:43`, `server/sensors_v2.py:124`, `server/sensors_v2.py:147`, `server/config/sensors-v2.json:1`.

### SC17 — Depth of the AI

**IMPLEMENTATION GAP** · meaningful improvement implementable now. Additional categories: EXTERNAL DATA / CALIBRATION GAP, HUMAN STUDY GAP.

**Current:** Director v2 uses seeded adjusted Thompson sampling over four preserved Beta skills, recent progress and processed-session gaps; immutable selection metadata exists.

**Remaining:** No fitted Elo/target70% or night/swarm/weather skill posterior; no human learning superiority.

**Assumption check:** Original gap remains accurate within the stated scope

**Measurable change:** Implement a separately versioned contextual observation ledger without changing historical four-skill profiles; inspect measured difficulty before fitting target success.

**PASS requires:** Context ledger exports/imports exact accepted outcomes, excludes crew aggregates and leaves historical profiles/cards unchanged; calibration and human learning claims require separate data.

**Inspected source:** `server/director_v2.py:151`, `server/director_v2.py:163`, `server/director_v2.py:200`, `server/director.py:77`.

### SC18 — Instructor live picture

**INTEGRATION GAP** · meaningful improvement implementable now. Additional categories: VALIDATION GAP, PERFORMANCE GAP.

**Current:** White Cell reconstructs truth versus observed evidence, reference alerts and trainee declarations with a20s/128-entry input-addressed cache.

**Remaining:** Teach-pause explanations are not recorded; simultaneous board/trainee acceptance and interaction distributions need fresh proof.

**Assumption check:** Original gap remains accurate within the stated scope

**Measurable change:** Capture instructor teach-pause notes with session/tick/command provenance, preserve in AAR/transfer; run actual browser board/trainee acceptance.

**PASS requires:** Auth-protected note with authoritative tick and explicit instructor attribution survives reload, AAR and signed transfer; note never becomes trainee action or scoring input; multi-browser receipt shows current/fault/restored pictures.

**Inspected source:** `server/white_cell.py:99`, `server/white_cell.py:134`, `client/src/WhiteCell.tsx:41`, `client/src/Instructor.tsx:22`.

### SC19 — Offline / air-gapped operation

**VALIDATION GAP** · requires physical validation.

**Current:** Historical team-confirmed WAN exercise and current local runtime architecture are distinct evidence sources.

**Remaining:** Historical WAN build is unspecified; fresh candidate dedicated WAN-off/LAN-on physical test remains pending.

**Assumption check:** Original gap remains accurate within the stated scope

**Measurable change:** Keep historical provenance and new physical test status separate; provide WAN-only disconnect procedure without interrupting LAN.

**PASS requires:** With measured current commit and separate trainee device, ordinary Internet fails while local join/train/command/verify/Ghost succeeds, followed by restored WAN; no software surrogate.

**Inspected source:** `docs/finale/PHYSICAL-LAN-VALIDATION.md:1`, `scripts/start-unit.sh:19`, `client/scripts/offline.mjs:1`.

### SC22 — Demo reliability

**DOCUMENTATION / DEMO GAP** · meaningful improvement implementable now. Additional categories: VALIDATION GAP.

**Current:** Fallback tactical2D, locally saved records and outage resynchronization work; historical media is retained separately.

**Remaining:** New stable seeded demonstration DB, complete role script, saved backup video and rehearsal are unfinished.

**Assumption check:** Original gap remains accurate within the stated scope

**Measurable change:** Prepare repeatable demo fixture/seed script, stepwise role plan and failure ladder now; freeze/record media only from validated release.

**PASS requires:** Empty fixture load is idempotent, intended live actions produce verified AAR and deterministic review; release-bound saved video plays on second device and actual rehearsal receipt records timing.

**Inspected source:** `client/src/App.tsx:1775`, `docs/finale/PROCESS-OUTAGE-RECEIPT.json:1`, `docs/finale/FINAL-RELEASE-GATES.json:69`.

### SC23 — Runs on the team Windows laptops

**VALIDATION GAP** · requires physical validation.

**Current:** PowerShell setup/local/unit entrypoints and native Windows venv resolution exist; portable tests support interpreter override; Bash works on macOS.

**Remaining:** Native Windows/Linux install, startup, TLS and backup/restore remain unexecuted.

**Assumption check:** Stale Bash-only/no.ps1 wording is false for current source; remaining native execution evidence gap is accurate

**Measurable change:** Finish reproducible platform runbooks/results form and preflight checks; execute on real OS when available.

**PASS requires:** Record current commit plus successful native locked installation, Unit Mode start, browser training, TLS/trust and exact backup/restore on each claimed OS.

**Inspected source:** `scripts/setup-officer.ps1:1`, `scripts/start-local.ps1:5`, `scripts/start-unit.ps1:6`, `scripts/preflight.py:1`.

### P1-03 — Ship HTTPS for the LAN

**VALIDATION GAP** · requires physical validation. Additional categories: SECURITY GAP.

**Current:** Local CA/SAN tooling, launcher TLS paths, secret exclusions and macOS TLS receipt exist.

**Remaining:** Separate-device browser trust, secure-origin cold reload and current phone HTTPS are pending; generated CA is not production PKI.

**Assumption check:** P1-03 no-CA-helper description is stale; current certificate tooling exists, physical trust acceptance does not

**Measurable change:** Prepare Android trust and cold-cache startup steps; preserve private CA files outside Git and media.

**PASS requires:** Measured independent client trusts exact certificate, uses HTTPS without bypass warning, receives local assets and survives cold reload; wrong SAN/expired CA/key absence produces clear error.

**Inspected source:** `scripts/make-cert.py:1`, `scripts/start-unit.ps1:23`, `scripts/start-unit.sh:15`, `docs/finale/TLS-SERVICE-RECEIPT.json:1`.

### P2-01 — Stop over-hedging

**DOCUMENTATION / DEMO GAP** · meaningful improvement implementable now.

**Current:** Architecture/design, software evidence and physical validation limits are explicitly separated.

**Remaining:** Final presentation narrative/claim audit is incomplete; repeated qualifiers could obscure real completed behavior.

**Assumption check:** Original gap remains accurate within the stated scope

**Measurable change:** Prepare concise feature-first claim cards with one scope note and exact receipt links; carry limitations into final release handoff.

**PASS requires:** Each demo assertion maps to implemented code and executed evidence; unsupported military certification/learning/air-gap claims absent; judge-facing narrative is readable.

**Inspected source:** `client/src/FinaleEvidence.tsx:33`, `docs/finale/SIH-PS-COMPLIANCE.md:1`, `docs/finale/FINAL-SOFTWARE-ACCEPTANCE.md:1`.

### P2-02 — Make the code readable for a walk-through

**IMPLEMENTATION GAP** · meaningful improvement implementable now.

**Current:** App and major Finale components were formatted; App is2,538lines and new functions live in separate modules.

**Remaining:** App retains multiple independent effect/draft/command/identity concerns; package has no enforced linter/format script.

**Assumption check:** App148/166 compressed-line description is stale; maintainability decomposition/enforcement gap remains

**Measurable change:** Extract a cohesive review/draft lifecycle hook with unchanged event order and add narrow deterministic formatting enforcement.

**PASS requires:** Same frontend/parity/browser workflows pass; new hook prevents stale session writes across navigation/reload; formatter script covers maintained source without rewriting frozen legacy code.

**Inspected source:** `client/src/App.tsx:1140`, `client/src/storage.ts:1`, `client/package.json:6`.

### P2-03 — Support Windows

**VALIDATION GAP** · requires physical validation.

**Current:** PowerShell setup/local/unit entrypoints and native Windows venv resolution exist; portable tests support interpreter override; Bash works on macOS.

**Remaining:** Native Windows/Linux install, startup, TLS and backup/restore remain unexecuted.

**Assumption check:** Stale Bash-only/no.ps1 wording is false for current source; remaining native execution evidence gap is accurate

**Measurable change:** Finish reproducible platform runbooks/results form and preflight checks; execute on real OS when available.

**PASS requires:** Record current commit plus successful native locked installation, Unit Mode start, browser training, TLS/trust and exact backup/restore on each claimed OS.

**Inspected source:** `scripts/setup-officer.ps1:1`, `scripts/start-local.ps1:5`, `scripts/start-unit.ps1:6`, `scripts/preflight.py:1`.

### CH08 — Scoring v2

**EXTERNAL DATA / CALIBRATION GAP** · requires external real-world evidence. Additional categories: HUMAN STUDY GAP, JUSTIFIED FUTURE WORK.

**Current:** Original25/25/15/35 rubric is frozen; delayed response, resource ledger, group outcomes and optional Brier diagnostics supplement review.

**Remaining:** No empirically justified new weighted score, calibrated overload penalty or area-effectors model.

**Assumption check:** Original gap remains accurate within the stated scope

**Measurable change:** Keep scored result unchanged; validate diagnostics and prepare rubric-change evaluation/version contract rather than inventing new weights.

**PASS requires:** Documented rubric validation with domain/human evidence, versioned score dispatch and golden legacy preservation before claiming scoring v2; diagnostic-only outputs stay explicit.

**Inspected source:** `client/src/AdvancedAAR.tsx:79`, `server/review.py:12`, `server/fusion.py:201`, `server/response_v2.py:1`.

### CH10 — Push instead of poll

**JUSTIFIED FUTURE WORK** · future capability beyond current proof. Additional categories: PERFORMANCE GAP.

**Current:** Instructor, White Cell and Crew poll with non-overlap guards and interval cleanup.

**Remaining:** No push transport or measured latency superiority.

**Assumption check:** Polling is real; absence of push is not by itself a correctness defect or official PS violation

**Measurable change:** Measure roundtrip/command application latency first; implement SSE only if observer load requires it, retaining reconnect and cursor semantics.

**PASS requires:** Same isolation/retry/command order across disconnect/restart, bounded subscribers, cancellation and authenticated streams; measured latency improves at defined load.

**Inspected source:** `client/src/WhiteCell.tsx:64`, `client/src/Instructor.tsx:22`, `client/src/Crew.tsx:266`.

### CH12 — LAN HTTPS

**VALIDATION GAP** · requires physical validation. Additional categories: SECURITY GAP.

**Current:** Local CA/SAN tooling, launcher TLS paths, secret exclusions and macOS TLS receipt exist.

**Remaining:** Separate-device browser trust, secure-origin cold reload and current phone HTTPS are pending; generated CA is not production PKI.

**Assumption check:** P1-03 no-CA-helper description is stale; current certificate tooling exists, physical trust acceptance does not

**Measurable change:** Prepare Android trust and cold-cache startup steps; preserve private CA files outside Git and media.

**PASS requires:** Measured independent client trusts exact certificate, uses HTTPS without bypass warning, receives local assets and survives cold reload; wrong SAN/expired CA/key absence produces clear error.

**Inspected source:** `scripts/make-cert.py:1`, `scripts/start-unit.ps1:23`, `scripts/start-unit.sh:15`, `docs/finale/TLS-SERVICE-RECEIPT.json:1`.

### CH14 — Readable code

**IMPLEMENTATION GAP** · meaningful improvement implementable now.

**Current:** App and major Finale components were formatted; App is2,538lines and new functions live in separate modules.

**Remaining:** App retains multiple independent effect/draft/command/identity concerns; package has no enforced linter/format script.

**Assumption check:** App148/166 compressed-line description is stale; maintainability decomposition/enforcement gap remains

**Measurable change:** Extract a cohesive review/draft lifecycle hook with unchanged event order and add narrow deterministic formatting enforcement.

**PASS requires:** Same frontend/parity/browser workflows pass; new hook prevents stale session writes across navigation/reload; formatter script covers maintained source without rewriting frozen legacy code.

**Inspected source:** `client/src/App.tsx:1140`, `client/src/storage.ts:1`, `client/package.json:6`.

### CH15 — Windows support

**VALIDATION GAP** · requires physical validation.

**Current:** PowerShell setup/local/unit entrypoints and native Windows venv resolution exist; portable tests support interpreter override; Bash works on macOS.

**Remaining:** Native Windows/Linux install, startup, TLS and backup/restore remain unexecuted.

**Assumption check:** Stale Bash-only/no.ps1 wording is false for current source; remaining native execution evidence gap is accurate

**Measurable change:** Finish reproducible platform runbooks/results form and preflight checks; execute on real OS when available.

**PASS requires:** Record current commit plus successful native locked installation, Unit Mode start, browser training, TLS/trust and exact backup/restore on each claimed OS.

**Inspected source:** `scripts/setup-officer.ps1:1`, `scripts/start-local.ps1:5`, `scripts/start-unit.ps1:6`, `scripts/preflight.py:1`.

### CH16 — Dashboard caching

**PERFORMANCE GAP** · meaningful improvement implementable now.

**Current:** Unit dashboard reads persisted completed failure stats; only missing legacy stats are backfilled outside write transaction.

**Remaining:** Repeated roster/profile/Director and live queries have no dedicated query-count/latency budget receipt or cache proof.

**Assumption check:** 100 full replays per poll allegation is disproven; measurable current query cost remains a valid optimization target

**Measurable change:** Profile dashboard query cost on known roster/history, consolidate N+1 reads or add bounded input-addressed cache with presence/active state uncached.

**PASS requires:** Paired repeated workload shows fewer queries or latency reduction; DB/path/cohort/completion invalidation exact; TTL does not hide active presence/commands; historical results unchanged.

**Inspected source:** `server/units.py:78`, `server/units.py:86`, `server/units.py:96`, `server/units.py:104`.

### F01 — White Cell: live instructor picture of every trainee, truth vs belief, alerts

**INTEGRATION GAP** · meaningful improvement implementable now. Additional categories: VALIDATION GAP, PERFORMANCE GAP.

**Current:** White Cell reconstructs truth versus observed evidence, reference alerts and trainee declarations with a20s/128-entry input-addressed cache.

**Remaining:** Teach-pause explanations are not recorded; simultaneous board/trainee acceptance and interaction distributions need fresh proof.

**Assumption check:** Original gap remains accurate within the stated scope

**Measurable change:** Capture instructor teach-pause notes with session/tick/command provenance, preserve in AAR/transfer; run actual browser board/trainee acceptance.

**PASS requires:** Auth-protected note with authoritative tick and explicit instructor attribution survives reload, AAR and signed transfer; note never becomes trainee action or scoring input; multi-browser receipt shows current/fault/restored pictures.

**Inspected source:** `server/white_cell.py:99`, `server/white_cell.py:134`, `client/src/WhiteCell.tsx:41`, `client/src/Instructor.tsx:22`.

### F05 — Fusion Assistant with an over-trust score

**EXTERNAL DATA / CALIBRATION GAP** · requires external real-world evidence. Additional categories: HUMAN STUDY GAP.

**Current:** Fusion operates on sanitized observations, frozen heuristic cue contributions, training-only recommendations and replay-validated receipts.

**Remaining:** No trained likelihood model/calibrated posterior,10krealtrack table or causal over-trust score.

**Assumption check:** Original gap remains accurate within the stated scope

**Measurable change:** Create data/provenance/evaluation interfaces and reliability plots after genuine data arrives; retain descriptive heuristic UI and bias challenges now.

**PASS requires:** Held-out modality-specific labels/provenance and calibration intervals; no ground-truth leakage; human reliance claims need independently measured study, not advice alignment alone.

**Inspected source:** `server/fusion.py:17`, `server/fusion.py:73`, `server/fusion.py:125`, `server/fusion.py:202`.

### F06 — Crew Mode: observation, classification/response, coordination roles on LAN clients

**IMPLEMENTATION GAP** · meaningful improvement implementable now. Additional categories: VALIDATION GAP, HUMAN STUDY GAP.

**Current:** Completed Crew actions have immutable member attribution and logical handoff timing, shared score excluded from individual learning and analytics.

**Remaining:** No longitudinal crew coordination history/trend dashboard; role competency/reliance and new physical breadth remain unvalidated.

**Assumption check:** Original gap remains accurate within the stated scope

**Measurable change:** Add authenticated read-only crew history grouped by declared crew/member labels, trend counts/handoff medians with changing-roster warnings; preserve imported archives.

**PASS requires:** At least3completed exercises yield ordered distinct session metrics and links; original database/cards/profiles stay unchanged; signed transfer/import retains same aggregate history; counts explicitly not competency.

**Inspected source:** `server/crew.py:143`, `server/crew_metrics.py:6`, `client/src/Crew.tsx:157`, `server/advanced.py:195`.

### F07 — Director v2: learning progress, calibrated difficulty, retention and context skills

**IMPLEMENTATION GAP** · meaningful improvement implementable now. Additional categories: EXTERNAL DATA / CALIBRATION GAP, HUMAN STUDY GAP.

**Current:** Director v2 uses seeded adjusted Thompson sampling over four preserved Beta skills, recent progress and processed-session gaps; immutable selection metadata exists.

**Remaining:** No fitted Elo/target70% or night/swarm/weather skill posterior; no human learning superiority.

**Assumption check:** Original gap remains accurate within the stated scope

**Measurable change:** Implement a separately versioned contextual observation ledger without changing historical four-skill profiles; inspect measured difficulty before fitting target success.

**PASS requires:** Context ledger exports/imports exact accepted outcomes, excludes crew aggregates and leaves historical profiles/cards unchanged; calibration and human learning claims require separate data.

**Inspected source:** `server/director_v2.py:151`, `server/director_v2.py:163`, `server/director_v2.py:200`, `server/director.py:77`.

### X02 — Stop over-hedging without erasing limitations

**DOCUMENTATION / DEMO GAP** · meaningful improvement implementable now.

**Current:** Architecture/design, software evidence and physical validation limits are explicitly separated.

**Remaining:** Final presentation narrative/claim audit is incomplete; repeated qualifiers could obscure real completed behavior.

**Assumption check:** Original gap remains accurate within the stated scope

**Measurable change:** Prepare concise feature-first claim cards with one scope note and exact receipt links; carry limitations into final release handoff.

**PASS requires:** Each demo assertion maps to implemented code and executed evidence; unsupported military certification/learning/air-gap claims absent; judge-facing narrative is readable.

**Inspected source:** `client/src/FinaleEvidence.tsx:33`, `docs/finale/SIH-PS-COMPLIANCE.md:1`, `docs/finale/FINAL-SOFTWARE-ACCEPTANCE.md:1`.

### X07 — Cookie, session ownership, CSRF and role boundaries beyond a PIN

**SECURITY GAP** · meaningful improvement implementable now. Additional categories: VALIDATION GAP.

**Current:** Officer auth is expiring/revocable bearer; Crew capabilities are hashed and role actions segregated; individual training uses trusted callsign/UUID.

**Remaining:** Crew role codes currently have no expiry/revocation; member and shared-AAR middleware accept any stored hash indefinitely.

**Assumption check:** Original gap remains accurate within the stated scope

**Measurable change:** Add explicit capability expiry/revocation/rotation applied consistently to state/actions/shared review; preserve historical attribution and archive access semantics.

**PASS requires:** Expired/revoked/old rotated/wrong-crew codes deny all restricted routes; new code rejoins same role; completed history immutable; officer can read archived results; role denial occurs before duplicate receipt return.

**Inspected source:** `server/crew.py:37`, `server/crew.py:94`, `server/crew.py:198`, `server/crew.py:262`, `server/auth.py:64`.

### X08 — Secrets/private keys/CA trust handling

**VALIDATION GAP** · requires physical validation. Additional categories: SECURITY GAP.

**Current:** Local CA/SAN tooling, launcher TLS paths, secret exclusions and macOS TLS receipt exist.

**Remaining:** Separate-device browser trust, secure-origin cold reload and current phone HTTPS are pending; generated CA is not production PKI.

**Assumption check:** P1-03 no-CA-helper description is stale; current certificate tooling exists, physical trust acceptance does not

**Measurable change:** Prepare Android trust and cold-cache startup steps; preserve private CA files outside Git and media.

**PASS requires:** Measured independent client trusts exact certificate, uses HTTPS without bypass warning, receives local assets and survives cold reload; wrong SAN/expired CA/key absence produces clear error.

**Inspected source:** `scripts/make-cert.py:1`, `scripts/start-unit.ps1:23`, `scripts/start-unit.sh:15`, `docs/finale/TLS-SERVICE-RECEIPT.json:1`.

### X09 — Backup and restoration plus rollback compatibility

**VALIDATION GAP** · requires physical validation.

**Current:** Latest macOS clean clone exact backup/restore passed; signed import performs atomic rollback and immutable legacy/finale preservation.

**Remaining:** Native platform backup/restore and exact stable deployment rollback rehearsal remain pending.

**Assumption check:** Original gap remains accurate within the stated scope

**Measurable change:** Prepare cross-platform executable backup/restore examples and compare logical DB/asset/manifest contents; retain original stable fallback.

**PASS requires:** Fresh native install restores disposable backup with exact rows/profiles/cards and resumes new exercise; rollback to stable uses compatible separate DB without downgrade corruption.

**Inspected source:** `scripts/backup-data.py:1`, `server/portable.py:1`, `docs/finale/CLEAN-CLONE-RECEIPT.json:1`, `docs/finale/FINAL-RELEASE-GATES.json:65`.

### X10 — Source/evidence freshness and feature-status claims

**DOCUMENTATION / DEMO GAP** · meaningful improvement implementable now.

**Current:** Evidence endpoint computes current source hash;8dc8405candidate has pinned software source/assets and completed macOS clone receipt.

**Remaining:** Any new source edits invalidate previous receipt; final media and stable approval remain absent.

**Assumption check:** Generic final source/clean-clone gap was already closed for8dc8405scope; lifecycle freshness and final stable/media remain real

**Measurable change:** Regenerate exact source/assets/commit manifest after this cycle and seal candidate archive with machine-checkable hashes.

**PASS requires:** Evidence source_matches true and offline cache/files exact for same tested code commit; clean tree and archive checksums; no stale test counts/media claims; metadata-only commit references preserved code hash.

**Inspected source:** `server/evidence.py:7`, `server/evidence.py:28`, `docs/finale/EVIDENCE-FRESHNESS-RECEIPT.json:1`, `docs/finale/FINAL-SOFTWARE-ACCEPTANCE.json:1`.

### X11 — Mobile responsiveness/accessibility and UI unity

**VALIDATION GAP** · meaningful improvement implementable now. Additional categories: INTEGRATION GAP.

**Current:** Responsive layouts/ARIA/loading/errors and desktop mobile-sized AAR screenshot exist; phone-browser fresh Finale workflow remains pending.

**Remaining:** Complete keyboard/accessibility audit, focus management and actual cross-browser mobile flows are not established.

**Assumption check:** Original gap remains accurate within the stated scope

**Measurable change:** Run keyboard-only routes/decisions/AAR/role/transfer workflows; fix verified inaccessible controls/focus and prepare real Android checklist.

**PASS requires:** Keyboard can finish core workflow without inaccessible hidden controls; no horizontal overflow at390x844; loading/errors announced; physical Android and named browser evidence separately recorded.

**Inspected source:** `client/src/App.tsx:1397`, `client/src/AdvancedAAR.tsx:79`, `client/src/WhiteCell.tsx:67`, `client/src/Crew.tsx:129`, `docs/finale/MOBILE-AAR-20261012.png:1`.

### X12 — Longer performance/endurance and interaction measurements

**PERFORMANCE GAP** · meaningful improvement implementable now. Additional categories: VALIDATION GAP.

**Current:** 20/60/180sec benchmark reports renderFPS, worker tick samples and main-page heap;180sec/200contacts and server reconstruction receipts exist.

**Remaining:** Worker/GPU/whole-process memory and wider action/ACK latency distributions are absent; no operational endurance guarantee.

**Assumption check:** Original gap remains accurate within the stated scope

**Measurable change:** Instrument real client action RTT plus server acceptance/apply logical ticks and collect bounded concurrent workflows; report main-page memory scope accurately.

**PASS requires:** Repeated fixed workload reports raw samples, p50/p95/max for each distinct metric; no renderFPS conflated with scoring latency; optimized complete score/review exactly match before.

**Inspected source:** `client/src/Benchmark.tsx:200`, `client/src/Benchmark.tsx:204`, `docs/finale/ENDURANCE-BROWSER-20261012.json:1`, `docs/finale/RECONSTRUCTION-PROFILE-RECEIPT.json:1`.

### X13 — Physical validation of NEW finale features

**VALIDATION GAP** · requires physical validation. Additional categories: DOCUMENTATION / DEMO GAP.

**Current:** Unit Mode binds locally hosted services and assets; historical multi-device evidence is separately documented.

**Remaining:** New Finale Director, Fusion, White Cell and Crew physical-client acceptance has not been performed.

**Assumption check:** Original gap remains accurate within the stated scope

**Measurable change:** Prepare exact commit-bound laptop/Android runbook and record genuine results when equipment is available.

**PASS requires:** Separate physical trainee device completes fresh Finale exercise and instructor command, verified AAR; retain measured device/browser/build and HTTPS/WAN evidence as separate subtests.

**Inspected source:** `scripts/start-unit.sh:19`, `scripts/start-unit.ps1:27`, `docs/finale/PHYSICAL-LAN-VALIDATION.md:1`.

### X15 — Crew individual/group analytics and attribution

**IMPLEMENTATION GAP** · meaningful improvement implementable now. Additional categories: VALIDATION GAP, HUMAN STUDY GAP.

**Current:** Completed Crew actions have immutable member attribution and logical handoff timing, shared score excluded from individual learning and analytics.

**Remaining:** No longitudinal crew coordination history/trend dashboard; role competency/reliance and new physical breadth remain unvalidated.

**Assumption check:** Original gap remains accurate within the stated scope

**Measurable change:** Add authenticated read-only crew history grouped by declared crew/member labels, trend counts/handoff medians with changing-roster warnings; preserve imported archives.

**PASS requires:** At least3completed exercises yield ordered distinct session metrics and links; original database/cards/profiles stay unchanged; signed transfer/import retains same aggregate history; counts explicitly not competency.

**Inspected source:** `server/crew.py:143`, `server/crew_metrics.py:6`, `client/src/Crew.tsx:157`, `server/advanced.py:195`.

### X17 — Official SIH Canva PPT/PDF, narrated demo/subtitles/code explanation/Q&A/submission receipts

**DOCUMENTATION / DEMO GAP** · meaningful improvement implementable now.

**Current:** Historical presentation/video exists separately; current candidate screenshots and tests are reproducible evidence.

**Remaining:** No final new-release PPT/PDF/narration/subtitles/code/Q&A/submission receipt.

**Assumption check:** Original gap remains accurate within the stated scope

**Measurable change:** Prepare architecture/workflow/Q&A/storyboard and claim cards now; finalize files only after stable source is approved.

**PASS requires:** Six official slides and demo align to exact validated release/features/metrics; readable PDF, playable saved video, rehearsed timings and delivered submission package receipts.

**Inspected source:** `docs/finale/ARCHITECTURE-V2.md:1`, `docs/finale/SIH-PS-COMPLIANCE.md:1`, `docs/finale/FINAL-RELEASE-GATES.json:69`.

### X18 — PS Compliance Board with direct evidence links

**INTEGRATION GAP** · meaningful improvement implementable now. Additional categories: DOCUMENTATION / DEMO GAP.

**Current:** Public93-row compliance index preserves official-vs-audit provenance and fixed whitelist docs; allrows have the same matrix evidence URL.

**Remaining:** One-click finding-specific preset/session/unit live proof is missing.

**Assumption check:** Original gap remains accurate within the stated scope

**Measurable change:** Add stable whitelisted workflow paths and row-specific receipt/document references with officer/trainee/setup prerequisites; avoid embedding synthetic fixture IDs as universal live proof.

**PASS requires:** Official rows and highvalue features open the intended actual route without mutating records; correct sign-in/identity and fallback if saved session absent; evidence links resolve per finding and traceability93rows unchanged.

**Inspected source:** `server/compliance.py:42`, `server/compliance.py:45`, `client/src/Compliance.tsx:12`.

### X19 — Demo seed scenarios and reliability fallback ladder

**DOCUMENTATION / DEMO GAP** · meaningful improvement implementable now. Additional categories: VALIDATION GAP.

**Current:** Fallback tactical2D, locally saved records and outage resynchronization work; historical media is retained separately.

**Remaining:** New stable seeded demonstration DB, complete role script, saved backup video and rehearsal are unfinished.

**Assumption check:** Original gap remains accurate within the stated scope

**Measurable change:** Prepare repeatable demo fixture/seed script, stepwise role plan and failure ladder now; freeze/record media only from validated release.

**PASS requires:** Empty fixture load is idempotent, intended live actions produce verified AAR and deterministic review; release-bound saved video plays on second device and actual rehearsal receipt records timing.

**Inspected source:** `client/src/App.tsx:1775`, `docs/finale/PROCESS-OUTAGE-RECEIPT.json:1`, `docs/finale/FINAL-RELEASE-GATES.json:69`.

### X20 — Independent re-audit and release gates rather than automatic100

**VALIDATION GAP** · mandatory release defect.

**Current:** Original stable unchanged; latest independent software PASS_SCOPED and82provisional assessment exist with separate deployment gates.

**Remaining:** Final independent reassessment/stable decision has not occurred for new cycle; pending physical/native cannot be auto-passed.

**Assumption check:** Original gap remains accurate within the stated scope

**Measurable change:** Complete cycle tests/receipt reconciliation and independent adversarial reassessment; record release candidate readiness separately from stable approval.

**PASS requires:** Exact source audited and tests/claims reconciled; each mandatory gate genuinely passes or policy is explicitly changed by user; versioned stable tag only after approval; no automatic100score.

**Inspected source:** `docs/finale/FINAL-SOFTWARE-ACCEPTANCE.md:1`, `docs/finale/FINAL-RELEASE-GATES.json:1`, `docs/finale/INDEPENDENT-REVIEW-20261012.md:1`.

### X21 — Scenario Studio difficulty currently only an authored label

**INTEGRATION GAP** · meaningful improvement implementable now. Additional categories: DOCUMENTATION / DEMO GAP.

**Current:** Legacy Studio sends difficulty string to metadata only; Raid Composer changes hostile concurrency cap3/6/12 and frozen roster constraints.

**Remaining:** Legacy label can imply behavior that does not change; no empirically calibrated70% target.

**Assumption check:** Legacy label-only allegation remains true; current Composer already offers actual bounded difficulty behavior

**Measurable change:** Make legacy authored difficulty explicitly metadata-only in UI and route operational difficulty to Raid Composer rather than altering frozen legacy physics.

**PASS requires:** UI clearly says label does not tune roster/sensors/scoring; two otherwise same legacy specs differ only metadata; new composer difficulty produces expected verified constraints/valid playback.

**Inspected source:** `client/src/ExerciseStudio.tsx:32`, `server/exercises.py:38`, `server/exercises.py:94`, `server/raid_v2.py:180`, `client/src/RaidStudio.tsx:10`.

### X24 — Fusion assessment gating, deception and appropriate-reliance measurements

**HUMAN STUDY GAP** · requires human study. Additional categories: EXTERNAL DATA / CALIBRATION GAP.

**Current:** Assessment mode hides advice; replay validates exposure prefix/config; optional Brier aftercompletion and descriptive alignment are explicit.

**Remaining:** Cognitive over-trust, actual viewing and causal reliance are unmeasured.

**Assumption check:** Original gap remains accurate within the stated scope

**Measurable change:** Prepare human-study tasks, consent/privacy-safe identifiers, counterbalanced advice/bias/assessment conditions and exported decision/exposure protocol.

**PASS requires:** Real participant records distinguish displayed/exposed/followed/correct/incorrect with preregistered outcomes/uncertainty; no synthetic learner or self-report treated as causal human evidence.

**Inspected source:** `server/fusion.py:163`, `server/fusion.py:201`, `server/fusion.py:229`, `server/fusion.py:274`.

### X26 — No learned model is not proof existing AI invalid; sensor fusion assumptions need evaluation

**EXTERNAL DATA / CALIBRATION GAP** · requires external real-world evidence. Additional categories: HUMAN STUDY GAP.

**Current:** Statistical adaptation and inspectable Fusion are legitimate AI; synthetic experiment intervals include zero.

**Remaining:** Real learner benefit, calibrated classifier and fitted difficulty remain unsupported.

**Assumption check:** Original categorical no-neural-model therefore invalidAI assumption is false; evaluation depth gap remains

**Measurable change:** Prepare real-vs-synthetic reporting and leakage-resistant data splits; keep synthetic experiment reproducible and honest.

**PASS requires:** Independent real dataset/human-study evidence reports actual metric/uncertainty with no causality overclaim; preserve no-learning baseline and outcome equivalence.

**Inspected source:** `server/director_v2.py:201`, `server/fusion.py:2`, `docs/finale/DIRECTOR-V2-SIMULATED-EXPERIMENT.json:1`.

### X27 — Drone-operator/red-side mode and sensor-placement planner transferable proposals

**JUSTIFIED FUTURE WORK** · future capability beyond current proof.

**Current:** Seeded red-force families and instructor intervention exist; sensor-placement planner and drone-piloting mode do not.

**Remaining:** Optional planner/operator extension is absent and not an explicit official clause.

**Assumption check:** Absence is real; mandatory necessity is not established by official PS

**Measurable change:** Retain scoped proposal with applicability/design requirements; prioritize sensor/review/crew acceptance over new tactical planning domain.

**PASS requires:** If later built, planner/operator module has distinct objectives, observer-truth boundaries, deterministic model and domain/user evidence; no competitor capability invented as mandatory requirement.

**Inspected source:** `server/raid_v2.py:258`, `client/src/Instructor.tsx:22`, `docs/finale/RESEARCH-NOTES.md:1`.

### X29 — Benchmark instrumentation currently measures callbackFPS separately from simulation

**PERFORMANCE GAP** · meaningful improvement implementable now. Additional categories: VALIDATION GAP.

**Current:** 20/60/180sec benchmark reports renderFPS, worker tick samples and main-page heap;180sec/200contacts and server reconstruction receipts exist.

**Remaining:** Worker/GPU/whole-process memory and wider action/ACK latency distributions are absent; no operational endurance guarantee.

**Assumption check:** Original gap remains accurate within the stated scope

**Measurable change:** Instrument real client action RTT plus server acceptance/apply logical ticks and collect bounded concurrent workflows; report main-page memory scope accurately.

**PASS requires:** Repeated fixed workload reports raw samples, p50/p95/max for each distinct metric; no renderFPS conflated with scoring latency; optimized complete score/review exactly match before.

**Inspected source:** `client/src/Benchmark.tsx:200`, `client/src/Benchmark.tsx:204`, `docs/finale/ENDURANCE-BROWSER-20261012.json:1`, `docs/finale/RECONSTRUCTION-PROFILE-RECEIPT.json:1`.

### X30 — Polling/stream/resource cleanup, cache bounds and instructor performance

**PERFORMANCE GAP** · meaningful improvement implementable now. Additional categories: VALIDATION GAP.

**Current:** White Cell has bounded128entry20sTTL cache; Crew runtime64cache and completed polling stops; client polls avoid overlaps and clean intervals.

**Remaining:** Broader cancellation/cache-invalidation/load evidence and interaction distributions remain incomplete.

**Assumption check:** Original gap remains accurate within the stated scope

**Measurable change:** Test timer unmount/stale response/failedrequest recovery and cache bounds across many sessions; collect current dashboard and live-picture latency under bounded concurrent clients.

**PASS requires:** No stale setState/session cross-contamination; cache caps/DB scope/invalidation exact; request/cancel counts and latency rawreceipt for specified concurrency; no whole-memory leak-free claim.

**Inspected source:** `server/white_cell.py:27`, `server/white_cell.py:155`, `server/crew.py:113`, `client/src/WhiteCell.tsx:64`, `client/src/Crew.tsx:266`.

### X31 — Release source/platform/dependency and code-explanation accuracy

**VALIDATION GAP** · requires physical validation. Additional categories: DOCUMENTATION / DEMO GAP.

**Current:** Locks, local production assets, portable launchers and strict archive schemas exist; final macOS install/build/backup passed.

**Remaining:** Native current Windows/Linux and broader team installation evidence are missing; module walk-through may need simpler handoff.

**Assumption check:** Original gap remains accurate within the stated scope

**Measurable change:** Provide executable native setup/backup checks and actual module map; run native tests when environments arrive.

**PASS requires:** Current exact commit installs/starts/backsup/restores on each claimed nativeOS, production assets served locally; documentation makes online preparation vs training runtime explicit.

**Inspected source:** `scripts/preflight.py:1`, `scripts/setup-officer.ps1:1`, `server/portable.py:1`, `docs/finale/CLEAN-CLONE-RECEIPT.json:1`.

