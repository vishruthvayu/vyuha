# Flagship C: original decision to deliberate rehearsal

Base: `0664dc483fe1834b28da9d4992d94e6eb54a068b`, shared next-generation workspace. Staged implementation, not a separate branch or commit. Parent owns integration, browser acceptance and release evidence.

## Scope delivered

A verified learning review now supports an explicit evidence-to-next-episode workflow. It groups actual server-reconstructed decision observations by competency, orders paths using original contact/competency votes, distinguishes observable error from insufficient observable evidence, and opens each exact decision in the existing Reconstruction Theatre callback. The learner can then inspect currently published individual practice objectives/instructions, select a different item (or explicitly identified repeat), prepare it through the existing server-frozen learning API, and open its briefing for explicit Start.

This extends the existing investigation/reflection and Academy journey; it does not replace them with a quiz or add another correctness model. Officers see the source path read-only and cannot prepare a learner's rehearsal. No request happens until a learner explicitly asks for current practice. No automatic launch or assessment allocation occurs.

## Integrate only these five regular files

Copy from `/private/tmp/vyuha-training-bridge-stage/` to `client/src/`:

- `TrainingBridge.tsx`
- `training-bridge.ts`
- `training-bridge.css`
- `training-bridge.test.tsx`
- `LearningEvidence.tsx`

The stage has symlinks/config for isolated testing: DO NOT copy its directory recursively.

Add `@import "../training-bridge.css";` to the end of `client/src/premium/premium.css` with the other flagship imports. No Ghost/App/Academy wiring is needed: the existing owner/reviewer props and `onInspectDecision` callback in LearningEvidence supply the integration.

## Integrity boundaries

- Only `learning-v1` / `competency-evidence-v1`, matching item/mode/assistance/assessment/catalog/review hashes are accepted. Unsupported/malformed evidence yields no planner; original review remains available.
- Paths derive only original observation IDs/ticks/verdict/reason and server votes; no canonical contact roster, answer key, new score or mastery estimate is consumed.
- Identical duplicate cases deduplicate; conflicting duplicates reject. Server contact/competency summary votes remain distinct from multiple decision cases.
- Current catalog and historical catalog are shown as separate if changed. A new preparation must match the selected target catalog/item/pool/assistance, exact request ID and new seed. Original context is never rewritten.
- Only individual practice items (no assessment/crew items) enter the rehearsal picker. Held-out assessment remains the Academy workflow.
- In-flight catalog/preparation results are discarded after source identity/context, selected path or item changes. Duplicate clicks dispatch once. Retry preserves the immutable preparation request ID.
- Source histories disclose 20 decisions at a time. This bounds initial DOM work without dropping underlying evidence.
- No server schema/engine/scoring/archive/profile writes were added. Existing practice endpoint owns preparation and profile isolation.

## Targeted evidence

`/private/tmp/vyuha-training-bridge-targeted.log`: 11 passed, 0 failed, 7738.195375ms. Tests cover source error/uncertainty distinction, malformed/future contracts, unknown/no-source fallback, original immutability, individual practice pool, direct original-moment callback, joined owner payload, explicit frozen launch, officer read-only, structural axe, stale source/path/context results, duplicate-click suppression, exact request retry, mismatched receipt rejection, historical/current-catalog boundary, long-history incremental disclosure and integration retaining original investigation/reflection/summary.

`/private/tmp/vyuha-training-bridge-lint.log`: four changed TS/TSX modules passed current ESLint rules. Five new/changed regular files passed Prettier. Staged `tsc` reaches unchanged sensor imports whose `../../server/config` paths are invalid in the flattened temp layout; parent must run normal in-repo TypeScript. No claim of a clean standalone staged typecheck.

To rerun after integration, from `client/`:

```
node --import tsx --test src/training-bridge.test.tsx src/learning-review-journey.test.tsx
```

## Focused browser gate

Use a verified completed Academy/practice/assessment attempt with actual decision observations (ordinary adaptive without a learning context will not show this). Open Ghost as the owning learner, select an evidence-led path, inspect the exact original decision in Theatre, return, load current practice and inspect its objective/support. Prepare explicitly; open rehearsal and check its briefing/Start. On officer review verify the path is read-only. Check 390px layout/keyboard and render after CSS import. No actual browser acceptance was performed by this agent; parent performs it against integrated source.

## Limits / remaining Flagship C work

This is a source-bound practice planning/navigation projection, not a calibrated adaptive model or proof of improved learning. A different catalog item/new seed is disclosed as such and does not establish semantic equivalence or human transfer. Linkage from original review to the new preparation is visible in this planner but is not a new persisted lineage/experimental protocol. Current server-frozen preparation contracts are reused unchanged. More advanced longitudinal evidence, conducting/coordination and calibrated instructional policies remain separate flagship work. Do not mark all of Flagship C complete from this slice.
