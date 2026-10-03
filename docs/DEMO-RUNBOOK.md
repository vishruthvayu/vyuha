# Stage 7 demo preparation

Release preparation runbook. Actual completed rehearsals/recordings are listed in FINAL-VALIDATION.md; this script alone is not evidence. The WAN exception does not waive any other check.

## Canonical scenario

Name: DEMO — NIGHT DECOY STRIKE. Fixed seed: 482913. Use existing schema v2 authoring, Army Forward Post @1, rural terrain, night, fog .2, DECOY_THEN_STRIKE, 75-second duration and ordinary scoring. Mix: T1 neutral bird, T2 friendly quad, T3 RF hostile quad, T4 hostile no-RF FPV, T5 RF hostile quad. Keep restricted sector enabled. Use an officer radar intervention during the exercise rather than special demo scoring.

The saved preset was validated through the existing authoring API and Scenario Studio preview. Three actual technical rehearsals and the captured DEMO-01 run use ordinary scoring; no demo-only scoring or perfect-score override exists.

Keep two demonstrations distinct: (1) the Director's actual adaptive recommendation and next-drill update, (2) the instructor's reproducible authored exercise. Do not describe an authored library assignment as a Director-generated scenario. If an adaptive scenario with equivalent conditions is selected through the actual Director, preserve its exact issued seed/spec and show that real path instead.

## Live script target: 90 seconds

| Time | Screen/action | Spoken point |
|---|---|---|
| 0–10 s | Show pseudonymous demo profile and actual Director card | The Director reads four persistent training estimates and recommends the next focus. |
| 10–20 s | Start the prepared authored Night Decoy Strike | This fixed instructor exercise demonstrates that focus with mixed contacts. |
| 20–35 s | Observe friendly T2; hold. Observe RF hostile T3; classify/respond correctly | Combine optical, RF and IFF evidence rather than treating every contact as hostile. |
| After friendly hold, before the later hostiles | Pause briefly; officer jams radar; verify APPLIED, then resume | This is the order used in technical rehearsals 2/3. Apply before the no-RF decision if narrating that it occurs under degradation. |
| 45–55 s | Designate/classify no-RF T4; intentionally choose RF jammer | This contact has no detected control link. We deliberately select the wrong response. |
| 55–70 s | End normally through the product's early-end control; await Server verified | Server reconstruction preserves the issued conditions and actions. Explain the visible 75-second scoring projection if ending early. |
| 70–85 s | Ghost explains the exact mistake; jump Time Machine to the action | The review shows available evidence, chosen response and modeled consequence. |
| 85–90 s | Prepare next adaptive drill | The outcome ledger updates the profile and informs a fresh Director decision. |

Actual single-operator technical runs took 62.656, 57.817 and 77.106 seconds; the second delivery should add about three seconds of explanation. These are agent-led browser rehearsals, not a human team rehearsal. Each used fresh local startup, ordinary verified completion, Ghost, replay, profile/next Director, scripted Q&A review and actual Tactical 2D recovery for a simulated rendering-failure cue. Issues are in qa-stage7/rehearsals.json. Keep Rapid ID paused for the judge.

In simulation time, the decoys appear at T+8 and no-RF strike at T+16. Make the deliberate RF-jammer choice around T+18–24, before it reaches the asset; wall-clock narration times are different.

The primary recording uses DEMO-01: its officer radar jam occurs AFTER the deliberate error, and narration explicitly says so. It does not claim radar caused that mistake. Ordinary result is 30/100. Early end projects two asset penalties to T+75; Ghost does not assert observed later impacts. The backup uses chronological REH-03 captures with early officer intervention. Both are genuine browser frame-capture sequences with held frames, not continuous high-frame-rate screen recordings. Primary narration is a locally generated eSpeak-NG synthetic voice.

## Primary video target: about 2 minutes 45 seconds

| Segment | Screen content | Narration focus |
|---|---|---|
| 0:00–0:12 | VYUHA and strongest final simulator view | Repeatable counter-drone recognition and response practice on local laptops. |
| 0:12–0:25 | Officer and trainee views | Local LAN operation. Physical multi-device LAN training was validated. Runtime assets and services are hosted locally; dedicated WAN-disconnected physical validation remains pending. |
| 0:25–0:40 | Actual profile/Director card | Four Beta estimates, seeded selection and heuristic difficulty. |
| 0:40–1:05 | Prepared exercise and instructor command | Mixed contacts, imperfect illustrative sensors and decoy/strike phases. |
| 1:05–1:20 | Deliberate no-RF jammer mistake | A concrete decision that the configured model treats as ineffective. |
| 1:20–1:40 | Verified AAR, Ghost and Time Machine | Reconstruct, explain and revisit the decision. |
| 1:40–1:52 | Updated profile and next Director card | The closed training loop. |
| 1:52–2:05 | Unit analytics from demo profiles | Pseudonymous training measures, not operational readiness. |
| 2:05–2:18 | Rapid ID/Studio/rural/recorded/bundle montage | Additional supported modes with recorded practice clearly labeled experimental. |
| 2:18–2:35 | Final evidence manifest/page | Exact release test counts, measured concurrency and 20-second laptop results. Label the learner experiment simulated and avoid a human efficacy claim. |
| 2:35–2:45 | Product close | Train. Explain. Adapt. Repeat. |

Capture only application content at fixed dimensions. Exclude browser address bars, personal paths, network addresses, credentials and private training history. Keep examples in a fresh disposable demo database. Retain the untouched production database and private HMAC key outside the submission archive.

## Release package checklist

Use the exact validated release commit. Include source, tests, dependency locks, startup scripts, current documentation and illustrative examples. Exclude .venv, node_modules, generated caches, local databases, personal QA records, HMAC keys, environment overrides and OS metadata. Exclude the obsolete prototype PPT from the final submission package. Extract and test startup in a fresh environment before declaring the archive ready.

Package PPTX plus the required six-slide PDF, primary video, minimally edited backup recording, final validation report, live script and Q&A. A second recording copy on another device/USB remains a physical acceptance item until the user confirms it.

Fallbacks: Tactical 2D for rendering failure, one-laptop local mode for LAN failure, verified backup recording for complete live-system failure.

## Delivery responsibility slots

Assign narrator, trainee operator, officer operator and Q&A lead within the team before presenting; names and college are intentionally omitted from the official deck. Technical rehearsal used one agent operator. The product and package do not require named roles. Portal upload and final deadline confirmation remain the team’s submission action.
