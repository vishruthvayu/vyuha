# Stage 6 — Validation, resilience and platform hardening

> Submission acceptance policy update: dedicated physical WAN-off/LAN-on validation is **NOT PERFORMED BEFORE SUBMISSION**. Reason: **Required physical/network setup unavailable during final validation window.** This is a known validation limitation, not a failed architectural test. The user approved proceeding; every other Stage 7 requirement remains mandatory. See [FINAL-VALIDATION.md](FINAL-VALIDATION.md).

Branch: `feature/hardening-v1`, from Stage 5 commit `2ad6403bdfab09aa303a802b5282355ba52af318`. Team WhiteList&0. This report records historical Stage 6 evidence; current release work is tracked in FINAL-VALIDATION.md.

**Dedicated physical WAN-off/LAN-on validation: NOT PERFORMED BEFORE SUBMISSION.** The revised submission policy permits release with this disclosed validation limitation. Software measurements are recorded separately from those physical requirements. The historical [Stage 6 manifest](qa-stage6/evidence.json) retains those measurements. The final [release manifest](release-evidence.json) powers `/system/evidence`; source changes produce a visible stale-evidence warning. Historical Stage 4 phone operation did not disable the router WAN and is not WAN-off proof.

## Deployment and recovery

Retain the separate commands:

```sh
git clone --branch feature/hardening-v1 https://github.com/vishruthvayu/vyuha-sih26247.git
cd vyuha-sih26247
bash scripts/start-local.sh
# Stop local server before binding the same port:
bash scripts/start-unit.sh
```

Initial dependency installation requires internet. Python 3.11+ and a supported Node version (20.19+, 22.12+, or later) are checked. Local startup creates a virtual environment and installs locked dependencies/builds the frontend. Unit startup uses the installed environment and built assets; `--build` requests a fresh build. Missing runtimes, occupied port, inaccessible database, absent dependencies and absent frontend produce actionable errors. `VYUHA_PORT` and `VYUHA_DB` select port/database. Optional TLS remains optional; there is no certificate-security bypass.

All runtime application assets, Three.js, cues, examples and workers are bundled locally. Lazy route splitting reduces the initial app chunk while the service worker precaches every emitted asset on supported origins. Prior fingerprinted caches are retained so an older active page can still load its worker/chunks after an update. Browser storage remains subject to eviction; cached assets are not a permanent availability guarantee.

An active drill keeps its action log in IndexedDB through temporary server/LAN loss. On reconnection accepted batches are retried idempotently and authoritative reconstruction verifies the score and Ghost. Plain LAN HTTP usually cannot register a service worker; a cold reload when the local server itself is unavailable is browser/platform constrained. Loopback cached reload evidence does not certify Android/LAN HTTP behavior.

## Backup and restore

```sh
bash scripts/backup-data.sh backup /path/to/new-backup.db --source data/vyuha.db
bash scripts/backup-data.sh restore /path/to/new-restored.db --source /path/to/new-backup.db
# Stop the server, then start against the restored destination:
VYUHA_DB=/path/to/new-restored.db bash scripts/start-unit.sh
```

SQLite's online backup API takes a consistent snapshot, checks `quick_check`, refuses source=destination and refuses an existing destination. It never overwrites live data. Restoration is to a new disposable destination before an operator changes the startup path. Bundle roundtrip tests verify scorecards, profiles, Rapid reviews and outcome counts after backup/restore. Existing production history is backed up and separately reconstructed; synthetic QA databases remain separate.

## Performance

Repeatable CPU/contact measurement:

```sh
.venv/bin/python scripts/benchmark-hardening.py --output docs/qa-stage6/performance-scale.json
.venv/bin/python scripts/benchmark-unit.py --advanced --clients 6
```

The scale fixtures use 8, 25, 50, 100 and 200 contacts with unchanged movement, sensor, scoring and replay logic. They spawn together. Authoring remains bounded to 18 contacts; benchmark and validated portable snapshots permit 200. Recorded sources permit 200 tracks/20,000 total samples. Python memory measurement is traced allocations, not whole-process RAM. The empty-decision Ghost workload exercises missed-contact reconstruction, not the maximum possible decision/prioritisation workload. HTTP measurements use six simulated clients on loopback, not six physical laptops.

Measured scale results and median/p95 API timings are stored in `qa-stage6/performance-*.json`; `/system/benchmark` performs 20-second worker/WebGL checks and exports JSON. The default medium tier reduces pixel ratio; High/Medium/Low/Tactical 2D share identical 30 Hz tactical logic. Auto quality steps down after three consecutive FPS samples below 20 and never silently increases quality. Tactical 2D remains selectable; its paint FPS is explicitly unmeasured by this tool. The user-identified weakest available laptop was measured at all five counts; see recorded results below.

## Synthetic experiment

**SIMULATED TRAINING EXPERIMENT — NOT HUMAN EFFICACY EVIDENCE.**

The config was written before execution: 50 paired learners per policy, seeds 612470–612519, 30 sessions each, hidden independent skills drawn uniformly from .25–.75 and separate Beta(1,1) estimates. Production Thompson selection/templates and anti-repetition are compared with uniform random focus/template selection. Both use identical synthetic assessment uniforms and learning law: selected hidden skill increases by .08×(1−skill); mastery requires every hidden skill ≥.7.

This is an abstract Bernoulli assessment/selection model, not the tactical physics engine or calibrated human learning. Prespecified outcomes are mastery fraction, sessions among those reaching mastery (others censored), cumulative failures, final hidden mean, weakest-skill gain and immediate template repeats. Director reached mastery in 8/50 versus random 5/50; conditional median sessions 21.5 versus 28.0. Final mean skills were .7343 versus .7315 and mean failures 44.0 versus 44.9. The mean difference is small; no human-efficacy conclusion follows. All seeds, per-learner outcomes and full compressed trajectories are preserved without tuning the result.

```sh
.venv/bin/python scripts/run-experiment.py docs/qa-stage6/experiment-config.json docs/qa-stage6/experiment-results.json
```

See [config](qa-stage6/experiment-config.json), [results](qa-stage6/experiment-results.json), and `experiment-results.trajectories.json.gz`.

## Human evaluation tooling

`/evaluation` requires affirmative participant agreement, pseudonymous P01–P9999 labels and a joined trainee. It creates a balanced seeded 15-round Rapid pre-test, gates post-test on pre completion plus 3–5 actual adaptive completions, then runs a non-identical balanced 15-round post-test. Retries resume canonical sessions. The summary reports factual accuracy percentage-point differences, median response milliseconds, friendly false-hostile/bird confusion and drill error counts. No sensitive personal fields or causal claim are added. No human pilot has been conducted as part of this stage; automated/synthetic QA is not a participant study.

## Terrain, environment and audio

Authoring schema v2 enables `rural_forward_base@1` and `urban_outpost@1`; legacy v1 remains urban. Frozen snapshots retain terrain version. Rural terrain has reduced building density, open sectors, vegetation and a distinct illustrative restricted-sector preset (x<−70,z>0). Protected asset remains at the origin. Trees/buildings do not add unsupported occlusion or collision physics.

Fog 0–1 feeds the existing illustrative detection formulas and rendered visibility. Optical/thermal and modeled radar detection use existing engine multipliers; these are not measured weather physics. Rain is deferred because no supported rain-response model exists. Rural/fog changes have 54 additional Python/TypeScript parity checkpoints.

Local generated rotor-like WebAudio cues require an explicit Enable action and have mute control. Only currently detected, active non-bird contacts within 80 m produce cues; gain=.025×(1−distance/80)×(1−.5×fog), pan=clamped x/80, at most four voices. Pausing stops gain. Cues are immersive and non-scoring; they are not a new evidence channel or hidden ground-truth sensor.

## Common observations and recorded practice

Python `SensorSource.observations_at(tick)` and the TypeScript adapter normalize source, schema version, tick, track ID, sensor (radar/thermal/RF), availability/detection, position and supported RF/IFF evidence. The simulated implementation wraps current simulator output; RF/IFF readouts consume this representation. No hardware or external feed is connected.

`/recorded` imports JSON using [the bundled example](../client/public/examples/recorded-exercise.json). Every immutable import has `source_type=recorded`, SHA256 import hash and schema version. Bounds: 200 tracks, 20,000 samples total, 75 seconds at 30 Hz, finite bounded coordinates, increasing per-track ticks and unique IDs. Unsupported fields/sensors/timestamps are rejected. Samples are held for at most one second; gaps show no observation, not invented motion. No authenticity claim follows from an import hash.

Trainees may designate, classify and choose a response using supplied observations. Server-saved practice reviews compare classifications only when optional supplied ground truth exists. There is no tactical score, fabricated impact/effector result, Ghost counterfactual or skill-model update. Unknown ground truth yields no correctness value. A practice save is immutable and retry-safe.

## Portable bundles

`/transfer` exports unit metadata, pseudonymous profiles, frozen scenarios/doctrine snapshots, completed tactical event/command histories with cards/outcomes, completed Rapid reviews, and recordings. Unfinished sessions and personal callsigns are excluded. Labels for instructors are redacted. Installation-specific random namespaces prevent independent default `local` units from pooling accidentally. Imported pseudonyms remain stable on forwarding; zero-observation participants are retained with reconstructed Beta priors.

```sh
.venv/bin/python scripts/bundle-key.py data/bundle.key
VYUHA_BUNDLE_KEYFILE="$PWD/data/bundle.key" bash scripts/start-unit.sh
```

Distribute the same private key separately to trusted importing/exporting officers. Do not put it in Git or in a bundle. HMAC-SHA256 checks modifications by parties without that shared key; it is not non-repudiation, identity, or proof of authentic training. Missing keys fail clearly with 503. Never print/export the key. Changing key or discarding the installation namespace changes local export pseudonyms.

Imports verify HMAC/schema/version, reconstruct scorecards/skill outcomes and seeded Rapid evidence before an atomic transaction. Canonical session duplicates skip; altered IDs/histories/unit membership conflict and roll back. Profile estimates are rebuilt from validated outcomes; supplied snapshots are informational. At most 200 tactical/100 Rapid sessions and 20 recordings, 7 MiB export payload and 8 MiB request are supported. Bulk transfer allows a bounded two-minute response wait and disables duplicate submissions while busy; tactical API requests keep their six-second timeout. A lost response can safely retry the same immutable bundle. Overlimits fail explicitly rather than silently exporting partial history.

## Failure matrix and security limits

Existing and new suites cover duplicate/out-of-order batches, missing batches, stale/duplicate/cross-session commands, forged telemetry, malformed scenarios/packs, recording bounds/nonfinite/deep JSON, consent gates, completion/AAR/Rapid/Director retries, six simultaneous completions, bundle tampering even with re-signed inconsistent score/evidence, atomic conflict rollback, forwarding, installation identity isolation and backup/restore. Assertions preserve canonical card/outcome IDs, no duplicate Beta updates and reconstructed history. Browser process-loss/reload runs are documented independently from in-process API tests.

API POST bodies have an 8 MiB streamed cap, finite JSON values, depth ≤20 and ≤400,000 JSON nodes. Browser imports are bounded and errors displayed; uploaded filenames are not filesystem destinations. IDs/schema/path keys are bounded. React escapes labels. This is input hardening, not security certification. Trusted LAN prototype; no production authentication. Do not expose to public networks. Crew roles are deferred to protect the established single-client timeline; Current Stage 7 acceptance is recorded in FINAL-VALIDATION.md.

## Evidence artifacts

`qa-stage6/baseline.json` preserves pre-edit regressions. Final outputs/measurements, deployment, walkthrough and physical statuses are versioned alongside the evidence manifest. Generate after final checks:

```sh
.venv/bin/python scripts/release-evidence.py --backend /path/to/pytest.txt --frontend /path/to/npmtest.txt --build /path/to/build.txt
```

The manifest counts come from actual successful output. Parity families are exercised by frontend fixtures and listed separately. Its source-tree hash covers implementation, tests, scripts and locked dependencies. A mismatch renders an explicit warning; release manifests must be regenerated after changes. Physical pending statuses are never inferred from automated tests.

## Recorded release checks

Final source `856b43e` (tactical implementation `351fee2`, followed by an evidence-generator status correction): **133 backend tests; 44 frontend tests; 51 original + 72 Director + 135 advanced + 54 rural = 312 tactical parity checkpoints**. Recorded-source normalized observations also match across Python/TypeScript. The final checkout repeated all regressions: backend 18.41 seconds, frontend 6233.092083 ms and build 5.45 seconds. Production build passed with 22 local cached assets, fingerprint `b7928bbb7ed1`. The initial application chunk is approximately 260 kB (80.5 kB gzip); the shared 3D chunk remains approximately 899 kB (243 kB gzip) and retains Vite's large-chunk warning.

Fresh GitHub clone on the development Mac (macOS 27.0.1 arm64, Python 3.12.7, Node 25.2.1) installed its own virtual environment/node_modules. Setup was confirmed within 103.29 seconds, an upper bound including observation delay. Both local and Unit Mode startup passed after the older-Bash no-argument fix. Final cloned implementation also passed 133/44 tests and built in 8.38 seconds. This is a clean environment on the same physical Mac, not a second OS certification.

| Contacts | Development Mac medium FPS | Physical Android final Medium / Auto FPS | Python tick median / p95 ms | Python replay traced peak MiB | Ghost/replay/scoring median ms |
|---:|---:|---:|---:|---:|---:|
| 8 | 60 | 60 | .0203 / .0265 | .005 | 45.47 |
| 25 | 60 | 60 | .0613 / .0811 | .013 | 137.81 |
| 50 | 60 | 60 | .1213 / .1592 | .024 | 272.75 |
| 100 | 60 | 60 | .2427 / .3188 | .050 | 534.64 |
| 200 | 60 | 60 | .4890 / .6376 | .105 | 1063.79 |

Browser tests last 20 seconds; they do not certify long-duration load. The user identified this Mac as the weakest currently available team laptop. Hardware inspection identified MacBook Air (MacBookAir10,1), Apple M1 eight-core CPU and 8 GB RAM, macOS 27.0.1. A fresh fixed-Medium / Auto-off run in Codex in-app Chromium measured 60 median FPS at all five counts. Worker median / p95 ms: 8, 25 and 50 contacts below resolution / .100; 100 below resolution / .200; 200 .100 / .300. Zero means below browser timer resolution. `performance-laptop.json` records visible rounded UI values; the repeat export download observation timed out, so raw FPS samples and whole-process memory are not claimed. Manual 200-contact Tactical 2D fallback rendered correctly; its paint FPS is unmeasured. Android measurements were supplied by the user, with reported 6 GiB RAM and unspecified model/CPU. Auto remained at final Medium; raw samples are retained in `performance-android.json`. Browser-reported heap was coarse/constant and is not whole-process memory.

Six simulated advanced clients completed 18 canonical sessions. Loopback median / p95 milliseconds: upload **5.67 / 44.47**, command poll **2.84 / 7.88**, command issue **7.10 / 49.86**, command response **3.62 / 41.98**, scenario generation **34.39 / 88.61**, dashboard **113.74 / 393.21**, completion **83.32 / 176.74**, AAR **57.93 / 134.34**. Database-file growth was 3,192,840 bytes including SQLite side files; median replay payload 47,391 bytes, max 68,226. Server RSS was unavailable to the sandbox. These are local contention measurements, not WAN or field latencies.

All **18 existing production completions** retained their immutable session digest and exact stored scorecards. Four stored v0.1.0 and fourteen v0.2.0 cards reconstruct with identical numerical fields, with profile compatibility retained. A SQLite-safe private backup was taken before starting Stage 6 against that database.

The final synthetic browser walkthrough authored rural night/fog/decoy conditions, assigned the exercise, applied radar jam and no-RF FPV injection, recorded designation/classification/ineffective RF response, and recovered after a real server-process outage and paused cached loopback reload. Authoritative score/Ghost and Time Machine verified; the next adaptive drill used the updated profile and also survived active reload. A ten-round automated Rapid ID session and three-step unit analytics were checked. These QA timings/results are not human pilot data. Recorded JSON was imported through the UI, played to ten seconds and saved an unscored supplied-reference review. Portable export succeeded in UI; importing into the fresh-clone disposable unit inserted three canonical sessions and one recording, duplicate import inserted none, and tampering returned 422. Backup → post-snapshot mutation → new-file restore returned exact cards/profiles and excluded the later mutation.

| Failure injected | Verification actually performed |
|---|---|
| Server process stopped / response unavailable | Real browser drill continues; events queued; local pending completion; restart reconstructs same verified card and Ghost |
| Temporary transport loss / retries | Automated withheld/replayed batches and acknowledgement recovery; no physical LAN interface disable is claimed |
| Duplicate / out-of-order / missing batches | Canonical sequence, mutation/conflict rejection and completion gating; no duplicate outcome updates |
| Duplicate, stale, cross-session commands | Idempotent issue/ack; conflicting ack rejected; after-completion issue rejected; independent sessions isolated |
| Active and paused reload | Real loopback browser restoration from IndexedDB with active/paused exercise states |
| Completion and AAR retries | Actual browser workload rechecked; identical profile and three processed sessions retained |
| Six simultaneous completions | Automated tests and measured HTTP workload preserve 18 unique cards/outcome rows |
| Rapid and Director retries | Seeded sessions/decisions immutable; recognition outcomes applied once |
| Malformed scenario/pack/recording/JSON | Version/bounds/unknown-field/nonfinite/depth/size rejection; no accepted corrupted history |
| Bundle tamper/conflicting IDs | HMAC rejection, seeded/reconstructed-content rejection even when re-signed, atomic rollback and duplicate forwarding checks |
| Backup/restore | SQLite quick_check, exclusive new destination, real restored server returns exact AARs/Beta profiles |

The physical WAN-off check is NOT PERFORMED BEFORE SUBMISSION: Required physical/network setup unavailable during final validation window. The weakest currently available team laptop was identified and measured directly after the user clarified that it is the current MacBook Air. Android measurements remain separate device evidence. Stage 6's software candidate is stable; Release work may proceed with the dedicated WAN check documented as not performed before submission. Crew Mode remains deferred; Stage 7 release work is tracked separately.
