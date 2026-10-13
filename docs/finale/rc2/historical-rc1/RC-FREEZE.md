# Software RC freeze — 13 October 2026

Reference: `v1.1.0-rc.1`, development branch `feature/vyuha-finale-edition`, prerelease branch `release/v1.1.0-rc.1`.

Tested implementation: `e07a3845cc465f430b572ece7fbded687c1e3729`.
Source SHA256: `02cf2c87a2fc59d459e5e696aa3141c83092a1e224c81663b78db1cef1ba982a`.
The final reference adds engineering receipts only. Resolve the exact final receipt commit with `git rev-parse v1.1.0-rc.1^{}`; it deliberately is not embedded in its own commit.

Software gates G01–G07 pass scoped. Full tests:609 backend/160 frontend, zero failures. All versioned parity;18baseline/22stored cards unchanged;27canonical/clone build files exact. Independent84.0 provisional;62PASS/30PARTIAL/1N/A. G08/G09 pending by user. This is a prerelease, not stable approval or a physical-device certificate.

Engineering archives and SHA256 receipts are generated outside Git under the project's `outputs/finale` directory. They exclude runtime databases, auth/bundle secrets, certificate keys, virtual environments, node_modules and competition media. Set up locked dependencies using the deployment guide before local runtime; do not reuse another machine's venv. Run the physical/native runbook against this reference and append real results before stable approval.

Fallback branch `release/v1.0.1` and tag `v1.0.1` remain `2ca96105044ad6a14952d74db619e20006c26eca`. Stop the candidate, preserve a candidate-compatible backup, and use the matching old-version database backup with the old release. New0.4 data is not promised to downgrade into v1.0.1. Never restore over an existing database or silently delete accepted evidence.

Remaining PARTIALs: SC14,SC16,SC17,SC19,SC22,SC23,P1-03,P2-01,P2-03,CH08,CH12,CH15,F05,F07,X02,X07,X08,X09,X11,X12,X13,X17,X19,X20,X24,X26,X27,X29,X30,X31. Their exact boundaries and classification are in AUDIT-CLOSURE-MATRIX.md, REMAINING-GAPS-PRIORITIZED.md and the independent report.
