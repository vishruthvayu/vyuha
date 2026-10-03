# VYUHA final submission validation

Team WhiteList&0, registered Team ID 185350, PS SIH26247, Software. College/member names are omitted at the user's explicit request. Release work is in progress; this document does not declare submission readiness.

## Accepted validation exception

Dedicated physical WAN disconnected + LAN retained + separate physical trainee device: **NOT PERFORMED BEFORE SUBMISSION**.

Reason: **Required physical/network setup unavailable during final validation window.**

This is a known validation limitation, **not a failed architectural test**. The user explicitly revised Stage 7 policy to permit submission/release without this test. No other mandatory Stage 7 check is waived. The unperformed physical test must never be described as passed, simulated proof, field validation or air-gap certification.

**Physical multi-device LAN training was validated. Runtime assets and services are hosted locally; dedicated WAN-disconnected physical validation remains pending.** VYUHA is local-first and LAN-deployable, with no required cloud service during training by design. Initial dependency installation may require Internet. A local-origin outage is distinct from WAN loss; plain LAN HTTP browser security can constrain cached cold reload when that origin is absent.

Existing evidence includes the Mac officer/server and Android/Chrome trainee, real instructor commands over LAN, physical completion/AAR, command/session isolation, simultaneous trainee browsers, six simulated concurrent clients, locally bundled production assets, clean-clone deployment, real server-process outage recovery, queued actions and resynchronization. These checks are separate from the omitted WAN-disconnected physical test.

## Release checks

The candidate baseline is `b974b6fca32fcc2a58d2c3967d29508a11cea8a2`. Final regression, clean-database end-to-end walkthrough, release branch, historical reconstruction, claim audit, exact source evidence, media, six-slide PDF, rehearsals, source-package extraction and immutable tag/remote verification will be recorded here as completed. An automated result alone cannot mark unperformed human or physical tasks complete.

The final `/system/evidence` endpoint prefers `docs/release-evidence.json`; older installations retain the Stage 6 fallback. Source changes produce a visible freshness warning. The physical status and exception reason remain explicit in the final manifest and UI.

## Remaining limitations

Dedicated physical WAN-off/LAN-on validation was not completed before submission. Multi-device LAN operation, local asset serving, process-outage recovery and queued-event resynchronization were validated separately.

- Trusted-LAN prototype without production authentication or deployment certification.
- Illustrative sensor/threat/effector parameters and Doctrine Packs require subject-matter calibration.
- Server reconstruction validates consistency, not cryptographically trusted action telemetry.
- HMAC portable transfer checks integrity with a shared secret, not identity, authenticity or non-repudiation.
- Recorded practice is experimental, with no fabricated tactical score, impacts or missing ground truth.
- The synthetic learner experiment is not human efficacy evidence. No human efficacy study was performed.
- M1/Android measurements lasted 20 seconds per count. Whole-browser memory and sustained-load certification were not measured. Six-client HTTP results are simulated clients on loopback.
- Crew roles, real hardware feeds, VR, rain modeling and formal field evaluation remain deferred.

Current submission status: **IN PROGRESS**. The dedicated physical WAN exception is disclosed and does not block release; other mandatory checks still apply.
