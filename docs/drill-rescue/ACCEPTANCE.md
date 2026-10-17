# Drill browser acceptance

Runtime freeze: `5d40a24165dff5ace27c6131318da599ad828b0d`.
Production build served on isolated loopback port 8033 with synthetic sessions and
an isolated Chrome 151 profile. Hardware renderer: Intel RPL-S through ANGLE/Mesa;
100% zoom, device scale 1. No physical device or screen-reader audit is implied.

## Workflow and accessibility

Full trusted-input adaptive drills at 1440×900 and 390×844 completed:
preparation → start → radar/track selection → designation → classification →
response → actual outcome → end → independently server-scored AAR → replay presets.
The desktop exercise includes kinetic neutralisation and the resulting stale row;
the phone exercise records an accepted kinetic attempt with no observable effect. Choices in the harness come
from visible evidence, not hidden classifications. These are workflow checks, not
claims about recognition accuracy or learning effectiveness.

Axe WCAG 2.0/2.1/2.2 A/AA tags: **22 tested states, 0 violations** (11 at each width).
No JavaScript runtime exceptions, contact-row overflow or document horizontal
overflow in those state receipts. The phone layout heuristic also flags hidden
controls under ancestor containers; these are not counted as confirmed overlap
defects without pixel/hit-test review.

The console is not described as clean: each walkthrough recorded seven Canvas2D
readback performance warnings and one transient AAR 409 before final scoring. Both
completed with the UI notice “Session saved and independently scored by the local
server.” Evidence retains these entries.

The keyboard-only phone walkthrough covers prepare/start, select, designate, radio
choices, confirmation, response and end. Accepted keyboard decisions focus the
labelled next-step group; pointer actions and deliberate external focus are
preserved. Mounted regressions also cover rejection and contact changes.

## Responsive and recovery regressions

Widths 360/390/428/768/1024/1280/1440/1920, actual browser zoom 100%:

- Footer containment and hit-testing pass; 2D fallback can be clicked and the 3D
  recovery control works at every width.
- Eight labelled synthetic stale-contact rows retain wrapped report text inside
  their borders with no horizontal overflow. Independent pixel review also confirms
  the actual stale T2 report in the final desktop outcome frame.
- Preparation retains its illustrative-landscape disclaimer without live bottom
  captions colliding with it.
- Close-up painted bounds clear the main crosshair on phones; sensor sampling is
  unchanged. Range and unit remain together.

## Offline scope

The current service-worker cache `vyuha-2a894f3c0624` contains all 72 expected local
URLs, missing 0. After CDP network-offline mode, the application shell and renderer
reload successfully. This tests cached assets; it does not certify backend-dependent
offline workflows, separate devices, LAN HTTPS or physical WAN disconnection.

## Visual evidence and remaining gates

Current-source guided/aircraft screenshots, the world matrix and before/after
references are indexed in REPORT.md. World-matrix images use clearly labelled
synthetic renderer fixtures; they are not scored trainee sensor observations.
Close-up comparisons are active captures: time and range change between 1× and 6×.
An absent inset after observation loss is not fabricated into an aircraft view.

Independent reviews found and closed the inset/reticle obstruction, hidden phone
footer, preparation-caption collision and roster overlap. No new major artifact
was identified in the ten world stills. Still-image review does not prove motion
stability, hidden-truth safety, sensor calibration or frame-time performance.

Remaining: direct owner visual walkthrough; physical reference laptop/phone;
screen reader; other operating systems; scientific validation of illustrative
thermal/training models; merged-source acceptance. Procedural building massing,
repetitive distant windows, clean road edges and faceted sparse hills remain
artistic limitations. Graphics and long-session measurements are pending until
BENCHMARK.md and the final report are written.
