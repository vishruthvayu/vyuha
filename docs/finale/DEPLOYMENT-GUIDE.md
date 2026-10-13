> Current RC2 remediation: tested code0c6aed1/source5720d526,617backend/172frontend/build27/cacheb2b7e099df64. NativeLinuxRC1 PASS_WITH_DEFECTS received; RC2Linux retest, nativeWindows andfreshseparate-phone acceptance pending. Historical sections below retain dated provenance. Current rules/commands: [rc2/RETEST.md](rc2/RETEST.md), [rc2/LINUX-FINDINGS.md](rc2/LINUX-FINDINGS.md), [evidence.json](evidence.json). No stable tag.

> Current software RC —13October2026: candidatev1.1.0-rc.1, implementation`e07a3845cc465f430b572ece7fbded687c1e3729`, source`02cf2c87a2fc59d459e5e696aa3141c83092a1e224c81663b78db1cef1ba982a`. NativeWindows/Linux andfreshFinale physicalLAN/WAN/phone/HTTPStrust remainPENDING_BY_USER. Historicalentries below aredated andnot currentacceptance. Use exactRCsource plus matchingdatabasebackup. Currentsoftware gates inFINAL-RELEASE-GATES.json.

# Finale candidate local deployment

This adds native PowerShell entry points and configurable Python parity-test execution. Initial officer setup needs internet to obtain dependencies. Unit runtime serves the application, production assets, API and SQLite history locally and does not install or download packages. An isolated trusted LAN remains required; instructor authentication does not make this a production accredited service.

## Windows officer preparation

Install Python 3.11+ and Node.js 20.19+ or 22.12+ during online preparation. From the repository root in PowerShell:

```powershell
powershell -File scripts/setup-officer.ps1
powershell -File scripts/start-local.ps1
```

Setup prompts for a local officer password if no credential exists. Use 12–256 characters; the password is entered through hidden prompts and is stored only as a salted PBKDF2 hash. It is never placed in a command argument or bundle. Existing credentials are preserved. Keep ignored `data/officer-auth.json` private; `VYUHA_AUTH_FILE` can choose an approved local path. Open `/instructor` after launch and sign in for instructor, authoring, analytics and transfer operations. Trainee entry does not grant officer privileges. Sessions expire after eight hours and can be explicitly signed out. Use trusted LAN HTTPS when carrying officer passwords or tokens over the network.

If organizational PowerShell policy prevents a downloaded script from running, review the script and follow the administrator's approved execution policy. The scripts never change system execution policy. A missing `.venv/Scripts/python.exe` is reported as missing setup; a Unix `.venv/bin/python` path is not assumed on Windows. A virtual environment copied from another OS must be recreated, not reused.

For trainee devices on the unit Wi-Fi/LAN:

```powershell
$env:VYUHA_PORT = '8000'
powershell -File scripts/start-unit.ps1
```

Choose the reported Wi-Fi/Ethernet address. Allow the chosen TCP port through the officer firewall only on the private LAN; do not expose it through router port forwarding. `-Build` rebuilds from already prepared dependencies; runtime launch without it requires no Node installation. Ctrl+C stops the server. The default data is under ignored `data/`; use `VYUHA_DB` for a different local writable database. Preserve this directory and shared key when moving an officer installation. Do not commit either.

## macOS and Linux

Use the existing Bash officer setup and runtime entry points:

```bash
bash scripts/start-local.sh
# Stop after initial preparation, provision a local officer credential:
.venv/bin/python scripts/setup-auth.py
# Then launch prepared Unit Mode:
bash scripts/start-unit.sh
```

Python and Node prerequisites are the same. Linux may need `python3-venv` installed through its approved package manager during online setup. No runtime package installation is attempted by Unit Mode. OS firewall rules and actual LAN device validation remain deployment-specific. Provision an officer credential only once; if it already exists the provisioning tool refuses to overwrite it. Password rotation requires stopping the server and explicitly replacing the credential through the approved officer procedure.

## Browser-trusted local HTTPS

Service workers require a secure browser context. Plain HTTP LAN supports live training and IndexedDB action recovery; it must not be described as supporting service-worker cached reload. Prepare OpenSSL on the officer during online setup and generate a dedicated local CA and server certificate with the officer's actual LAN address:

```powershell
.venv\Scripts\python.exe scripts/make-cert.py --ip 192.168.1.17
$env:VYUHA_SSL_CERTFILE = (Resolve-Path data/certs/server.crt).Path
$env:VYUHA_SSL_KEYFILE = (Resolve-Path data/certs/server.key).Path
powershell -File scripts/start-unit.ps1
```

On macOS/Linux use `.venv/bin/python` and `export VYUHA_SSL_CERTFILE=...`, `export VYUHA_SSL_KEYFILE=...` with absolute paths. `--dns officer.local` adds a configured hostname; the URL must match a certificate SAN. An IP change requires a new certificate in a new empty directory.

The tool writes under ignored `data/certs/` by default, refuses to overwrite existing files, and never installs trust. Manually trust **only `ca.crt`** on authorized trainee devices according to the browser/OS or administrator's certificate procedure, then verify a secure connection and secure-context status. Keep `ca.key` and `server.key` private on the officer; never send them to trainees or commit them. Root CA lifetime is 365 days; server certificate lifetime is 90 days. On Windows restrict the certificate directory ACL to the officer account and administrators. Do not bypass certificate errors, turn off TLS verification or automate trust installation.

## Cross-platform parity tests

Frontend parity tests resolve `.venv/Scripts/python.exe` on Windows and `.venv/bin/python` on macOS/Linux. A nonstandard environment can use:

```powershell
$env:VYUHA_TEST_PYTHON = 'C:\approved-python\python.exe'
cd client
npm.cmd test
```

The selected interpreter must have the locked server dependencies. Missing Python fails parity tests with an actionable message; it never skips them.

## Validation status

Certificate generation, SAN verification, private file modes and existing Python/TypeScript parity were exercised on macOS. PowerShell scripts were reviewed for native executable resolution, exit handling and setup/runtime separation. A PowerShell runtime is not installed on this Mac: **physical Windows launch, physical Linux launch and browser trust on separate devices remain pending**. These scripts are a portability foundation, not evidence that those deployment checks passed. Historical physical LAN/WAN statements are owned by the release evidence ledger, not inferred from these software checks.

## Evidence and WAN independence

Architectural claim: runtime assets and services are hosted locally with no required cloud service during training. Historical physical multi-device LAN training was validated using a Mac officer/server and Android/Chrome trainee, including instructor commands and session/AAR completion. Server-process outage and queued-event resynchronization evidence are separate checks.

The user subsequently reported the dedicated WAN-off test passed “yesterday”; the exact date, software revision, device pair and observed internet failure have not been captured in a reproducible receipt. This is a user-reported pass with incomplete metadata, not a new instrumented validation and not evidence for this changed Finale candidate. Do not claim physical Windows/Linux deployment, fully air-gap validation or field-tested offline operation from these checks. The final evidence ledger must retain provenance and scope for the reported WAN result.
