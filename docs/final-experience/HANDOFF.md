# VYUHA final experience polish

Work starts at `e07fb6a07916ad4f0fa48e88a484534b040decfa` and belongs only to `feature/vyuha-final-experience-polish`. The branch passes the recorded checks and is ready for the main maintainer's combined acceptance. It does not create a release.

## What the changes mean

The optics picture and decision area retain their positions while you designate a contact, classify it, select a response, read its result, pause, or turn guidance off. Incoming reports have their own scrolling area. Busy jammer channels, reload messages and delayed outcomes fit the reserved decision area. On smaller screens the page can scroll; long decision panels scroll inside their reserved area. This uses more empty space in short steps, but prevents the next button from jumping when information arrives. Keyboard users can focus and scroll the explanations. Hidden steps cannot receive keyboard input.

The main picture continues to render every display frame. The magnified sensor inset refreshes at up to 30 times per second and reuses its last image between refreshes. Changing contact or sensor settings invalidates that image immediately. Sensor resolution and four-times supersampling remain unchanged. The renderer also avoids uploading unused contact matrices and repeating scene graph work. These changes reduce drawing work; they do not change contact movement, observations, scoring or response outcomes.

In daylight optics, subtle shading grounds scenery foundations. Thermal/night imagery does not receive this decoration, and Low quality omits it. The inset border follows the actual picture dimensions on narrow screens. These are selective visual changes, not a replacement of the simulation environment.

## Evidence and how to read it

[Performance report](PERFORMANCE.md) includes normal and constrained browser measurements, repeated samples and caveats. [Machine-readable comparison](performance-comparison.json) retains the aggregate figures. All raw runs are in `baseline/` and `after/`. A percentile describes the slower frames: for example, p99 is the time within which 99 percent of sampled frames completed. The report averages each run's percentile; it does not claim a pooled percentile.

[Final UI receipt](closure-receipt.json), [eight-width controls](after/layout/layout-results.json) and [finite-resource controls](after/resources/resource-results.json) record actual browser actions, geometry and server verification. Screenshots use the width and stage in their filenames. Earlier `controls/` screenshots belong to the first milestone; `after/layout/` is the final UI.

The renderer measurements were recorded at the rendering milestone. Final control/accessibility changes do not alter those renderer files: the final receipt verifies their hashes against `rendering/source.json`. The ordinary two candidate raids run naturally to their 90-second completion and reach server verification; the UI geometry/resource exercises end through the UI and also reach server verification. Automated actions are evidence of functional behavior, not a human usability study.

## Recorded results

- 347 frontend tests pass with zero failures, skips or cancellations; 708 backend tests pass.
- Lint, formatting and production build pass. Final frontend/build logs are in `final-checks/`; unchanged backend regression logs are in `rendering/`.
- Two natural 90-second raids complete with three submitted decision events each and server verification. Final UI closure adds eight viewport drills and three finite-resource drills, all server verified, with zero captured runtime exceptions.
- All recorded control geometry deltas are zero pixels. The eight populated classification-stage axe audits report zero scoped WCAG A/AA/2.1 AA violations; this is not an audit of every route or state.
- Repeated close-up diagnostics reduce mean GPU frame work from 4.524 to 3.278 ms (thermal) and 7.250 to 5.339 ms (daylight). Normal and synthetic constrained workloads stay around the same 60 FPS cap and p99 frame intervals.

[Before/after screenshots and final viewport gallery](SCREENSHOTS.md).

## Tests and reproduction

Use the repository's documented Python dependencies, `npm ci` inside `client`, and Playwright Chromium. Run the backend pytest suite, client tests, lint, formatting and production build. Where Python is outside the checkout, set `VYUHA_TEST_PYTHON` for the client suite. Original verification used `/home/naveen/Vyuha/.venv/bin/python`.

For browser closure, set `VYUHA_QA_PASSWORD` to a disposable local QA password and run `python tools/final-experience/validate-ui.py`. This starts an isolated local server on port 18104 and creates a temporary authenticated database; it never uses the production account database. Build first. `browser.py`, `closeup.py` and `throttle.py` contain the recorded benchmark workloads; see their `--help` options. The baseline archive must contain the base server/examples and its built client. Run benchmarks serially on an otherwise quiet host. `summarise.py` generates the comparison from the recorded JSON; it does not rerun benchmarks.

## Limits and acceptance still owned by the maintainer

Measurements describe one Linux Intel/Mesa host and Chromium 141 at fixed Medium quality. Normal cases remain near the 60 Hz display cap; that is not an FPS increase. The sensor close-up GPU savings are measured work reductions, not physical input-to-display latency. Four-times DevTools CPU throttle is a synthetic main-thread constraint, not a certified low-end device. Shader compilation, host contention and isolated long frames remain possible. Other GPUs, browsers, touch devices, arbitrary text zoom and long manual ergonomic sessions still need acceptance.

No physical VR headset was used or certified by this task. Historical compatibility is covered by the regression suite and unchanged authoritative sources; private historical deployments/databases were unavailable. The build retains its existing large-chunk advisory and backend tests retain a Starlette deprecation warning. Those do not fail the checks.

## Integration instructions

Fetch the feature branch, inspect its evidence and review the diff from the required base. In the maintainer's own clean integration checkout, run:

```sh
git fetch origin feature/vyuha-final-experience-polish
git log --oneline e07fb6a07916ad4f0fa48e88a484534b040decfa..origin/feature/vyuha-final-experience-polish
git diff --stat e07fb6a07916ad4f0fa48e88a484534b040decfa...origin/feature/vyuha-final-experience-polish
```

The main maintainer can then perform the integration in their own clean checkout:

```sh
git switch integration/vyuha-combined-acceptance
git merge --no-ff origin/feature/vyuha-final-experience-polish
```

Resolve any subsequent integration changes, rerun combined acceptance and prepare the release separately. This task does not update `integration/vyuha-combined-acceptance`.
