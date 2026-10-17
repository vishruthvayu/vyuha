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
retest the rural 25/overview-Low outlier cells. The rural 25 Medium and rural 200 overview Low cells were also repeated: each returned 60 FPS mean/app median, 16.8 ms maximum and 0 frames over 33.4 ms. All four repeat receipts are retained; they do not resolve the initial stalls.

## Stability, resources and interaction

The 180-second urban EO/Medium/200 run completes 5399 simulation ticks with 60 median
FPS, 60 fifth-percentile FPS and a lowest reported window of 36 FPS. Worker median
tick 0.600 ms/p95 1.300 ms. Reported JS heap 71.6→52.5 MiB. Thirteen resource snapshots
from 15.01 s through 195.09 s retain 53 textures, 261 buffers, 6 framebuffers and 60 programs.
The final 15 seconds are after the 180-second measurement. These counts do not measure
GPU memory bytes and do not prove indefinite leak freedom.

A diagnostic attached after the run started sampled 8828 frame intervals: maximum
16.8 ms, no gaps over 50 ms, no longtask entries in that partial window. It does not
cover the entire run or identify the cause of the original short-run stalls.

The 12-cycle live sensor/quality soak reports after forced GC:

| Measurement | Start | After cycle 1 | After cycle 12 | End |
|---|---:|---:|---:|---:|
| JS heap (MiB) |32.4|52.3|58.0|58.3|
| Textures |51|57|57|57|
| Buffers |255|260|252|252|
| Framebuffers |6|6|6|6|
| Programs |33|79|82|82|

Texture/framebuffer endpoint counts match after cycles 1 and 12; heap and program counts
increase modestly, so this is not a leak-free or multi-hour stability proof. Raw
heap fields retain the older MB naming but divide bytes by 2^20 (MiB).

Trusted pointerdown to two-rAF scheduling: 4 selection samples median 30.7 ms/max 32.1 ms;
12 sensor changes median 31.1 ms/max 73.4 ms. This measures UI/frame scheduling, including
browser work, not physical display latency or completed camera slews.

Raw: [long run](validation/bench/longrun.json),
[partial diagnostic](validation/bench/longrun-diagnostic.json),
[soak endpoints](validation/bench/soak.txt),
[affected-cell repeats](validation/bench/affected-repeat.jsonl),
[interaction receipts](validation/interaction/receipt.json).

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
