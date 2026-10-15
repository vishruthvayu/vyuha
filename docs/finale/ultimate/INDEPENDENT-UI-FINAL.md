# Independent UI/UX review — 15 October 2026

Source: `b1c84db083ce730b3b6190ae4b6aecfd3eff1013` plus current uncommitted early-end history/test changes. This is a scoped review, not whole-app acceptance. No score is assigned.

The selected spatial workstation, preparation theatre and connected evidence layout is coherent. The mobile preparation capture has no former story/loop overlap. Crew role entry is flatter, the officer card has clear hierarchy and named password entry, Analytics gives meaningful persisted metadata, and the Crew scroll region shows a visible gold focus boundary while horizontally scrolled.

The old paused training capture contains duplicate Resume buttons, but current App.tsx replaces the scene action with a direction to the single upper control; the old screenshot cannot establish a current defect. Similarly the AAR 90s history capture predates the observed-duration worktree fix.

## Actionable findings

| ID | Severity/status | Issue and exact evidence | Required closure |
|---|---|---|---|
| UX-REC-01 | P1 / FIX INTEGRATED + INDEPENDENT ENGINEERING TESTED, BROWSER PENDING | Recording load and practice-save responses are not scoped to the active recording/request. Delayed A response can overwrite B, and blank selection leaves A loaded. `client/src/Recorded.tsx:44-62, practice save handler` | Generation/request guard; clear state immediately on selection including blank; reject late save/load results; interleaved promises regression and real import/play/save browser workflow. |
| UX-NAV-01 | P3 / FIX INTEGRATED SOURCE VERIFIED | White Cell tells the officer to use instructor controls below; current layout puts command controls above White Cell. `client/src/WhiteCell.tsx:412` | Position-independent wording or correct above wording; no behavior change. |
| UX-FORM-01 | P3 / REFINEMENT | Role management input, load button and validity select have mismatched alignment in the 100% desktop screenshot. `client/src/CrewOfficerTools.tsx:242-272` | Optional horizontal form grouping with aligned labels/buttons; preserve mobile stacking and explicit labels. |
| UX-AAR-01 | P2 / INTEGRATED + FOCUSED TESTED, BROWSER PENDING | Old captured history says 90s recorded for early-ended exercise. Current worktree now prefers observed_end_tick, executionTick, endTick and says observed. `client/src/AARHistory.tsx` | Focused early-end tests plus actual new postbuild screenshot; scoring horizon remains unchanged. |

## Manual requirement coverage

| User finding | Review result | Remaining evidence |
|---|---|---|
| Compact preparation and start hierarchy | Source/capture improvement visible; one primary prepare action; mobile story/loop no overlap | Fresh final desktop preparation and normal-height mobile viewport after final build |
| Duplicate starts/resumes | Current source removes duplicate paused overlay action; old capture outdated | Paused live final capture and exact button count |
| Readability at100% | Fresh100%-named mobile Crew/AAR/preparation and desktop Analytics/Crew/Instructor legible | Independent browser CSS/zoom measurements by root; all widths and active controls |
| Crew join/officer layout | Flattened join/setup hierarchy visible; role-management alignment could improve | Actual active role states + mobile join and officer flows |
| AAR history identity/metadata/selection | Exercise title, seed, callsign, date, short ID, verification and selected marker visible | Observed-duration fix regression and recapture |
| Officer sign-in | Card/form hierarchy clear; source retains proper POST auth, required password, busy and errors | Fresh100% mobile error/focus capture |
| Interactive onboarding | Source five selectable steps and Next/Previous, modal focus isolation, actual old step2 capture | Final100% keyboard navigation/Escape/focus return proof |
| Command navigation/discovery | Main command bar + search/catalogue replace sidebar; source traps modal focus and preserves native modified links | Final search/catalogue keyboard flow at narrow width |
| Workflow differentiation | Training theatre, operational radar/evidence dock and Analytics persisted-stat layout are meaningfully differentiated | Final evidence route and active mobile compare |
| Actual active major interfaces | Instructor/Analytics/Crew history/AAR screenshots reviewed; training older non100% captures | Final active sim + active Crew + Recorded import/save required |

All fresh captured filenames above are rooted at `/private/tmp/vyuha-ui-20261015`. The reviewer cannot independently certify zoom from filenames alone. Do not count old90% capture geometry as current100% evidence. No physical device/network acceptance is inferred.

## Recorded fix follow-up

At root request this reviewer authored a narrowly scoped Recorded.tsx fix in `/private/tmp/vyuha-recorded-lifetime/client/src`, plus nine mounted regressions. Those tests pass (1267.216167ms); ESLint and TypeScript build pass. Original six race tests failed on the unmodified b1c84db source. Root must integrate and an independent engineering reviewer must assess this authored change; this report is not independent self-approval. The fix also scopes imports, freezes mutable practice controls during a single pending save while retaining retry request IDs, and gives clear feedback/disables actions after the selected sample expires. Final root integration, whole-suite regression and actual browser import/play/save remain required.

Final focused overlay run: **19/19 passed**, 2111.4785ms (9 new mounted cases +10 existing hardening cases including54 rural parity checkpoints/recorded adapters). ESLint and TypeScript build passed with exit0. Explicit canonical Python was supplied for the overlay parity harness. These are focused overlay results, not the final whole-repository regression.

Integration follow-up: canonical Recorded.tsx exactly matches the tested overlay SHA256 `26af102a3bcdfc791fe70216b8d0086360c6b9ccf1539255daea45658bd1bc95`. A separate engineering reviewer independently passed10/10 canonical lifetime/reproducer checks and a StrictMode race check (see ENGINEERING.md), closing self-review concern for the authored Recorded fix. Root also changed White Cell direction to position-independent session controls; source confirmed. AAR observed duration now includes the required server lightweight metadata correction with4/4 independent regressions; final browser recapture remains required.

## Fresh frozen-source rendered review

Root supplied source-input policy v2 receipt `931ab608c99bb95b011635136709a1d585251a67e2ddc025d57b77cec4bf23c9` at parent HEADb1c84db. Independently inspected all10 new JPEGs in permanent `work/finale/ultimate-experience/final-acceptance-20261015/screens` and both layout JSONs. The receipts report all8 CSS widths360,390,428,768,1024,1280,1440,1920 with documentWidth equal to viewport, devicePixelRatio1 and visual scale1. Training radar remains visible.

Fresh mobile preparation has no overlapping story, prepare button or teaching loop. Both running training screenshots have legible sensor controls and current contact lists; the radar remains present. The desktop scene and radar are side-by-side; mobile uses bounded normal vertical scrolling. Scene top at document y516desktop/y717mobile is **not a release blocker**: the single Start action is inside the exercise preview, so the trainee reaches the observation workspace before starting. Keeping a whole 3D scene, radar and all responses simultaneously visible on a390px phone is not a credible acceptance requirement. Compact active heading or resume orientation can be an optional future refinement if actual use justifies it.

Recorded import/save image shows chosen local schema example,3 recorded decisions and persisted unscored reference review; malformed input gives clear feedback. Cold server AAR history now truthfully shows10.2s observed for the early-ended exercise and90.0s for the completed horizon, with callsign, seed, contact count, decisions, verified status and exercise identity.

**Evidence corrections, not reproduced application blockers:** preparation-desktop.jpg actually depicts AAR and must be replaced; aar-history-390.jpg is360x900 pixels, so do not claim that JPEG demonstrates390px (the separate DOM receipt does); aar-complete-desktop.jpg captures Ghost unavailable/retry while its cold full review loads and must be replaced by a hydrated state before claiming successful completed-AAR capture. The full-page Recorded composite places the fixed navigation at capture scroll offset; the viewport captures and source determine actual navigation behavior.

Fresh active Crew, current Instructor/Analytics, guide/search/catalogue interaction capture and corrected three evidence images remain to be inspected before extending this review to all mandatory interfaces. No fresh release-blocking UI source defect was found in this inspected scope.
