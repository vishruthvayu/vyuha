# Independent adversarial reassessment — 12 October 2026

**83.5/100 provisional: PS 46/50, realism/AI 18/25, engineering/demo 19.5/25. Stable approval is withheld.** This is an independent engineering judgement using the retained 50/25/25 allocation, not official SIH marks or a winning probability. Current-source manifest and macOS clean-clone reconciliation now match the inspected source; a candidate pin is not stable acceptance. The previous 82 and interim 82.5 remain dated checkpoints.

Scope: canonical `/Users/seemalanaveenyadav/Desktop/SIH/vyuha/outputs/vyuha`, branch `feature/vyuha-finale-edition`, source commit `4f1f5d3835dcd1cc6f84d0e6c070c1b45c9d6903`; independently computed source SHA256 `94d311b647337ea9e1db5cac8cd75fc86b70f46717b5c1e8ad18fffbeb05595e`. Read new implementation, retained 93 findings and limitations, previous exact deductions and available receipts. No implementation was edited. Independent checks used temporary databases, not the user's production data.

## Independent checks and attribution

- Backend: `PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -m pytest -q -p no:cacheprovider server/tests/test_crew_lifecycle_history.py server/tests/test_sensor_memory_copy.py server/tests/test_startup_portability.py server/tests/test_compliance.py server/tests/test_finale_security.py server/tests/test_portable_crew.py` — **76 PASS, 0 FAIL, 37.92s**, no skips/xfails; one Starlette/httpx deprecation warning.
- Frontend: `node --import tsx --test src/crew-history.test.tsx src/crew-coordination.test.tsx src/compliance.test.tsx` — **8 PASS, 0 FAIL, 417.823875ms**, no skipped/cancelled tests.
- Independent three-session signed-transfer reproduction, saved outside the repository at `/tmp/test_vyuha_independent_archive_history.py` — **1 PASS, 2.98s**. One local group with three sessions becomes three imported groups with one session each. All three complete sessions remain present. This test asserts the observed limitation, not equivalence of longitudinal grouping.
- Independently read canonical production build: **26 local files; cache `vyuha-72094449dd1b`**. `git diff --check` passed. Both `release/v1.0.1` and peeled `v1.0.1` retain `2ca96105044ad6a14952d74db619e20006c26eca`.
- Root reports current full regression **482 backend PASS/275.39s, 137 frontend PASS/43841.548125ms**, build PASS, exact 18 baseline/22 stored historical cards. These are root results, not independently rerun broad counts. Focused checks above must not be added to those totals.

## Findings and boundaries

No new actionable implementation correctness, accepted-history mutation, mutable-copy alias, or role-authorization defect was found in the inspected changes. A remaining readable-control issue is recorded below. This is scoped inspection and regression evidence, not a universal security guarantee.

Crew expiry/revoke/rotate stores only hashes, preserves member IDs, and checks validity before existing idempotent receipts. Revoked and expired capabilities reject role state/actions and protected shared-session AAR/Fusion/reference paths; administration requires the officer bearer. Legacy unbounded codes require explicit rotation. Immutable accepted events, attribution, cards and individual skill ledgers survive lifecycle changes. Ordinary independent learner callsign/UUID identity remains a trusted-LAN model, and confidentiality still depends on trusted HTTPS.

Completed history is read-only, excludes active exercises, limits results to 100 sessions and returned timelines to 100 actions per session, and retains each complete session's metrics. Crew action logs have a 5,000-action cap and rosters have an eight-member cap; the runtime cache caps at 64. Summary medians pool accepted logical-tick handoffs, with missing pairs null. UI labels distinguish shared scores and descriptive coordination from individual competence or learning gains.

**Privacy-preserving imported history has a narrower grouping contract.** Local grouping uses exact declared name plus callsign/role roster; imports group by pseudonymous Crew ID. Because a new Crew ID is created per exercise, three same-roster local exercises become three imported groups. No callsigns, codes, hashes, live permissions or individual Beta credit are restored. This is not a security defect or lost-session defect. The retained X15 criterion “signed transfer/import retains same aggregate history” is not fully met. A future optional versioned opaque source-group binding could preserve a declared cohort within a signing namespace without restoring personal labels or capabilities; such binding must remain descriptive, not identity proof.

The schema-guarded sensor-copy fast path detaches paints and positions; unknown, incomplete, subclass or nested extension shapes retain deepcopy behavior. Focused isolation tests pass. Launcher tests execute both POSIX and simulated Git Bash interpreter layouts with spaces, port transport and TLS preflight failures on this workstation. They do not establish native Windows/Linux acceptance.

All 93 finding links are unique; 75 have explicit implemented-workflow links, and the remainder have document evidence. Fixed route/document whitelists expose no private session catalogue. A workflow link is a prerequisite-aware starting point, not a saved-session proof or automatic PASS. The reconciled public backlog now removes obsolete expiry/shared-matrix/absent-local-history assertions and retains identity, privacy, calibration and deployment limits. F06 and X18 are defensibly scoped software PASS: F06 covers roles/authority/attribution/reconnect/completion and local history; X18 covers finding-specific evidence and prerequisite-aware workflow navigation. X15 remains PARTIAL. Counts are now 53 scoped PASS /39 PARTIAL /1 N/A, not 93 full acceptance demonstrations.

## Exact scoring and deductions

| PS criterion | Earned / available | Deduction and reason |
|---|---:|---|
| Desktop |3/3|0|
| Single-drone recognition/classification/response |5.5/6|0.5 fresh physical/mobile breadth|
| Swarm |4/5|1 operational/resource-area depth and human-load evidence|
| Day/night |5/5|0; implemented channel effects|
| Degraded sensors |4.5/5|0.5 broader physical/UI validation|
| Terrain |3.5/4|0.5 simplified geometry/effector/collateral depth|
| Scripted exercises |3/3|0|
| Procedural exercises |4.5/5|0.5 human anti-rote evidence|
| Decision-tree scoring |5.5/6|0.5 graphical path/comprehension breadth|
| Individual/unit repeated AAR |5/5|0; three-session read-only local roster/timeline evidence closes the prior software longitudinal deduction|
| Minimal hardware/unit use |2.5/3|0.5 fresh physical unit deployment|

PS **46/50**, deduction **4**. The +0.5 is software repeated-review credit. It does not award role competency, transferred cohort equivalence or physical-device credit.

| Realism/AI criterion | Earned / available | Deduction and reason |
|---|---:|---|
| Sensors/Fusion |6/8|2 empirical equipment/likelihood calibration and posterior validation|
| Swarm/motion |4/5|1 closed-form coordination and limited area doctrine|
| Response resources |3/4|1 three supported effectors and illustrative parameters|
| Adaptive AI |3/6|3 no fitted Elo/context posterior or measured human advantage|
| Scientific claim discipline |2/2|0; limitations remain explicit|

Realism/AI **18/25**, deduction **7**, unchanged. Dataset/research handoff documents establish a plan, not real data, calibration or human efficacy evidence.

| Engineering/demo criterion | Earned / available | Deduction and reason |
|---|---:|---|
| Regression/history |8/8|0; current attributed broad results, independent focused checks and retained history receipt|
| Access boundaries |4/5|1 ordinary trusted learner identity and pending physical TLS trust|
| Recovery/performance |4.5/5|0.5 wider Crew/ACK distributions, longer acceptance and total-memory scope|
| Platform execution |1.5/3|1.5 current native Windows/Linux execution pending|
| Release/demo/media |1.5/4|2.5 stable acceptance and validated media/rehearsal/submission unfinished|

Engineering/demo **19.5/25**, deduction **5.5**. Overall **16.5 deducted = 83.5/100**. The increase from the prior 82 is +0.5 for verified local repeated Crew review and +1 for current exact-source/assets/manifest, fresh locked-dependency macOS clone and completed scoped independent reassessment. The clone/install/walkthrough were executed by root; this reviewer independently inspected and reconciled their receipts, not rerun those installations. Earlier 3ec720d clone and performance receipts remain historical.

## Final source and receipt reconciliation

The independently recomputed current source hash equals `evidence.json`, `FINAL-RELEASE-GATES.json`, `CLEAN-CLONE-CYCLE2-RECEIPT.json` and `RECONSTRUCTION-CYCLE2-RECEIPT.json`. All underlying manifest-listed measurement receipt files and all 26 offline asset paths exist. The manifest additionally names this report and JSON, staged in `/tmp` for root to copy into the canonical evidence directory; these two staged artifacts were the only pending manifest paths at inspection. Current sensor source hash equals the new reconstruction receipt. Final application source is 4f1f5d3. The delta from the independently tested 33e150b is four Crew button appearance classes, whitespace in the timeline truncation disclosure and its retained test, and compliance wording/tests distinguishing final acceptance from provisional checkpoints. Changed/untracked acceptance files are documentation and evidence awaiting root's evidence commit, not subsequent application edits.

The fresh clone receipt preserves the initial 33e150b new Python venv and locked pip installation, then records fetching the final 4f1f5d3 delta, repeating npm ci with cached registry tarballs (95 added/96 audited/zero reported vulnerabilities), independently rebuilding matching assets, restarting actual macOS Bash with CLI port8032 overriding environment8033 into another zero-session/zero-trainee database, synthetic verified 83-point AAR, instructor ACK/Ghost/profile/Rapid ID, and exact whole-database backup/restore. Crew expiry/revoke/rotate/completion/history without individual ledger credit were tested at33e150b; Crew server implementation is unchanged in4f1f5d3. This is current macOS software deployment evidence, not native Windows/Linux or separate-device network evidence.

The current authorization receipt contains 32 registered route/method pairs with all anonymous/forged/logged-out cases returning 401. Existing independent tests cover expiration and ambient-cookie boundaries; no eight-hour physical expiry test is implied. The historical 18/22-card receipt retains exact immutable hashes and no production-database change.

The paired cycle-two reconstruction receipt covers 8/25/50/100/200 contacts with three direct and three loopback HTTP samples per size, before at 8dc8405 and after at 33e150b. Every full review/card hash matches before/after. At 200 contacts, direct medians are 9.6707s→7.1417s and HTTP medians 9.7531s→7.3825s. The eight-contact direct median worsens (0.4565s→0.5347s), so this does not establish a universal speedup. These source-specific synthetic timings retain workstation/interference and memory/concurrency scope limits. Prior unmatched 27.381s HTTP versus 11.025s direct observations are not substituted for this comparison.

The 128-seed variation receipt reports exact same-request reproduction, 123 roster multisets, 128 spawn schedules and eight families, with non-unique structural fingerprints. Source inspection confirms fingerprints use coarse kind/45-degree-bearing/wave/motion signatures; a duplicate across unrelated seeds is not a full-content collision. Anti-repeat enforces a similarity ceiling only against supplied bounded recent history. No human anti-rote benefit or operational solvability credit is awarded.

The independent review identified a readable-control issue in the first history screenshot and a dangling browser-receipt citation. Both are resolved in the final candidate: the four role loading/history refresh/rotation/revocation buttons use the existing explicit `button subtle` colors, the truncation text/test use “latest 100”, and the genuine `CYCLE2-BROWSER-ACCEPTANCE.json` is saved and manifest-listed. These corrections close the specific findings; X11 remains PARTIAL for broader accessibility, mobile and physical workflow evidence. The final history screenshot independently shows all three ordered role-attributed decisions and the 28.60s/0.30s logical handoffs, with individual competency exclusions visible.

The saved current browser receipt records two locally grouped completed exercises, role revocation/reconnection after rotation, verified shared officer AAR, What-if5 versus original0, and evidence-only reference0 with six independently generated actions/one command. Before/after whole-database dump SHA256 is identical and individual profile/outcome counts remain zero. Agent-controlled actions, different projected horizons, and same-workstation browser tabs do not establish human learning, matched-performance efficacy, separate-device physical networking or actual390px mobile acceptance.

Final delta verification independently reran `server/tests/test_compliance.py`: **6 PASS,0 FAIL,0.55s**, one unchanged Starlette warning; and the same three frontend files: **8 PASS,0 FAIL,321.300459ms**. These reruns are separate from the earlier76/8 checks and root's final482/137 totals, and are not added across runs.

## Acceptance decision

Current independent software review and source/receipt reconciliation are **PASS_SCOPED**. No new stable tag, release approval, 100/100, operational readiness or military/human efficacy claim is granted. Native Windows/Linux and new separate physical-device LAN/WAN/HTTPS trust/cold-reload acceptance remain genuinely pending by user instruction. Final competition PPT/PDF/video, rehearsal and submission remain unfinished deliverables. Optional research, calibrated Fusion/difficulty, richer effectors/GIS, push transport and decomposition work remain distinct from these acceptance gates.
