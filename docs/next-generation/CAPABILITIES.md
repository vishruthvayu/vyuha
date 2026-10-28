# Generated capability and roadmap index

Source: `server/config/capabilities-v1.json`. Generate with `scripts/check_capabilities.py --write`. This table is implementation status, not a new validation claim.

| Capability | Implementation | Workflow | Source |
|---|---|---|---|
| Versioned deterministic browser/VR training | IMPLEMENTED | `/` | `server/engine.py`, `client/src/sim.worker.ts`, `client/src/TrainingDeck.tsx`, `client/src/training-presentation.ts`, `client/src/Scene.tsx`, `client/src/world/world-lighting.ts`, `client/src/OpticalStation.tsx`, `client/src/optical-station.ts`, `client/src/inquiry-evidence.ts` |
| Server-verified Ghost and immutable replay | IMPLEMENTED | `/?view=aar` | `server/review.py`, `client/src/Ghost.tsx`, `client/src/ReviewTheatre.tsx`, `client/src/review-frame.ts` |
| Request-gated synthetic EO/IR and verified acquisition reconstruction | PARTIAL | `/academy` | `server/acquisition.py`, `server/engine_v3.py`, `server/review_v3.py`, `client/src/sim-v3.ts`, `client/src/AcquisitionStation.tsx`, `client/src/AcquisitionReview.tsx` |
| Role-attributed Crew and reconnection | IMPLEMENTED | `/crew` | `server/crew.py`, `client/src/Crew.tsx` |
| Dispatch-bound Fusion advice receipts | IMPLEMENTED | `/` | `server/fusion.py`, `client/src/action-evidence.ts` |
| Validated transfer and restore | IMPLEMENTED | `/transfer` | `server/portable.py`, `client/src/Transfer.tsx` |
| Shared WebXR action integration | IMPLEMENTED | `/` | `client/src/VRCockpit.tsx`, `client/src/VRWorld.tsx` |
| Opt-in timing diagnostics | PARTIAL | `/system/benchmark` | `client/src/diagnostics.ts`, `client/src/PerformanceDiagnostics.tsx` |
| Source-scoped capability and evidence registry | PARTIAL | `/system/evidence#capabilities` | `server/capabilities.py`, `client/src/CapabilityRegistry.tsx` |
| Competency/task/evidence contracts | PARTIAL | `/academy` | `server/learning.py`, `client/src/LearningEvidence.tsx` |
| Academy and assessed progression | PARTIAL | `/academy` | `client/src/Academy.tsx`, `client/src/AcademyLesson.tsx`, `client/src/academy-journey.ts`, `client/src/academy-journey.css`, `server/config/learning-v1.json`, `server/controlled_study.py`, `client/src/LearnerReflection.tsx`, `server/learning_reflection.py` |
| Coverage-first curriculum Director | PARTIAL | `/academy` | `server/learning.py`, `server/curriculum_diagnostic.py`, `client/src/CurriculumPolicyDiagnostic.tsx` |
| Frozen assessment bank | PARTIAL | `/academy` | `server/learning.py`, `server/config/learning-v1.json`, `client/src/Academy.tsx`, `server/assessment_obligations.py` |
| Controlled retention and transfer protocol | PARTIAL | `/evaluation` | `server/controlled_study.py`, `client/src/ControlledStudy.tsx` |
| Observed assessment opportunity diagnostic pilot | PARTIAL | `/evaluation` | `server/assessment_obligations.py`, `client/src/AssessmentDiagnostics.tsx`, `scripts/check_assessment_obligations.py` |

## Long-term backlog

| ID | Recommendation | Implementation | Checkpoint | Dependencies |
|---|---|---|---|---|
| R01 | Startup, frame and interaction attribution/budgets | PARTIAL | A | Existing baseline |
| R02 | Canonical capability, claim and evidence registry | PARTIAL | A | Existing baseline |
| R03 | Competency/task/evidence contracts | PARTIAL | A | Existing baseline |
| R04 | Controlled learning, retention and transfer pilot | PARTIAL | A | R03, R06 |
| R05 | Academy with fading scaffolds | PARTIAL | A | R03 |
| R06 | Balanced assessment bank and semantic novelty | PARTIAL | A | R03 |
| R07 | Curriculum-aware, testable Director | PARTIAL | A | R03, R06 |
| R08 | Calibrated, abstaining observable-only assistance | PLANNED | B | R03, R06 |
| R09 | Active evidence collection and uncertainty literacy | PARTIAL | B | R03 |
| R10 | Causal AAR with evidence graph and reflection | PARTIAL | B | R03 |
| R11 | Synchronized evidence workspace | PLANNED | B | Existing baseline |
| R12 | Progressive active-session control hierarchy | PLANNED | B | R01 |
| R13 | Accessible/localized input and presentation system | PLANNED | B | Existing baseline |
| R14 | Spatial/timeline scenario authoring with preview | PLANNED | B | R03 |
| R15 | Evidence-rich longitudinal performance reports | PLANNED | B | R03, R06, R10 |
| R16 | Crew communication and readback evidence | PLANNED | B | Existing baseline |
| R17 | Instructor intervention plans and review | PLANNED | B | R10, R14, R16 |
| R18 | Role-rotation and coordination curriculum | PLANNED | B | R03, R16 |
| R19 | Versioned semantic scene packs | PLANNED | C | Existing baseline |
| R20 | Explicit weather/lighting/visibility model | PLANNED | C | R19 |
| R21 | Scalable scene fidelity and transition preparation | PLANNED | C | R01, R19 |
| R22 | Synthetic signal/acoustic learning laboratory | PLANNED | C | R03, R08 |
| R23 | Lawful recording adapters and data provenance | PLANNED | C | Existing baseline |
| R24 | Track ambiguity, association and sensor trust drills | PLANNED | C | R09, R22 |
| R25 | Bounded reactive behavior diversity | PLANNED | C | R06, R19 |
| R26 | Abstract escalation, restraint and resource tradeoffs | PLANNED | C | R03 |
| R27 | Proficiency passport with optional roster identity | PLANNED | C | R03, R06, R15 |
| R28 | Prepared offline deployment kits per platform | PLANNED | C | Existing baseline |
| R29 | Unit readiness/trust and recovery assistant | PLANNED | C | R28 |
| R30 | Optional signed provenance and trust lifecycle | PLANNED | C | R02, R27 |
| R31 | Physical XR acceptance and ergonomic contracts | PLANNED | D | R13, R29 |
| R32 | Input-equivalent XR coaching/interaction modes | PLANNED | D | R05, R31 |
| R33 | Offline learning/log interoperability | PLANNED | D | R02, R03, R23 |
| R34 | Reproducible performance/reliability qualification | PLANNED | D | R01, R28 |
| R35 | Simulation validity and model-card program | PLANNED | D | Existing baseline |
| R36 | Optional offline high-fidelity authoring adapters | PLANNED | D | R19, R23, R35 |
| R37 | Constrained language-to-scenario drafting | PLANNED | D | R14, R35 |
| R38 | Local grounded tutor and reflection dialogue | PLANNED | D | R03, R10, R13 |
| R39 | Consent-aware workload and attention research | PLANNED | D | R04, R13, R31 |
| R40 | Reproducible research/content governance | PLANNED | D | R02, R03, R35 |
| R41 | Authored instructional paths and misconception contracts | PLANNED | Research extension | R03, R05, R06 |
| R42 | Tutor grounding and conformance harness | PLANNED | Research extension | R02, R03, R08, R10, R38 |
| R43 | Assessment obligation monitors and mutation tests | PARTIAL | Research extension | R06, R14, R35 |
| R44 | Observer bookmarks, reflection and disagreement review | PLANNED | Research extension | R10, R16, R17 |
| R45 | Task-level input and accommodation equivalence | PLANNED | Research extension | R13, R31 |
| R46 | Private end-to-end request lineage | PLANNED | Research extension | R01, R29, R34 |
| R47 | Asset-build qualification and semantic fidelity gate | PLANNED | Research extension | R01, R19, R21, R34 |
| R48 | Offline artifact verification and update disposition | PLANNED | Research extension | R02, R28, R30 |


## Connected observation mission milestone

Source `91dfce7`: `/observation-missions` now authors, reconstructs and publishes three frozen information problems. Training provides the full-width Observation Flight Deck; verified Ghost separates original tactical scoring from evidence support; Academy offers mode-separated evidence-gap follow-up. [Exact scope, tests, browser journey and limitations](observation-missions-v1/ACCEPTANCE.md). Overall status remains **PARTIAL**: explicit unclassified Defer, wider product/3D work, independent empirical assessment validation and Crew/XR acquisition remain incomplete.
