# Immutable curriculum history

26 October 2026. Runtime `568561a4e85b19fd8503b1a2b05020b2ac50f89d`, following surface runtime `2f4dfdfefa3ff328791a4ef766a510b0c07bc90e`.

Implemented a bundled, bounded catalog allowlist and exact-byte snapshots. Current curriculum selection validates its file hash against that allowlist; historical item compilation and evidence projection resolve the hash stored in the learning context. Returned JSON has fresh ownership. Unknown, changed, unsupported or path-escaping snapshots fail closed. Existing preparation owner checks remain intact. `learning-v1.json` remains byte-identical at SHA256 `5abe5c7920a40c989546bc59abf77c4cb6430f0cd8a8af5dca2a361ac977d345`.

Root integrated tests: **42 passed**, 0 failures, 27.32s (`evidence/integrated-targeted.log`): new registry tests plus existing learning, reflection and curriculum diagnostic suites. The existing Starlette/httpx deprecation warning remains. Staged agent results (12 new/30 existing) are retained separately and are not additional unique tests. Independent reviewer reran12 new tests successfully; no blocker found for the declared scope.

This is a compatibility prerequisite, not a new learning mode. Only the existing catalog is registered in production. `coverage()` still assumes the current competency IDs; controlled-study transitions deliberately reject protocol catalog drift. New competency schemas, new lessons, learning-v2, active sensor acquisition and human learning gains are not enabled or claimed. The next integrated mission must version its pedagogical or acquisition contract explicitly; see [mission research](../../competitive-research/EVIDENCE-INVESTIGATION-MISSIONS.md).

Follow-up in `e444bdc3b03162dfe58333d4e5a49c43a196ae42`: added explicit practice/assessment old-catalog Transfer tests while a distinct approved catalog becomes current. Both restore exact learning evidence/scenario/scorecard, preserve duplicate protection and the practice/assessment isolation. These two tests passed separately (4.29s) and again inside the22-test final catalog/reflection selection (21.48s). Counts are not additional copies of the same tests.

Actual browser Academy preparation, server-verified practice and old evidence access passed while completing the connected [post-exercise investigation](../evidence-investigation/STATUS.md). Only the original catalog remains enabled. Full unchanged suites and release acceptance have not been rerun. No RC, tag or protected baseline merge.
