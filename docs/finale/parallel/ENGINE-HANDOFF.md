# Engineering handoff — shared baseline

```text
SHARED_BASELINE_SHA = `7e3184b15ba38e8242efc6f80c446c9d861b032e`
SHARED_BASELINE_BRANCH = `feature/vyuha-ultimate-experience`
FRIEND_BRANCH = `feature/vyuha-premium-ui`
ENGINE_BRANCH = `feature/vyuha-engine-closure`
STATUS = safe for parallel development
```

GitHub's shared branch was read back and equals the full shared SHA. All intended implementation was included, with no discarded or excluded WIP. The worktree was clean after the baseline commit. Protected release refs were read back unchanged. Frontend branch was absent on the remote at this checkpoint; its owner creates it from the exact shared SHA.

Frontend startup:

```sh
git fetch origin
git switch -c feature/vyuha-premium-ui 7e3184b15ba38e8242efc6f80c446c9d861b032e
```

Do not branch from a later moving engineering tip. Follow [FRONTEND-ENGINE-CONTRACT.md](FRONTEND-ENGINE-CONTRACT.md). The scene already has its own module: embed the unchanged LazyScene export and props; no simultaneous App.tsx edits are required. UI owns the surrounding application. Engine owns Scene, procedural assets, sensor filtering, rendering/camera internals, simulation, persistence, security, engine tests and release tooling. Codex alone edits this coordination contract; proposed amendments are reviewed before use.

## Verified shared implementation

- Runtime source policy-v2 SHA256: `931ab608c99bb95b011635136709a1d585251a67e2ddc025d57b77cec4bf23c9`.
- 690 backend tests in 425.12s; 249 frontend tests in 59520.156916ms; zero failures. All included parity groups, lint, formatting and production build passed (28 local assets / cache 46d9d7ac0ec7).
- Immediate shared-baseline smoke: 11 AAR-history/compliance tests passed in 3.15s; known Starlette/httpx deprecation plus sandbox cache-write warning, neither a test failure.
- Original 18 / stored 22 historical scorecards exact; 25 current ordinary AARs readable; Rapid ID remains separate; Crew cannot alter individual learning profiles.
- Actual loopback HTTPS/security and populated Transfer/dedup/tamper/forward/restore receipts are pinned to the same runtime hash. Scope is software, not physical trust.
- Observed-duration history and Recorded asynchronous ownership fixes are implemented and tested. Browser import/unscored save/error, instructor commands, outage decisions/Fusion and immutable What-If/reference workflows have scoped evidence.

These are baseline results, not final results for future renderer or frontend edits. Independent reviews identify exact tested scope; no whole-product numerical score is invented.

## Engineering work commencing

1. Capture current renderer/FPS baseline before changing Scene internals.
2. Improve original locally generated geometry, terrain/lighting, camera and sensor presentation while preserving visibility and immutable scores.
3. Maintain the existing public renderer props; proposed optional additions are documented before integration.
4. Complete bounded engine/browser/recovery/performance checks and a matching clean clone.
5. Refresh the 209-row engineering dispositions and release evidence against the final merged source.

No new renderer implementation exists at this handoff checkpoint. Current engine branch starts at the exact shared base. The latest pushed engine commit is discoverable as `git ls-remote origin refs/heads/feature/vyuha-engine-closure`; each later milestone receipt records its predecessor rather than claiming a self-referential commit hash.

## Open integration and release gates

Frontend developer's reviewed branch SHA is required before integration. Do not repeatedly merge unfinished changes. When both branches are ready, create `integration/vyuha-ultimate-finale`, merge normally and rerun complete acceptance after the last edit. G04–G07 remain open for broader browser/rendered, performance, clean-clone, final review and exact source/evidence/remote sealing. Optional advanced-model deferrals remain explicit; calibration and human efficacy are unproven.

Exact-candidate Windows, Linux, Android, separate-device LAN HTTPS/trust/cached reload and physical WAN-off remain pending. No new RC or stable tag was created; preserve all prior tags. No PPT, demo, Canva or submission media work.

## Verified renderer milestone (2026-10-15)

Engine source hash `1f476588e75f051357c0b04e3fe95e390e64026fbdfb069f79ce631f5b675fa4` passed **690 backend /268 frontend**, zero failures, all included parity, lint, formatting and build28/cache`d5bc57078750`. [Engine implementation](engine-closure/IMPLEMENTATION.md) and [regression receipt](engine-closure/REGRESSION.json) identify changed modules and exact evidence. New procedural instancing, locally generated surfaces/sky, observation-constrained smoothing, reticle/camera options, bounded diagnostics and radar uncertainty/failure guards are implemented. This supersedes the earlier statement that renderer work had not begun.

The outer UI remains frontend-owned and unmodified on this branch. Optional zoom/reducedMotion/metrics props are additive and documented; the frontend developer may choose suitable controls. UI integration still requires their ready exact SHA, review and complete merged-source verification. Clone/performance follow-up will be recorded against the pushed milestone. No release or protected tag changes.
