# Authored sky-light rig candidate — 25 October2026

Approved scope: three owned files only: new client/src/world/world-lighting.ts, new client/src/world-lighting.test.ts, and client/src/world/Environment.tsx. Apply world-lighting.patch or copy these files only. Staged against the clean147ff45 Environment; source-sha256.json identifies delivery contents. No root source was edited by this agent, no commit, package/asset change, browser or GPU work, build or full-suite test.

## What changes

Visible sky, diffuse probe and PMREM reflection now share the sky's existing azimuth. The source photo is mapped onto SphereGeometry with U opposite to PMREM's equirectangular convention. The reflection/probe composition canvas is therefore mirrored horizontally, and scene.environmentRotation uses the existing sky yaw(-2.35rad). Both photographed sky sun metadata fixtures match the transformed coordinates. The actual sky/materials/geometry are unchanged.

A bounded64x32 CPU projection produces nine RGB SH coefficients for each of the already-loaded sky images. The input is tone-mapped WebP: this is authored display-derived lighting, not recovered HDR or empirically calibrated outdoor illumination. Existing full environment canvas/PMREM generation stays at its current512x256. Additional samples are2048 per sky/4096 total; no GPU readback, cubemap render, new render target, extra geometry, draw pass, lamp light or network dependency.

The probe REPLACES part of the old hemisphere+ambient fill, while PMREM diffuse/specular intensity stays unchanged. Each color channel is normalized against that replaced upward fill; directional terms are damped if necessary, and an analytic polynomial bound caps all-normal irradiance without relying on sampling a few test directions. PMREM remains an artistic existing contribution, not counted again as an entirely new diffuse layer. No claim of physically complete energy conservation is made.

## Before/after settings

| Setting | Existing | Candidate |
|---|---|---|
| Day direct light/color |2.6/#fff2dc|unchanged|
| Night EO direct light/color |0.12/#9fb4d6|unchanged|
| Day/night PMREM intensity |0.65/0.25|unchanged|
| Day/night generic ambient |0.06/0.06|urban0.0228/0.036; rural0.018/0.033|
| Day/night generic hemisphere |0.55/0.06|urban0.209/0.036; rural0.165/0.033|
| Replacement SH share |none|urban62%day/40%night; rural70%day/45%night|
| SH maximum per-channel irradiance |none|0.6day/0.065night, conservatively bounded for every unit normal|
| New probe intensity |none|1when valid EO probe;0for thermal/IR or fallback|
| Thermal/IR direct/hemisphere/probe |0/0/no probe|0/0/0; ambient remains0.06, environment remainsnull|
| Reflection orientation |unmirrored source, environment yaw0|mirrored source, environment yaw-2.35 matching visible sky|
| Fog distance/color, exposure, shadow maps |existing|unchanged|
| Ground/sensor/obstruction/contact geometry |existing|unchanged|

A failed canvas probe read or invalid/black field keeps original hemisphere and ambient fill. The mutable scene environment, rotation, intensity, fog, renderer clear color/alpha are snapshotted in layout effect and restored on cleanup; new probe contribution is zeroed. CPU coefficients are context-local fresh values, not global GPU/asset caches; shared profiles are deeply frozen. Mode switches copy into the renderer-owned probe rather than mutating prepared SH values.

## Focused validation completed

- `node --import tsx --test src/world-lighting.test.ts`:10/10 passed,988ms runner total (tests.txt).
- Strict targeted TypeScript including Environment/module/test:exit0, empty types.txt.
- Targeted ESLint --max-warnings0 on those three files:exit0, empty lint.txt.
- Tests cover constant radiance→analytic pi irradiance; known linear directional field→cosine convolution; yaw/periodic symmetry; both source sky sun directions; bounded sample work; fill-replacement accounting and unchanged PMREM intensity; conservative all-normal positivity/cap under extreme directional input; black/invalid fallback; thermal/IR state; frozen profile and coefficient ownership; previous scene/clear-state restoration.
- No benchmark/performance or visual acceptance claim. Existing environment_reflections diagnostic span includes CPU sample projection. This agent's CPU-heavy work ends with delivery.

## Required parent visual/performance qualification

Use fixed before/candidate source, viewport,tier,engine,scenario,logical tick and camera origin. Compare day EO,night EO,white/black/colored thermal and styledIR against identical tiny observed contacts, including detect/recognise/identify, held/lost observations and decorative obstructions. Check sky sun direction and specular highlights, facade/ground volume, bright/shadowed normal cases and no thermal regression. Capture setup CPU, total startup, shader warmup, long frames/input tails, framebuffer and resource counts; do not infer a performance win from unchanged drawcalls.

Exercise terrain/quality/day-night/channel switches, repeated entry/exit, context loss/restoration and offline startup. Check persistent-root integration does not leave another Environment or stale lights. Physical XR enter/exit/re-entry and per-eye/contact contrast remain separate acceptance; existing XR shared-world semantics are unchanged in source but not tested here. Root owns browser and benchmark work.

If the candidate is not visibly better or harms observation/latency, adjust or reject it. Analytic correctness does not establish perceptual quality or training effectiveness.

## New primary references, inspected without running demos

- Three LightProbe contract: https://threejs.org/docs/pages/LightProbe.html — diffuse light-probe/irradiance semantics. Local pinnedr180 LightProbeGenerator, SphericalHarmonics3 and shader chunks were inspected for linear-color conversion and polynomial conventions; no source copied into our module beyond calling Three APIs and documenting polynomial bounds.
- Three scene lighting contract: https://threejs.org/docs/pages/Scene.html — environmentIntensity and environmentRotation semantics. Local SphereGeometry and WebGLMaterials/PMREM code establishes the coordinate conventions tested here.
- Filament PBR reference: https://google.github.io/filament/Filament.md.html — separates material response, direct light and image-based indirect light; production-oriented mobile cost constraints. Concept evidence, no Filament runtime/dependency/assets imported.
- Epic SkyLight documentation: https://dev.epicgames.com/documentation/unreal-engine/sky-lights-in-unreal-engine — matching visible sky to diffuse/specular environment, precomputation and its limitations. This candidate is a low-order unoccluded sky probe, not a reproduction of Unreal's local occlusion or multibounce GI.
- Epic environment lighting tooling: https://dev.epicgames.com/documentation/en-us/unreal-engine/environmental-light-with-fog-clouds-sky-and-atmosphere-in-unreal-engine — coherent authored environmental components rather than unrelated effects. Concepts only, no UE code/art imported.

No prior NASA/WebGPU findings were repeated. Existing local photo asset provenance remains unchanged (PolyHavenCC0 in sky metadata). Three is already the application's renderer; no new licensing surface from an external asset/tool was introduced.
