# Frozen training sites — connected flagship development acceptance

Runtime source: **13df5180bb82be723c923ed205c9babe93aa9d8a** on `feature/vyuha-next-generation`. Source input hash: `7bfd8932ff38a7262169f6ee6a14c59dd70abefd05f9a9a7e93ef9ac9fc8d473` (`vyuha-source-inputs-v2`). This follows the sealed v0.6 implementation `0ac34fe` and evidence commit `c8572dd`. Targeted development acceptance, not full release acceptance; no RC or tag.

## What changed in the actual application

**A public spatial definition now drives both the world and the information problem.** Two original synthetic campuses replace the fixed facility for explicitly admitted mission-v3 exercises: Freight corridor and Open transfer campus. Each frozen site supplies named building footprints, roads/aprons and landmarks. Those exact structure footprints generate authoritative terrain boxes. Original metric building facades, loading bays, doors, glazing and roof details stay inside their boxes; decorative containers, lights, trees, vehicles and bounded fencing remain outside the sensor geometry. Browser, review and XR scenery share the layout code. This does not admit the new acquisition action contract into XR.

The Studio selects a site, compiles actual observations and an author-only geometric LOS trace, seeks loss/reacquisition intervals, and publishes the exact inspected content hash. Changing inputs invalidates the preview. A public site plan and contact-free survey orient the trainee without showing contacts, routes or future reports. Survey framing now fits the larger authored campus; starting returns directly to the sensor origin. Live training retains observed-only geometry and explicit requests, publication, expiry and Defer. Ghost reconstructs the frozen site and exact evidence boundaries. Academy and Ghost follow-up retain site identity while changing conditions/seed, with practice and independent evidence kept separate.

Two reproduced UI defects were corrected: competing CSS anchors stretched optics controls over the scene (now about 106px high in the measured desktop state), and the pause message lacked contrast over the bright apron (now a compact dark badge). A new mobile acceptance found that a tentative radar alias could offer Defer before the engine admitted it. UI gating now uses the public first-confirmed timestamp, retains eligibility after report loss, and explains the tentative state. The engine correctly rejected the premature attempt; its empty action log is retained. No engine/action/scoring semantics were relaxed.

## Contracts and boundaries

- New: `observation-mission-v3`, `training-site-v1`, bounded versioned site compiler and actual geometric author rehearsal.
- Reused unchanged: `vyuha-0.6.0` sensor/action timing and authoritative tactical scoring; `evidence-assessment-v2` criteria, with a new site-aware admission wrapper.
- Frozen mission-v1/v2 compilers and fixtures are unchanged. Old URLs retain their original admission; explicit version 3 and a valid site are required for the new presets. Incomplete site/version URLs fail closed.
- The authoritative server recompiles the whole frozen definition, validates content hashes and rejects tampered sites, footprints, paths, metadata and future contracts. Browser validation is bounded structural validation, not an anti-cheat or canonical-truth secrecy claim.
- No mastery is awarded for information requests, waiting, Defer, correct outcomes alone or a site visit. Findings describe public evidence support at individual decision boundaries, not private reasoning, proficiency or learning gains.

## Focused validation retained

| Check | Result / receipt |
|---|---|
| Site/compiler/auth/rehearsal/completion/transfer/profile compatibility | **22 distinct backend cases passed** across the initial run and corrected follow-up. Initial stale query-name assertion retained. See backend receipt and raw logs. |
| Updated capability registry | **22 passed**; combined backend scope is 44 distinct focused cases, not the complete backend suite. |
| Entry, Studio, public briefing/survey, layout/budgets, actual browser/XR/review prop forwarding, Defer UI/review | **30 distinct client cases passed** across affected runs. Final total including the one parity test is **31**; overlapping subset reruns are not added again. |
| Actual Python/TypeScript site replay | **109 checkpoints passed** across both campuses, including geometric transitions, sample/release/expiry and Defer. No sensor or score engine code changed in this milestone. |
| TypeScript / changed-file ESLint / formatting / diff check | PASS. Production build PASS, **81 locally cached assets**. |
| Old stored scorecards | Previous v0.6 receipt preserves 18 baseline and all 25 stored cards on private copies. Those source files/dispatch paths are unchanged by the new site branch; this milestone reran affected frozen v1/v2 contracts, not the whole stored-history walk again. |

The first render-budget test rejected an overlong decorative fence: 132,692 facility triangles / 17,515,344 attribute bytes. The fence was reduced, keeping the original budget. Accepted freight facility: 42,212 triangles / 5,571,984 bytes; open-campus facility: 42,304 / 5,584,128. Each has ten facility material batches before existing environment assembly. Authoritative building geometry adds 2,172 / 1,692 triangles respectively. These are static CPU buffer counts, not total renderer/GPU memory. Failed logs remain available. The existing world-prop forwarding test harness also needed a proper survey-control stub because it mocks Canvas; its original sensor assertions were retained and a site-forwarding case added.

## Actual browser journeys

1. **Officer Studio → freight Training → Ghost → Academy:** published `raid_057c3c74b5b2aab751c16e2a`, session `4ee201b0-2225-4ba9-b8b9-03d829314f15`. Three live requests at ticks 418 EO, 1372 IR and 2299 EO. First EO supplied detection-only evidence; IR during the geometric obstruction returned no modeled detection. Full 90s session completed and server verified at 0/100. Exact reports, frozen site and site-preserving next-practice link retained. This is not proof of a successful human policy.
2. **Academy → independent Open campus → Defer → Ghost:** actual 391×843 CSS viewport, expanded public plan had zero horizontal overflow and the 50px Start button remained within the viewport. Tentative attempt rejected with no recorded action. After confirmation, keyboard Defer / affiliation unresolved accepted at tick 1063, order 0, session `38900d82-61c7-4d6a-83de-d02ef0f81f22`. Server verified, 0/100, no classification, no mastery; guidance locked off. This was browser emulation, not physical Android testing.
3. **Exact production outage/recovery:** session `52c7b3aa-a4a0-4f24-a593-d954a6a4fd7f`, clean build source 13df518. Stopped isolated loopback server; health requests failed. Worker accepted Defer at tick 459 while disconnected; exercise ended at 471. Reloaded cached production app without server, opened saved unverified record, restarted server and observed automatic authoritative synchronization. One Defer preserved, site validation passed, score 0/100, legacy individual profile sessions 0. See production recovery receipt, actual API JSON, offline/recovered DOM and screenshots. This is process-outage/local-cache evidence, not a physical WAN-off test.

The user database and protected release references were not modified. QA databases/credentials stay outside Git. Saved original comparison draft was resumed and completed, rather than discarded.

## Performance and independent review

See [PERFORMANCE.md](PERFORMANCE.md), raw source-pinned exports and [SCREENSHOTS.md](SCREENSHOTS.md). The common fixed-Medium 30s window measured 16.7ms median / 17.7ms p95 in both scenes; candidate p99 18.0ms versus baseline 32.4ms. Geometry/UI/radar/tick differences and background activity preclude causal speedup claims. No sustained 200-contact, GPU, headset or physical-device qualification follows from this measurement.

Independent source review found no blocking truth/camera/geometry issue for the two canonical presets; it identified incomplete URL admission, now fixed. Independent screenshot review identified pause contrast, now fixed, and explicitly described the campus as still visually sparse. No numerical audit rescore is invented. Structural axe evidence is inherited from the affected briefing/Defer tests; no physical screen-reader or 100%-zoom certification is claimed.

## Remaining work

This is a major connected spatial/simulation slice, not completion of any entire flagship. Richer art direction, authored environmental density, aircraft/material/atmosphere fidelity, broader workspace composition, instructor-delivered site episodes, deeper evidence-aware progression and real XR interaction remain open. Site selection is bounded presets; arbitrary topology authoring/import is not implemented. Author trace means geometric LOS, not assured observation, human attention or calibrated sensing. Crew/XR acquisition remains gated; autonomous acquisition reference policy remains unadmitted. Native Windows/Linux/Android/headset, separate-device trusted HTTPS and physical WAN-off acceptance for this exact source remain pending. Full backend/frontend/security/parity/historical/browser/performance release regression remains reserved for a frozen candidate. No stable release, RC, PPT or video generated.
