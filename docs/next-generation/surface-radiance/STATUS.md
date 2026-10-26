# Surface radiance experiment

26 October 2026. Runtime `2f4dfdfefa3ff328791a4ef766a510b0c07bc90e`. Exact source-inputs-v2 `19b7594c58fb245341d36c8a131aff2a2829fbf6409a705216802281824bccae` independently recomputed from its Git archive. The raw candidate benchmark was captured before commit with that same source hash and dirty=true; its raw fields are retained unchanged. Baseline `f1714e0`, independently hashed `1e4f24386affe1a44b9393526c603c2c3785e89275685f46ac7452ddff365b72`.

Medium/High EO ground now uses standard dielectric lighting, linear packed roughness/AO and existing soil/gravel normal maps. Mask-aligned normal blending, distance fading and neutral missing-map fallbacks are explicit. Low and all thermal ground shader programs match eight exact frozen baseline hashes. No geometry displacement, new assets, sensor or scoring change. EO ground participates in existing shader preparation. Global scene environment intensity is used; the initially misleading per-material intensity setting was removed after installed Three r180 source review. Lambert was already per-fragment; no vertex-lighting defect is claimed.

27 focused surface/lighting/configuration tests passed (0 failures,0.922s); TypeScript and changed-file lint passed. Two independent review findings were fixed: scene.environment overrides the unbound per-material intensity, and a missing overlay normal must blend flat rather than inherit another surface's normal.

The matched loaded200-contact Medium runs both measured60medianFPS at1152×648CSS/DPR1, auto quality off, retained roster, urban/day, trainee camera,20seconds. Wide-view appearance changes are modest: a bounded dielectric/roughness/normal response upgrade, not a dramatic world transformation or empirical realism claim. Near-ground captures are supporting inspection; their tool image dimensions differ, so they are not a pixel-matched comparison.

| Loaded measurement | Baseline | Candidate |
|---|---:|---:|
| Median FPS (20 one-second samples) |60|60|
| Worker median step |0.500ms|0.500ms|
| Worker p95 step |1.000ms|1.400ms|
| Training-phase frame p50 |16.7ms|16.7ms|
| Training-phase frame p95 |19.4ms|19.6ms|
| Training-phase frame p99 |21.3ms|22.2ms|
| Training-phase max interval |23.7ms|23.1ms|
| Training intervals >50ms |0/1020|0/1020|
| Loaded Run→first frame |24.4ms|27.4ms|
| Main-page JS heap snapshot |96,852,301bytes|111,757,082bytes|

FPS and frame traces are separate browser captures using the same workload/settings;1020 is the bounded training-phase trace, not a fabricated full20s raw frame count. Neither trace dropped samples or ignored background frames. The loaded first-frame boundary is **not cold application startup**. The heap snapshots are single lifecycle-dependent main-page readings, excluding Worker/GPU/total device memory. They do not establish retained material memory cost or a memory improvement. Existing image channels are now bound for rendering; GPU uploads/residency and shader-program cost were not independently measured. No new asset files/downloads were added.

Preparation traces are retained, including the candidate's slower observed world-build samples (376.9/398.8ms versus296.4/332.6ms). Those captures have different cache/JIT/lifecycle conditions and the candidate preparation overlapped focused test execution. They cannot isolate a material startup regression or improvement. Candidate whole-window preparation also includes long tasks; the clean loaded training-phase figures must not conceal that. Separate shader-compile time was not instrumented. No startup-speed claim is made.

High EO and Low thermal were rendered and inspected in the actual browser (`high-eo.png`, `low-thermal.png`), with no new shader error observed. Older baseline dev-server/WebSocket failures remain distinguishable from this check. Low EO and all IR source-program compatibility are covered by the exact frozen shader hashes; a full matrix of physical GPU/platform runs was not performed. Existing sensor/inspection/render-work/VR checks passed20/20 in addition to the27 surface/lighting/configuration tests; these are distinct focused selections, not a full-suite claim.

**Disposition:** retained on the development branch as a modest surface-material upgrade with comparable measured loaded pacing. This is not a qualified rendering release or proof of whole-app60FPS. Broader GPU memory, matched cold preparation, thermal calibration and weaker-device qualification remain limitations. An uncontrolled full-training inspection also showed a29FPS counter; that different layout/workload is not replaced by the bounded benchmark result. No full unrelated regression/build or physical qualification claimed. The next integrated milestone moved beyond surfaces into the [evidence investigation](../evidence-investigation/STATUS.md), rather than prolonging material experiments.
