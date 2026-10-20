# Browser acceptance and capture provenance

Runtime `ad430f742f7476feb464c1c53d08cfb3f95823ba`, measured source hash `f87104f832e9cb9b03ad18ab3938a23a1a43f1bc51ba95385f540c684c36534a`. All data is synthetic local QA data. CUA operates visible controls in the Codex in-app Chromium browser. No direct React state injection, hidden-truth reads or emulator dependency in production.

| Workflow | Current-source evidence and result |
|---|---|
| Browser → desktop VR cockpit → AAR | Authored90s raid, session `1d823417-5fbb-4da1-adde-ecd4b824faed`: six accepted actions, three browser Fusion receipts, no association for VR actions3–5. Rows reconstructed and preserved by final HTTPS transfer; [provenance](evidence/portable-fixture-provenance.json). Preview at49s used for responsive checks below. |
| Actual server outage | Session `a203d2ee-23db-49cb-87ad-ea5d1c4ed7fc`: server child confirmed alive then killed, exit−9. Six ordinary-browser actions/receipts queued, synced after restart. [Queued capture](evidence/browser/owner-outage-queued.png), [Server verified/Ghost](evidence/browser/owner-outage-verified.txt). Observed interval30.60s distinguished from90s scoring horizon. |
| What-If and reference | Same final session: RF branch and evidence-only policy11 generated decisions. Original0/100 retained. [UI](evidence/browser/owner-replay-immutable.txt), [all original table hashes unchanged](evidence/replay-immutability.json). |
| Two-eye/controller XR | IWER2.6.0 test harness, session `e30a911c-7a2c-467e-8fae-9c3f58787638`: views2, both tracked-pointer controllers; left selection/right designation, explicit type-only classification disabled, identity then classification accepted, left Hold/right Confirm accepted once. Paging and head movement. [Controls](evidence/browser/owner-xr-controls.txt), [stereo capture](evidence/browser/owner-xr-stereo-head-tracking.png). Training choices are deliberately illustrative, not evidence of correct operational identification. |
| Instructor | Radar degradation/restore both APPLIED atT+42.93s, orders3/4 on the selected XR session. [DOM](evidence/browser/owner-instructor-applied.txt), [image](evidence/browser/owner-instructor-applied.png). Officer login required. |
| Graphics loss / ordinary browser / re-entry | Deliberate loss on paused200-contact XR session146s. Paused notice, disabled actions, browser renderer restored, accepted classification/phase preserved on cockpit re-entry; explicit Resume required. [Loss](evidence/browser/owner-xr-context-loss.txt), [browser recovery](evidence/browser/owner-xr-browser-recovery.txt), [re-entry](evidence/browser/owner-xr-reentry.txt). IWER itself logs its null `onDeviceFrame` exception only after deliberate context loss; [raw status](evidence/browser/owner-xr-context-status.json). This narrow emulator limitation is retained, not hidden. |
| Crew persisted history / security | [Current UI](evidence/browser/owner-crew-history.txt): three attributed decisions, WATCH/spotter then RESPONSE/responder,8.13s designation→classification and0.27s classification→response; shared outcome, no individual credit. [HTTP recheck](evidence/crew-history-recheck.json): completed requests409, anonymous401, unchanged learning tables. Active role403 evidence was recorded earlier; final backend retests live-role contracts. |
| Analytics | [Authenticated current UI](evidence/browser/owner-analytics.txt), [image](evidence/browser/owner-analytics.png). Historical estimates/observed intervals, shared Crew excluded from individual learning. Earlier restart returned officer UI to sign-in; final security/HTTP inventory rechecks authorization. |

Additional final-source native training session `fa64a6ac-370b-4f94-98ce-3bf6df920bf3` retained 200 contacts across 180 logical seconds. IR tracking and an authenticated Set day/EO close-up were exercised; it naturally reached 5,400 ticks and Server verified. This is a rendering workload with no trainee decisions, not a tactical proficiency demonstration. [Session receipt](evidence/retained-browser-session.json), [verified capture](evidence/browser/owner-retained-200-server-verified.png), [timing scopes](PERFORMANCE.md).

## Actual viewport and keyboard checks

These captures were made on final source with the single shared preview session paused. Device scale1 and CSS viewport widths verified directly; this is browser emulation, not phone hardware acceptance.

| CSS viewport | Document width | Keyboard/native controls | axe4.14.0 |
|---|---|---|---|
|390×844 |390, no horizontal overflow |All12 native controls stay within viewport; Enter on Next contacts moves1/2→2/2 |0 violations,23 passes;20 contrast nodes require manual judgment |
|768×1024 |768, no horizontal overflow |Controls remain available; one canvas |0 violations,23 passes;21 contrast nodes incomplete |
|1440×900 |1440, no horizontal overflow |One canvas; controls intact |0 violations,23 passes;31 contrast nodes incomplete |

Receipts: [mobile layout](evidence/browser/owner-vr-mobile-layout.json), [mobile axe](evidence/browser/owner-vr-mobile-axe.json), [tablet layout](evidence/browser/owner-vr-tablet-layout.json), [tablet axe](evidence/browser/owner-vr-tablet-axe.json), [desktop layout](evidence/browser/owner-vr-desktop-layout.json), [desktop axe](evidence/browser/owner-vr-desktop-fixed-axe.json). [Actual mobile capture](evidence/browser/owner-vr-mobile.png). Automated checks do not certify full WCAG conformance, canvas text, headset legibility or comfort. Enabled native preview controls were also inspected for readable computed text; incomplete contrast judgments remain explicitly limited.

## Checkpoints kept separate

Older generic captures (`xr-*`, `context-*`, `fusion-*`, `crew-role-history*`, `analytics*`) and original `crew-live.json` describe the7d48d80 checkpoint. `sealed-*` captures describe thed737cc6 checkpoint. These preceded the final unowned-worker-receipt guard and are supplementary workflow history. They are not final-source capture proof. Final owner-prefixed captures and final test/HTTP/build manifests provide current-source evidence. Pre-fix failure logs are reproduction evidence, not failed final gates.

Physical headset comfort/FPS, controller ergonomics, final-candidate Windows/Linux/Android execution, separate-device trusted HTTPS and physical LAN/WAN-off remain PENDING. No RC or stable release is approved.
