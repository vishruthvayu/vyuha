# Integration instructions — owner controlled

No integration merge or release tag was created in this workstream. The user assigned
both drill and surrounding-platform development to this developer after the original
drill developer stopped, while retaining integration/release ownership with main Codex.

## Inputs

- Common base: `db0ff23a67692d3db5dce07a031d17ea50a409b3`.
- Hardening: `feature/vyuha-final-hardening` at
  `8fba805e8a3355ac34ea329e232eb0e4ec9dcd20`.
- Drill runtime freeze: `5d40a24165dff5ace27c6131318da599ad828b0d`.
  Later evidence-only commits on the drill branch may be included; compare their
  runtime files with `validation/SOURCE-INVENTORY.json` before accepting them.
- Combined source and candidate reference: **not created**.

Fetch both branches, verify their advertised SHAs, and use a separate integration
worktree. Preserve any newer owner changes. Merge through normal Git history; never
reset or force-push either development branch or protected release refs.

## Shared files and contracts

Only two paths were changed by both tracks relative to the common base:

1. `.github/workflows/check.yml`: same CI ordering repair on both branches. Keep
   dependency install and production build **before** backend startup tests, followed
   by frontend/parity, lint, format and Docker. Missing production assets caused the
   repeated earlier notification failures.
2. `client/src/Ghost.tsx`: retain hardening's event filtering and incremental timeline
   rendering. Also retain drill's accessibility fix: timeline buttons use their full
   visible text as their native accessible name, and decorative chevrons are
   `aria-hidden`. Remove the overriding `aria-label` in hardening's extracted
   `TimelineEvents` button; its visible event category must remain in the name.
   Do not replace the hardening component with the older drill implementation.

The drill branch owns App/Scene/ContactRenderer/airframe geometry, rendering helpers,
GuidedDecision and premium training styles. The hardening branch changes independent
non-drill styles/components. Verify the combined CSS import order and inherited
preparation/utility components in the browser after merging.

`App.tsx` sends an optional opaque `request_id` with action intents to `sim.worker.ts`.
The worker echoes it on accepted/rejected messages; the App settles feedback only for
that request. Paused or ended requests reject explicitly. This metadata is outside
`Action` and never enters saved authoritative events or parity/scoring inputs. Merge
App and worker together. Keep action scope isolation and keyboard focus regressions.

No new npm dependency, remote font, runtime CDN, decoder or backend schema change.
All world resources and licences are local and included by offline precaching.

## Checks after merging

1. Install from the lockfiles. Build before backend tests. Run the **merged-source**
   backend, frontend/parity, lint, formatting, production build and Docker checks.
   Neither branch's individual test totals prove the merged source.
2. Repeat historical original/stored scorecards and the hardening security,
   Instructor/Crew isolation, transfer/restore, replay immutability, offline recovery,
   Recorded Practice and analytics checks. Private historical databases remain an
   owner dependency if absent from the checkout.
3. Repeat real browser workflows and axe at desktop/phone widths, specifically
   hardening AAR filters plus native timeline labels, accepted/rejected decisions,
   pause/end races, stale contact rows, keyboard step focus, observation loss,
   close-up crosshair clearance, and 2D fallback/3D recovery.
4. Run `tools/drill-rescue/bench.mjs` on the actual reference device. The Linux Intel
   measurements in this branch are not M1, Windows, Android or physical-phone proof.
5. Review day/night, EO/IR/thermal, rural/urban, close-up and live motion as one
   application. The remaining procedural architecture/terrain limitations in
   `REPORT.md` need a direct owner visual walkthrough before visual sign-off.
6. Only the integration owner should freeze a combined candidate, generate matching
   evidence and prepare an immutable RC. Stable release, physical LAN HTTPS,
   WAN-off and other unavailable platform gates remain pending until performed.
