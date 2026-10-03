# VYUHA · Counter-drone training prototype

**Team WhiteList&0** · SIH26247 / target demonstration: **4 October 2026**.

This is the playable implementation of the supplied plan. It is a local training prototype using illustrative parameters. It does not claim validated military signatures, operational doctrine, or real-world training efficacy.

## Start

From this directory:

```sh
bash scripts/start-local.sh
```

Open **http://127.0.0.1:8000**. The script builds the browser app and starts FastAPI. First installation needs internet; the built app and local server do not. The startup script creates the Python virtual environment and installs frontend dependencies when they are missing.

Development:

```sh
bash scripts/dev.sh
```

Development frontend: http://127.0.0.1:5173. Stop an existing server on port 8000 before starting either script; both intentionally use the same local API port.

Docker alternative (Compose configuration checked; the image build is unverified because Docker Desktop is not running here):

```sh
docker compose up --build
```

The default Compose file publishes only to this laptop's loopback interface. Stage 4 adds explicit trusted-LAN startup with `bash scripts/start-unit.sh` and an opt-in Compose override. See [docs/UNIT-MODE.md](docs/UNIT-MODE.md) for joining, Instructor controls, persisted unit analytics and recovery. No authentication/authorization is enabled; do not expose this prototype publicly.

## Implemented

- React / TypeScript / Three.js observation scene with an urban terrain and visual day, thermal, and night modes.
- Independent 30 Hz Web Worker simulation, seeded tracks and deterministic sensor observations.
- Eight mixed contacts: bird, friendly quadcopter, RF-linked hostile quadcopters, a fixed-wing threat, and a no-RF FPV.
- Radar degradation at T+22–30s; RF / IFF evidence; contact selection and camera focus.
- Designate → classify type and identity → hold / RF jammer / kinetic response.
- Range restrictions, an illustrative restricted zone, no-RF jammer failure, protected-asset impacts, and non-hostile engagement failure.
- Versioned browser and Python replay/scoring engines with cross-language regression tests.
- Server reconstructs outcomes from its issued scenario plus validated actions; client scores are labelled pending until verified.
- SQLite session store; idempotent event batches; authoritative Ghost Expert review and tactical replay; JSON session export.
- IndexedDB records and unfinished-drill recovery. A production service worker precaches all local application assets.
- Actual trainee/session history and unit skill overview; persisted Beta trends, stored session A/B comparisons and real Director focus history.
- Four persistent Beta skill profiles from authoritative Ghost outcomes; backend seeded Thompson sampling, three difficulty bands, twelve adaptive templates and recent-template repetition protection. The approximately 70% success target is heuristic, not calibrated.
- Five deterministic Red Force patterns, three versioned illustrative Doctrine Packs, validated instructor authoring and an immutable playable scenario library.
- Separate 10–20-round Rapid ID with active-time recovery, per-round review and authoritative classification-only skill updates.
- Advanced drills score real pairwise hostile prioritisation with auditable risk/time-to-impact facts and grounded Ghost explanations.
- 2D tactical fallback and responsive layout.

## Instructor Console v1

Open **http://127.0.0.1:8000/instructor** in a second browser/tab while a trainee exercise runs at `/`. Sessions appear after the first telemetry update. Select an ACTIVE or PAUSED session.

- Pause/resume, hostile RF quad and no-RF FPV injection, and a six-drone swarm.
- Radar degradation/failure/restoration, RF sensor failure/restoration, and day/night conditions.
- Actual session discovery, simulation time and active-contact count; stale sessions are RECOVERABLE and finished sessions are COMPLETED.
- SQLite command ordering, idempotent command IDs, immutable execution acknowledgements and audit history.
- Worker-controlled execution; server reconstruction and AAR include the same ordered instructor commands.
- Local IndexedDB recovery includes the command log.

See `docs/INSTRUCTOR-CONTROL.md` for contracts, reconstruction, testing and limitations. The console requires the local server; standalone device practice remains available when it is unreachable.

## Ghost Expert + Time-Machine AAR v2

Ghost Expert is rule-grounded: no LLM is used, and explanations are deterministic templates generated only from reconstructed facts. Server reviews compare detection, classification/IFF and hold/jammer/kinetic decisions with the existing rubric, showing available evidence separately from ground truth, observed consequences, final contact/node scores and four skill tags. A deterministic summary recommends a review focus. The separate Stage 3 Director uses persistent four-skill evidence rather than forcing this last-session recommendation.

The tactical timeline includes instructor commands, sensor changes and contact outcomes. Play/pause, scrubbing and event jumps reconstruct the actual tactical world, including same-tick pre-action states. Early sessions review only their recorded interval while clearly labelling the preserved 75-second scoring projection. Verified reviews are cached for offline reading; device-only scores do not generate expert expectations.

See [docs/GHOST-AAR.md](docs/GHOST-AAR.md) for the contract, reason codes, validation and measured performance. Threat/sensor parameters remain illustrative. Original Night Watch retains timely-resolution prioritisation; advanced drills use the Stage 5 ranking metric. These references are not validated military doctrine.

## AI Threat Director v1

Choose a trainee ID and **Adaptive / Skill practice**, then **Prepare adaptive drill**. Review the server-selected focus, Beta mean, evidence count, difficulty, reason and actual scenario conditions before **Start adaptive drill**. The Director seed is editable for reproducible selection; the card separately shows the generated simulation seed. The exact returned scenario is launched.

Completed verified sessions update `detection`, `classification_iff`, `effector_choice` and `degraded_sensor_response` transactionally and once per session. Profiles preserve Beta(1,1) priors and retain outcome provenance. Zero observations is a baseline prior, and small counts are labelled limited evidence. Percentages are **VYUHA training mastery estimates, not validated operational competence**. No LLM or real-world training-efficacy claim is involved. Approximately 70% success difficulty targeting is a simple heuristic. Scenario and sensor parameters remain illustrative.

Adaptive generation needs the original local server. Instructor Control and Ghost AAR work with adaptive scenarios. See [docs/DIRECTOR-V1.md](docs/DIRECTOR-V1.md) for the mapping, 12-template matrix, deterministic selection, anti-rote fallback, browser proof and measured performance. Stage 4 — Real Unit Mode + Multi-Laptop LAN Training — is implemented, with minimum physical LAN and browser server-outage tests passed. A full WAN-off reload/start check remains pending by user choice. [Unit Mode evidence and limitations](docs/UNIT-MODE.md). Stage 5 implements all six advanced-training systems; [contracts, walkthrough, tests and measurements](docs/STAGE-5-ADVANCED-TRAINING.md). Stage 6 has not started.

## Advanced training v1

At `/`, choose **Adaptive / Skill practice**, **Scripted / Library**, or the preserved **Original Night Watch** drill. Rapid ID and Training history are separate sidebar links. Open `/exercises` from Instructor to select the unit's pack, validate/preview/save an urban 75-second exercise and assign the immutable library scenario to connected trainees. Both tactical modes use the existing verified score, Ghost, replay and profile pipeline.

The three pack versions change effector ranges, restricted kinetic sector, default traffic/fog/time and transparent risk weights. The five Red Force patterns change actual spawn timing, formation and warning opportunity. LOW_APPROACH uses reduced illustrative sensor range, with no terrain occlusion. New advanced scorecards use the preserved 25/25/15/35 rubric with a real pairwise Kendall agreement × engagement coverage prioritisation node. Early ending keeps the 75-second scoring projection visible.

Rapid ID supports 10–20 five-second rounds, pause/reload recovery, actual accuracy/error counts and median client active response time. Each answer updates only classification/IFF once at authoritative session completion. Analytics shows exact ledger estimates, observed session differences, current-cohort unit trends and actual Director focus changes. No training-causation claim is inferred.

See [Stage 5 documentation](docs/STAGE-5-ADVANCED-TRAINING.md) for field constraints, snapshots, scoring edge cases, integrated browser evidence, all test coverage and measured overhead. Crew mode remains future scope.

## October 4 boundaries

The 75-second scripted drill is playable. The shortened presenter demo pauses at selected contacts and ends early after demonstrating one correct response and one unsuitable response; unhandled contacts continue during scoring, so early ending never hides remaining threats.

The original plan's 12-drone live injection, 3D replay scrubber, VR, rural terrain, validated sensors, audio, eight-skill director, authenticated multi-laptop unit operations, MongoDB, USB bundle signing, SigNoz and role-based accounts are **not implemented**. The AAR uses deterministic 2D tactical replay and the rule-grounded Ghost Expert described above. The four-skill individual Director v1 is implemented; the original eight-skill/unit proposal remains outside this stage.

Original Night Watch retains its historical timely-resolution 15-point node. Advanced scenarios use the documented pairwise Kendall ranking agreement and coverage node, with stored evidence and Ghost review. The session averages hostile-contact scores, subtracts 10 per asset impact, and fails on non-hostile engagement. Classification and response percentages include all contacts.

Checksums and server replay do not make user action logs tamper-proof: an adversarial user can fabricate plausible inputs. This build validates consistency and reproduces outcomes; stronger identity, trusted telemetry, and signatures are separate work.

## Verify

```sh
.venv/bin/python -m pytest server/tests -q
cd client
npm test
npm run build
```

The TypeScript tests invoke the Python interpreter in this checkout to compare scenario generation, sensor observations, replay checkpoints, outcomes and scores. Backend tests use temporary databases, not the demonstration history.

## Validation record

See `docs/VALIDATION.md` for the completed automated and browser checks, and the remaining team-laptop checks. The source ZIP excludes installed dependencies and training history; first setup on another laptop needs internet.

Stage 2 validation: 32 backend tests, 20 frontend tests, both existing parity tests with 51 checkpoints, and production build passed. The night drill with an injected six-drone swarm and no-RF FPV passed the browser walkthrough, including successful RF-linked engagement, reload recovery and cached AAR reading during a server outage. Detailed evidence and measurement scope are in [docs/GHOST-AAR.md](docs/GHOST-AAR.md).

Stage 3 validation: **50 backend tests, 25 frontend tests, production build and 7 offline assets passed**. The original 51 parity checkpoints remain green, with 72 additional checkpoints across all 12 Director templates. Browser closed-loop proof passed, including profile persistence after server restart. Full evidence and the 50-sample runtime measurements are in [docs/DIRECTOR-V1.md](docs/DIRECTOR-V1.md).

Stage 5 validation: **106 backend tests, 36 frontend tests, 51 original simulation + 72 Director + 135 advanced parity checkpoints**, production build and seven offline assets passed. The integrated UI walkthrough covered pack selection, authored library assignment, poor priority, no-RF jammer failure, verified score/Ghost, profile → Director → next drill, ten-round Rapid ID, exact analytics and real server-process outage recovery. Six simulated advanced trainees completed 18 verified sessions. Measured loopback medians were upload 4.97 ms, poll 2.87 ms, dashboard 105.83 ms and completion 117.17 ms; dashboard/scoring overhead versus the same-run legacy workload is explicitly reported. [Full Stage 5 evidence](docs/STAGE-5-ADVANCED-TRAINING.md). Physical Stage 4 WAN-off cached reload/start remains pending by user choice.

## Files

- `client/src/sim.ts`, `server/engine.py`: mirrored deterministic training model.
- `client/src/sim.worker.ts`: simulation worker.
- `server/models.py`, `server/director_models.py`: validation contracts.
- `server/director.py`, `client/src/Director.tsx`: authoritative skill updates, Director selection/adaptation and profile/decision UI.
- `server/main.py`: generation, sessions, event upload, completion, AAR, profiles and unit endpoints.
- `server/exercises.py`, `server/advanced.py`: tactics, versioned packs, authoring/library, Rapid ID and historical analytics.
- `server/prioritisation.py`, `client/src/prioritisation.ts`: mirrored auditable hostile-order scoring.
- `client/src/ExerciseStudio.tsx`, `RapidID.tsx`, `Analytics.tsx`: advanced exercise and review interfaces.
- `docs/OCTOBER-4.md`: rehearsal script and acceptance checklist.

Portal swap permission, official submission deadline, college details and live submission count have not been verified by this build.
