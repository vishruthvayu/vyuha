# VYUHA ultimate vision: a synthetic decision-training environment

Research/design snapshot: 24 October 2026. This is a proposed product direction, not a release acceptance or a claim of educational superiority. Source inspection began at `feature/vyuha-next-generation`, HEAD `8f6d6f1`, with the ongoing chunked-texture experiment and assessment-generation UI visible as local work. Those changes belong to their existing workstreams. Earlier Academy, Ghost, assessment and research work remains a foundation; this document does not repeat their completion claims.

## The experience we are building

VYUHA should let a learner enter a believable synthetic situation, acquire evidence, make an explicit decision under uncertainty, reconstruct why the decision was reasonable or flawed, and practise the specific unresolved skill in a meaningfully different situation. An instructor should shape this entire loop, including team information flow and assessment conditions, from one coherent mission-control environment.

The product should feel like an interactive training world with an evidence system running through it. A visually impressive scene becomes useful when lighting, occlusion, contact motion, sensor degradation and uncertainty create an understandable learning problem. A debrief becomes useful when the learner can investigate the actual modeled evidence and distinguish it from hindsight. Adaptation becomes useful when it changes the next learning opportunity for an explainable reason. These are design hypotheses to evaluate, not established VYUHA learning effects.

The signature journey is **brief the objective → investigate the situation → decide → reconstruct the evidence → explain a gap → practise a new case → assess independently**. Onboarding, Academy, live training, Ghost, Time Machine and analytics should become phases of that journey, with stable terminology and context. Existing routes can survive as entry points; their current arrangement need not define the future information architecture.

## Where the current product is strong, and where it stops

The actual architecture already contains deterministic replay, Python/TypeScript reconstruction, versioned scenarios, observation-aware rendering, server verification, immutable learning evidence, controlled-study infrastructure, Crew attribution, Fusion exposure ownership and offline records. `Scene.tsx` and `visibility.ts` already gate live contact geometry and camera framing by modeled observations. `App.tsx` already seeks the replay when Ghost decisions or timeline events are selected. `Ghost.tsx` already distinguishes available evidence, ground truth, observed outcomes and scoring projections. These are substantial foundations, not features proposed here as missing.

The current experience still makes the user assemble a mental model across separate surfaces. The review scene is an external ground-truth reconstruction, the selected decision's evidence remains pinned while the playhead moves, and comparison, decision path and next-practice controls occupy separate sections. A synchronized selection button would be a small improvement because part of that behavior already exists. The stronger upgrade changes the central representation: investigation of evidence through time becomes the primary review workspace.

Similarly, Academy already has full/faded practice and separate assessments. Its remaining opportunity is a course built from consequential investigation tasks, not a larger lesson list. Fusion and Director already exist; a chatbot or more elaborate probability display would not establish stronger intelligence. Instructor control, scenario generation and Crew already exist; the opportunity is an objective-driven experiment studio with visible feasibility and team information-flow explanations.

## Four flagships that reinforce one another

| Flagship | What users notice | Defensible transformation level | Principal architectural change |
|---|---|---|---|
| **Evidence Reconstruction Theatre** | One dominant spatial reconstruction, an event/decision rail, and clearly separated modeled-observation and reference-world views explain the same selected moment. Evidence gaps become investigable. | First integrated replacement: **Level 3**. It reaches **Level 4** only when evidence acquisition, debrief and a new targeted practice case form an effective continuous workflow. | A renderer-independent review frame and temporal controller replace ad hoc review composition while retaining canonical reconstruction and records. |
| **Observation-driven Training World** | Learners choose a meaningful cross-check, wait for an available observation or request a teammate's report; the world makes evidence quality, age and delay legible. | **Level 4** when new acquisition choices materially change the training task and are reconstructed across desktop, XR and debrief. A prettier scene alone is Level 2 or 3. | Versioned acquisition/delivery events, observation channels and instructional constraints; upgraded environment/asset/rendering pipeline. |
| **Mission and Scenario Studio** | An instructor specifies the skill and evidence challenge, previews when a task is solvable, directs a cohort, and debriefs team information flow. | **Level 4** if authoring, feasibility, live control and reconstruction become one workflow. More form fields remain Level 2. | Objective-to-constraint compiler, versioned scenario manifests, preview witnesses and linked instructor session context. |
| **Evidence-grounded Learning Journey** | A course responds to a documented gap with a new task, fades help deliberately and shows independent evidence separately from exposure and practice. | Integrated progression is **Level 3/4**. A policy that reliably improves held-out learning/retention is a **Level 5 research candidate**, not a delivered claim. | Separate domain evidence, learner-state estimation, pedagogy and assistance adapters with policy provenance and evaluation gates. |

The four depend on the same evidence vocabulary. The Theatre explains an acquisition decision made in the World. The Studio creates that decision opportunity. The Learning Journey selects a different case that tests the unresolved question. Analytics reports which opportunities were presented and what independent evidence followed. These are four user-facing outcomes, delivered through the three engineering streams used in the AI/opportunity reports: Theatre, World + Studio, and Learning Journey. The Studio is the instructor side of the same mission contract, not an unrelated authoring demonstration.

## What the first flagship actually looks like

The learner opens a verified exercise and lands on a reconstruction, with a compact account of the task and its limits. A chronological decision rail identifies important moments without requiring several page sections. Selecting a moment moves the scene to the exact tick and action-order boundary. This selection already works in part today; its integration into one composition is the replacement, not a novel engine capability.

The default investigative view presents **modeled observations at this moment**. Sensor origin, channel availability and observed contacts follow the same sanitized rules as live training. A deliberate switch reveals the **reference reconstruction**, with a persistent label and a distinct visual treatment. The reference world may explain a hidden contact or an obstruction after the fact. It must never be mistaken for evidence that the learner possessed.

When the user moves away from a selected decision, the workspace either follows the playhead or explicitly pins that decision. If pinned evidence is at time A and the scene is at time B, both times remain visible. A selected event, decision evidence, sensor sample and resulting outcome are related objects, not interchangeable timestamps. Same-tick command/action order remains meaningful.

An explanation proceeds through **available evidence → recorded action → rule-grounded evaluation → observed consequence or scoring projection**. Each factual link resolves to its source. A later hypothetical branch has separate state and provenance. Calling this a causal reconstruction means only that a modeled mechanism is explicitly supported; chronology alone is not causal identification, and simulator behavior does not prove real-world effects.

Existing reflection notes, teaching notes, What-If, reference runs and scores remain available within this composition. They are not its main new capability. A planned next-practice handoff carries a skill/question and source decision reference, then asks for an explicit fresh preparation. Repeating the original case or transferring its answer into an assessment does not demonstrate improvement.

## Primary references and the design inference

Sources below were inspected as documentation, source or research text. No medical simulator, commercial game or mission-control deployment was operated for this synthesis. Public functionality is evidence of a design approach, not comparative proof of VYUHA quality.

| Primary reference | What it establishes | VYUHA design inference and reuse boundary |
|---|---|---|
| [NASA Open MCT API](https://github.com/nasa/openmct/blob/master/API.md) and [user guide](https://nasa.github.io/openmct/static/files/Open_MCT_Users_Guide.pdf) | A central Time API/Time Conductor coordinates time bounds across telemetry displays. | One temporal context should coordinate reconstruction views, with explicit pinned overrides. This is an independently implemented pattern; no Open MCT runtime is required. [Core license](https://github.com/nasa/openmct/blob/master/LICENSE.md) is Apache-2.0; individual dependencies and assets require their own review if adopted. |
| [Epic Replay System](https://dev.epicgames.com/documentation/en-us/unreal-engine/using-the-replay-system-in-unreal-engine) | Replay reconstructs recorded replicated data through a driver/streamer boundary and supports seeking and version-aware compatibility. | Keep historical reconstruction separate from presentation and preserve engine/schema versions. This does not imply adopting Unreal or that VYUHA records replicated world state; VYUHA currently reconstructs events deterministically. Epic documentation and engine licensing do not authorize copying product art or shipping assets. |
| [Eppich and Cheng, PEARLS, 2015](https://pubmed.ncbi.nlm.nih.gov/25710312/) | A conceptual debriefing framework combines learner self-assessment, focused discussion and directive feedback/teaching. | A learner should investigate and explain a specific event before merely receiving a verdict. This framework supplies a design rationale, not evidence that the proposed VYUHA interface improves learning. [Authors' tool page](https://debrief2learn.org/pearls-debriefing-tool/) describes free personal use and reproduction with permission; write original prompts and do not bundle copyrighted cards or scripts. |
| [GIFT architecture overview](https://www.gifttutoring.org/projects/gift/wiki/Overview) and [authoring guide](https://www.gifttutoring.org/projects/gift/wiki/Authoring_Guide_LATEST) | Domain assessment, learner state and pedagogical strategy are distinct interchangeable responsibilities. | Separate evidence production from adaptation and tutoring. More complex models remain replaceable, auditable candidates. No GIFT package is imported; registration/download availability is not a blanket license for its content or dependencies. |
| [W3C XR Accessibility User Requirements](https://www.w3.org/TR/xaur/) | XR user needs include alternative interactions and accommodation of motion/physical constraints. It is a Working Group Note. | Design stationary operation and equivalent desktop/XR intent paths from the start. It is not an accessibility certification checklist. Independently authored UI, documented license obligations for any reused material. |

The companion [UI/3D research](WORLD-CLASS-UI-3D-RESEARCH.md), [simulation transformation](SIMULATION-TRANSFORMATION.md), [AI transformation](AI-TRAINING-TRANSFORMATION.md) and [opportunity analysis](BREAKTHROUGH-OPPORTUNITIES.md) provide the specialist alternatives and source details. This synthesis chooses a product direction across them.

## Target architecture: evidence core, replaceable experiences

Keep a single authoritative simulation contract per engine version. A scenario manifest names its engine, sensor/response models, objective constraints and asset/environment manifest. Existing v1/v2 engines and historical content remain readable. A new engine version is justified by new acquisition semantics or changed simulated behavior, not by a layout redesign.

Above this, build a **derived evidence frame** for each selected session/time/order: source and model version, context identity, permitted observation projection, decision reference, sample/capture/availability times when actually known, and a separate reference-world channel. New fields absent from historical records remain explicitly unavailable. The frame is a rendering/presentation boundary; it is not a second scoring engine or a new source of truth.

The browser, tactical fallback, reconstruction scene and XR instruments consume common semantic state. Their layouts can differ. Commands still go through the existing accepted-action and receipt ownership path. Rendering changes cannot turn selection, hover, camera movement or a tutorial hint into an accepted action. No client-side view determines score or whether an assessed observation was earned.

A course/mission orchestration layer connects objective, preparation, attempt, verified evidence, debrief and next preparation. Domain evidence is not rewritten by learner reflection, recommendation or generated language. A tutor may explain only authorized source material and abstain when it cannot support an assertion. A scenario proposal must compile into a validated frozen manifest before it becomes a runnable or assessed task.

Instructor and Crew workspaces use the same time/identity/provenance semantics with role-appropriate access. Team reports can become explicit modeled information-flow events only in a new contract that preserves sender/recipient, accepted delivery and attribution. Crew outcomes remain separate from individual proficiency.

The rendering architecture should remain replaceable. Improve the current WebGL2 experience first with a coherent art direction, meaningful atmospheric cues, quality tiers and evidence-safe optics. Evaluate WebGPU and alternative engines through a contained capability/compatibility prototype. Current custom shader hooks and manual multipass rendering make a renderer swap a real migration, not a flag toggle. No desktop benchmark closes XR performance or comfort acceptance.

## Scope across the entire product

| System | Strongest intended experience | Required boundary |
|---|---|---|
| Onboarding/Academy | A short guided investigation that becomes less assisted and ends in a different independent task. | Actual delivered help is recorded where the contract supports it; exposure and practice never imply assessed proficiency. |
| Training/3D | Readable, convincing environments whose visibility and ambiguity serve a learning objective. | Decorative lighting/weather never silently changes canonical sensor rules; visual and modeled occluders are reconciled. |
| AI/Fusion | An evidence-grounded partner that communicates uncertainty and can abstain. | Observable-only inputs, held-out evaluation, provenance and deterministic fallback; no action or score authority. |
| Scenario generation | Objective-driven, reproducible tasks with inspectable feasibility and semantic novelty. | A large candidate batch is not diverse or fair merely because seeds differ. |
| Instructor/White Cell | A shared mission-control view of objectives, opportunities, control receipts, cohort status and replay bookmarks. | Commands, notes and team attribution retain their existing authority and lifecycle. |
| Ghost/Time Machine | Investigable reconstruction through time, separating knowledge, action, reference and outcome. | Modeled availability is not proof of viewport exposure, attention or perception. |
| Crew | Team cross-check, communication and shared-state exercises that can be debriefed. | No microphone/text capture or individual competence inference without an explicit design and consent/data contract. |
| Analytics | Opportunity-normalized evidence, assistance exposure, novelty and independent transfer displayed with uncertainty. | Synthetic score changes are not validated learning gain or operational readiness. |
| XR | Embodied observation and coordination with stationary alternatives, readable instruments and input parity. | Physical-headset comfort, reach, latency and frame-tail evidence remains a separate gate. |
| Performance/reliability | Responsive entry and seeking, bounded caches, resilient local operation and deliberate quality adaptation. | Source-pinned matched measurements; fallback/recovery is a complete usable experience. |

## Transformation levels and honest success

**Level 1 — Maintenance:** bug fixes, a CSS correction or a stale response guard. Necessary delivery work, not the innovation claim.

**Level 2 — Feature enhancement:** another diagnostic, reflection panel, option or improved control within the same workflow. The already delivered foundation belongs here unless its broader effect is demonstrated.

**Level 3 — Major upgrade:** replacement of an important subsystem's primary experience, with complete tasks improved and compatibility preserved. The Theatre's first complete observation/reference reconstruction workflow can qualify.

**Level 4 — Product transformation:** a new connected training loop or architecture changes what users can accomplish. Observation acquisition through verified explanation to a new task, authored and supervised coherently, is the intended threshold.

**Level 5 — Research breakthrough candidate:** an uncertain intervention with credible novelty and an explicit experiment. Evidence acquisition optimized for learning or a demonstrated retention-sensitive tutor belongs here until suitable independent human evaluation supports a narrower claim. A roadmap label does not confer the result.

Product success must be visible and measurable: fewer context switches to explain one decision, fewer wrong-time or hindsight-based answers, faster instructor construction of a valid opportunity, responsive scene/seek behavior on named hardware, and reliable completion through keyboard/touch/XR alternatives. Baseline these tasks before assigning numerical improvement claims. Learning success requires separately designed held-out assessment and delayed retention/transfer evaluation, with assistance, attrition and novelty accounted for.

Implementation sequencing, compatibility gates and rollback decisions are in [Transformation Roadmap](TRANSFORMATION-ROADMAP.md). The current Checkpoint A acceptance and texture experiment remain explicitly open until their own evidence closes them; this vision does not certify them or replace the existing receipt history.
