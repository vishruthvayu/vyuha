# Temp-only correctness and cost receipt

Not production and not included in the parent's current regression freeze. No source files in the shared repository were changed by this investigation. The earlier ControlledStudy UI changes are a separate assigned deliverable.

## Correctness

`node --import tsx --test /private/tmp/vyuha-splat-worker-prototype/prototype.test.ts` from the existing client's cwd:22 passed,0 failed,3279.9ms final run. Full output: `correctness.txt`.

The tests extract both original production loop bodies and compare byte-for-byte at16/512/1024 in urban/rural, including arbitrary post-raster bytes. Actual module Worker buffer transfer is tested at16/1024. Failure, missing/unsupported Worker, throwing postMessage, malformed or stale reply, message decode error, timeout, incremental cancellation, queued caller mutation, cache identity and clear/reuse have regression coverage. This is not a full browser Canvas2D image, GPU context-loss, React, WebXR or separate-device test.

Strict tsc on kernel/resource/worker passed (`typecheck.txt`, empty output, exit0). An initial test-harness run failed from a missing injected SPLAT_SIZE constant and missing temporary ESM package declaration; both harness setup defects were corrected. A subsequent initial typecheck found the browser Worker handler signature mismatch; a typed browser adapter corrected it, then all22 tests and strict tsc passed again.

## Exploratory costs — Node25.2.1, darwin arm64

Three sequential1024 rural runs:

| Cost | Run0 | Run1 | Run2 |
|---|---:|---:|---:|
| Direct pure-kernel CPU ms |189.2|241.6|206.3|
| Fresh Node Worker total ms |416.7|413.8|426.5|
| Worker-reported kernel ms |285.8|273.5|292.3|
| Remaining main-thread patch ms |19.0|10.7|18.0|

Node Worker startup includes the TSX loader. These are exploratory single-process numbers, not browser qualification or a controlled hardware/thermal test. Total preparation is slower off-thread in these measurements. Responsiveness improvement remains a browser hypothesis. The incremental fallback took339.2ms total,127yields,max observed5.87ms chunk in one run. No median FPS, headset FPS or first-load improvement is claimed.

At1024 the returned buffers use12,582,912bytes (12MiB);512 uses3,145,728bytes (3MiB). The production finite four-key CPU cache totals31,457,280bytes (30MiB), excluding canvas/GL/geometry/Worker runtime and transient allocations. There are never more than one active Worker and three queued production requests. No GPU objects are cached globally.

## Exact next-milestone patch scope

1. New `client/src/world/terrain-noise.ts`: extract exact hash/valueNoise/fbm functions. `terrain.ts` imports/re-exports to preserve all existing imports. No numerical changes.
2. New `client/src/world/splat-kernel.ts`: pure typed-array generation and post-raster patch application, importing shared noise.
3. New `client/src/world/splat.worker.ts`: bounded local module Worker, transferable buffers, request IDs.
4. New `client/src/world/splat-preparation.ts`: bounded CPU resource/cache and8-row incremental fallback, diagnostics with truthful worker-vs-main spans.
5. `client/src/world/procedural-textures.ts`: accept prepared noise, preserve existing Canvas2D surface drawing and texture configuration. Validate terrain/resolution; keep an independent reference route for byte comparison during qualification.
6. `client/src/world/Environment.tsx`: read stable resource after asset suspension and before procedural texture allocation. Include resource data in memo dependencies; retain existing context-owned texture disposal. No simulation or observation modifications.
7. Dedicated kernel/worker/resource/React lifecycle tests, browser full-image equivalence checks and actual performance evidence. Existing offline asset generator discovers dist recursively, so it should cache emitted Worker assets automatically; this must be verified in the production artifact rather than assumed.

Production browser checks must include Worker fallback, pending scene/quality changes, XR enter/exit/re-entry, lost/restored GL context, local/offline Worker loading and peak memory. Geometry~222ms reported by the parent and GPU/shader work remain independent synchronous costs.

Do not integrate until the current study/registry/R43/benchmark-report source has finished its freeze and regression. Then qualify this as its own source-bound milestone; reject it if actual latency/memory/regression costs outweigh measured responsiveness.
