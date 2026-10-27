# Landscape identity — staged integration handoff

26 October 2026. Base0664dc4. No repository/shared file edited; no commit. Parent must integrate and visually compare before describing a visual improvement or accepting this as a product milestone.

## Deliverables

- `/private/tmp/vyuha-landscape-stage/client/src/world/landscape-identity.ts`
- `/private/tmp/vyuha-landscape-stage/client/src/landscape-identity.test.ts`
- `/private/tmp/vyuha-landscape-manifest.json`: copy preconditions and exact staged SHA256.
- `/private/tmp/vyuha-landscape-targeted.log`: final6 tests passed,0failed,959.738375ms. Earlier561.98ms run covers the same6 cases; not additive.
- `/private/tmp/vyuha-landscape-construction.json`: descriptive Node-only construction/array budgets, not browser/GPU/frame evidence.

Only copy the two NEW source/test files above. `terrain.ts`, `quality.ts`, package/tsconfig and node_modules symlink in the stage are unchanged dependency context; do not overwrite the parent versions.

## Decision and alternatives

Current world already has rich batched procedural architecture, authored Logistics Quarter, foliage, existing sky/IBL/probe, ground normal/ORM channels and polar relief. Replacing materials again or adding one building would not meet the flagship. New near-field buildings also change decorative occlusion and require reconciling the observation projection; do not quietly add them here. A global renderer swap would require migrating custom shaders, manual render passes, XR and offline assets; it is not justified by this bounded composition deficit alone.

Selected contribution: one original, static far-landscape batch, giving urban an asymmetric broken escarpment and rural a folded foothill profile, with broad depth bands and matte earth/rock color variation. This is a connected environment-presentation foundation for the parent's simulator-first workstation, not standalone completion of Flagship A, geographic truth, active evidence acquisition or a claim of AAA fidelity. Current photos/textures are not replaced and no external art is added.

Primary sources inspected: Epic Sky Atmosphere component (https://dev.epicgames.com/documentation/en-us/unreal-engine/sky-atmosphere-component-in-unreal-engine) documents aerial perspective, composition controls and LUT/memory tradeoffs; Three's official terrain example (https://threejs.org/examples/webgl_geometry_terrain.html) establishes geometry/fog composition and the official examples catalogue exposes terrain, instancing and separate WebGL/WebGPU paths (https://threejs.org/examples/). No Epic runtime/material/code/art imported. Source documentation and visual references were inspected as text/image descriptions, not an operated Epic/Three demo or direct pixel comparison; the parent owns actual browser visuals. Existing VYUHA source/geometry was inspected directly.

## API and integration seam

`buildLandscapeIdentity(terrain, quality, worldEnvelope.flatRadius)` returns `{ geometry, material, identity } | null`. `landscapeIdentity` exposes the frozen presentation descriptor; `landscapeRelief` returns added relief only and has no simulation input.

In Environment's existing built memo, after the base terrain:

```ts
const landscape = buildLandscapeIdentity(terrain, quality, worldEnvelope.flatRadius);
if (landscape) {
  disposables.push(landscape.material);
  addMesh(landscape.geometry, landscape.material, "terrainFar", {
    cast: false, receive: false, name: "landscape-identity",
  });
}
```

`addMesh` already owns geometry disposal and registers EO/thermal swapping. The new source material is a standard MeshLambertMaterial, vertex-colored, opaque, fogged, not emissive and without a texture. Existing ThermalTwins can create its `terrainFar` twin; existing preparation iterates swappable EO/twins. Do not add it to the authoritative LAYER_OCCLUDERS. Do not reuse the ground material's special per-mesh mode path without explicitly handling it.

Record `landscape-identity-v1`/descriptor in the world presentation manifest if accepted. This is presentation versioning; no old engine/scorecard is modified. Historical visual pixels may change while original observation/scoring meaning stays frozen.

## Semantic clearance and lifecycle

- Default urban inner radius2400m; rural2200m. Outer radius14000m matches existing terrain mesh.
- Every inner polygon CHORD remains at least `flatRadius+120m`. Vertices alone would not prove clearance; angular tessellation compensates conservatively with cosine.
- Parent derives flatRadius from maximum public EO/IR range and offset sensor origin plus existing200m margin. The new entire horizontal mesh is therefore beyond every admitted optical report, including supported10km/offset cases. It cannot obscure an optically rendered live contact inside that region. Existing authoritative boxes and near scenery are untouched.
- Larger supported public envelopes push the landscape outward; when remaining ring width<800m, omit it explicitly. Tactical returnsnull. Invalid/unsupported clearance or quality fails rather than clamping into an unsafe sphere.
- Geometry uses no contact list, canonical identity, tick, action or random runtime state. Neither score nor sensor observations change.
- No per-frame work, animation, new asset loading, shadow cast/receive, transparent pass or sky override. One additional static ordinary draw per pass, not a measured total draw cost claim.
- Low/Medium/High topology differs while broad forms are deterministic. Low is an explicit bounded presentation variant, not an unchanged pixel path. Thermal uses existing illustrative far-terrain policy, not a new radiometric model.
- Parent disposes new material; addMesh disposes geometry. Twin disposal remains owned by existing cache lifecycle.

## Technical checks and measured bounds

Final staged6 tests pass: deterministic finite bytes/closed seam, upward winding, complete inner polygon/offset/10km clearance, no relief inside/outside, invalid/exhausted bounds, distinct profiles, bounded geometry, no maps/emission/identity metadata. Narrow strict TypeScript and changed-file ESLint passed. `node --import tsx --test` was used because tsx CLI IPC socket creation was restricted; this changes no test coverage.

Geometry arrays+indices: Low77,796bytes/3,072triangles; Medium190,980bytes/7,680triangles; High378,468bytes/15,360triangles. One material, zero textures. These are exact CPU buffer lengths, not GPU retained-memory measurements.

Seven Node constructions per terrain/quality: urban medians3.40/5.53/9.37ms; rural2.13/4.71/8.00ms for Low/Medium/High. The first urban Low outlier19.04ms is retained. These are descriptive local CPU timings with different JIT states, not matched startup improvement or device qualification. No browser, physical headset or whole-frame benchmark was performed by this agent.

## Parent acceptance required

1. Match before/after urban/rural entry and active sector cameras, daylight/night, EO/thermal, resolution/quality/fog. Do not use paused blur as visual evidence.
2. Verify panorama looks deliberately composed, not a repeated lumpy wall, and that far-layer color does not flatten existing sky contrast.
3. Check1.5km default and10km/offset envelope; scenery omission when no safe room remains; reference AAR and VR same public envelope.
4. Run affected world/envelope/inspection tests and actual contact-hidden/marker/lens behavior. Geometry here adds no near obstacles, but manual multipass integration still needs inspection.
5. Record actual draw/triangle/resource/frame/startup costs through existing instrumentation; no performance advantage claimed. If geography harms composition or clarity, retain stage as an experiment and adjust/remove it rather than declaring the flagship complete.
