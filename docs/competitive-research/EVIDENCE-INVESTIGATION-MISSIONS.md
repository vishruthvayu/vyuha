# Evidence investigation: next integrated learning slice

26 October 2026. Read-only research against `f1714e0`. This supplements `ACTIVE-OBSERVATION-CONTRACT.md`; it does not repeat the prior sampling scheduler proposal or claim implemented acquisition. No engine, curriculum, scorecard, UI, database, test or historical fixture was edited. No tests were executed for this research.

## Decision

The next substantive learning capability should be an **Evidence Investigation Mission**: an authored learning episode that asks a trainee to distinguish two plausible interpretations, choose what missing evidence could distinguish them, inspect how the report changes over logical time, and explain which conclusion is still unsupported. The complete mission belongs in the main training workflow and ends in the existing Reconstruction Theatre. It is not another notebook panel, confidence gauge or request-count badge.

There are two honest implementation tracks:

1. **Versioned passive-report reasoning mission**, feasible without changing v0.4 observations: the trainee records an explicit information gap and inspects already available time-labelled reports. Server-reconstructed original observations verify what was available at the annotation boundary. This teaches evidence use but must not be described as active acquisition, new sensor behavior or an improvement in physical sensor resolution.
2. **True active-observation mission**, the intended later capability: an opt-in new engine publishes a cross-check only after an accepted request, logical dwell and release. This requires new dispatch/schema/transfer/Crew contracts and parity, not merely a request button using existing automatic observations.

The first can be a useful complete vertical slice if delivered as a new authored mission workflow with durable reasoning evidence. It must not be used to relabel the current manual station or satisfy the second track's acceptance gates. The v0.5 implementation contract is conceptually specified but **not yet safe for production admission**: the integration dependencies below remain actual software work.

## New primary-source evidence, beyond the existing handoff

- [Spektor and Wulff, PNAS 2024, Predecisional information search adaptively reduces three types of uncertainty](https://pmc.ncbi.nlm.nih.gov/articles/PMC11588055/). Their analysis concerns a large set of human decisions-from-experience search behavior and separates structural, estimation and computational uncertainty. VYUHA inference: do not treat one generic uncertainty percentage or sample count as the learning objective. Ask whether a trainee needs a different kind of information, a fresher sample, or help integrating existing evidence. The study does not validate these categories as VYUHA learner diagnostics or establish transfer to simulation training.
- [Markant, Settles and Gureckis, Cognitive Science 2016, Self-directed learning favors local, rather than global, uncertainty](https://www.gureckislab.org/papers/) (author publication entry and primary article abstract; DOI [10.1111/cogs.12220](https://doi.org/10.1111/cogs.12220)). Their category-learning experiment/model comparison found pairwise local uncertainty useful for explaining sample choices. VYUHA inference: begin with two explicit competing propositions and an obtainable discriminating cue, instead of asking an inexperienced trainee to optimize global information gain. This does not establish an optimal query policy for this simulator.
- [Markant et al., Memory & Cognition 2014, Deconstructing the effect of self-directed study on episodic memory](https://doi.org/10.3758/s13421-014-0435-9). Their experiments distinguish control over content from control over presentation timing. VYUHA inference: a future evaluation must match the sequence/timing of evidence between active and replay conditions, rather than attributing an attractive new interaction's effect automatically to inquiry. No VYUHA learning or memory gain follows from this reference.

These studies motivate design and evaluation; no experimental numerical parameter, payoff, normative weapon tactic or calibrated confidence model is copied. The Wiley full-text fetch timed out; the author-hosted publication record and primary abstract were inspected, not a claimed full-text examination.

## A concrete complete mission

**Case: “What does the missing reply mean?”** Use an authored synthetic scene with a reported contact, a visible channel fault or age boundary, and two plausible explanations. The objective is to separate absence, unavailability and insufficient identity evidence. It is not an exercise in identifying real targets or operating hardware.

1. **Academy preparation.** A new immutable mission item identifies the competency, scenario/policy hash, practice versus assessment status, expected inquiry opportunities and assistance level. The trainee sees a concise two-proposition question and prepares a frozen mission. Old Academy items and past evidence remain readable.
2. **Training entry.** The existing simulation station loads the frozen scene and the current observed picture. A short mission objective replaces generic guidance for this authored item; ordinary free training stays ordinary. A keyboard-accessible evidence selector acts on reported contact aliases only.
3. **Articulate the gap.** Before a supported decision, the trainee chooses a proposition they cannot yet distinguish and the channel/time evidence they would need. “I cannot establish identity from these cues” is available alongside testable alternatives. This is a self-report, not proof of belief, gaze or actual notice.
4. **Investigate.** In passive-report track, the instrument exposes authentic reports that already exist, with capture/report/sample clocks explicitly separated. In true-acquisition track, one authoritative optical task slot accepts an EO or IR cross-check, reserves logical dwell, then publishes a frozen result or an explicit unavailable/absent result. Neither path creates canonical identity from shape or no reply.
5. **Commit or retain insufficiency.** The trainee can record which proposition remains unsupported. Existing designation/classification/response semantics remain unchanged in passive track. True-acquisition engine admissibility and its separately versioned score are specified explicitly. Do not force an identity answer simply to complete the inquiry workflow.
6. **Ghost completion.** The server-verified Theatre opens on the trainee's information-gap boundary and released/available evidence. It shows the original question, selected cross-check, available report at that moment and later report. The chapter rail supports “before decision,” “available then” and “later evidence.” Reference truth stays a deliberate after-review lens. The later observation cannot silently replace evidence at the original decision.
7. **Academy return.** The completed mission returns to its course and exposes descriptive attempt coverage: gap recorded, result available before decision, cue limitations considered, judgment supported/unassessable under the authored rubric. It does not turn clicks, query count, confidence self-reports or a shared Crew outcome into individual mastery.
8. **Instructor review.** The same persisted question/result/decision links appear in the existing session review. The officer can attach a teaching note to the exact boundary. No new “AI optimal query” verdict or causal learning claim is invented.

Two contrasting cases are necessary for initial usefulness: one where a newer/other report can resolve the authored distinction before the relevant deadline, and one where additional data remain unavailable or cannot establish the proposed conclusion. Otherwise trainees can learn “always click request” rather than recognize insufficiency.

## New source-level dependency: immutable curriculum versions

`server/learning.py:20–26` reads a single `learning-v1.json` file. `item_for()` at75–99 resolves a context against only the **current** file bytes and rejects another `catalog_hash`. `LearningContext.version` at56–63 accepts only `learning-v1`. This protects against reinterpretation but is not a historical catalog registry.

**Do not add mission rows by editing the old catalog in place.** Retain `learning-v1.json` byte-for-byte, introduce an immutable catalog-by-hash/version registry and route old context resolution to the exact catalog used at preparation. New content and competency identifiers belong to a new catalog/context contract. Unknown catalogs must continue to fail closed. Assessment coverage keys and item compiler dispatch must use the resolved catalog, not current global defaults. Reflection review hashes and imported historical attempts must keep their original interpretation.

The registry is a dependency, not a Level3 transformation by itself. It should be implemented because it makes the complete mission safe, not marketed as the main new feature.

## Concrete source integration map

| Seam | Existing constraint | Required implementation |
| --- | --- | --- |
| `server/learning.py`, `server/config/learning-v1.json` | Single current catalog; old contexts reject drift; compiler always calls v0.4 composer | Immutable catalog registry; retain v1 bytes; new mission compiler/version; old preparation/attempt reads unchanged |
| `client/src/learning.ts`, `academy-journey.ts`, `AcademyLesson.tsx`, `Academy.tsx` | Existing context/items assume learning-v1 and ordinary scenario instructions | Mission-specific preparation and objective handoff; completed inquiry links return to correct course; distinct practice/assessment pools |
| `server/models.py:5–24`, `client/src/types.ts:14–20` | Actions permit only designate/classify/engage; scenario version1/2 | Do not broaden legacy Action silently. Separate pedagogical annotation contract for passive track; new tagged session event union for acquisition engine |
| `client/src/App.tsx`, `action-evidence.ts`, `sim.worker.ts:46–53` | Accepted action receipts share tick/order; Fusion advice is bound to dispatch | Gap/question annotation references the actual dispatch boundary; pending requests/results have distinct IDs and scoped acknowledgments; stale view/contact changes cannot redirect evidence |
| `client/src/sim.ts:6–20`, `server/engine.py:12–44` | Explicit v0.4 admission and otherwise frozen legacy paths | New opt-in engine dispatcher, exact duration/schema/policy validation; old code paths unchanged; no unknown-version fallback |
| New `observation-v3` / scheduler modules in TS/Python | No authoritative request schedule exists | Equal pure logical scheduling; sample at actual cadence-aligned tick; immutable releases; deduplication and cancellation; no wall-time sampling |
| `server/crew.py:178`, `Crew.tsx`, `crew_metrics.py` | Creation explicitly requires v0.4 library raids; role actions are restricted | Explicit new-engine admission only after spotter capability and shared ordered-results tests; unsupported mode fails explicitly, not passive fallback; individual profiles remain isolated |
| `VRCockpit.tsx`, `VRWorld.tsx` | Shared action callbacks and observed-only world | One shared acquisition controller, no emulator-only flow, readable pending/result semantics; repeat/exit/re-entry cannot duplicate requests |
| `server/review.py`, `review-frame.ts`, `ReviewTheatre.tsx`, `Ghost.tsx` | Decision evidence is pinned separately from playhead; explicit observed/reference lenses | Inquiry chapters and versioned reasoning projection, before-order semantics, immutable original report/result/question links |
| `server/fusion.py`, `client/src/fusion.tsx` / Fusion receipt modules | Existing observation protocol and confidence presentation | Only released report inputs; preserve unknown RF/IFF sample time; dispatch advice snapshot cannot consume future results |
| `server/portable.py:238/254/334` and browser storage/draft transfer | Literal v0.4 scenario/sensor markers and four-version list | New explicit archive schema/event types and regenerated result integrity; retain old bundle validation; no trusting uploaded raw result payloads |
| `server/learning_reflection.py` | Append-only notes only after verified individual learning attempts; max20; original review hash | Reuse review ownership principles but do not repurpose post-exercise reflections as proof of pre-decision thinking. A new pre-decision annotation needs its own contract and disclosure |

Names above identify integration seams, not files already implemented. The current `server/crew.py` guard and `server/portable.py` literals make “v0.5 scheduler passes tests” insufficient for an integrated release.

## Minimum new pure acquisition contract to settle before implementation

Keep one optical slot and two channels for first delivery. Validate positive integer dwell/cooldown/expiry values and bounded event counts. Proposed events have explicit engine/policy versions:

- `query_accepted`: engine-owned logical tick/order, stable authoritative ID, actor/session/observed alias/channel and authored unresolved proposition. Transport request ID remains distinct.
- `query_released`: immutable result ID linked to accepted request, actual sample tick, release tick/order, expiry and sanitized reading/reason. Results are generated internally, not accepted from client payloads.
- `query_cancelled`: explicit early end, departed/expired context or other defined outcome; no deletion of an accepted request.

Define first allowed cadence at/after accepted tick+dwell; releases occur before externally accepted events at that tick. A channel fault at the sample tick must have the same ordered meaning in Python and TypeScript. One request identity or many IDs cannot reroll a channel/track/sample slot. Current RF/IFF do not have a complete sample-age contract, so keep them passive initially rather than inventing age.

A passive reasoning mission does not need these query events. Its annotations instead say `learner-statement-v1`, with source session/contact and accepted-decision/report boundary, report hash, authored question/choice and server-derived attribution. They are explicitly descriptive self-reports. They must not edit original accepted actions or retroactively grant score.

## Focused acceptance sequence

1. **Catalog compatibility:** exact v1 bytes/hash preserved; old preparations compile identically; old completed attempts/reflections and imported learning evidence resolve against their original catalog; unknown hash/context/foreign item rejected. New version cannot borrow old assessment forms or coverage keys.
2. **Pure scheduler parity:** a bounded fixture set covers day/night, channel fault, blocked LOS, departure, stale alias, same-tick command, nonzero dwell, pause/resume, cooldown, expiry, no recognition, early end and duplicate IDs. Compare every accepted/rejected request, sample/release order and sanitized result in Python/TS. This is not ordinary scoring parity.
3. **Historical boundary:** unchanged original18 and stored22 scorecards plus existing v0.4 parity because dispatch/event/schema integration is shared. No edits to old helper cadence semantics or fixtures. Add separate v0.5 fixtures.
4. **Actual supported practice:** Academy mission→Training question/cross-check→pending/result or insufficient information→decision→server verification→Ghost pinned evidence→Academy return. Keyboard and phone/tablet checks; no evidence by focus, gaze or click alone.
5. **Integrity/recovery:** authoritative result regeneration; mutation/ownership/future-time rejection; accepted-once queued intent; remaining logical dwell preserved; frozen result survives Transfer/Restore without changing originals; completion immutable.
6. **Crew/XR:** explicit spotter/responder permissions and attribution, revocation/reconnect, pending query across exit/re-entry, no duplicate submissions or stale results. If either is unimplemented, fail closed and mark unsupported; do not claim browser/VR/Crew consistency until verified.
7. **Descriptive learning evidence:** correct distinction between an obtainable discriminating report and an unavailable/non-discriminating report. Repeated requests cannot farm assessed evidence. Self-reported certainty is not calibrated belief or proficiency.
8. **Performance:** match contacts, request count, actual logical horizon and reconstruction endpoint. Compare scheduling/replay cost; do not claim whole-startup or GPU improvements from a pure scheduler microbenchmark.

During development run the narrow relevant selections. Comprehensive suites/build/physical acceptance remain frozen-release gates. A new engine admitting shared contracts warrants the affected historical/parity/security checks immediately, not deferral to a later full suite.

## Evaluation infrastructure that would establish more than feature presence

Pre-register an active versus yoked-replay study with the **same sequence and logical timing of reports**, held-out case families and delayed retention/transfer. Compare wrong-time inference, unsupported certainty, useful versus non-discriminating checks and whether evidence available before the decision was used correctly. Keep subjective confidence separate from objective error and uncertainty type. The existing controlled-study pathway can host a new versioned protocol only after catalog/mission contracts are frozen; neither a new UI nor successful automated tests establishes a human benefit.

## Recommended next executable development batch

Implement immutable catalog resolution and its compatibility tests; then a pure TS/Python acquisition scheduler plus fixtures without exposing a request control. Freeze the v0.5 session-event, archive and curriculum interfaces before beginning the complete mission integration. If the current engineering window is dedicated to graphics, keep the true acquisition engine explicitly NOT IMPLEMENTED and avoid a disconnected request UI. A complete passive-report reasoning mission is an alternate scope that can ship safely sooner, but its narrower capabilities must remain clear.
