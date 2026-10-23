# Development testing policy — owner update, 23 October 2026

During development, run new and directly affected tests, focused integration/browser checks and proportional compatibility/parity/security tests for shared contracts. Preserve valid earlier evidence with exact source and affected-scope disclosures. Do not repeatedly run complete backend/frontend/build/lint/format checks for minor changes. Reuse the dev server/HMR for focused UI validation.

A final release freeze still requires comprehensive backend/frontend/parity/history/scoring/security/recovery/Crew/browser-VR/build/lint/format/performance/end-to-end acceptance and available physical tests. Reproduced final blockers get targeted fixes and a final corrected-source integrated regression. A development milestone is not final release acceptance.

The already-running source209c717b full run completed801 backend/416 frontend; retain it. The later Training HTTP error classification touches App/storage and its lifecycle tests; run the narrow actual-App cases, types/lint/format on changed files and one real browser refusal check. Unchanged backend tests are not rerun. Record this distinction in each milestone receipt.
