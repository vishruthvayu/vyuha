# Flagship B — authored daylight finish and attributable rendering

This is an integrated development slice, not completion of Flagship B or a performance acceptance claim. Original synthetic geometry and the existing licensed local textures remain in use. No new third-party asset, shader package or rendering engine was added.

## Limitation → implementation

The existing world already uses physically based Standard materials, ORM/normal maps, photographed skies, bounded spherical-harmonic diffuse fill and PMREM reflections. This work does not claim to introduce those techniques. The authored campuses had origin-centred square shadow cameras and repeated scan-texture appearance across large façades.

The new presentation keeps WebGL/R3F and the three-pass exact-AABB occlusion policy. `authored-shadows.ts` fits the existing daylight map in sun-camera space to public architectural and decorative support bounds, including ground-projected receivers. Its target and orientation remain aligned with the photographed sun. No camera, contact, logical time or future evidence enters the fit. Legacy shadow profiles, static refresh scheduling and the 2048² authored-site map remain unchanged.

`facade-radiance.ts` finishes cloned authored plaster, concrete, painted metal and corrugated metal with broad metric pigment variation, soft runoff, lower-wall weathering and bounded roughness. Existing Standard diffuse/specular lighting remains in control. It adds five sine operations and one varying, no texture lookup, draw, geometry, displacement, alpha/depth change, extra light or render target. Actual fragment/driver cost remains a browser measurement requirement. Unsupported future Three shader chunks retain the complete stock shader instead of receiving a partial patch.

Low and Tactical retain their material policy. Thermal twins are created by the original Basic-material path and do not copy the EO compile hook; tests compare their vertex/fragment shader strings exactly before and after applying the finish. Decorative scenery cannot change the authoritative depth proxies. The architecture cache, its keys, budgets, cloning and disposal remain untouched.

## Implementation-linked primary references

The version-matched [Three r180 shadow manual](https://github.com/mrdoob/three.js/blob/r180/manual/en/shadows.html) explains that map coverage and resolution jointly determine shadow quality and that each shadow light adds a render pass. That supports fitting the existing static map instead of adding shadow lights or raising its resolution.

[Three r180 Material documentation](https://github.com/mrdoob/three.js/blob/r180/docs/api/en/materials/Material.html) documents `onBeforeCompile`, custom program keys and the fact that compile callbacks are not copied by clone. The finish is therefore explicitly installed after cloning the authored dressing material, with a stable program key and stock-chunk compatibility guard. The installed r180 Standard shader chunks were inspected directly and covered by focused tests.

[Three r180 WebGLRenderer documentation](https://github.com/mrdoob/three.js/blob/r180/docs/api/en/renderers/WebGLRenderer.html) documents `info` and manual reset for multi-pass accounting. The existing renderer already disables auto-reset and resets once before its three main passes. Diagnostics sample that aggregate, without adding WebGL queries or readbacks.

## Narrow measurements

The fit occupies 825,379 m² in light space (994.64 × 829.82 m), versus 1,716,214 m² for Freight and 1,048,581 m² for Campus. These are calculated coverage areas: 48.1% / 78.7% of the old area at the same 2048² resolution. They establish denser shadow texels, not a measured GPU speedup or guaranteed visual acceptance. The support test projects every authored volume corner and its ground shadow through the actual fitted camera.

Geometry remains exactly 19,500 / 13,332 Medium triangles and 2,574,000 / 1,759,824 attribute bytes for Freight / Campus; High and Low retain the existing budgets. No additional geometry enters either scene.

The reproducible alternating Node preparation experiment is in `evidence/benchmark-graphics-preparation.ts`; unfiltered results and source hash are in `evidence/graphics-preparation-cost.json`. Eight samples of 100 warmed preparations measured candidate medians of 0.066 ms / 0.050 ms versus stock setup 0.006 ms / 0.005 ms. This isolates CPU shadow-fit/material-clone/shader-string setup only. It excludes renderer construction, shader driver compilation, uploads, frames and GPU work. Concurrent host load was not isolated. It is an added setup cost, not a speedup.

Focused tests cover new behavior, installed stock chunks, Low/Tactical/thermal preservation, fallback failure handling, existing public geometry/cache, sky lighting and diagnostics. The retained log reports 35 passing cases. Changed-source ESLint and formatting passed. Final integrated typecheck/build and real browser acceptance belong to the root integration receipt; staged dependency symlinks are not deliverables.

## Diagnostic meaning

`renderer_cpu_submit` measures CPU wall time around scene graph update, clear and the caller's three main render submissions. It is neither GPU execution time nor total frame CPU time. Optical inset or later callbacks are excluded if they run after the sampling point. `world_shader_prepare` separately records synchronous shader warm-up wall time and preserves exceptions/cleanup.

Counter snapshots contain only calls, triangles, lines, points, geometry objects, texture objects and program count, at most every 250 ms, capped at 1024 rows and the existing four-minute capture window. They do not measure GPU allocation bytes or JS heap. The existing timing sample cap remains unchanged and exposes overflow. Disabled diagnostics return a shared no-op without reading the clock. No actions, text, identities, scene truth, URLs or GPU queries are collected.

`report.presentation_variant` is only `baseline` or `candidate`, selected through a dependency-free policy module; diagnostics never import Three or the lazy renderer. Counter snapshots carry the existing phase labels. A stopped/replaced capture cannot inherit later renderer work.

## Same-bundle browser protocol for root integration

Reload the same built source with `authoredFinish=baseline` for the old square shadow/material presentation; reload without that parameter for the new finish. This read-only QA ablation changes only these two presentation features. It does not change geometry, simulation, quality, camera or saved scenarios. Preserve all other URL parameters exactly and fully reload each variant; do not edit the query through SPA history while a world remains mounted. The diagnostic report records the known variant, never the URL.

Use 1440 × 900 CSS at 100% browser zoom, Medium fixed, DPR 1, day EO, identical fog, reduced motion enabled, same window/display and canvas backing dimensions. Keep selected contact, episode/seed, logical tick, all UI panels and camera heading/zoom identical. Record those values in the root capture manifest; screenshots alone do not prove them.

Capture each public site in two compositions: (1) public architectural arrival at its final reduced-motion pose, with no contacts; (2) public full-site survey. Arrival exposes facade roughness, macro variation and lower-wall weathering. Survey exposes complete cast-shadow continuity and the map boundary. Baseline/default must use the same arrival or survey pose. Also capture the fixed sensor-origin active view at an identical paused tick as a safety check for contact/occlusion consistency. Compare Low and thermal against baseline for preserved appearance. Do not use full-site survey or public arrival as live sensor evidence.

For steady-state cost, warm both variants, then alternate baseline/candidate in three 20-second captures each using the same paused active authored-site workload. Do not substitute `/system/benchmark`'s generic terrain for an authored site: that would not exercise this finish. If the selected frozen exercise has fewer than the desired representative contact count, disclose that count rather than silently equating it with the blueprint's 20-contact target. Record a separate active acquisition workload only if it can be matched at the same input/evidence boundaries.

Save p50/p95/p99, worst frame, >50 ms fraction, renderer CPU submission distribution and draw/triangle/object-counter rows. Separate startup, shader warm-up, quality switching and steady state. Repeat memory-object checks across ten mission enters/exits only if that lifecycle is exercised; stable texture counts are not proof of stable GPU bytes or JS heap. Source hash, UI changes, concurrent machine load and unsupported timing observers remain disclosed. Compare all six raw runs, including unfavorable tails.

Visual acceptance requires a noticeable improvement at native resolution, continuous grounded shadows and more convincing large material surfaces without aliasing or over-darkened surfaces. Performance acceptance requires the root's controlled browser data; no speed, GPU bottleneck, physical headset operation or human learning effectiveness is asserted by this slice. Existing unfavorable Observation Theatre v2 receipts remain untouched.
