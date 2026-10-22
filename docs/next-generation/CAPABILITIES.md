# Generated capability and roadmap index

Source: `server/config/capabilities-v1.json`. Generate with `scripts/check_capabilities.py --write`. This table is implementation status, not a new validation claim.

| Capability | Implementation | Workflow | Source |
|---|---|---|---|
| Versioned deterministic browser/VR training | IMPLEMENTED | `/` | `server/engine.py`, `client/src/sim.worker.ts` |
| Server-verified Ghost and immutable replay | IMPLEMENTED | `/?view=aar` | `server/review.py`, `client/src/Ghost.tsx` |
| Role-attributed Crew and reconnection | IMPLEMENTED | `/crew` | `server/crew.py`, `client/src/Crew.tsx` |
| Dispatch-bound Fusion advice receipts | IMPLEMENTED | `/` | `server/fusion.py`, `client/src/action-evidence.ts` |
| Validated transfer and restore | IMPLEMENTED | `/transfer` | `server/portable.py`, `client/src/Transfer.tsx` |
| Shared WebXR action integration | IMPLEMENTED | `/` | `client/src/VRCockpit.tsx`, `client/src/VRWorld.tsx` |
| Opt-in timing diagnostics | PARTIAL | `/system/benchmark` | `client/src/diagnostics.ts`, `client/src/PerformanceDiagnostics.tsx` |
| Source-scoped capability and evidence registry | PARTIAL | `/system/evidence#capabilities` | `server/capabilities.py`, `client/src/CapabilityRegistry.tsx` |
| Competency/task/evidence contracts | PLANNED | `/academy` | `server/learning.py` |
| Academy and assessed progression | PLANNED | `/academy` | `client/src/Academy.tsx` |

## Long-term backlog

| ID | Recommendation | Implementation | Checkpoint | Dependencies |
|---|---|---|---|---|
| R01 | Startup, frame and interaction attribution/budgets | PARTIAL | A | Existing baseline |
| R02 | Canonical capability, claim and evidence registry | PARTIAL | A | Existing baseline |
| R03 | Competency/task/evidence contracts | PLANNED | A | Existing baseline |
| R04 | Controlled learning, retention and transfer pilot | PLANNED | A | R03, R06 |
| R05 | Academy with fading scaffolds | PLANNED | A | R03 |
| R06 | Balanced assessment bank and semantic novelty | PLANNED | A | R03 |
| R07 | Curriculum-aware, testable Director | PLANNED | A | R03, R06 |
| R08 | Calibrated, abstaining observable-only assistance | PLANNED | B | R03, R06 |
| R09 | Active evidence collection and uncertainty literacy | PLANNED | B | R03 |
| R10 | Causal AAR with evidence graph and reflection | PLANNED | B | R03 |
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
