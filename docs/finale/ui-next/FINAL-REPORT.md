# Current hardening handoff — Analytics context and premium refinement

Branch: `feature/vyuha-final-hardening`. Base: `db0ff23a67692d3db5dce07a031d17ea50a409b3`. Current runtime source is `a87842bd7b99537a540fb7c6adb08f475f8eaed1`; any later evidence-only commit keeps those runtime bytes. [CURRENT-VALIDATION.json](CURRENT-VALIDATION.json) and [CURRENT-SOURCE-INVENTORY.json](CURRENT-SOURCE-INVENTORY.json) identify the verified source. No merge or release tag is made here.

## What changed after user review

The user rejected the competing sidebar/palette. That direction is removed. The app again uses the existing premium top navigation, workspace catalogue, Instrument Serif page headings and shared semantic palette. Non-drill workflow improvements remain: Analytics evidence/AAR access, Instructor filters, authoring and Recorded layouts, Transfer verification feedback, Unit/Crew history search, Compliance filtering, profile evidence and recovery. Search now supports single-match Enter and arrow navigation through the existing links/callbacks. AAR timelines now support contact/event/reason/time search, combined category filtering, bounded initial rendering and provenance disclosure; original replay boundaries and recorded evidence are preserved. See [TIMELINE-INVESTIGATION.md](TIMELINE-INVESTIGATION.md).

This is a correction of the visual foundation, not a claim that the complete ultimate product brief or final human visual acceptance is finished. The earlier source-scoped report is preserved as [HISTORICAL-FIELDWORK-REPORT.md](HISTORICAL-FIELDWORK-REPORT.md). Its sidebar screenshots and old full-source receipts must not be represented as current UI approval.

## Recent branch reconciliation

`feature/vyuha-premium-ui` at `8aff541` and engine closure at `ea641a2` are already ancestors of this hardening branch. Integration remains `db0ff23`. The latest fetched drill rescue tip is `6c4518c5dcff14582c368fc3d487ad42b3e0324a`. This continuation does not certify its readiness and has not merged it. Prior local drill WIP was inspected read-only. See [SHELL-CORRECTION.md](SHELL-CORRECTION.md) for exact observed refs and ownership.

No App, scene/renderer, guided decision, root-token or training/preparation stylesheet changes were made by the correction. WorkspaceSearch props and callback contracts stay unchanged. The production hardening preview is http://127.0.0.1:8017/analytics using an isolated synthetic database. It is not a combined drill build.

## Current checks and evidence

- Full frontend: **301 passed, 0 failed**, including Python/TypeScript parity, keyboard navigation and read-only timeline and Analytics context regressions.
- ESLint, configured formatting and production build pass; 36 local offline asset URLs. Existing lazy WebGL chunk warning retained.
- Shell matrix: 80 route/viewport combinations, no horizontal document overflow; 20 axe scans, no detected violations; incomplete/manual checks preserved.
- Search retest: real Chromium at 360/1440, Enter/arrow/Escape behavior passes, two axe dialog scans with zero violations.
- Independent correction review compares actual screens with premium references and records remaining density/table limitations.
- Fresh **GitHub clean-clone** install/test301/lint/format/build pass at the current runtime SHA. Production assets match the local build byte for byte. Parity uses the prepared pinned Python interpreter with cloned server source; no new Docker or full platform bootstrap is claimed. See [clean-clone receipt](analytics-context/clean-clone-receipt.json).
- A fresh complete backend run passes **708 tests in 259.37 s**, with the existing dependency deprecation warning. Server bytes remain unchanged. See analytics-context/backend-tests.txt. Earlier Docker/transfer/recovery receipts retain their original source identity. Merged-source acceptance must be repeated by main Codex.

Earlier corrected-shell captures and logs: [shell-correction/](shell-correction/browser-receipt.json), [desktop Analytics](shell-correction/analytics-1440.png), [phone Analytics](shell-correction/analytics-360.png), [Instructor](shell-correction/instructor-1440.png), [Studio](shell-correction/studio-1440.png), [search interactions](shell-correction/search-keyboard-receipt.json). Synthetic data only. No full screen-reader audit or human visual approval is claimed.


Analytics now preserves unit, trainee and session-pair context through shared links, reload and browser Back/Forward. Missing linked records get explicit recovery instead of substitute evidence; stale responses are scoped to their requested unit/trainee. At phone widths both values and their difference fit without horizontal scrolling. See [ANALYTICS-CONTEXT.md](ANALYTICS-CONTEXT.md) for contracts, source digests and two visual refinement passes.

Latest production captures: [360 px](analytics-context/live-comparison-360.png), [1440 px](analytics-context/live-comparison-1440.png), [real API receipt](analytics-context/live-api-receipt.json). Eight widths and eight axe scans passed for real production assets/API; a separate eight-width fixture pass covers invalid links. No browse-time API write requests occurred, and two analytics/five AAR payload hashes stayed identical. These checks use synthetic sessions; no empirical improvement is claimed.

The audit inventory still preserves 211 IDs and inherited statuses: 93 verified, 71 partial, 29 deferred, 17 externally blocked and 1 not applicable. See the scoped reconciliation and engineering review for qualifications; these are not fresh whole-product certification totals.

## Integration and remaining acceptance

Main Codex retains merge/release ownership. Fetch and verify the hardening branch tip, review against db0ff23, and keep protected historical refs intact. Obtain the drill developer's explicit ready SHA and evidence before normal-history integration. Preserve premium.css as the final stylesheet entrypoint and its scoped refinement imports; keep navigation callbacks and officer/Crew gates.

Run full combined-source backend/frontend/parity/security/recovery/transfer/build/lint/format/browser checks after merging. Private original18/22-session databases remain unavailable here; validate safe backups with the owner. Physical Windows/native Linux/Android, trusted separate-device LAN HTTPS, WAN-off, scientific calibration, combined drill usability and direct user visual acceptance remain open.

The task is at a corrected, reviewable checkpoint. It must not be called the final visual product or a release candidate.
