# Final hardening ownership and progress

Base: `db0ff23a67692d3db5dce07a031d17ea50a409b3` fetched from GitHub on 2026-10-16.
Branch: `feature/vyuha-final-hardening`.
Workspace: `/home/naveen/Vyuha-final-hardening`.

The original `/home/naveen/Vyuha` worktree and its untracked presentation directories are untouched. There were no tracked integration fixes to recover on this machine. The owner's separate macOS workspace is unavailable here.

The user clarified that the main Codex owns merging and release preparation. This branch will not merge the drill branch or create a release tag. No readiness is inferred from the existence of that branch.

## Protected ownership

Do not edit App.tsx, Scene.tsx, ContactRenderer.tsx, DecisionWorkspace.tsx, airframe-geometry.ts, render-contacts.ts, scene-presentation.ts, presentation.ts, DrillSetup.tsx, TrainingWelcome.tsx, PreparationTerrain.tsx or drill styles. Shared tokens remain unchanged until external coordination. New platform styles must be scoped to non-drill routes/review or new components. Navigation behavior used by the running simulation must preserve callbacks and native link semantics.

## Milestones

- Source recovery: clean worktree from exact remote integration base. Original checkout preserved.
- Research/implementation: in progress.
- Current-source acceptance: pending. Historical counts are not evidence for this branch.
- Parallel integration, full product visual approval and RC: main Codex responsibility.

## Runtime isolation

Use dedicated localhost ports 5187 (frontend) and 8017 (API), and synthetic database/auth files under `/tmp/vyuha-hardening-qa`. No user database or officer credential is used.

## Platform milestone 1

Implemented platform-only desktop route directory, scoped Fieldwork design layer, Analytics evidence ledger/AAR links and honest comparison prerequisites, Instructor search/status filtering, split Transfer workbench, operation-specific Operator Guide disclosures, Ghost evidence investigation layout, page-crash recovery boundary, and authoring/Recorded compositions. Shared root tokens and all listed drill-owner files remain untouched.

Validation during implementation: production build passes (36 offline assets; existing large WebGL chunk warning retained); ESLint and configured formatting pass; targeted workflow batches 21/24/17/20/5 all passed (overlapping batches, not additive totals). Independent review found mobile White Cell clipping, tab focus clipping, inadequate roster height, empty-state misleading CTA and contrast defects; corrections are implemented and being rechecked. Historical private 18/22 source databases are absent here, so their old receipts are retained as historical only.

Research includes public source access limits and three interactive browser layout studies. Screenshots under `before-*` are genuine baseline captures against an isolated empty synthetic server at 1440px. No user credential/database is used. Current work is not a release candidate or whole-product visual approval.

## Reliability and administration milestone

- Backend: malformed Last-Event-ID command-stream cursors return 422 before consuming a stream slot; 8 regression cases. Added concurrent three-trainee command/acknowledgment/completion isolation coverage. Independent full backend run: 708 passed (246.68s), 85 targeted passed. No scoring formula or training service changed.
- Unit/Crew history now support finding recorded trainees/exercises; full-cohort summaries retain their scope. Compliance has text/status filters and a traceability-row composition. Profile estimates use aligned evidence rows with accessible native meters.
- Existing stylesheet entrypoint contract restored: `main.tsx` keeps `premium/premium.css` last; that file imports both scoped platform sheets. Existing regression preserved and passing.
- Latest administration/Director/compliance/Crew/style batch: 37 passed. Initial complete frontend run found the import-order regression (288 passed, 1 failed); this was corrected, not waived. Final complete run remains required.
- Independent review captured 56 route/width combinations and 14 axe scans without detected overflow/violations after the main responsive fixes. These working-tree captures predate the last administration refinements; final source receipt must supersede them for affected routes.

## Final runtime acceptance checkpoint

Final code: `10a63fefba2201aa9c343d18ca1b0d3b24c0a112` (pushed and independently clean-cloned). Final reruns: **708 backend passed / 263.13s; 289 frontend passed / 18.216s**, parity included. Lint/format/build pass; 36 offline asset URLs. Final reconstruction median at 200 contacts: **7.222s loopback HTTP**, three samples, no claimed speedup. `FINAL-VALIDATION.json` and `FINAL-SOURCE-INVENTORY.json` tie evidence to 326 tracked runtime/test/deployment inputs.

Production HTTP/Chromium acceptance passed server scoring/Ghost/profiles, What-If immutability, distinct Crew roles/cross-Crew rejection/rotation/attribution/completion, signed transfer/duplicate/tamper handling, SQLite backup/restore and restart recovery, cached offline shell reload and browser import. Clean-clone and Docker records match the final code. A separate evidence-only checkpoint publishes these files without changing runtime source.

See `FINAL-REPORT.md` for exact integration instructions, screenshot links, audit qualifications and remaining ownership/physical/private-history/user acceptance. No finished drill branch, merged SHA or RC is claimed. Main Codex remains merge/release owner. Home/preparation was protected; Rapid ID retains its existing focused workflow with the new surrounding shell. Review those scope limits explicitly during final product acceptance.

## Resumed UI correction

User rejected the competing shell. See SHELL-CORRECTION.md: sidebar removed, premium top navigation/display typography/semantic tokens restored, recent branch ancestry and separate drill WIP inspected. New browser matrix80/20axe plus frontend289/lint/format/build pass; current visuals are in shell-correction/. Earlier sidebar screenshots are historical. No drill branch merge or final visual approval.

Search follow-up: Enter opens a single result; arrows browse links/back to input; native callbacks retained. Full frontend291, lint/format/build pass and real keyboard receipts recorded. See the updated FINAL-REPORT.md for current scope. Backend source remains unchanged from the prior708-test checkpoint.
