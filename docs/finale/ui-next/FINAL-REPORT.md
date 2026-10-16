# Current hardening handoff — premium shell correction

Branch: `feature/vyuha-final-hardening`. Base: `db0ff23a67692d3db5dce07a031d17ea50a409b3`. Current runtime source is `de30dfa1de7e0d1c59bb257f3020c2f5f074dc36`; any later evidence-only commit keeps those runtime bytes. [CURRENT-VALIDATION.json](CURRENT-VALIDATION.json) and [CURRENT-SOURCE-INVENTORY.json](CURRENT-SOURCE-INVENTORY.json) identify the verified source. No merge or release tag is made here.

## What changed after user review

The user rejected the competing sidebar/palette. That direction is removed. The app again uses the existing premium top navigation, workspace catalogue, Instrument Serif page headings and shared semantic palette. Non-drill workflow improvements remain: Analytics evidence/AAR access, Instructor filters, authoring and Recorded layouts, Transfer verification feedback, Unit/Crew history search, Compliance filtering, profile evidence and recovery. Search now supports single-match Enter and arrow navigation through the existing links/callbacks. AAR timelines now support contact/event/reason/time search, combined category filtering, bounded initial rendering and provenance disclosure; original replay boundaries and recorded evidence are preserved. See [TIMELINE-INVESTIGATION.md](TIMELINE-INVESTIGATION.md).

This is a correction of the visual foundation, not a claim that the complete ultimate product brief or final human visual acceptance is finished. The earlier source-scoped report is preserved as [HISTORICAL-FIELDWORK-REPORT.md](HISTORICAL-FIELDWORK-REPORT.md). Its sidebar screenshots and old full-source receipts must not be represented as current UI approval.

## Recent branch reconciliation

`feature/vyuha-premium-ui` at `8aff541` and engine closure at `ea641a2` are already ancestors of this hardening branch. Integration remains `db0ff23`. Drill rescue is now `8e26e8d` (handoff/harness after M2 `b489741`); its separate local checkout has uncommitted M3 art/environment work. It was inspected read-only and is not merged. See [SHELL-CORRECTION.md](SHELL-CORRECTION.md) for exact observed refs and ownership.

No App, scene/renderer, guided decision, root-token or training/preparation stylesheet changes were made by the correction. WorkspaceSearch props and callback contracts stay unchanged. The running hardening preview is localhost:5187; the separate developer preview on localhost:8031 is not a combined build.

## Current checks and evidence

- Full frontend: **294 passed, 0 failed**, including Python/TypeScript parity, keyboard navigation and new read-only timeline regressions.
- ESLint, configured formatting and production build pass; 36 local offline asset URLs. Existing lazy WebGL chunk warning retained.
- Shell matrix: 80 route/viewport combinations, no horizontal document overflow; 20 axe scans, no detected violations; incomplete/manual checks preserved.
- Search retest: real Chromium at 360/1440, Enter/arrow/Escape behavior passes, two axe dialog scans with zero violations.
- Independent correction review compares actual screens with premium references and records remaining density/table limitations.
- Backend files are unchanged. The prior **708-test** backend receipt remains attributed to its tested source; it is not relabelled as a new backend run. The current clean local clone passes 294 tests, install/build/lint/format and reproduces native assets byte-for-byte; see timeline-investigation/clean-clone-receipt.json. Earlier Docker/transfer/recovery receipts retain their original source identity. Merged-source acceptance must be repeated by main Codex.

Latest captures and logs: [shell-correction/](shell-correction/browser-receipt.json), [desktop Analytics](shell-correction/analytics-1440.png), [phone Analytics](shell-correction/analytics-360.png), [Instructor](shell-correction/instructor-1440.png), [Studio](shell-correction/studio-1440.png), [search interactions](shell-correction/search-keyboard-receipt.json). Synthetic data only. No full screen-reader audit or human visual approval is claimed.

The audit inventory still preserves 211 IDs and inherited statuses: 93 verified, 71 partial, 29 deferred, 17 externally blocked and 1 not applicable. See the scoped reconciliation and engineering review for qualifications; these are not fresh whole-product certification totals.

## Integration and remaining acceptance

Main Codex retains merge/release ownership. Fetch and verify the hardening branch tip, review against db0ff23, and keep protected historical refs intact. Obtain the drill developer's explicit ready SHA and evidence before normal-history integration. Preserve premium.css as the final stylesheet entrypoint and its scoped refinement imports; keep navigation callbacks and officer/Crew gates.

Run full combined-source backend/frontend/parity/security/recovery/transfer/build/lint/format/browser checks after merging. Private original18/22-session databases remain unavailable here; validate safe backups with the owner. Physical Windows/native Linux/Android, trusted separate-device LAN HTTPS, WAN-off, scientific calibration, combined drill usability and direct user visual acceptance remain open.

The task is at a corrected, reviewable checkpoint. It must not be called the final visual product or a release candidate.
