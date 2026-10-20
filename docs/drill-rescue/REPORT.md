# Drill rescue — source-scoped handoff

The inherited world/aircraft/workflow implementation is preserved. This continuation
reproduced and fixed request-feedback races, accessibility failures and actual phone
layout defects, and collected acceptance evidence against a frozen production build.
This is an integration handoff, not a release candidate or final human visual approval.

## Source

| Item | Exact reference |
|---|---|
| Common integration base | `db0ff23a67692d3db5dce07a031d17ea50a409b3` |
| Drill branch | `feature/vyuha-drill-experience-rescue` |
| Tested runtime freeze | `5d40a24165dff5ace27c6131318da599ad828b0d` |
| Surrounding-platform hardening branch | `feature/vyuha-final-hardening` at `8fba805e8a3355ac34ea329e232eb0e4ec9dcd20` |
| Combined source / release candidate | Not created; retained by main Codex |

Later evidence/tooling commits retain the runtime hashes in
[validation/SOURCE-INVENTORY.json](validation/SOURCE-INVENTORY.json). The final pushed
branch SHA is supplied with the handoff and can be verified using `git ls-remote`.
Protected releases were not rewritten or deleted. No force push or integration merge.

## Product changes

**World and aircraft, inherited and retained:** distinct urban/rural layouts,
original modular buildings/hangars/towers/fencing/HESCO and technical props, local
PBR ground/materials, day/night skies and facility lighting, terrain relief outside
the authoritative sensor clearing, and bounded illustrative thermal/IR presentation.
Original multirotor, fixed-wing and bird geometry use LOD/instancing and motion from
observed paths. A shared generic multirotor avoids encoding hidden affiliation or
control method. Decorative scenery produces an explicitly hollow behind-scenery
marker rather than inventing new sensor occlusion or painting an aircraft on a wall.

**Camera and evidence:** the observed-pose buffer interpolates bounded samples;
camera/airframe follow the displayed observation, hold the last bearing on loss and
preserve context across sensor switches. Inspection is gated by observed shape and
sensor pixels on target. Responsive inset painting clears the phone's main reticle
without increasing eligible detail. Live zoom captures do not freeze simulation time.

**Guided decisions:** Select → Designate → Classify → Respond → Outcome; descriptive
choices, no preselected answer, visible public evidence/resources/reach, optional
process guidance, and outcomes from public response state. The continuation adds
request-correlated worker receipts and explicit pause/end rejection. Transport IDs
never enter authoritative action records. Accepted keyboard decisions move focus to
a labelled next-step group; pointer/external focus is preserved.

**Phone and review corrections:** footer height now exposes fog and real 2D fallback;
range/unit stay together; preparation disclosure no longer collides with live camera
captions; wrapped stale reports retain their own row height. AAR event buttons keep
their full visible text in accessible names. Keyboard focus clears the sticky header.

No new npm library, runtime service, external font or remote decoder was added. The
server tree remains identical to the integration base. Scoring, sensors, schemas,
authentication, authorization and historical references were not changed here.

## Research and assets

[RESEARCH-AND-ASSET-SELECTION.md](RESEARCH-AND-ASSET-SELECTION.md) preserves the original
developer's inspected sources, API records, unavailable resources and rejected
alternatives. Selected sources include Poly Haven materials/skies/props and official
Three.js/R3F performance and glTF tooling references. Aircraft and architecture are
original. Other asset libraries were not bundled without suitable fit and rights.
This takeover checked the implementation and ledger rather than claiming a new asset
research campaign. The surrounding-platform design research remains on the hardening
branch; this track did not introduce a competing shell or palette.

[ASSET-PROVENANCE.md](ASSET-PROVENANCE.md), `art/ledger/` and the regeneration scripts
record sources, creators, licences and processing. All external runtime world assets
are CC0 derivatives; original geometry/atlases are repository-generated. Poly Haven
and font notices ship locally. Current world resources: **41 files, 2,716,920 bytes**.
Production dist: **4,773,790 bytes**, 72 offline URLs. The lazy Scene chunk is still
~1.06 MB minified (~300 kB gzip), with Vite's existing size warning retained.

## Verification

- Full frontend: **328 passed, 0 failed**, including Python/TypeScript parity,
  hidden-truth, observation, airframe, guided workflow, actual-worker receipt/order
  isolation and mounted App/focus regressions.
- ESLint, configured formatting, explicit world formatting and production build pass.
- Separate GitHub checkout: fresh `npm ci`, 328 tests, lint, format, build; all 72
  production files byte-identical to the served build. Git objects were reused with
  `--reference --dissociate`; node_modules and dist were built independently.
  Local parity used the existing requirements-pinned Python 3.14 environment.
- Exact frozen-source [GitHub run 39013253493](https://github.com/vishruthvayu/vyuha-sih26247/actions/runs/39013253493)
  passes: **699 backend tests** (one dependency warning), 328 frontend/parity, lint,
  format, production build and Docker. Fresh Python 3.12 dependencies install on the
  hosted runner. See [hosted summary](validation/hosted-summary.txt) and
  [step/source receipt](validation/github-frozen.json).
- Two frozen-source real-browser drills save independently scored AARs. Desktop
  records kinetic neutralisation; phone records an accepted attempt with no
  observable effect. 22 axe states (11 per width), 0 violations, no JavaScript runtime
  exceptions or contact-row/document overflow in those state receipts.
- Eight responsive widths pass footer hit-testing and actual 2D/3D recovery clicks.
  Labelled synthetic wrapped-roster checks pass at all eight; independent review
  additionally confirms the actual stale contact after neutralisation.
- The current service-worker cache contains 72 expected URLs, 0 missing; cached shell
  and renderer reload in CDP offline mode. This does not certify physical WAN-off.

[ACCEPTANCE.md](ACCEPTANCE.md) explains keyboard/accessibility scope and the retained
Canvas2D warnings/transient AAR 409 entries. [AUDIT-TAKEOVER.md](AUDIT-TAKEOVER.md)
records ten reproduced findings and independent reviews. The historical 211 statuses
remain 93 verified/71 partial/29 deferred/17 external/1 N/A, with no bulk recertification.

The [current 36-cell graphics matrix and four repeat cells](BENCHMARK.md)
are complete: application medians are 60 FPS, with three retained long-frame cells
(worst 216.7 ms). The 180-second run and 12-cycle soak are complete; counts/endpoints and bounded
interaction timings are recorded there. These are not proof of leak-free or
glitch-free operation. Earlier M6 NVIDIA/idle-Intel matrices remain historical; they are
not final-source measurements, M1 acceptance or evidence of no performance tradeoff.

## Actual screenshots

All are real production-browser captures. Guided views use synthetic server sessions;
world views are explicitly synthetic benchmark scenes. The baseline is db0ff23;
current views use the frozen runtime bytes. These are qualitative comparisons, not
identical-track scientific A/B trials.

| State | Evidence |
|---|---|
| Baseline workstation / primitive world | [Before](screenshots/baseline/02-active-day-workstation.webp) |
| Preparation | [Desktop](screenshots/acceptance/1440/01-preparation.png), [phone](screenshots/acceptance/390/01-preparation.png) |
| Active base / day / EO | [Current](screenshots/acceptance/1440/09-eo.png) |
| Rural environment | [Current](screenshots/acceptance/world/rural_forward_base-day-day-trainee-25-4-medium.png) |
| Night EO | [Current](screenshots/acceptance/world/urban_outpost-night-day-trainee-25-4-medium.png) |
| Night thermal | [Current](screenshots/acceptance/world/rural_forward_base-night-thermal-trainee-25-4-medium.png) |
| IR night display | [Current](screenshots/acceptance/world/urban_outpost-night-night-trainee-25-4-medium.png) |
| Multirotor close-up | [1×](screenshots/acceptance/390/closeup-1-1x.png), [6×](screenshots/acceptance/390/closeup-1-6x.png), [thermal](screenshots/acceptance/390/closeup-1-thermal-6x.png) |
| Fixed-wing inspection | [1×](screenshots/acceptance/fixedwing/closeup-0-1x.png), [6×](screenshots/acceptance/fixedwing/closeup-0-6x.png), [thermal](screenshots/acceptance/fixedwing/closeup-0-thermal-6x.png) — labelled synthetic v2 QA scenario; public observed Shape checked |
| Multiple contacts | [200-contact reference overview](screenshots/acceptance/world/urban_outpost-day-day-overview-200-4-medium.png) |
| Contact/radar selection | [Current](screenshots/acceptance/1440/11-selection.png) |
| Accepted designation | [Current](screenshots/acceptance/1440/12-designated.png) |
| Classification | [Desktop](screenshots/acceptance/1440/13-classification.png), [phone](screenshots/acceptance/390/13-classification.png) |
| Response choices | [Desktop](screenshots/acceptance/1440/14-response-choices.png), [phone](screenshots/acceptance/390/14-response-choices.png) |
| Response acknowledgment/outcome | [Current](screenshots/acceptance/1440/15-response-feedback.png) |
| Completion/server scoring | [Current](screenshots/acceptance/1440/16-completed.png) |
| AAR transition/reference replay | [Overview](screenshots/acceptance/1440/17-aar-overview.png), [observer](screenshots/acceptance/1440/17-aar-observer.png), [follow](screenshots/acceptance/1440/17-aar-follow.png), [phone](screenshots/acceptance/390/17-aar-replay.png) |

## Remaining acceptance and integration

[INTEGRATION.md](INTEGRATION.md) gives exact inputs, shared paths/contracts and checks.
Only CI workflow and Ghost overlap with the hardening track. Preserve hardening's
filtered/incremental timeline and drill's native accessible labels together. Merge
App and the worker protocol together, then retest the actual combined application.

The result is more credible than the baseline, but it is not photorealistic. Distant
urban massing/repetitive windows, flat in-range terrain, clean road edges and sparse
faceted hills and sensor-adjacent masts filling some zoomed bearings remain artistic
limitations. Automatic quality policy and AAR framing
remain unchanged product choices. Still-image approval does not prove motion quality.

Private original 18/22-session databases were unavailable. Physical M1, Windows,
Android, separate-device LAN HTTPS/WAN-off, full screen-reader review and empirical
thermal/training validation remain pending. Linux software/headless GPU checks do
not replace a physical end-user walkthrough. Main Codex must run full merged-source
acceptance and obtain direct user visual approval before preparing a candidate.
