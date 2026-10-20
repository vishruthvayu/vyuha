# Actual application captures

These captures are from synthetic QA exercises and actual production client assets. They are not mockups. Viewports are CSS pixels at visual viewport scale 1. The full provenance and file hashes are in [manifest.json](manifest.json).

| State | Capture / evidence |
|---|---|
| Current M1 daylight optics, aircraft close-up and local scenery | [Live daylight close-up](polish/screenshots/m1-live-day-closeup.png) |
| Corrected desktop geometry at 1440×900 | [Full scrollable workspace](polish/screenshots/final-polished-active-desktop.png), [six-stage geometry](polish/screenshots/final-geometry-1440x900.json) |
| Original merged contrast issue | [Mobile paused state](polish/screenshots/merged-paused-390.png), [axe before fix](polish/screenshots/mobile-outcome-axe.json) |
| Degraded radar badge after contrast correction | [Mobile](polish/screenshots/fixed-degraded-mobile.png), [mobile audit](polish/screenshots/fixed-degraded-mobile-axe.json), [desktop audit](polish/screenshots/fixed-degraded-desktop-axe.json) |
| Authenticated Instructor command applied | [Actual officer console](polish/screenshots/instructor-applied-1440.png) |
| Queued local decisions with server stopped | [Offline browser](polish/screenshots/final-outage-three-actions.png) |
| Recovered, server-verified Ghost AAR | [Recovered AAR](polish/screenshots/final-recovered-aar.png) |
| Persisted Analytics comparison | [Desktop](polish/screenshots/final-analytics-1440.png), [mobile](polish/screenshots/final-analytics-390.png), [mobile audit](polish/screenshots/final-analytics-390-axe.json) |
| Role-attributed Crew history | [390px history](polish/screenshots/final-crew-history-390.png) |
| Plain-product 200-contact sustained M1 run | [180-second result](polish/screenshots/m1-200-medium-180s.png), [raw JSON](polish/screenshots/m1-200-medium-180s.json) |

The earlier source and final polish use different exercise contents and viewport heights. Compare same-run geometry receipts for positioning; these screenshots are not an empirical usability study or a controlled visual-quality score.

The polish developer's [eight-width gallery](../final-experience/SCREENSHOTS.md) and [Linux before/after measurements](../final-experience/PERFORMANCE.md) are retained with their original source and platform scope. The prior combined acceptance [capture directory](original/screenshots) retains the rural, thermal, AAR, Transfer and earlier performance evidence.

Zero detected axe violations in a captured state is a scoped result. Manual screen-reader checks and incomplete axe nodes remain separate requirements; no complete WCAG certification is claimed.
