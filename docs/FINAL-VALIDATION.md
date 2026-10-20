# Current Finale validation status — 12 October 2026

The Stage7/v1.0.0 submission record below is historical. The active Finale candidate is source3ec720d on feature/vyuha-finale-edition:453backend/133frontend/build, full parity/history and a newly installed macOS clean clone PASS within their stated scope. Analytics authorization, officer AAR isolation, Crew isolation, Fusion durability and evidence-only reference immutability are verified. See [Finale release gates](finale/FINAL-RELEASE-GATES.json) and [current evidence](finale/evidence.json).

Historical WAN-off operation was subsequently team-confirmed, with exact build and some procedure details unavailable. **Fresh Finale physical-device validation remains PENDING_BY_USER**, as does native Windows/Linux execution. These are known validation limitations, not failed architectural tests. No new stable release/tag or Finale submission media is approved. v1.0.1 remains the unchanged fallback. The earlier exception/limitations below describe the original pre-submission record and must not be presented as current Finale acceptance.

---

# VYUHA final submission validation

Team WhiteList&0, registered Team ID 185350, PS SIH26247, Software. College/member names are omitted at the user's explicit request. Software and submission artifacts have passed their checks. The user confirmed that the final backup is saved on a separate Android device and plays from Downloads. Exact immutable tag, private remote and final archive checks are recorded in the delivered RELEASE-RECEIPT.json.

## Accepted validation exception

Dedicated physical WAN disconnected + LAN retained + separate physical trainee device: **NOT PERFORMED BEFORE SUBMISSION**.

Reason: **Required physical/network setup unavailable during final validation window.**

This is a known validation limitation, **not a failed architectural test**. The user explicitly revised Stage 7 policy to permit submission/release without this test. No other mandatory Stage 7 check is waived. The unperformed physical test must never be described as passed, simulated proof, field validation or air-gap certification.

**Physical multi-device LAN training was validated. Runtime assets and services are hosted locally; dedicated WAN-disconnected physical validation remains pending.** VYUHA is local-first and LAN-deployable, with no required cloud service during training by design. Initial dependency installation may require Internet. A local-origin outage is distinct from WAN loss; plain LAN HTTP browser security can constrain cached cold reload when that origin is absent.

Existing evidence includes the Mac officer/server and Android/Chrome trainee, real instructor commands over LAN, physical completion/AAR, command/session isolation, simultaneous trainee browsers, six simulated concurrent clients, locally bundled production assets, clean-clone deployment, real server-process outage recovery, queued actions and resynchronization. These checks are separate from the omitted WAN-disconnected physical test.

## Release checks

Implementation freeze: `0f17830c7fd821f105091400d6ac146e17fbf145`, based on `b974b6fca32fcc2a58d2c3967d29508a11cea8a2`. Release branch: `release/v1.0.0`. Documentation/media commits preserve the tested implementation source hash; `v1.0.0` identifies the final exact release commit. The delivery receipt resolves its numeric commit and verifies remote identity after sealing; no circular self-hash is embedded in the tagged documentation.

| Check | Actual result and scope |
|---|---|
| Final regression | **134 backend, 44 frontend, 312 parity checkpoints**, production build passed; 22 local assets, fingerprint `6ccb96b52205`. Existing Starlette/httpx deprecation and Three.js chunk warnings retained. Durations under heavy host load are not benchmarks. |
| Historical compatibility | All **18** prior stored cards/immutable fields match the private pre-Stage6 backup; all AAR/Ghost/timelines and four-skill profiles readable. Aggregate receipt only; no raw private history in source/package. |
| Clean-database E2E | Fresh unit/trainee; real HTTP adaptive issue, instructor acknowledgement, ordinary verified score83, Ghost, profile, nextDirector, separate Rapid10/10 and analytics. Synthetic QA timings, not human or physical proof. |
| Actual browser demonstration | Fixed authored Night Decoy Strike seed482913 with rural/night/fog, mixed friendly/bird/RF/noRF, decoy/strike phases, officer command, verified ordinary score30, exact noRF Ghost reason, replay jump, profile/nextDirector. Authored library assignment is distinct from Director generation. |
| Rehearsals | Three **agent-led single-operator technical rehearsals**, fresh local startup each: **62.656 /57.817 /77.106s**. Second run should add about3s of spoken pacing. Each includes scripted Q&A review and actual Tactical2D control for a simulated rendering-failure cue. No human team/judge/narration timing claim. Issues preserved in `qa-stage7/rehearsals.json`; no new runtime features after rehearsal began. |
| Media | Primary **2:50**, narrated/captioned; backup **2:00**, chronological capture with captions. Both1280x720 H264, full decoding passed. Genuine variable-cadence browser frame captures with held frames; output15fps is not capture/rendering FPS. Primary uses local synthetic eSpeak-NG narration, verified nonempty and chapter-bounded. |
| Official presentation | **Six-slide PDF**, including title, official2026 template headings/pointers/branding retained; Software, Team185350, WhiteList&0. College/member names omitted at user request. All6 PPTX and6 PDF page renders visually reviewed; native tables and package geometry/import validation passed. |
| Claims | Canonical feature manifest used by README/deck; simulated learner results labeled, no human efficacy, validated military doctrine, trusted telemetry, Internet-disconnected physical or operational-readiness claims. |
| Clean source deployment | Exact Git implementation blobs exported with documented exclusions, extracted to a new temp directory, fresh venv/locked pip install/npm ci/build through `scripts/start-local.sh`, started local server and repeated freshDB HTTP walk. Same Mac, not secondOS. Setup used Internet. |
| Recording redundancy | **CONFIRMED by user**: final120second backup saved on separate Android/Chrome and plays from Downloads. Filename and served-file hash recorded in `qa-stage7/media.json`; no independent phone hash claim. |
| Immutable tag / remote | `v1.0.0` on `release/v1.0.0`; exact target/private remote verification in delivered `RELEASE-RECEIPT.json`. Main, v0.1.0 and prior stage branches are preserved. |

Early ending projects score penalties to the75-second horizon. The captured demo's two asset penalties are projections, not observed later impacts. Ghost keeps the observed interval separate. In primary DEMO-01 footage the radar jam follows the deliberate mistake; backup REH-03 applies it first. Narration and captions reflect that difference.

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

Submission package status: **READY after seal verification in RELEASE-RECEIPT.json**. The dedicated physical WAN exception is disclosed and does not block release; no other mandatory check is waived. Portal upload has not been performed. Team delivery responsibilities and authenticated portal deadline confirmation remain presentation/submission actions, not fabricated validation results.
