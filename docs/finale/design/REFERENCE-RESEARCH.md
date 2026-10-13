# VYUHA interface reference study

13 October 2026. Primary public sources were read through web access. No proprietary layout, asset, font or component source was copied. Logged-in Linear application screens were not accessible; its public feature overview was read and an image link failed. This is a reference study, not a user study or product certification.

| Source examined | Material studied | Principle used in VYUHA | Boundary |
|---|---|---|---|
| [Linear](https://linear.app/features) | Public product overview, work-cycle navigation and feature organization | Stable task vocabulary and an immediate next action rather than an engineering checklist as the entrance | Do not claim a logged-in workflow review or copy its screen layout |
| [IBM Carbon](https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines) | Table overview, toolbars, expansion, loading, spacing and touch actions | Overview → filters → detail; wide data tables with scroll containers; defer supplementary details | No wholesale Carbon dependency or AI badge that implies generated data |
| [Fluent 2](https://fluent2.microsoft.design/layout) | Spacing ramp, fixed/stretch grids and responsive regions | Cohesive panel relationships, adaptive density and practical 44px control targets | Grid supports content, not a rigid universal dashboard |
| [Atlassian](https://atlassian.design/foundations/spacing) | Token scale and proximity/grouping guidance | Semantic spacing tokens; related controls stay together; unrelated evidence moves to disclosures | Do not copy their brand colors or component appearance |
| [Radix](https://www.radix-ui.com/primitives/docs/overview/accessibility) | Semantics, labels, keyboard expectations and focus movement | Retain native buttons/selects/details and the existing tested modal focus manager; no partial ARIA-tab behavior | Reviewed foundations; no extra runtime dependency needed |
| [WCAG 2.2](https://www.w3.org/WAI/WCAG22/quickref/) | Contrast, focus, keyboard, target size, reflow and motion criteria | Contrast measurements, visible focus, meaningful labels, reduced motion and breakpoint checks | Target relevant AA behavior; automated checks cannot certify all assistive technologies |
| [Playwright](https://playwright.dev/docs/test-snapshots) | Screenshot baselines, environment variation and comparison scope | Save actual before/after screenshots and inspect layout; record viewport and source pins | CUA's equivalent browser surface is used. Screenshots alone are not functional acceptance; no fabricated pixel-regression PASS |

Additional primary engineering references are in [PRIMARY-ENGINEERING-REFERENCES.md](PRIMARY-ENGINEERING-REFERENCES.md): Grafana, USWDS and Cesium. They support question-led dashboards, equivalent chart tables and independent render/simulation lifecycles.

## Actual visual exploration

Three original HTML interface explorations were rendered and visually inspected. They were explicitly labelled layout studies with no live telemetry. Source and screenshots are preserved privately under project work/finale/ultimate-experience/directions.

| Direction | Composition | Assessment |
|---|---|---|
| Precision / Cyan | Central optical viewport, compact evidence rail, graphite/navy surfaces, cyan navigation/action accent | Selected. Clear hierarchy, efficient desktop observation/action grouping, differentiated warning colors; naturally adapts to stacked trainee controls |
| Analytical / Amber | Broad optical area with lower split evidence panels, warm charcoal surfaces and small radii | Readable but longer vertical travel between contact selection and observation. Amber as primary competes with caution states |
| Field / Sage | Left evidence rail, right viewport, green/teal surfaces and softer rounded controls | Calm but less distinctive from RC2; left evidence rail competes with persistent app navigation |

Selection is a documented design judgement, not a measured superiority score. The integrated app must still pass functional, keyboard, contrast, responsive and performance checks. Its simulation view renders only real observed contacts; there are no decorative detections. Prototype placeholders never become production telemetry.

## Route baseline

All13 routes were inspected in actual Chrome using the RC2 production assets before rebuilding: training, Crew, RapidID, Unit, Instructor, Analytics, Exercises, Recorded, Transfer, Compliance, Evidence, Evaluation and Benchmark. Authentication was also captured. The copied synthetic QA database supplies real persisted sample records; no production learner data is used. The first AAR URL was incomplete and showed unavailable review; a loaded full-ID AAR is required during functional validation.

Confirmed weaknesses: legacy default; profile/settings push the viewport far below primary action; analytics expands every detail at once; compliance leads with93engineering findings; small inconsistent panel text; plain resource panels; repetitive contextual caveats. Existing RC2 clipping/contrast fixes are preserved. Changes address information order, discovery and trustworthy workflow states, not merely accent color.
