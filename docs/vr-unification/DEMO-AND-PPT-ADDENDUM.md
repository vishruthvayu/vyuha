# Optional VR segment — submission truth

The cinematic team should continue recording the protected browser branch `integration/vyuha-combined-acceptance` at `259c50acdc5373a7971e9885b1232645edf23466` (validated runtime `126aab44a83fec76b782d5a6acbec9b8dc454bce`). The new isolated integration branch does not replace that source. No message or change has been sent to the demo team.

## Optional 10–15 second segment

Record the real desktop cockpit: open Training Ground, prepare a drill, open the optional VR observation cockpit, start, select a currently reported contact, designate, explicitly classify and arm/confirm Hold. Close the cockpit, show the same accepted action in the browser and the ordinary server-verified Ghost review. Use synthetic training data. Keep officer credentials out of captures.

Suggested caption: “Optional experimental WebXR observation cockpit. Shared training worker, observations, accepted decisions and Ghost AAR.” Add “Desktop preview” to desktop footage. Label IWER footage “WebXR software emulation — not a physical headset.” Do not imply physical wearing, comfort, controller ergonomics, Quest frame rate or headset certification.

No physical headset footage is available from this integration. No new entire demo, PPT or marketing redesign is required. A short optional addendum is sufficient; it must not delay the browser demo.

## Allowed scope and release gates

Browser training remains primary. VR is an experimental modality; use the final integration report for source-current software acceptance and exact SHA. Until that report seals acceptance, describe integration checks as in progress. Physical headset performance and comfort remain pending. Never label software emulation a Quest performance result, a field trial, an efficacy study or a hardware certification.

The historical VR branch's 139/72 test totals and 11 browser checks are historical evidence only. The accepted browser's earlier 200-contact 60 FPS result is a browser result, not headset evidence. The unification report will distinguish new desktop/XR measurements and limitations.

## Reproducible capture

Use the unified branch in its isolated worktree, complete normal officer setup and build, then start Unit Mode with disposable recording data or an owner-approved training session. Headsets require trusted HTTPS for the exact reachable LAN hostname/IP. `scripts/start-vr.sh` validates certificate/key paths and delegates current Unit Mode startup; it does not install trust or bypass browser warnings. Never share private keys.

For software emulation only, run `scripts/serve-vr-qa.py` against a local production server on port 8096 and open its loopback-only port 8097. Operate visible IWER controls. This harness is not part of production assets and must not be exposed on the unit LAN. Capture without its controls only if the permanent caption still identifies emulation.

Final source/run commands, real captures and acceptance receipts: `FINAL-INTEGRATION-REPORT.md` in this folder. Do not merge back, create an RC or stable tag without owner approval.

## Sealed software addendum — 20 October 2026

Validated runtime: `ad430f742f7476feb464c1c53d08cfb3f95823ba`. The final integration report and evidence manifest identify current captures separately from earlier checkpoints. This optional addendum is ready for the existing presentation/demo; it does not replace the protected browser recording.

Suggested slide text:

> **One training system, optional experimental WebXR**
>
> Observed-only 3D, explicit trainee choices and controller-ray interaction. Browser and cockpit share accepted decisions, session recovery and server-verified Ghost AAR. Software emulator checks passed; physical headset comfort, FPS and trusted device HTTPS remain pending.

Suggested three-shot sequence, using current synthetic QA evidence:

1. `evidence/browser/owner-xr-stereo-head-tracking.png` — “WebXR software emulation · two-eye/controller checks · not headset footage”.
2. `evidence/browser/owner-instructor-applied.png` — “Instructor commands applied to the same server session”.
3. `evidence/browser/owner-xr-server-verified.png` — “Shared accepted action history · server-verified AAR”.

For a clean cinematic capture, repeat that sequence with the test controls hidden and retain the emulation caption. Never present the synthetic0/100 QA result as a successful tactical demonstration or a learning-efficacy result. Physical wearing/comfort remains unverified. The native desktop preview is also available without IWER.
