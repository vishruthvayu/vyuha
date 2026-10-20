# VYUHA hardening branch — integration review handoff

> **UI continuation update:** the competing sidebar/palette was rejected and corrected. Read [SHELL-CORRECTION.md](SHELL-CORRECTION.md) and its newer screenshots first. This report describes the earlier source checkpoint; it is not current visual acceptance.

## Source and ownership

Base: `db0ff23a67692d3db5dce07a031d17ea50a409b3` (actual GitHub integration HEAD fetched 2026-10-16).
Branch: `feature/vyuha-final-hardening`.
Final runtime source: `10a63fefba2201aa9c343d18ca1b0d3b24c0a112`.
The later evidence checkpoint contains documentation, screenshots and receipts only; use GitHub branch HEAD for the complete handoff package and compare runtime hashes in `FINAL-VALIDATION.json`.

The user's clarification gives merging/release preparation to main Codex. No drill branch was merged, no release reference was created, and stable/RC refs were not modified. The original Linux checkout/untracked presentation work is untouched. The owner's macOS worktree and its possible unpushed changes are unavailable here.

All 17 independently checked protected scene/decision/preparation/token files match the base. In particular App.tsx, Scene.tsx, ContactRenderer.tsx, DecisionWorkspace.tsx, presentation.ts, render-contacts.ts, airframe-geometry.ts and training/preparation styles were not edited. Shared entrypoints changed narrowly: main.tsx adds the platform rail and recovery boundary only to non-drill routes; premium.css imports scoped platform sheets after existing styles. The three final semantic changes add group roles to labelled controls; they do not change layouts, state or simulation time.

## Product result

**Fieldwork** combines persistent workstation navigation, editorial hierarchy and evidence-led analysis. No new production library or remote asset dependency was added. Existing locally licensed Geist, Geist Mono and Instrument Serif remain; Lucide icons remain. Root tokens and drill styles stay stable for the parallel developer.

Research and comparative design judgments are in `RESEARCH-AND-DIRECTION.md`. Public pages/docs were inspected; subscription-only workflows and unavailable tools are explicitly identified. Three actual interactive layout studies and Chromium screenshots are included. They compare refined workstation, editorial intelligence and scientific operating system directions; the latter was selected with restrained typography and controls from the others. This is design judgment, not a human study.

| Area | Changes and scope |
| --- | --- |
| Platform navigation | Persistent desktop directory, visible active route, existing command search/native URL navigation, mobile catalogue retained. Drill callbacks/navigation remain intact. |
| Analytics | Evidence ledger, direct authenticated AAR links, recorded exercise table, honest missing-data/comparison prerequisites, visible phone view grid. Existing exact estimates/trend provenance preserved. |
| Instructor / White Cell | Searchable sessions, live/history filter, compact session overview, usable mobile roster, wrapping evidence mode switch, labelled control groups. Existing command receipt/retry lifecycle retained. |
| Ghost / AAR | Container-responsive observations/decision/explanation investigation, clearer evidence/comparison surfaces, phone heading and verdict composition. Ground truth remains separately disclosed. |
| Director / profiles | Aligned four-skill estimate rows, native accessible meters, observation counts and Bayesian model details. Existing focus selection, uncertainty and heuristic caveats retained. No model change. |
| Exercise Studio / Raid Composer | Grouped scenario configuration, workflow section navigation, explicit preview/save/assign relationship, validation/loading feedback, responsive fields and accessible targets. API semantics unchanged. |
| Recorded Practice | Split import/library flow, loaded recording evidence/decision composition, loading/empty/file feedback. Actual example import and decision/review save exercised; unscored status retained. |
| Data Transfer | Distinct export/import operations, archive manifest, selected-file size/verification state, atomic/conflict/duplicate explanations, recovery/trust disclosure. Signature validation remains server-side. |
| Unit | Cohort summary band, trainee/exercise search with full-cohort summary scope, existing evidence/profile drill-down. |
| Crew administration/history | Completed-exercise search, existing scoped role-code lifecycle retained. No live Spotter/Responder controls edited. |
| Compliance / Evidence | Search and recorded-status filters, traceability rows, compact evidence index and differentiated reading hierarchy. Historical evidence remains dated and source freshness remains visible. |
| Operator Guide | Progressive operational guidance for Instructor, Crew, offline recovery, AAR, Recorded Practice and sign-in problems. |
| Rapid ID / utility routes | Shared platform navigation, typography, controls and responsive shell; existing recognition workflow retained. No new Rapid ID task redesign is claimed. |
| Home / live drill | Intentionally not edited without coordination. The parallel developer owns preparation/guided training/3D. This branch does not resolve or certify the original drill visual complaints. |

Motion is short entrance/selection feedback, with reduced-motion overrides. No continuous decoration, simulation-time animation or large animation dependency was introduced. A page error boundary preserves navigation and offers recovery without clearing local data.

## Browser evidence

`frozen-browser/browser-receipt.json`: 80 real Chromium route/width checks (10 routes × 360/390/428/768/1024/1280/1440/1920), 100% zoom/device scale 1. No document-level horizontal overflow detected. Twenty axe scans at representative phone/desktop sizes found no violations; incomplete/manual checks are retained. This matrix belongs to source 7f028a8; final source differs only in three semantic group roles. `frozen-browser/FINAL-SEMANTIC-BROWSER.json` retests affected routes at final source 10a63fe: six scans, zero violations and no prohibited-label incomplete results. Automated contrast interpretation of SVG/gradient/image surfaces still requires manual judgment.

Independent agent review identified and verified fixes for mobile White Cell clipping, hidden tab focus, inadequate roster height, weak contrast, small Studio targets and misleading empty Analytics comparison. Two substantive review/refinement passes are documented in `INDEPENDENT-UI-REVIEW.md`. Keyboard navigation/search/focus return and Unit/Compliance/Crew-history filtering were exercised. This is not a full screen-reader or human usability audit.

[Baseline Analytics](before-analytics.png) → [Analytics](frozen-browser/analytics-1440.png), [baseline Instructor](before-instructor.png) → [Instructor](frozen-browser/instructor-1440.png), [baseline Studio](before-studio.png) → [Studio](frozen-browser/studio-1440.png), [baseline Transfer](before-transfer.png) → [Transfer](frozen-browser/transfer-1440.png). Baseline captures used an empty synthetic server; populated final captures use explicitly synthetic fixtures, so these pairs are visual evidence, not pixel-equality comparisons. The directory also includes phone captures, Ghost, Unit, Recorded, Rapid ID, Compliance and Evidence.

## Engineering and acceptance

The reproduced backend defect was an unhandled malformed Last-Event-ID command-stream cursor. ASCII/length/range validation now rejects it with 422 before consuming a stream slot. Eight regressions cover invalid Unicode/oversized cases. A separate three-trainee concurrent regression verifies independent ordered commands, acknowledgments, completion and skill attribution.

Complete current-source test logs and counts are recorded in `FINAL-VALIDATION.json`. The frontend suite includes Python/TypeScript parity (544 integrated, 288 response/sensor, 1,920 sensor checkpoints, 12 Director templates and additional legacy/Fusion/raid cases). The backend suite includes security, Crew, Instructor, Director, Ghost, immutable replay/What-If, offline/durability, signed transfer and historical engine dispatch. No regression was removed or weakened. An existing stylesheet-entrypoint regression failed during development and was corrected by preserving the tested entrypoint contract.

`ISOLATED-ACCEPTANCE.json` and its reproducible runner document real disposable HTTP processes: adaptive training/scoring/Ghost/profile/Rapid ID/analytics, immutable What-If, officer denial, cursor rejection, signed transfer, duplicate import, tamper rejection, SQLite backup/restore, process restart, expired officer session rejection, production offline shell reload and browser import. Crew evidence, when present in that receipt, uses separate real HTTP role clients. Offline shell reload is not a claim of separate-device WAN-off acceptance or a complete browser process-outage queue exercise.

`CLEAN-CLONE.json` records a clean local clone at final source, locked install, complete frontend tests, lint/format/build, dependency audit, repeated byte-identical assets and matching Docker assets. Docker non-root startup/restart, frontend/service worker delivery and unauthorized officer denial passed. This is a local clean Git clone, not a separately authenticated GitHub clone or hermetic/offline install. Initial install requires dependencies; runtime fonts/assets are local.

`FINAL-RECONSTRUCTION-BENCHMARK.json` records three alternating direct/loopback HTTP samples at 8/25/50/100/200 contacts and a separate profile. It measures server reconstruction, not rendering, human performance or application startup. No engine optimization was introduced. The earlier approximately 8.52s measurement is not a same-machine controlled baseline; no percentage speedup is claimed. The existing large lazy WebGL chunk warning remains under the renderer owner's scope.

## Audit and limitations

The 211-row reconciliation overlay preserves IDs and scoped statuses: 93 VERIFIED COMPLETE, 71 PARTIAL, 29 DEFERRED, 17 EXTERNALLY BLOCKED, 1 NOT APPLICABLE. These are inherited implementation statuses, not 93 newly reverified whole-product approvals. The overlay checks 220 unique cited paths and records the retirement/mapping of a stylesheet cited in 16 rows. The stream defect is separately closed with evidence, without changing requirement identities or fabricating a competition score.

Known boundaries: trusted-LAN trainee callsigns/session URLs are not strong human authentication; Director/sensor models are heuristic; EO/IR-only failures do not independently add the existing radar/RF degraded-skill tag. No scientific calibration, operational readiness or learning-benefit claim was added. Original private 18-session/22-session SQLite histories are absent here; their historical receipts are preserved and current fixture compatibility passes, but private-database revalidation remains pending with the owner.

Remaining acceptance: direct user visual walkthrough; parallel drill/guided decision integration; combined-source regressions; physical Windows/native Linux/Android; separate-device trusted LAN HTTPS; physical WAN-off and weak-device checks. Expanded phone AAR can still be long; its section navigation helps, but human workflow acceptance remains necessary. The Home and Rapid ID scope distinctions above must not be represented as complete bespoke redesigns. No stable release or final whole-product approval is justified by this branch alone.

## Integration instructions for main Codex

1. Fetch and verify the pushed hardening HEAD; inspect the exact diff from db0ff23. Preserve the integration owner's newer work and protected refs.
2. Obtain the drill developer's explicit verified integration-ready SHA/evidence. Do not merge an unfinished branch.
3. Merge through normal Git history. Expect shared-entrypoint/style imports and review/Profile/Unit components to require inspection; App and scene files have no changes from this branch.
4. Keep premium.css as the stylesheet entrypoint; its final two imports load fieldwork.css and authoring.css. Do not relocate them after main.tsx's premium import or weaken its regression.
5. Verify the navigation callbacks and ownership/auth gates, responsive Crew/Instructor administration, Ghost/replay selection, profiles, authoring, offline sync and data transfer on combined source.
6. Re-run complete backend/frontend/parity/history/security/recovery/transfer/build/lint/format and browser acceptance against the merged SHA. Run private history checks only on disposable backups of the owner's original databases.
7. Require a direct user walkthrough of the real combined drill and surrounding platform before calling visuals final. Only the integration owner should freeze a candidate, generate matching evidence and prepare any next immutable RC. Physical gates remain explicit; no stable tag is authorized by this evidence.
