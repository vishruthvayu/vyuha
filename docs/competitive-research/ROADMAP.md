# Ultimate improvement roadmap

**Status: all R01–R40 entries are proposed; none was implemented in this research.** Current capability references are to merged main `2d90137e8116075cd1e48eadab64cb306ea12278`; exact file hashes/last-change commits are in [baseline-source.json](evidence/baseline-source.json). Existing capabilities are summarized in [BASELINE](BASELINE.md). Competitor source is pinned in the [inventory](COMPETITOR-INVENTORY.md); Sxx links lead to primary sources and their limitations.

## Priority and dependency map

Impact and innovation are **editorial 1–5 ordinal judgments**, not measured learning gains. Effort S/M/L/XL is relative engineering scope, not a calendar estimate. A high innovation score does not override credibility, reliability or required data. “Evidence needed” means the proposal's success is unresolved, not that the current simulator fails an unrelated acceptance test.

| ID | Recommended upgrade | Impact | Innovation | Effort | Depends on | Track |
|---|---|---:|---:|---|---|---|
| R01 | Startup, frame and interaction attribution/budgets | 5 | 2 | M | Existing measured runtime | Foundation |
| R02 | Canonical capability, claim and evidence registry | 5 | 3 | M | Current manifests | Foundation |
| R03 | Competency/task/evidence contracts | 5 | 4 | L | Existing scoring/AAR | Foundation |
| R04 | Controlled learning, retention and transfer pilot | 5 | 4 | L + participants | R03; R06 for execution | Foundation/research |
| R05 | Academy with fading scaffolds | 5 | 3 | L | R03 | Learning |
| R06 | Balanced assessment bank and semantic novelty | 5 | 4 | L | R03 | Learning |
| R07 | Curriculum-aware, testable Director | 5 | 4 | L | R03/R06; pilot data for fitting | Learning |
| R08 | Calibrated, abstaining observable-only assistance | 4 | 4 | L | R03/R06 + benchmark corpus | AI |
| R09 | Active evidence collection and uncertainty literacy | 5 | 5 | L | R03 + versioned sensor/action contract | Learning/simulation |
| R10 | Causal AAR with evidence graph and reflection | 5 | 4 | L | R03; current immutable AAR | AAR |
| R11 | Synchronized evidence workspace | 4 | 3 | M | Existing replay; clock contract | UX |
| R12 | Progressive active-session control hierarchy | 4 | 2 | M | R01; task usability study | UX |
| R13 | Accessible/localized input and presentation system | 5 | 3 | L | Existing accessibility; terminology review | UX |
| R14 | Spatial/timeline scenario authoring with preview | 4 | 4 | L | Existing studios; R03 | Instructor |
| R15 | Evidence-rich longitudinal performance reports | 4 | 3 | M | R03/R06/R10 | Analytics |
| R16 | Crew communication and readback evidence | 4 | 4 | L | Current Crew; event schema | Crew |
| R17 | Instructor intervention plans and review | 4 | 3 | M | R10/R14/R16 | Instructor |
| R18 | Role-rotation and coordination curriculum | 4 | 4 | L | R03/R16 | Crew |
| R19 | Versioned semantic scene packs | 4 | 3 | L | Current world/occlusion contract | Simulation |
| R20 | Explicit weather/lighting/visibility model | 4 | 3 | L | R19; new engine version | Simulation |
| R21 | Scalable scene fidelity and transition preparation | 4 | 3 | L | R01/R19 | Rendering |
| R22 | Synthetic signal/acoustic learning laboratory | 4 | 4 | XL | R03/R08 + new observation schema | Sensor research |
| R23 | Lawful recording adapters and data provenance | 4 | 4 | L | Current Recorded Practice; rights | Data |
| R24 | Track ambiguity, association and sensor trust drills | 4 | 4 | XL | R09/R22 + versioned engine | Simulation |
| R25 | Bounded reactive behavior diversity | 3 | 4 | L | R06/R19 + new engine version | Simulation |
| R26 | Abstract escalation, restraint and resource tradeoffs | 4 | 3 | M/L | Current response v2; R03 | Training |
| R27 | Proficiency passport with optional roster identity | 4 | 3 | L | R03/R06/R15; identity policy | Assessment |
| R28 | Prepared offline deployment kits per platform | 5 | 2 | L + devices | Current startup/packaging | Reliability |
| R29 | Unit readiness/trust and recovery assistant | 4 | 3 | M | R28; current HTTPS/recovery | Reliability |
| R30 | Optional signed provenance and trust lifecycle | 3 | 4 | L | Threat model; R02/R27 | Security |
| R31 | Physical XR acceptance and ergonomic contracts | 5 | 2 | M + headsets | Current XR; R13/R29 | Immersive |
| R32 | Input-equivalent XR coaching/interaction modes | 3 | 4 | L | R05/R31 | Immersive |
| R33 | Offline learning/log interoperability | 3 | 3 | M | R02/R03/R23 | Integration |
| R34 | Reproducible performance/reliability qualification | 5 | 2 | L + devices | R01/R28 | Engineering |
| R35 | Simulation validity and model-card program | 5 | 4 | L + expertise/data | Existing parity/configuration | Validation |
| R36 | Optional offline high-fidelity authoring adapters | 3 | 4 | XL | R19/R23/R35 + suitable hardware | Research |
| R37 | Constrained language-to-scenario drafting | 3 | 3 | M/L | R14/R35 | AI authoring |
| R38 | Local grounded tutor and reflection dialogue | 4 | 4 | L/XL | R03/R10/R13 + local model budget | AI tutoring |
| R39 | Consent-aware workload and attention research | 3 | 4 | M + participants | R04/R13/R31 | Human factors |
| R40 | Reproducible research/content governance | 4 | 3 | M | R02/R03/R35 | Governance |

The order describes a dependency-aware direction, not a commitment to build all forty before another usable release. Research tracks can be ambitious without becoming mandatory runtime dependencies. Pilot data and physical devices are external requirements; engineering can prepare protocols/harnesses but cannot invent results.

## Foundation and learning

<a id="r01"></a>
### R01 — Measure and reduce startup/interaction stalls

**Current →** M1 warm rendering is usable, but existing retained-200 startup evidence has a 1099.9 ms maximum frame gap. Worker tick cost alone does not identify its cause. **External →** [Chrome frame attribution](SOURCES.md#s22), [Three preparation API](SOURCES.md#s21). **Gap →** no causal breakdown and no enforceable startup/transition interaction budget. **Proposal →** local opt-in traces for loading, shader preparation, decoding, React/layout, worker lag and input-to-paint; optimize the measured dominant cost only. **Benefit →** responsive first use and reproducible performance decisions rather than median-FPS claims.

**Implementation →** extend `Benchmark.tsx` if appropriate (locate the existing benchmark route/module first), `Scene.tsx`, `world/Environment.tsx`, `ContactRenderer.tsx` and worker diagnostics; introduce a bounded local diagnostics module rather than polluting scoring events. Consider `compileAsync`, amortized uploads or less allocation only after evidence. Keep sensor fidelity, 30 Hz ticks and accepted actions unchanged.

**Success →** matched cold/warm 8/50/200 retained-contact and optics-switch trials, fixed CSS size/tier; report p50/p95/p99/max, >50/>100 ms counts, input latency and logical lag. Proposed warm desktop target: p95 ≤20 ms at fixed Medium on this M1; proposed interaction target ≤200 ms. These are targets to negotiate and test, not current guarantees. Investigate every >250 ms startup gap and report failures rather than masking them with a loading animation.

<a id="r02"></a>
### R02 — One capability and evidence registry

**Current →** detailed manifests/audits coexist with stale README branch/release fields. **External →** source-backed status distinctions in SUDARSHAN's build log; professional evidence workflows in [HEAT](SOURCES.md#s03). **Gap →** scope drift makes capability and validation easy to confuse. **Proposal →** one versioned registry linking capability, engine version, runtime SHA, evidence artifact, hardware scope, status, known limits and claim wording. **Benefit →** credible owner/reviewer communication and less repeated reconciliation.

**Implementation →** a proposed schema and generator under `scripts/` can consume the existing feature manifest and source-input manifests, generate `/system/evidence`, compliance rows and documentation excerpts, and validate links/hashes. Keep historical registry snapshots readable; never rewrite old evidence to current source.

**Success →** a deliberately stale SHA, missing receipt, physical-test claim without device/source receipt, broken proof link and “planned” capability displayed as complete each fail validation. Existing protected releases retain their exact registry snapshots.

<a id="r03"></a>
### R03 — Competency, task and evidence contracts

**Current →** score components and four Beta skills exist; they do not form a complete instructional model. **External →** [evidence-centered design](SOURCES.md#s10), [GIFT](SOURCES.md#s09), PARASHURAMA's skill-linked lessons. **Gap →** a correct answer may reflect guessing, leaked cues or memorization rather than the claimed skill. **Proposal →** versioned competencies such as observation acquisition, uncertainty interpretation, restraint, response reasoning and coordination, each mapped to tasks and evidence requirements. **Benefit →** trustworthy progression and measurable instructional intent.

**Implementation →** add a proposed competency schema/data pack beside existing server configuration; derive observations in a new analytics layer over immutable accepted actions/reviews. Reference IDs in Director, RapidID, studios and evaluation. Do not recalculate historical total scores or label old sessions as new assessments without sufficient evidence.

**Success →** every competency has at least two nonidentical tasks, explicit ambiguity/abstention rules and a coverage test. Same action cannot count twice through replay/import. Crew and practice observations remain separate from individual assessed evidence.

<a id="r04"></a>
### R04 — Controlled learning, retention and transfer evaluation

**Current →** consented pre→practice→post evaluation produces descriptive deltas; Director experiments did not establish improved learning. **External →** [GIFT experiment architecture](SOURCES.md#s09), Vyom's research instrumentation, [assessment design](SOURCES.md#s10). **Gap →** practice effects, task imbalance and immediate familiarity can imitate learning. **Proposal →** prespecified comparison of baseline practice and curriculum/adaptive conditions, balanced allocation, a delayed retention test and an unseen transfer set. **Benefit →** evidence for training value and identification of ineffective features.

**Implementation →** extend `server/evaluation.py` and the existing evaluation route with consent/versioned protocol, seed allocation, dropout tracking, frozen analysis plan and pseudonymous export. Define a primary outcome and plausible effect before a sample-size calculation; obtain appropriate participant/organizational consent. No participant recruitment/messages are authorized by this report.

**Success →** synthetic protocol tests prevent cross-arm leakage and repeated-test contamination; human results report sample size, exclusions, baseline differences, uncertainty and missing data. No efficacy claim until actual results support it. “Pilot inconclusive” is a valid outcome.

<a id="r05"></a>
### R05 — An Academy that fades assistance

**Current →** CapabilityTour, GuidedDecision and RapidID provide guidance, not a cohesive course. **External →** PARASHURAMA's implemented four-lesson Academy and [GIFT](SOURCES.md#s09). **Gap →** new users can learn which button to press without learning why evidence supports a decision. **Proposal →** short observe→explain→try→reflect lessons, followed by less guided and finally unseen assessed tasks. **Benefit →** a concise interactive onboarding path and reduced rote operation.

**Implementation →** reuse `GuidedDecision.tsx`, `CapabilityTour.tsx`, `RapidID.tsx`, existing preparation and Ghost routes; add a proposed course manifest keyed to R03. Hints can explain canonical truth only in explicitly labeled study mode. In scored mode they may use only visible evidence and must be recorded as assistance exposure.

**Success →** a novice can complete the first lesson without a long manual; keyboard/touch/screen-reader alternatives work. Practice completion never credits assessed mastery. Fading assistance and mode transitions are tested; no default classification or hint leaks into the next task.

<a id="r06"></a>
### R06 — Assessment bank, fairness and semantic novelty

**Current →** templates, raid constraints and seed variation exist; random seeds alone do not establish balanced or novel tasks. **External →** Godot trainer and DronAcharya semantic novelty/solvability; PARASHURAMA practice/assessment distinction; [assessment design](SOURCES.md#s10). **Gap →** train/test overlap and difficulty differences can distort progress. **Proposal →** a blueprint-based item bank with held-out families, equivalence strata and semantic fingerprints. **Benefit →** fair comparisons and real generalization rather than memorized trajectories.

**Implementation →** extend scenario metadata in `raid_v2.py`, preparation/Director snapshots and evaluation; derive fingerprints from learning objectives, evidence conditions and decision opportunities, not merely JSON hash. Freeze assessment forms and document item retirement.

**Success →** training variants cannot enter held-out assessment; seed changes producing essentially the same task are detected. Feasibility checks identify impossible evidence windows. Difficulty/coverage differences are reported before comparing scores; actual statistical item validation awaits participants.

<a id="r07"></a>
### R07 — Curriculum-aware Director with empirical alternatives

**Current →** deterministic policy uses skill/progress/uncertainty and frozen coefficients; no fitted forgetting model. **External →** PARASHURAMA/unrelated Vyuha BKT; [pyBKT](SOURCES.md#s11). **Gap →** a heuristic weakness estimate can repeatedly select narrow tasks or overstate mastery. **Proposal →** coverage-constrained selection with transparent reasons; compare existing Beta policy with fitted sequence models only when data permits. **Benefit →** more purposeful practice without opaque AI claims.

**Implementation →** a new opt-in Director policy version in `director_v2.py` or a versioned successor; derive features from R03/R06, store policy/model/config hash and selection snapshot, bound difficulty jumps. Keep old Director metadata/export/import untouched. Separate elapsed-time retention from session-count recency.

**Success →** seeded selection reproducibility, no hidden-truth features, cold-start fairness, coverage and policy rollback tests. Learner-held-out predictive calibration must improve over the current baseline before adoption; improved prediction still requires R04 for a learning claim.

<a id="r08"></a>
### R08 — Observable-only calibrated and abstaining assistance

**Current →** Fusion's heuristic hypotheses, Brier/reliance review and dispatch-bound receipts exist. **External →** AVLON and AEROGUARD scenario-grouped training/calibration/test pipelines, Vyom/AERIS local classifiers; [calibration paper](SOURCES.md#s12). **Gap →** heuristic confidence is not calibrated probability and a learned model may memorize synthetic labels. **Proposal →** an offline benchmark comparing heuristic, simple learned and abstaining alternatives on identical sanitized observations. **Benefit →** better uncertainty communication and auditable assistance selection.

**Implementation →** a new optional model adapter beside `server/fusion.py`, with bounded feature schema, dataset/model hashes and an explicit fallback label. Preserve `action-evidence.ts` dispatch ownership and reconstructed exposures; never use scenario kind/identity as an input. Models may generate suggestions, never authoritative score or actions.

**Success →** split by scenario family/seed and learner where relevant; report macro-F1, per-class error, Brier/reliability and selective coverage-risk, latency and model size. Unknown/shifted/no-evidence samples should trigger uncertainty. Replayed mismatched/stale/duplicate receipts remain rejected. No release claim of empirical calibration without suitable held-out data.

<a id="r09"></a>
### R09 — Teach active evidence collection

**Current →** trainees inspect EO/IR/RF/IFF and designate/classify/respond; evidence acquisition is largely a provided feed. **External →** sensor/payload training in [Simlat](SOURCES.md#s05), Vyom's multiple evidence views. **Gap →** knowing when to seek another observation is itself a skill. **Proposal →** bounded simulated requests to inspect, wait for a sweep, cross-check a channel or request a teammate's report, each with visible age/latency and opportunity cost. **Benefit →** uncertainty management rather than guessing labels.

**Implementation →** introduce versioned evidence-request actions in both Python/TS engine paths and shared browser/XR action dispatch. The response is a sanitized observation, never truth. New competency evidence records what was available when the decision was made. Keep historical v1/v2 behavior frozen.

**Success →** no early data appears before availability; repeated requests cannot farm score. Equivalent keyboard/XR actions yield the same server reconstruction. AAR distinguishes a bad decision from inadequate obtainable evidence; assessment does not punish rational abstention when evidence is insufficient.

## AAR, interaction, instructor and Crew

<a id="r10"></a>
### R10 — Causal AAR and guided reflection

**Current →** Ghost has reasons, timeline, notes, What-If and reference runs. **External →** [HEAT](SOURCES.md#s03), [evidence-centered design](SOURCES.md#s10). **Gap →** chronology and score deductions alone do not show the chain from observation to choice to outcome. **Proposal →** a causal evidence graph and short “what did you know / what would you change” reflection, with immutable links to supporting events. **Benefit →** actionable feedback and fewer hindsight-based explanations.

**Implementation →** derive a graph in `review_v2.py`/a new derived-review module from original action, observation and command IDs; render in `Ghost.tsx` beside the timeline. Label inference edges and hypothetical branches distinctly; reflection is an append-only annotation, not a score edit.

**Success →** every asserted fact resolves to evidence valid at that time; future truth appears only in a labeled review layer. What-If/reference/teaching-note operations preserve original payload/profile. Screen readers and a plain ordered-list view convey the same graph.

<a id="r11"></a>
### R11 — One synchronized evidence workspace

**Current →** Ghost separates pinned evidence and playback cursor; sensor panels are distributed. **External →** [Foxglove](SOURCES.md#s07). **Gap →** users can confuse selected event time, current replay time and late data. **Proposal →** explicit clocks, linked cursor/selection, evidence age, gaps and saved analytic layouts. **Benefit →** accurate review and faster diagnosis without hiding uncertainty.

**Implementation →** a small shared time/selection model around `Ghost.tsx` and observation views; keep live session state separate. Lazy-load bounded windows; keyboard step-to-event and mark regions. Last-known data must show timestamp/expiry, never appear as a fresh detection.

**Success →** out-of-order arrivals, seeking across gaps, pinned old events, late server verification and opening another session never change the user's active review incorrectly. Source/log/logical clock distinctions survive export; no future sample leaks into live training.

<a id="r12"></a>
### R12 — Progressive active-session controls

**Current →** spatial theatre and stable decision controls are implemented; the inspected current-source screenshot shows observation settings overlaying a substantial view area. **External →** AEGIS's task-first entry and AEGIS-X's compact keyboard cues. **Gap →** operational evidence competes with configuration and route discovery. **Proposal →** one task spine, contextual evidence tray, compact optics strip and a non-obscuring settings drawer with deliberate focus return. **Benefit →** less visual search while preserving the existing visual identity.

**Implementation →** refine current `App.tsx`, `Scene.tsx`, guidance/navigation and CSS tokens; keep current premium import order. Avoid another global redesign. Use fixed control geometry across contact changes and selection-specific eligibility explanations.

**Success →** actual 100% zoom desktop/tablet/mobile tasks: select→designate→classify→respond without lost clicks or layout shifts; keyboard focus retained on sensor refresh. Measure task completion/errors with users; do not call a screenshot “intuitive” without task evidence. No FPS or scoring regression.

<a id="r13"></a>
### R13 — Accessibility, localization and remapping

**Current →** accessible controls/tests exist; language and input alternatives are not a complete cross-route/XR system. **External →** ammar AEGIS bilingual affordance, AEGIS-X audio cues, [W3C XR](SOURCES.md#s23), [QGC](SOURCES.md#s08). **Gap →** English terminology, dense text and fixed modalities can prevent otherwise valid training. **Proposal →** reviewed English/Hindi catalogs, plain-language terms, remappable actions, non-color cues, captions, reduced motion and legibility settings. **Benefit →** wider access without changing competency standards.

**Implementation →** add a proposed localization/action catalog consumed by existing routes, help and XR; preserve canonical internal IDs. Separate cosmetic accommodations from assessment-changing timing/mode settings and record the latter. Audio alerts need text/visual counterparts and mono option.

**Success →** locale key parity, translation review, keyboard-only active exercise, screen-reader AAR/Crew, zoom/reflow and contrast checks on real states. Wrong-language labels cannot change payload IDs. Physical accessibility/comfort tests require actual users/devices; automated axe checks alone do not close them.

<a id="r14"></a>
### R14 — Spatial and timeline authoring

**Current →** ExerciseStudio and RaidStudio provide constrained authored scenarios. **External →** [VBS4](SOURCES.md#s04), [QGC](SOURCES.md#s08). **Gap →** geometry, evidence availability and learning objectives are hard to reason about through isolated fields. **Proposal →** synchronized map/3D preview, route/time handles, evidence-window preview and task-coverage lint. **Benefit →** instructors can author credible exercises with fewer invalid combinations.

**Implementation →** layer on `ExerciseStudio.tsx`/`RaidStudio.tsx`, authoritative geometry schema and R03 metadata. Draft→validate→preview→freeze; preview never mutates a running scenario. Instructor-only truth view must be visually and technically separate from trainee observation.

**Success →** mouse/keyboard equivalents, undo/redo, invalid-number drafts, terrain/occlusion mismatches and unobservable objectives tested. Seeded preview matches frozen replay. Solvability is bounded by available evidence, not an omniscient oracle that “proves” a learner should know hidden intent.

<a id="r15"></a>
### R15 — Longitudinal reports that explain differences

**Current →** authenticated Analytics has overview, scenario/skill, comparison, Director history and unit trends. **External →** [HEAT](SOURCES.md#s03), external skill-passport patterns. **Gap →** score changes conflate scenario difficulty, assistance and sample size. **Proposal →** competency coverage, matched task comparisons, uncertainty, assistance exposure and evidence-linked recommendations; printable/shareable local briefs. **Benefit →** instructors see what changed and what evidence remains missing.

**Implementation →** derived endpoints over current verified histories; refine `Analytics.tsx` and reuse Ghost evidence links. Scope individual, Crew, practice, hypothetical and imported histories explicitly. Use descriptive wording until R04 supports causal claims.

**Success →** imported/duplicate/reference sessions cannot inflate mastery; comparisons flag mismatched conditions and sparse samples; authorization applies to exports as well as screens. Every highlighted insight links to source sessions and includes relevant coverage/denominators.

<a id="r16"></a>
### R16 — Communication and readback as persisted evidence

**Current →** Crew roles/actions/handoffs are attributed and durable. **External →** [MASA communication-inclusive review](SOURCES.md#s26), [ATC dialogue research](SOURCES.md#s15). **Gap →** a completed handoff does not establish that uncertainty and intent were communicated clearly. **Proposal →** structured contact reports, requests, acknowledgments and correction/readback events; optional consented local audio later. **Benefit →** train shared understanding, not just parallel button pressing.

**Implementation →** additive Crew event types in `server/crew.py` and UI history; include actor/role, request ID, logical/receive time and referenced observed evidence. Text first. Voice recognition drafts require explicit review and must not trigger actions automatically.

**Success →** reconnect, duplicate, stale-report and unauthorized-role tests; report ordering and age visible. Reports cannot reveal contacts not observed to that role. Export/restore preserves attribution. Crew event count never becomes individual skill credit.

<a id="r17"></a>
### R17 — Planned Instructor interventions and review

**Current →** authenticated targeted commands reach acknowledged/applied states. **External →** [AGIL](SOURCES.md#s01), [VBS4](SOURCES.md#s04). **Gap →** interventions are hard to evaluate against a teaching objective or compare across serials. **Proposal →** bounded intervention plans, confirmation/eligibility preview, teaching prompts and AAR bookmarks. **Benefit →** repeatable facilitation and explainable command effects.

**Implementation →** build on `Instructor.tsx` and existing command stream; store planned versus actual commands with target session, engine/config hash and reason. Avoid general arbitrary scripting on the server. Preserve session isolation and application acknowledgments.

**Success →** rejected, delayed, superseded and disconnected commands are distinguishable. Plans cannot affect another session or apply outside permitted exercise state. AAR shows how an intervention changed the evidence window without editing the original scoring history.

<a id="r18"></a>
### R18 — Crew role-rotation curriculum

**Current →** shared exercise scoring/coordination history exists with intentional individual learning isolation. **External →** [collective training](SOURCES.md#s01), [GIFT small-team architecture](SOURCES.md#s09). **Gap →** no validated progression for communication, role handoffs or rotating responsibilities. **Proposal →** coordinated task sets with role-specific objectives and team-level evidence. **Benefit →** meaningful Crew progression while keeping individual claims honest.

**Implementation →** R03 team competencies plus authored Crew assignments and R16 events. Use existing capability/revocation/reconnection contracts. Individual assessment, if desired, must be a separately attributed solo task or a newly designed validated role assessment, never shared score copying.

**Success →** role rotation/revocation during active play, simultaneous reports and late reconnects preserve ownership. Measure report completeness, acknowledged handoff timing and shared outcomes with context; avoid ranking participants merely by fastest clicks.

## Simulation, data and response depth

<a id="r19"></a>
### R19 — Semantic scene packs

**Current →** urban/rural world assets and authoritative occlusion boxes coexist. **External →** [VBS4](SOURCES.md#s04), SUDARSHAN's terrain-pack workflow, [glTF](SOURCES.md#s25). **Gap →** more visual variety can silently disagree with collision/visibility truth. **Proposal →** versioned small scene packs containing render assets, simplified authoritative geometry, coordinate conventions, provenance and cost budgets. **Benefit →** new credible environments without a heavyweight world engine.

**Implementation →** extend `world/terrain.ts`, `layout.ts`, `Environment.tsx` and server scene configuration through a pack ID/hash. Use separate render seed; gameplay geometry remains frozen in the exercise snapshot. Add varied fictional training settings only when objectives justify them.

**Success →** visual obstruction/authoritative line-of-sight fixtures agree, scaling/origin/units tested, assets local and rights recorded. Rendering tier changes cannot change observations or scores. Old terrain IDs and historical scenes still replay.

<a id="r20"></a>
### R20 — Weather with explicit semantic effects

**Current →** fog/night and sensor status exist, not a general weather model. **External →** documented weather in PARASHURAMA/SKYSHIELD and [VBS4](SOURCES.md#s04). **Gap →** visual rain alone teaches no credible sensor behavior; changing every parameter silently breaks comparability. **Proposal →** a small versioned weather state covering visibility/illumination and explicitly modeled channel effects, with assumption ranges. **Benefit →** varied evidence interpretation and honest model limits.

**Implementation →** successor environment schema in `sensors_v2.py`/config and TS mirror, deterministic interpolation and snapshots; render weather uses the same state but separate decorative randomness. Do not invent operational attenuation constants as measured truth.

**Success →** parity and monotonic/metamorphic checks for documented effects; channel-specific behavior, no hidden-identity shortcut, safe schema validation. Matched tasks distinguish weather difficulty from skill change. Original 18/22 fixtures remain identical.

<a id="r21"></a>
### R21 — Fidelity that scales within a budget

**Current →** instancing/PBR/local textures and close-up rendering exist. **External →** [Three preparation](SOURCES.md#s21), [glTF assets](SOURCES.md#s25). **Gap →** high-detail expansion can worsen startup and obscure evidence. **Proposal →** pack budgets, measured LOD/material/texture residency, prepared optics transitions and selective motion/atmospheric polish. **Benefit →** convincing scenes with predictable cost on unit laptops.

**Implementation →** existing world material/asset pools, `Environment.tsx`, `ContactRenderer.tsx`, inspection/thermal passes; keep physics and visibility unchanged. Shader warmup only if R01 attributes stalls. Prefer local licensed assets and geometry simplification over mandatory new rendering frameworks.

**Success →** matched first-load and 200-retained-contact runs, EO/IR close-up and XR entry/exit; report resources and frame tails. No apparent size/contrast cue may disclose hidden class or bypass DRI rules; accessibility/reduced-motion modes remain usable.

<a id="r22"></a>
### R22 — Synthetic signal and acoustic laboratory

**Current →** sensor observations and illustrative rotor audio exist; no raw-signal educational pipeline. **External →** Vyom's synthetic I/Q chain, SUDARSHAN signal displays. **Gap →** learners cannot explore how signal ambiguity/outage affects interpretation. **Proposal →** an optional explicitly synthetic lab with synchronized spectrogram/waterfall/feature views and repeatable interpretation tasks; acoustic evidence as a new modeled channel only after design validation. **Benefit →** teach evidence reasoning beyond silhouette recognition.

**Implementation →** separate lab data generator and observation schema, seeded bounded batches and local precomputation where needed. No per-frame heavyweight DSP in the existing 30 Hz scoring loop. If scored, introduce a new engine/action version and carry only observable measurements into Fusion.

**Success →** known-signal unit fixtures, sampling/unit/aliasing checks, reproducible seeds, dropout/noise/unknown cases and resource budgets. Model parameters labeled illustrative; synthetic classifier accuracy cannot become real-sensor accuracy. Acoustic cue accessibility and no hidden-contact audio leakage tested.

<a id="r23"></a>
### R23 — Recording/data adapters with rights and time provenance

**Current →** Recorded Practice accepts bounded normalized JSON and is unscored. **External →** [Anti-UAV](SOURCES.md#s20), [MCAP](SOURCES.md#s24). **Gap →** safe import alone does not explain source, clock, licensing, labeling or missing data. **Proposal →** adapter contracts with units, source/log timestamps, coordinate frame, provenance, rights and uncertainty metadata. **Benefit →** practical lawful data exploration without corrupting synthetic assessments.

**Implementation →** extend `server/recordings.py` using quarantined validation, resource limits and explicit unscored practice. Optional adapter processes output normalized data; they cannot send simulator commands. No public dataset is bundled without redistribution rights.

**Success →** malformed/oversized/archive-bomb, clock skew, duplicate ID, unit mismatch, missing-label and unsupported-license cases; no imported canonical truth in live observations. Round trip preserves source identity and uncertainty. Score only under a separately validated protocol with frozen labels/splits.

<a id="r24"></a>
### R24 — Ambiguous tracks and sensor trust exercises

**Current →** radar uncertainty/coast/clutter and shared contact IDs exist. **External →** GARUDA filter/association source, [adjacent synthetic tracking](SOURCES.md#s26). **Gap →** interpreting split/merge, identity continuity and disagreeing channels can be richer than classifying stable IDs. **Proposal →** bounded observation-level ambiguities with explicit track confidence/history and correction workflows. **Benefit →** practice disciplined uncertainty handling.

**Implementation →** new versioned track-observation contract in server/TS engines; separate simulated entity ID from trainee-visible track identity. UI selection pins a stable visible track handle and reports stale/merged state; never silently redirects an action. Fusion consumes only visible associations.

**Success →** seeded crossing/dropout/split/merge fixtures, selection continuity and stale-action rejection, server reconstruction and AAR explainability. No all-seeing reidentification or hidden entity link shown live. Assess only information the trainee could actually resolve.

<a id="r25"></a>
### R25 — Bounded reactive behavior diversity

**Current →** deterministic raid families provide repeatability, but limited reaction depth. **External →** SKYSHIELD boids, Vyom's replay/diverge wrapper and SKYGYM's seeded bounded challenge selector. **Gap →** new seeds may preserve the same recognizable rhythm. **Proposal →** small explicit state machines for cohesion changes, dispersal and benign distractor behavior tied to training objectives. **Benefit →** transferable recognition under variation, not operational autonomy optimization.

**Implementation →** new engine/raid version with deterministic transition ordering, bounded entity count and event log. Prefer simple interpretable rules over reinforcement learning. If testing a learner-habit/contextual-bandit selector, freeze its state per scenario and constrain evidence feasibility; evaluate learning rather than adversary success. Preserve already-observed history when an event changes future paths; freeze seeds/configuration.

**Success →** parity, permutation/order, checkpoint/restore and divergence tests; no backdated trajectory changes. Semantic novelty and evidence feasibility measured. Reject behavior breadth that only increases object count or teaches unsupported threat/identity rules.

<a id="r26"></a>
### R26 — Judgment, reporting and restraint depth

**Current →** delayed effects, finite resources, channel occupancy and response warnings already exist. **External →** Axion rubric transparency and [AGIL decision rehearsal](SOURCES.md#s01). **Gap →** exercises can overemphasize selecting an effect instead of communicating uncertainty and choosing restraint. **Proposal →** abstract report/request/wait/hold/coordinate branches with stated fictional training constraints. **Benefit →** richer judgment and more informative decision-tree AAR.

**Implementation →** extend versioned task/rubric definitions around `response_v2.py` and review, with shared browser/XR eligibility and clear reversible drafting versus committed action. Do not add real-world targeting, weapon-control procedures or unsupported doctrinal assertions.

**Success →** rational restraint can succeed; harmful premature action and avoidable delay have evidence-based explanations. Resource accounting, duplicate/out-of-order action integrity and historical scores remain intact. Independent subject-matter review validates educational assumptions before claims of realism.

## Assessment, deployment and trust

<a id="r27"></a>
### R27 — Evidence-based proficiency passport

**Current →** callsign history/skills exist; callsigns are not secure exam identity. **External →** PARASHURAMA/DroneShield/SKYHAWK progression patterns, [HEAT](SOURCES.md#s03). **Gap →** progress visuals risk overstating identity and competence. **Proposal →** competency coverage, recent assessed evidence, conditions, confidence/limitations and optional authenticated local roster identity. **Benefit →** useful progress without unsupported certification.

**Implementation →** extend current auth/analytics with a separate learner identity/consent policy only if institutional assessment requires it. Derive passport from R03/R06, include assistance/accommodations and imported-evidence scope. Officer approval can attest review, not transform a simulated score into accredited competence.

**Success →** pseudonymous practice remains possible; impersonation/authorization and merge/reassignment audit tested. Duplicate imports and Crew outcomes cannot inflate individual evidence. Sparse or expired coverage displays “insufficient evidence”; no unearned certification badges.

<a id="r28"></a>
### R28 — Prepared offline deployment kits

**Current →** production assets/services are local and clean-clone installation was verified; initial dependencies still need preparation. **External →** Godot trainer wheelhouse documentation; SKYHAWK portable preview. **Gap →** “offline runtime” is easily mistaken for “installable on an unprepared offline machine.” **Proposal →** reproducible platform-specific dependency bundles and signed manifests with explicit Python/Node/browser prerequisites. **Benefit →** dependable unit deployment.

**Implementation →** extend `scripts/` and release packaging for approved Windows/Linux/macOS architectures; pin wheels/locks, asset hashes and notices. A single-file demo may be a separate labeled preview, never a substitute for server-verified training. No installation of new packages occurs in this research.

**Success →** fresh supported machines, network unavailable before installation, repeated startup/shutdown with active connections, correct venv paths, backup/restore and all-local resource checks. Actual OS/device receipts required. M1 Docker is not native Windows/Linux certification.

<a id="r29"></a>
### R29 — Unit readiness and recovery assistant

**Current →** startup/preflight, HTTPS scripts, auth setup and queued recovery exist. **External →** [QGC setup wizards](SOURCES.md#s08), [AVS deployable configuration](SOURCES.md#s02). **Gap →** LAN interface selection, trust, setup and recovery remain operator burdens. **Proposal →** a concise local readiness page with verified interface URLs, capability checks, certificate guidance, queue state and recovery receipts. **Benefit →** fewer setup failures and more honest operational readiness.

**Implementation →** reuse existing system/startup routes and scripts; explicit distinction among loopback, LAN reachability, trusted HTTPS, XR availability and WAN independence. Inspect state without leaking secrets or disabling browser security. Never recommend certificate-warning bypass.

**Success →** offline/no-NIC/multiple-NIC/occupied-port/expired-cert/server-restart cases, keyboard/mobile setup and no password exposure. Physical phone/headset/browser trust is confirmed by a separate device receipt, not by a loopback test.

<a id="r30"></a>
### R30 — Optional offline signed provenance

**Current →** HMAC transfer protects integrity under a shared key but does not identify an independent donor. **External →** external audit-ledger claims and [xAPI signed-record context](SOURCES.md#s14). **Gap →** cross-unit evidence needs a clear trust boundary, not just a checksum. **Proposal →** optional public-key signatures over canonical evidence envelopes with issuer/key IDs, trust store, revocation and migration. **Benefit →** verifiable origin when organizations need it.

**Implementation →** threat-model first; a proposed signing adapter outside frozen engine math, over existing portable payload/source hashes. Support old HMAC archives as explicitly scoped legacy imports. Keep private keys outside exports and repository. Hash chain and signature do not prove the original observations were truthful.

**Success →** key rotation/revocation, canonicalization, unknown issuer, stale trust store, tamper, duplicate and backup/restore tested. A valid signature cannot bypass schema/reconstruction/authorization. No “tamper-proof” or nonrepudiation claim without a defensible operational key process.

## Immersive, engineering and ambitious research

<a id="r31"></a>
### R31 — Physical XR acceptance and ergonomic contract

**Current →** software/IWER lifecycle and stereo evidence exists; physical headset comfort/FPS and separate-device HTTPS remain pending. **External →** [AVS](SOURCES.md#s02), [W3C XR user needs](SOURCES.md#s23). **Gap →** emulator controls do not reveal head/hand ergonomics, readability or sickness. **Proposal →** a repeatable headset acceptance protocol with seated/standing options, reach/scale/reset, session interruption and browser fallback. **Benefit →** credible immersive readiness.

**Implementation →** physical-test runbook plus measured improvements to `VRCockpit.tsx`, `VRWorld.tsx`, `vr.ts` only when reproduced. Record device/browser/controller, refresh, thermal duration, trust setup, action integrity and subjective comfort with consent.

**Success →** complete classification/response/AAR on actual headset, exits/context loss/re-entry and offline queued recovery, legibility at intended distance, no accidental actions. Keep all gates PENDING until tested; do not derive headset FPS from monitor callbacks.

<a id="r32"></a>
### R32 — Input-equivalent immersive coaching

**Current →** rays/controller actions and browser recovery are integrated. **External →** [W3C multimodality](SOURCES.md#s23), [GIFT pedagogy](SOURCES.md#s09). **Gap →** training guidance and alternative inputs need consistent semantics across modes. **Proposal →** optional seated panels, remapped/controller/keyboard alternatives, guided study prompts and later hand/gaze exploration. **Benefit →** accessible immersion without a separate VR game.

**Implementation →** reuse shared accepted-action path and R05 lesson contracts; focus/selection ownership and two-stage confirmation remain explicit. Gaze may preview, never silently classify or commit. No new production dependency on emulator-only behavior.

**Success →** semantic action sequences reconstruct identically across modalities; dwell/cancel/tracking-loss/rapid-contact changes cannot submit duplicates. Physical ergonomic review precedes “natural interaction” claims; unsupported devices retain ordinary browser training.

<a id="r33"></a>
### R33 — Derived offline interoperability

**Current →** portable archives and normalized recording import exist. **External →** [MCAP](SOURCES.md#s24), [xAPI/IEEE](SOURCES.md#s14). **Gap →** other lawful analytics/learning tools cannot consume a stable VYUHA evidence profile. **Proposal →** optional derived log export and a versioned learning-statement profile, offline first. **Benefit →** research/organizational integration without cloud dependence.

**Implementation →** export adapters from immutable session evidence, with logical/log/source clock semantics, pseudonymous IDs and references to original hashes. Choose exact xAPI edition/profile; support local files or a separately configured local LRS. Do not require an external service during training.

**Success →** independent reader round trip, seek/index correctness, schema/profile validation and no secret/hidden live truth export. Unsupported event types remain explicit; export does not imply complete LRS conformance or alter score/profile.

<a id="r34"></a>
### R34 — Qualification beyond passing test totals

**Current →** extensive suites, parity, history and scoped browser/performance evidence exist. **External →** [Chrome tracing](SOURCES.md#s22), source projects' fuzz/wheelhouse patterns. **Gap →** test counts do not establish soak, hardware breadth, responsiveness or fault coverage. **Proposal →** source-bound qualification matrix with retained workloads, lifecycle soaks, recovery fault campaigns and cross-platform receipts. **Benefit →** fewer rediscovered defects and more defensible release claims.

**Implementation →** expand current browser/benchmark/release harnesses, event receipts and source manifests; local reproducible datasets and resource limits. Baselines compare identical workloads/tier/cache/viewport. Use meaningful fault classes, not tests mirroring implementation.

**Success →** real server kill/reconnect, worker interruption, stale response, disk-full/restore failure, repeated starts, XR loss and archive failure have bounded recovery/no duplicate evidence. Run appropriate final suites after actual code changes; report native and emulated devices separately. Preserve historical 18/22 scores.

<a id="r35"></a>
### R35 — Model validity, provenance and sensitivity

**Current →** explicit illustrative configurations, deterministic parity and response/sensor documentation exist. **External →** unrelated Vyuha parameter cards, [calibration](SOURCES.md#s12), [assessment design](SOURCES.md#s10). **Gap →** numerical consistency is not empirical validity. **Proposal →** parameter/model cards with sources, assumptions, ranges, intended learning use, exclusions and sensitivity/uncertainty experiments. **Benefit →** credible realism and honest interpretation.

**Implementation →** extend current configuration metadata and evidence registry; no automatic replacement of illustrative constants by news figures. Run offline parameter sweeps against competency evidence and solvability, publish effects, version meaningful semantic changes. Seek appropriate external expert review/data agreements where needed.

**Success →** every claimed calibrated parameter has admissible evidence and scope; unsupported ones remain illustrative. Tests identify brittle scoring/sensor thresholds and model limitations. No parity/historical change hidden behind “more realistic.”

<a id="r36"></a>
### R36 — Optional high-fidelity research/authoring adapters

**Current →** low-cost browser scenes are generated locally; no flight-stack or heavy simulator prerequisite. **External →** [AirSim](SOURCES.md#s16), [PX4/Gazebo](SOURCES.md#s17), [Isaac Sim](SOURCES.md#s18), [domain randomization](SOURCES.md#s19). **Gap →** selected data/scene research may need richer offline tools. **Proposal →** optional bounded export/import tools for scene/data creation and validation, never a runtime rewrite. **Benefit →** ambitious experimentation while preserving unit deployment.

**Implementation →** independent offline adapter processes output R19/R23 packages with coordinates, time, rights, tool/version and limitations. Large raw content stays outside normal repo/runtime. Linux/GPU prerequisites are explicitly separate from M1 browser requirements.

**Success →** deterministic imported artifacts, unit/frame checks, license review, offline asset budgets and domain-shift tests. A physically richer synthetic tool does not establish human transfer or real sensor calibration. Adopt only if a concrete training question cannot be answered with the current engine.

<a id="r37"></a>
### R37 — Constrained language-to-scenario drafting

**Current →** studios accept explicit validated configuration, not conversational authoring. **External →** Ashutosh trainer's bounded English/Hinglish intent parser. **Gap →** instructors may know a teaching goal but not the configuration vocabulary. **Proposal →** language produces a draft intent/schema plus clarification, never executable code or immediate launch. **Benefit →** accessible authoring with inspectable results.

**Implementation →** optional local parser/model adapter before existing studio validation and R14 preview; whitelist supported fields, keep source phrase/draft diff, reject ambiguity and show all assumptions. Deterministic compiler freezes the accepted scenario and metadata; generation is outside authoritative replay.

**Success →** malformed/prompt-injected/unsupported text cannot escape schema, call tools or expose files; preview shows the exact change. English/Hindi ambiguous quantities demand review. Round-trip accepted intent yields the same frozen scenario regardless of future model changes.

<a id="r38"></a>
### R38 — Grounded local tutor and reflection dialogue

**Current →** rule-based Ghost/Fusion and notes are inspectable; no need for cloud prose to score. **External →** [GIFT](SOURCES.md#s09), [ATC structured dialogue](SOURCES.md#s15). **Gap →** individualized explanation and probing questions could be richer, but fluent hallucination is risky. **Proposal →** a staged local tutor: structured hints first, optional retrieval-backed language over authorized evidence and reviewed teaching material later. **Benefit →** personalized reflection without sacrificing auditability.

**Implementation →** a new optional tutoring service reads sanitized live evidence or explicitly permitted completed-AAR truth; it cannot query arbitrary sessions, issue actions, change scores or update mastery directly. Responses carry evidence IDs, model/version, mode and fallback. Keep templates available on low-resource machines.

**Success →** adversarial hidden-truth/other-session/prompt-injection tests, unsupported question abstention, evidence fidelity and latency/memory benchmarks. Assess tutor usefulness in R04; eloquence, token speed or user preference alone does not establish learning.

<a id="r39"></a>
### R39 — Workload and attention research without invented inference

**Current →** decision timing and sensor/action evidence exist; physiological state is not measured. **External →** [NASA TLX](SOURCES.md#s13), [HEAT optional human-performance inputs](SOURCES.md#s03). **Gap →** overload and confusing UI can look like skill failure. **Proposal →** optional post-block workload and usability feedback; richer sensing only in separately consented research. **Benefit →** distinguish task demand from interface friction.

**Implementation →** evaluation survey/event module with explicit consent, minimal retention and local export. Self-reported workload stays distinct from server-verifiable actions; no automatic aptitude/fitness decisions. Eye tracking/head direction never becomes an unqualified attention or intent score.

**Success →** nonparticipation does not disadvantage training; withdrawals/exports/deletion policy work. Compare workload only under matched tasks, expose missing data and avoid causal/medical claims. Hardware-based research remains blocked on rights, devices, protocol and participants.

<a id="r40"></a>
### R40 — Reproducible research and content governance

**Current →** strong release evidence exists but audit/document/content scopes can drift. **External →** [GIFT research architecture](SOURCES.md#s09), [dataset evaluation discipline](SOURCES.md#s20), existing VYUHA source manifests. **Gap →** model, content and pedagogical changes need the same provenance discipline as engine releases. **Proposal →** registered experiments, content/model cards, licensed dataset manifests, expert review receipts and negative/inconclusive findings. **Benefit →** sustainable credibility and a defensible next-generation research program.

**Implementation →** extend `docs/`/evidence tooling with registry links and bounded generated reports; evaluate learning and simulation separately. Freeze datasets/splits/policies, retain failed experiment scope and prohibit retroactive relabeling of old evidence. Research-only artifacts never silently replace runtime claims.

**Success →** another team member can reproduce a published analysis from lawful inputs/source hashes; undocumented data/parameter changes fail checks. Reviews enumerate unresolved physical/data/learning limitations. No new stable tag is justified by report completeness alone.

## Deferred or rejected directions

| Direction | Disposition and reason | Revisit condition |
|---|---|---|
| Replace current runtime with Unity/Unreal/ROS/Isaac | Reject as default. Discards validated replay/history and weakens low-cost deployment. | A separately scoped requirement cannot be met through optional offline tooling. |
| Add cloud LLM as required advisor/scorer | Reject. Breaks training independence and evidence integrity. | Optional grounded non-authoritative tutor demonstrates usefulness and can be disabled. |
| More threat/response names solely to beat catalog counts | Reject. Breadth without observable distinctions creates false learning. | Specific competency, evidence and validated assumptions justify each addition. |
| Turn IFF/RF silence, silhouette or behavior into certain hostile intent | Reject. Encourages unsupported inference. | A fictional scenario explicitly supplies observable intent evidence, with uncertainty intact. |
| Give all Crew members the shared score as individual mastery | Reject. Violates existing intentional isolation. | A new validated role-assessment protocol with attributable evidence exists. |
| Real vehicle/weapon control or tactical-optimization add-ons | Outside training research scope. | Not part of this roadmap. |
| Eye tracking/heart rate as mandatory readiness score | Defer/reject default. Privacy and validity costs outweigh unproven benefit. | Consented independent human-factors study with defensible use. |
| Wholesale visual redesign / generic admin dashboard | Reject. Integrated theatre/workstation is already a strength. | A reproduced task problem justifies a targeted change. |
| Public leaderboard or unqualified certification | Defer. Identity, fairness, coverage and validation unresolved. | R03/R04/R06/R27 support the exact limited claim. |
| Redistribute competitor assets/models/datasets because public | Reject. Public access is not reuse permission. | Exact compatible license and provenance verified. |

## Implementation checkpoints after review

**Checkpoint A:** R01/R02 instrumentation and registry, R03 competency contract, R04 protocol and a small R05/R06 vertical slice. Deliver actual learner task, server evidence and AAR linkage; no efficacy claim.

**Checkpoint B:** R07/R08 benchmark alternatives, R09 evidence requests, R10–R18 workflow improvements. Preserve original scoring and action ownership; run complete relevant regression and actual browser tasks after source changes.

**Checkpoint C:** R19–R30 simulation/data/deployment proposals selectively enabled behind explicit versions and permissions. New semantic engine versions must pass parity and historical compatibility. Platform kits require actual native testing.

**Checkpoint D:** R31–R40 immersive/research work, with hardware, data rights and participant gates visible. Keep optional tools out of ordinary training requirements. Approve releases based on exact-source software/physical evidence and owner review, never a feature-count target.

## Research expansion — 23 October 2026

The original R01–R40 remain intact. [R41–R48](EXPANSION-2026-10-23.md) add researched proposals, not completed features. The canonical capability index tracks all 48 with dependencies. Their progression begins RESEARCHED; design, implementation, integration, testing and validation require distinct evidence. Current Checkpoint A remains PARTIAL.
