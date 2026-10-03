# VYUHA — counter-drone training

**WhiteList&0 · Team ID 185350 · SIH26247 · Software · target: 4 October 2026.**

VYUHA is a local-first training prototype for recognising mixed aerial contacts, choosing responses and reviewing decisions. A 30 Hz browser worker models illustrative radar, EO/IR, RF and IFF observations. The local server reconstructs the issued scenario, actions and instructor interventions before verifying scores.

## Run on one laptop

```sh
bash scripts/start-local.sh
```

Open http://127.0.0.1:8000. First setup installs locked dependencies and needs Internet. Built runtime assets and services are hosted locally. Development: `bash scripts/dev.sh`. Stop an existing server before reusing port 8000.

## Run on a trusted unit LAN

After setup/build, run `bash scripts/start-unit.sh`. Open the printed reachable LAN URL on trainee browsers and `/instructor` on the officer laptop. Use a callsign; each browser retains its server-assigned trainee identity. See [Unit Mode](docs/UNIT-MODE.md), [hardening/deployment](docs/STAGE-6-HARDENING.md) and [backup/restore](scripts/backup-data.py). This prototype has no production authentication; use a trusted network.

Physical multi-device LAN training was validated. Runtime assets and services are hosted locally; dedicated WAN-disconnected physical validation remains pending.

Dedicated physical WAN-off/LAN-on validation: **NOT PERFORMED BEFORE SUBMISSION**. Reason: **Required physical/network setup unavailable during final validation window.** This is a disclosed validation limitation, not a failed architectural test, and does not alone block release. No other acceptance requirement is waived.

## Training loop

1. Join a unit and inspect four persistent Beta training estimates.
2. Prepare an adaptive drill. The seeded Thompson-sampling Director selects a focus, difficulty and scenario; its roughly 70% success target is heuristic and uncalibrated.
3. Observe, designate and classify type/identity; hold, jam an RF-linked threat or choose an appropriate modeled kinetic response. Instructor commands can change sensors or inject contacts.
4. Complete the drill and wait for **Server verified**. Ghost Expert explains reconstructed facts; Time Machine revisits the actual decision timeline.
5. Inspect updated profile, next Director recommendation and persisted trainee/unit trends. These are training estimates, not operational readiness or causal efficacy measurements.

## Capabilities and evidence

The canonical [feature manifest](docs/feature-manifest.json) uses IMPLEMENTED, VALIDATED, EXPERIMENTAL and DEFERRED with explicit evidence scopes. Supported capabilities include urban/rural terrain and fog, five Red Force patterns, three illustrative Doctrine Packs, immutable Scenario Studio exercises, auditable hostile-order scoring, 10–20-round Rapid ID, individual/unit analytics, graphics fallback and recovery.

Ghost is rule-grounded, with no LLM. Recorded JSON observation practice is experimental and does not invent tactical scores, impacts or missing ground truth. Consent-gated evaluation tooling has no completed human study. Portable HMAC bundles verify shared-secret integrity, not donor identity or non-repudiation. Local audio is a non-scoring illustrative cue. Crew roles, live sensor feeds, VR, rain, validated military models and production identity remain deferred.

The [final validation record](docs/FINAL-VALIDATION.md), [release evidence](docs/release-evidence.json) and `/system/evidence` distinguish architecture, software checks, physical LAN evidence, simulated load and missing physical WAN validation. The UI warns when source differs from its validation manifest. `/system/benchmark` measures device rendering and worker cost without reducing simulation fidelity.

Measured scope: 18 historical completions retained; six simulated concurrent clients completed 18 sessions; M1 MacBook Air/8 GB fixed Medium and Android/Chrome/6 GiB Auto measured median 60 FPS at 8–200 contacts in 20-second runs. These are bounded measurements, not sustained-load or device certification. The simulated-learner comparison is abstract and uncalibrated, not human efficacy evidence.

## Demonstrate and verify

Release branch: `release/v1.0.0`; immutable tag: `v1.0.0`. Official [six-slide PDF](docs/submission/VYUHA-SIH26247-Team185350.pdf), [primary video](docs/submission/VYUHA-primary-demo-final.mp4) and [backup video](docs/submission/VYUHA-backup-demo-final.mp4) are included. Primary170s uses local synthetic narration; backup120s uses chronological actual browser captures with held frames. Separate Android saved-file playback was confirmed by the user. Exact release/remote/source archive receipt accompanies the submission package.

Use the fixed [Night Decoy Strike preset](examples/demo-night-decoy-strike.json), [demo runbook](docs/DEMO-RUNBOOK.md), [judge Q&A](docs/JUDGE-QA.md) and [claim audit](docs/CLAIM-AUDIT.md). An authored scenario is distinct from a Director-generated drill; both use the ordinary scoring pipeline. Early ending visibly preserves the 75-second scoring projection.

```sh
.venv/bin/python -m pytest server/tests -q
cd client
npm test
npm run build
```

Tests use disposable databases. Tactical parity covers 312 checkpoints. Release branch/tag status and final counts are recorded in FINAL-VALIDATION.md. The source archive excludes databases, keys, installed dependencies, private history and obsolete presentation files. Docker configuration exists; its image build has not been validated on this laptop.

## Limitations

Dedicated physical WAN-off/LAN-on validation was not completed before submission. Multi-device LAN operation, local asset serving, process-outage recovery and queued-event resynchronization were validated separately.

Sensor/threat/effector laws and Doctrine Packs are illustrative. Consistent replay does not attest truthful human inputs; fabricated plausible action logs remain possible. Plain LAN HTTP can constrain cached cold reload when the local origin is absent; active queued actions and subsequent resynchronization were validated separately. Formal human efficacy, field evaluation and operational certification remain future work.
