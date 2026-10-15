> Historical release evidence. This document describes the source/date recorded below; it is not acceptance of the current Ultimate working tree. Current reconciliation: [IMPLEMENTATION-RECONCILIATION.md](IMPLEMENTATION-RECONCILIATION.md).

# Software release-candidate acceptance —13 October 2026

Current RC2 tested implementation `0c6aed15ce98b9fb53dda1f90bb85f0f131e13f1`; source SHA256 `5720d526fd56cc17a004577e9828d9baa666d1435fe78b80902c9a3d496eede0`. **617 backend / 172 frontend PASS, zero failures**; production **27 assets / cache `b2b7e099df64`**; lint/format PASS. RC1 `v1.1.0-rc.1` remains `a2183e1a5746c8a04fa25ff81af952faa76b27aa` and fallback `release/v1.0.1`/`v1.0.1` remains `2ca96105044ad6a14952d74db619e20006c26eca`. No stable release is authorized.

Historical RC1 provisional audit: **84/100**. RC2 has a scoped independent remediation review, **no fresh weighted score**. All93 original audit dispositions retained: **62 PASS / 30 PARTIAL / 1 N/A / 0 BLOCKED**. Arch Linux RC1 passed with defects; RC2 Linux re-test, native Windows and fresh separate-device phone/LAN/WAN/HTTPS trust remain pending. See [Linux resolutions](rc2/LINUX-FINDINGS.md) and [minimal retesting](rc2/RETEST.md).

Software gates G01–G07 pass scoped. Fresh independent RC2 source/manifest review passed;12focused checks passed independently, without assigning a new weighted score. [Final independent receipt](rc2/INDEPENDENT-FINAL.json). Historical RC1 X10 is not reused as a fresh RC2 approval. G08 remains PENDING_BY_USER; G09 has historical Arch Linux RC1 PASS_WITH_DEFECTS, RC2 Linux and native Windows pending and block stable approval. See FINAL-RELEASE-GATES.json and the all 93-row matrix.

- Fresh physical Finale multi-device LAN/WAN/HTTPS trust/cold reload and native Windows execution remain pending. Arch Linux RC1 native operation passed with defects; RC2 Linux retest remains pending.
- No real sensor measurements or human study supplied; evaluation interfaces, synthetic plots and statistical contracts are implemented preparation, not empirical efficacy.
- Trusted-LAN independent callsign/UUID is not authenticated secure-exam learner identity.
- Whole Worker/GPU/process memory and operational endurance breadth are not certified.
- Original media rubric rows retained as audit provenance; no media/submission work is assigned or a software-only gate.
