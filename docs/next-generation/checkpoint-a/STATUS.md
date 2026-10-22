# Checkpoint A — next-generation implementation

Development branch: `feature/vyuha-next-generation`. Baseline: `5a19fa45391defc2470274554bd68e1fab13faeb`; all 402 historical runtime inputs matched before changes. Fresh baseline: **712 backend /367 frontend passed**, zero failures. Existing Starlette/httpx deprecation warning retained; no dependency update performed.

**Checkpoint A is IN PROGRESS, not accepted.** All R01–R40 remain in the canonical backlog. Protected releases and prior integration branches are unchanged. No human learning gain or physical headset/platform/network acceptance is claimed.

| Recommendation | Implementation and actual interface | Validation / remaining work |
|---|---|---|
| R01 | Opt-in bounded local timings in real renderer/worker paths; startup/optics/training phase separation, tail statistics, long-frame/script/layout/resource/interaction observers where supported, source-bound JSON export. Available in Training and Device benchmark; explicit first-load link. No identities/actions/input text/URLs/hidden truth collected or uploaded. | Six timing regressions including hidden-frame exclusion and throttled timer bounds; final foundation frontend pass: 374. Actual capture/performance attribution and matched optimization evidence still required. Not a GPU/headset FPS measure. |
| R02 | Canonical source/evidence catalog and all forty roadmap entries; public API, generated Markdown/checker, source-hash freshness, immutable proof-file hashes, physical evidence requirements, evidence UI and compliance link. Old release reports are explicitly archived; no promotion of prior passes to changed source. | 18 new backend checks within 46 passing targeted backend tests; new DOM/axe semantics checks. First integrated frontend run: 372 passed; targeted corrected invocation: 19 passed. Full foundation backend: 730 passed in 391.54 s; frontend after browser-discovered corrections: 374 passed. Registry desktop/mobile and keyboard scroll verified at CSS scale 1; see evidence/browser-foundation.md. |
| R03 | Design/integration work in progress: competency evidence will be derived from verified decisions and explicit session intent. | Must preserve historical scores and avoid individual credit from Academy practice or Crew. No new capability is marked implemented. |
| R04 | Existing informal evaluation remains available. | Controlled allocation, frozen protocol, balanced/delayed/transfer infrastructure and synthetic protocol tests still to implement. Actual participants/efficacy remain external. |
| R05 | Existing guided drill and Rapid ID preserved. | Academy vertical slice, fading guidance and verified practice isolation still to implement. |
| R06 | Existing seeded scenario/raid generation preserved. | Versioned bank, distinct practice/assessment pools and semantic novelty/coverage checks still to implement. |
| R07 | Existing Director v2.1 preserved. | Coverage-aware successor and frozen policy snapshots still to implement. Fitted alternatives await suitable consented data. |

## Foundation source changes

- `client/src/diagnostics.ts`, `PerformanceDiagnostics.tsx`: bounded local collector and export controls; source, frame-tail and scope disclosure.
- `Scene.tsx`, `App.tsx`, `Benchmark.tsx`, `main.tsx`, `vite.config.ts`: opt-in instrumentation connected to actual runtime, with build fingerprint and dirty-source disclosure.
- `server/capabilities.py`, `server/config/capabilities-v1.json`, `scripts/check_capabilities.py`: one implementation/backlog catalog with separate hashed receipt bindings under `docs/next-generation/validation.json`.
- `CapabilityRegistry.tsx`, `Evidence.tsx`, `Compliance.tsx`, additive `next-generation.css`: current evidence view, keyboard-scrollable table and explicitly archived historical wording; premium import order retained.
- Backend negative/provenance tests, frontend timing/axe tests and CI registry check.

## Evidence handling and known limitations

Baseline logs are receipts for the baseline source hash. Implementation immediately makes them historical; the registry reports that honestly. Foundation logs are intermediate validation, not Checkpoint A acceptance or a release seal. The root-directory TSX invocation of accessibility tests used the wrong JSX configuration and failed before running the UI; the corrected client-directory invocation passed and both logs are retained.

No authoritative engine, sensor truth, score formula, historical fixture, Crew role or Fusion ownership rule has been changed in this foundation slice. No new release or tag. Existing test totals do not close performance, physical or learning-validity gates.

Next executable work: verify the corrected export in browser, then implement R03/R06 contracts and persisted session intent before Academy and curriculum Director integration. Keep a continuously runnable build and run all required final-source checks before declaring Checkpoint A accepted.
