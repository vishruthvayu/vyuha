# Breakthrough opportunities: three connected transformations, with research gates

**24 October 2026 · research and proposed product design.** Read with
[AI and training transformation](AI-TRAINING-TRANSFORMATION.md),
[the ultimate vision](VYUHA-ULTIMATE-VISION.md),
[world-class UI/3D research](WORLD-CLASS-UI-3D-RESEARCH.md),
[simulation transformation](SIMULATION-TRANSFORMATION.md) and
[the transformation roadmap](TRANSFORMATION-ROADMAP.md).
Those companion reports are being assembled in parallel; their links identify
the intended integrated document set, not completed implementation.

The inspected source baseline is branch `feature/vyuha-next-generation`, HEAD
`8f6d6f18d7cabc1d490e31b60e0b5fe05efdeeed`, with the ongoing R01 and assessment
UI work preserved. This research does not change product source, run external
implementations, test the system or claim human learning outcomes.

VYUHA should become a **synthetic decision-learning environment where users
can obtain evidence, explain uncertainty and improve through designed transfer**.
Its distinctive opportunity is the connection between a reproducible world, an
interactive evidence experience, instructor authorship and a longitudinal
learning journey. Stronger rendering, tutoring and analytics should all serve
that connection. None independently proves a superior trainer.

## What qualifies as transformative

| Level | Product consequence | Examples and threshold |
|---|---|---|
| **1 — Maintenance** | Existing task becomes more reliable | Fix a stale response, clipping bug or broken export. Necessary, not strategic transformation. |
| **2 — Feature enhancement** | Existing workflow gains a supporting capability | Add one receipt, filter, hint or reflection control. Its value is real but bounded. |
| **3 — Major upgrade** | An important workflow changes substantially | Replace fragmented review with a synchronized, keyboard-accessible evidence investigation for one case type. A new heading or theme does not qualify. |
| **4 — Product transformation** | New integrated capabilities or architecture change the user's core task | Active evidence missions linked to mission authoring, Academy progression and replay; a course runtime replaces separate loosely connected setup routes. |
| **5 — Research breakthrough candidate** | A consequential capability depends on an unresolved scientific/methodological claim | Generating policy-sensitive tasks that are demonstrably informative and fair for learning assessment; showing a personalized evidence-acquisition curriculum improves delayed transfer. Must name an experiment and a falsifiable failure condition. |

Level 5 is not a claim of first invention, publication novelty or achieved
breakthrough. Most constituent ideas below are established in other fields.
The research challenge is whether their carefully specified combination can
produce a new and validated VYUHA capability. Implementing a finite graph or
running a solver is Level 2/3 engineering, not that result.

## Portfolio decision

Prioritize three flagships with one shared contract backbone. Mission Studio
belongs inside the second flagship as the instructor side of the same task;
it should not become an unrelated authoring demonstration.

| Priority / flagship | Transformation level | Noticeable change | First shippable increment |
|---|---|---|---|
| **1. Evidence Reconstruction Theatre** | L3 first increment → L4 integrated experience | A trainee or instructor can ask why/why-not and follow the exact relevant evidence through scene, time and decision, then attempt a meaningful contrast. | One C02 completed-case journey using existing authoritative reviews, with scoped reference reveal and transparent hypothetical branch semantics. |
| **2. Active Evidence Missions + objective-driven Mission Studio** | L4; a defined ambiguity/solvability method is an L5 candidate | Trainees choose checks and encounter delayed/ambiguous results; instructors author the observable reasoning problem rather than just contact placement. | One mission blueprint with two valid evidence routes, an uninformative check and legitimate abstention; then a versioned active-request engine pilot. |
| **3. Longitudinal Academy and Instructor Learning Loop** | L4; better adaptive teaching policy is an L5 candidate | Academy, practice, AAR, retrieval and transfer form one journey. The instructor can explain why a learner receives the next case and what evidence is still missing. | A deterministic authored course using the first two flagships; only later compare fitted learner models and adaptive scheduling. |

This ordering gives users a meaningful improved experience before the hardest
engine or learning-science claims are resolved. It does not constrain the
eventual visual redesign or new simulation architecture to the current UI.

## 1. Evidence Reconstruction Theatre

**Current insufficiency.** Ghost contains time-labeled observations, reference
truth, decisions, reason codes and consequences. Time Machine already branches
without editing original history. Users nevertheless assemble a reasoning chain
across views, and a score delta can be mistaken for an explanation of the best
available decision. A new chart or generated paragraph would preserve this
fragmentation.

**External proof.** [Whyline's primary paper](https://faculty.washington.edu/ajko/papers/Ko2004Whyline.pdf)
demonstrates a question-driven execution explanation interface, with a small
exploratory programming study. It establishes an interaction precedent, not a
learning effect or a transferable performance multiplier for VYUHA. Its ACM
copyright does not license reuse of the interface artwork/code; independently
design the product.

**Target capability and architectural change.** Replace the ordinary review
experience with a synchronized evidence episode: spatial scene, event strip,
decision and explanation path share one selection and an explicit time scope.
Questions are generated from supported facts: “Why was this classification
unassessable?”, “What observation supported the hold?”, “What changed before
this request?” Unknowns stay unknown. Before the reference reveal, the trainee
can predict which evidence would matter; after reviewing, they practise a
contrast with a changed causal/evidence condition. Instructor and trainee open
the same episode with different authorized reference layers.

The new graph is a presentation of accepted facts and named rules. It records
whether each relation is temporal context, rule/data dependency or a modeled
intervention. It cannot infer the trainee's attention, confidence or mental
reasoning from an available sample. The scene should make provenance tangible:
observed versus reference pose, current versus stale cue, and selected evidence
time versus replay time have consistent visual and textual equivalents.

**Technical contracts.** `EvidenceEpisodeV1` binds source hashes, decision ID,
tick/order, observation provenance and view scope. `ExplanationPathV1` links
source IDs to rule applications without changing the review. Current branch
results disclose the one-action replacement and attempted later recorded
actions. A future adaptive branch uses an explicitly different continuation
policy. Reveal state, author annotations and learner predictions are separate
append-only records, excluded from original scores and legacy evidence.
Current completed records already include truth; the first slice's reference
toggle is presentation-only and its after-exercise inspector can show answers.
It must not be described as a privacy boundary or a blinded assessment mode.

**Measurable benefit and acceptance.** In matched browser tasks, compare time
to find a supporting/missing cue, wrong-time answers, factual explanation
errors, keyboard navigation and orientation recovery. Proposed target:
30% faster median completion without reduced correctness. Verify that every
displayed graph node/edge has a source, authorized truth cannot enter the
pre-reveal projection, and legacy/partial records never receive invented facts.
Measure loading/frame costs at the same device/quality workload. Test an
unassisted new case separately; replay enjoyment is not transfer.

**Stop/revise criterion.** If the new graph introduces unsupported causal
language, increases wrong-time interpretations or slows the review task,
simplify the representation before adding tutoring. Do not repair an invalid
explanation with more impressive animation.

## 2. Active Evidence Missions and the instructor's Mission Studio

**Current insufficiency.** Existing procedural raids have deterministic inputs,
bounded geometry checks and semantic signatures. Current accepted actions
still express designation, classification and engagement, while most evidence
arrives passively. The C01 opportunity receipt validates one proposed passive
window. These are valuable foundations but do not give the instructor a
complete authoring language for inquiry, confusable explanations, alternative
evidence routes and justified unresolved outcomes.

**External proof.** [Budgeted active-perception research](https://arxiv.org/abs/1910.02130v1)
provides a formal precedent for selecting information sources, demonstrated in
robot simulations rather than human training. The
[JuliaPOMDP simulation standard](https://juliapomdp.github.io/POMDPs.jl/stable/simulation/)
shows a concrete separation of world state, observation, belief and policy.
Its [core MIT license](https://raw.githubusercontent.com/JuliaPOMDP/POMDPs.jl/master/LICENSE.md)
does not cover every ecosystem package. No runtime/solver migration is needed
to adopt that separation.

**Target capability and architectural change.** Mission Studio begins with a
learning question: “Can the trainee identify which observation would resolve
this ambiguity—and abstain when none can?” The author specifies competing
explanations, useful/uninformative checks, availability/time/resource budgets,
allowed outcomes and valid routes. The world compiles around that contract.
The trainee chooses a check, sees its pending/delivery state, updates a
provisional explanation and decides or explicitly abstains. The resulting
episode opens in the theatre, and Academy chooses a contrastive follow-up.

This is substantially different from a natural-language wrapper around the
current raid form. An optional language assistant may draft a mission graph,
but a deterministic compiler must validate and freeze the actual task. The
author previews legitimate and failing routes inside the same scene and can
inspect why a task is ambiguous or impossible under its declared contract.

**Technical contracts.** `MissionContractV2` connects claim, evidence,
observation opportunities, semantic family, allowed uncertainty, assistance,
roles, action vocabulary, rubric and content rights. `EvidenceRequest` and
`EvidenceDelivery` join the accepted ordered log under a new engine contract.
Delivery time differs from sample time; client clocks and repeated requests
cannot manufacture evidence. Query IDs target observed references and
capabilities, not hidden canonical coordinates or identities. Instructor changes
are part of the same frozen ordering. New unknown/abstention responses are
explicitly recorded and distinguished from dropout or disconnection.

**Measurable benefit and acceptance.** The instructor should be able to author
one objective with two legitimate evidence orders, a misconception path and
valid abstention; publish time and correction count are compared with current
separate setup tasks. The trainee's metrics are useful inquiry choices,
unsupported confidence, justified abstention, task completion and requests
that produced no usable evidence. Low query count alone is not success.
Focused engineering acceptance covers delayed/stale delivery, role changes,
duplicates, offline recovery, cross-language replay parity and exact reference
isolation. The model card separates illustrative teaching parameters from
physical sensor claims.

**L5 candidate: assessment under observational equivalence.** Construct a
bounded family of paired synthetic worlds with identical trainee-visible
prefixes and different reference states. Some permitted observations split
the pair; others do not, and some pairs remain legitimately unresolved. The
compiler supplies a witness for each declared useful route and a bounded
indistinguishability witness where uncertainty is intended. A hidden-state
oracle belongs to offline author validation, never the live tutor's features.

The scientific question is whether policy-sensitive opportunity contracts can
separate poor inquiry from inadequate available evidence, and predict human
task difficulty/transfer better than seed/geometry strata. The theorem is not
“the engine can distinguish two worlds”; it is the validated measurement
relationship between authored opportunities and observed human performance.
Start with expert review, then cognitive interviews and held-out human cases.
Finite witnesses cannot prove all possible continuous observation policies.

**Stop/revise criterion.** If participants exploit cosmetic cues, the supposedly
equivalent prefixes differ, the authoring oracle needs inaccessible truth at
runtime, or success depends on memorizing the query menu, the task family has
failed. Retire/revise the family before using it as an assessment.

## 3. Longitudinal Academy and instructor learning loop

**Current insufficiency.** Four legacy Beta skills, five individual learning
competencies, full/faded assistance, reflection records and study phases exist
as useful separate constructs. They do not yet form one justified learning
progression. Session-gap retention is not elapsed-time forgetting; practiced
item completion is not independent skill performance. A universal mastery
percentage would hide these differences.

**External proof.** [CTAT's documented example tracing](https://cdn.ctat.cs.cmu.edu/CMUCTAT/CTAT/docs/tutorial-example-tracing.html)
makes alternative routes, misconception paths and help concrete. Predictive
research such as [pyBKT](https://arxiv.org/abs/2105.00385v2) and
[DAS3H](https://arxiv.org/html/1905.06873v1) provides testable model baselines,
not a proven VYUHA curriculum. The detailed source/license and experiment
boundaries are recorded in the AI transformation report.

**Target capability and architectural change.** A learner starts with a short
orientation, studies a worked evidence case, completes guided practice, makes
an independent judgment, reconstructs it and returns for a meaningful variant
and later transfer. Instruction responds to a specific evidence gap. An
instructor can see which opportunities were offered, which help was actually
recorded and which independent outcomes remain unknown. Crew role tasks may
feed a coordination course without copying shared scores into individual
competence records.

The learning system becomes a content/versioned runtime, not a set of
independent screens plus a more elaborate Director formula. The deterministic
authored journey ships first. Models can remain in shadow mode and the tutor
can use authored language; the product transformation does not depend on a
large model download or cloud access.

**Technical contracts.** Store opportunity, response, assistance and time in
`LearningEventV2`; project them into a replaceable, provenance-rich
`LearnerStateV2`. Keep practice, unassisted assessment, hypothetical branches,
Crew and imported/historical evidence explicitly scoped. A recommendation has
a frozen candidate set, source evidence, model/policy hash and reason; a model
upgrade produces a new derived state without editing history. A curriculum
graph does not automatically grant untested prerequisites. Failed evidence
lookups and unrecognized valid paths are not learner failures.

**Measurable benefit and acceptance.** Compare end-to-end completion, setup
errors, cross-route context loss and time to a useful next case. Then compare
next-response calibration on learner/time/family-held-out logs, accounting for
assistance and missing opportunities. Prefer a simple model when more complex
models do not produce a reliable practical improvement. Production scheduling
requires a prospective unaided outcome comparison; prediction alone is not
the desired effect.

**L5 candidate: learning-policy improvement under a fixed teaching budget.**
Can a curriculum that adapts both the evidence opportunity and the instructional
move improve delayed, unassisted transfer over an authored spaced course?
This is a substantially stronger claim than predicting a correct response or
improving assisted exercise scores. Compare the complete interventions with
frozen assessment families, assistance exposure, timing and missingness rules.
The current full-versus-faded protocol cannot answer that question unchanged.
Design precision/sample requirements from a pilot and a meaningful target;
do not mistake an enrollment ceiling for a power analysis.

**Stop/revise criterion.** If assisted success rises while unaided retention or
transfer deteriorates, or the adaptive policy repeatedly withholds useful
opportunities from a group, do not promote it. Retain the authored baseline
and inspect exposure/measurement quality before making the model bigger.

## The evidence that prevents attractive but weak directions

Reported tutoring results vary with the instructional system and endpoint.
[Bastani et al.](https://doi.org/10.1073/pnas.2422633122) makes unaided outcomes
essential; [Tutor CoPilot v3](https://arxiv.org/html/2410.03017v3) gives a
stronger precedent for assisting human instructors than for replacing them.
The new [IZA working paper](https://docs.iza.org/dp18989.pdf) adds a caution
about displacement of existing learning activity. None transfers an effect
size to VYUHA. Source-specific details and license limits appear in AI04–AI06
of the companion AI report.

| Tempting direction | Why it is below the ambition or scientifically premature | Better investment |
|---|---|---|
| A generic free-form chatbot beside the current simulator | More conversation does not create a better training task, validated evidence or retained learning. | Authored pedagogical trajectories with source-linked interventions and independent probes. |
| Deep RL/large knowledge-tracing model before credible learner logs | Synthetic reward optimization may fit the engine; response prediction is not causal teaching benefit. | Transparent authored curriculum, rich opportunity/assistance logs, simple held-out baselines and shadow policies. |
| More contacts, random weather and cosmetic seed changes as difficulty | Can change workload/appearance without changing the reasoning opportunity; can introduce unfairly missing evidence. | Objective/evidence/task co-design, semantic families and policy-sensitive validation. |
| A photoreal scene with no consistent evidence model | Can make unsupported cues look authoritative and increase confidence in a false interpretation. | Semantic world/observation contracts, visible uncertainty and matched visual/performance evaluation. |
| A causal-sounding AAR written from complete truth | Can confuse availability, attention, modeled mechanism and empirical causation. | Typed explanation relations and explicitly scoped reference/hypothetical views. |
| Certification or a universal mastery leaderboard | Requires identity, opportunity equivalence and a validated interpretation not currently established. | Evidence-rich limited claims, explicit unresolved skills and independent retention/transfer. |

## Delivery boundaries and migration discipline

The immediate portfolio is ambitious but incremental in compatibility, not
incremental in its ultimate experience. Begin with one theatre case and one
authored end-to-end mission, so a first-time user can notice the difference.
Authoring validation, versioned evidence and assessment isolation are enabling
contracts inside that experience, not separate showcases.

Historical engine dispatch, accepted scoring, original review payloads and
offline imports remain authoritative. New inquiry semantics require a new
engine/action contract; old engines must reject them explicitly. New learning
models and rubrics are derived/versioned records, not retroactive upgrades to
old performance. Desktop/XR share accepted actions while their presentation
and ergonomics remain medium-specific. Crew attribution remains role-specific.

Focused acceptance should follow changed contracts: source-linked explanation
and browser task checks first; request/delivery parity and role/offline cases
when the engine changes; study/data validation when a new intervention is
registered. Reserve comprehensive release validation for a frozen coherent
candidate. This research ran no tests or heavy compute and does not repeat the
ongoing texture benchmark or already completed Academy/assessment work.

Success is a trainee who can explain an uncertainty, obtain appropriate
synthetic evidence and apply the reasoning later; an instructor who can author
and inspect that learning process; and a technical evaluator who can reproduce
the exact evidence, scope and versions behind those claims. The proposed
architecture makes those outcomes possible to test. It does not declare them
achieved.
