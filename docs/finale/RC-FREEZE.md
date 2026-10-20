# RC2 engineering prerelease freeze —13 October2026

Current RC2 tested implementation `0c6aed15ce98b9fb53dda1f90bb85f0f131e13f1`; source SHA256 `5720d526fd56cc17a004577e9828d9baa666d1435fe78b80902c9a3d496eede0`. **617 backend / 172 frontend PASS, zero failures**; production **27 assets / cache `b2b7e099df64`**; lint/format PASS. RC1 `v1.1.0-rc.1` remains `a2183e1a5746c8a04fa25ff81af952faa76b27aa` and fallback `release/v1.0.1`/`v1.0.1` remains `2ca96105044ad6a14952d74db619e20006c26eca`. No stable release is authorized.

Historical RC1 provisional audit: **84/100**. RC2 has a scoped independent remediation review, **no fresh weighted score**. All93 original audit dispositions retained: **62 PASS / 30 PARTIAL / 1 N/A / 0 BLOCKED**. Arch Linux RC1 passed with defects; RC2 Linux re-test, native Windows and fresh separate-device phone/LAN/WAN/HTTPS trust remain pending. See [Linux resolutions](rc2/LINUX-FINDINGS.md) and [minimal retesting](rc2/RETEST.md).

Reference `v1.1.0-rc.2`; development branch `feature/vyuha-finale-edition`; new immutable prerelease branch `release/v1.1.0-rc.2`. Resolve exact final receipt commit with `git rev-parse v1.1.0-rc.2^{}`; the tested implementation is0c6aed1, and later receipt commits only change documentation. G01–G07 must pass scoped before sealing the tag. G08/fresh physical and G09/current native retests remain separate stable acceptance gates. No stable tag.

Source/local-runtime archives and SHA256 receipts are stored outside Git under project outputs/finale/rc2-20261013. Runtime ZIP includes27local assets; locked dependency setup is still required. No live DB, auth/bundle secrets, certificate keys, virtual environments, node_modules or competition media.

Rollback preserves the candidate backup and uses the matching old-version database backup with protectedv1.0.1. New0.4archives are not promised to downgrade. Never overwrite a live database or delete accepted evidence.
