# Training Ground simulation station — development acceptance

25 October2026. Continues `feature/vyuha-next-generation` from `147ff45`; Theatre (`48c0d27`) and Academy (`4c9e6b6`) are retained. This is an integrated development milestone, not final release acceptance. Runtime/source and proof hashes: [receipt.json](evidence/receipt.json).

## What is actually implemented

Training now enters a real, contact-free 3D orientation instead of illustrated artwork inside a dashboard. One Canvas persists through mission preparation and Start. An authored, bounded arrival camera settles over the existing compound; reduced motion uses a stationary view through the existing LazyScene preference hook. Unprepared orientation explicitly uses daylight scenery and makes no claim about the eventual mission's conditions. The prepared mission displays its frozen environment; Start cuts immediately to the original sensor origin, aim and FOV. There is no scored flyover.

The live station prioritizes the world, keeps decisions in an adjacent stable instrument port and presents reported contacts/radar as contextual instruments. On1280×720, the world occupied930×574 and the decision port350×406, both in view without page scrolling. Small screens retain the observation stage then expose contacts/decisions through normal keyboard/touch navigation. Mission configuration is a focus-contained drawer, with a persistent native VR entry tool. Existing guided choices, action receipts, Fusion attribution, warnings and response rules remain App/worker-owned.

Opening mission controls requests local pause only after initialization. An actual paused→running transition closes/announces the drawer without overriding instructor authority. Escape closes and restores focus. Browser investigation found an inherited status paragraph spanning the controls invisibly; its bounds and pointer behavior are corrected. Pause/End are unavailable before worker initialization.

World lighting is also changed: the visible photographed sky, reflection mapping and bounded diffuse SH probe share orientation. A fixed64×32 CPU projection replaces part of generic fill rather than adding unbounded illumination. Original geometry, authoritative occlusion, sun/fog distances, thermal/IR policy and PMREM intensity remain unchanged. No new assets, runtime dependencies, cloud service, per-lamp lights or render passes. This is authored display-derived lighting, not calibrated radiometry or full global illumination. See [technical lighting account](SKY-LIGHT-RIG.md).

This is a major presentation/interaction upgrade, not a new simulation engine, high-resolution environment asset pack, active-sensing contract or demonstrated human-learning gain. The supplied world assets remain the existing locally bundled assets. Further world/aircraft content, inquiry semantics and instructional intelligence remain work.

## Focused checks and compatibility

| Gate | Actual result / scope |
|---|---|
| Integrated affected frontend run | **73 passed**, zero failures,7.258s. Training presentation/deck, actual App lifecycle, visibility, scene presentation, lighting, setup and premium integration. This is not the whole frontend suite. |
| Selected existing world/VR compatibility | **9 passed**, zero failures,1.954s: flat/authoritative ground, decorative exclusion, thermal/sun rules, adversarial observed-only VR projection, payload replay/scoring and XR lifecycle. No physical headset test. |
| Final drawer accessibility/lifecycle follow-up | **3 passed**, zero failures,2.324s after adding structural axe: focus/inert/Escape, one mounted world across phases, initialization refusal and instructor-resume closure. These are three of the73 tests, not three extra unique tests. JSDOM contrast excluded; no accessibility certification. |
| Incremental TypeScript / changed-file lint / formatting | Passed; registry projection passed14capabilities/48recommendations. Full backend/frontend/build/lint/Docker/parity were not repeated. Engine, score and historical-fixture files did not change. |
| Independent source review | Briefing isolation, immediate camera cut and accepted-action ownership reviewed. Reviewer found modal resume/init issue; it was corrected and tested. No new critical issue reported. Desktop visual review passed; initial mobile header issue was corrected and recaptured. |

Initial affected App run:14passed/3failed because configuration and VR controls had moved from the old DOM location. VR was retained as a direct tool; the Academy fixture now opens/closes actual mission controls and recognizes accessible icon labels, while preserving its frozen-ticket/no-hints assertions. Follow-up Fusion checks and Academy check passed, then the integrated73 passed. An initial root-directory invocation of the new modal test used the wrong JSX configuration; corrected client-directory invocation passed. Raw logs are retained, not presented as product failures or passing evidence.

Later orientation label/clock copy and bounded mobile CSS refinements did not change engine/action contracts; their browser checks and final TypeScript/lint/format were used rather than repeating unrelated suites.

## Actual browser workflows

Development preview8040 / disposable QA server8042, synthetic callsign ACADEMY-BROWSER:

- Recorded existing entry before modification; rendered the new actual environment and explicit Prepare/Start states. Scene remains one Canvas across those phases. Header distinguishes orientation from frozen conditions and does not advertise the initial legacy duration as a prepared mission.
- Prepared and started a Director mission. Verified pause after initialization, current reported contact selection, designation acknowledgment, explicit native type/identity radios, classification acknowledgment, Hold/monitor receipt and End exercise. Original server produced verified Ghost review. Operator choices were deliberately incomplete and scored0/100; this is workflow evidence, not successful reasoning or learning evidence.
- On1280×720, the active world and decisions fit. The first prototype put decisions below the fold; the adjacent port corrected that. Instrument status interception was reproduced with elementFromPoint and fixed; subsequent Start→Pause reached PAUSED with scrollY0.
- Mission controls, Escape and focus restoration checked at390×844. Phone/tablet CSS widths390/820 had matching body widths and visual scale1. This is viewport testing on the Mac browser, not physical phone acceptance.
- Night thermal, alternate palettes, IR-style and EO mode transitions are recorded separately in the final browser receipt. No physical headset, comfort or trusted separate-device HTTPS qualification is implied.

Images are actual browser captures. Intermediate dark orientation and older mobile/header prototypes are retained as intermediate evidence; only files explicitly labeled final are final layout evidence. The before/after world image uses the same1203.203125×400 CSS canvas and camera/workload; logical stop ticks differ slightly and this is not a pixel-difference or perceptual-equivalence experiment.

## Equivalent performance comparison

Owner-identified MacBook Air M1 (RAM unreported; native hardware query was denied), same browser,1280×720CSS/dpr2/scale1, fixedMedium, autoqualityoff, urban/day/trainee view, retained200 slow synthetic contacts,20seconds, unchanged0.4 engine. Canvas1203.203125×400CSS (Medium render ratio1). All runs retained200, had complete delivered tick samples, no measurement issue and zero visibility interruptions.

| Run | Median FPS | FPS sample min–max | Worker median / p95 ms | Ticks / timings |
|---|---:|---:|---:|---:|
| Before147ff45 |60|60–60|0.5 /1.0|599/599|
| Candidate |60|55–61|0.8 /5.7|597/597|
| Candidate repeat |60|60–60|0.5 /0.7|600/600|

The higher first candidate worker readings prompted one justified repeat. Keep every run; do not discard the slower one or attribute variation to an unmeasured cause. These sequential development trials support retained workload/rendering feasibility, not causal speedup, universal non-regression, frame-time percentiles, GPU memory bounds, cold-start readiness, a long soak or headset FPS. No performance-improvement claim is made. Raw reports and [comparison](evidence/performance-comparison.json) bind their actual source hashes.

## Remaining release and product work

Comprehensive frozen-release regression/build/offline/Docker/clean-clone acceptance remains open. So do physical Windows/Linux/Android/network/headset gates for the eventual candidate. No protected release/tag was modified and no new RC/stable tag was created.

Further work includes explicit renderer-readiness/asset-loading launch qualification, higher-quality authored world/aircraft content, broader day/night/optics and long-duration qualification, active evidence acquisition with a versioned projection contract, Mission/Scenario Studio and evidence-grounded instructional evaluation. Do not describe this milestone as the whole next-generation mission completed. The [research brief](../../competitive-research/TRAINING-GROUND-TRANSFORMATION.md) distinguishes source-backed direction from implemented capability.
