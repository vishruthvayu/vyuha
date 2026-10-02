# VYUHA · Counter-drone training prototype

**Team WhiteList&0** · SIH26247 / target demonstration: **4 October 2026**.

This is the first playable implementation of the supplied plan. It is a local training prototype using illustrative parameters. It does not claim validated military signatures, operational doctrine, or real-world training efficacy.

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

The Compose file publishes only to this laptop's loopback interface. Multi-laptop unit training, HTTPS on a LAN, roles, and authorization are later work. Do not expose this unauthenticated demo publicly.

## Implemented

- React / TypeScript / Three.js observation scene with an urban terrain and visual day, thermal, and night modes.
- Independent 30 Hz Web Worker simulation, seeded tracks and deterministic sensor observations.
- Eight mixed contacts: bird, friendly quadcopter, RF-linked hostile quadcopters, a fixed-wing threat, and a no-RF FPV.
- Radar degradation at T+22–30s; RF / IFF evidence; contact selection and camera focus.
- Designate → classify type and identity → hold / RF jammer / kinetic response.
- Range restrictions, an illustrative restricted zone, no-RF jammer failure, protected-asset impacts, and non-hostile engagement failure.
- Versioned browser and Python replay/scoring engines with cross-language regression tests.
- Server reconstructs outcomes from its issued scenario plus validated actions; client scores are labelled pending until verified.
- SQLite session store; idempotent event batches; replay and reference debrief; JSON session export.
- IndexedDB records and unfinished-drill recovery. A production service worker precaches all local application assets.
- Actual trainee/session history and unit skill overview; no invented dashboard results.
- Two-skill Beta profile and a seeded Thompson-sampling focus choice. Response-focused drills add a no-RF contact. This is an initial adaptive policy, without calibrated 70% difficulty targeting or anti-rote similarity filtering.
- 2D tactical fallback and responsive layout.

## October 4 boundaries

The 75-second scripted drill is playable. The shortened presenter demo pauses at selected contacts and ends early after demonstrating one correct response and one unsuitable response; unhandled contacts continue during scoring, so early ending never hides remaining threats.

The original plan's 12-drone live instructor injection, 3D replay scrubber, advanced Ghost Expert, VR, rural terrain, validated sensors, audio, rapid ID, eight-skill director, unit LAN operations, MongoDB, USB bundle signing, SigNoz and role-based accounts are **not implemented**. The AAR replay is currently a deterministic 2D tactical replay, and the reference debrief is template-based.

The 15-point rubric node currently rewards timely threat resolution, not Kendall-tau swarm prioritization. The interface says so. The session averages hostile-contact scores, subtracts 10 per asset impact, and fails on non-hostile engagement. Classification and response percentages include all contacts.

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

## Files

- `client/src/sim.ts`, `server/engine.py`: mirrored deterministic training model.
- `client/src/sim.worker.ts`: simulation worker.
- `server/models.py`: validation contracts.
- `server/main.py`: generation, sessions, event upload, completion, AAR, profiles and unit endpoints.
- `docs/OCTOBER-4.md`: rehearsal script and acceptance checklist.

Portal swap permission, official submission deadline, college details and live submission count have not been verified by this build.
