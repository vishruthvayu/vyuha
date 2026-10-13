# Fresh independent software audit — 13 October 2026

Reviewed code: `e07a3845cc465f430b572ece7fbded687c1e3729`.

**84.0/100 provisional:** 46/50 PS coverage, 18/25 realism/AI, 20/25 engineering/demo. This is an independent engineering judgement under the original rubric, not official SIH marks, a winning probability or stable approval. The earlier 83.5 receives 0.5 credit for finally coherent regression and current-source validation. There is no automatic point addition for closed rows. Exact 16-point deductions are enumerated in REVIEW.json. The original rubric retains stable/media deductions although new media is outside this software mission.

Independent focused checks passed:

- 19 cache/SSE/research-plot backend checks: 10.12 seconds.
- 3 cohort/history/conflict/legacy checks: 46.52 seconds; 21 deselected.
- 8 transport/offline-worker/Crew UI checks: 7798.702417 milliseconds.

These counts are not added to root's full 609 backend and 160 frontend results. I read their final raw logs and verified zero failures. The protected stable branch and peeled tag remain unchanged.

Eight scoped closures are justified: SC18, F01, P2-02, CH14, CH10, CH16, X15, X21. This yields **61 PASS / 31 PARTIAL / 1 N/A / 0 BLOCKED**, with 66.3043% fully closed excluding N/A. X10 may become a ninth closure only after current source/build/clone/manifest consistency is actually checked: 62 PASS / 30 PARTIAL / 1 N/A, or 67.3913%. X20 remains PARTIAL because its original scope includes final stable and external acceptance. All original 39 rows receive an explicit disposition in REVIEW.json.

No new behavior defect was reproduced. The integration owner's current Chrome receipts cover server-process outage, cached reload, three decisions and three Fusion receipts resynchronized, immutable What-If/reference training tables, signed 24-record clean-receiver transfer and exact backup/restore. I inspected these receipts and the corresponding source; I do not claim to have repeated all GUI workflows myself.

The actual software acceptance gap at review is **X10: final current manifest/source/build/clone reconciliation**. Native Windows/Linux and separate-device LAN/WAN/HTTPS trust remain pending, not failed. Sensor calibration, learned Fusion, fitted context/Elo, human learning/reliance and broader Worker/GPU/endurance measurements remain unsupported research or quality claims. Per-account adversarial learner identity is outside the declared trusted-LAN model. Optional red-side/piloting/planner and PPT/video/submission work are not invented software release blockers.

Software acceptance is **PASS_SCOPED subject to final evidence reconciliation**. This audit does not grant a new stable approval or stable tag.

Final independent X10 addendum: `workstreams/X10-FINAL-CONSISTENCY.md/json` verifies current source/clone/asset/lock/receipt pins. Root adopted X10 after this PASS: **62 PASS / 30 PARTIAL / 1 N/A / 0 BLOCKED**,67.3913%closed. Provisional score stays84.0; stable approval false. Original report above remains dated before the addendum.
