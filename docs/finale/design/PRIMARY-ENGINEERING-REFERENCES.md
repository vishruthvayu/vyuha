# Primary engineering and visualization reference supplement

Reviewed 13 October 2026. These are design/engineering principles, not evidence that VYUHA has achieved a measured usability benefit or a physical deployment pass. The references supplement the root's required design-source review; no third-party visual identity, telemetry, screenshot or dataset is copied into the product.

## Question-led dashboard hierarchy

[Grafana's official dashboard guidance](https://grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/best-practices/) recommends answering a defined question, reducing cognitive load, progressing from overview to specific detail, documenting panels and avoiding refresh faster than data changes. Adaptation: the instructor overview should answer which exercise needs attention, then open the relevant trainee/White Cell. Analytics should filter persisted sessions and expose their source and denominators. A new card needs a task, not just an attractive number. Retain event/poll lifetimes; styling should not add redundant network traffic.

[Grafana's standard panel options](https://grafana.com/docs/grafana/latest/visualizations/panels-visualizations/configure-standard-options/) separate display formatting from data and support named units and stable series colors. Adaptation: verified score, logical time, client callback FPS, server reconstruction time and heuristic posterior are different quantities. Preserve units, provenance and bounded meanings rather than presenting them as interchangeable readiness percentages. Stable color identities are useful; verdict must also appear in text/icon.

## Accessible chart comprehension

[USWDS data visualization guidance](https://designsystem.digital.gov/components/data-visualizations/) favors familiar focused chart types, explicit explanatory text, distinguishable patterns and equivalent nonvisual access. A data table alone may not reproduce a chart's intended interpretation. Adaptation: use a session-order score trend with plain-language scope, a labelled scale, visible points and an accessible data table. Avoid invented dates on session-index axes. Show actual observations; do not interpolate missing sessions as measured results. The decision path should supply keyboard-accessible text for branch, score scope, unassessable state and seek action. Automated markup checks need contextual manual review.

## Rendering fidelity and idle work

[Cesium's official explicit-rendering article](https://cesium.com/blog/2018/01/24/cesium-scene-rendering-performance/) describes reducing rendering when the scene does not change while explicitly accounting for simulation time and events that require a new frame. This is a Cesium technique, not a drop-in Three.js API or benchmark for VYUHA. Adaptation: lazy-load the heavy renderer, preserve 2D fallback and consider idle/paused-frame optimization only after profiling. The authoritative 30 Hz worker and scoring fidelity must not depend on whether a visual canvas is loaded or rendered. Current scene changes still need frames. Any claimed CPU/startup benefit requires actual before/after receipts from the same environment.

## Review checks derived from these principles

- Each overview card answers a user question and offers an appropriate next action; no card contains a fabricated aggregate.
- Visual graph values are traceable to persisted server results, with clear scope and equivalent keyboard/text access.
- Error, empty, loading and insufficient-evidence states preserve the visual hierarchy and provide a usable recovery path.
- A static decision-path graph does not imply a new scoring engine. Final node credit, projected penalty and observed outcome remain distinct.
- Lazy scene failures surface a clear renderer error and accessible fallback; hidden canvas does not suspend simulation or manufacture FPS improvement.
- Threshold colors do not imply calibrated proficiency. Measured score, heuristic advice and reported physical evidence retain their labels.

These checks remain pending until the independent reviewer inspects the root's actual integrated browser results. This supplement awards no design or scientific score.
