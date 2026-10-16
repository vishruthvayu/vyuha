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
