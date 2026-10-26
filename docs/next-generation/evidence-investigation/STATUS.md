# Evidence investigation — integrated development acceptance

26 October 2026. Final runtime **`086b3c6d148d3596379ee63d16f79b9b78c88899`**, branch `feature/vyuha-next-generation`. Source-inputs-v2 **`b82ab4af5eaa723becbb59d1d00f0f4744b09eed320dcde8a4e381e22502ab85`**, independently matched to a Git archive. Development acceptance for this bounded workflow; not frozen-release or whole-platform acceptance. Initial trainee workflow was committed and pushed at `e444bdc3b03162dfe58333d4e5a49c43a196ae42` (`3b6629fa9103de3bc5123bb113a5f36fb293999d465cbb18377bafb9a853dc14`); the follow-up adds authenticated, read-only officer access.

## What works

An Academy exercise now leads into an interactive **post-exercise report investigation** in Ghost. The learner considers two to four statements generated from the session's actual reconstructed reports, explicitly answers “supported” or “not established,” receives feedback only after recording the first answer, inspects the original replay moment, and returns to evidence-based classification practice. Positive observations and insufficient inferences are contrasted when the source reports permit it. If no positive example exists, that limitation is disclosed. Empty evidence fails explicitly rather than generating a fabricated case.

The mission is frozen once, including its version, questions, report moments, expected choices and explanations. Only public question fields are returned before answering. Ownership, completion and original-review hash checks precede reconstruction; Crew owners and non-learning sessions are excluded. Existing missions are read without rerunning simulation or regenerating questions. Saved first answers and request IDs are immutable. A changed ID/body, wrong question/mission, unknown version or damaged stored spec fails closed.

The browser scopes state to session/trainee/review hash. Pending answers survive reload in local storage, lock against accidental alteration after an uncertain send, and retry the same request. A saved answer from another device takes precedence over a conflicting local draft. Delayed responses and mismatched mission receipts cannot move answers into a different review. If browser storage is unavailable, the UI discloses that closing can lose an unsent draft.

The existing authenticated officer AAR now opens the same frozen questions and saved answers through a protected instructor GET route. It cannot start a missing mission, submit an answer or consume a learner's pending local draft. Unauthenticated/invalid-token requests return401. No officer write route was added; this does not upgrade or disguise the ordinary learner trusted-LAN identity model.

The report allowlist contains only time, radar, RF/IFF, visual silhouette, range and day/night. No canonical type/identity, expected action, prior trainee declaration or later-world truth is copied into these reports. “No reply” cannot establish hostility; a multirotor silhouette cannot establish its control link. Recorded answers do not alter the exercise score, assessment observations, individual learning profile, original accepted actions or Crew attribution. This is the existing trusted-LAN trainee-identity model, not a new authentication guarantee.

## Source and evidence

| Change | Source | Verification |
|---|---|---|
| Frozen report mission, answer/request ledger, officer authorization | `server/learning_investigation.py`; router/schema registration in `server/main.py`, `server/storage.py` | Final10 backend tests,0 failures,13.82s; `evidence/backend-officer-final.log`. Earlier9-test run retained, not additive. |
| Historical catalog/annotation compatibility | `server/tests/test_learning_catalogs.py`, existing reflection contracts | 22 tests,0 failures,21.48s; `evidence/learning-compatibility.log`. Includes both practice and assessment old-catalog transfer after a different current catalog is registered. |
| Explicit reasoning, delayed-response isolation, exact retry/recovery, first-answer conflicts and read-only officer view | `client/src/EvidenceInvestigation.tsx`, `evidence-investigation.test.tsx` | 8 component tests inside the final33-test selection;0 failures |
| Academy→Ghost→original moment→Academy | `AcademyLesson.tsx`, `LearningEvidence.tsx`, `Ghost.tsx`, `App.tsx` | Actual browser practice,2 accepted decisions, server verification,4 recorded answers, exact T+26.10s before-order0 jump and return to C02 |
| Theatre, reflection, learning journey and review isolation compatibility | Existing affected JSX tests | Final33 frontend tests,0 failures,5.889s; `evidence/frontend-officer-final.log` |
| TypeScript, changed-file ESLint/Prettier | Changed frontend modules | Passed. No full production build or unrelated suites rerun. |
| Desktop/tablet/phone layout | `evidence-investigation.css`; stylesheet loaded before existing final premium layer | Actual1152×648,768×1024,390×844 CSS viewports; DPR1,visual scale1; no document overflow. Phone answer targets51px high. Screenshots in `evidence/`. |

The final33-test run supersedes the earlier11/27/31 runs for overlapping frontend coverage; those counts are **not additive**. Backend22 includes14 catalog tests and8 existing reflection tests and remains reusable after the officer-only change: those runtime modules are unchanged. The earlier42-test catalog/learning selection is historical compatible evidence; it was not needlessly repeated wholesale after a frontend layout change. The10 final backend cases include original-table immutability for practice/assessment, owner/pending/non-learning/Crew exclusion, frozen-policy reuse, tampering, strict inputs, first-answer/request reuse, backup/transfer semantics and protected read-only officer access. Existing Starlette/httpx deprecation and Node local-storage warnings remain disclosed in raw logs.

## Actual browser acceptance

Isolated QA database and QA identity only. C02 practice seed62147, session `d968b48e-8824-4a5f-b2c9-4b6ef6a9a940`. Designation at T+26.10s and classification at T+28.13s; ended early at29.00s. Its15/100 score is a workflow probe, not a performance or learning result.

1. Prepared the frozen lesson through Academy, started Training, selected an observed contact, recorded designation/classification and ended through the real UI. Server verification and Ghost loaded.
2. Opened the investigation. No answer was preselected and no feedback was exposed before recording. A keyboard Space/Enter submission produced report-bounded positive feedback. An intentionally wrong silhouette answer produced corrective feedback without replacing the exercise score.
3. Reloaded the application and recovered saved answers. Reached the first unanswered case, retaining recorded earlier cases.
4. Stopped the actual QA server process before the final answer. The UI retained and locked the pending response. Restarted the same server/database, reloaded the page and reopened the mission. “Retry exact answer” remained available; the retry stored the fourth answer once.
5. Compared original session/chunk/command/learning-attempt/skill-profile/skill-outcome rows before answers2–4 and after outage/reload/retry: identical SHA256. The first answer preceded this browser snapshot; complete first-start/answer immutability is separately tested in both backend modes. See `browser-immutability.json`.
6. “Inspect original moment” aligned the Theatre at T+26.10s, before event order0, with the stored evidence and current decision; see `replay-link.txt`. Omission/report times use the report moment rather than silently substituting a later decision tick.
7. Returned to Academy with C02 selected. No assessment session or mastery credit was created by the investigation.
8. On the final officer follow-up, opened the existing officer AAR URL, completed the actual isolated QA sign-in, read all four recorded cases and inspected corrective feedback. No Record/Retry action button exists in that view. Original core-table hashes still match after officer inspection. See `officer.png` and `officer-review.txt`. The first trainee workflow/outage captures are from the initial milestone; the final33-test selection covers the changed shared component, and existing answers were read again on the final source rather than generating another identical training history.

Structural axe checks pass in the populated component and Theatre tests; color contrast is disabled in JSDOM and is **not** claimed as a complete WCAG audit. Actual screenshots, keyboard actions, reading order, wrapping and target geometry were inspected. These are responsive emulation checks on the Mac, not physical Android/tablet/XR acceptance. Delayed/lost-ack races are automated tests; the physical process-outage/reload/retry path was exercised in the browser.

## Scope boundaries and next implementation

| Capability | State | Remaining work |
|---|---|---|
| Original immutable catalog resolution | IMPLEMENTED for the existing52-item learning-v1 catalog | No new taxonomy or catalog content is introduced. See `../catalog-history/STATUS.md`. |
| Post-exercise report reasoning mission | VERIFIED for declared development scope | First-answer feedback is descriptive, not scored mastery. Broader cases and instructional effectiveness require separate design/evaluation. |
| Annotation backup | VERIFIED in focused test | Original-server SQLite backup/restore retains plans and answers. |
| Ordinary training transfer of investigation answers | INTENTIONALLY EXCLUDED | UI/API disclose the exclusion. Import preserves original training evidence; it does not silently claim that these annotations transferred. |
| True pre-decision inquiry / new observation acquisition | NOT IMPLEMENTED | Freeze a new engine/session-event/archive/curriculum contract; implement cadence-aligned logical dwell/release scheduling, no rerolls, order/fault/cancellation semantics and Python/TS parity before admission. |
| New acquisition in Crew / browser / VR / Fusion / recovery | NOT IMPLEMENTED | Explicit supported admissions and shared request/result receipts required. Existing action/worker/scoring contracts are unchanged. |
| Causal learning benefit, calibrated proficiency, operational realism | NOT ESTABLISHED | Requires real participant or empirical model evidence. |
| Full-system release qualification | NOT RUN for this milestone | Comprehensive backend/frontend/parity/historical/build/deployment/browser/physical gates belong to the frozen candidate. No RC/tag or protected-baseline merge. |

The research recommendation is preserved in `docs/competitive-research/EVIDENCE-INVESTIGATION-MISSIONS.md`. The immutable catalog registry was a prerequisite; this is the first integrated **passive-report, after-exercise** learning slice. It must not be relabeled as the complete v0.5 active-acquisition mission. The next dependency-ready engine work is the pure scheduler/fixture contract before any new request control. This does not replace the larger graphics, environment, authoring, Instructor/Crew, intelligence and XR backlog.
