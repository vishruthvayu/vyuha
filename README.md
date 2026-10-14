# VYUHA · Counter-drone decision training

**WhiteList&0 · Team 185350 · SIH26247 · Software**

VYUHA is a local-first 3D decision-training prototype. Trainees observe mixed aerial contacts through simulated sensors, classify them, choose a response and review a server-verified reconstruction. Adaptive Director v2 selects reproducible raids using recorded skill evidence; Ghost explains decisions, while Time Machine, What-if and reference runs keep original training evidence separate.

## Current development and protected releases

`feature/vyuha-ultimate-experience` develops the Precision Command experience. It is **not yet a validated replacement** for immutable `v1.1.0-rc.2` at `bfe221fb5ad3ac2519277e342761bd770b3e80d8`. RC2 passed 617 backend / 172 frontend tests, full parity,18 baseline / 22 stored compatibility and production build. The original `v1.0.1` fallback and RC1 remain unchanged. Final stable approval is withheld pending physical acceptance for the actual final candidate.

[Engineering evidence index](docs/finale/README.md) · [Release gates](docs/finale/FINAL-RELEASE-GATES.json) · [Physical acceptance](docs/finale/PHYSICAL-TEST-RESULTS.md)

## Prepare and run locally

Requirements: Python 3.11+, Node/npm and internet for the first locked dependency installation. Create the virtual environment locally; do not copy it between operating systems.

```sh
bash scripts/start-local.sh --port 8000
```

The setup installs locked dependencies, builds locally hosted assets and prompts for an officer password if needed. For prepared LAN training:

```sh
bash scripts/start-unit.sh --port 8000
```

Choose the actual Wi-Fi/Ethernet URL printed by the server. Training services/assets run locally; there is no required cloud service during a drill. Officer routes require authentication. Use an isolated trusted LAN and browser-trusted HTTPS for credential confidentiality; do not expose the prototype publicly.

On native Windows use `scripts/start-local.ps1` and `scripts/start-unit.ps1`; Git Bash uses the Windows-created `.venv/Scripts/python.exe`. See [deployment guide](docs/finale/DEPLOYMENT-GUIDE.md) for certificate, backup and restore instructions. Restore into a new database file, never over a live database.

## Training and instructor workflows

- Training ground: adaptive raid preparation, observed contact selection, designation, classification and simulated Hold/RF jammer/Kinetic responses. Legacy Night Watch remains explicitly selectable.
- Shared Crew: assigned spotter/responder capabilities, attributed decisions, reconnection and shared coordination history. Shared results do not credit individual learning profiles.
- Instructor / White Cell: protected multi-session monitoring, observed/reference pictures, faults, injections and command acknowledgment/application evidence.
- Exercise Studio: seeded Raid Composer, versioned frozen scenarios, authored library and group assignments.
- AAR / Analytics: original verified scores, evidence-based decision paths, replay, hypothetical comparisons and persisted skill trends.
- Rapid ID / Recorded practice: recognition and bounded unscored observation practice.
- Transfer / Evidence / Compliance: integrity-checked archives, transparent release receipts and directly linked requirement proof.

## Validation boundaries

Native Arch Linux RC1 passed with genuine defects; RC2 remediated those findings. Native RC2 Linux retest, Windows and fresh separate phone/LAN/WAN/HTTPS trust remain pending. Earlier Mac+Android LAN validation and a team-reported historical WAN-off exercise are dated evidence, not proof of the current candidate.

Sensor signatures, ranges, effects and adaptive estimates are illustrative training models. No empirical sensor calibration, operational qualification or demonstrated human learning gain is claimed. Officer authentication does not turn independent callsigns into secure-exam learner identity. HMAC establishes shared-key bundle integrity, not donor identity or non-repudiation.

## Development checks

```sh
.venv/bin/python -m pytest server/tests -q
cd client
npm test
npm run lint
npm run format:check
npm run build
```

All assets are bundled locally. New UI work preserves deterministic simulation, observed-contact boundaries, existing scoring and historical archives. Source-specific evidence must be refreshed before a new immutable candidate is sealed.
