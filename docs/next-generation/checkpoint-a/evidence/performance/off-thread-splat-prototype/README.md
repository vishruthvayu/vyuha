# Temporary splat preparation Worker prototype — NOT production

No repository files changed. No browser optimization claim. Target: remove synchronous FBM loops from the main thread while preserving every original sample, resolution, surface drawing, 30Hz simulation, sensor rule and score.

## Design

- `kernel.ts`: unchanged current `hash/valueNoise/fbm` source copied exactly for the prototype; a test detects source drift. Production should extract this pure visual noise code into ONE module imported by terrain and the Worker (do not duplicate maintained math and do not bundle all of `three` into the Worker).
- `splat.worker.ts`: local module Worker, transfers initial RGBA + one Float64 patch field. No canvas, Three objects, hidden scenario/contacts, network request, new dependency, shader or scoring code.
- `resource.ts`: finite cache keyed by terrain/resolution, one active Worker, bounded queue. Production has only four possible keys: two terrains ×512/1024. These retain30MiB total CPU buffers (2×12MiB +2×3MiB); optional16px keys are unit-test fixtures. There are no GPU resources in this cache. Failures, malformed messages, unsupported Worker/constructor, message decode failure and15-second timeout switch to the same kernel in8-row chunks yielding via timers. Worker terminates on completion/failure/timeout; stale request IDs are ignored. `clear()` aborts active fallback, terminates Worker, rejects pending jobs and permits clean reuse.
- `prepared-texture.integration.ts`: integration sketch derived from the original `createSplatTexture`. It keeps Canvas2D surface rasterization on the main thread, inserts prepared base bytes and performs original patch formulas against the *drawn* image bytes. Thus no OffscreenCanvas rasterization discrepancy is introduced. This file intentionally references sibling production types and is not directly compiled in this temp folder.

## Intended integration boundary

Resolve GLTF/sky/loaded textures first as current source already does. Read a module-scoped splat resource BEFORE procedural texture allocation; pending read throws its stable shared promise for Suspense. React initial-retry or StrictMode re-entry reads the same CPU resource instead of reallocating jobs. Then existing `useMemo` creates context-owned CanvasTextures using `createPreparedSplatTexture(layout, resource.read(key))`. Include prepared data in memo dependencies. Match terrain/resolution explicitly; a response for an old key can complete its old cache entry but cannot populate a new key.

Do not clear shared CPU cache on every React unmount (a Suspense render may never commit). The finite keyspace bounds its memory. Module teardown/HMR or explicit application disposal can `clear()`. GPU objects retain the existing Environment-owned `dispose()` lifecycle. A GL context loss must recreate/reupload textures in the renderer's context lifecycle; cached pixels remain valid because they have no GL handle. This is a design, not a claimed tested WebXR/context-loss acceptance. Browser and XR render the same Environment and must be checked after integration.

## Remaining costs and risks

Surface Canvas2D composition, get/putImageData, patch application, other small textures, geometry assembly (~222ms in latest report), GPU upload/shader preparation remain on main. Moving noise off-thread can improve responsiveness while *increasing* total first-ready wall time due to Worker startup, extra buffers and contention. Peak transient memory includes the cache, canvas buffers, GPU upload and rendering resources; maximum retained CPU cache is not total heap.8-row fallback yields require browser measurement under throttled/background lifecycle. Timeout must not be treated as performance acceptance. No resolution/fidelity reduction is authorized.

## Required checks before adoption

1. Temp reference-byte tests (base and arbitrary post-raster bytes), real Node module Worker transfer, stale/cleared contexts, one-worker bounds and failure fallbacks.
2. Production bundler emits local Worker asset; offline verifier includes it, strict CSP permits same-origin Worker, no emulator dependency.
3. Actual same-browser Canvas2D full-image SHA equality between original and prepared textures for both terrains/512/1024 and real facility layouts/boxes.
4. React Suspense/unmount/re-entry, layout/quality switch, browser↔XR lifecycle and context loss/restoration tests. Verify old jobs never apply to new context and no texture leaks.
5. Matched first/repeat startup and optics measurements at fixed CSS/tier on owner's Mac. Report main-thread spans, frame tails, interaction latency, logical lag, memory and total readiness honestly. No CPU-heavy tests during these traces.
