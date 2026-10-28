# Active observation v0.5 — integrated development acceptance

Validated source: **a6d209e76b225eab8e05b474dec691579d7d20f3** (2026-10-28, Asia/Kolkata).
Implementation: **733c6f8581c164ea287824aa8fda2580094922ac**. Equivalent-output CPU optimization: **37e2339db58000db6e02ed005b42db27c6375feb**. c50b989 adds only the reproduced narrow replay-button wrapping correction; a6d209e updates capability metadata and adapter limitations. The final production UI was exercised at c50b989; runtime code is unchanged in a6d209e. This is a development milestone, not whole-product acceptance or a release candidate.

## Working vertical slice

Academy opt-in entry → explicitly prepare a frozen v0.5 exercise → radar-observed alias → select → request EO/IR → logical dwell → cadence sample → delayed publication → inspect availability/resolution/age → explicitly designate/classify/respond → complete → server-verified Ghost → request/sample/release/decision seeking → changed seed/conditions practice.

`server/acquisition.py`, `server/engine_v3.py`, `client/src/sim-v3.ts`, the shared worker/action ledger, `AcquisitionStation.tsx`, `AcquisitionReview.tsx`, `ReviewTheatre.tsx`, `App.tsx` and Academy implement that path. The authoritative event is an `inspect` intent, not a client-uploaded sensor result. The server regenerates results. RF/IFF/radar retain their frozen existing passive models; EO/IR publication is explicitly request-gated.

The default practice freezes one optical task slot, 30-tick dwell, cadence aligned to the frozen sensor, 6-tick release latency/cooldown and 90-tick evidence expiry. The engine is bounded to 1–20 contacts and 60–180 seconds. The product entry currently authors three contacts and 90 seconds. No new assessed lesson or mastery catalog was admitted. Request/crop/pointing counts do not award credit.

## Actual browser evidence

All workflows used a disposable local QA database, never the original data/vyuha.db. Browser interactions used the actual UI, without injected application state or fabricated worker messages.

| Journey | Actual evidence | Result |
|---|---|---|
| Final production-source end-to-end | `b66509b5-3952-4356-9126-0e71440ae8aa`; Academy entry, prepare/start, radar T1, IR request 4.13s, sample 5.20s, release 5.40s, designation 5.73s, explicit quad/hostile classification 8.03s, RF response 8.50s; observed end 9.03s | Server verified; unchanged rubric 100/100; one accepted query; three decision Fusion receipts, none attributed to the query |
| Evidence integrity in final Ghost | `v05-production-sample-final.txt`, `v05-production-release-final.txt`, `v05-production-ghost-corrected.png` | No optical report at 5.20s; IR detect at release 5.40s; no identifying silhouette/affiliation asserted |
| Expiry is meaningful | Same final production recording; expiry 8.40s | Classification had current detection-only evidence; response did not. Ghost reports 1 of 2 classification/response decisions without current released optical detection. A high rubric score does not establish sufficient identity evidence or trainee knowledge |
| Earlier positive path | `7ee3d567-af2d-41eb-9a59-aa921f8d8e81`, 99/100; request 4.77s/sample 5.80s/release 6.00s/expiry 9.00s | Saved history reopens on final production source; both later decisions were after expiry, explicitly described in Ghost |
| Real server-process outage | `aa312a1c-e59c-4a88-9e9f-979c21c9147b`; server stopped, local worker requested EO at 11.27s, sampled 12.30s, published 12.50s | Night EO returned unavailable; duplicate button disabled; same QA DB/server restarted; exactly one accepted query resynchronized; completed and server verified |
| Mobile interaction | `v05-mobile-keyboard.txt`, production mobile artifacts | Keyboard EO request accepted once; observed-only contact selection; 80px optical request controls; console and contact dock separated |
| Keyboard scroll | Final production `.acquisition-console`, focused aria label `Active observation instrument` | End navigation reached scrollTop 289.55 with scrollHeight 550/clientHeight 261; keyboard reaches lower evidence while actions are disabled |
| Narrow replay return action | `v05-production-replay-wrap.json` | 208.53px button inside 234.18px parent, normal wrapping; scrollWidth equals clientWidth (207px) |
| Academy return/follow-up | Real links and `v05-academy.txt` | Changed seed/night exercise and return to Academy work; no assessed sessions/mastery were invented |

The initial development journey exposed a review cursor crash when the cursor preceded known completion time. The corrected client bounds completion against the scenario horizon and applies cancellation only at the reached event frontier. Regression tests and the final production walkthrough verify the fix. Initial reloads also exposed repeated excluded-practice profile backfill under a SQLite writer lock. The final profile query filters v0.5 before reconstruction; the dedicated test and legacy backfill tests pass. Subsequent real production navigation/join/prepare worked.

Mobile viewport evidence records **actual CSS geometry**, not assumed zoom. One measured narrow case was 389×843 CSS pixels; body scroll width rounded to 390, console bottom 701.28, dock top 714.52. Requested viewport dimensions differed from CSS dimensions because browser/tool scale varied. No 100%-zoom, physical Android or tablet certification is claimed. Earlier tablet/desktop images are development evidence; final production Ghost and mobile checks are explicitly named. Several browser-control interruptions and one locked-Mac interruption were recovered; they are not silently counted as app passes.

## Twelve integration risks

| Risk | Closure / scope | Source and proof |
|---|---|---|
| Duplicate dispatch/reroll | PASS | synchronous UI guard, stable request ID, owned worker receipts; scheduler duplicate/busy/sample dedup; engine/worker/UI tests; one persisted offline query |
| Rejected request stuck | PASS | matching rejected receipt clears guard; UI regression rejects first request and accepts retry |
| Selection/session association | PASS | task retains original alias on selection change; station keyed to worker/session scope; request/channel included in action ledger matching; targeted tests |
| Pre-release evidence | PASS | only released samples projected; final browser sample/release seeking; 76 Python/TS checkpoints |
| Expiry | PASS | explicit EXPIRED display and strict expiry comparison; both real positive recordings reveal post-expiry decisions |
| Hidden truth/affiliation | PASS for this slice | station consumes public observations, not canonical labels; detection-only result says type/affiliation unestablished; original reference world remains separately labelled |
| Fusion query attribution | PASS | App logs inspect intents through the shared action ledger with null advice/confidence; final recordings retain three decision receipts rather than query receipts |
| Same-tick ordering | PASS | scheduled-before-external-v1 global order; parity and same-tick fault/Fusion tests |
| Stale preparation/draft/result | PASS within covered browser adapter | explicit entry and engine marker; scoped component; worker restore/finish/cancel tests; old prepared lesson/catalog path retained |
| Legacy accidental admission | PASS | version dispatch, legacy inspect endpoint 422 before persistence, old engine denies acquisition payloads; briefing does not override a frozen legacy ticket |
| Crew/VR unsupported | GATED | Crew retains exact v0.4 admission; VR entry disabled and adapter rejects v0.5. Autonomous reference acquisition policy likewise explicitly not admitted |
| Browser/server agreement | PASS | four day/night/fault/cancel fixtures, 76 checkpoints; equivalent-output replay of actual positive and outage histories after optimization |

## Focused test ledger — do not sum overlapping reruns

| Run/artifact | Result | Applicability |
|---|---|---|
| `v05-optimized-backend.txt` | **12 passed**, 11.45s | All new v0.5 API, ordering, cancellation, Fusion, transfer/duplicate, practice isolation and profile regressions after CPU optimization |
| `v05-optimized-client.txt` | **7 passed**, 6.4348s | v0.5 Python/TS parity (76 checkpoints/4 scenarios), worker restoration/duplicate/cancellation, cursor horizon, review and station integration after optimization |
| `v05-final-targeted-client.txt` | **9 passed**, 11.211s | Includes reference summary/explicit v0.5 gating, before the output-equivalent raw-report optimization; subsequent 7-test run rechecks the affected engine/UI paths |
| `v05-scroll-test.txt` | **2 passed**, 1.712s | Latest station keyboard-focus addition and receipt labels |
| `v05-profile-compatibility.txt` | **3 passed**, 2.45s | Existing completion idempotence, legacy backfill/corrupt exclusion and invalid-preview profile protections after SQL change |
| `acquisition-final-backend.txt` | **17 passed**, 47.56s | Earlier combined new/affected backend run retained with its source chronology; not presented as a new full-platform run |
| `v05-client-final-focused.txt` | **31 passed**, 12.827s | Shared action ownership, original worker protocol, mission frame, VR gates; before equivalent-output optical optimization |
| `v05-client-compatibility.txt` | **3 passed**, 63.408s | **544 old v0.4 parity checkpoints across 32 scenarios**, exact released trace/score, invalid model/horizon rejection; frozen old engine bytes unchanged afterward |
| `v05-source-37e2339-build.txt` | PASS, 5.93s bundling; 77 local assets | Full TypeScript/production build after functional and CPU changes |
| `v05-source-37e2339-lint.txt`, format artifact | PASS | Changed integration/engine/review files |
| `v05-replay-css-build.txt` | PASS, 8.11s; 77 local assets | Final CSS-only fix; no unrelated backend tests repeated; actual rendered button retested |
| `v05-registry-tests.txt` | **22 passed**, 3.29s | Updated capability metadata and source-scoped proof admission/download checks |

One Starlette/httpx deprecation warning remains. An early focused invocation could not write pytest cache because of sandbox scope; subsequent runs disabled that cache provider. No test was weakened. Full backend/frontend, all-platform security, Docker, clean-clone and complete physical acceptance were **not rerun** during this development slice. The dedicated original 18-baseline/22-stored scorecard suites were not rerun; instead the affected old-engine parity and exact released trace were retained, and frozen engine/source/database integrity was checked. Comprehensive release regression remains required at a frozen candidate.

## Performance — measured costs and matched improvement

The initial v0.4-versus-v0.5 native run showed an overhead, not a speedup (`acquisition-native-performance.json`). Preserve that result. Profiling then identified whole-observation deep copies on every 30Hz tick as a large extra cost. The frozen base engine creates replacement observations each tick; the v0.5 adapter now retains private channel references and deep-copies at the actual sample boundary. Public/released samples remain detached.

Matched baseline **733c6f8** versus optimized **37e2339**, identical frozen scenarios, alternating execution, loaded Darwin arm64/MacBook Air M1 workstation:

| Workload | Baseline median | Optimized median | Scope |
|---|---:|---:|---|
| Python, 3 contacts / 90s | 0.6158s wall / 0.6118s CPU | 0.4200s wall / 0.4167s CPU | Three pairs; about 31.8% lower wall time |
| Python, 20 contacts / 120s | 3.9753s wall / 3.9330s CPU | 2.3357s wall / 2.3200s CPU | Three pairs; about 41.2% lower wall time |
| TypeScript/Node, 3 contacts / 90s | 162.78ms | 128.20ms | Five pairs; about 21.2% lower median stepping time |
| TypeScript/Node, 20 contacts / 120s | 1056.58ms | 689.26ms | Five pairs; about 34.8% lower median stepping time |

Raw repetitions, ranges, frozen scenarios, fingerprints and method are preserved. Each matched run asserts complete final output equality; two actual browser histories were replayed equivalently in Python. A 3.719s baseline Node outlier is retained. These are native reconstruction/stepping measurements, **not browser frame-time distributions, GPU benchmarks, memory certification, headset FPS or human learning gains**. Do not compare the later paired medians directly with earlier differently loaded runs. v0.5 does not admit 200 contacts; old 200-contact graphics evidence belongs to its old engine/source scope.

## Preservation and remaining scope

The original database hash, size and mtime remained unchanged: SHA-256 `7a479420d31de3fa40eb27ab149981c7bca4f98e239095cd0372a223fcb5dc13`, 307200 bytes. The QA database is not committed. Frozen legacy/v0.4 engines, sensors and catalog files retain their original bytes. Protected release/browser refs are recorded in the manifest and remote receipt; no tag or release branch was created or updated.

This slice completes the first browser-only active-observation capability. It **does not complete Flagship A, B or C**. Remaining coordinated work includes richer authored observation challenges and a versioned new catalog admission; instructor/crew acquisition episodes; a validated autonomous acquisition reference policy; defensible competency/progression evaluation; wider environment/lighting/camera/route transformation; XR acquisition interaction and physical testing. Follow-up suggestions here are transparent timing heuristics, not calibrated adaptive instruction or causal proof of learning.

The three-second default expiry is intentionally frozen and visible but requires usability/educational evaluation; no empirical calibration is claimed. Fresh physical Windows/Linux/Android, final-candidate LAN HTTPS/WAN-off and headset acceptance remain pending. No physical claim from an older candidate is promoted to this source.

## Run / inspect

The current disposable production QA is at `http://localhost:8052/academy`; choose **Enter active observation practice**. It uses temporary QA data, not the historical database. For a normal existing local installation:

```bash
cd /Users/seemalanaveenyadav/Desktop/SIH/vyuha/work/finale/ultimate-experience/browser-vr-unified
VYUHA_PORT=8054 bash scripts/start-local.sh
```

Then open `http://127.0.0.1:8054/academy`. Preparation and Start remain separate explicit actions. First-time setup may need dependencies and officer provisioning; do not overwrite existing credentials or data.

Design references already verified in this mission: [Three.js responsive rendering](https://threejs.org/manual/pages/responsive.html) informed the distinction between CSS viewport and drawing-buffer measurements; [NASA Open MCT](https://ammos.nasa.gov/openmct/) informed the explicit common logical-time reference. These are design inferences, not copied assets/code or evidence of validated learning outcomes.
