# Premium UI — progress notes

Branch `feature/vyuha-premium-ui` from shared baseline `7e3184b15ba38e8242efc6f80c446c9d861b032e`. Frontend-owned files only (contract: `docs/finale/parallel/FRONTEND-ENGINE-CONTRACT.md`). Each milestone is tested, committed and pushed before the next begins.

## Milestones

| # | Milestone | Status | Checks |
|---|---|---|---|
| 1 | Research, three rendered directions, "Quiet Instrument" foundation: self-hosted fonts, tokens, base, components, app bar, cross-document page transition | done | 249/249 frontend tests, lint, format, build (32 local assets) |
| 2 | Training ground: spatial workstation — one screen at laptop sizes: mission strip, view with radar inset, decision dock under the view, contacts + evidence rail; contact symbology by shape; tablet/phone stacked order view → contacts → dock → evidence | done | 254/254 frontend tests (5 new), lint, format, build |
| 3 | Preparation: full-width stage (real 3D environment, or an original illustration before an adaptive drill is prepared) with an editorial headline and one primary action; drill settings open and skill evidence as cards below; quiet saved-exercise banner; tour launcher as a corner pill hidden during exercises; legacy `spatial-training.css` retired (review rules ported to `premium/review.css`) | done | 257/257 frontend tests (3 new), lint, format, build |
| 4 | After-action review as an investigation workspace: verdict band (score ring, serif verdict, verification seal, metrics), sticky section navigator with scroll-spy, sticky replay beside the Ghost decision review, restyled timeline / decision path / comparisons / score table, editorial empty state and history list; legacy light-theme selects neutralized | done | 259/259 frontend tests (2 new), lint, format, build |
| 5 | Instructor console and White Cell as a command workstation: slim officer session strip, compact header with transport chip and related-workspaces menu, sticky scrollable roster ordered live-first with status chips, telemetry band, command groups open and side by side, White Cell chooser text wraps (was overlapping) | done | 260/260 frontend tests (1 new), lint, format, build |
| 6 | Shared Crew | next | |
| 7 | Analytics, Adaptive Director, Exercise studio / Raid Composer | planned | |
| 8 | Rapid ID, Recorded practice, Unit, Data transfer, System evidence, PS compliance, guide, sign-in | planned | |
| 9 | Responsive and accessibility passes at 360–1920, two refinement passes, final report | planned | |

## Working notes

- Retired: `client/src/spatial-training.css` (fully replaced by `premium/training.css`, `premium/preparation.css`, `premium/review.css`).
- Visual layer lives in `client/src/premium/`, imported after the legacy stylesheets in `main.tsx`. Legacy CSS is retired route by route as each page is rebuilt.
- No `package.json` / lockfile change so far (fonts are vendored), to avoid lockfile conflicts with the engine branch.
- Not touched: `Scene.tsx`, `scene-presentation.ts`, `visibility.ts`, `presentation.ts`, `quality.ts`, `Radar.tsx`, `observed-contacts.ts`, `types.ts`, workers, simulation, `server/`, `scripts/`.
