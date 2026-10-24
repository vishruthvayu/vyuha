# Simulation transformation: an objective-driven synthetic learning world

Companion research: [World Class Ui 3D Research](WORLD-CLASS-UI-3D-RESEARCH.md); product sequencing is consolidated in [Transformation Roadmap](TRANSFORMATION-ROADMAP.md).

Research date: 24 October 2026. Checkout inspected: `feature/vyuha-next-generation`, HEAD observed `72e0baa53cdc`, with concurrent local work. Scope: synthetic observation, uncertainty, evidence acquisition, world generation, replay and immersive learning. This report proposes no real-world targeting, weapon-control or tactical optimization model. It supplements the UI/3D research and the AI/training workstream; it does not repeat completed Ghost, Academy, assessment or R01 work.

## Target and recommendation

Make VYUHA a **reproducible observation laboratory embedded in an immersive training world**. An author specifies a learning objective; a compiler builds a bounded synthetic episode with known opportunities and ambiguity; the trainee acquires and interprets evidence; the reconstruction theatre explains the record; a fresh variant tests whether the same reasoning skill transfers. Rendering, authoritative simulation and teaching logic have distinct contracts, yet form one experience.

Implement the dependency-ready **Evidence Reconstruction Theatre** first with the current engine. It makes existing observability, decision and outcome histories inspectable without rewriting simulation. Then add a versioned evidence-acquisition episode and an objective-driven scene compiler. These are one flagship trajectory, not separate optional controls.

The complete acquisition→investigation→fresh-variant loop is Level4. A coherent reconstruction workflow is a Level3 first slice. Whether objective-preserving generation plus adaptive explanations yields better delayed transfer is a Level5 research question. More contacts, brighter weather effects, additional trajectory choices or a larger engine do not independently justify these levels.

## What the actual implementation already supplies

Selective source inspection covered `scenario.ts`, `types.ts`, `sensors-v2.ts`, `visibility.ts`, `render-contacts.ts`, `Scene.tsx`, `VRWorld.tsx`, `world/terrain.ts`, `world/Environment.tsx`, `world/materials.ts`, `world/assets.ts`, `world/obstruction.ts`, `Ghost.tsx` and the review/replay region of `App.tsx`.

- Deterministic scenarios already have versioned motion primitives, environment/sensor states, authoritative obstruction boxes and observable positions. Adding the concept of determinism or observed-only rendering would duplicate existing work.
- The optical model distinguishes unavailable/none/detect/recognise/identify and separate EO/IR observations with sample ticks; radar has its own tentative/confirmed/lost state. RF availability and identity-reply semantics already exist. Sensor disagreement is not an absent foundation.
- `ObservationVisibility` has a bounded six-tick hold, clears on discontinuities and uses recorded observed positions rather than moving held geometry along hidden truth. Scene camera framing uses the same evidence gate. Preserve this behavior.
- Browser optical zoom is explicitly a display crop, not a new sensor model. VRWorld deliberately uses native per-eye depth without browser monocular inspection passes. Neither may silently gain evidence in a redesign.
- Replay reconstructs scenario, accepted events, commands, tick and within-tick event boundary; Ghost records evidence immediately before a selected action. The current reference-truth scene and pinned decision evidence are useful but require a stronger temporal/perspective composition.
- Visual terrain is intentionally flat in the important observation region. Decorative scenery and authoritative occlusion have different semantics. A photorealistic hill, tree or wall must not imply a physical rule the model lacks.

The weakness is not simply insufficient physics. The platform needs a coherent **task model connecting environment, observable opportunities, evidence-seeking behavior and debrief**. The current set of reliable components makes that transformation feasible.

## Primary evidence and valid conclusions

| Source / inspection method | Applicable evidence | What it cannot establish |
|---|---|---|
| [FAA AC120-35D official active advisory](https://www.faa.gov/regulations_policies/advisory_circulars/index.cfm/go/document.information/documentID/1027170), guidelines inspected | Line operational simulation is deliberately designed, scripted, tested and evaluated around crew training; scenario and facilitator responsibilities matter. Use objective/event matrices and rehearsal, not random incidents alone. | This does not certify VYUHA, authorize aviation claims or validate military training transfer. The advisory is a design reference from another domain. |
| [X-Plane12 manual](https://www.x-plane.com/manuals/desktop/), actual documented product workflow | Instructor stations can alter conditions and system status; state-based replay allows post-flight view changes. | No runtime X-Plane test was performed. Product functionality is not proof that our intervention model or learner assessment is valid. |
| [Grierson2014](https://pubmed.ncbi.nlm.nih.gov/24691891/), original conceptual analysis abstract | Fidelity should be judged by features relevant to the skill and information processing, rather than appearance alone. | It does not supply a universal fidelity score or VYUHA validation instrument. |
| [Norman/Dore/Grierson2012](https://pubmed.ncbi.nlm.nih.gov/22616789/), review abstract | Across the clinical studies reviewed, higher physical fidelity did not consistently beat lower fidelity in transfer outcomes. | Different domain and study designs: this is a reason to test the task, not a reason to avoid stronger visuals. |
| [Makransky et al. immersive lab experiment](https://doi.org/10.1016/j.learninstruc.2017.12.007), primary study report | Its immersive condition increased presence but reduced learning and increased load. Strong scene design needs instructional structure and attention management. | The study does not predict the outcome of VYUHA's stationary observation or review tasks. |
| [NASA-TLX](https://www.nasa.gov/human-systems-integration-division/nasa-task-load-index-tlx/), official instrument information | Subjective workload is a useful separate measurement when changing task density or interface composition. | Workload is not competence, realism, retention or a calibrated safety measure. |
| [NASA Eyes](https://www.nasa.gov/interactives/), product description plus actual browser interaction recorded in UI/3D report | Selection, spatial context and manipulated time can support a compelling reconstruction interface. | Scientific data, performance and learning outcomes do not transfer. Preserve our evidence boundary across selections, unlike the observed time-reset navigation. |
| [Epic PCG overview](https://dev.epicgames.com/documentation/en-us/unreal-engine/procedural-content-generation-overview), primary authoring documentation | Procedural content can be constructed through inspectable data/graph operations rather than only ad-hoc scene code. | An environment graph does not ensure an educationally sound scenario. Borrow the compilation pattern; do not imply reuse rights to engine assets. |
| [OGC3D Tiles](https://www.ogc.org/standards/3DTiles/) and [specification](https://docs.ogc.org/cs/22-025r4/22-025r4.html), open standard | Hierarchies and bounded spatial representations help load detail when needed. | Streaming more terrain does not make observation or movement physics valid. Use local synthetic content, not a compulsory online world service. |
| [W3C XAUR](https://www.w3.org/TR/xaur/), Working Group Note | Motion-agnostic and multimodal alternatives, customization and synchronized input/output are relevant to immersive task access. | It is not a certification standard or substitute for named-headset evaluation. |

These references support design choices and experiments. They do not prove that VYUHA's present or proposed training improves real operational performance. Proprietary simulator/engine interfaces are concept references; no artwork/code was imported. Open-source renderer/tool licenses and asset-specific provenance are recorded separately in the UI/3D report and existing `ASSET-PROVENANCE.md`.

## Current gap → strongest achievable target

| System | Insufficient current composition | Strongest target | Measurable difference |
|---|---|---|---|
| Synthetic world | Deterministic facility, local asset kit and authoritative boxes coexist, but rich visual changes can outrun observation semantics | Versioned world specification compiles visual scene, authoritative volumes, reference explanations, asset manifest and quality representations together | Fewer visual/model contradictions; reproducible environment identity; materially better scene quality at bounded resource cost |
| Observation task | Sensor states exist, but observing mostly feeds the existing action loop | Explicit objective-driven evidence episodes: acquire, compare, defer a claim and explain uncertainty | More meaningful decisions about evidence quality, with recorded acquisition cost and reasoning evidence |
| Movement and clutter | Closed-form primitives give reproducible encounters; cosmetic variety is not the same as educational variety | Bounded phase/event graphs whose motion and context variations are chosen to expose a declared perceptual/temporal objective | Unseen variants preserve skill demand while changing superficial cues; no score dependence on rendering frame rate |
| Conditions/degradation | Fog/night/status changes can become a list of difficulty knobs | Coherent synthetic condition profiles linking observation availability, sample age and visual presentation | Trainees recognize evidence limits; visual cues never contradict the authoritative observation state |
| Instructor | Commands and interventions exist as controls | Rehearsal workspace shows objective timeline, expected observability windows, intervention receipts and trainee-visible preview | Instructors can validate learnability and pacing before starting, with fewer unsupported scenarios |
| AAR | Reference replay, decision evidence and timelines require mental reconciliation | Reconstruction theatre explicitly pairs the decision boundary, recorded evidence, subsequent outcome and authorized spatial explanation | Faster, more accurate explanation of what was knowable; reduced hindsight errors |
| Crew | Shared action attribution exists, but richer coordination can become chat decoration | Structured observation/report/handoff episodes with acknowledgement and evidence timestamps; role evidence stays separate | Measure shared-understanding errors and stale reports, not only message count or response speed |
| Academy/retention | Course and adaptation components already exist | Same simulator hosts briefing, coached episode, reconstruction and fresh transfer probe | Test performance on new variants and delayed assessment, with repeated-seed exposure disclosed |

## Bounded educational mechanics: start with interpretable demands

All values below are **synthetic pedagogical parameters**, not claims about real sensors or equipment. Do not tune them from classified, restricted or operational data. New mechanics that affect available evidence or accepted actions require an engine/schema version, mirrored replay behavior and proportionate compatibility tests.

| Mechanic | Learning objective and bounded implementation | Record and debrief | Validity / acceptance |
|---|---|---|---|
| **Evidence age challenge** | Two benign abstract contacts have similar appearances; one channel supplies a delayed or held observation. Learner must distinguish a current observation from a stale cue. Use a small finite set of sample delays and availability windows. | Capture logical sample tick, delivery tick and display-held state; theatre contrasts them at a decision boundary. | No hidden-truth pose appears during a gap; classifying evidence age is scored separately from classifying the contact. Rendering interpolation never changes the historical observation. |
| **Ambiguity before commitment** | Similar synthetic silhouettes initially support only a coarse category. Learner may explicitly defer a finer claim until a permitted additional observation. Limit to known visual categories and a finite observation budget. | Log each acquisition request, availability response, evidence gained and claim confidence as training metadata. | Do not punish a justified unknown state as if hidden identity were observable. Avoid confident numeric probabilities unless their calibration is empirically established. |
| **Cross-channel disagreement** | One channel has a documented synthetic degradation while another remains useful. Learner explains which evidence is current/relevant rather than automatically trusting the most colorful display. | Preserve channel health, sample age and observations independently; explanation cites those facts, not future identity. | Missing means unavailable, not a negative observation. Identical available histories must yield identical feedback regardless of hidden scenario labels. |
| **Occlusion and reacquisition** | A synthetic obstruction removes an observation temporarily; learner recognizes loss and reacquires without treating a historical marker as current shape. Use existing authoritative boxes first. | Link loss/reacquisition events to channel state and the reference-world explanation after review authorization. | Test boundaries, missing contacts and seeks. Decorative walls/foliage must not create an unmodeled physical conclusion. No route optimization or real evasion tactics are needed. |
| **Attention and interruption** | A harmless secondary task or instructor prompt interrupts evidence comparison. Teach resumption and review of stale information. Bound frequency/duration and expose an accessible pause mode in coached practice. | Log prompt phase and accepted completion, never inferred attention or eye tracking by default. | Compare accuracy/resumption errors and workload, not speed alone. Separate instructional assistance from assessment conditions. |
| **Crew evidence handoff** | One role observes, another interprets a timestamped report, then asks for clarification if stale/ambiguous. Use structured report fields and acknowledgement, with optional plain-language context. | Attribute source, receiver, evidence tick and acknowledgement through existing accepted command/event paths. | Same shared world but different authorized evidence views; no full-truth leakage through labels. Measure misunderstanding and recovery in reproducible scripts. |
| **Condition transfer** | Repeat the same reasoning demand in a different authored world/light/condition profile. Change appearance while keeping observability and opportunity contracts comparable. | Store engine, objective, condition, layout seed and asset hash separately. | A changed sky must not quietly alter difficulty. Fresh variants must be checked for clue availability before comparison. |
| **Review counterfactual** | After recorded evidence is reconstructed, let the learner inspect a clearly labelled hypothetical change in a new isolated practice instance. | Parent record remains immutable; branch links to source decision and carries its own scenario/engine identity. | A branch is not the historical outcome and not proof of what would have happened in reality. Do not overwrite scores or imply causal certainty from an unvalidated model. |

Do not add every row at once. The first current-engine theatre can teach evidence age, ambiguity and occlusion using existing records. The first new authoritative mechanic should be a small benign evidence-acquisition episode, because it connects observation to decision and produces data for meaningful debrief.

## Target architecture: scenario compilation instead of feature accumulation

Use a renderer-independent **ExerciseSpec** with four separable identities:

1. **ObjectiveSpec:** the skill, permitted information, required opportunity, assistance policy, success/error evidence and transfer variation. This is an instructional contract, not a learner diagnosis.
2. **WorldSpec:** synthetic layout, authoritative volumes, terrain assumptions, material/asset kit, lighting and decorative seed. Visual-only changes must be identifiable separately from engine-affecting changes.
3. **EpisodeSpec:** a bounded graph of logical phases/events, contact primitives, sensor-status transitions, permitted acquisition actions and instructor interventions. Evaluate on logical ticks, not frame callbacks.
4. **EvaluationSpec:** versioned rubric, evidence extraction, role attribution, assessment restrictions and replay compatibility. Historical records retain the exact rules under which they were generated.

A compiler produces a canonical scenario, an asset manifest and an **observability audit**. The audit runs the bounded synthetic episode before use, documenting when intended cues can exist, which channels are unavailable and whether required decisions have adequate opportunity. It must not display that answer key to assessed trainees. A scenario intentionally testing insufficient evidence needs an explicit unknown/defer outcome rather than pretending the missing cue exists.

The compiler is an architectural target, not an unbounded generative model. Begin with hand-authored templates plus constraints and a deterministic bounded rejection sampler. Store accepted seed/template/version/fingerprint. If the compiler cannot meet the objective within its attempt limit, fail with a useful author explanation; do not silently weaken the lesson. A later AI authoring assistant can propose a specification, but the same compiler and tests must validate it.

World preparation runs independently from authoritative simulation. Use prebuilt static geometry, bounded asynchronous procedural work and local tile/asset eviction. A new renderer consumes the same scene specification. Neither a GPU compute pass nor a variable frame rate may determine the canonical observation or accepted action order. Procedural scenery streaming is not permission to stream assessment truth or change geometry halfway through an active observation without a recorded rule.

### Information contracts

- **Observation frame:** session/engine identity, logical tick, channel health, sample tick, permitted observed pose/shape and explicit availability. A live presentation adapter receives the narrow observation shape, rather than discovering evidence by reading arbitrary truth fields.
- **Review frame:** immutable record identity, cursor tick/event order, selected decision, pinned evidence tick and authorized perspective. A reference scene is a different adapter and a deliberate reveal, not an unlabelled mode of the live scene.
- **Acquisition receipt:** request ID, actor/role, requested evidence action, accepted logical boundary, result/availability and policy version. Reuse established command/receipt semantics; do not add a second optimistic authority in the renderer.
- **Presentation frame:** interpolated observed pose and camera/instrument state. It may smooth permitted information, but never create a future observation, infer hidden type or alter evaluation.

Client-side component separation reduces accidental leakage but is not an access-control boundary. Server permission checks must govern access to records/reference truth. A boolean React prop is not authorization.

## Migration with credible compatibility

### Slice1: current-engine reconstruction theatre, ready now

Create a pure reconstruction state model and a scene-led review composition around existing replay and Ghost evidence. Use explicit observed/reference perspectives, one selected decision boundary, visible evidence-vs-cursor time, an event rail and the existing next-practice preparation path. Start with one active canvas and a deterministic camera transition that can be disabled. No new engine, scoring or sensor algorithm is required.

Proposed files: `client/src/reconstruction.ts`, `client/src/ReconstructionTheatre.tsx`, review integration in `App.tsx`, adapters reusing `Scene.tsx`, `Ghost.tsx`, `visibility.ts` and replay code. The UI/3D report defines the user task and visual target. Add focused tests for temporal selection, same-tick action order, absent evidence, unsupported records and no live dispatch. Real browser review must exercise actual record selection and perspective transitions.

### Slice2: authored world specification and one observation episode

Extract a typed world/condition specification from current `layout.ts`, `Environment.tsx`, `materials.ts` and asset manifest. Produce one original materially improved environment while preserving current authoritative semantics. Prototype a benign finite evidence-acquisition episode in a new explicit engine version, with old records dispatched to the old engine. A visual-only world revision need not change authoritative scoring, but any new obstruction/terrain/observation rule does.

Add Python/TypeScript parity fixtures only for changed shared mechanics, and old-version replay fixtures for the dispatch seam. Test browser and XR accepted action/payload consistency. Store acquisition histories explicitly rather than retroactively inferring them from camera motion. Do not import cosmetic weather into an old record and then claim it was what the trainee saw.

### Slice3: compiler, instructor rehearsal and transfer probes

Implement bounded objective/template compilation, observability audit and instructor preview. An instructor sees the same world with a clearly separate answer-key layer. Trial in a few supported objective families; compare authored and generated variants for clue opportunity, ambiguity and error types. The Academy continuation consumes validated fresh variants. Crew rehearsal uses the same event graph and role-aware receipt history.

### Slice4: research candidates and optional rendering backend

Investigate a WebGPU/TSL renderer with the same fixtures and recorded scene/evidence frames; current r180 WebGPU XR source requires a WebGL2 backend, so headset support must be separately qualified. A richer renderer should advance a measured perceptual or explanatory task, not be adopted only because the API is newer. Research adaptive explanations and objective-preserving novelty with controlled transfer studies. No novel graphics result alone earns a learning claim.

## Acceptance: visible, technical and educational outcomes

| Gate | Required evidence |
|---|---|
| **First-use transformation** | A new user performs select decision→reconstruct evidence→inspect outcome/reference→state lesson→prepare fresh practice in one coherent workspace. Compare task completion, wrong-time/wrong-perspective answers and unnecessary navigation with current AAR. Provisional improvement target:25% lower median completion time with no error increase; baseline first. |
| **Evidence integrity** | Identical observed histories produce identical observed presentation/feedback regardless of hidden truth; no future/sample-age leakage; same-tick event boundaries are respected; held shapes do not track truth; explicit missing/unknown semantics. |
| **World consistency** | Visual/authoritative volume audit, terrain assumption fixtures, cold/warm/offline asset identity and tiny-contact visibility comparison. Decorative detail must not create a false physical inference. |
| **Reproducibility** | Seed/template/engine/objective/world hashes reconstruct the same canonical events and accepted actions. Preserve old-version fixtures and original records. Cosmetic animation and GPU timing cannot enter canonical state. |
| **Generation quality** | Every accepted scenario has its required opportunity audit or an explicitly insufficient-evidence objective. Bound attempts, disclose rejection/fallback, and test fresh-variant diversity beyond superficial seed changes. |
| **Interaction and performance** | Fixed hardware/browser/viewport/quality/workload, cold/repeat startup, seek and input p95, long-frame tails, logical lag and memory/resource counts after repeated entry/exit. Record failed comparisons and background/context-loss cases. No benchmark runs in this research slice. |
| **Immersive access** | Complete tasks with seated/stationary operation, pointer/keyboard alternatives and reduced motion; emulator payload parity plus named physical-headset readability, target acquisition, comfort and frame-tail tests. |
| **Learning research** | Compare theatre plus fresh practice against current debrief using unseen episodes and delayed retention. Predefine primary reasoning/error outcomes and report confidence intervals, prior exposure and instructor effects. Presence, preference, workload, synthetic score, transfer and real-world competence remain distinct. |

## Level5 experiments worth pursuing, with explicit failure criteria

**Objective-preserving novelty.** Can the compiler vary world/condition/sequence enough to defeat rote memorization while preserving the intended evidence demand? Compare accepted episodes on opportunity coverage and human item difficulty before evaluating transfer. Reject if visually novel variants systematically change clue availability or create unsolvable assessments. This is a stronger claim than ordinary seeded generation and needs data.

**Evidence-grounded explanation choreography.** Can a theatre sequence reveal the minimum evidence required for a learner to correct an explanation, then verify the insight on a fresh variant? Randomize to current debrief versus guided reconstruction; use blinded scoring of reasoning and an unseen follow-up, not completion rate alone. Reject if the sequence merely reveals the answer or induces hindsight certainty.

**Immersive spatial explanation.** Does an XR tabletop help trainees understand temporal occlusion or stale evidence better than a well-designed desktop theatre? Hold evidence, text and teaching sequence constant; separate first-time controller learning from the target skill. Reject if increased presence comes with more workload, sickness, errors or no transfer advantage. Retain desktop equivalence regardless.

These experiments can change what VYUHA teaches and how well it teaches. Until measured, they are hypotheses. The immediate build remains the first complete reconstruction task, followed by a deliberately versioned observation episode and world compiler—not a catalogue of unconnected toggles.
