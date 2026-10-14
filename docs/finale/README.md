# VYUHA engineering evidence index

Start with the product requirements at `/system/compliance`; use its feature-specific "Show me" actions and evidence links. Current source/release status lives in [evidence.json](evidence.json), [FINAL-RELEASE-GATES.json](FINAL-RELEASE-GATES.json) and [AUDIT-CLOSURE-MATRIX.md](AUDIT-CLOSURE-MATRIX.md).

| Question | Read |
|---|---|
| What was proved for immutable RC2? | [rc2/REGRESSION.json](rc2/REGRESSION.json), [rc2/INDEPENDENT-FINAL.json](rc2/INDEPENDENT-FINAL.json) |
| Which Linux defects were fixed? | [rc2/LINUX-FINDINGS.md](rc2/LINUX-FINDINGS.md) |
| What must physical testers do? | [rc2/RETEST.md](rc2/RETEST.md), [PHYSICAL-TEST-RESULTS.md](PHYSICAL-TEST-RESULTS.md) |
| Which scores remain unchanged? | [rc2/HISTORY.json](rc2/HISTORY.json) |
| How are auth/backup/TLS scoped? | [rc2/AUTHORIZATION.json](rc2/AUTHORIZATION.json), [rc2/DEPLOYMENT.json](rc2/DEPLOYMENT.json) |
| Why this redesign? | [design/REFERENCE-RESEARCH.md](design/REFERENCE-RESEARCH.md), [design/DESIGN-SYSTEM.md](design/DESIGN-SYSTEM.md) |
| Which additions were selected or deferred? | [FEATURE-SELECTION-DECISIONS.md](FEATURE-SELECTION-DECISIONS.md) |
| What new engineering problems were found? | [design/ENGINEERING-CLOSURE.md](design/ENGINEERING-CLOSURE.md), [design/COMMAND-WORKFLOWS.md](design/COMMAND-WORKFLOWS.md), [design/REVIEW-WORKFLOWS.md](design/REVIEW-WORKFLOWS.md) |

The Ultimate branch is active development, not a validated replacement until final software gates pass. RC2 remains immutable while teammates test it. The external 89/100 audit is a supplied assessment of RC2; it is not a fresh Ultimate rescore. Older receipts remain dated provenance. Native Windows, fresh RC2 Linux and separate phone/LAN/WAN/trusted HTTPS checks remain pending unless actual results are supplied. No real sensor calibration or human efficacy study is established.
