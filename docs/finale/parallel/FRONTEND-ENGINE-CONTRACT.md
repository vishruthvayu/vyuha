# Frontend / engine contract

Coordination owner: Codex, on `feature/vyuha-engine-closure`. The frontend developer proposes amendments through the handoff; only the coordination owner edits this document directly. The shared baseline SHA is recorded in ENGINE-HANDOFF.md after the preserving checkpoint is pushed. Neither developer edits the other branch or force-pushes.

## Existing module boundary

No App.tsx extraction is required to begin parallel work: the scene is already isolated. The UI imports `Scene` from `client/src/LazyScene.tsx`; the dynamic implementation is `client/src/Scene.tsx`. Keep that import and public interface stable. UI owns the surrounding page, size, overlays, state/lifecycle controls, navigation, CSS and accessibility presentation. Engine owns Three.js world/camera/contact meshes, terrain, materials, lighting, sensor visibility, numerical simulation and authoritative replay.

| Files / responsibility | Owner |
|---|---|
| App.tsx, Instructor.tsx, Crew.tsx, Ghost.tsx, AAR/Analytics/Recorded UI, navigation, shells, CSS, page UI tests | Frontend developer |
| Scene.tsx, scene-presentation.ts, visibility.ts, presentation.ts, quality.ts, future `rendering/` modules and renderer tests | Engine developer |
| Radar.tsx, observed-contacts.ts: sensor filtering and SVG/radar internals | Engine developer; surrounding CSS/container belongs to frontend |
| LazyScene.tsx: current lazy load/error boundary | Frontend owner; engine changes require a contract proposal first |
| types.ts, simulation workers, sensors/motion/response/scoring, replay and Python equivalents, server/, scripts/, deployment | Engine developer; shared type changes require explicit review |
| This contract and ENGINE-HANDOFF.md | Codex integration owner |

## Scene interface preserved from the shared baseline

`Scene` props (types imported from existing modules):

```ts
{
  state: Snapshot;
  vision: Vision; // 'day' | 'thermal' | 'night'
  selected: string | null;
  onFps: (n: number) => void;
  fallback: ReactNode;
  terrain?: string;
  quality?: Quality; // 'high' | 'medium' | 'low' | 'tactical'
  fog?: number;
  palette?: ThermalPalette;
  cameraPreset?: CameraPreset;
  groundTruth?: boolean;
  visibilityKey?: string;
  opticalAvailable?: boolean;
  terrainBoxes?: TerrainBox[];
  sensorOrigin?: SensorPosition;
  engineVersion?: string;
  opticalZoom?: number; // optional display crop; 1..6, default1
  reducedMotion?: boolean; // snap presentation and suppress cosmetic flapping
  onMetrics?: (metrics: RendererMetrics) => void; // optional once/second diagnostics
}
```

Exact type definitions remain in `types.ts`, `visibility.ts`, `presentation.ts`, `quality.ts` and `sensors-v2.ts`. Engine changes must remain backwards compatible with these props. Any new optional camera/diagnostic callback must have a conservative default, be documented here and remain usable without App.tsx changes. UI may embed the renderer without rewriting its internals. No new network asset origin or runtime cloud dependency is permitted.

## Contact and sensor selection

The UI retains an opaque contact ID. Radar provides `onSelect(id: string)` with props `{ state: Snapshot; selected: string | null; onSelect; large?: boolean }`. A selected ID does not authorize hidden position or silhouette disclosure. `Scene` rechecks selection against its independently filtered optical tracks. Radar uses reported radar positions; optical rendering uses current EO/IR observations and the bounded observation hold. Do not pass UI-declared identity/type as permission for a more detailed reference model.

`vision='day'` uses EO; thermal and the styled night IR display use IR. Night is not a separately validated night-vision model. Heat palettes are illustrative presentation, not calibrated radiometry. A detect-only optical sample stays unresolved. A multirotor silhouette must not reveal RF-controlled quad versus no-RF FPV or friendly/hostile identity. More detailed silhouettes are allowed only where the versioned observation contract supports them, or in explicitly labelled AAR/instructor truth.

## Lifecycle, events and camera

The UI owns prepare/start/pause/resume/end and worker scheduling. Engine rendering reads snapshots, never advances simulation time or writes score, events, profiles or persisted evidence. `onFps` reports measured renderer callbacks; it must not drive the logical 30 Hz simulation. Rendering animation may interpolate only permitted observations. Camera movement cannot move the simulated sensor or improve evidence availability. Reference replay, What-If and recorded practice remain separate contexts.

`visibilityKey` changes on session/context changes; backward/discontinuous replay seeks clear retained samples. `groundTruth` defaults false and is allowed only in explicitly labelled authorized debrief/reference contexts. Tactical fallback remains supplied by the UI; renderer failure cannot stop scoring or expose truth. Render-only quality changes cannot reduce simulation fidelity.

## Scenario and compatibility contract

Frozen scenario IDs, engine_version, seeds, terrain occluders, sensor origins, observation levels and recorded action/command order remain authoritative. Presentation landmarks must match scenario terrain geometry when they occlude; decorative geometry must not silently change sensor LOS or scoring. Simulation semantics require explicit engine versioning and Python/TypeScript parity; renderer-only changes do not rewrite old scenarios or scorecards.

Preserve local asset bundling, lazy renderer loading, Low/Medium/High/Tactical fallback, context isolation, responsive embedding, historical evidence, current sensor silence and server-authoritative completion. Procedural artwork is original repository source; any external asset needs a recorded compatible license and local packaging.

## Exchange and integration

Frontend starts from the exact SHARED_BASELINE_SHA and owns `feature/vyuha-premium-ui`. Engine starts from the same SHA and owns `feature/vyuha-engine-closure`. Exchange only tested coherent commits. The integration owner reviews the frontend branch SHA and creates `integration/vyuha-ultimate-finale` when both branches are ready. A clean Git merge is not acceptance: run the complete merged suites, parity/history/security/recovery/transfer, actual browser and graphics checks, clean clone and independent review before a candidate is sealed. Stable still requires exact-candidate physical acceptance.


## Engine milestone proposal — additive renderer controls

The engineering branch adds optional `opticalZoom`, `reducedMotion` and `onMetrics` while preserving all existing callers. `RendererMetrics` is exported from Scene.tsx and contains `scope: "previous WebGL frame"`, drawCalls, triangles, geometries, textures and observedContacts. Counts are WebGL-reported diagnostics, not sensor detections or total process memory. No callback is required and no page/layout file is changed by the engine owner.

Frontend integration requests: optionally wire a labelled 1–6 display zoom, pass the user's reduced-motion preference, and expose diagnostics only where useful (device check/support). Zoom changes the camera crop only; it cannot alter sensor origin/range or reveal a better silhouette. Retain the existing labels that distinguish IR styling from calibrated thermal or night vision. These optional UI controls are frontend-owned work, not claimed as already integrated into the product.

Rendering uses nine shared procedural airframe part batches, containing only observed ID/position/permitted shape. Quads, no-RF FPVs and friendly multirotors intentionally share the same observable model. There is no subtype/identity color or contact shadow. Terrain detail remains surface paint on frozen occluder boxes and the ground; the sky is a background illustration. No new exercise-volume trees/hills/towers or unmodelled LOS occluders are introduced.


Radar internals now use a separate narrow radarPicture descriptor. Confirmed plots use only the radar report position; tentative/coasting plots are hollow and described accessibly, failed radar has no sweep/returns, and each SVG has unique IDs. Contact-selection props and accessible button names remain unchanged. Surrounding layout/CSS is still frontend-owned. No trails are added without a context/reset contract.

At 1× zoom, existing camera fit semantics remain unchanged. Zoom >1 intentionally crops even a reference overview; resetting to1× restores fit. It does not promise simultaneous fit and magnification.


Renderer diagnostics additionally report bounded callback-interval samples with median/p95/max milliseconds. These are frame callback intervals, not GPU execution duration, total memory, hardware certification or learning evidence. Sampling is bounded to240 intervals per reporting window. Radar recognises the v0.4 observation/falseContacts contract and fails closed for individual missing observations; a payload stripped of every schema marker is inherently ambiguous and must be rejected/typed by its producer, not universally reconstructed by a view.
