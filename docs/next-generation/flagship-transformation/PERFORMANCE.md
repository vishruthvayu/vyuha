# Matched rendering observations

Runtime candidate: `292551848e55414b8cd1589cd9ab6be2c58486b4`; baseline: `0664dc483fe1834b28da9d4992d94e6eb54a068b`.

Both final receipts have identical reproduction settings: 1152×648 CSS pixels, DPR0.809999942779541, visual scale1, fixed Medium, auto quality off, urban/day/EO, trainee camera, retained slow synthetic roster200, 20seconds, engine0.4. This is a fixed400px-high benchmark canvas, not the naturally larger new Training stage, a cold-cache experiment or headset measurement.

| Measure | Baseline | Candidate |
| --- | ---: | ---: |
| Median WebGL callback FPS | 60 | 60 |
| Minimum active contacts | 200 | 200 |
| Main frame interval median during training | 16.7ms | 16.7ms |
| Main frame interval p95 during training | 20.8ms | 21.5ms |
| Main frame interval p99 during training | 26.9ms | 23.4ms |
| Largest training frame interval | 114.3ms | 31.7ms |
| Training frame samples | 1013 | 1021 |
| Startup-phase frame p95 / p99 | 20.5 /21.9ms | 19.8 /22.3ms |
| Worker tick median / p95 | 0.6 /2.6ms | 0.5 /1.1ms |
| Dropped scheduling time | 0ms | 0ms |
| Visibility interruptions | 0 | 0 |
| Browser main-page heap sample range | 81.1–141.9MB | 91.1–133.5MB |

These runs do not establish an overall speedup: median FPS is unchanged, p95 is0.7ms higher, tails differ and worker timings vary despite the unchanged engine. They are single observations on an ordinary development workstation, not thermally controlled process-isolated experiments. Heap samples exclude Worker, GPU and total process memory; GC timing prevents a retained-memory conclusion.

The earlier matched DPR0.9 pair is retained without rewriting: baseline60median FPS; candidate55, including opening samples2 and23FPS and17 reported FPS samples. It exposed preparation sensitivity. Later browser zoom/DPR changed, so it could not be silently compared against a lower-resolution candidate. The additional pair uses explicitly checked matching receipts and warmed scenes. An intermediate attempt with different page height was rejected as a comparison; it did not replace either original receipt. Native browser timing export was slow; the full capture also contains idle/review frames. The table uses only the recorded `startup` and `training` phase frame windows, not the capture-wide summary.

The landscape geometry has one static batch and bounded CPU arrays (Medium190,980bytes/7,680triangles); those are construction facts, not GPU retained-memory measurements. No new network assets, dynamic shadows or authoritative occluders were added. The before/after static horizon views support scene-depth inspection; aircraft positions and dynamic ticks differ and are not a matched sensor-accuracy experiment.

The new Training stage occupies1152×548CSS pixels at the recorded desktop size, versus the old active world802×502. That increases potential rendering area by about57%; fixed-canvas evidence must not be presented as qualification of every natural-window workload. Repeated lifecycle/GPU-memory, close-up High, physical hardware and whole-product release performance remain further acceptance work.
