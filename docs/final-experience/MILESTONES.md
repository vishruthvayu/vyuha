# Final experience polish — verified milestones

Base: `e07fb6a07916ad4f0fa48e88a484534b040decfa`. Branch: `feature/vyuha-final-experience-polish`. This is a feature branch, not a release or combined acceptance decision.

## 1. Stable decision workspace

The decision panels now retain their intrinsic space across selection, designation, classification, response, outcome, pause and guidance changes. Inactive panels are inert and aria-hidden. Classification remains gated by designation; the trainee must choose type and identity. Keyboard acknowledgment preserves the scroll position. Tablet/phone contact reports scroll within a fixed rail, so incoming rows cannot push the decision controls down. Guidance, feedback and classification explanations have reserved wrapping space.

Evidence: [baseline live drills](baseline/results-live.json), [live geometry checks](controls/layout-results.json), and before/after screenshots in those folders. Baseline scene heights changed by roughly 85–150px during actions. The new scripted live checks measured at most 1px change across the optical frame, optics header, decision region, body and feedback at widths 390, 1024 and 1440; each drill saved and reached server verification. Twenty focused decision tests pass, including retained DOM controls, inert inactive stages and designation gates. Full regression and rendering measurements follow in the final report.

The fixed space is deliberately reserved; earlier steps can have empty space. Very short desktop viewports and arbitrary text zoom still need broader checks before final acceptance. No authoritative simulation, scoring, security, fixtures or historical engine sources changed.
