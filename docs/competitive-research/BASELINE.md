# Source baseline and current implementation

## Git provenance

Inspected checkout: `work/finale/ultimate-experience/browser-vr-unified`, now on `main`.

| Item | Verified value |
|---|---|
| Repository | `vishruthvayu/vyuha-sih26247` |
| Merged main | `2d90137e8116075cd1e48eadab64cb306ea12278` |
| Merge parents | `654681611bf0028fa40f38e9f116d03c64ca3a8b`, `f5cf3e85314333dce7d6273771a9e139af2c49fa` |
| Main commit date | 2026-10-20 23:34:23 +05:30 |
| Unified-tree comparison | No differences between `f5cf3e8` and merged main |
| Recorded tested runtime | `ad430f742f7476feb464c1c53d08cfb3f95823ba` |
| Existing source-input policy/hash | `vyuha-source-inputs-v2` / `f87104f832e9cb9b03ad18ab3938a23a1a43f1bc51ba95385f540c684c36534a` |
| Research changes | Restricted to `docs/competitive-research/` |

The checkout was clean before research. Switching its completed integration branch to existing `main` and fast-forwarding preserved history. Other worktrees, existing user data and protected releases were not cleaned, reset or edited. The repository's owner checkout has pre-existing changes; these were left alone.

## What actually exists

Source links below refer to the inspected main tree. See [baseline-source.json](evidence/baseline-source.json) for hashes, last-change commits and selected definition anchors. References identify implementation, not a new claim that every feature was retested today.

| Capability | Actual implementation and evidence | Boundary / genuine remaining opportunity |
|---|---|---|
| Deterministic training | [server/engine.py](../../server/engine.py), frozen [v1.0.1](../../server/engine_v1_0_1.py), [v2](../../server/engine_v2.py), TS mirrors, 30 Hz worker | Preserve version dispatch; new simulation semantics require a new version and parity. |
| Sensors and uncertainty | [sensors_v2.py](../../server/sensors_v2.py), [sensor configuration](../../server/config/sensors-v2.json): seeded sampling, radar sweep/confirmation/coast/clutter, EO/IR resolution/attenuation, RF/IFF, static occlusion, sanitized observations | Illustrative models, not empirically calibrated. Fog/night exist; no general rain/dust/wind system or raw radar/acoustic processing chain. |
| Raid composition | [raid_v2.py](../../server/raid_v2.py), [RaidStudio.tsx](../../client/src/RaidStudio.tsx): constrained formation/motion families and authored metadata | Not a general multi-agent adaptive autonomy simulator. Add only trainable, bounded behavior diversity. |
| Response effects | [response_v2.py](../../server/response_v2.py): finite resources, delayed effects, jammer occupancy and collateral logic | Already implemented. New response types need explicit learning objectives and versioned abstractions. |
| Adaptation | [director.py](../../server/director.py), [director_v2.py](../../server/director_v2.py): Beta-skill history, deterministic observable policy, uncertainty/progress/retention-gap metadata, frozen preparation snapshot | No fitted causal efficacy or validated forgetting curve. Processed-session gap is not a measured elapsed-time retention model. |
| Fusion Assistant | [fusion.py](../../server/fusion.py): sanitized-evidence heuristic distribution, confidence/reliance/Brier review, bias exercise, reconstructed exposure receipts | Output is not empirically calibrated probability. Learned assistants must beat this baseline on held-out observable evidence. |
| Action provenance | [action-evidence.ts](../../client/src/action-evidence.ts), [App.tsx](../../client/src/App.tsx) bind advice/confidence to dispatched request/scope/action and reject unowned/mismatched/duplicate replies | Critical invariant for all future voice, AI, Crew and XR inputs. |
| AAR and decision tree | [Ghost.tsx](../../client/src/Ghost.tsx), [review_v2.py](../../server/review_v2.py), [review.py](../../server/review.py): reasons, timeline search/filter/incremental rendering, pinned evidence, notes and server verification | Improve causal relationships, reflection and cross-attempt explanations; do not propose replay or decision-tree AAR as absent. |
| What-If / reference | [counterfactual.py](../../server/counterfactual.py), [expert_run.py](../../server/expert_run.py): separate hypothetical result; completed-session evidence-only policy can abstain | Never overwrite originals or turn canonical AAR knowledge into a live answer. Not proof of an optimal expert. |
| Crew | [crew.py](../../server/crew.py), [crew_metrics.py](../../server/crew_metrics.py), [Crew.tsx](../../client/src/Crew.tsx): role permissions, expiring/revocable/rotatable capabilities, attributed actions, clock/checkpoints, reconnection/history | Shared outcomes do not update individual learning. Deeper communication rehearsal remains possible. |
| Instructor / White Cell | [Instructor.tsx](../../client/src/Instructor.tsx), server instructor routes: session-targeted commands, acknowledgments, scenarios, teaching notes, assignments | Existing command correctness is a foundation for authoring and after-action intervention analysis. |
| Evaluation | [evaluation.py](../../server/evaluation.py): consented pseudonymous pre/drills/post sequence, balanced non-identical tests and descriptive deltas | No randomized human learning or delayed retention/transfer result. |
| Recorded Practice | [recordings.py](../../server/recordings.py): bounded normalized observation JSON; unscored practice | No connected physical sensor driver. A file import is not operational data validation. |
| Transfer / recovery | [portable.py](../../server/portable.py) and portable modules: authenticated, validated, deduplicated transfer and reconstruction; backup/restore; queued actions and Fusion recovery | Shared-key HMAC is not donor identity/nonrepudiation. Offline installation is distinct from offline runtime. |
| Authentication | [auth.py](../../server/auth.py): PBKDF2 officer setup, revocable expiring bearer, protected routes; Crew role capabilities | Callsigns are not a secure examination identity system. No need to replace working officer auth to add roster identity. |
| Visual environment | [Environment.tsx](../../client/src/world/Environment.tsx), [terrain.ts](../../client/src/world/terrain.ts), [layout.ts](../../client/src/world/layout.ts), [Scene.tsx](../../client/src/Scene.tsx), [ContactRenderer.tsx](../../client/src/ContactRenderer.tsx): urban/rural local PBR assets, instancing, observed contacts, optics and thermal views | More scene variety and semantic/render consistency are worthwhile; this is not a blank 3D canvas. |
| Browser / VR unity | [VRCockpit.tsx](../../client/src/VRCockpit.tsx), [VRWorld.tsx](../../client/src/VRWorld.tsx), [vr.ts](../../client/src/vr.ts): same worker/actions, observed world, two-eye rendering, both rays, explicit choices, confirmation, exit/re-entry/context-loss handling | Emulator acceptance is not headset comfort/FPS or trusted separate-device HTTPS acceptance. |
| Onboarding / routes | [CapabilityTour.tsx](../../client/src/CapabilityTour.tsx), [GuidedDecision.tsx](../../client/src/GuidedDecision.tsx), [RapidID.tsx](../../client/src/RapidID.tsx), [routes.ts](../../client/src/routes.ts) | Guided drill and rapid recognition exist. A coherent competency curriculum and broad accessible/localized instruction do not yet follow merely from those screens. |

## Test evidence: existing, not rerun for research

[Final integration report](../vr-unification/FINAL-INTEGRATION-REPORT.md), [source-input manifest](../vr-unification/evidence/source-inputs.json) and [evidence manifest](../vr-unification/EVIDENCE-MANIFEST.json) record **712 backend / 367 frontend** tests, parity, original 18 and stored 22 historical scorecards, scoped browser/IWER, recovery, Transfer/Restore, protected-route negatives, build, ARM64 Docker and clean-clone receipts for the runtime named above. These are historical exact-source records, not results of executing this research task or evidence of learning efficacy.

## Performance finding that should shape the next phase

[Measured M1 evidence](../vr-unification/PERFORMANCE.md): Apple M1 MacBook Air, 8 GB, fixed Medium; two 180-second 200-*initial*-contact windows both show 60 FPS median, but minimum per-second samples 4 and 2 FPS. The roster can decline. A separate **retained-200** actual training startup/selection window has p95 33.3 ms, p99 115.6 ms and maximum 1099.9 ms. Warm retained-200 IR has p95 17.7 ms, p99 34.3 ms and maximum 99.5 ms. EO was paused with a different viewport and cannot be treated as a matched win. Emulated XR steady p95 18.9 ms is not headset FPS.

Inference: warm rendering and startup need separate budgets. Low worker tick cost does not establish the cause of long rendering gaps; profile CPU, shader/resource work, layout, allocation and GPU timing before choosing a fix.

## Documentation drift found, not silently corrected

- README's current-development paragraph still describes a parallel UI branch as in progress, despite the merged tree.
- The feature manifest retains historical release and WAN-validation fields beside a newer unified-runtime section. Readers can mistake the old scope for the current candidate.
- Architecture/audit documents describe earlier checkpoints; the newest implementation and evidence must take precedence.

R02 proposes one versioned capability/evidence registry generating these views. This report deliberately leaves unrelated existing documentation unchanged because this phase is research only.

## Physical evidence boundaries

Historical Mac/Android LAN training and native Linux acceptance belong to their recorded source revisions. The owner previously reported a WAN-off test, with only “yesterday” supplied for timing; that is not a complete source/device/workflow receipt for current main. Do not convert it into final-source certification or erase it as if no report existed. Final-candidate Windows/Linux/Android, physical headset, comfort/FPS, separate-device trusted HTTPS and LAN/WAN acceptance must be recorded against the eventual candidate.
