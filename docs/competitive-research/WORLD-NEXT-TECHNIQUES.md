# Next world techniques: capability before effects

25 October 2026. Focused follow-up to the completed simulation-station milestone at `91ac28d` / runtime `0ad89f4`. This is a source-backed implementation decision, not a claim that another world kit or renderer has shipped. It does not repeat prior renderer research or completed sky-probe work.

## Immediate decision

The next primary user capability should be the **Optical Investigation Station**: deliberate manual bearing/elevation control, safe reacquisition of an observed contact and explicit view-versus-evidence semantics. This makes the existing world explorable through a purposeful instrument. It can retain current accepted actions, observations and scoring; a display crop remains a display crop. Actual implementation and acceptance are recorded separately by the integrating developer.

The strongest subsequent graphics transformation is a **locally compiled, authored synthetic environment kit with an explicit observation envelope**. Produce a recognizably different place with coherent roads, land use, skyline, material scale and arrival composition. Existing PBR textures, instanced airframes and scenery batches are a basis. Ship one complete kit and meaningful scenario contrast before expanding setting counts. Cinematic blur, dust and heavy grading can change tiny-contact visibility without changing authoritative observations; impressive screenshots alone cannot qualify such changes.

## New primary-source checks

| Primary source inspected | Fact and VYUHA inference | Boundary |
|---|---|---|
| [Three r180 LOD implementation](https://raw.githubusercontent.com/mrdoob/three.js/r180/src/objects/LOD.js) | Distance LOD supports hysteresis and camera zoom. A future world kit can use stable scenery detail transitions. | Contact LOD is already projected-size based; preserve that evidence-aware behavior. |
| [Three InstancedMesh docs](https://threejs.org/docs/pages/InstancedMesh.html) | Repeated geometry/material share instanced draws; bounds and disposal remain application responsibilities. | The world already uses instancing. Measure new work rather than claiming an optimization from API choice. |
| [Three r180 fog shader](https://raw.githubusercontent.com/mrdoob/three.js/r180/src/renderers/shaders/ShaderChunk/fog_fragment.glsl.js) | Exp2 fog mixes toward one color using squared view depth. | Current haze is a display approximation. A new height/distance shader needs fixed-contact EO/IR/inspection qualification. |
| [PBRT 4, transmittance](https://www.pbr-book.org/4ed/Volume_Scattering/Transmittance) | Radiance attenuation is path-dependent; homogeneous extinction and heterogeneous media require different assumptions. | This motivates separating educational sensor rules from visual haze; it does not calibrate VYUHA parameters. |
| [Khronos glTF overview](https://www.khronos.org/gltf/) | Portable PBR conventions and KTX2 provide an authored-asset delivery route. | Asset rights, local decoder packaging and visual tolerances remain separate gates. |
| [Three PerspectiveCamera docs](https://threejs.org/docs/pages/PerspectiveCamera.html) | FOV, zoom, clipping and view offset have distinct projection meanings. | Manual optics must stay at the sensor origin; narrower framing cannot become new evidence or greater sensor resolution. |

No external models, imagery, code snippets, fonts or proprietary layouts were imported. These sources were technical references. Vendor documentation does not establish VYUHA performance or learning outcomes.

## Concrete source boundary found

`client/src/world/terrain.ts` fixes the flat disc at1700m. Its comment and current `world.test.ts` fixture compare that with **default** EO/IR ranges1500/1200m. This is correct for the default origin/configuration. But `sensors-v2.ts` accepts optical ranges up to10000m and a finite offset origin. Terrain generation receives neither. The default proof therefore does not establish that relief is outside every valid configured observation footprint. This is a source-level invariant gap; no specific rendered failure has yet been reproduced. Do not label every existing scene wrong.

Related seams: `InspectionPass.pixelsOnTarget` reads default IFOV; `world/displayVisibility.ts` reads default visibility parameters. Custom configurations require truthful image qualification. These are presentation boundaries, not a reason to change authoritative observations or historical scores.

## Support implementation staged separately

`worldPresentationEnvelope(config?, sensorOrigin?)` is staged at `/private/tmp/vyuha-world-next/client/src/world/world-envelope.ts`; six tests are in `src/world-envelope.test.ts`. **6 passed, zero failures,473.227ms.** This is support work, not a completed world transformation. Nothing is production-integrated unless a later source commit explicitly records it.

The helper reuses `sensorConfiguration`, takes no contact roster and returns immutable public configuration-derived bounds. Defaults preserve exactly1700m. Configured clearance is conservatively `hypot(origin.x,origin.z) + max(EO range,IR range) +200m`. Altitude cannot shrink the bound. It flags when relief cannot exist within the14km mesh and when a larger world is required. Invalid values fail explicitly.

Safe integration: optional flat-radius inputs in `terrainHeight`/`createTerrainGeometry`, with existing defaults unchanged; actual public scenario config passed through Scene/Environment; explicit sky/clipping/extent handling for expanded worlds. A helper alone does not repair the renderer. Do not clamp a25km footprint to14km and claim it is covered.

## Major authored-world gate

1. Freeze a versioned presentation-world manifest distinct from the authoritative scenario/boxes: kit, asset, lighting, LOD, rights hashes and observation envelope.
2. Build one original coherent setting with bounded batches, atlases and low/medium/high variants from one authored composition. New physical terrain that changes observations needs a new simulation contract; near decorative scenery remains explicitly decorative.
3. Qualify unresolved/recognised contacts, radar-only cue, authoritative box, decorative obstruction marker, night EO unavailable, IR, stale observation, offset origin and long-range config. Hidden geometry, framing and identity cues must remain absent.
4. New research candidate: a **visual observability regression oracle** using deterministic fixture image regions at matched time/configuration. Detect unintended visibility/contrast/occlusion changes across quality/lens modes. This is image regression, not an empirical human-detection model. Global screenshot similarity alone is insufficient.
5. Measure cold/repeat preparation, first long frame, sustained intervals, draw/triangle/resource budgets under a matched named-device workload. Retain slower/inconclusive runs. Browser/XR qualify separately.

Authored world, instrument interactions and task-aware qualification can form a major subsystem upgrade. A helper, shader or new screenshot alone cannot.

## Subsequent implementation —25 October2026

[Configured optics acceptance](../next-generation/configured-optics/ACCEPTANCE.md), runtimeab92f69, now integrates the public range envelope, IFOV/visibility forwarding and fail-closed local-world bounds through Training/Ghost/XR.33targeted checks and actual custom-library→server-verifiedGhost behavior are recorded separately. This closes the configuration-plumbing gap for supported paths; the authored kit, perceptual oracle, expanded worlds, physical XR and override-performance qualification remain unimplemented/unvalidated. Earlier staging results above retain their original scope.
