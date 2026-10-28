# Connected observation-mission milestone

Implementation: `91dfce796eedc3a384d4a65b5fee4771108b5598` on `feature/vyuha-next-generation`.
Source-input policy: `vyuha-source-inputs-v2`; SHA-256 `72fbac1245cb8a4e9aa9ddf957d0c559c56250e5119baa0562828488f8a9389d`.
This is targeted development acceptance, **not full-system or release acceptance**. The pre-existing v0.5 receipt stays immutable. The production build truthfully identifies its pre-commit parent and dirty source; its source hash equals this committed implementation. No release/tag was created.

## What is integrated

| Flagship / contract | Actual functionality | Remaining scope |
|---|---|---|
| A / Observation Flight Deck | Full-width observed-only world, compact tasking, synchronized logical-time evidence deck, current RF/IFF context, explicit released-result inspection, focus/minimize, desktop/tablet/mobile layout | Wider product visual transformation, authored environment diversity, renderer qualification and real XR remain incomplete. No new material/shader/aircraft model is claimed here. |
| B / observation-mission-v1 | Three distinct challenge templates, frozen custom objectives/conditions/policy, actual deterministic author probe, spatial five-channel rehearsal, read-only seeking, publish/content-hash admission, normal trainee launch | Probe is a bounded witness schedule, not optimal planning, human detectability or a guarantee of solvability. Author rehearsal evidence is never copied into training. |
| C / evidence-assessment-v1 | Exact before-action public evidence; separate type, affiliation and restraint findings; current/expired optical boundaries; positive IFF independent of optics; descriptive acquisition utility; explainable Ghost links and evidence-gap follow-up | Explicit unclassified Defer is **not implemented in this revision**. Existing Hold requires prior classification. Confidence and human cognitive reliance are not measured. These limitations must not be silently credited as competence. |
| Connected Academy / evidence-gap-director-v1 | Practice/independent modes, reproducible seeds, frozen saved missions, bounded read-only progression, reason/basis linked back to the original session, changed-condition practice recommendation | Independent software forms are not empirically equated assessments. Existing mastery/Beta profiles remain isolated; no mastery or human learning gain is awarded. |

All old engine and score implementations are unchanged in this milestone. Existing default mission fixtures are frozen. Crew and XR acquisition remain gated.

## Focused checks on the implementation

- **19 backend tests passed**, `test_observation_missions.py` + `test_observation_assessment.py`; 31.55 s. Includes compiler recomposition/hash protection, all three actual probes, officer protection, preset-only public preparation, exact publication order, no future evidence, post-expiry IFF, no truth contamination, no request-count mastery, read-only mode-separated progression, Transfer/Restore regeneration and duplicate protection. Deprecation and pytest-cache permission warnings are retained in the log.
- **15 frontend tests passed** across mission admission, authoring/publication parity, live flight-deck interactions, assessment-to-replay links, Academy stale-identity isolation and command navigation. Python/TypeScript publication snapshots agree for all three authored templates.
- **5 targeted App orchestration tests passed** for both changed-seed mission launches, frozen Academy admission, and refused/offline legacy admission. Two new tests first reproduced the bug: synchronizing an authored mission seed invalidated its own frozen preparation. The correction preserves that preparation while retaining invalidation for actual changed inputs.
- **2 affected acquisition compatibility tests passed**: worker pending-task restoration/order gaps/duplicate ownership/cancellation, and verified review release/expiry boundaries. This run selected these two tests; it is not the full historical/parity suite.
- Integrated TypeScript check, modified-file ESLint and production build passed. Build packaged **80 local assets**. The existing large-chunk warning is retained, not suppressed.
- Full backend/frontend, historical 18/22 scorecards, Docker, full browser/VR and physical platform checks were **not rerun**. Frozen simulation/scoring sources were not edited. Prior evidence remains scoped to its original source; this milestone is not a release.

## Actual connected browser journey

Disposable database `/private/tmp/vyuha-missions-qa/unit.db`; the user's database and officer credentials were not used or modified. QA-only officer credential is outside the repository and never appears in the receipt.

1. Officer signed into `/observation-missions`, authored **QA · Night cross-check investigation**, compiled it and inspected actual report intervals. Probe checks witnessed unavailable EO and detected IR.
2. An EO interval click sought T+2.00 s; switching to IR and selecting the detected interval sought **T+4.60 s** in the spatial rehearsal.
3. Published frozen mission `raid_87be4e223c6ddd35142a20df` and followed its real Training link. Explicit Prepare and Start retained the authored brief, conditions and objectives.
4. Selected radar T1; requested EO at **9.20 s**, sample **10.20**, release **10.40** (unavailable), then IR at **22.20**, sample **23.20**, release **23.40** (no detection). Pause stopped logical acquisition time. Expired evidence could not restore optical geometry. No successful trainee IR detection is claimed for this run; the author probe's IR result is a different schedule.
5. Explicit designation **34.53 s/order 4**, quad/hostile declaration **41.77 s/order 5**, Hold **48.97 s/order 6**; ended early at **55.43 s**.
6. Server-verified session `3eb201b3-d962-4084-aa7a-1bfa627e24b9` kept its **15/100 original rubric score**. Separate evidence findings reported supported designation, inconclusive type detail, unsupported hostile inference, and supported restraint. The prior declaration was not legitimized by Hold.
7. Educational boundary navigation sought **41.77 s, before order 5**. It deliberately left the older Ghost decision evidence pinned at another moment and displayed the two-moment distinction.
8. Academy showed one practice / zero independent mission sessions, no old assessed/mastery credit, and recommended **civil_restraint / seed 587642 / practice**, explicitly based on unsupported C02 evidence. Follow-up preparation exposed the changed-seed bug, which was fixed and browser-retested.

The authored journey ran in the development browser; the full-world before/after and rendering captures also used the actual production assets. They share the source hash above. Not every browser route or every template was manually exercised; all template compiler/probe paths were covered by the focused API/parity tests.

## Responsive and keyboard inspection

- Browser-reported CSS sizes, not assumed toolbar zoom: **398×844**, **1025×768**, and approximately **1440×900**. No physical phone/tablet claim.
- No horizontal document overflow in checked phone/tablet states. Phone task buttons measured **172×64 CSS px**, evidence toggle **70×44.65**. The expanded instrument is an intentionally scrollable, keyboard-focusable region; controls and evidence remain reachable.
- Real mobile radar opened, selected T2 and returned to the world with a current civil IFF cue. Enter opened the evidence dock and moved focus to its Focus world toggle.
- Matched visual scene: seed 482913, day, same urban world/sector camera, fixed Medium, no released optical geometry. Screenshots are genuine unedited captures; the in-app capture includes an outer blank extent. The world canvas grows from about **1080×800** to **1440×800** at the 1440×900 CSS viewport. This is more rendered area, not a shader-fidelity claim.

## Rendering evidence and limits

`baseline-timings.json`, `after-timings.json`, and `after-isolated-timings.json` preserve all attempts. Baseline runtime is `c50b989`, the actual cached production build underlying the previous acceptance. New runtime source hash matches `91dfce7`.

The first comparison was badly contended with multiple QA WebGL contexts: candidate p50 **30.2 ms**, p95 **182.1 ms**, p99 **368.1 ms**, max **862 ms** over 159.83 s. It is **not** discarded or labelled a pass. After closing the extra QA renderer and putting the baseline in 2D, the candidate's isolated 70.995 s capture had **4,133 frames**, p50 **16.7 ms**, p95 **22.4 ms**, p99 **30.9 ms**, max **50.7 ms** (one frame over 50 ms; none over 100 ms).

Baseline initial capture: 37.534 s, 2,252 frames, p50 **16.7 ms**, p95 **19.6 ms**, p99 **24.1 ms**, max **33.9 ms**. Isolated baseline repeat: 104.033 s, 6242 frames, p50 16.7 ms, p95 17.7 ms, p99 17.9 ms, max 23.4 ms, 0 frames over 50 ms. These are descriptive warm, paused-world render callbacks on the owner's MacBook Air M1, not GPU time, sustained 20/200-contact active training, first-load, headset FPS or a demonstrated speed improvement. Canvas area intentionally differs by one third. Captures have slightly different paused ticks; no optical contact geometry is released in either. Extra-context contention is an observed association, not proven causal attribution. One isolated repeat is not platform qualification.

## Research informing the implementation

- [NASA Open MCT](https://ammos.nasa.gov/openmct/) describes a common time reference across mission data; VYUHA's inference is to put acquisition, publication and evidence expiry on one explicit logical-time instrument.
- [Epic's UMG optimization guidance](https://dev.epicgames.com/documentation/en-us/unreal-engine/optimization-guidelines-for-umg-in-unreal-engine) discusses HUD layers and invalidation. VYUHA retains its web renderer and uses scoped task layers rather than importing Unreal code/assets.
- [National Academies assessment design](https://uwnxt.nationalacademies.org/read/18409/chapter/5) distinguishes claims, evidence and tasks and warns about sustainable cognitive inferences. VYUHA applies that distinction through a transparent synthetic support contract; this is not empirical validation of its educational criteria.

## Next dependency-ready work

Investigate and implement deliberate unclassified uncertainty under a new explicit decision contract, with deterministic frontier binding, persistence/recovery, archive integrity, Python/TypeScript agreement and truthful Ghost/progression integration. Never reinterpret inactivity or rewrite v0.5 events/scores to fill the gap. Wider visual/simulation/intelligence flagships remain ongoing.
