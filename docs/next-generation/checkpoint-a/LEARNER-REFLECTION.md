# R05 — source-bound learner reflection and explicit progression

Status: INTEGRATED / TARGETED TESTED. Whole R05 and Checkpoint A remain PARTIAL.

The owner of a server-verified individual Academy exercise can open **Reflect on your decision** in Ghost, record an observed cue, remaining uncertainty and next check, and reload the saved note. This is learner-authored text, not automated feedback or proof of learning. Ghost supplies the context only for the current trainee; officer/foreign review does not offer individual note entry. The backend uses the existing trusted-LAN trainee identity model, not a new private account boundary. Unit administrators can read the original database.

Append-only notes are stored separately from original learning evidence, scorecards, actions and profiles. Session, trainee and original review hash must match. Wrong-owner/non-learning, unfinished, malformed evidence, Crew ownership, stale hashes and conflicting retries fail closed. Twenty notes/session and bounded plain-text fields limit storage. Unchanged retries reuse one request ID; the browser preserves unsaved drafts, rejects foreign acknowledgments, ignores old-context responses and recovers a lost acknowledgment on reopening. The ordinary signed transfer deliberately omits notes; populated original-server backup/restore preserves them. No reconstruction/catalog reinterpretation is needed to load or save a note.

Academy now labels supported completed practice observations as **practice evidence recorded**, separate from assessed evidence. A full-guidance item with that evidence offers an explicit **Try with less guidance** step that clears its preparation and selects the paired lesson. This does not prepare/start automatically or assert mastery. A supported faded lesson links to an independent-assessment choice. Content-specific coaching and validated advancement thresholds remain unfinished.

## Focused validation

- **21 backend tests passed** in40.39s: eight new reflection contracts plus13 existing learning tests. Original DB tables and profiles unchanged; bounds/control text, owner/Crew gating, pending/malformed evidence, immutable retries, cap, ordinary-transfer omission and populated backup/restore covered.
- **Five frontend tests passed** in3.305s: no request until expanded, source-bound save, plain-text rendering, draft/retry, lost acknowledgment, review switching, foreign history/acknowledgment rejection and Ghost ownership. Post-save axe semantics checked with contrast excluded; this is not full accessibility certification.
- **Two selected Academy/competency accessibility tests passed** in4.23s, including explicit lower-guidance progression with no auto-launch. Incremental TypeScript and changed-file lint/format passed.
- Actual Codex in-app browser on disposable QA8040→8041: opened existing synthetic practice, saved a note, reloaded and found exactly one saved note with blank next draft. Original session and skill-profile table hashes stayed identical; score remained5/100. Existing C01 incorrect evidence did not acquire supported-practice credit. The initially missing entry point was a stale Vite transform; restarting the preview exposed current source without weakening the ownership guard.

The prior complete801-backend/416-frontend/build evidence remains tied to86b61d2. It is not presented as final validation for this slice. No full suites, production rebuild, engine parity or unrelated benchmarks were repeated: authoritative engine/scoring/VR/receipt dispatch is unchanged. See reflection-receipt.json and retained focused logs/screenshots.

## Remaining limitations

No participant efficacy data, stronger trainee authentication, cross-unit note export or automated reflection grading is added. Generic prompts are not a complete Academy curriculum. Other Checkpoint A gates, matched performance qualification and final integrated release acceptance remain open. No release/tag changes.
