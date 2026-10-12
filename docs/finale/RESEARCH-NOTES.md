# Finale research and audit verification notes

Reviewed 11 October 2026. These notes distinguish independently inspected primary sources, proposals in the attached audit, and evidence still unavailable. No competitor code or proprietary assets were copied, vendored or executed.

## Official requirement source

The archived official SIH modal at `/Users/seemalanaveenyadav/Desktop/SIH/vyuha/work/stage7/official-ps-details.png` was visually inspected. It identifies SIH26247, Ministry of Defence / Defence Services Staff College, Software, Robotics and Drones. It calls for recognising/classifying/responding to drone and swarm threats in day/night, degraded sensors and urban/rural scenarios; unit use with minimal special hardware; desktop **or** VR; scripted and procedurally generated threats; decision-tree scoring on detection time, classification and engagement; individual/unit AAR over repeated sessions.

The direct [official PS page](https://sih.gov.in/sih2026 PS) failed to open during this verification. The archived image is retained as the inspected official source. Separate adjustable-difficulty and randomisation clauses are not visible in that image: those scorecard rows remain relevant quality objectives, without inventing additional exact official wording. The audit’s public mirror is a secondary requirement source and does not override the archived official OR choice.

## Primary technical sources actually inspected

| Source | Verified scope | Implementation consequence / limit |
| --- | --- | --- |
| [JRC publication record: Towards an Open-Source Simulation Platform for Counter-UAS Sensor Fusion](https://publications.jrc.ec.europa.eu/repository/handle/JRC144169) and [authors’ conference paper](https://dl.ifip.org/db/conf/wmnc/wmnc2025/1571211631.pdf) | Multi-modal simulation spanning radar, RF, EO/IR and Remote ID; configurable sensing and propagation; camera visibility/occlusion; timestamped reports. Paper explicitly describes ongoing validation/model limitations. | Useful architectural checklist for separating sensor observations from reference truth. It does not validate VYUHA’s proposed numerical ranges, RCS, probability constants or hardware fidelity. No code availability or calibration is inferred. |
| [Stone Soup initiators and deleters](https://stonesoup.readthedocs.io/en/latest/auto_tutorials/09_Initiators_&_Deleters.html) | Tracking examples distinguish detections/clutter, accumulate observations before track initiation and remove uncertain tracks. | Supports an explicit track lifecycle rather than instantly equating every paint with a confirmed contact. VYUHA’s proposed three-in-five threshold remains a configurable design choice, not a Stone Soup default or certified criterion. No implementation copied. |
| [Clément et al., Multi-Armed Bandits for Intelligent Tutoring Systems](https://arxiv.org/abs/1310.3174) | RiARiT/ZPDES use empirical learning progress for sequencing; authors report synthetic experiments and a schoolchildren study. | Learning progress is a legitimate Director comparison hypothesis. That educational study is not evidence of military training efficacy, skill retention or operational readiness in VYUHA. |
| [MathWorks radar detectability modelling](https://www.mathworks.com/help/radar/ug/modeling-radar-detectability-factors.html), [detectability API](https://www.mathworks.com/help/radar/ref/detectability.html) and [Swerling 1 target example](https://www.mathworks.com/help/phased/ug/swerling-1-target-models.html) | Required SNR depends on detection/false-alarm probability, detector, fluctuation and pulse integration assumptions; Swerling 1 models scan-to-scan rather than independent pulse-to-pulse fluctuations. | A simple training probability law must declare its assumptions and sampling interval. A Pfa constant alone is not a complete calibrated radar model. No MATLAB dependency or borrowed implementation required. |
| [Masaryk University adaptive-learning publication list](https://www.fi.muni.cz/adaptivelearning/?a=publications) | Lists Pelánek’s 2016 Applications of the Elo Rating System in Adaptive Educational Systems. | The exact audit-linked author PDF timed out twice. Bibliographic existence checked; formula details and applicability remain to be validated before strong calibration claims. A fitted model plus measured prediction error is needed, not just a target of 70%. |
| [Anti-UAV authors’ benchmark paper](https://arxiv.org/abs/2101.08466) | Paired RGB/IR benchmark intended for UAV tracking. | Potential research material only. No dataset clips imported: licence, permitted redistribution, provenance and suitability for recognition training must be checked separately. |
| [PIB / Ministry of Civil Aviation Drone Rules backgrounder, 28 January 2022](https://static.pib.gov.in/WriteReadData/specificdocs/documents/2022/jan/doc202212810701.pdf) | Historical official context on registration/UIN and the Drone Rules 2021. | A synthetic registered-civil cue can be modelled explicitly. Registration is not proof that every civil drone broadcasts a live Digital Sky identity beacon. This historical backgrounder is not current legal advice or a validated protocol integration. |

## Technical references not independently verified in full

The audit’s Johnson-criteria link is Wikipedia, not an original research source. Its precise N50 values/target-transfer curve and atmospheric attenuation assumptions should be documented as proposed training-model choices until an appropriate original source and units/target definitions are verified. The audit’s trade RCS article is also not a calibration dataset. DIAT-µSAT’s IEEE DataPort page was blocked by robots policy; no dataset was downloaded, no licence or class counts independently confirmed, and no empirical micro-Doppler classifier claimed.

Press reports about Akashteer, Zen and Operator XR were not used to establish capabilities or numerical parameters. The ST Engineering brochure is vendor scope evidence, not performance proof. Those references may provide context but cannot validate VYUHA or justify copying assets.

## Competitor inspection boundary

[PARASHURAMA’s public repository/README](https://github.com/JitendraSethia/parashurama) was read as a primary account of that project’s stated architecture. It describes versioned configuration, local verification, roles, HTTPS tooling, what-if and adaptive tutoring; it also records deferred headset validation and unexecuted Docker scope. Its README claims are not independently executed competitor validation. No licence granting code or asset reuse was established in this inspection; none was copied. Competitive comparisons should name only verified source-visible scope and avoid claiming exclusivity from a small public sample.

The attached audit also cites SKYHAWK ARENA, Drone-Counter-Drone Trainer, Trinetra, AERIS, Vayu Abhyas, SKYSHIELD, DRONE-TRAIN, SkyShield Trainer, DRISHTI-CUAS, AEGIS, AEROSHIELD and a README-only repository. Their existence/capability summaries remain audit-provided, not independently reproduced in this work phase. They are design leads and a research backlog, not VYUHA requirements or imported dependencies.

## Independently executed baseline checks

Exact `v1.0.1` commit `2 ca96105044 ad6 a14952 d74 db619 e20006 c26 eca` was extracted read-only into `/tmp`. A disposable database was used. Full output is embedded in `audit-backlog.json`:

- Day and night versions produced identical radar/thermal/detectability states for all 2251 ticks.
- Clear versus dense fog produced 6173 differing contact/sensor states. Fog already changes probability; the report’s purely-cosmetic implication is overstated.
- An active never-observed 300 m contact passes the baseline day/night camera predicate. A previously radar-detected 170 m contact with both current sensors false passes its thermal predicate at tick 4.
- Scripted seeds 11 and 99 retain roster/order/spawn/range/speed/altitude; only bearings differ. Director variants have additional changes, so every generated drill being literally identical is an overstatement.
- Authored 120-second duration and 3600-tick completion are rejected by baseline models.
- An unauthenticated instructor pause returned HTTP 200.
- Baseline App.tsx has 148 lines and a 2352-character longest line.
- Source inspection disproves full 100-session simulation reconstruction on every dashboard/instructor poll: ordinary dashboard results use stored cards; legacy stat backfill reconstructs only missing entries. Repeated SQL/materialisation still warrants profiling.

## Evidence and claim safeguards

The team’s latest direct report supplies an observed 4 October 2026 WAN-off/LAN-on Windows officer + phone run: common router, Internet unavailable on both, join, exercise completion, officer-visible result. Document it as team-reported evidence with that scope. No instructor command, Ghost/AAR, exact version or new finale capability is added by inference.

Preserve actual historical engine markers: the baseline sensor engine calls itself `vyuha-0.2.0`, with distinct prioritisation score metadata. The report’s suggested freeze name 0.3.0 must not silently rename old records. Any new numeric sensor library remains uncalibrated training configuration until a separate calibration study. Any synthetic learner/difficulty/fusion experiment must remain visibly synthetic. New finale source needs new regression, parity, compatibility, browser, physical and performance receipts; old baseline evidence does not automatically pass it.

## Implementation evidence update — 11 October 2026

Software parity is distinct from operational validity. The candidate has a reported full-engine Python/TypeScript parity receipt (544 checkpoints/32 scenarios) and 99 frontend tests; 319 broad backend tests passed with one completion-contract failure subsequently repaired and five focused tests passing. The broad post-fix run remains pending. White Cell independently reran 15 backend and four static-render frontend tests on canonical files.

These checks establish scoped software behavior. They do not calibrate radar/EO/IR probabilities, prove human learning gains, certify swarm tactics, test physical Windows/Linux execution or validate newly added finale features over a separate-device LAN. Numeric sensor/threat/effector configuration remains illustrative research/training data. Fusion appropriate-reliance, Brier/confidence scoring, effector resources/delays and shared-role Crew results still need implementation and measured evidence. No new independent audit score or completed product acceptance is inferred.

## Independent candidate review — 12 October 2026

Current source separates implementation from validity: metre-scale channel-specific sensing, coherent analytic formation motion, frozen procedural grammar and finite-resource delayed attempts operate as research/training software. Chosen sensor values, probability laws and response resources are not empirically calibrated equipment specifications. Bayesian-inspired normalized Fusion weights are a heuristic, not a trained Naive Bayes posterior. The adjusted Thompson Director preserves four Beta skills and session-gap/progress/uncertainty evidence; it does not implement calibrated Elo, new context mastery or established human learning gains. Synthetic paired intervals include zero and must remain visible in the experiment report.

A full autonomous expert raid is absent. Current all-engagement reference comparison uses the accepted before-action evidence and operator prior only; canonical type/link/static-range scoring reference is shown separately. Descriptive agreement is not correctness, certified expert performance, resource-aware success or learning benefit. Optional Brier is an after-completion diagnostic, not a new score weight or calibration proof. Crew shared aggregate/attribution remains separate from individual Beta learning.

The independent provisional engineering estimate is81/100 (PS45.5/50; realism/AI18/25; engineering/demo17.5/25), with explicit allocations in the provisional audit. This is not an official numerical SIH scheme or a final acceptance score. Latest reported full software checkpoint415 backend/123 frontend passed; final post-edit receipt remains pending. Browser walkthrough supports desktop integration but not a new physical LAN/WAN/HTTPS or current Windows/Linux execution claim. Historical Oct4 WAN-off is retained as dated direct team-confirmed evidence with exact-build/workflow limits.

Scientific literature and competitor descriptions remain context, not automatic product requirements or proof VYUHA equals an operational system. The official desktop OR VR choice alone is N/A. Missing full expert/Elo/trained Fusion, push transport, current physical/platform/performance validation, media and source freshness are concrete remaining quality/release gaps, not silently removed findings.

Independent canonical cross-module rerun:72 passed (269.90 seconds), covering officer authorization, historical dispatch, delayed-response review horizon, shared-role aggregate isolation/limits, What-if immutability and strict clean-database transfer. This strengthens software boundary evidence only, with no physical/human certification.
