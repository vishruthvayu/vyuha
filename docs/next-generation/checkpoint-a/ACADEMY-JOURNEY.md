# Academy learning journey — integrated development milestone

24 October 2026. Branch `feature/vyuha-next-generation`. Exact runtime source, focused results and artifact hashes are in [journey-receipt.json](evidence/journey-receipt.json). This is a Level3 replacement of the primary Academy workflow. It is not the complete proposed Level4 instructional runtime, a new mastery model, final Checkpoint A acceptance or release acceptance.

## Implemented user journey

Academy now groups the actual frozen individual catalogue into five competency routes. A single lesson workspace connects supported practice → less-guided practice → independent assessment, with task objective, public instructions, review expectations, explicit preparation and a frozen launch ticket. Stage selection never starts or prepares an exercise automatically. Opening the ticket brings Training to READY; the trainee still uses Start.

The assessment stage binds both the selected competency's item and chosen form. Previously the independent assessment action selected from the form without retaining a course focus. No new scenario/compiler/engine/scoring semantics were introduced. Full/faded practice and assessment/none assistance remain distinct. Sparse form sets normalize the visible selection and actual request together.

Verified Ghost competency rows with observations link back to the corresponding Academy focus. The route validates C01–C05 against actual individual catalogue entries; unknown/Crew IDs cannot create an individual course. This connects the new Evidence Reconstruction Theatre, existing verified competency review and deliberate fresh practice. It does not infer legacy four-skill profile equivalence or silently allocate a new task.

Original-server counts remain counts. Suggested stages use existing positive practice-item observations, not a fitted learning state or assessment pass. Learners can deliberately choose any available stage. Practice, unassessable evidence and Crew records are not promoted to mastery or individual assessment. Existing lesson content and form/compiler contracts are reused; deeper content and observed-opportunity validity remain unfinished.

Lifecycle handling retains same-ticket retry and rejects double-submit, stale identity/stage/refresh responses, mismatched catalogue/item/mode/assistance and invalid preparation results before exposing a launch link. Refresh preserves deliberate course/stage selection, clears the prepared ticket and loads original-server evidence. No new backend persistence schema or cloud service.

## Focused validation

| Scope | Exact result |
|---|---|
| Final course/helper/UI and review-return link tests | **10 passed**, zero failures,2.454s. Real catalogue grouping, Crew exclusion, practice suggestions, immutable assistance, three explicit stages, populated structural axe, stage/identity races, retry, sparse-form fallback, invalid route/load/preparation and original review immutability. |
| Existing affected integrated interfaces | **4 passed**, zero failures,3.228s. Existing Academy preparation/trainee binding, competency-review a11y, premium CSS-last import ordering and actual App frozen Academy-ticket/assessment context without default hints. |
| Explicit selected-item/form API contract | **2 backend passed**,1.71s. C01 baseline/C04 transfer selected item+form, no assistance, same-request idempotency, mismatched form422 and preparation does not increment attempt counts. Existing Starlette/httpx deprecation warning recorded; no failures. |
| Incremental TypeScript, changed-file lint, formatting | Passed. Registry generation/checker passed14capabilities/48recommendations. No unchanged complete suite or production build repeated. |
| Independent review | Separate static lifecycle/evidence review and actual desktop/tablet/mobile image critique found no blocker. Sparse-form fallback and prepared-result announcement improved following review. This is not outside certification. |

The agent's initial nine-test run used a staged path and exposed staging JSX/test-harness configuration issues; corrected scoped tests passed. Root integrated ten-test run then passed against actual repository source after horizontal-rail control was added. Test-only formatting was corrected afterward without rerunning semantically unchanged checks. Browser layout fixes changed CSS only and were verified directly.

## Actual browser acceptance

Disposable synthetic owner `ACADEMY-BROWSER`; development preview8040 / QA API8042. No real participant evidence.

- Prepared C01 faded practice and saw the exact `C01_PRACTICE_B` ticket with faded assistance.
- Selected C04 → independent stage → Transfer D; accepted `C04_TRANSFER-D_A`, assistance none. Opened actual Training in READY at00:00, with guided hints/Fusion disabled. No automatic start.
- Followed verified Ghost's `Explore C02 practice` link into C02 supported practice without automatic preparation.
- Ran a fresh C01 guided practice through real Training, paused/resumed, selected a reported radar contact, designated and ended at observed tick413. Original server verified session `3957be96-8082-4209-884d-cff91964ab56`, score2/100; C01 incorrect1/C02 unassessable1. No correct or mastery claim is made for this deliberately incomplete operator walkthrough.
- Opened its Theatre/competency evidence and followed the C01 course link. Academy correctly continued to suggest supported practice, rather than treating completion as success. Existing original rows remained byte-equivalent, with one deliberate new practice session/learning attempt. Individual skill-profile/outcome row counts remained unchanged. See [database integrity](evidence/journey-database-integrity.json).
- Keyboard Enter changed guidance stage. Desktop, CSS390×844 phone-width and820×1180 tablet layouts inspected at visual scale1. Body widths matched390/820. Mobile focus rail scrolls internally and brings the selected competency into view. The initial mobile grid expanded body width1306; explicit minimum track sizing/rail bounds fixed it to390.
- An immediate post-resize screenshot was miniaturized390×219 and was rejected as mobile acceptance evidence. Recapture after reload/layout produced actual390×844 readable mobile proof. Screenshot API returns JPEG bytes; final files use `.jpg`. Tablet image is820×1170 while CSS viewport reports820×1180, reflecting the capture surface crop; it is not claimed as a pixel-perfect height measurement.

Before/after and proof: [previous Academy](evidence/vyuha-academy-before.jpg), [desktop journey](evidence/vyuha-academy-journey-desktop-final.jpg), [mobile](evidence/vyuha-academy-journey-mobile-final.jpg), [tablet](evidence/vyuha-academy-journey-tablet-final.jpg), [assessment in Training READY](evidence/vyuha-academy-assessment-training-ready.jpg), [fresh verified practice](evidence/vyuha-journey-fresh-practice-verified.jpg).

## Remaining scope and owner preview

No measured FPS/latency or human learning improvement is claimed. Renderer/engine/history/Crew/Fusion/Transfer/offline dispatch were not modified; comprehensive frozen-release validation remains open. The earlier Theatre source seal remains valid for its exact commit; this slice changes the connected learning presentation and carries a separate seal.

Checkpoint A/R03–R07 remain PARTIAL. Retention/transfer experiment execution needs actual participant evidence. The wider transformation still includes active observation acquisition with a versioned contract, richer simulation/environment work, Mission/Scenario Studio, instructional policy evaluation, Instructor/Crew/Analytics/XR improvements and final release qualification. Six research documents distinguish those designs from implemented source. No protected release/RC/tag has changed.

The running owner preview is [Academy](http://localhost:8040/academy) and [Review](http://localhost:8040/?view=aar). This uses current development source, not an asserted production build. A normal local production run rebuilds explicitly:

```sh
cd /Users/seemalanaveenyadav/Desktop/SIH/vyuha/work/finale/ultimate-experience/browser-vr-unified
bash scripts/start-local.sh --port 8000
```

That command uses the owner's configured data/authentication rather than the disposable browser QA database. Comprehensive acceptance must still be performed on the future frozen release before tagging.
