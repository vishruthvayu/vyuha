# R01 — measured startup investigation (in progress)

Latest published pre-investigation source: `42665e5`. The instrumentation/workload changes and measurements below are not Checkpoint A acceptance or a release seal.

## Implemented measurement support

- Synthetic retained-roster option in the existing Device performance check. All 200 contacts remain active through 180 logical simulation seconds in a pure-engine regression; no engine math or score change. A benchmark is not a solvable lesson.
- Per-second active roster, delivered logical tick, wall-minus-logical lag and actual renderer contact-count samples. The existing advancing benchmark remains available and is no longer described as necessarily retaining contacts.
- Source-bound renderer-module, procedural texture, world-build, environment-reflection and airframe-geometry spans. Asynchronous work belongs to its original capture and cannot contaminate a replacement capture.
- Observer support is disclosed; manual stop seals elapsed time; collection is bounded to four minutes and 32,000 samples with explicit overflow reporting. No identifiers, action text or URLs are captured. Renderer-module work includes loading/evaluation, not isolated CPU parse or GPU execution.

## Actual browser finding before optimization

Codex in-app browser, MacBook Air M1 as identified by the owner, 1440×900 CSS, fixed Medium, auto quality off, rural/night/thermal default, no exercise running. RAM was not independently read: sandbox rejected the targeted sysctl query. Exact source hashes and dirty-tree disclosure are embedded in each JSON. A fresh local origin is not proof of a fully cold OS/driver cache. Navigation automation delays are not interpreted as simulator timing.

`evidence/performance/route-load-timings.json` recorded a 145.8 ms renderer-module span, 412.1 ms maximum rendered-frame interval and 399.9 ms maximum long-frame script work. Layout work max 24.5 ms. This suggested startup main-thread work deserved finer attribution.

`evidence/performance/world-startup-before.json` adds that attribution:

| Work | Calls | Observed duration |
|---|---:|---|
| Procedural world texture creation | 5 | 397.7 /315.0 /253.3 /234.7 /234.3 ms; total 1435.0 ms |
| World geometry/material construction | 1 | 123.6 ms |
| Environment reflection generation | 1 | 84.3 ms |
| Renderer-module loading/evaluation | 1 | 452.8 ms |
| Rendered-frame intervals | 1845 | p50 16.7 /p95 17.6 /p99 17.8 /max 478.2 ms |

These are scoped observations, not matched improvement results. Both traces disclosed zero dropped samples. The second trace's startup cost is dominated by repeated procedural texture work; layout max was 16 ms. The code currently creates procedural textures before later GLTF and sky `useLoader` reads can suspend. Initial suspension can discard memoized work ([React useMemo documentation](https://react.dev/reference/react/useMemo)). This is a measured, testable explanation for repeated generation, not proof of GPU timing.

Next executable optimization: move all suspending asset reads before procedural construction, preserving texture/geometry/sensor/scoring inputs. Measure the same startup spans again on a fresh comparable origin; retain both traces. Then run matched retained 8/50/200 and optics trials, full regression and actual scene review. No performance improvement is claimed yet. Whole Checkpoint A, human learning, physical headset/platform/network and empirical calibration gates remain separate.


## Loader-order experiment

The asset-order patch resolves the existing GLTF/sky reads before procedural textures; formulas, texture resolution, geometry, sensors and clocks are unchanged. Source before: `9b0f8ea` / `b396858224895d31e458bfb0690ffa805ee7633838fdd187d173d5a3d68a3131`. Source after hash: `3becde753fb27b754680b51f07cefa16266ca9d605fd84ef89d916783d067dc6` (implementation commit bound afterward). The exact patch is retained under evidence/performance.

Actual same-viewport/tier/world/optics paired traces show texture calls **5 →1**, total measured texture work **1435.0 →232.5 ms**. This is a reduction in repeated work, not an end-to-end smoothness win: maximum rendered-frame interval **478.2 →681.8 ms**; warm p95 **17.6 →17.6 ms**. Reflection work also varied **84.3 →189.9 ms**, and module timing **452.8 →87.1 ms**. Cache/driver state was not fully controlled, capture lengths differ, and this single pair does not establish a general FPS or startup-latency improvement. All raw traces retain source hashes; no samples dropped.

Complete frontend after the loader-order change: **385 passed**, production build/lint/format passed. Backend runtime is untouched; the prior 746-test source seal remains separately scoped. Matched retained/optics runs and final combined acceptance are still required.

A numerically exact compiled-noise prototype was independently microbenchmarked in a temporary experiment and **rejected** because it was slower at 1024 resolution with additional scratch memory. The negative result and nonproduction prototype are archived under evidence/performance/rejected-splat-prototype. No speculative math change was integrated.


## Corrected timing samples and retained trials

Runtime input hash `b1b7441c91fb09e5262f63bc41ff50aac1a312f08de48b1e807875d59df86992` (qualification-source.json) includes the worker tail flush and per-run request isolation. All **390 frontend tests passed**, including pause/finish timing accounting, rejecting stale scope and ordinary training protocol regressions; production build/lint/format passed. This is a frontend software milestone, not final combined backend acceptance.

Actual Codex in-app browser, owner-identified M1, fixed Medium/auto off, 1440×900 CSS at scale1, retained synthetic rural/night/thermal scene:

| Trial | Minimum active | Executed ticks / timing samples | Median FPS | Warm p95 /p99 /max ms | >50 / >100 ms | Worker CPU p95 ms |
|---|---:|---:|---:|---|---|---:|
| 8, first20s |8|599 /599|60|18.1 /27.8 /78.2|2 /0|0.3|
| 8, repeat20s |8|599 /599|60|28.2 /49.7 /203.1|9 /1|0.3|
| 50,20s |50|600 /600|60|20.4 /28.3 /64.3|2 /0|0.4|
| 200,20s |200|598 /598|60|22.8 /38.9 /60.6|2 /0|0.9|
| 200,180s |200|5386 /5386|60|19.9 /28.2 /322.6|30 /6|2.3|

All worker receipts acknowledge stop and account for every executed tick. Sustained execution disclosed **433.33ms dropped wall-clock backlog**; this is bounded clock scheduling behavior, not missing worker samples or evidence of 180 logical seconds executed. All 200 contacts stayed active; renderer samples ranged199–200 because observed-only filtering remains in force. Main-page heap is not total Worker/GPU memory. No diagnostic sample overflow or hidden-frame gaps.

**Limits and failed targets:** repeat8 had expanded live JSON details while other trials had collapsed details; its workload differs. 200-short timing capture was manually stopped about one second before the final worker receipt; retain it as an incomplete paired frame window. Benchmark schema5 reports are manually paired to source-bound traces; they do not themselves embed build provenance. Initial preparation still recorded a430.5ms rendered gap,333.9ms procedural texture construction and222ms world construction. Warm20ms p95 target fails in repeat8/50/200-short; sustained p95 passes only that criterion while its322.6ms worst frame remains a defect to investigate. No universal smoothness or controlled before/after FPS claim. The optics transition trace is exploratory only: mixed timing/adjacent targeted-test activity prevents qualification.

Raw JSON, hashes, source receipt and summary are under evidence/performance. Earlier unflushed8-contact report remains preserved as evidence of the fixed measurement defect. Next: embed source and viewport in benchmark reports, isolate inactive report rendering, perform fresh/repeated equivalent trials and inspect dominant remaining startup work before choosing further optimization. R01 and Checkpoint A remain PARTIAL.
