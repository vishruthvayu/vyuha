# AAR timeline investigation milestone

This follows the premium-shell correction. It improves an existing review workflow; it does not replace the application shell or touch the drill developer's files.

## Behavior

- Search recorded event titles, reason codes, contact IDs, category names and formatted times; multiple terms narrow the result together.
- Combine search with the existing category filter and show exact matching/recorded counts.
- Recover from no matches using a clear-filter action, which returns keyboard focus to the search input.
- Render the first 100 matching events initially. A reveal control exposes further batches without discarding evidence. Focus moves to the first newly revealed event, including the last batch where the control disappears.
- Keep every event's original ordering, object and pre-action replay boundary. There is no inferred event, rescoring, sensor synthesis, POST or persistence change.
- Put the existing replay scope note and explicit observed/scoring horizons inside a native provenance disclosure, reducing phone scrolling while keeping the source note available. Missing metadata is stated explicitly.
- Remount investigation controls per record ID, preventing a previous session's filter state from carrying into another session.

The layout uses existing premium tokens and native controls. No dependency, font, authoritative service, simulation clock or shared drill contract changed.

## Checks

The complete frontend suite passes 294 tests, including parity and 3 new timeline regressions. The new tests use a clearly synthetic 140-event fixture to check bounded rendering, original same-tick order and replay object identity, intersecting filters, no-match recovery, keyboard focus and unchanged input evidence. This fixture is not a measured human/operational session or a rendering FPS benchmark.

ESLint, configured formatting and the production build pass; 36 offline asset URLs. Earlier lint caught an optional-chain formatting conflict while implementing focus behavior; it was fixed without changing lint rules. Current logs are in timeline-investigation/.

Actual Chromium checks use a server-verified synthetic AAR at all 8 requested widths. They search contact T1, select a recorded event, recover from no matches, apply a category and verify the saved AAR's before/after SHA-256 matches. No non-read network request is permitted by the harness. The browser receipt retains axe results and incomplete manual contrast checks; this is not a full screen-reader audit.

Representative evidence: timeline-investigation/timeline-360.png and timeline-1440.png. Integration/human visual/physical/private-history gates remain open. Main Codex still owns merging the unfinished drill track and any release candidate.
