# Authored-site performance evidence

Hardware read without serial identifiers: Apple M1, MacBook Air10,1, 8 GB. Codex in-app browser on the same workstation. Both captures use native loopback production builds, fixed Medium (explicitly selected), 1440×900 CSS viewport, 1440×800 canvas, effective render pixel ratio 1, sensor origin (0,2,0), sector aim (0,18,1500), day, fog 0.45, seed 482913, four-contact roster, paused, no selected contact and no optical request/released optical geometry during measurement.

| Common elapsed window [5s,35s) | Baseline 0ac34fe | Authored site 13df518 |
|---|---:|---:|
| Frames | 1754 | 1800 |
| Median ms | 16.7 | 16.7 |
| p95 ms | 17.7 | 17.7 |
| p99 ms | 32.4 | 18.0 |
| Maximum ms | 100.9 | 20.1 |
| >50ms / >100ms | 9 / 1 | 0 / 0 |

Both are actual raw exports with clean source hashes. All-capture windows are retained (135.27s baseline, 124.14s candidate); the same 30s subwindow avoids comparing different capture durations. No dropped samples or ignored background frames in either export. Baseline logical tick236; candidate458. Radar-return state and intentional scene geometry/UI differ. Targeted development/background activity was not externally isolated. The candidate result is a descriptive measurement, not a controlled causal speedup experiment or proof of better graphics quality. It does not measure active simulation throughput, 200 contacts, GPU time or headset FPS.

Auto-quality startup/context exports are retained but **not comparable first-load benchmarks**: preparation, draft restoration, scene transitions, cache warmth and quality state differed. No cold-start/shader improvement is claimed. The source avoided introducing an eager Three.js dependency through mission admission by splitting the lightweight site contract from rendering/layout code. Production packaging adds one locally cached application chunk (81 assets total); no new external asset service or dependency was added.

Static geometry budget caught an overlong fence and drove an actual reduction from 132,692 facility triangles to 42,212 in Freight, preserving the test cap. CPU attribute buffers fell from 17,515,344 to 5,571,984 bytes. Open campus has 42,304 facility triangles / 5,584,128 bytes. Original structure batches are 2,172 / 1,692 triangles, with all vertices bounded by their authoritative boxes. Existing sky/terrain/props/textures and total renderer allocations are outside those CPU buffer counts. Shader, GPU-memory, lifecycle endurance and high-contact qualification remain future release checks.
