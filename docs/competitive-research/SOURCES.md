# Method, source register and reuse policy

All accesses: **22 October 2026**. Direct repository sources are pinned in the [inventory](COMPETITOR-INVENTORY.md). External product pages can change; treat their descriptions as a dated snapshot. Primary documentation, original papers and actual source were preferred over comparison blogs.

## Evidence categories

- **Observed:** named public screen or HTTP response inspected in this task. Does not imply a complete workflow, security review or physical device test.
- **Inspected source:** selected implementation exists at a pinned revision. Dependencies, fallback paths and hidden-truth access must still be examined; file existence is not execution evidence.
- **Documented:** maintainer/vendor describes a feature or reports tests. No independent verification is implied.
- **Measured:** named environment, source revision, workload, method and raw receipt support the number. VYUHA's older exact-source measurements remain historical measurements.
- **Proposed / inferred:** our analysis or design direction; not attributed as implemented functionality or established efficacy.

## Discovery process and boundaries

GitHub repository API queries: `SIH26247`, `26247 drone`, `SIH26247 in:readme`, `26247 drone in:readme`, `PS247 trainer in:readme`, `counter drone trainer sih in:readme`. Union: **94 unique entries** including this project's public repository. **69 retained** for repository-level screening: VYUHA plus 68 others, of which 64 are trainer-related/possible and four are adjacent or other PS/scope. Another 25 broader matches have dispositions in [SEARCH-SCREENING](SEARCH-SCREENING.md). Raw search bodies, tree/README receipts and filtered metadata live in [evidence](evidence/). Follow-up web queries included `"PS26247" trainer project`, `"SIH26247" -site:github.com`, `"SIH26247" site:youtube.com`, `"VyomKavach"`, named products, tutoring research and relevant source licenses. Repository demo links and cited professional references were followed where useful.

No login to competitor services, private-data enumeration, trainee-results browsing, training enrollment, upload, retraining, command injection or exercise submission was performed. Public source was downloaded for inspection only. It was not executed, installed or copied into product source. The public VyomKavach OpenAPI schema and model-status endpoint were read; neither yields learning/performance validation.

Search is bounded by public indexing, naming, time and API reachability. It cannot establish all private/official submissions or all future projects. Thin/empty entries, legacy siblings, companions, README-identical families and likely related StarBusters repositories prevent interpreting repository counts as independent functioning competitors. No official participation count or judging rank is asserted. Video links were discovered but no complete competitor demo video was independently watched; this is explicitly an evidence gap.

Later tree API calls returned HTTP 403; named-branch Git lookups and pinned raw README downloads recovered several entries without bypassing access controls. Those are labeled README-only; a failed tree retrieval is not an empty application.

Python HTTPS initially failed on this machine's CA configuration. System `curl` succeeded with TLS validation; the supplied service returned HTTP 200. Initial client errors are retained in fetch receipts and are not described as service downtime. One linked PARASHURAMA documentation deployment returned `404 DEPLOYMENT_NOT_FOUND`; that does not negate the inspected repository source.

## Professional products and interaction references

<a id="s01"></a>
### S01 — ST Engineering AGIL C-UAS simulation

[Official product](https://www.stengg.com/en/defence/training-and-simulation/manned-and-unmanned-simulation-training-systems/defence/air/agil-counter-unmanned-aerial-system-simulation-system/) · [brochure](https://www.stengg.com/getmedia/1fb83905-33a1-48ce-98ae-ccc9703235de/AGIL-Counter-Unmanned-Aerial-Systems-Simulation-System.pdf).

Vendor documents describe integrated team training and scenario experimentation with analytics. Inspiration: connect authoring, rehearsal and review around learning objectives. No VYUHA-versus-AGIL performance, realism, price or learning comparison was measured. Proprietary product; interaction/concept reference only.

<a id="s02"></a>
### S02 — AVS Horizon Guardian

[Official product and equipment imagery](https://appliedvirtual.net/horizon-guardian/).

Vendor describes portable mixed-reality training, instrumented interfaces, scenario control and performance review. Inspiration: separate visual immersion, measured interaction and validated learning. No physical AVS device was tried; no code/assets licensed for reuse.

<a id="s03"></a>
### S03 — VRAI HEAT

[Official product/data-flow description](https://www.vraisimulation.com/products/heat).

Documents capture/store/analyse/visualise, longitudinal profiles, simulator events and optional physiological inputs; its storage description is cloud-based. Adapt the evidence-to-instructor-insight pattern locally. VYUHA should not import cloud dependency or biometric profiling merely because a professional vendor offers them. Claims of improved outcomes were not independently tested here.

<a id="s04"></a>
### S04 — OneArc VBS4

[Official product](https://onearc.com/products/vbs4/) · [deployment documentation](https://distribution.bisimulations.com/support/VBSLM2_Instructions/VBS4/20_1_0/VBS4_Deployment_Guide_HTML/Content/VBS4_Manuals/Deployment/VBS4_Deployment_Options.htm).

Vendor documents terrain editing, scenario planning, 2D/3D AAR and integration APIs. Inspiration: one coherent author→run→review loop with packaged terrain, not a whole-Earth rewrite. Vendor creation-speed multipliers were not adopted as evidence. Proprietary software/content.

<a id="s05"></a>
### S05 — Simlat

[Official applications](https://www.simlat.com/applications) · [company capability description](https://www.simlat.com/about).

Documents UAS and payload simulation/training. Useful adjacent reference for separating vehicle operation from sensor/payload operator tasks. Only vendor-level documentation reviewed; no full product acceptance, specific current SKU comparison or reusable assets established.

<a id="s06"></a>
### S06 — DefenceVR KAVACH-SIM

[Official site](https://defencevr.in/).

Indian defence-training product portfolio includes counter-UAS simulation claims. Relevant domestic professional context, not evidence that all pictured features are deployed/tested. Unrelated to student VyomKavach and to other companies' similarly named counter-drone hardware. No code reuse proposed.

<a id="s07"></a>
### S07 — Foxglove playback and layouts

[Playback documentation](https://docs.foxglove.dev/docs/visualization/playback) · [visualization overview](https://docs.foxglove.dev/docs/visualization).

Documents ordered log-time delivery, alternative timestamp meanings, synchronized panels, buffering and lookback. Inspiration: explicit clock semantics in an evidence workspace. Copying automatic latching into live training would be wrong: stale sensor observations need age/gap labels, and future messages must never appear early. Foxglove application access is not inferred from the MCAP license.

<a id="s08"></a>
### S08 — QGroundControl

[Source and current feature overview](https://github.com/mavlink/qgroundcontrol) · [survey planning documentation source](https://github.com/mavlink/qgroundcontrol/blob/master/docs/en/qgc-user-guide/plan_view/pattern_survey.md) · [official developer licensing](https://docs.qgroundcontrol.com/Stable_V5.0/en/qgc-dev-guide/getting_started/index.html).

Map editing paired with parameter controls, setup wizards and touch-oriented UI are useful patterns. VYUHA recommendations concern fictional training authoring, not real vehicle control. QGC source is dual Apache-2.0/GPLv3; Qt and other dependencies have separate obligations. Prefer independently implemented React interactions.

## Learning, evaluation and AI

<a id="s09"></a>
### S09 — GIFT

[Official overview](https://www.gifttutoring.org/projects/gift/wiki/Overview) · [2025-1 authoring guide](https://www.gifttutoring.org/projects/gift/wiki/Authoring_Guide_2025-1) · [developer guide](https://gifttutoring.org/projects/gift/wiki/Developer_Guide_2025-1).

Separates domain content, learner state, pedagogy and experiment/authoring tools. Inspiration: structured competency contracts before generative tutoring. Source download requires registration; no blanket permissive license or dependency adoption is assumed.

<a id="s10"></a>
### S10 — Evidence-centered assessment design

[Mislevy, Almond and Lukas, 2003, ETS RR-03-16](https://www.ets.org/research/policy_research_reports/publications/report/2003/hsgs.html) · [CRESST assessment structure](https://cresst.org/publication/on-the-structure-of-educational-assessments/).

Links learner claims, observable evidence and task design. Apply to recognition, uncertainty handling and coordination; score totals alone do not establish proficiency. This is an assessment design framework, not empirical validation of VYUHA's current rubric.

<a id="s11"></a>
### S11 — Bayesian knowledge tracing

[CAHLR pyBKT](https://github.com/CAHLR/pyBKT) · [MIT license](https://github.com/CAHLR/pyBKT/blob/master/LICENSE).

Candidate model family for sequence-aware mastery with learned guess/slip/transition parameters. Compare against VYUHA's existing Beta baseline before adoption. MIT code permission does not supply VYUHA training data or establish model validity; later fit/evaluation must be learner- and scenario-held-out.

<a id="s12"></a>
### S12 — Confidence calibration

[Guo et al., 2017, PMLR](https://proceedings.mlr.press/v70/guo17a.html).

Study of neural-network confidence calibration including temperature scaling. Supports evaluating reliability, rather than treating model scores as probabilities. No claim that a particular calibration method improves VYUHA's heuristic Fusion or human learning without local data.

<a id="s13"></a>
### S13 — Workload measurement

[Official NASA TLX](https://www.nasa.gov/human-systems-integration-division/nasa-task-load-index-tlx/).

Subjective workload instrument. Use voluntary post-block workload alongside objective decision evidence. It is not a diagnostic tool, physiological measurement or proof of learning; avoid inventing workload scores from cursor movement.

<a id="s14"></a>
### S14 — xAPI / learning interoperability

[IEEE 9274.1.1-2023](https://standards.ieee.org/ieee/9274.1.1/7321/) · [ADL legacy specification repository](https://github.com/adlnet/xAPI-Spec).

The IEEE page identifies the learner-experience JSON/REST standard and a related ISO/IEC/IEEE 39274-1-1-2025 edition. Do not mistake the old ADL 1.0.3 repository for the complete current conformance target. Later export work must pin the chosen edition/profile and validate it; an offline JSON export alone is not a conformant LRS.

<a id="s15"></a>
### S15 — Virtual simulation-pilot dialogue research

[Original paper, 2023](https://arxiv.org/abs/2304.07842).

Describes ASR→domain entity parser→spoken response for air-traffic-controller training. Inspiration: constrained phrase interpretation and readback in Crew exercises. Not evidence that unrestricted voice/LLM commands are reliable or offline. Use consented local processing and explicit confirmation before any training action.

## Simulation, data, rendering and accessibility

<a id="s16"></a>
### S16 — AirSim / Cosys-AirSim

[Microsoft AirSim source](https://github.com/microsoft/AirSim) · [Cosys-AirSim MIT license](https://github.com/Cosys-Lab/Cosys-AirSim/blob/main/LICENSE).

Useful optional offline scene/sensor-data authoring reference. No claim that AirSim's maintenance state or physics validates VYUHA. Unreal/Unity, environment assets and datasets require their own license review; no runtime migration proposed.

<a id="s17"></a>
### S17 — PX4/Gazebo multi-vehicle simulation

[Official PX4 documentation](https://docs.px4.io/main/en/sim_gazebo_gz/multi_vehicle_simulation).

Documents Linux-hosted multi-vehicle SITL. Optional offline import/validation adapter only; not a prerequisite for VYUHA's Mac/browser/LAN runtime. The separate PX4 term “SIH” means Simulation In Hardware, not Smart India Hackathon.

<a id="s18"></a>
### S18 — NVIDIA Isaac Sim

[Official product](https://developer.nvidia.com/isaac/sim/) · [license documentation](https://docs.isaacsim.omniverse.nvidia.com/5.1.0/common/licenses-isaac-sim.html) · [additional materials license](https://www.nvidia.com/en-us/agreements/enterprise-software/isaac-sim-additional-software-and-materials-license/).

Potential high-end synthetic-data/scene workflow outside the deployed trainer. Code openness does not grant unrestricted Kit, model or content rights. Heavy GPU dependencies are inappropriate as a mandatory path for the available M1/8 GB unit laptop.

<a id="s19"></a>
### S19 — Domain randomization

[Tobin et al., 2017](https://arxiv.org/abs/1703.06907).

Robotics transfer research motivates controlled appearance diversity. Its robotics result does not prove human training transfer. VYUHA should separate scenery randomness from semantic exercise seeds and measure both difficulty and generalization.

<a id="s20"></a>
### S20 — Anti-UAV data and evaluation

[Official dataset](https://anti-uav.github.io/dataset/) · [evaluation rules](https://anti-uav.github.io/Evaluate/).

Documents challenging visual/thermal tracking cases, including small targets, disappearance and background changes. Useful benchmark taxonomy. Public download or competition permission is not automatically redistribution permission; no media imported and no calibrated VYUHA detection claim made.

<a id="s21"></a>
### S21 — Three.js preparation

[Official WebGLRenderer documentation](https://archive.threejs.org/docs/api/en/renderers/WebGLRenderer.html).

Documents `compileAsync` and parallel shader preparation. Treat as a conditional experiment after profiling and confirm the installed r180 API; it is not proof that shader compilation caused current startup gaps. Rendering-only changes must preserve observations, worker clocks and scoring.

<a id="s22"></a>
### S22 — Browser responsiveness profiling

[Chrome Long Animation Frames documentation](https://developer.chrome.com/docs/web-platform/long-animation-frames).

Provides attribution for long frame work where supported. Pair it with worker timing, resource events and DevTools traces; it does not expose all GPU/worker cost. Feature-detect and preserve a cross-browser fallback. Record locally with opt-in diagnostics, not mandatory remote telemetry.

<a id="s23"></a>
### S23 — XR accessibility

[W3C XR Accessibility User Requirements](https://www.w3.org/TR/xaur/).

Working Group Note on multimodal input, customization, captions, orientation and sickness-related needs. It is not a normative certification checklist. Adapt controller remapping, seated access and alternatives; only physical pilots can assess actual comfort/ergonomics.

<a id="s24"></a>
### S24 — MCAP

[Format](https://mcap.dev/) · [MIT implementation license](https://github.com/foxglove/mcap/blob/main/LICENSE).

Multimodal log container and optional indexed offline export. Separate its transport/log timestamps from authoritative logical ticks. MCAP permission does not grant rights to the Foxglove application or ingested data.

<a id="s25"></a>
### S25 — glTF and asset rights

[Khronos glTF](https://github.com/KhronosGroup/glTF) · [sample-asset inventory](https://github.com/KhronosGroup/glTF-Sample-Assets/blob/main/Models/Models.md).

Portable asset format with per-model rights. A royalty-free file format is not a license to every model it carries. Extend VYUHA's existing asset provenance rather than replacing it with unlabeled downloads.

<a id="s26"></a>
### S26 — Constructive team review / adjacent public simulator

[MASA SWORD exercise/AAR case](https://www.masasim.com/en/_files/ugd/8d4563_902d92116f0d4095b51939634373b8ce.pdf) · [SENTINEL public source](https://github.com/ryanwelchtech/counter-uas-simulator).

MASA's case documents exercise review including communication context; source-level SENTINEL descriptions concern synthetic tracking/association. These are adjacent references, not SIH competitors or independently tested systems here. Adapt communication evidence and uncertainty visualization; no source/asset reuse until component-specific licensing is checked.

## License decisions for a later implementation phase

| Material | Current decision |
|---|---|
| Student repositories without root license, including VyomKavach, PARASHURAMA and the unrelated Vyuha | Independently implement ideas; do not copy code, UI assets, weights or authored content. Ask rights holder only if actual reuse is later chosen. |
| MIT student repositories / pyBKT / MCAP / applicable AirSim code | Potential code candidates after exact-file/version/dependency review; preserve notices; separately verify data/assets. No dependency selected today. |
| QGC / Qt | Interaction reference first; code/dependency obligations must be resolved for the chosen licensing path. |
| GIFT | Architecture reference; inspect actual download terms before considering integration. |
| Professional simulation products | Concept/documentation reference only; no implied asset/code license. |
| Isaac Sim ecosystem | Optional research tool; separate code, platform and content terms. |
| Anti-UAV or other public datasets | Do not redistribute without explicit rights; record permitted purpose, source, split and retention. |
| Models/maps/audio/images | Each requires provenance, transformation record and compatible license independent of the parent repository. |

These are research reuse dispositions, not a legal opinion or an assertion that all transitive rights have been cleared.
