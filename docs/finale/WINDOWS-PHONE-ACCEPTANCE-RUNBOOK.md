# Windows officer / Android Chrome acceptance runbook

Prepared 12 October 2026. Starting checkpoint: `8dc8405`. This is an executable handoff, not a receipt. Native Windows/Linux and fresh Finale physical LAN, WAN and Android HTTPS checks remain **PENDING**. Before execution, the release coordinator must supply the full candidate commit and production asset/source hashes. Do not infer new candidate acceptance from historical results. Preserve `v1.0.1`.

## Online preparation and exact source pin

Install approved Git, Python 3.11+ with venv, Node.js 20.19+ or 22.12+, and OpenSSL for certificate generation; reopen PowerShell afterward. Review scripts and use the organization's approved execution policy. These steps must use a new test checkout and disposable data, preserving existing user records.

```powershell
git clone --branch feature/vyuha-finale-edition https://github.com/vishruthvayu/vyuha-sih26247.git vyuha-finale-test
Set-Location vyuha-finale-test
git status --short
git rev-parse HEAD
$CandidateCommit = '<FULL_CANDIDATE_SHA>'
if ($CandidateCommit -eq '<FULL_CANDIDATE_SHA>') { throw 'Supply the full accepted candidate SHA.' }
git switch --detach $CandidateCommit
if ($LASTEXITCODE -ne 0) { throw 'Candidate checkout failed.' }
if ((git rev-parse HEAD).Trim() -ne $CandidateCommit) { throw 'Source pin mismatch.' }
python --version
node --version
npm.cmd --version
$env:VYUHA_PORT = '8000'
$env:VYUHA_DB = Join-Path (Get-Location) 'data/physical-acceptance.db'
$env:VYUHA_AUTH_FILE = Join-Path (Get-Location) 'data/physical-officer-auth.json'
powershell -File scripts/setup-officer.ps1
if ($LASTEXITCODE -ne 0) { throw 'Officer setup failed: stop and resolve the error.' }
powershell -File scripts/start-local.ps1
```

Setup installs locked dependencies, builds bundled assets and prompts for a private officer password. Never put credentials in command arguments, screenshots or Git. Open `http://127.0.0.1:8000/system/evidence`, verify assets load and record exact source/build hashes and freshness. Stop if source_matches is false. Ctrl+C stops the local server. Do not transplant a venv across operating systems. Windows uses `.venv/Scripts/python.exe`; macOS/Linux use `.venv/bin/python`. Corrected Git Bash launchers select either layout; native execution still requires the test below.

## Measured LAN address and prepared runtime

```powershell
Get-NetConnectionProfile
Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.AddressState -eq 'Preferred' -and $_.IPAddress -notmatch '^(127\.|169\.254\.)' } |
  Select-Object InterfaceAlias,IPAddress,PrefixLength
$OfficerIP = '<ACTUAL_WINDOWS_WIFI_IPV4>'
if ($OfficerIP -eq '<ACTUAL_WINDOWS_WIFI_IPV4>') { throw 'Choose the actual measured Wi-Fi/Ethernet address.' }
powershell -File scripts/start-unit.ps1
```

Choose the shared Wi-Fi/Ethernet adapter, not VPN, virtual switch or gateway. Do not reuse an old Codex IP. Prepared Unit Mode must start with no dependency downloads. Verify officer loopback health at `/api/v1/health` and the LAN URL. Android uses `http://<actual officer IP>:8000`; `127.0.0.1` on the phone addresses the phone itself.

For an approved trusted Private LAN, an administrator may add a scoped temporary rule:

```powershell
New-NetFirewallRule -DisplayName 'VYUHA Finale Acceptance 8000' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8000 -Profile Private -RemoteAddress LocalSubnet
# Remove after testing:
# Remove-NetFirewallRule -DisplayName 'VYUHA Finale Acceptance 8000'
```

Do not silently reclassify a public network or open router forwarding. Obtain an approved test LAN if necessary. Linux preparation is `bash scripts/start-local.sh`, then `bash scripts/start-unit.sh`; acquire distribution Python venv/OpenSSL packages while online and follow the approved local-subnet firewall policy. Native Linux startup is a separate result.

## Complete trainee and instructor workflows

1. Put Android Chrome on the same non-guest LAN. Record device model class, Android/Chrome version and actual IP/port. Confirm ordinary Internet availability initially.
2. Open the measured LAN URL and verify Training Ground and locally served assets, not a cached screenshot. Join the disposable unit as `FINAL-PHONE`.
3. Select Adaptive → Prepare adaptive drill → Start adaptive drill. Record the session UUID and frozen Director v2/raid selection metadata.
4. Observe a contact, designate, classify and confirm identity from available cues; choose/execute a simulated response. Record actual contact ID and server-accepted action. Unknown cues must not be assumed hostile.
5. Officer opens `/instructor`, signs in privately and selects that exact session. Send Pause exercise; verify its command UUID acknowledges/applies and the phone pauses. Resume. Send Fail radar and Restore radar; verify degraded/restored trainee state and application ticks. If injecting, record its assigned ID instead of assuming T7.
6. Officer opens `/white-cell`; verify live observed/reference state and correct selected session, command lifecycle and signed-out rejection. Truth/reference remains officer-only.
7. Phone ends exercise. Require **Server verified**, not merely Session saved. Open Ghost, decision-tree review and Time Machine; compare stored decisions/command chronology. Pending verification requires real retry/result, not a pass.
8. Run What-If and canonical/evidence-only Reference Run. Record separate provenance/output, return to original result and confirm original score/profile remains unchanged. Canonical policy is not certified human expert performance; evidence-only mode must abstain on unknown identity.
9. Officer opens `/analytics` and `/unit`, checks the individual result/Director family and protected heatmap. Reload phone and verify its saved accepted decisions/history. If Fusion training assistance is enabled, verify accepted receipts and cues in AAR after reload; separately verify assessment restrictions.

## Crew with separate participants

Save a v0.4 raid through `/exercises` / Raid Composer. Officer on `/crew` selects that frozen raid and Create shared crew, then privately delivers spotter/responder codes. Each participant enters Crew ID and their own role code. Start / resume crew; spotter designates and responder classifies/responds. Verify role-specific permissions, accepted ordering/attribution, instructor pause/resume, reconnection, shared completion and handoff metrics. End and score crew, reload completed state and confirm frozen outcomes; individual analytics/Rapid ID profiles must remain unchanged. Record session UUIDs and accepted counts, never role codes. One browser impersonating both roles is software evidence, not separate-participant physical acceptance.

## Trusted HTTPS and physical WAN-off

Stop HTTP and generate a SAN certificate for the measured address:

```powershell
.venv\Scripts\python.exe scripts/make-cert.py --ip $OfficerIP --out data/physical-certs
$env:VYUHA_SSL_CERTFILE = (Resolve-Path data/physical-certs/server.crt).Path
$env:VYUHA_SSL_KEYFILE = (Resolve-Path data/physical-certs/server.key).Path
powershell -File scripts/start-unit.ps1
```

Output must be a new empty directory. If approved OpenSSL is outside PATH, pass its measured executable with `--openssl`. Manually trust **only ca.crt** through approved Windows/Android/browser procedures. Never share private keys, bypass certificate warnings or disable TLS verification. Verify matching SAN, trusted connection and secure-context status. HTTP/HTTPS/IP/hostname changes create different browser storage origins; join anew where needed. Verify service-worker/cache registration and controlled secure-context reload separately from live HTTP training.

With authorization, disconnect only the router WAN/uplink, leaving router and LAN powered. Disable phone mobile data while retaining Wi-Fi. Verify fresh uncached ordinary Internet requests fail on **both** devices. Record method/time. Reload VYUHA on the separate phone, start a new drill, record a decision, apply an instructor command, complete with Server verified and Ghost/AAR while WAN is absent. Restore WAN afterward. Mobile-data-off with Internet still working over Wi-Fi does not satisfy this test. Unavailable physical setup stays PENDING.

## Native backup/restore and receipt

```powershell
.venv\Scripts\python.exe scripts/backup-data.py backup data/physical-backup.db --source data/physical-acceptance.db
.venv\Scripts\python.exe scripts/backup-data.py restore data/physical-restored.db --source data/physical-backup.db
```

Restore only to a new file. Stop server, point VYUHA_DB at the restored database and verify the exact original scorecards/history. Safeguard external officer auth/bundle keys separately; DB restore does not restore those files. Record every actual result in PHYSICAL-TEST-RESULTS.md with full SHA/build hash, devices, session/command IDs, redacted screenshots and server state. Use PASS for observed success, FAIL for observed defects, PENDING for unexecuted cases. Transfer unchanged signed browser export/import is a separate test from SQLite backup.

## Troubleshooting

| Symptom | Response |
| --- | --- |
| Phone timeout but officer works | Check actual IP/port, all-interface Unit Mode, Private firewall rule, same subnet and guest/AP isolation. |
| Git Bash missing setup | Check Windows venv path and corrected candidate launcher; native PowerShell remains supported. Do not rename/copy a venv. |
| Missing dependencies | Complete locked setup/build online; Unit Mode must not silently install packages. |
| Certificate error/cache unavailable | Match current IP SAN; approve CA trust and secure context without bypassing errors. |
| Phone identity/history missing | Check origin changes, private mode, storage clearing/quota and browser permissions. |
| Command/completion pending | Record ID/server state; reconnect and retry same request without duplicate actions. |
| External websites work during WAN test | Check mobile data, alternative uplinks and cached pages; no WAN-off pass until actual loss demonstrated. |
