# Checkpoint A — integrated curriculum slice

This is a development milestone on `feature/vyuha-next-generation`, not acceptance of Checkpoint A or a release. R01–R40 remain the long-term backlog. The canonical status is `server/config/capabilities-v1.json`; research documents remain historical proposals.

## What actually works

`/academy` uses the existing joined trainee identity. It offers ten individual practice items (five competencies × full/faded scaffolding), four separate assessment forms with ten items each, a coverage-first practice selector, and a read-only assessment coverage table. Two Crew contract placeholders are disclosed as future role curriculum; they cannot launch as individual lessons. Fifty individual bank entries are not fifty empirically validated courses or fifty unique physical worlds.

A preparation freezes the catalog hash, item, mode, assistance, seed and selection snapshot. The existing 3D trainee workstation launches the exact compiled scenario through the normal session API and accepted worker action path. Academy settings are frozen; classification still requires explicit choices. Assessment disables guided hints and uses the existing engine-recognized Fusion assessment configuration. No authoritative simulation, sensor, scoring formula or historical scorecard was rewritten.

The original server reconstructs completed decisions. Ghost adds a competency panel with original decision IDs, ticks, source-review hash and the frozen selection. Ground-truth-only expectations become **unassessable** for this new competency ledger. Evidence is scenario-bound; it is not calibrated mastery, readiness or certification. Summaries use one vote per contact/competency/session; observable errors survive later corrections. Full linear observations remain traceable.

Practice/adaptive practice is retained for reflection but never writes the individual four-skill outcome ledger or assessment coverage. Crew remains excluded from individual learning. Local drafts preserve the preparation across recovery. Portable bundles carry an optional strict learning context; import recompiles its scenario, reconstructs evidence, preserves practice isolation and rejects conflicting duplicates or tampering. Legacy bundles omit the field and retain their historical semantics. Database backup/restore includes the additional tables.

The existing `/evaluation` route now also contains an officer-protected **controlled protocol infrastructure** panel. A frozen protocol records a prespecified question, target competency, intended pilot capacity, seed, form schedule, primary/secondary observations and limitations. Seeded blocks balance full/faded scaffolding. Consent confirmation is required. Server-enforced ordering, three practice blocks, a 24-hour retention interval and a 54-second observed exposure minimum prevent casual early-end advancement. Early ends remain recorded and ineligible. Missing outcomes stay missing. No people were enrolled through browser QA and no human efficacy study has been conducted.

## Source map

| Module | Responsibility |
|---|---|
| `server/learning.py`, `server/config/learning-v1.json` | Frozen competency, task-bank, preparation, coverage and deterministic curriculum selection contracts |
| `server/main.py`, `server/models.py`, `server/storage.py`, `server/director.py` | Session attachment/completion, schema migration and practice exclusion from the original profile |
| `server/portable.py` | Strict optional learning context, reconstruction and duplicate protection |
| `server/controlled_study.py` | Officer-only frozen protocols, consent, balanced allocation, phase/exposure/retention gates and missing-data export |
| `client/src/Academy.tsx`, `learning.ts`, `LearningEvidence.tsx` | Actual learner lesson selection, preparation, coverage and Ghost evidence presentation |
| `client/src/App.tsx`, `DrillSetup.tsx`, `Director.tsx`, `GuidedDecision.tsx`, `storage.ts` | Existing workstation launch, fixed curriculum context, assistance constraints and draft recovery |
| `client/src/Unit.tsx`, `main.tsx`, `routes.ts`, `RoutePages.tsx` | Identity setup, discoverable Academy route and protected evaluation integration |
| `client/src/ControlledStudy.tsx`, `Evaluation.tsx`, additive `next-generation.css` | Registered protocol UI within the existing product; premium import order retained |
| `server/tests/test_learning.py`, `test_controlled_study.py`, `learning_fixtures.py` | Isolation, idempotency, provenance, semantic blueprint checks, transfer, reference immutability and protocol negative cases |
| `client/src/learning-parity.test.ts`, `accessibility.test.tsx`, `review-app-lifetime.test.tsx` | 50-item/300-checkpoint engine parity, DOM/axe checks, real App ticket/draft/assistance orchestration |

## Honest limits and remaining A work

| Recommendation | Current slice | Remaining acceptance |
|---|---|---|
| R01 | Bounded local renderer/worker/observer timings, source-bound export and tail distributions. Browser-discovered encoding, phase and throttled-timer issues fixed. | Matched cold/warm retained 8/50/200 and optics trials; dominant-cost attribution; measured optimization and enforceable budgets. No improvement number yet. |
| R02 | Canonical all-40 source/status registry, generated index/checker, historical receipt freshness and current UI with archived old reports. | Complete claim/manifest/compliance projections and current-source per-capability receipt bindings. Passing tests do not automatically change implementation status. |
| R03 | Five individual contracts, Crew placeholder, persisted intent and verified observation projection integrated into Ghost and transfer. | Wider task/content review, model limitations, role curriculum (R18), appropriate external SME/validity review. Conservative unassessable coverage is intentional. |
| R04 | Frozen full/faded scaffolding pilot infrastructure, consent, balanced blocks, delayed/transfer forms, ordered dose gates and missing outcomes. | Dropout/withdrawal disposition, fuller preregistered analysis/exclusion plan and the proposed baseline-versus-curriculum comparison. Real participants, organizational review, sample-size planning, calibration and efficacy remain unavailable. |
| R05 | Integrated focused lesson → full/faded guidance → accepted trainee decisions → original-server evidence → Ghost reflection. | More task-specific teaching content, persisted structured reflection and coverage-driven lesson advancement; usability/pilot review. |
| R06 | Frozen practice/assessment separation; assessment blueprint structure matched on duration, counts, mix and difficulty; four semantically distinct form sets; 50-item parity. | Empirical difficulty/fairness, wider seed/solvability checks and semantic novelty under learner history. Some items intentionally share task blueprints. Structural balance does not prove equal difficulty. |
| R07 | Inspectable coverage-first heuristic, recent-item avoidance and immutable candidate/coverage snapshots. Existing Director v2.1 preserved. | Benchmark against explicit alternative policies and broader seed/history tests. Fitted models require suitable consented data; no learning advantage established. |

Controlled participant consent/allocation data is not silently copied by ordinary training transfer. It remains in the original server database and its backup; exported study reports are separate. Local trainee callsigns remain a trusted-LAN prototype identity, not secure exam authentication or participant identity verification. No certification, recruitment or contact with people is authorized or implied.

New physical platform/LAN/headset acceptance is not claimed. Native Windows/Linux/Android, trusted LAN HTTPS, WAN-disconnected operation and physical XR performance require source-specific external receipts. Protected releases and main remain unchanged; no tag or release candidate created.
