# Measured costs and limits

These are development measurements on the owner's MacBook Air M1 workstation. Other foreground/background work was present; the machine and browser contexts were not isolated. No physical headset FPS or device certification is claimed. Browser control itself intermittently stalled. The unfiltered receipts are retained, including unfavorable results.

## Geometry and shadow budget

| Site | Low triangles / attribute bytes | Medium | High |
|---|---:|---:|---:|
| Freight Corridor | 384 / 50,688 | 19,500 / 2,574,000 | 22,716 / 2,998,512 |
| Open Campus | 384 / 50,688 | 13,332 / 1,759,824 | 15,924 / 2,101,968 |

The previous buildings used 2,172 and 1,692 triangles respectively. This is an intentional, measured detail increase, not an unchanged geometry budget. Low/Tactical retain the small budget. Scenery remains merged by material; geometry tests enforce frozen AABBs, finite attributes and quality-specific budgets. Streetscape/facility totals are also in the test logs.

Authored-site Medium shadow resolution increases from 1024² to 2048² and covers the public campus instead of ±170 m. High remains 2048². Low shadows remain disabled. Texel count is four times larger on Medium; actual complete GPU allocation was not measured. Existing static shadow refresh remains unchanged. No claim of lower GPU cost is made.

## Interleaved geometry construction experiment

Eight samples after two warmups, alternating revision order, two public sites. Construction/disposal measured in Node; not browser CPU, shader preparation or GPU timing.

| Experiment | Freight median | Open Campus median |
|---|---:|---:|
| Original architecture in first experiment | 35.99 ms | 28.66 ms |
| Detailed architecture before cache (`5c86f93`) | 259.41 ms | 409.29 ms |
| Original architecture in later shared-workstation experiment | 16.10 ms | 17.01 ms |
| Repeated cached detailed geometry copies | 1.71 ms | 1.35 ms |

The change in original-architecture timing between experiments demonstrates changing machine load. Do not divide these rows to advertise a calibrated speedup. The cache experiment does establish that repeated construction is avoided and consumer copies are inexpensive in that run. Raw samples and triangle/byte counts are retained in `evidence/architecture-build-cost.json` and `evidence/architecture-cache-cost.json`.

The cache retains only public, deterministic CPU geometry, at most 8,000,000 attribute/index bytes and 32 entries. This excludes metadata and consumer-owned scene clones. Cached originals never enter a scene. Eviction/disposal, oversized bypass, deep mutation isolation and zero-byte entry limits are regression-tested. Cache keys include presentation version, quality and the entire public structure. Frozen sensor volumes, observations, events and scores never enter this cache.

## Browser captures

Both captures used a 1440×756 CSS viewport, Chrome 100% zoom, fixed Medium, seed 482913, daytime Freight Corridor and the unselected fixed sensor view. The baseline was paused at 52.30 s with three current reports; the detailed source was paused at 16.57 s with four reports. This is a comparable presentation workload, not a fully matched simulation instant. The new interface intentionally reduces the world canvas from 1440×656 to 1010×544. These differences and unisolated machine load prevent attributing frame changes solely to the artwork.

| Unfiltered capture | Samples | p50 frame interval | p95 | p99 | Maximum |
|---|---:|---:|---:|---:|---:|
| Original `13df518`, 216.43 s | 12,782 | 16.7 ms | 19.0 ms | 29.7 ms | 502.3 ms |
| Detailed `5c86f93`, warm paused 132.81 s | 7,128 | 16.7 ms | 31.1 ms | 66.5 ms | 266.6 ms |

The median corresponds to approximately 60 frame callbacks/s. Tail pacing is worse in the detailed capture. This is not an FPS improvement. A common 5–65 s collection-window calculation is retained in `comparison-window.json`: baseline p95 20.5 ms versus detailed p95 42.4 ms. It does not remove the scene/time/workload confounds above. Do not select only the favorable part of either capture.

A separate mixed startup/quality-switch capture at `5c86f93` measured world-build samples up to 1,369.6 ms, renderer-module load/evaluation 530.6 ms, reflection preparation up to 497.9 ms, and substantial long tasks. Its overall frame p50/p95 were 26.8/168.7 ms. It includes changing quality, preparation and concurrent machine work; it is not a controlled first-load comparison. It motivated the bounded geometry cache rather than an unsupported GPU attribution.

The cache source is a later revision. Earlier browser timings remain pinned to `5c86f93`; they are not relabelled as post-cache evidence. The cache does not claim to resolve steady-state tail pacing. A quiet-machine, fully matched scene/time capture and GPU/CPU attribution remain pending before the rendering performance release gate can close. No 200-contact, phone or headset result is added by this milestone.

## Final cached production workflow

`production-cache-runtime.json` was exported by the clean production bundle at `1f422d8` / source hash `ff9f08fb2b6ecca431e70379f2ccaca305a182e37c5a5c9d89d8f95fc2330d76`. It covers restore, Medium → High → Medium, acquisition, Defer and verified review. Seven world-build samples measured p50 72.9 ms and maximum 226.2 ms. This is a different mixed workflow from the earlier startup trace; it is not a controlled causal before/after world-build benchmark. Warm Node geometry-copy results above are the narrow cache evidence.
