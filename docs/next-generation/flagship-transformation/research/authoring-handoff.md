# Flagship B — Spatial/temporal Raid Studio vertical slice

Parent branch `feature/vyuha-next-generation`, base `0664dc4`. No engine/server/archive/schema source changes.

## Implemented

- Existing Raid Studio now expresses admitted training focus, exact six-profile roster or seeded selection, and a custom weak-sector bearing for BLIND_SECTOR.
- Inputs compile through existing protected POST `/raids/preview` and `/raids`, with strict unchanged `RaidRequest`; custom roster errors retain user configuration.
- Every valid compiled engine0.4/v2 raid opens a north-up spatial reference rehearsal. Bounded analytic path samples use existing parity-tested `raidPosition`, not a replacement simulation.
- Tick-resolution seek, explicit wave navigation, schedule, current reference markers and selection-linked property inspection provide a connected plan/time/object workflow.
- Selection preserves time. `Jump to spawn` is explicit. Map contact selection has Enter/Space support and equivalent44px native roster buttons.
- Optional existing server geometric windows disclose first/last/qualifying total, possible gaps, and no guarantee of observation or solvability.
- Reference truth is labelled AUTHOR REFERENCE / ALL PLANNED CONTACTS. No live trainee contacts, sensor observations, action receipts, scores or learning estimates are generated.
- Unsupported/malformed reference geometry falls back to clear unavailable text while retaining the compiled result.
- Existing stale-result handling, busy input freeze, natural duration typing, save and immediate library integration are retained.

## Files / integration

- `client/src/RaidStudio.tsx` (only existing file changed by this workstream)
- `client/src/RaidRehearsal.tsx`
- `client/src/raid-rehearsal.ts`
- `client/src/raid-rehearsal.css` — parent must import from premium.css after current scoped refinements
- `client/src/raid-rehearsal.test.ts`
- `client/src/raid-rehearsal-ui.test.tsx`

## Limitations

This is an integrated authoring/rehearsal capability, not full Flagship B completion. It does not admit new episode events, acquisition/scanning actions, custom freehand trajectories/volumes, sensor-feasibility guarantees, interventions, outcomes or new scoring. Paths are reference geometry only. Fixed sector + exact roster can be infeasible under the existing server geometry validator; server retries remain bounded24 and request timeout30s may precede an expensive impossible composition. Actual browser/mobile walkthrough and integrated source-pinned evidence remain parent acceptance work.

No old release refs altered; no commits created by child.

## Final focused validation (source frozen after formatting)

-19/19 passed,0 failures,11,675.298166ms:
  `node --import tsx --test src/raid-rehearsal.test.ts src/raid-rehearsal-ui.test.tsx src/command-composer-input.test.tsx src/command-workflows.test.tsx`
-6 new model/schema cases,4 new UI cases,4 preserved composer duration cases,5 preserved command/Studio/Crew workflow cases.
-Exact new authoring fields pass Python `RaidRequest` round-trip. This deliberately does not certify every custom roster/bearing as geometrically feasible. An earlier expensive full-compose fixture run was stopped for parent matched graphics benchmarks and is not a passing result.
-Structural axe:0 violations on reference-map active marker/selected inspector, color-contrast disabled (real browser contrast remains separate). JSDOM prints its known canvas.getContext diagnostic during axe text analysis; no test failure.
-Project noEmit check completed with empty diagnostics; narrow owned-source/transitive noEmit also exit0.
-Changed-module ESLint exit0; Prettier check exit0.
-Logs: `/private/tmp/vyuha-raid-rehearsal-final-targeted.log`, `vyuha-raid-rehearsal-owned-tsc.log`, `vyuha-raid-rehearsal-tsc.log`, `vyuha-raid-rehearsal-lint.log`, `vyuha-raid-rehearsal-format.log`.

## Manual browser checks for parent

Open existing Exercise Studio, sign in as officer, keep normal defaults and Preview raid. Inspect map, Next wave, select roster/contact marker, inspect properties, use explicit Jump to spawn, scrub with range keyboard, inspect geometric window explanation. Change a request field: old reference must say previous configuration. Save a valid draft and confirm assignability/training library continuity. Enable exact roster, ensure counts and mix admission/rejections retain configuration. For BLIND_SECTOR bearing360, compile must reject locally without API request. Resize390px/768px, no horizontal document overflow,44px native input/buttons and internal roster scroll. Do not confuse reference markers with sensor observations.
