# Transformation roadmap

Design snapshot: 24 October 2026. This replaces a feature-count mindset with four connected product outcomes; it does not delete the R01–R48 backlog or relabel incomplete Checkpoint A acceptance. The [ultimate vision](VYUHA-ULTIMATE-VISION.md) defines the user journey and transformation levels. Specialist decisions and references are in [UI/3D](WORLD-CLASS-UI-3D-RESEARCH.md), [simulation](SIMULATION-TRANSFORMATION.md), [AI](AI-TRAINING-TRANSFORMATION.md) and [opportunities](BREAKTHROUGH-OPPORTUNITIES.md).

This document is a proposed sequence, not proof that implementation is finished. Work began against HEAD `8f6d6f1` with active local R01 texture and assessment-generation changes. Exact source/receipt status must be recorded when each slice is frozen. No new capability IDs are assigned mechanically.

## Sequence and decision gates

```text
Preserve and settle the interrupted texture comparison / current acceptance work
                            |
                            v
Evidence Reconstruction Theatre — complete observation/reference investigation
                |                                  |
                v                                  v
Observation-driven Training World       Mission / Scenario Studio
                |                                  |
                +---------------+------------------+
                                v
                Evidence-grounded Learning Journey
                                |
                                v
        Paired-world inquiry / learning-effect experiments
```

A shared evidence frame, scenario/objective manifest and course orchestration contract connect these outcomes. They are bounded interfaces, not a mandate to rewrite every module at once. World and Studio are two user-facing outcomes in one mission-contract engineering stream, matching the three streams in the AI/opportunity reports. The first Theatre slice needs no new scoring engine or database migration. Active evidence requests do need a versioned simulation contract. That distinction determines the order.

## Immediate preservation and Checkpoint A closure

Finish the already interrupted chunked-texture comparison through its existing workstream. Preserve original and candidate modes, source/configuration hashes, matched viewport/device/workload and raw traces. Record whether the candidate improves the intended startup/long-frame metric; reject or retain an optional experiment if the result is inconclusive or introduces readiness/quality regressions. A reduction in texture-build count alone is not a responsiveness win. Do not restart the earlier completed comparisons.

Close the specific unfinished Checkpoint A content, protocol and evidence gates using their existing documents and receipts. A supporting diagnostic UI remains Level 2 even when necessary for this closure. Keep this work distinct from the major experience upgrade so neither performance nor learning acceptance is implied by a new layout. Preserve local assessment-generation work; do not duplicate it in a replacement prototype.

Then freeze a focused Theatre baseline: one synthetic verified practice, one assessment, one Crew history, an early-end record, a historical engine record and a cached offline AAR. Retain enough baseline screenshots/task steps to assess the complete workflow; no large benchmark campaign is needed for a presentation-only baseline.

## First delivery: Evidence Reconstruction Theatre

**Why current behavior is insufficient.** `App.tsx` already links selected Ghost decisions and timeline events to replay tick/order/contact. `Ghost.tsx` already explains evidence and labels reference expectations. The unmet need is a unified investigation: the scene is an external ground-truth view while available evidence is pinned separately, and explanation, decision path, comparison and next training remain fragmented. Adding another timeline or pin control would be Level 2.

**Outcome.** Replace the primary Replay & Decisions composition with a dominant reconstruction canvas, one decision/event rail, explicit time context and modeled-observation/reference lenses. The user can investigate what the simulator made available, reveal reference state deliberately, and explain one specific decision with its evidence and consequence. This complete replacement can be Level 3. Do not call it Level 4 solely because the layout looks different.

**References.** [NASA Open MCT's Time API](https://github.com/nasa/openmct/blob/master/API.md) informs shared temporal context; [Epic's replay architecture](https://dev.epicgames.com/documentation/en-us/unreal-engine/using-the-replay-system-in-unreal-engine) informs separation of reconstruction, presentation and compatibility; [PEARLS](https://pubmed.ncbi.nlm.nih.gov/25710312/) motivates active explanation of an event before passive receipt of feedback. These sources do not validate the proposed VYUHA outcome. No external code, cards or artwork are required.

**Implement in a bounded vertical slice.**

1. Derive a typed review context from session ID, scenario/engine version, replay tick, optional before-order, selected decision/contact, lens and pin state. Reuse the existing `seek` and `timelineSeek` semantics. A decision's evidence tick, its action order and a sensor sample time are separate fields; do not normalize away missing provenance.
2. Compose the current scene, timeline and evidence components into one primary workspace. Preserve deep access to scores, reference runs, Fusion review, teaching notes and learner reflection. The useful replacement is the complete path through a decision, not a duplicate new page users must discover.
3. Route the observation lens through `visibility.ts`, `observed-contacts.ts` and current engine snapshots. Audit every consumer: geometry, camera framing, contact list, selected-contact metadata, labels, radar, messages and fallback. Merely removing `groundTruth` from `<Scene>` is insufficient if neighboring components still disclose truth.
4. Keep reference reconstruction visibly distinct and available only in the review context. Never describe reconstruction as a recording of the learner's actual gaze, viewport, channel choice or attention. Legacy data supports modeled availability, not those claims.
5. Display the evidence/action/rule/outcome chain from verified review fields. Source links may support a modeled explanation; do not fabricate causal edges, infer an unseen observation, or label a scoring projection as an observed impact. A counterfactual must remain a distinct hypothetical branch.
6. Preserve keyboard/simple-pointer operation and a complete text/tactical fallback. Reduce motion and avoid required flying-camera transitions. End with an explicit next-practice intent only when supported; a fresh preparation is deliberate and cannot auto-launch or rewrite the source attempt.

**Actual files and ownership seams.** `client/src/App.tsx` owns record loading, replay state, session selection and composition; extract the presentation/controller boundary rather than duplicating reconstruction there. `Ghost.tsx` supplies `EvidenceView`, `GhostTimeline`, `ReplayTracks` and `timelineSeek`. `Scene.tsx`, `visibility.ts`, `observed-contacts.ts`, `Radar.tsx` and `types.ts` govern scene and evidence presentation. `AdvancedAAR.tsx`, `ExpertComparison.tsx`, `ReferenceRun.tsx`, `LearningEvidence.tsx` and `LearnerReflection.tsx` must remain reachable. `server/review.py`, `review_v2.py` and existing engine dispatch remain authoritative and unchanged for this first slice. New client helper/component names are implementation choices, not already-existing source.

**Focused acceptance.**

| Complete task or invariant | Evidence needed |
|---|---|
| Select a decision/event and understand its exact moment | Same-tick commands/actions, before/after ordering, no-action review and early horizon fixtures; scene and explanation identify their respective times. |
| Investigate modeled evidence without reference leakage | A hidden contact, a radar-only contact, missing EO/IR observation, unavailable RF/IFF, a stale/coasted position and an absent selected contact. Truth cannot enter camera bounds, labels, messages or fallback in this lens. |
| Reveal reference state and return safely | Lens switch is explicit; reference state cannot remain in the observation view after switch/session change. If evidence is pinned, both playhead and evidence time are shown. |
| Recover or work offline | Session switch during reconstruction/load, stale async response, cached verified record, unverified local record and unavailable original server. No invented review when verification is absent. |
| Complete the investigation accessibly | Real-browser keyboard/simple-pointer walkthrough, small viewport, reduced motion, text/tactical equivalent; targeted DOM/axe checks only support the tested semantics. |
| Preserve authority and historical behavior | Input record and persisted score/profile unchanged; legacy engine reconstruction and Crew attribution fixtures remain correct; hypothetical/reference operations cannot mutate the original. |

Record the changed-file tests, targeted visibility/replay/navigation integration and a real-browser task receipt with screenshots of both lenses. Run proportional engine/history compatibility checks only if shared contracts change. Avoid rerunning unrelated complete suites. Renderer/performance claims require matched measurements; a visual walkthrough alone supports interaction, not a speedup.

**Measurable user outcome.** Baseline a fixed five-question task: identify evidence available at a decision, its timestamp, one unavailable cue, whether the outcome was observed/projected, and a justified next check. Compare wrong-time/hindsight answers, context changes, keyboard steps and completion time before/after. A single developer walkthrough verifies function, not general user improvement. Set a quantitative target after baseline, then publish observed results and sample size.

**Migration and rollback.** This is a derived-client presentation migration: no rewrite of stored records, scores, learning evidence or portable bundles. Keep the former composition behind one temporary implementation switch during focused acceptance, sharing the same canonical record and replay controller. Remove duplicate composition after acceptance; do not maintain two diverging engines. If evidence isolation or historical behavior fails, return to the former composition while preserving the new work. No destructive data rollback is needed.

## Next delivery: Observation-driven Training World

**Why current behavior is insufficient.** Sensor models and observation-aware geometry already exist, but evidence is largely supplied rather than acquired through a task-relevant decision. Visually richer contacts and environments can improve legibility; they cannot by themselves train when to seek another cue or when uncertainty requires waiting.

**Outcome / level.** Create synthetic missions in which evidence acquisition, waiting and cross-checking change what can be responsibly concluded. A coherent world with new inquiry semantics is Level 4. Asset quality and camera polish within existing semantics are Level 2/3 and should be reported separately.

**Dependencies and implementation.** Extend a new versioned engine/sensor/action contract beside existing dispatch, not inside frozen legacy rules. Model accepted request, scheduled availability, delivered sanitized observation and cancellation/expiry where relevant. Only include costs, delays and ambiguity that serve a declared training objective; illustrative settings are not physically calibrated radar/EO/IR/RF models. Carry request/delivery IDs into the Theatre. Enrich world generation, atmosphere, original contact assets, optics and uncertainty visualization through the graphics plan, with authoritative occlusion and render quality tiers kept explicit.

**Source seams.** `server/engine_v2.py`, `sensors_v2.py`, `raid_v2.py`, corresponding `client/src/sim.ts`, `sensors-v2.ts`, scenario types and worker dispatch establish the compatibility boundary. New behavior belongs in versioned successors. `action-evidence.ts`, `VRCockpit.tsx`, `VRWorld.tsx`, `DecisionWorkspace.tsx` and Crew server dispatch carry accepted intent/ownership. `world/Environment.tsx`, `world/procedural-textures.ts`, `Scene.tsx` and `world/materials.ts` carry rendering changes; do not assume a new renderer supports the custom shader hooks.

**Acceptance / rollback.** Freeze parity fixtures for accepted request/delivery timing, pause/resume/recovery, same-tick ordering, replay, import/export, browser/XR intent equivalence and no future information. Tests include unsuccessful or unavailable inquiry and rational abstention; repeated requests cannot farm score. Offline restoration preserves pending timing semantics rather than delivering all evidence immediately. Keep legacy manifests on their historical engine. Roll back new sessions to a prior supported manifest/policy; never reinterpret already completed sessions under old semantics.

**Visible measurable change.** Demonstrate at least two cases where the same initial ambiguity leads to a justified cross-check or justified abstention, and the Theatre explains why. Measure task completion, inappropriate certainty and unnecessary requests. Visual/latency/frame-tail measurements use a matched workload and named device; XR has its own physical gate.

## Next delivery: Mission and Scenario Studio

**Why current behavior is insufficient.** Existing scenario generation and instructor controls can create and steer exercises. A large number of seeds does not establish meaningful diversity, solvability, equivalent challenge or a coherent lesson. Separate authoring, generation diagnostics, live control and AAR make instructors assemble the experiment themselves.

**Outcome / level.** An instructor specifies objective, ambiguity, allowed channels, assistance, environmental variation and team structure. The Studio compiles a frozen runnable manifest and previews evidence opportunities before launch. Live cohort control, accepted command receipts, bookmarks and debrief share that mission context. Integrated author→preview→run→debrief is Level 4; a diagnostic panel remains Level 2.

**Dependencies and architecture.** Define a versioned mission contract with objective, scenario family, evidence opportunities, assessment obligations, allowed inquiry/assistance, engine/config hashes and provenance. A compiler may propose variants; a feasibility checker must show a witness or an explicit uncertainty/failure. Use only synthetic educational constraints. Keep author-only reference state separate from learner projections. Semantic fingerprints represent the evidence problem and solution alternatives, not only seed or JSON identity.

**Source seams.** `server/learning.py`, `config/learning-v1.json`, `raid_v2.py`, `assessment_obligations.py`, generation/diagnostic modules and `portable.py` define existing metadata and verification paths. `Instructor.tsx`, `useInstructorFeed.ts`, `Evaluation.tsx` and scenario authoring surfaces define the UI integration points. Preserve current generation receipt work and expand its role after it is integrated. New mission manifest/schema/compiler modules are proposed, not already implemented.

**Acceptance / migration / rollback.** One complete authored mission must preview a valid opportunity, launch deterministically, accept an instructor intervention, recover after reconnect and reconstruct with correct Crew attribution. Test impossible tasks, unsupported versions, stale manifests, legitimate alternative solution paths, missing sensor opportunity and withheld-assessment family leakage. Existing scenarios remain runnable without new mandatory metadata. Additive tables/manifests preserve original source hashes; unsupported recipients reject new semantics explicitly. A previous authored manifest remains selectable, while completed records retain their exact contract.

**Measurable change.** Compare instructor time and errors to create a specified task, percentage of invalid tasks caught before launch, semantic family coverage and debrief retrieval steps. Automated feasibility under an illustrative model is not empirical item fairness or real-world training validity.

## Next delivery: Evidence-grounded Learning Journey

**Why current behavior is insufficient.** Full/faded lessons, coverage selection, Beta estimates, policy diagnostics and Fusion assistance provide useful foundations. They do not establish an optimal learning strategy, calibrated confidence, longitudinal retention model or cohesive learner experience. Another AI conversation surface would not resolve these gaps.

**Outcome / level.** Academy becomes a sequence of authored investigations and independent demonstrations. A source-bound gap from the Theatre selects a new eligible family, instruction fades deliberately, and later assessment distinguishes exposure, repeated practice and transfer. The Studio lets instructors author these paths. A cohesive journey is Level 3/4; proven adaptive benefit remains a Level 5 candidate.

**Dependencies and architecture.** Separate domain evidence, learner-state model, pedagogical strategy and explanation adapter, as motivated by [GIFT](https://www.gifttutoring.org/projects/gift/wiki/Overview). Preserve existing policy as a baseline and fallback. Record model/config/training-data lineage, assistance exposure when captured, selection reason, candidate eligibility and frozen content. Tutor explanations resolve to authorized evidence; no generated claim can alter score, produce an accepted action or silently redefine the rubric. Offline use retains an authored deterministic path.

**Source seams.** `Academy.tsx`, `learning.ts`, `LearningEvidence.tsx`, `LearnerReflection.tsx`, `server/learning.py`, `director.py`, `director_v2.py`, `curriculum_diagnostic.py`, `fusion.py`, `portable_fusion.py`, `action-evidence.ts` and controlled-study lifecycle modules provide existing ownership and evaluation contracts. Treat new trained models or external AI services as optional versioned adapters with observable-only input. No model adoption is justified merely by synthetic accuracy or an appealing explanation.

**Acceptance / rollback.** Reproducible policy selection; separation of practice, help exposure, Crew and assessment; semantically held-out tasks; stale/lost response handling; evidence-linked abstention; no answer leakage from debrief into held-out assessment; assistance/model unavailability fallback; preserved historical profiles. Predictive evaluation splits by learner and scenario family where applicable and compares calibration, risk/coverage and latency to simple baselines. Participant evaluation separately addresses learning/retention/transfer, attrition and assistance. Roll back the policy/model for new selections while retaining policy provenance for prior attempts.

**Measurable change.** Fewer incoherent transitions and manual restarts are product outcomes. Better held-out prediction is a modeling outcome. Better independent delayed performance under a credible study is a learning outcome. Report each separately; none implies operational certification.

## Research breakthrough candidate: indistinguishable worlds and useful inquiry

Construct pairs of synthetic worlds with identical trainee-visible histories but different reference states. Only a permitted acquisition may distinguish a pair; some pairs remain indistinguishable and require calibrated abstention. A frozen mission contract defines legitimate information, assistance and acceptable alternatives. An offline belief/policy solver can test the author's challenge; it cannot give hidden state to the live tutor or learner.

This is Level 5 because novelty, solvability, instructional utility and learning effect remain uncertain. It depends on the observation contract, scenario compiler and reconstruction views. Start with one small family, compare a nonadaptive authored baseline and an acquisition-aware policy on held-out families, and audit whether the policy exploits synthetic artifacts. Seek participant evidence only after model correctness and task content review. A positive synthetic benchmark establishes those synthetic properties, not a breakthrough in human learning. Source details and technical alternatives belong in [AI transformation](AI-TRAINING-TRANSFORMATION.md) and [breakthrough opportunities](BREAKTHROUGH-OPPORTUNITIES.md).

## Architecture and operational acceptance across all deliveries

| Shared concern | Required engineering behavior |
|---|---|
| Historical evidence | Version dispatch remains explicit; old events, commands, scores and profiles are never migrated by re-simulation under new rules. Derived views can be recomputed only under their named compatible semantics. |
| Offline/recovery | Cached verified AAR remains readable; new pending deliveries and drafts have bounded durable state; stale network responses cannot change another session. Unsupported semantics fail with a usable explanation. |
| Performance | Keep bounded histories/caches and avoid full replay per camera/UI update. Use workers/checkpoints only when profiling justifies them, with immutable versioned cache keys. Publish matched startup, seek and frame-tail evidence; mean FPS alone is inadequate. |
| Visual architecture | Compare WebGL2 evolution, WebGPU prototype and native/streamed alternatives against actual custom-material/multipass, device, offline and XR requirements. No replacement before a credible compatibility/performance/asset pipeline exists. |
| Accessibility/XR | Primary tasks have keyboard, simple-pointer and text/tactical equivalents. Stationary operation, recentering, readable instruments and reduced motion are designed into the flow. Physical-headset evidence remains distinct from emulator/browser tests; [XAUR](https://www.w3.org/TR/xaur/) supplies user needs, not certification. |
| Team/instructor ownership | Role/capability checks, accepted action/command receipts, attribution and lifecycle survive the new presentation. Shared Crew evidence does not become individual mastery. |
| Source and claims | Each coherent slice records source hash, config, test invocation, browser/device and unverified scope. Prior receipts remain historical. Research concepts, implemented behavior, synthetic results and human evidence have separate statuses. |

During development, test changed behavior and affected contracts. Expand only when a real shared dependency changes or a failure creates a new concern. A frozen coherent release candidate receives comprehensive system acceptance, including historical compatibility, offline/recovery, supported devices, security/ownership and the chosen browser/XR matrix. No isolated flagship, document set or test total closes that release gate.

## Stop, retain or proceed

Proceed with the Theatre when it delivers an observable investigation task that the prior composition made awkward and it preserves evidence boundaries. Retain an experiment without promoting it if visual appeal improves but the task or performance outcome is unmeasured. Stop or revert a candidate if it leaks reference state, invents evidence, damages historical replay, increases disorientation, invalidates alternatives or requires unbounded work on a supported device.

Proceed to active inquiry only after its model and cross-surface replay contract are explicit. Proceed to fitted adaptation only after data and held-out baselines justify it. Do not postpone all visible product work behind these research gates: the Theatre, art direction, mission-control composition and authored guided investigations can advance now while the uncertain algorithms remain experiments.


## Implementation status —24 October2026

The first Level3 Theatre slice is integrated and focused-tested: primary scene-led observation/reference composition, source-linked chapters, exact event boundaries, cursor/pinned disclosure, bounded rail, keyboard and responsive fallback. See [actual scope, tests and browser evidence](../next-generation/checkpoint-a/EVIDENCE-THEATRE.md). Original replay composition has been replaced after this bounded acceptance; Git history preserves rollback, rather than shipping two diverging review implementations. No Level4 learning outcome or complete product transformation is claimed. Observation-driven inquiry, Studio and instructional runtime remain proposed, with their versioning/dependency gates above.
