# Browser performance measurements

All repetitions are retained. Percentiles below are means of per-run percentiles. See the raw receipts for individual maxima and variation. This host used Chromium 141 and the Intel/Mesa ANGLE OpenGL renderer, fixed Medium quality and DPR 1. These are bounded browser measurements, not platform certification.

## Normal fixed-size benchmark

| Workload | Before / after FPS | Before / after p99 ms | Before / after script ms/s | Script reduction |
|---|---:|---:|---:|---:|
| rural_forward_base:night / 100 configured contacts | 60.00 / 60.00 | 16.80 / 16.80 | 199.20 / 198.82 | 0.2% |
| rural_forward_base:night / 200 configured contacts | 60.00 / 60.00 | 16.80 / 16.80 | 303.93 / 289.85 | 4.6% |
| urban_outpost:day / 8 configured contacts | 60.00 / 60.00 | 16.80 / 16.80 | 124.58 / 119.75 | 3.9% |
| urban_outpost:day / 200 configured contacts | 60.00 / 60.00 | 16.80 / 16.80 | 210.71 / 205.57 | 2.4% |

## Sensor close-up diagnostic

The optical canvas was fixed to 1034×400 CSS/device pixels in both sources. Each case runs the real legacy worker and selects the same visible T2 contact through browser input; it is an engineering diagnostic rather than the normal layout. GPU timing uses disjoint timer queries when available. Main optics still renders every display frame; only the sensor-limited close-up texture refresh is capped at 30 Hz, with immediate context invalidation. Its sensor pixel budget and 4× supersampling are unchanged.

| View | Draw calls/frame before → after | GPU mean ms before → after | GPU reduction | Script ms/s before → after |
|---|---:|---:|---:|---:|
| THERMAL | 64.08 → 45.38 | 4.524 → 3.278 | 27.5% | 157.50 → 142.06 |
| DAY TV | 64.09 → 46.90 | 7.250 → 5.339 | 26.4% | 181.20 → 173.70 |

## Synthetic CPU constraint

DevTools 4× **main-thread** CPU throttle, two repeats per world at 200 configured contacts. This does not model an entire low-end device or throttle the server/GPU consistently.

| Workload | FPS before → after | p95 ms before → after | p99 ms before → after |
|---|---:|---:|---:|
| rural_forward_base:night | 60.00 → 60.00 | 16.70 → 16.70 | 16.80 → 16.80 |
| urban_outpost:day | 60.00 → 60.00 | 16.75 → 16.80 | 16.80 → 16.80 |

FPS near the 60 Hz cap is not evidence of an FPS increase. Script/GPU work reductions represent additional frame budget; rare long frames, shader warm-up, host contention and physical input/display latency remain distinct concerns. EO foundation shading costs one extra static draw batch; unchanged or worse cells are retained above.
