# Frozen-source graphics measurements

Source: `5d40a24165dff5ace27c6131318da599ad828b0d`. Production build,
Chrome 151/ANGLE/Mesa Intel RPL-S on Linux, 1440×900 at 100% zoom/device scale 1,
normal vsync and an active shared desktop. This is not M1 or physical-phone acceptance.

## Method and scope

Thirty live-camera cells: urban day EO and rural night thermal × Low/Medium/High ×
8/25/50/100/200 contacts. Six additional overview cells: both worlds × three tiers
at 200 contacts. Each cell runs 20 seconds, discards the first 3 seconds, and samples
frame intervals for the remaining 17 seconds. The app's median FPS includes its own
measurement window. Two extra Medium 200 live-camera repeats are separate from the
36-cell matrix. The benchmark canvas is 400 CSS px high; this does not represent every
possible application canvas size or a physical display's presentation latency.

`bench.mjs`, `gl-probe.js` and GPU timer queries measure frame scheduling, draw calls,
triangles and GPU time. Fixed quality is selected; automatic quality is disabled.
Requested quality ratios in `quality.ts` are Low 0.75/Medium 1/High 1.5. The legacy
harness's per-cell `dpr` field is null because that canvas attribute is absent; it
is not a measured DPR value. Environment and build hashes are in `validation/`.

Only one benchmark/capture workload was launched at a time. A point check of the
older test profile found its visible page had no canvas and its two hidden 3D tabs
had 0 rAF callbacks over 1.2 seconds; this is not continuous system-load monitoring.
Desktop/compositor activity and occasional long frames remain part of these results.

## Results

Every cell has an application median of 60 FPS. Probe mean FPS spans 59.2–60; worst
p99 frame interval is 16.8 ms. This does **not** mean every frame met budget: three
cells include long intervals, with worst 216.7 ms and worst 1% low 27.4 FPS.

| World / mode | Camera | Tier | Cells | Mean FPS range | Median GPU ms range | Draw calls | Triangles |
|---|---|---|---:|---:|---:|---:|---:|
| urban_outpost:day | trainee | low | 5 | 60.0 | 3.302–3.453 | 38 | 178,526 |
| urban_outpost:day | trainee | medium | 5 | 59.4–60.0 | 5.172–5.280 | 38 | 181,766 |
| urban_outpost:day | trainee | high | 5 | 60.0 | 7.294–8.454 | 38 | 182,028 |
| rural_forward_base:night | trainee | low | 5 | 60.0 | 1.659–1.838 | 28 | 134,496 |
| rural_forward_base:night | trainee | medium | 5 | 59.2–60.0 | 2.832–3.076 | 28 | 138,606 |
| rural_forward_base:night | trainee | high | 5 | 60.0 | 6.155–6.488 | 28 | 139,470 |
| urban_outpost:day | overview | low | 1 | 60.0 | 3.595 | 44 | 187,342 |
| urban_outpost:day | overview | medium | 1 | 60.0 | 5.493 | 44 | 190,582 |
| urban_outpost:day | overview | high | 1 | 60.0 | 7.007 | 44 | 190,844 |
| rural_forward_base:night | overview | low | 1 | 59.2 | 2.016 | 34 | 143,876 |
| rural_forward_base:night | overview | medium | 1 | 60.0 | 3.713 | 34 | 147,986 |
| rural_forward_base:night | overview | high | 1 | 60.0 | 6.765 | 34 | 148,850 |

### Retained outliers

| World / camera | Tier / contacts | Worst frame ms | 1% low FPS | Frames over 50 ms |
|---|---|---:|---:|---:|
| urban_outpost:day / trainee | medium / 200 | 116.7 | 29.9 | 2 |
| rural_forward_base:night / trainee | medium / 25 | 216.7 | 27.4 | 1 |
| rural_forward_base:night / overview | low / 200 | 200 | 27.4 | 1 |

These occurred roughly five minutes apart in this run. Timing alone does not identify
a cause, so no application fix or external-cause attribution is asserted. Both 200-
contact Medium repeats returned 60 FPS mean/app median, 16.8 ms maximum, 0 frames over
33.4ms and 1% low 59.5 FPS. These repeats do not erase the original results or directly
retest the rural 25/overview-Low outlier cells. Further affected-cell repeats follow.

## Stability, resources and interaction

The current 180-second run, 12-cycle sensor/quality soak and trusted-input timing
receipts are pending completion at this checkpoint. A lightweight rAF-gap/longtask
diagnostic attaches partway through the long run; it is not a root-cause trace.

## Interpretation

The tested scenes fit the median frame budget on this Intel configuration. The rare
long frames remain a limitation, and these tests do not certify glitch-free display,
uncapped GPU headroom, physical M1 performance or empirical training effectiveness.
Historical baseline/older M6 NVIDIA and idle-Intel runs remain in their original
files; different browser/source/load conditions prevent a controlled speedup claim.

Simulation tick figures here describe the browser worker. They are not backend
startup, server reconstruction, asset cold-loading or network-latency benchmarks.
Raw files: [36-cell matrix](validation/bench/current.jsonl),
[two Medium repeats](validation/bench/repeat.jsonl),
[environment](validation/environment.json).
