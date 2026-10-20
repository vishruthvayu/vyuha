# Mission data workstream — 12 October 2026

Worktree: `/tmp/vyuha-mission-data`, detached originating candidate `2bf90130eb02def330292673f18d1658f8259488`. Original protected release `2ca96105044ad6a14952d74db619e20006c26eca` unchanged. No shared `raid_v2.py`, `director_v2.py` or `fusion.py` edit; no canonical commit/reset/push, external message, data download or publication.

## Completed engineering

- Strict offline version-1 manifest/artifact/JSONL ingestion with SHA-256 and byte integrity, portable local path confinement including symlinks, duplicate-key/nonfinite JSON rejection, dataset version/provenance/license declaration, verified dependency lock, explicit instruments/settings/calibration, class semantics, units and thermal radiometry boundary.
- Recording AND encounter split disjointness, optional device/site holdouts, cross-split duplicate content hash rejection, train/validation-only preprocessing/fitting declaration, held-out prediction ID binding including null labels/abstentions, no assumed simultaneous multimodal data.
- Separate real/synthetic/augmented held-out classification metrics/confusion/proper scores/reliability and detection/exposure metrics. Radar negative exposure must match the measured record, never a fabricated prediction denominator. Optional preregistered range bins and separate context tables report counts and out-of-range records.
- Reproducible source-specific percentile uncertainty resamples connected recording/encounter groups; related clips remain one cluster and inadequate independent samples yield null intervals. Method code hash/runtime/seeds/counts and claim boundaries are attached.
- Data-derived parameter proposal identity/report/hash/unit/bounds/interval/new-version checks. Training/validation fitting only; proposal remains unreviewed and never writes physics or histories.
- Sanitized parallel-arm study export evaluation: fixed participant assignment, participant/session/task integrity, common within-phase task sets, equal participant weighting, paired baseline/post/retention changes, participant bootstrap intervals and explicit attrition. Optional independent-reference advice counts exclude unverified/self-reported viewing and remain descriptive. Consent, assignment, viewing and causality are independently reviewed declarations, not established by the software.
- Runnable generated sensor/study examples and exact teammate commands/protocol/evidence ladder.

## Changed files

`server/data_validation.py`, `server/study_validation.py`, `scripts/evaluate-real-data.py`, `scripts/evaluate-study.py`, `server/tests/test_data_validation.py`, `server/tests/test_study_validation.py`; `examples/finale-data-intake/{README.md,manifest.json,records.jsonl,predictions.jsonl,dependencies.lock.txt,study-manifest.json,study-trials.jsonl}`; `docs/finale/real-world-validation/{DATA-INTEGRATION-CONTRACT.md,REAL-VS-SYNTHETIC-EVALUATION.md,RESEARCH-HANDOFF.md,EVALUATION-RUNBOOK.md,HUMAN-STUDY-PROTOCOL.md}` and this workstream report. Exact synthetic interface receipt is `INTERFACE-EVALUATION-RECEIPT.json` in the same validation directory.

## Verification

```sh
PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -m pytest \
  server/tests/test_data_validation.py server/tests/test_study_validation.py \
  server/tests/test_sensors_v2.py server/tests/test_fusion.py \
  server/tests/test_director_v2.py server/tests/test_director_v2_experiment.py -q
```

**93 passed**, one existing Starlette/httpx deprecation warning, 6.28 seconds on the first combined focused run. New interface cases are **56** (44 data + 12 study); existing adjacent sensor/Fusion/Director behavior remains covered. Commands against the checked-in examples completed with `SYNTHETIC_INTERFACE_EVALUATED` and `SYNTHETIC_STUDY_INTERFACE_TESTED`. No backend endpoints or product scoring/physics code changed. Final root integration/full backend/frontend/parity/history/build acceptance is separate.

## Inventory and audit decisions

Scoped source/project-work/Downloads filename/report/notebook searches found no relevant measured export or human study received. VYUHA handoff docs explicitly remained pending. Available Downloads notebooks have no drone/radar/thermal/DroneRF hits; unrelated SIH datasets are not counted. No public benchmark was selected or evaluated, so no unverified benchmark license or measurement result is asserted.

| Audit ID | Software/evaluation preparation | Genuine remaining requirement | Closure decision |
| --- | --- | --- | --- |
| SC16 | Strict per-modality intake, units/radiometry, exposure/range/context metrics and cluster intervals implemented | Reviewed real sensor measurements, instrument domain/calibration and independent reproduction | PARTIAL; no physical accuracy PASS |
| SC17 | Participant-level independent outcome instrument/protocol; existing synthetic comparison protected | Fitted held-out difficulty/context prediction evidence and independent human learning/retention | Scientific claim PARTIAL; root may separately complete context software |
| F05 | Held-out probability proper scores/reliability + observed advice correctness instrument | Real likelihood fit, matched encounter labels, calibration and measured reliance design | PARTIAL; no trained posterior or causal over-trust PASS |
| F07 | Paired standardized outcome/retention export analysis and common-task controls | Reviewed learner evidence/calibration; Director context ledger handled independently by root | Scientific claim PARTIAL |
| X24 | Independently observed viewing/reference counts; self-report excluded from verified counts; protocol | Actual consented and preregistered measured appropriate-reliance/cognitive study | PARTIAL; no human viewing or bias inferred |
| X26 | Reproducible real-vs-synthetic report and unapplied proposal gates | Genuine classifier/difficulty/learner data, independent rerun and claim review | PARTIAL |

Next external action is the smallest sanitized actual manifest/records/predictions/dependency-lock handoff per modality, with official source/version/license and instrument/label/split review; run the CLI and independent reproduction before any calibration claim. Human track needs reviewed consent/preregistration and sanitized independently scored participant trials. These missing physical/scientific materials do not prevent other independent software work or authorize fictional results.
