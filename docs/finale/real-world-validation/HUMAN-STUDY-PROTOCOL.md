# Director, context difficulty and Fusion study preparation

Status: **PREPARED / NOT EXECUTED**. No human participant, consent record, calibrated difficulty fit or learning/reliance result was received. SC17/F07, F05/X24 and X26 remain PARTIAL for their scientific claims. This protocol and offline instrumentation are independent engineering completion; they do not convert those rows to PASS.

## Director/context difficulty

Preregister the intervention, assignment, sample-size/power rationale, exclusions, missing-data/attrition handling, primary outcome, effect threshold, follow-up timing and analysis before recruiting. Obtain appropriate institutional consent/privacy review, allow withdrawal, retain the identity key separately and export anonymous IDs only. Freeze source, engine/config, candidate task bank and assignment seed. Stratify random assignment by baseline skill if justified, preserve allocation records, and blind outcome scorers where feasible. Control uses a stated fixed/no-learning curriculum or existing Director; adaptive uses the current policy. Equalize time, hardware, opportunities and feedback except the intended intervention.

Use independent equivalent-form standardized baseline/post/retention tasks, not easier training-task success as the learning endpoint. Counterbalance forms and avoid answer reuse. Prespecify night, swarm and weather strata; report per-context success/calibration, trial counts and missingness. A context ledger can record accepted outcomes, but context proficiency and a 70% difficulty target require held-out learner/session predictions and reliability/proper-score evidence. Fit any learner/difficulty model on designated training participants, tune on validation participants and lock held-out participants before calibration claims. Preserve no-learning baseline and all existing model/history receipts.

The executable parallel-arm interface uses the exact `study-manifest.json` and `study-trials.jsonl` schema in `examples/finale-data-intake`. It records anonymized participant/session/task IDs, assigned control/adaptive arm, baseline/post/retention phase, context, independently scored correctness and completion seconds. It rejects crossed arm assignment, duplicate participant-phase-task records, cross-person/session phase conflicts, inconsistent evaluation task sets and nonfinite values. Missing complete follow-ups are counted. This strict common-task interface requires separately analysed equivalent task strata if task sets differ; it does not fit a new learner model automatically.

```sh
PYTHONDONTWRITEBYTECODE=1 .venv/bin/python scripts/evaluate-study.py \
  --manifest /approved/sanitized/study-manifest.json \
  --trials /approved/sanitized/study-trials.jsonl \
  --output /approved/results/study-evaluation.json
```

The report weights participants equally, reports per-phase participant mean accuracy, and compares adaptive-minus-control paired baseline/follow-up changes. Seeded participant bootstrap resamples within assignment arms; intervals are null below two paired participants per arm. Attrition counts accompany complete-pair contrasts. This is a planned unadjusted contrast, not a powered or covariate-adjusted causal conclusion; a researcher must inspect assignment, baseline balance, attrition, task equivalence and protocol deviations. `HUMAN_EXPORT_ANALYSED_UNREVIEWED` does not authenticate consent or randomization. `SYNTHETIC_STUDY_INTERFACE_TESTED` is the only current computed status.

## Fusion and appropriate reliance

Use counterbalanced advice/no-advice or correct/incorrect advice conditions as a separate preregistered study; avoid mixing this intervention into the Director outcome without a factorial design and power rationale. Capture unaided decision/confidence first, evidence shown at the bound observation boundary, advice receipt/version, independent reference labels, final decision/confidence, timing and debrief. Advice viewing needs a stated independent observation method; client association or page telemetry alone cannot establish cognitive reliance. Any deception needs suitable consent/debrief review and must remain a safe, disclosed research/training exercise.

Optional trial `advice` fields are `reference_label`, `initial_label`, `recommendation`, `final_label`, `viewing_basis` and `viewing_reference`. Viewing basis is `independently_observed`, `self_report` or `unverified`. Independently observed exports produce descriptive counts for followed/rejected correct/incorrect advice and initially correct decisions worsened or initially incorrect decisions improved. Self-reported/unverified viewing is counted separately and excluded from verified counts. Final correctness must agree with the independent reference label. These counts are an appropriate-reliance evaluation instrument; they do not establish cognitive over-trust, advice causality or calibrated posterior correctness. The randomized paired/counterbalanced causal analysis remains a separately preregistered researcher-owned analysis, not the parallel-arm learning contrast.

Sensor posterior calibration still requires independently held-out, matched encounter labels and proper-score/reliability evaluation using the sensor utility. Never treat unrelated RGB/radar/RF datasets as simultaneous Fusion observations. Never replace measured labels with synthetic ground truth to close F05 or X26.

## Required study handoff

Deliver the sanitized versioned manifest/trials, ethics and consent review reference, preregistration/assignment record, independently scored evaluation task/form definitions, locked source/build/config, hardware/sample description, exclusions/attrition, aggregate report/failures and SHA-256 hashes. Independent reviewers reproduce the results and approve only the supported sample/domain wording. No participant identifiers, recordings or rights-sensitive data belong in Git. Demonstrated usability and human learning efficacy remain separate outcomes.
