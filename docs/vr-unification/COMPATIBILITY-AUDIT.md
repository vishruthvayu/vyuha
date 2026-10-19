# Browser / VR forward-port compatibility audit

Audited before runtime integration, 19 October 2026. Browser baseline: `259c50acdc5373a7971e9885b1232645edf23466` (accepted runtime `126aab44a83fec76b782d5a6acbec9b8dc454bce`). Historical VR provenance: `ee46f0de21c81a6d2cd20e5fb6a644d3c08c282c`. Remote divergence: 99 browser commits / one VR commit. Isolated branch: `integration/vyuha-browser-vr-unified`. No historical full-tree merge or replacement of modern App/Scene is appropriate.

## Contracts and required gates

| Old component | Current counterpart | Compatibility / risk | Required adaptation | Regression / final acceptance |
|---|---|---|---|---|
| vrContacts: active + historical detected | observed-contacts.ts / sensors-v2.ts | INCOMPATIBLE: stale detection and true position leakage | Current reported position; modern observations fail closed; no raw track DTO to cockpit | Adversarial hidden truth, sensor outage, partial bearing, missing observation tests; browser receipt pending |
| vrEvidence true range, legacy flags | observations.ts / GuidedDecision.tsx | INCOMPATIBLE: raw geometry / truth | Only recorded sensor cues, reported range, trainee declarations; no raw messages/outcomes | Equal public evidence under different hidden identities, positions and RF truth |
| World import from old Scene | Environment, ContactRenderer, visibility, render-contacts | INCOMPATIBLE: old geometry, modern layered mono passes unsuitable for XR | Separate XR wrapper reusing current environment, observed poses and aircraft. No CameraRig or mono InspectionPass. Optical restriction and scenery obstruction retained | Stereo layers/occlusion tests, actual two-eye browser checks pending |
| Layer masks | Three WebXRManager left/right masks 1/2 | RISK: browser contact/occluder bits collide with eye bits | XR-only normalize world meshes to shared layer 0; retain normal depth and modern obstruction marker logic. Browser renderer unchanged | Both-eye contact presence, observed-only geometry, visibility and performance checks |
| vrAction | App.act / sim.worker correlated request_id and scope | INCOMPATIBLE: old transport predates receipts | All decisions through existing act callback; no second worker, simulation or scoring path | Accepted/rejected receipts; contact/session switches; duplicate suppression; full parity |
| Classification state | GuidedDecision internal choice | Old App contract absent | Cockpit owns explicit trainee choices, never defaults from hidden kind/identity | Declaration/choice reset, stale action tests |
| Response confirmation | response-v2 / public response resources | PARTIAL: old timeout only | Contact/session/phase/visibility/exit/resource checks, consume once, clear pending on suspension | Timeout, pause, hidden, exhausted ammo/channel/cooldown/restriction tests |
| XR lifecycle | same Three 0.180 / R3F 9 | Portable with hardening | Secure context, denial/error, pending entry disposal, no automatic resume; pause on graphics errors | Lifecycle unit tests and production-browser emulator scenarios |
| Controller raycast | both XR target-ray spaces | PARTIAL: old full-world raycast expensive | Dedicated cockpit surfaces only, hover and hit feedback; dispose listeners/resources | Left/right select, unsupported input warning, cleanup profiling |
| Canvas coexistence | modern browser Scene | RISK: duplicate heavy GPU workloads | Mutually exclusive browser and cockpit canvas; ordinary renderer restored on close | Canvas count, exit/re-entry, browser regression/performance |
| Fusion / draft / AAR | existing App accepted-action persistence | RISK: stale Fusion exposure when leaving browser panel | Clear unmounted exposure; preserve accepted action association and ordinary completion | Fusion recovery, verified AAR, transfer, immutability suites |
| start-vr.sh | start-unit.sh + preflight + TLS | Compatible wrapper only | Require readable cert/key; delegate current startup unchanged; never bypass browser trust | Shell/preflight tests, trusted HTTPS deployment instructions |
| IWER 2.6.0 historical test | test-only emulator harness | Historical evidence only | Dev-only pinned dependency; no production emulator; visible QA controls | Production browser two-eye/controller/lifecycle evidence; context-loss tool failures classified narrowly |
| feature manifest / guide | docs/feature-manifest.json / OperatorGuide | VR currently deferred | Mark experimental only when implemented; source-current evidence separate from historical docs | Final manifest/guide/evidence reconciliation |

## Protected state

The browser worktree and its 72 asset digests, protected tags and source inputs were recorded outside source in `vr-unification-20261019/protected-baseline.json`. Original owner work remains in its existing worktree; no private database is used for synthetic exercises. Fresh disposable QA storage will be used. Physical headset performance, comfort and device acceptance remain pending. No RC/stable tag or merge back is authorized.

## Acceptance status

This is the pre-integration audit, not a completion certificate. The final report must attach exact-source tests and browser receipts to every implemented gate. Historical browser and VR results do not validate the new runtime.

## Integration decisions discovered during implementation

- Range, resources, cooldown and ROE use the same `effectorStates` disabled gates and warnings as GuidedDecision. A warned attempt remains recordable; VR must not eliminate mistakes or penalties that the browser can record. The confirmation captures the public warning and cancels on a change. It rechecks time and warning at activation.
- A contact selection clears the confirmation latch synchronously, including two controller events before React commits. In-flight requests stay locked until their correlated receipt; older/different receipts do not unlock them.
- No pre-start contacts are passed to the cockpit. Fusion exposure and optional confidence are not attributed to VR decisions when those panels are not displayed; accepted receipts and existing browser Fusion history remain intact.
- The console uses a display overlay depth policy to remain readable when scenery crosses it. Aircraft still use observed-only projections, native stereo depth and the modern decorative-obstruction marker. No hidden contact is introduced by the overlay.
- IWER starts at its default 1.6 m local reference origin. The test harness maps controller heights to the product’s fixed 2 m sensor rig; this is harness calibration, not physical ergonomics evidence.
- The contact selector reuses browser list-only last-report memory. Stale rows are explicitly labelled and disabled; neither rendering, evidence nor action eligibility uses list memory. Four slots and paging bound the console and desktop layout.
- IWER QA runs on a separate loopback proxy origin. Its SSE forwarding preserves native command streaming; it never modifies production index/assets or ships the emulator in dist.
