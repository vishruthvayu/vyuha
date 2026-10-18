# Final experience polish — verified milestones

Base: `e07fb6a07916ad4f0fa48e88a484534b040decfa`. Branch: `feature/vyuha-final-experience-polish`. This is a feature branch, not a release or combined acceptance decision.

## 1. Stable decision workspace

The decision panels now retain their intrinsic space across selection, designation, classification, response, outcome, pause and guidance changes. Inactive panels are inert and aria-hidden. Classification remains gated by designation; the trainee must choose type and identity. Keyboard acknowledgment preserves the scroll position. Tablet/phone contact reports scroll within a fixed rail, so incoming rows cannot push the decision controls down. Guidance, feedback and classification explanations have reserved wrapping space.

Evidence: [baseline live drills](baseline/results-live.json), [live geometry checks](controls/layout-results.json), and before/after screenshots in those folders. Baseline scene heights changed by roughly 85–150px during actions. The new scripted live checks measured at most 1px change across the optical frame, optics header, decision region, body and feedback at widths 390, 1024 and 1440; each drill saved and reached server verification. Twenty focused decision tests pass, including retained DOM controls, inert inactive stages and designation gates. Full regression and rendering measurements follow in the final report.

The fixed space is deliberately reserved; earlier steps can have empty space. Very short desktop viewports and arbitrary text zoom still need broader checks before final acceptance. No authoritative simulation, scoring, security, fixtures or historical engine sources changed.

## 2. Rendering work and selective realism

Two full urban/rural raids complete and reach server verification on the candidate, with zero recorded runtime exceptions and unchanged frozen scenario inputs. Three repeated fixed-size legacy close-up diagnostics per view measured GPU work at 4.524 → 3.278 ms (thermal) and 7.250 → 5.339 ms (EO), about 26–28% lower. Mean draw calls fell from 64.085 to 45.382 / 46.904. The ordinary 8/100/200-contact matrix remained near the 60 FPS display cap; its small script-time changes are not evidence of a major unselected-view speedup. Full raw measurements are retained.

The close-up keeps its sensor pixel budget and 4× supersampling but reuses the offscreen texture between 30 Hz refreshes; the main view still renders every display frame. Context changes and observation loss invalidate it. Instance matrices upload only populated prefixes; the scene graph updates once per layered frame, and static environment React work is memoized. EO-only, single-batch foundation shading grounds structures without modifying thermal imagery or sensor boxes. The inset border now matches the actual painted size on narrow canvases.

347 frontend tests, 708 backend tests, lint, formatting and production build pass. Renderer source hashes and logs are in `rendering/`. Final UI accessibility and finite-resource layout checks are still being completed; this milestone is not final acceptance.

## 3. Final responsive and resource closure

The populated decision workspace now passes real browser flows at 360, 390, 428, 768, 1024, 1280 (720px tall), 1440 and 1920 pixels. Every recorded optics/header/dock/body/status coordinate and dimension has zero drift between designation, classification, response, outcome, pause and guidance-off. All eight drills reach server verification; the scoped WCAG A/AA/2.1 AA axe checks report zero violations. Separate finite-resource drills at 390/1024/1440 exercise pending outcomes, full jammer channels, reload timers and completion, also with zero measured geometry drift, server verification and zero captured runtime exceptions.

This deeper check exposed two issues after the first milestone: changing resource text could grow the stage, and the longest step name could wrap the phone header. Responsive stage scrollports and a reserved header row fix both. Focusable explanations retain keyboard scrolling, and changing stage resets its internal scroll position. See `closure-receipt.json` for the final UI hashes and conservation of the measured renderer. `HANDOFF.md` explains the behavior, evidence, reproduction and integration ownership.
