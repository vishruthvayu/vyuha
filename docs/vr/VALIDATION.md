# VR implementation and validation

Date: 18 October 2026. Scope: new experimental working-tree feature after v1.0.1. The historical release/tag and its validation manifests do not certify this addition.

**Physical headset validation: NOT PERFORMED.** No headset was available. Software tests and emulation cannot establish real lens readability, comfort, tracking quality, controller ergonomics, device compatibility, physical boundary behaviour or sustained headset FPS. No human efficacy or operational-fidelity claim is made.

## What is implemented

Training ground has an optional stationary VR observation cockpit, an interactive desktop preview, and an actual immersive WebXR session. The shared terrain and aircraft render in stereo; headset tracking owns the camera. Either controller can raycast the cockpit surfaces. These surfaces contain the contact list, sensor evidence, type/identity selectors, designation, classification, response selection and confirmation, view switching, start/pause/resume, cancellation and exit. More than four detected contacts can be paged through.

The same App action callback sends VR decisions to the existing worker. The worker still supplies authoritative browser tick/order/acceptance; server reconstruction and existing review/profile persistence are unchanged. Responses require a second confirmation, expire after eight seconds, and clear when selection or exercise phase changes. Enabled buttons indicate action availability, not an effective or correct response.

A local reference space with a fixed 1.6 m rig offset supports the seated interaction model. There is no joystick movement, camera following or forced head rotation during VR. Exit, hidden/blurred immersive visibility, and graphics-context loss pause a running drill; returning to visibility does not resume it. Completion closes the immersive session and opens the ordinary review. Re-entry and runtime disposal clean up listeners, rays, geometries, materials and textures.

VR uses low world detail, pixel ratio 1, requested XR framebuffer scale 0.85 and foveation 1 where available. The ordinary observation renderer is removed while the cockpit is open. These settings are implementation choices, **not measured headset performance guarantees**. Ordinary graphics/thermal palette settings do not tune the VR renderer; its view button cycles thermal/day/night and uses the default thermal palette.

In-headset exercise setup is intentionally bounded: choose trainee, scenario, adaptive configuration or assignment in the existing workspace. Review, Scenario Studio, instructor administration, analytics and data transfer remain ordinary web pages. There is no hand-only interaction, teleportation, multiplayer embodied avatar system, native OpenXR application or phone cardboard mode in this change.

## Automated regressions

| Check | Result | Evidence |
|---|---|---|
| Backend | 139 passed | [backend log](evidence/backend-tests.txt) |
| Frontend | 72 passed: existing 64 plus 8 VR tests | [frontend log](evidence/frontend-tests.txt) |
| Existing simulation parity | 312 checkpoints within the frontend suite: original 51, Director 72, advanced 135, rural 54 | Existing fixture-based tests |
| TypeScript / production build / offline generation | Passed; 26 local cached assets, including the self-contained guide | [build log](evidence/build.txt) |
| Guide export | Nine-page A4 PDF generated and visually inspected | [PDF](VYUHA-VR-GUIDE.pdf) |
| Shell / whitespace | `bash -n scripts/start-vr.sh`, `git diff --check` passed; missing-certificate path exits 2 with setup guidance | Local checks |

The VR unit tests cover phase/detection/designation/classification/effector gates, observed evidence rather than hidden identity labels, ordinary scoring/replay parity, secure-context/capability failures, visibility loss, denial, renderer attachment failure, concurrent entry suppression, disposal during a pending request, and ending during attachment. They use synthetic sessions rather than a headset.

Existing non-blocking output includes a FastAPI/Starlette test-client deprecation warning and Vite's large-chunk advisory. This change does not claim to resolve those existing concerns.

## Browser integration evidence

**Final result: all 11 browser acceptance checks passed**, with two server-verified QA completions, zero unexpected page errors, and one explicitly recorded IWER context-loss limitation. The run took 91.59 seconds and completed at 2026-10-18 16:20:43 UTC. Source fingerprint: `baf7a00dbb172e652bba7d721095193f75702eb2c6b7e582d8d0c234edfba391`. [Machine-readable summary and artifact hashes](validation-summary.json).

The reproducible runner is [scripts/test-vr-browser.py](../../scripts/test-vr-browser.py). It launches a separate server with a temporary SQLite database, uses fresh browser contexts, and injects the pinned IWER 2.6.0 emulator only into the test browser. It never writes to the normal trainee database and does not ship IWER into production runtime assets. Normal desktop and emulated immersive tests use the built production client.

Raw results and the completed check list are in [browser-results.json](evidence/browser-results.json). The source fingerprint covers application/test sources and public HTML; the runner checks that they did not change during the run. Screenshot evidence is in [desktop-preview.png](evidence/desktop-preview.png), [emulated-stereo.png](evidence/emulated-stereo.png), and [verified-review.png](evidence/verified-review.png). The stereo image is an emulator browser mirror, not a headset photograph.

The runner exercises desktop fallback and decisions, permission denial and recovery, separate left/right-eye XR views, both controller rays and in-scene actions, eight-second response expiry, visibility pause and stable worker time after its acknowledgement, explicit resume, controller/system exit and re-entry, a natural 75-second drill through server-verified review, and actual WebGL context loss via `WEBGL_lose_context`.

Input tests wait for XR frames rather than assuming fixed-duration trigger presses always span a frame under software stereo rendering. Pause timing is checked after the worker has acknowledged the pause, allowing any already-published snapshot to reach the UI. Intermediate test runs were used to correct these test synchronization assumptions and the canvas locator after the emulator moves the canvas. Only the completed raw result is the final browser acceptance record.

**Known emulator limitation:** IWER 2.6.0 can throw `Cannot read properties of null (reading '0')` from its own `onDeviceFrame` after actual WebGL context loss. A focused reproduction identified this as the injected emulator frame loop. The runner records that exact stack only during the context-loss stage under `known_emulator_limitations`; it is not counted as an application error or silently discarded. Other page errors still fail the run. VYUHA’s pause and session-exit assertions must pass despite it. Context-loss recovery still needs testing in a real headset browser.

QA classifications/responses deliberately exercise controls and are not an expert-policy performance demonstration. A verified score means server reconstruction agrees with the event log; it does not mean a trainee chose correct answers or that the system proves operational skill.

Environment: Linux, Node 26.11.1, Python 3.14.8, Playwright Chromium 141.0.7390.37, Three.js 0.180.x, React Three Fiber 9.x, IWER 2.6.0 Meta Quest 3 profile with stereo enabled, headless software graphics. This is neither a physical Quest measurement nor a supported-device certification.

## Repeat

From the project root:

```sh
.venv/bin/python -m pytest server/tests -q
cd client
npm ci
npm test
npm run build
cd ..
.venv/bin/python scripts/test-vr-browser.py
.venv/bin/python scripts/render-vr-guide.py
```

The Python browser/export tools require Playwright and its Chromium installation in the selected test environment. If absent, install them in that environment using `python -m pip install playwright` and `python -m playwright install chromium`. No emulator is required for ordinary production operation.

## Hardware acceptance still required

Use the exact intended headset/browser on trusted HTTPS. Record the certificate/address setup, head pose and text readability, both controllers, all action steps, response expiry, pause/visibility/exit/re-entry, natural completion and verified review. Include sensor faults and adaptive/library drills and measure sustained headset frame time under the intended contact counts. Record comfort feedback separately from frame timing. The beginner guide gives the practical walkthrough.

Historical `/system/evidence` remains a dated release manifest and should report a source mismatch for this new checkout. It must not be represented as fresh VR evidence. The canonical feature manifest marks VR **EXPERIMENTAL**, with implementation present and physical validation outstanding.
