# VYUHA judge Q&A

Use the exact release evidence and disclosed validation scopes; team metadata: WhiteList&0, 185350, Software.

## Why simulate instead of using real drones?

Simulation lets trainees repeat recognition and response decisions safely across reproducible mixed-contact scenarios, without requiring live aircraft for each repetition. It complements live training. We have not measured cost savings or proven transfer to field performance.

## Are these real radar signatures?

No. Sensor, threat, range and effector parameters are illustrative. Versioned Doctrine Packs configure supported rules, and observation adapters provide a future calibration/input path. Defence subject-matter review and measured signatures remain deployment work.

## What does the AI actually do?

The Director maintains four Beta skill estimates from server-reconstructed outcomes. Seeded Thompson sampling selects a focus, a heuristic chooses difficulty, and recent-template filtering reduces repetition. The approximately 70% target is uncalibrated. Ghost uses deterministic rule-grounded explanations. There is no LLM.

## Why a browser rather than Unity?

We chose a browser to serve trainee clients from one local laptop, use a shared web stack and keep the deterministic 30 Hz simulation in a Worker. Unity is a viable alternative. Our measurements apply to this implementation and tested devices, not a general comparison between engines.

## Can a trainee fake a score?

The browser shows a pending preview. The server reconstructs the issued scenario, acknowledged instructor commands and ordered trainee actions, then stores the authoritative score and outcome ledger. Duplicate uploads/completions do not duplicate skill updates. This checks consistency rather than cryptographically trusted telemetry; plausible fabricated action logs remain a limitation.

## Does it work offline?

Current software serves all required training assets and APIs locally after setup. First installation may download dependencies. Physical multi-device LAN training was validated. Dedicated physical WAN-off/LAN-on validation is NOT PERFORMED BEFORE SUBMISSION because the required setup was unavailable. This is a disclosed limitation, not a failed architectural test. A local-server outage is a different case: an active drill queues actions and later synchronizes. Plain LAN HTTP cached cold reload while the origin is absent is browser constrained.

## Does adaptive training improve soldiers' performance?

We have no human efficacy evidence. In an abstract paired experiment, 50 profiles per policy ran 30 sessions. Director reached the specified hidden-skill threshold in 8/50 runs versus random's 5/50, with conditional median 21.5 versus 28 sessions and a small final hidden-skill difference. The learning law is uncalibrated. Voluntary pre/post evaluation tooling exists for future factual measurements.

## Can you connect real sensors?

There is a normalized software observation contract for simulated and recorded sources. Recorded JSON can be replayed for unscored decision practice, with import hash/schema provenance and no invented ground truth or impacts. Real sensor hardware integration is deferred.

## How secure is deployment?

This is a trusted-LAN prototype without production authentication. Input bounds, atomic import, backup/restore and HMAC transfer integrity address specific failures. HMAC uses a separately configured shared secret and does not prove sender identity. Production identity, trusted telemetry and deployment security review are future work.

## What scale have you measured?

Six simulated concurrent advanced clients completed 18 canonical sessions over loopback. Median/p95 completion was 83.32/176.74 ms and dashboard 113.74/393.21 ms. On the user-identified weakest available laptop, an M1 MacBook Air with 8 GB RAM, fixed Medium measured 60 median FPS at 8–200 contacts in 20-second runs. This is not sustained-load certification or proof of hundreds of simultaneous users.

## What distinguishes VYUHA?

A closed training loop: an issued exercise produces trainee decisions, server reconstruction produces a score and evidence-aware AAR, persisted outcomes update the skill profile, and the Director selects the next drill. Instructor intervention and unit history make the loop visible across local training sessions.

## What happens if the live demonstration fails?

Use Tactical 2D if 3D fails, local single-laptop mode if LAN fails, and the final backup video if the system cannot run. Actual recording and rehearsal acceptance is tracked in FINAL-VALIDATION.md.
