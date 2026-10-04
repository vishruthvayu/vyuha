# Competitive polish — final validation

Candidate branch: `feature/competitive-polish-v1`, created directly from sealed v1.0.0 commit `14a38ad9f8dd6d895f87fd568f0c5865b727e3a4`. The v1.0.0 branch/tag and all nine sealed asset hashes remain unchanged. This candidate is eligible for v1.0.1; it does not automatically replace the sealed submission build.

## Preservation and scope

Baseline before edits: 134 backend, 44 frontend, 312 parity checkpoints, successful production build with 22 local assets. Final source regression: **139 backend, 53 frontend, all 312 checkpoints, successful build with 23 local assets**. The same existing Starlette/httpx and large Three bundle warnings remain.

No dependencies, database migration, new physics, AI policy, Director, Ghost, scoring, sensor mechanics, VR, or hardware integration were added. The authoritative source files listed in architecture-preservation.json are byte-for-byte unchanged from v1.0.0.

All **18 historical completed sessions** remain compatible: 14 vyuha-0.2.0 and four vyuha-0.1.0. Stored scorecards, Ghost/timelines and four-skill profiles remain readable. The exact immutable history digest is unchanged: `cce52299fb319073feb81fc0d3f2420a867ff7393421ca9f69940e9aef051b45`. Reconstruction and heatmap compatibility were checked on a disposable backup; the production database was not modified.

## Operator presentation

Central helpers explain phase, contact selection, designation, classification, frozen effector availability, session completion, stale connection and pending request conditions. NEXT shows one current step. Studio, Director, Rapid ID, join, assignment and verification controls also expose actual disabled-state reasons.

Instructor transport displays READY, SENDING and ACKNOWLEDGED from real requests/receipts. APPLIED requires the persisted trainee tick/order. FAILED transport leaves outcome unconfirmed; stale trainee application is TIMED OUT/unconfirmed. Polling can establish an originally unconfirmed command as acknowledged/applied. Retries retain their original command ID. Completed-session histories show timestamps, labels, trainee/session and recorded state.

The optional tour has six stops: Director/profile, Training Ground, Instructor, Ghost/Time Machine, Unit Analytics and Evidence. It highlights available UI and links to the actual workspaces. Completion persists as `tour_completed`; skip does not falsely mark completion. Reload, completion, skip and Operator Guide replay were verified. About 40 seconds is a reading estimate, not a timed human judge study. The tour does not start automatically or pause the simulator.

Overview is elevated and stable; Observer provides an angled contact view; Follow tracks the chosen contact and falls back to Overview for missing/ended contacts. Missing selection disables Follow with its reason. External debrief terrain is translucent to avoid illustrative buildings hiding the event. Camera damping is presentation only. Timeline jumps retain exact tick/order, select the recorded contact and enable Follow. The original tactical 2D/WebGL-error/quality fallbacks remain.

The heatmap reads the existing four-skill outcome ledger, grouping the five persisted tactic values plus LEGACY and RAPID_ID. Both selected-unit pooled and selected-trainee scopes are tested. Each cell shows Beta(1,1) estimate and count, with successes/failures on disclosure. Zero samples display —/n=0. Rapid ID contributes only classification. These are training evidence, not readiness or efficacy metrics.

Thermal White Hot, Black Hot and Amber change materials/background only. Night grain is faint, static and absent from Tactical 2D. Radar NORMAL/DEGRADED/OFFLINE and RF NORMAL/OFFLINE badges use text as well as restrained styling. Existing bird/fixed-wing/multirotor geometry is retained; friendly and no-RF identities are not revealed with new truth colors. No sensor-fidelity improvement is claimed.

## Measured rendering

Available MacBook Air M1, 8 GiB, in-app Chromium; fixed Medium, Auto off, 20 seconds per case. Final live-view medians were **60 FPS at 8/50/100/200 contacts**, matching historical v1.0.0 medians. A same-machine unchanged v1.0.0 200-contact repeat also measured 60 FPS (worker median 0.1 ms/p95 0.3 ms).

At 200 contacts, night grain and Overview each measured 60 FPS median; Follow measured **58 FPS**, a 3.3% difference from 60 and an acceptable modest cost for the new external replay view. Worker p95 was 0.1–0.6 ms across final cases, far below the 30 Hz tick budget. Raw samples retain lower initial view-transition values, including night 17 FPS and Overview 28 FPS; sustained values recovered. An exploratory run with overlapping builds dipped to 56 FPS; builds/tests were stopped for the final repeats. Timer-rounded zeros do not mean cost-free computation. These short runs do not certify endurance performance.

The heatmap's actual seven-row/28-cell page, unit/trainee filters and disclosure were verified in the browser. Ten loopback API reads on one completed QA session measured 16.6 ms median under regression load. This is not a large-history UI benchmark.

## Integrated walkthrough

A new disposable database and synthetic callsign POLISH-QA were used through ordinary browser controls. Director prepared a real frozen DECOY_THEN_STRIKE drill. Radar degradation was observed as ACKNOWLEDGED, then APPLIED at tick 8/order 0; injected no-RF FPV applied at tick 8/order 1. Trainee badge changed to DEGRADED.

T7 was designated, classified and subjected to an ineffective RF jammer through the real controls. The exercise was ended early at observed tick 557 (18.57 seconds), with server verification. Ghost identifies NO_RF_JAM_INEFFECTIVE at tick 548/order 4, actual RF jammer versus reference kinetic, with evidence/reason/consequence/score scope unchanged. Final score retains the original 75-second projection; Ghost does not claim a projected impact was observed.

The exact mistake jump selected T7. Overview, Observer, Follow and tour replay/skip were verified. The persistent profile updated to one session; the heatmap's DECOY_THEN_STRIKE / Effector Choice cell showed **0 successes, 1 failure, n=1, Beta estimate 33.3%**, checked directly against the persisted ledger. Evidence exposes current candidate results and separates inherited physical/network/CPU evidence.

These are software-QA actions, not new human efficacy or physical-network validation. QA screenshots and the disposable database are outside Git under the canonical Desktop project directory. Existing final video/PDF were not regenerated.

## Limitations

Physical WAN-off/LAN-on validation: **NOT PERFORMED BEFORE SUBMISSION**.

Reason: **Required physical/network setup unavailable during final validation window.** This is a known validation limitation, not a failed architectural test and not the release blocker. No other acceptance requirement is waived.

Physical multi-device LAN training was validated. Runtime assets and services are hosted locally; dedicated WAN-disconnected physical validation remains pending.

Dedicated physical WAN-off/LAN-on validation was not completed before submission. Multi-device LAN operation, local asset serving, process-outage recovery and queued-event resynchronization were validated separately.

Trusted-LAN prototype; no production authentication, human efficacy study, operational readiness certification, military sensor calibration or new VR support. Illustrative parameters/rules remain. Portal submission and human delivery rehearsal are separate obligations. Sealed v1.0.0 media remains historical and is not relabeled as candidate footage.

## Decision

The five requested improvements are implemented and the candidate is demonstrably clearer, with preserved authority/history and acceptable measured rendering cost. Recommend preparing v1.0.1 for submission. Keep the feature branch separate for review; the optional release/tag and regenerated final media are not created automatically.
