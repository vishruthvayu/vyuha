# Four-track research handoff

Prepared 12 October 2026; starting candidate `8dc8405`. **All external research artifacts/results are pending receipt.** Team-member identities have not been supplied. These are track responsibilities, not assigned personal identities or completed studies.

| Track | Deliverables | Product integration target | Current status |
| --- | --- | --- | --- |
| RGB + thermal | Source/license manifest, instrument/alignment note, grouped split, notebook, held-out metrics/failures | Versioned visual/thermal observation assumptions or separately evaluated classifier | PENDING — not received |
| Radar | Measurement provenance, instrument/settings/units, range/context/negatives, notebook/curves/uncertainty | Versioned detection/false-alarm/latency parameters | PENDING — not received |
| RF | Acquisition/label manifest, frequencies/bandwidth/gain, grouped splits, open-set tests | Versioned RF observation uncertainty, separately evaluated signal model | PENDING — not received |
| Human usability + submission | Consent/privacy procedure, anonymized task results/errors, recordings rights, report | UI comprehension/accessibility improvements and scoped demo evidence | PENDING — not received |

## Delivery layout

For each track deliver a sanitized subdirectory `<track>/<dataset-id>-<version>/` containing `manifest.json`, `README.md`, `report.md` or PDF, reproducible notebook/code and dependency lock, split manifest, aggregate `metrics.json`, uncertainty/failure notes and a SHA-256 artifact manifest. This is a recommended layout, not a request to commit raw data. Put raw/private/large/licensed data in an approved external location referenced by the sanitized manifest; do not include tokenized URLs. Store only reviewable lawful sanitized artifacts in Git after review.

The manifest follows DATA-INTEGRATION-CONTRACT.md. Reports must identify real versus synthetic sources, exact metric denominators, grouped leakage-resistant splits, hardware, source revisions and limits. Where a teammate cannot provide a required field, mark UNKNOWN/PENDING and explain; never silently fill inferred measurement details.

## Review and integration sequence

1. Intake reviewer acknowledges receipt/version/hashes and records missing rights/provenance fields without altering raw artifacts.
2. Domain reviewer completes DATASET-REVIEW-CHECKLIST.md and rejects unsupported labels, mixed units or leakage.
3. Reproduction reviewer reruns the supplied notebook on the same locked split and records actual results, including discrepancies.
4. Product owner proposes a bounded simulation/config or UI change, with its intended benefit and unsupported claims excluded.
5. Engineering implements a new version without rewriting verified histories; runs validation/parity/regression/build and attaches exact commit/evidence.
6. Independent review approves the bounded wording and updates evidence/audit status. External real-data or human-study findings remain pending until their specific proof exists.

Each accepted handoff should record dataset ID/version/hash, reviewer/date, rights decision, reproduction source/outputs, proposed model/config version, final integration commit, regression links and approved claim text. Source `8dc8405` is a starting checkpoint only; final-root release records must replace it with the actual evaluated commit. No stable tag, presentation metric or System Evidence claim is authorized by document creation alone.

## Parallel work while awaiting data

Engineering continues strict configuration checks, observation truth boundaries, synthetic variation/parity, UI uncertainty, immutable replay, protected endpoints and local deployment acceptance. Prepare data adapters only after real schema/units arrive; do not invent paired multi-modal observations or change scoring to improve presentation metrics. Calibration, real-world generalization and human learning remain separate external-evidence gates.
