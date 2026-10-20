# Independent renderer visual review — 15 October 2026

**No release-blocking renderer artifact was reproduced in the inspected screenshots/source.** This is an explicitly synthetic reference-fixture review, not acceptance of the friend-owned outer UI, empirical sensors, physical devices or complete product. No score is assigned.

Source hash independently recomputed using policy v2: `1f476588e75f051357c0b04e3fe95e390e64026fbdfb069f79ce631f5b675fa4`, matching the supplied pin. Parent commit: `4c42fc934a6896ae5b9d62eeb84ed74cc2746a76`; the full working-source hash identifies the review. `receipt.json` records exact screenshot/source hashes and dimensions.

| Actual capture | Observed visual result | Boundary |
|---|---|---|
| quad-day | Finite recognizable body, arms, motors/rotors and centered selection bracket. Front-on rotor pairs overlap naturally. | Display crop2; reference truth. |
| fixed-wing-day | Broad wings, central fuselage and tail; no exploded triangles or target clipping. | One front-on pose; illustrative dimensions. |
| bird-day | Rounded head/body and thinner tapering wings; distinct from quad and broadly different from fixed wing. | Crop3 and one wing phase; distant recognition remains uncertain. |
| bird-black-hot | Strong dark body/wing contour against light background. | Shader/material treatment, not physical thermography. |
| quad-high-follow | Selected quad centered in an oblique view; road/buildings provide depth. | Reference follow camera, not unseen trainee evidence. |
| quad-low-night | Quad remains visible in dim green styled-night view; simplified geometry intact. | Modest contrast is a refinement; do not force hidden contacts visible. |
| reference-200-final | Dense intended formation and terrain rendered without blank canvas or geometry explosion. | Reference stress view; not individual operational readability. |

All7 fixture JPEGs were1440×1080. Warm and post-churn JSONs each report19 draw calls,19 geometries and4 textures at200 reference contacts. This supports consistency of those supplied diagnostic frames, **not** leak-free native GPU/process memory or sustained benchmark performance. The interval summaries measure renderer callbacks rather than GPU execution time.

Source review: Scene obtains mesh/camera inputs from ObservationVisibility and clears selection outside that permitted list. Render descriptors contain ID, finite supplied position and permitted silhouette, excluding identity/RF/reference heat/motion fields. The pose buffer removes missing contacts and interpolates toward supplied observations instead of projecting hidden trajectories. ContactRenderer consumes those descriptors, batches original procedural geometry, disposes geometry/materials and derives cosmetic bird phase from logical tick; reduced motion suppresses wing oscillation. These are static source observations; runtime correctness is owned by dedicated regression/parity evidence.

Three optional P3 refinements: evaluate styled-night contrast on actual displays; capture oblique/moving bird/fixed-wing views to inspect cosmetic distinction; consider less repetitive terrain only if it adds training value without changing occlusion or scoring. None is a reproduced release blocker in the inspected scope.

The preserved product baseline was inspected for context only. Its different scenario, camera, crop and observation state make it unsuitable for matched before/after claims. An emptier old trainee view versus the new all-visible reference fixture does not establish better detection or learning.

The additional production-day-selected capture is paused and blurred: it is valid paused/selected-interface evidence, not readable running production airframe proof. Obtain a separate running production capture before making that workflow claim.

No browser operations, source edits or heavy tests were performed. Stills cannot independently prove animation smoothness, pause/seek repeatability, observation masking, disposal or long-run performance. Thermal/night appearances remain illustrative. Complete-product UI, empirical calibration and physical acceptance retain their separate gates.
