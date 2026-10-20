# Combined acceptance and final experience polish

Recorded on 19 October 2026 (India time). This is software acceptance for owner review, not a release or physical platform certification. No release candidate or stable tag was created.

## Source and preservation

The integrated runtime is `126aab44a83fec76b782d5a6acbec9b8dc454bce` on `integration/vyuha-combined-acceptance`. Its policy-v2 source hash is `665de9611cdd96f9316b2889326f7711efa56033bd16b6b6fcffca93d72da13d` (390 inputs). Later evidence-only commits do not change that runtime. See [source inputs](polish/review-source.json) and [evidence manifest](manifest.json).

Normal Git merges preserve all developers' history:

| Input / milestone | Commit | Treatment |
|---|---|---|
| Original integration base | `db0ff23a67692d3db5dce07a031d17ea50a409b3` | Preserved in original checkout |
| Drill experience | `ef130686d0ccce9d6e4245dec0ca5a97a2a047b5` | Normal merge `9baeb04` |
| Engineering hardening | `8fba805e8a3355ac34ea329e232eb0e4ec9dcd20` | Normal merge `17c48ab` |
| Previously accepted combined source | `e07fb6a07916ad4f0fa48e88a484534b040decfa` | Preserved as earlier evidence |
| Final experience polish | `805de4b73d28a3f9d693420ee76f6919ba10560c` | Four commits inspected; normal merge `191867385dfbb3838bb0cf7a667bd38d65b27ac0` |
| Degraded radar badge contrast | `95c2fe97af04391dd6e59a825d1ccb7aef2f33e1` | Scoped existing amber color; browser contrast recheck |
| 900-pixel desktop clipping | `126aab44a83fec76b782d5a6acbec9b8dc454bce` | Existing scrolling rule extended through 999px screen height |

The original checkout remains at the integration base with its five existing dirty files intact. Its binary diff was compared with the pre-integration recovery patch. Neither original user databases nor credentials were replaced. Browser writes used a separate synthetic QA database. `release/v1.0.1`, `v1.0.1`, `v1.1.0-rc.1` and `v1.1.0-rc.2` retain their original Git objects. The package's inherited version string is not a release tag or approval.

The CI ordering still builds production assets before backend startup tests. App/worker correlated action receipts, hardening's premium import order and the searchable incremental AAR timeline remain. Native event labels retain their complete accessible text. See [original merge contracts](original/merge-contracts.json) and [current contracts](polish/contracts.json).

## Implemented polish

| Change | Source | Evidence |
|---|---|---|
| Reserved decision stages, inert inactive controls, fixed resource scrollports | `GuidedDecision.tsx`, `premium/training.css` | [Developer handoff](../final-experience/HANDOFF.md), live merged flows and viewport receipts |
| Sensor inset refresh capped at 30Hz; main view stays at display cadence | `InspectionPass.tsx`, `render-work.ts` | Cadence/invalidation tests; unchanged sensor resolution and 4x supersampling |
| Upload populated instance matrices; reuse contact set; update scene graph once | `ContactRenderer.tsx`, `Scene.tsx` | Render-work tests, parity and browser measurements |
| EO-only foundation shading, no thermal decoration, omitted on Low | `world/contact-shading.ts`, `world/Environment.tsx` | Shading tests and actual world screenshots |
| Readable degraded status | `premium/training.css` | Before: 4.27:1; after: no detected violations in scoped desktop/mobile axe checks |
| Usable 1440×900 layout | `premium/training.css` | Before: reserved content extended below clipped decision panel; after: page scroll preserves 405px optics and full 380.5px decision panel |

No scoring, observation, threat-motion, worker dispatch or authoritative backend changes were introduced by this polish. Static decoration does not expose hidden contacts.

## Final-source regression

| Check | Final runtime result | Evidence |
|---|---|---|
| Backend and startup | **708 passed**, zero failures, one existing Starlette deprecation; hosted run 397.77s | [Exact-commit GitHub run](https://github.com/vishruthvayu/vyuha-sih26247/actions/runs/39158677787), [receipt](polish/review-hosted-ci.json) |
| Frontend and Python/TypeScript parity | **347 passed**, zero failures/skips/cancellations; local 197800.33ms | [Local log](polish/review-frontend.log), same exact-commit CI |
| Lint / formatting / production build | PASS; **72 local assets**, cache `7e25b3065710` | [Build](polish/review-build.log), [lint](polish/review-lint.log), [format](polish/review-format.log) |
| Historical scoring | **18 baseline + 22 stored historical cards preserved**, exact immutable digests; current 26 completed histories readable | [18 receipt](polish/review-history-private/history18.json), [22 receipt](polish/review-history-private/receipt.json) |
| HTTPS/security/Transfer/Restore | PASS, scoped; **144 negative auth requests**, all 401; duplicate import, tamper rejection, archive completeness, backup/restore equality | [Final-source receipt](polish/review-https-quiet/receipt.json) |
| Docker | Exact-commit CI PASS; local image `vyuha:combined-126aab4`; health/root 200, anonymous Instructor 401 | [Runtime receipt](polish/review-docker-runtime.json), [CI](polish/review-hosted-ci.json) |
| Independent clean clone | **347 passed**, zero failures/skips/cancellations; lint/format/build PASS; **72/72 assets byte-identical**. [Receipt](polish/review-clean-clone.json), [test log](polish/serial-clean-frontend.log) | Checkout fetched normally from GitHub; original clone dependencies were reinstalled with temporary npm cache |

The local backend run also reached 708 passed in 1008.23s under concurrent load, but a CSS checkpoint landed during that run. Its output is retained outside Git as diagnostic evidence; the final-source backend acceptance above comes from the clean hosted checkout of `126aab4`. Earlier 95c2fe9 hosted 708/347 and all prior original results retain their own source scope. An interrupted clone run cancelled one parity worker; it is not counted as a pass. Final clean-clone checks are repeated serially with reduced test concurrency. Several HTTPS harness attempts exceeded the original 10-second receiver-readiness window under host load; a diagnostic rerun allowed 30 seconds for readiness and logged retries, retaining every authorization, TLS, tamper and equality assertion. No certificate verification or product authentication was bypassed.

The complete frontend suite includes the original command/action parity, 12 Director templates, 15 tactic/pack combinations, 544 Finale checkpoints, 288 response/sensor/action checkpoints, 54 rural checkpoints, eight procedural raid families and 1920 sensor/clutter checkpoints. These are different overlapping test groups; they are not added into an invented single coverage total.

Security, Crew role isolation/expiry/revocation/history, Fusion persistence, reference/What-If immutability, Recorded Practice, offline transport and scoring are covered by the full suites. A green suite is not a claim of empirical simulation calibration or universal UI acceptance.

## Actual browser acceptance

All new browser evidence uses Codex in-app Chromium on this Mac, real production JS/CSS and isolated synthetic sessions. Ports 8089/8092 added visible local QA instrumentation to HTML only; port 8088 serves the unmodified product. No React state, hidden contacts or accepted decisions were injected through the browser.

| Workflow | Outcome / scope |
|---|---|
| Urban live drill | T2 selected, designated, classified, held; three correlated accepted actions; independently server-verified completion. [Final runtime receipt](polish/final-live-flow.json) |
| Optics | Day TV, thermal, night display, tracking and terrain rendered; missing optical evidence remained labelled as unavailable |
| 1440×900 decision flow | Designate → classify → respond → outcome → pause → guidance off retained fixed optics/panel/body sizes. One sampled response position varied by 1.32px; do not describe this merged run as zero drift |
| Mobile | 390px CSS width at scale 1; radar and decision controls reachable by scrolling; contrast fix rechecked on populated classification state |
| Instructor | Actual UI sign-in, radar failure reached APPLIED at T+1.77s; restore and teaching-pause commands accepted; White Cell displayed session-scoped evidence |
| Ghost AAR | Server-verified result, observed interval, native replay labels and filtered timeline; T2 plus trainee-action filter showed exactly three of fourteen events |
| Analytics | Protected before sign-in; persisted comparison rendered desktop/mobile with uncertainty/causation limits retained; mobile rendered axe reported zero violations |
| Crew history | Persisted WATCH/spotter designation and RESPONSE/responder classification/response remained attributed. At 390px, the history region accepted ArrowRight, and Tab moved to the AAR link |
| Real process outage | Own controlled server stopped and health became unreachable; three browser decisions queued; three actions and three Fusion receipts synchronized after restart; completion and Ghost server verified |
| Transfer/Restore | Actual trusted-context loopback HTTPS: 7 populated sessions, 12 Fusion receipts, 2 notes, signed import/export, duplicate/tamper protection and full logical restore equality |

The outage run belongs to `95c2fe9`; the only later runtime edit is the short-screen CSS breakpoint. Final-source automated transport suites and HTTPS/Transfer were repeated. This is not relabelled as a fresh physical network test. See [recovery receipt](polish/fusion-outage-recovery.json).

The earlier `e07fb6a` hosted run passed 708 backend and 343 frontend tests. Its local backend run recorded 705 passed and 3 LAN-address-dependent skips; a separate 13-test startup rerun then passed all cases, including those three. All original outputs remain preserved; the local first run is not rewritten as 708. The original clean clone built 72 identical assets.

The original evidence package also retains rural response, Crew live actions, What-If/evidence-only reference immutability, browser archive duplicate import and original M1 measurements. [Original source provenance](original/accepted-source.json), [browser Crew receipt](original/crew-browser.json), [hypothetical immutability](original/hypothetical-immutability.json). Those receipts explicitly belong to their recorded earlier commits, not to a later runtime.

## Performance

Hardware: the available Apple M1 MacBook Air, 8 GiB RAM, macOS 27.0.1; Codex in-app Chromium 155. The compatibility user-agent string says Intel Mac and is not used to infer hardware. CSS viewport 1440×900, scale 1; benchmark backing canvas 1353×400 (CSS width 1353.609px). Fixed Medium, auto quality off, urban/day/trainee view. Tests and builds were not run concurrently with these graphics measurements; other user applications and the idle Docker VM remained.

| M1 workload | Measured result | Retained limits |
|---|---|---|
| First 8-contact plain-product 20s check | **60 FPS median**, p95 worker tick 0.2ms | First FPS sample **31**; not a fresh OS/profile/shader-cache experiment |
| 200 contacts, plain-product 180s | **60 FPS median**, 178 FPS samples; worker tick **5399/5400**, p95 tick **1.0ms** | Minimum FPS sample **49**, one sample below 50; bounded stall handling retained |
| 200 contacts, QA-instrumented first 30s | rAF p50 **16.7ms**, p95 **17.6ms**, p99 **17.7ms** | One **283.3ms** interval; page rAF timing, not GPU or physical input/display latency |
| Live daylight T2 close-up, QA 30s | rAF p50 **16.7ms**, p95/p99 **17.7ms**; actual modeled aircraft visible in the sensor-limited inset | One **1249ms** interval near second 28. This run crossed natural exercise completion into AAR; it is not a steady close-up GPU benchmark |

[Raw 8-contact samples](polish/screenshots/m1-8-medium-first-20s.json), [180-second samples](polish/screenshots/m1-200-medium-180s.json), [frame intervals](polish/screenshots/m1-200-first30-intervals.json), [live close-up intervals](polish/screenshots/m1-live-closeup-intervals.json). The 180s browser-reported main-page heap ranged from 69,587,577 to 145,228,866 bytes, starting at 104,394,966 and ending at 134,874,959. This excludes Worker/GPU/total process memory and does not establish leak-free operation.

The prior plain-product `e07fb6a` 200-contact 180s run also measured **60 FPS median**, p95 worker tick 1.5ms and tick 5371. Earlier `628c1ce` 8-contact measurements had a 58 FPS median with substantial startup stalls; 25–200 contacts reached 60. These are bounded runs with different host/cache conditions, not a controlled causal comparison. No FPS improvement, eliminated startup stalls, GPU reduction on M1, zero memory growth or low-end-device certification is claimed.

The polish developer's [Linux Intel/Mesa report](../final-experience/PERFORMANCE.md) reports close-up GPU work reductions of 27.5% thermal and 26.4% daylight. Those are that host's repeated diagnostic results, not new M1 GPU measurements. Renderer source hashes remain unchanged; the maintainer's later changes are CSS only.

The prior 200-contact server reconstruction median was 9.79s over three actual HTTP samples at `628c1ce`. No server code changed in this polish, and no new reconstruction speedup is claimed. [Earlier raw reconstruction receipt](original/reconstruction-final/report.json).

## Evidence and remaining gates

| Gate | Status | Meaning |
|---|---|---|
| Normal integration / protected refs / owner WIP | PASS | Separate combined branch; no force-push or fallback changes |
| Exact-source full software regression | PASS | 708 backend + 347 frontend/parity; exact runtime pinned above |
| Historical 18 + 22 scorecards | PASS | Exact immutable digests preserved; original production DB opened read-only and online-backed-up |
| Responsive/functional checks | PASS, scoped | Actual covered states and raw screenshots; screen-reader and arbitrary zoom certification not asserted |
| M1 performance | MEASURED, bounded | Raw samples retained; not hardware certification |
| Owner review / approval | PENDING, mandatory before RC | Review polished live application |
| Final-candidate Windows / Linux / Android | PENDING | Historical Arch/phone evidence belongs to previous sources; CI/container results do not certify native devices |
| Separate-device LAN HTTPS / trust / WAN-off | PENDING for this candidate | Loopback TLS context is not physical LAN or browser certificate acceptance |
| Empirical efficacy / calibrated military realism | NOT ESTABLISHED | Illustrative training models and heuristic assistance remain labelled |

Known limits: rare startup/long frames; automatic rendering may fall back under contention; sensor uncertainty can remove current eligibility; overlapping radar markers can require roster/keyboard selection; no complete screen-reader/manual WCAG certification. The earlier browser Transfer operation's global status verified integrity while its file card retained “verification pending”; this cosmetic inconsistency is recorded rather than silently claimed fixed. Existing large-chunk and Starlette deprecation advisories remain. The broader audit inventory is preserved; no new independent numeric audit score is invented here.

Physical multi-device LAN training was validated historically. Runtime assets and services are hosted locally; this combined candidate's dedicated physical acceptance remains pending. Training requires no cloud service by design. Nothing in these software results establishes a fresh WAN-off pass.

## Personal review

The running plain product is [http://127.0.0.1:8088](http://127.0.0.1:8088). It uses isolated QA data, not the original user database.

To restart this exact prepared review environment:

```sh
bash "/Users/seemalanaveenyadav/Desktop/SIH/vyuha/work/finale/ultimate-experience/combined-polish-acceptance-20261019/run-review.sh"
```

Stop the existing listener first with Ctrl-C in its owning terminal if necessary. The script runs the existing virtual environment and production build; it does not install software or rewrite user data. The disposable officer review credential is stored locally in that evidence folder's private directory and is excluded from Git and this report.

For a separate fresh checkout, use `bash scripts/start-local.sh --port 8088` from the repository root; first setup requires dependencies and officer provisioning. Use the documented Unit Mode / trusted HTTPS runbook for physical acceptance. Do not expose the prototype publicly.

See [screenshots](SCREENSHOTS.md) and [manifest](manifest.json). Release approval and tag creation remain separate actions owned by the project owner.
