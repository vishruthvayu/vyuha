# Instructor Control v1

## Baseline before changes

`main` / `v0.1.0` / `6546816`: pytest **5 passed**; npm test **6 passed**, including the three-seed TypeScript/Python parity test. Development uses `feature/instructor-control`; the baseline tag is preserved.

## Audit and implementation decision

- SQLite stores issued scenarios, sessions with UUID4 IDs, and idempotent trainee event chunks.
- `Scenario` is a seeded immutable spec; `Simulation` builds and advances runtime tracks.
- The worker accepts init/play/pause/action/finish messages and stamps accepted trainee actions with the authoritative simulation tick.
- Scheduled radar degradation comes from scenario jamStart/jamEnd. Initial track spawn ticks come from the scenario.
- React screens use local view state; AAR uses the same replay engine. There is no existing WebSocket/control path.
- Extend existing models/types and SQLite with instructor commands and acknowledgements. Poll every 500 ms. Commands are immutable; the worker assigns their applied tick and timeline order. Server reconstruction merges instructor commands and trainee actions by tick/order.


## Command and reconstruction path

Instructor UI → FastAPI REST → SQLite `instructor_commands` → trainee poll (500 ms) → existing Web Worker → the existing Simulation → ordered replay / authoritative scoring.

Commands have a client-generated idempotency ID, a session-scoped increasing sequence, UTC issue time, a validated typed payload, and an execution acknowledgement with simulation tick and global timeline order. SQLite serializes submissions, rejects changed payloads for a reused ID, limits commands to 100 and injected contacts to 64 per exercise, and keeps commands across restarts. Six contacts per swarm is fixed for this stage.

The worker skips already-applied sequences, applies only the next sequence and records the actual execution tick/order. Accepted trainee actions use the same order counter. Action and command order resolves same-tick ambiguities; replays never depend on network delivery timestamps. Commands applied while paused keep the same simulation tick. Injection IDs continue T9, T10… and initial state derives from seed, sequence and member index. The immutable original scenario is retained.

The client stores the applied log in its recovery draft before acknowledging execution to the server. Heartbeats send actual worker time, effective pause state, contact count and sensor/environment state. These metrics are labeled trainee telemetry, not independently verified scores. A device record also retains the actual final worker tick separately from the 75-second scoring horizon. If completion occurs offline, verification retry re-acknowledges the saved execution log against the original server before uploading trainee actions. At completion, the server combines its persisted applied command log with validated trainee actions and reconstructs the world. It does not accept a client-supplied score or command payload replacement.

Unapplied commands at completion are shown as NOT APPLIED, not injected into replay. Early ending retains the baseline rule: the replay advances remaining simulation ticks to 75 seconds for unhandled-threat scoring. Paused wall-clock seconds never add simulation ticks. During ordinary live pause, movement, impacts and scoring timers stay frozen.

Radar jam reduces the existing range/fog detection probability to 20%; complete failure suppresses radar observations. Restore overrides the scheduled scenario jam. RF failure hides both control-link and IFF evidence; it does not magically change the physical RF link or make a no-RF target jammable. Day/night changes the condition label and observation palette without replacing the scene.

## Local walkthrough

1. Start the production build with `bash scripts/start-local.sh`.
2. Open `/` and `/instructor` in two tabs/browsers; start a trainee drill.
3. Pause from the console and confirm elapsed simulation time stays fixed.
4. Resume; inject a quad, jam radar and inject a no-RF FPV.
5. Designate and classify the FPV, then use RF jammer: it remains active and the log explains the failure.
6. Fail radar and RF; confirm OFFLINE indicators. Restore both.
7. Inject the six-drone swarm; switch day/night. Commands work while paused as well.
8. End the exercise; check Server verified, injected rows, instructor command history and replay at their execution ticks.

## Explicit limitations

- No authentication or role enforcement. This stage runs on loopback; no public exposure was added.
- Relative REST URLs support a later same-origin trusted LAN deployment. A second physical device has not been tested. LAN setup, HTTPS and access enforcement remain later deployment work.
- Only one live trainee browser should own a session. Multi-controller trainee ownership/leases are not implemented.
- A six-second missing-heartbeat threshold marks RECOVERABLE. The console does not manufacture scores or live positions; there is no instructor tactical video view in this stage.
- Instructor control needs the local FastAPI server. During a network interruption the current worker keeps running and logs accepted actions locally; pending controls apply on reconnect. There is no remote control during standalone device-only practice.
- A recovered controlled session needs its original server and command log for verification. Importing controlled sessions into a fresh server is not implemented.
- Scenario authoring, advanced commander permissions and military validation are not implemented. All threat models are illustrative.
- AAR remains the existing 2D tactical replay and reference debrief; Ghost Expert + Time-Machine AAR v2 is the next stage and has not been started.


## Validation recorded on 3 October 2026

| Check | Final result |
| --- | --- |
| `.venv/bin/python -m pytest server/tests -q` | **16 passed, 1 warning in 1.18s** |
| `cd client && npm test` | **11 tests, 11 passed, 0 failed**, 1290.184375 ms |
| `cd client && npm run build` | Exit 0; TypeScript + Vite production build + offline cache generation |
| Cross-language regression | Two tests × three seeds: **6 seed comparisons, 51 checkpoint comparisons**, plus exact final scorecard comparisons |
| Existing baseline tests | All original **5 backend + 6 client** tests retained and passing |
| Git whitespace check | `git diff --check` passes |

The backend warning is the existing Starlette test-client/httpx deprecation. The build retains the existing >500 kB main-bundle warning (1,176.92 kB / 327.20 kB gzip); no new dependency was added. Vite transformed 1,605 modules and generated the production bundle in 6.63 seconds. Offline cache generation included seven local assets. The two parity tests cover legacy sessions and the merged instructor/trainee timeline, including injected track properties, sensor state, detection timing, resolution/impact outcomes and scorecards.

### Manual evidence

- First walkthrough: two independent in-app browser tabs, session `63177c27-02dc-49d1-aa14-e226886d33bc`, trainee `QA-INSTRUCTOR`, seed 482913. **15 applied instructor commands**, eight injected contacts (T9–T16), three trainee actions against the injected FPV. The paused clock stayed at T+9.87 while more than 40 wall-clock seconds elapsed. Radar jam/failure/restore, RF failure/restore and day/night changes were visible. The FPV remained active after an RF jammer attempt with an explicit explanation.
- Reloaded the paused exercise: original session, clock, injected tracks, sensor state and trainee decisions recovered without duplicate injection. Completed with **Server verified**, 16 AAR rows, 14 hostile threats and all 15 commands. The swarm was visible in replay at its recorded execution tick.
- Second walkthrough: trainee in Codex in-app browser, Instructor Console in **Chrome**, session `47ebd50f-9bec-45bf-9974-9f9261c902d1`, trainee `QA-CROSS-BROWSER`. **13 applied instructor commands**; repeated quad/FPV/swarm, sensor failures/restores, day/night and pause/resume. The clock stayed at 00:08 while commands arrived; the FPV again resisted jamming. Stopped the local server, ended the drill, observed **Device score · verification pending**, restarted the server and used Retry verification. Result: **Server verified**, 16 AAR rows, 14 hostile threats, 13 auditable commands and swarm replay at tick 266. Completed sessions disabled instructor controls.
- Test drills intentionally left most threats unhandled, so their verified score was 0 with 11 impacts. This confirms authoritative outcome calculation, not a trainee passing result.
- Screenshots: `docs/qa/instructor-control.jpg`, `docs/qa/controlled-aar.jpg`, `docs/qa/cross-browser-aar.jpg`. These contain only illustrative local QA sessions. No public or LAN exposure was used.

### Acceptance

All requested Stage 1 acceptance criteria passed: real active discovery; pause/resume; quad, no-RF FPV and six-drone swarm; radar degradation/failure/restoration; RF failure/restoration; visible sensor state; day/night; injected threat logic and RF immunity; persisted command audit; authoritative reconstruction; deterministic replay/parity; all original and added tests; production build; manual two-browser walkthrough. A second physical LAN device remains untested, as documented above.

## Changed files

- `README.md`
- `client/src/App.tsx`
- `client/src/Instructor.tsx`
- `client/src/Radar.tsx`
- `client/src/main.tsx`
- `client/src/sim.test.ts`
- `client/src/sim.ts`
- `client/src/sim.worker.ts`
- `client/src/storage.ts`
- `client/src/style.css`
- `client/src/types.ts`
- `docs/INSTRUCTOR-CONTROL.md`
- `docs/qa/controlled-aar.jpg`
- `docs/qa/cross-browser-aar.jpg`
- `docs/qa/instructor-control.jpg`
- `server/engine.py`
- `server/main.py`
- `server/models.py`
- `server/storage.py`
- `server/tests/test_instructor.py`
