# Drill-rescue browser harness

Scripts used to reproduce, measure and screenshot the real built app through Chrome
DevTools Protocol (trusted input events, no test hooks in the app). Nothing here is
part of the product build. Copy `env.example.sh` to a private `env.sh`, adjust the
paths and `source` it first. Shots, logs and benchmark rows go to the work folder
`$W`, outside the repository.

## Chrome

```bash
# User-experience measurements (vsync on)
google-chrome-stable --headless=new --remote-debugging-port=9351 --remote-debugging-address=127.0.0.1 \
  --user-data-dir=$W/chrome-H --window-size=1440,900 --no-first-run --no-default-browser-check \
  --enable-gpu --ignore-gpu-blocklist about:blank
# GPU headroom (vsync off; read the app's own FPS, not rAF intervals)
google-chrome-stable --headless=new --remote-debugging-port=9352 ... --disable-gpu-vsync --disable-frame-rate-limit about:blank
```

Check which GPU WebGL uses (Intel iGPU here, through ANGLE/Mesa): open a tab, then read
`WEBGL_debug_renderer_info`.

## Scripts

| Script | Use |
|---|---|
| `guided-drill.mjs <app> <out> [adaptive\|library] [--lib=Title] [--wait=N] [--w= --h=] [--axe]` | Full guided drill: select → designate → classify → respond → outcome, vision switches, end. Logs dock text, frame stats and, with `--axe`, axe results per step. |
| `baseline-drill.mjs` | The same drill against the *old* dock (baseline build). |
| `switch-burst.mjs <app> <out> <libTitle\|adaptive> <wait>` | Burst captures around THERMAL / DAY TV switches (camera continuity). |
| `world-shot.mjs <app> <out> world:time:vision:camera:count[:wait[:tier]],...` | Screenshots from `/system/benchmark`, e.g. `urban_outpost:day:day:trainee:25`. |
| `bench.mjs <app> <out.jsonl> <label> [counts] [tiers] [cams] [vision] [secs] [world]` | Benchmark matrix: frame-interval percentiles (injected `gl-probe.js`), draw calls, triangles, heap, app FPS. `bench-table.py` prints a table. |
| `aar-shot.mjs <app> <out> <seekFraction> <recordTitle>` | AAR replay OVERVIEW / OBSERVER / FOLLOW captures. |
| `author-scenarios.mjs <app> <passwordFile>` | Officer-authored library scenarios (rural/urban × day/night). Reads the password from a file and never prints it. |
| `ph-download.py ph-spec.json` | Downloads the Poly Haven CC0 sources into `$ASSETS_SRC` and writes a ledger with MD5s. |
| `ptyrun.py` | Runs `scripts/start-local.sh` under a PTY, typing the officer password from a file at the hidden prompt. |
| `probes/pose-motion*.ts` | Display-speed statistics of the pose buffer (`npx tsx`). |
| `closeup-shot.mjs <app> <out> [wait]` | Live drill: select contacts until a camera resolves one, then capture the view and the sensor close-up at 1× and 6×, in EO and thermal. |
| `soak.mjs <app> <cycles>` | Resource soak: repeated sensor and quality switching in a live drill; JS heap after forced GC and live WebGL objects (`gl-resources.js`). |
| `longrun.mjs <app> <out.json> [world] [vision] [tier]` | 180 s, 200-contact run on `/system/benchmark`; FPS samples, simulation tick times, heap and live WebGL objects every 15 s. |
| `gpu-timer.js` | Injected by `bench.mjs`: median GPU ms per animation frame (`EXT_disjoint_timer_query_webgl2`). It is meaningful on the iGPU; on a laptop dGPU it follows power states. |
| `bench-markdown.py <file.jsonl> <label>...` | Markdown tables from benchmark rows. |

Run benchmarks on an otherwise idle GPU, one at a time. Concurrent browser work
(even on another GPU) costs CPU and shows up as single long frames.

