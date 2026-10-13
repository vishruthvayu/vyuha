# Ultimate experience — engineering review and closure

Review date: 13 October 2026. Reviewed the full supplied RC2 89/100 roadmap, all 93 original matrix records, startup/certificate scripts, current Director/review contracts, real-data/study interfaces and their provenance receipts. The external 89/100 describes RC2; it is not a new score for this working candidate. This scoped engineering review is not native Windows/Linux/phone acceptance or complete visual QA.

## Confirmed certificate defect and implemented closure

| Item | Before | Improvement | Source and proof | Status |
|---|---|---|---|---|
| PowerShell OpenSSL resolution | `shutil.which('openssl')` failed when Git for Windows existed but its `usr/bin` was not on PATH | Explicit `--openssl` takes precedence; then PATH; then Git-discovered custom/portable roots and configured Program Files/x86/per-user installation roots | `scripts/make-cert.py`; `server/tests/test_certificate_discovery.py`: PATH/override, cmd/bin/mingw64 layouts, four environment roots, paths with spaces and missing/directory rejection | **IMPLEMENTED / targeted software PASS**; native Windows PENDING |
| Unsafe fallback after an explicit tool selection | Future automatic search could accidentally ignore an invalid override | Invalid explicit overrides fail without searching another binary or creating output files | CLI rejection test; no shell invocation, registry access, downloads, recursive disk scan or trust writes | **IMPLEMENTED / PASS** |
| CA identity confirmation | Generator said to trust `ca.crt` without printing its fingerprint | Print actual generated CA SHA-256 fingerprint; instruct comparison on receiving device | Actual OpenSSL generation + independent `x509 -sha256 -fingerprint` test | **IMPLEMENTED / PASS**; receiving-device comparison not performed |
| Manual trust discoverability | Generic instruction provided no Windows/Android entry points | Print Current User certificate-manager import path and Android CA-certificate path; share only public CA; keep keys private; exact SAN URL and no warning bypass | Generator guidance assertions plus reviewed official sources below | **IMPLEMENTED / PASS** guidance; real device trust PENDING |
| Existing cryptographic/output invariants | CA/SAN creation, expiry, POSIX private modes and overwrite refusal | Retained existing behavior; no key overwrite, no automatic trust-store installation | Original `test_local_cert.py` unchanged and exercised against modified generator | **PASS**, no historical engine changes |

Targeted run on this workstation against the isolated engineering overlay: **15 passed / zero failed in 1.39s**, comprising the **two unchanged existing certificate tests and thirteen new discovery/guidance tests**. Earlier new-only run: 13 passed in 0.70s. These are focused counts, not additive to a future complete backend suite. Integration and final combined regression are root release gates; no native Windows result is inferred from emulated lookup layouts.

Primary source review: [Git for Windows wrapper layout](https://gitforwindows.org/git-wrapper.html) describes `cmd/git.exe`, `bin/bash.exe` and installation roots; [Google Android certificate instructions](https://support.google.com/pixelphone/answer/2844832) describe manual credential installation and note device/version differences; [Microsoft certutil documentation](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/certutil) describes user/store certificate management. The generator does **not** run a trust-import command. Administrators must approve and verify manual local CA trust.

## Focused native Windows retest

1. Use the actual new frozen candidate on the Windows officer. Record commit, Windows version, Python, Git and browser. Do not reuse a Unix virtual environment.
2. In PowerShell where `Get-Command openssl` fails but approved Git for Windows is installed, run `.venv\Scripts\python.exe scripts/make-cert.py --ip <actual-officer-LAN-IP> --out data/certs-acceptance`. Expected: print the discovered executable and fingerprint; write a new CA/server certificate. For an approved custom installation use `--openssl "C:\approved path\openssl.exe"`.
3. Run with an intentionally nonexistent explicit `--openssl` and a new output path. Expected: actionable failure, no keys/output created; no silent fallback to PATH/Git.
4. Repeat the successful output path. Expected: refusal with original key/certificate bytes unchanged. Run local OpenSSL SAN verification for the intended IP and reject a wrong IP.
5. Restrict certificate-directory ACL to officer/admins. Compare the CA fingerprint before explicitly importing only `ca.crt` on approved devices. Set `VYUHA_SSL_CERTFILE` and `VYUHA_SSL_KEYFILE`, launch native Unit Mode and open the exact HTTPS SAN URL without a warning bypass.
6. Check browser secure context and cached reload using the separate physical runbook. A generated certificate, a running TLS process or an emulated viewport is not a passed browser/phone trust test.

## All original audit dispositions retained

RC2 matrix inventory: **62 PASS / 30 PARTIAL / 1 N/A**, all 93 records retained. This workstream does not promote external scientific, native or media limitations just because a software fix passed. The integrated closure matrix must distinguish the following:

| Remaining group | Relevant IDs | Engineering interpretation and next actual evidence |
|---|---|---|
| New device/native/network acceptance | SC14, SC19, SC23, P1-03, P2-03, CH12, CH15, X08, X09, X13, X31 | Native RC2/new-candidate Linux, Windows, phone, CA trust, multi-device LAN/WAN and platform restore are actual external test gates; do not demand inaccessible hardware as a fabricated software defect or mark pending evidence passed |
| Scientific model/difficulty/human evidence | SC16, SC17, CH08, F05, F07, X24, X26 | No measured radar/RF/RGB/thermal dataset or human study supplied; preserve valid synthetic interfaces and source separation; no fitted likelihood, calibrated difficulty or learning-benefit claim |
| Security scope beyond trusted LAN | X07 | Officer routes are protected; callsign/UUID trainee identity is not an adversarial secure-exam account boundary. Preserve this limitation; not a reason to silently add new authentication/history semantics during styling |
| UI/accessibility/UX and product first impression | SC22, X11 | Modern default, PS-first board, cohesive all-route redesign, text cleanup, keyboard/touch/reduced-motion, contrast and responsive QA are actionable software work. Actual screenshots and interactions are required before closure; physical browser breadth remains separate |
| Performance and endurance | X12, X29, X30 | Bundle/startup improvements need measured before/after; callback FPS and logical simulation fidelity are separate. More contacts/assets do not certify GPU, memory or endurance. Root performance receipts must retain device and scope |
| Independent release acceptance | X20 | Fresh integrated critique, combined regression, parity, 18/22 unchanged histories, security, restore, reproducible clean clone and immutable pins required; no automatic 100 or stable label |
| Competition-media provenance | P2-01, X02, X17, X19 | PPT/video/narration/submission work is expressly outside this software mission. Clear in-app limitations and README are allowed and necessary; do not convert them into media acceptance |
| Optional new mode | X27 | Red-side/sensor-placement planning is evaluated separately; not an invented official PS gate |

The 30 retained PARTIAL IDs are SC14, SC16, SC17, SC19, SC22, SC23, P1-03, P2-01, P2-03, CH08, CH12, CH15, F05, F07, X02, X07, X08, X09, X11, X12, X13, X17, X19, X20, X24, X26, X27, X29, X30 and X31. Optional enhancements and software fixes do not erase these record identities.

## Independent actionable critique for the integrated implementation

These criticisms remain acceptance checks until the root's actual browser screenshots/workflows are reviewed:

- A global UI reskin must not leave authoring, Rapid ID, recorded practice, benchmark, transfer, authentication and error/empty states with a second visual system. Verify each route, including a denied officer view and recoverable network error.
- Moving scientific caveats to a footer is useful only if local score/reference/probability labels still distinguish measured outcomes, hypothetical projection and heuristic advice. A styled percentage must not become an empirical readiness claim.
- A PS-first compliance board should lead with the requirements and direct proof; the Engineering view must still expose real pending tests and immutable release/source context. Do not hide the 30 partial records.
- A visual decision tree must retain unassessable/early-end states, final-contact node semantics and score projection scope. Repeated decisions must not be drawn as individually additive points. Seeking should use recorded logical ticks, not wall time.
- Lazy 3D loading must preserve the worker's current observations, graceful 2D fallback and user errors. A pretty loading panel alone is not a measured startup improvement. Compare actual initial network bytes and time on the same environment.
- Role panels must preserve current observation prerequisites, persistent 422 feedback, revoked/expired capabilities and leave/rejoin stale-response guards. CSS changes must not reactivate misleading actions or lose keyboard focus.
- Mobile emulation is useful software evidence, not physical Android acceptance. Check eight requested widths, meaningful input reachability and focus order; include real route/table/modal rendering rather than one training screenshot.

No weighted Ultimate score is awarded here. Final design/engineering review must inspect actual integrated results and report unresolved concrete defects, not infer completion from source edits or test count alone.
