# Independent sensor renderer review — freeze 822aca55

15 October2026. Parent reports policy-v2 source freeze `822aca559a5e750bead6980f56ffcbad579c1fa661ae70441f15b7c3ab6d5081`,298inputs. Read-only source inspection; no CUA, runtime edits or heavy tests were performed while final suites run. The focused51-test result and actual browser metrics are parent-owned evidence, not new tests run by this reviewer.

## Radar improvements verified by source

`radarPicture` correctly takes positions from the specific radar report, strips canonical kind/identity/RF/optical positions, hides failed radar contacts/clutter/sweep, rejects absent/unavailable/non-finite/future reports and preserves trainee-declared affiliation as a clearly labelled hypothesis. `Radar` communicates tentative/coasting states with hollow/dashed plots and textual sample age. Clutter remains non-interactive. Enter/Space selection handlers and opaque IDs are retained. `useId` isolates SVG gradient/clip/description references across sibling radars. The scan is explicitly labelled schematic, not a modeled antenna phase. No engine or scoring changes are implied.

## Remaining defensive gap reproduced

`RADAR-OBS-01`: The legacy fallback is selected per track when `t.observation` is absent. In a snapshot clearly containing v0.4 sensor evidence on another track, a damaged v0.4 track with its entire `observation` missing and `radar=true` is plotted from canonical `t.x/t.z` as a fresh confirmed return. This is different from the existing test that deletes only `observation.radar`.

A small pure-function probe reproduced a missing-observation track at canonical777,-222 with no radar report. The in-range returned point becomes an interactive SVG plot. See `radar-missing-observation.ts` and its JSON output. No actual well-formed simulation path producing this damage was observed; this is defensive fail-closed hardening, not evidence that normal workers spontaneously lose their observations.

Recommended closure: When the snapshot is known to use v0.4 evidence, skip tracks lacking the required observation instead of entering legacy fallback. Keep genuine legacy snapshots working. An entirely stripped snapshot cannot be distinguished perfectly from a legitimate legacy snapshot under the current public Snapshot type, so either introduce a reviewed optional version hint or state the detection boundary precisely; do not claim universal malformed-v0.4 protection without such context.

## Smooth crop / sky / bounds

- Camera FOV now changes imperatively using damped display crop, avoiding a new declarative prop resetting interpolation on each snapshot. Default1× remains unchanged. Optional zoom is deliberately a crop; a6× reference overview need not fit every point. No sensor range, origin, resolution or silhouette gate changes.
- SkyDataTexture now correctly treats the last image row as upper/north UV, with a seamless periodic painted horizon. The equirectangular panorama is background only, so it cannot introduce terrain occlusion or reveal a target. The explicit thermal palette uses static illustrative colors, not class-specific heat.
- Airframe instances compute world bounds after active counts and transforms; capacity remains at least total observed count and each part count is bounded by it. Selection corners billboard toward the camera from the permitted observed pose. No new contact shadows/reflections are present.
- Pooled geometry/material ownership and explicit texture cleanup remain sound by inspection. Repeated real WebGL quality/palette/context/capacity changes are still needed to establish bounded resource plateaus. Positive resource metrics alone do not prove cleanup or memory endurance, and object counts are not VRAM.
- FPS context epoch correction remains in place. CameraRig forwards only complete local-frame-window measurements from RenderFrameMeter; the previous false0-after-remount defect is not present in this source.

## Acceptance recommendation

Resolve or explicitly narrow the RADAR-OBS-01 fail-closed claim, add the mixed-v0.4 missing-whole-observation regression, and preserve the actual before-fix failure. All final results must use the updated frozen hash if source changes. No new global audit grade is assigned. UI shell work remains owned by the friend; this review proposes no changes to App/navigation/CSS.

## Guard and interval-diagnostic follow-up

The parent implemented an observation-contract guard from any present track observation or a definedfalseContacts collection. The original independent mixed-v0.4 reproducer now returns only the valid reported track, without the missing-observation canonical fallback; its before/after JSON is retained. New canonical tests cover the mixedcase, allobservationsmissingwithfalseContacts[] and genuinelegacy compatibility. RADAR-OBS-01 is fixed within the documented contract; fullystrippedmarkers remain inherently ambiguous.

Independent small counter probe at epoch600 emitted60,60FPS for two full windows and retained60 callback intervals with median/p95/max approximately16.667ms. Source arrays are bounded to240pending and240completed intervals, with no growing history. At unusually high rates above240Hz, percentiles/max describe the latest240retained intervals of that completed window; FPS still counts allcallbacks. These are renderer callback intervals, not GPU execution duration. No new heavy/full tests were run by this reviewer while root's final suites execute.

No additional source change is requested. Final exact reviewed source hashes and remaining actual-WebGL/integration scope are in `FINAL-GUARD-REVIEW.json`. Prior focused/baseline counts remain dated scoped evidence, not substitutes for the root's final frozen-source suites.
