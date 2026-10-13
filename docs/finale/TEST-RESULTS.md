# RC2 final source regression —13 October 2026

Current RC2 tested implementation `0c6aed15ce98b9fb53dda1f90bb85f0f131e13f1`; source SHA256 `5720d526fd56cc17a004577e9828d9baa666d1435fe78b80902c9a3d496eede0`. **617 backend / 172 frontend PASS, zero failures**; production **27 assets / cache `b2b7e099df64`**; lint/format PASS. RC1 `v1.1.0-rc.1` remains `a2183e1a5746c8a04fa25ff81af952faa76b27aa` and fallback `release/v1.0.1`/`v1.0.1` remains `2ca96105044ad6a14952d74db619e20006c26eca`. No stable release is authorized.

Historical RC1 provisional audit: **84/100**. RC2 has a scoped independent remediation review, **no fresh weighted score**. All93 original audit dispositions retained: **62 PASS / 30 PARTIAL / 1 N/A / 0 BLOCKED**. Arch Linux RC1 passed with defects; RC2 Linux re-test, native Windows and fresh separate-device phone/LAN/WAN/HTTPS trust remain pending. See [Linux resolutions](rc2/LINUX-FINDINGS.md) and [minimal retesting](rc2/RETEST.md).

| Check | Final result | Receipt |
|---|---|---|
| Full backend |617 PASS /0FAIL /1087.53s,1existing Starlette/httpx warning |rc2/final-backend-617.log.txt|
| Full frontend |172 PASS /0FAIL /0skipped /137555.552417ms |rc2/final-frontend-172.log.txt|
| Production /lint /format |PASS;27assets/cacheb2b7e099df64,29.20s |rc2/final-build-172.log.txt; final-lint.log.txt; final-format.log.txt|
| Clean clone |Locked npmci/build, all27bytes and3manifests equal |rc2/DEPLOYMENT.json|
| Historical cards |18baseline/22stored exact, production DB unchanged |rc2/HISTORY.json|
| Protected HTTP routes |35 method/path pairs401 anonymous/forged/logout |rc2/AUTHORIZATION.json|
| Final targeted |16backend PASS18.06s /12frontend PASS6446.47425ms |rc2/target-backend-16.log.txt; ui-target-12.log.txt|
| Independent late-role regression |4PASS4207.092709ms after guard |rc2/independent-crew-lifetime-after-fix.log.txt|

Full Python/TypeScript parity within the final suites: original312; immediate544checkpoints/32scenarios; delayed288/18; sensors1920; motion7452; Fusion64;12Director templates. Frozen engines/scoring unchanged. Targeted/independent counts are subsets, not additive. No test assertions, timeouts or historical scorecards were weakened.

Actual browser scope is macOS Chrome on loopback, separate role tabs: Composer/Crew390/768/1440/1920, pointer/Tab reachability, enabled action contrast, current sensor list selection, callsign AAR/history, fresh local pages, authoritative Crew decisions/history/restart. Current TLS/backup/new-file restore evidence is process-scoped, not cross-platform browser trust. Original Linux spotter traces lack422response bodies; current natural observation race reproduced without engine patching.

RC1 logs and claims are archived under rc2/historical-rc1 or retained in explicitly dated workstreams; they are not relabelled as current runs. Full logs and hashes are in rc2/REGRESSION.json.
