# Logistics Quarter — authored world acceptance

26 October 2026. Development milestone, not final release acceptance.

Runtime `ca10cc2fb2e09488e463246f751436054290e0d1`; source-inputs-v2 `a1754e4707d41965a1b700e7d2137916e05e095327a819d59f44c58a3075b40a`. Baseline `56baab647528fb9cd823706cf3ef8879e4365953`, independently hashed `2c8642fc99be9c4cc53394e5ec12810ecd25e1b2bcab570a17d7cf420d3780a9`. Baseline archive raw provenance remains unavailable; no receipt values were edited to imply otherwise.

## Delivered experience

One complete urban environment replaces the isolated outpost composition with an authored logistics quarter: recessed terminal and colonnade, pale facade reveals, entrance canopy, sawtooth sheds/clerestories, roof services, raised water tower, public forecourt, loading court, connected roads/pavements/crossings, planted avenue and street-facing skyline. Five new principal structures and twelve background buildings form a deliberate setting. The rural composition is unchanged. This is a major presentation subsystem slice; no claim of AAA photorealism or new physical simulation.

`world/logistics-kit.ts` owns original metric architecture; `layout.ts` owns the composition; `streetscape.ts` appends ground-level details; `world-manifest.ts` identifies presentation revision2 separately from the immutable engine contract. Environment appends all static architecture into existing material batches and existing EO/IR swaps. `contact-shading.ts` grounds new foundations. `obstruction.ts` supplies presentation-only solid cores, with raised tank/open tower legs distinguished. No new assets, decoder, library, network service or licensing dependency. Existing local maps and their CC0 notices are reused.

Authoritative sensor geometry remains the frozen scenario boxes. Existing world/depth/contact pass separation and browser/XR observed-position fallback remain intact. No scene roster, target identity, scoring, sensor cadence, event, Crew, Fusion, persistence or response model changes. Terrain, lighting, fog and InspectionPass inputs retain their prior behavior. Historical urban appearance can evolve; historical scores and observations do not acquire new scenery geometry.

## Focused verification

| Evidence | Result / final-source relationship |
|---|---|
| World/architecture/configuration selection |41 passed,0failed,17.42239425s (`targeted-world.log`) |
| Final visual/obstruction refinements |27 passed,0failed,8.160261666s (`authored-final.log`); overlap27 of41, not additional unique tests |
| Inspection/render-work/VR contracts |20 passed,0failed,2.095266417s (`presentation-compatibility.log`) |
| Distinct selected tests |61 across these selections. Remaining14 configuration/terrain checks not rerun after facade/skyline-only refinement; their source/contracts were unchanged. |
| TypeScript, changed-file ESLint/Prettier, diff whitespace |PASS |
| Independent review |Missing decorative obstruction mapping reproduced and fixed; intended facade rotations and formatting-sensitive assertion fixed.3 obstruction +10 architecture/world checks independently passed. No remaining reproduced blocker in reviewed scope; no audit score assigned. |
| Actual browser |Library → live EO/IR → pause/resume → explicit designate/classify/Hold → server-verified Ghost. Reported contact fallback visible against terminal at replayT+0.390/820CSS canvas with scrollWidth equal to viewport. |

Initial development failures were resolved: formatting-sensitive new source assertion; old perimeter test accidentally selecting expanded layout; and one harness invocation from repo root using classic JSX rather than the client tsconfig. The old concertina test still uses its original geometry and25k limit through `legacyUrbanOutpost`; the new complete composition has a separate200k budget. No historic score fixture or assertion threshold was weakened.

No unchanged complete backend/frontend/parity/history/security/Transfer/build/Docker suites repeated. Engine, sensor, worker, action evidence, Scene and VRWorld sources are byte-identical to baseline; full integrated acceptance remains a frozen-release gate. Source comparison is not a fresh historical-scorecard execution.

## Real browser evidence

The immutable synthetic `raid_a905818e6af71954d933860a` was inserted only into the existing disposable QA database, without overwriting scenarios or sessions. Seed script and exact JSON are retained. This does not qualify a new authoring interface or officer authorization.

- `6ae1429d-52f2-42c6-be95-0afbe5974e65`: ended at863ticks/28.77s,0accepted actions, completed/server verified0/100. Ghost atT+0 showed the diamond and “VIEW BLOCKED BY SCENERY” for reportedT2.
- `d1a29d0a-90f0-4e85-a903-31535dd2c68b`: ended2503ticks/83.43s; server stored exactly designateT2 tick967/order0, classifyquad/friendly tick1276/order1, Hold tick2099/order2.0/100 because the hostile was deliberately ignored. This verifies workflow and attribution, not training efficacy or expert performance.
- EO27px/IR18px observed at250m; manual pan suppresses the off-axis close-up. A live obstruction probe was paused after the orbit had moved clear; `live-blocked.jpg` retains that probe, and is **not** claimed as a blocked-view pass. The blocked-view proof is `ghost-blocked.jpg`.
- `before-urban-entry.jpg`/`final-entry.jpg` use the same frozen scenario, public arrival camera and day/fog configuration. They were captured at different wall times; this is visual composition evidence, not a pixel-difference oracle. Earlier adaptive `before-entry-unmatched.jpg` is retained separately.
- Independent visual critique found a meaningful composition change and no visible clipping blocker. Terminal shading remains dark and far-world composition relatively sparse; further art-direction work remains justified. Global JPEG softness affects old/new captures and does not establish native font sharpness.

## Performance and costs

User-identified MacBook AirM1, observed arm64. Current CPU/RAM sysctl was denied; RAM not remeasured. IAB Chromium156,1280×720CSS,DPR0.9/90%zoom,Medium fixed,autooff,urban/day,200retained contacts,20s. Existing benchmark, synchronous texture mode. No hidden settings or resolution changes.

| Run | Median FPS | FPS-bin min–max | Worker median/p95 ms |
|---|---:|---:|---:|
| Baseline overview |60|56–61|0.500/1.100|
| Candidate initial overview |60|18–61|0.500/1.400|
| Candidate warmed overview |60|52–60|0.500/1.100|
| Baseline trainee origin |60|45–60|0.600/2.900|
| Candidate trainee origin |60|46–60|0.600/2.800|

Candidate initial Run was clicked while “Loading local3D renderer” remained, whereas baseline was already loaded: only17FPS samples, retained honestly. This is an uncontrolled startup observation, not a matched cold-start result. Warmed candidate20samples are separate. No speedup, uniformly smooth frames, startup improvement, input-latency, GPU or headset-FPS claim. A retained observer run without selection falls back to overview and is not independent camera coverage. All retained runs kept200active contacts, complete tick timings,0visibility interruptions/clock drops and no benchmark issue. Single runs per named state; workstation contention/JIT/cache/order are uncontrolled.

Static facility geometry grew64,910→155,368triangles and8.57→20.51MB attribute arrays, still15material batches. This excludes props, foliage, box dressing, GPU and total memory. Single CPU construction333.5→422.1ms is order/JIT-biased, not a speed claim. Richer scenery has a real cost. Whole-startup, long-tail frame timing, memory stability and weak-device qualification remain open.

## Remaining gates

Active observation requests, new evidence timing/scoring and a new sensor engine are **not implemented**. [Research contract](../../competitive-research/ACTIVE-OBSERVATION-CONTRACT.md) identifies versioning, logical dwell/release, anti-reroll, historical parity and browser/Crew/VR requirements. Current camera crop remains presentation-only. No empirical calibration or human learning gain is claimed.

Physical Windows/Linux/Android/headset, trusted separate-deviceHTTPS and final-candidate WAN-off remainPENDING. Fresh100%zoom readability is not qualified by90%IAB captures. Full frozen-source regression/build/offline packaging remainPENDING. No RC/tag/release/baseline merge created. Protected releases preserved.

During navigation testing, a pinned-review → Next drill transition returned to the pinned review once. This is a separately tracked navigation probe; investigate/reproduce with focused ownership tests before closure. It does not invalidate geometry or the raw performance source pin.

Run existing development command from the repository: `bash scripts/dev.sh`. QA preview during this session is `http://localhost:8040` using disposable data/API8042; that fixture is not seeded into the owner's normal database.
