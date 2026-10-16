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
