# R01 texture experiment — 24 October2026

Status: EXPERIMENTAL / TARGETED TESTED, default training remains synchronous. Explicit research URL texturePreparation=chunked is recorded in schema7 benchmark receipts/reproduction links. This settles the interrupted comparison; it is not the main product transformation.

The chunked path preserves all FBM inputs, Float64 patch values and Canvas2D raster order. Eight-row tasks yield through MessageChannel, with local timer fallback. Four finite CPU keys retain at most30MiB; final GPU textures remain renderer-owned. Stable Suspense promises prevent repeated preparation and mismatched contexts. HMR teardown aborts/clears jobs. Work belongs to its dispatch capture; a replacement timing capture cannot inherit old chunks. No Worker/dependency/remote asset/simulation/scoring change.

Actual IAB/MacBook Air M1 (owner hardware identification),1280×720CSS/dpr2/scale1/fixedMedium/rural-night/thermal/retained200:

|Measure|Synchronous before|Chunked candidate|
|---|---:|---:|
|200-contact20s medianFPS|60|60|
|Executed/timing ticks|599/599|600/600|
|Worker median/p95ms|0.4/0.8|0.4/0.9|
|Full startup capture frame maxms|672.0|418.8|
|Full capture p95ms|18.6|18.6|
|Procedural final assemblyms|294.6,664.4|25.0,30.9|
|New preparation wallms|included in synchronous assembly|164.4 incl.yields|
|New CPU chunk count/maxms|single synchronous loops|128/3.4|

The full startup captures differ in duration, cache state, background renderer state and browser/module warmup; this single sequential pair does NOT establish a controlled whole-startup speedup. The earlier49FPS trial overlapped UI testing and extra review canvases and is explicitly retained as contended, not qualification. Quiet before/candidate both retained all200 contacts, complete timing receipts, no visibility interruption. No sustained180-second repeat was necessary for an unchanged engine/new startup experiment. Geometry, shader and other stalls remain (candidate full-frame max418.8ms). Original timings are not silently redefined: final assembly, preparation wall and chunk CPU are separate.

Actual browser Canvas2D fixture compared both terrains at512/1024 including full facility surface drawing. All four full-pixel SHA-256 pairs and texture configurations matched.15 focused preparation tests pass, including byte equivalence, cache/context/abort/fallback and stale capture ownership.28 directly affected generation UI/benchmark settings/diagnostics/world tests pass separately; incrementalTypeScript and changed-fileESLint pass. No full suites/build rerun. An initial command supplied the new test under the wrong world/ path, so the28 did not include it; the correct root src/splat-preparation.test.ts was then run separately and all15 passed.

Remain open before default promotion: matched repeated cold/warm/optics/urban/low-tier qualification, context-loss/offline/XR lifecycle and memory checks. Physical headset evidence remains pending. CPU microbenchmarks were mixed and jittery; no Node speed claim. No Checkpoint A, release or broad performance acceptance. The breakthrough mission now prioritizes a coherent evidence-reconstruction theatre and larger training architecture, not proliferation of performance options.
