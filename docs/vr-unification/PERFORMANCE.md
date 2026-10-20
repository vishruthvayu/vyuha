# M1 performance — measured limits, not headset certification

Runtime `ad430f742f7476feb464c1c53d08cfb3f95823ba`, source hash `f87104f832e9cb9b03ad18ab3938a23a1a43f1bc51ba95385f540c684c36534a`. MacBookAir10,1, Apple M1,8GB,8 cores, macOS27.0.1. In-app Chromium155 reports a compatibility Intel UA; actual hardware comes from filtered system metadata, without serial identifiers.

**Result: warm rendering is usable in these samples; startup/transition stalls remain. A60FPS median does not establish consistent smoothness. No stutter-free, GPU-time, physical headset or total-memory claim is made.** Regression/build/transfer jobs and the Docker test container were stopped before the formal windows. The second benchmark also stopped the main QA server (exit−15); the separate local asset/audit adapter served the same byte-identical production assets. Its benchmark does not need a server session.

## Standard browser benchmark — two 180-second wall-time runs

Finale0.4,200 initial contacts, fixed Medium, auto quality unchecked, rural/night/thermal, trainee camera,1280×720 CSS pixels, scale1. These standard stress contacts approach the asset and the active roster can decline; this is not200 contacts retained for every rendered frame. All raw per-second FPS and worker/heap samples are retained.

| Run | Median FPS | Minimum one-sample FPS | Samples below50 | Below30 | Worker median/p95 ms | Last logical tick |
|---|---:|---:|---:|---:|---:|---:|
| Primary run | 60 | 4 | 31/176 | 12/176 | 0.70 / 3.20 | 5299 |
| Repeat, main QA server stopped | 60 | 2 | 18/177 | 11/177 | 0.40 / 2.50 | 5344 |

The run timer is180 wall seconds; the simulation reached the listed ticks rather than claiming5,400 logical ticks. Bounded catch-up can lag wall time under stalls; authoritative scoring rules and30Hz logical steps are unchanged. Heap counters cover main-page JS only, excluding worker/GPU/total process memory.

Raw runs: [primary](evidence/browser/owner-browser-200-180s.json), [isolated repeat](evidence/browser/owner-browser-200-isolated-180s.json). The repeat still has startup stalls, so background server reconstruction is not a sufficient explanation. The benchmark's later warm window also has fewer surviving contacts; it cannot certify steady rendering of a retained200-contact roster.

## Direct frame-interval windows / actual retained roster

An additional real training session uses the synthetic persistent200-contact rural fixture (all neutral, slow loiter,180 logical seconds) with a selected observed contact and fixed Medium. This deliberately stresses rendering/UI; it is not a solvable authored raid, calibrated training scenario or portable archive fixture. IR sample is active; EO sample is explicitly paused after an authenticated Set day command. The actual viewport changed for EO and is reported separately, not treated as a matched comparison.

| Window | CSS viewport | Median ms | p95 ms | p99 ms | Max ms | Frames over50/100 ms | Receipt |
|---|---|---:|---:|---:|---:|---:|---|
| Benchmark first30s | 1280×720 | 16.7 | 49.1 | 183.3 | 883.3 | 46 / 24 | [Raw](evidence/browser/owner-browser-200-first30-frames.json) |
| Benchmark warm30s aroundT+98s; active roster declines | 1280×720 | 16.7 | 17.6 | 17.7 | 17.8 | 0 / 0 | [Raw](evidence/browser/owner-browser-200-steady30-frames.json) |
| Actual training startup/selection30s,200 retained | 1280×720 | 16.7 | 33.3 | 115.6 | 1099.9 | 26 / 15 | [Raw](evidence/browser/owner-retained-200-startup30.json) |
| Actual training warm IR close-up30s,200 retained | 1280×720 | 16.7 | 17.7 | 34.3 | 99.5 | 5 / 0 | [Raw](evidence/browser/owner-retained-200-ir30.json) |
| Actual training EO close-up30s, paused,200 retained | 1127×904 | 16.7 | 17.6 | 17.7 | 17.8 | 0 / 0 | [Raw](evidence/browser/owner-retained-200-eo-paused30.json) |

The native session `fa64a6ac-370b-4f94-98ce-3bf6df920bf3` later completed naturally at 5,400 ticks with Server verified; [receipt](evidence/retained-browser-session.json). It contained no trainee decisions, only the applied day command. The live IR sample includes real selected-contact tracking and200 reported contacts; [IR capture](evidence/browser/owner-retained-200-ir.png). [EO capture](evidence/browser/owner-retained-200-eo-paused.png) shows71px-across-target optical close-up at111m and a labelled paused state. No hidden contact, sensor rule or score was altered. A visible test-only30s callback sampler produces these receipts; it does not measure GPU time or input latency. The startup window includes renderer loading/selection changes. It is not a cold-cache network benchmark.

## Emulated stereo,200 contacts retained

The completed XR session `e30a911c-7a2c-467e-8fae-9c3f58787638` retains200 contacts for the180-second logical exercise. Both controller rays, designation/classification/Hold, Instructor radar fault/restore, pause/context loss/browser recovery/re-entry and natural5,400-tick completion were exercised. Formal steady sampling reset after functional/CPU jobs completed and spans approximatelyT+43→146s: **6,195 intervals, median16.6ms, p9518.9ms, maximum65ms, no faults in that window**. The per-second display stayed60FPS at recorded samples.

Scoped renderer snapshots:104 draw calls,277,472 triangles,70 geometries,43→44 textures,29 shader programs,17 interactive surfaces, requested framebuffer scale0.85, foveation1; measured ray collection up to0.1ms in these samples. Resources are snapshots, not proof of leak freedom or total GPU memory. [Start](evidence/browser/owner-xr-200-start.json), [mid](evidence/browser/owner-xr-200-mid.json), [late](evidence/browser/owner-xr-200-late.json), [steady raw](evidence/browser/owner-xr-200-steady-final.json). Known emulator null-frame errors occur only after deliberately losing context, outside the steady window, and remain in the browser acceptance report.

## Comparison and remaining work

Earlier7d48d80 checkpoint measurements reported browser medians60FPS at8/50/200 and worker median/p95 about0.4/0.7ms for its200-contact run. Earlier emulated-XR entry/exercise/teardown had median16.7ms, p9519.7ms and maximum1,585ms. Those are historical, differently warmed/scoped measurements. Current worker p95 and startup samples are worse in these runs; no causal performance improvement is asserted. Current XR steady and complete lifecycle windows are also different scopes, so a smaller maximum is not a before/after efficacy claim.

The evidence suggests warm rendering is substantially better than initial/transition work; small worker tick timings alone do not explain the longest frame gaps. This is an inference, not a GPU or main-thread stack profile. **Startup/transition resource and shader profiling remains an optimization opportunity, and owner review must include startup.** No timing threshold or hard real-time SLA is certified. Browser Scene, Environment, ContactRenderer, InspectionPass and authoritative engines remain unchanged from the accepted browser baseline; no new unification-specific rendering regression has been established by source comparison. Further rendering changes are not silently introduced into this tested handoff.

Physical headset FPS, comfort, thermal behavior, controller ergonomics, separate-device trusted HTTPS and final-candidate platform/network acceptance remain PENDING. These measurements do not authorize a release candidate or stable tag.
