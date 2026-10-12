# Separate real and synthetic evaluation

**Current real-data evaluation: NOT PERFORMED; external datasets/results not supplied.** This document defines how future results will be assessed. Existing deterministic/parity fixtures, synthetic sensor assumptions and synthetic learner experiments remain software evidence with their original scope.

| Evidence track | Valid question | Required evaluation | Unsupported inference |
| --- | --- | --- | --- |
| Synthetic simulation | Does the versioned model behave deterministically and respect truth/units/config boundaries? | Fixed seeds, boundary cases, parity, frozen replay/scorecard integrity | Real-world detection accuracy or operational effectiveness |
| Real RGB/thermal | Does the tested observation/classifier generalize to held-out encounters in this dataset? | Encounter/device/site split, per-class metrics, unknowns, confidence intervals and failure examples | Hostile intent, radar accuracy or calibrated temperature from non-radiometric pixels |
| Real radar | What detection/false-alarm/latency behavior was measured for the supplied instrument and contexts? | Held-out ranges/conditions, exposure denominators, detection/false-alarm curves with uncertainty | Military-grade calibration or transportability to unspecified radars |
| Real RF | What signal features/classifications were measured under known acquisition conditions? | Grouped non-overlapping encounters, gain/bandwidth context, open-set/no-signal handling | Fiber control or hostility from signal absence |
| Matched multi-sensor encounters | Does the fusion rule/model improve defined observation prediction on paired data? | Verified time/space pairing, modality ablations, independent held-out labels, calibration/reliability | Fusion accuracy assembled from unrelated datasets |
| Human usability | Can participants complete tasks and understand feedback? | Task success, errors, time, accessibility, questionnaire procedure and anonymized sample description | Causal learning improvement or field operational readiness |
| Human training study | Does a defined intervention improve a prespecified learning/retention measure? | Ethical consent, comparison/control, baseline skill, counterbalancing/randomization where feasible, blinded scoring, retention and uncertainty | General learning benefit from synthetic agents or unpaired pre/post anecdotes |

## Report format

Publish separate **real-only**, **synthetic-only** and explicitly labelled **mixed** tables. Each row gives dataset/version/hash, sample and independent-encounter counts, split, method/source commit, metric definition, confidence interval, context and limitations. No aggregate score may blend synthetic and real records without disclosing weighting and separate constituent results. No numbers are inserted until actually computed.

Detection reporting needs actual positive/negative denominators and thresholds; classification needs confusion matrices plus abstention/unknown handling; calibrated probabilistic output needs proper scoring (for example Brier/log loss) and reliability plots on held-out observations. Class prevalence, confidence interval method, repeated-seed variation and missing/excluded records belong alongside metrics. Timing distinguishes capture, preprocessing, model inference, rendering and server reconstruction; quote hardware and workloads.

A simulator may be calibrated on training measurements, checked on validation measurements and assessed once on a locked held-out test. Generated synthetic labels cannot replace observed labels on the real test set. Domain transfer is a new claim needing external validation. A model that performs well on a dataset may still remain unsuitable for live, safety-critical or certified use; the project claim stays within the measured training prototype scope.

## Version and historical safety

Record pre-integration frozen review/card outputs and source hash. Put any accepted calibrated model/config behind a new explicit engine/config version with provenance. Re-run strict validation, original/new parity, historical fixtures, backend/frontend tests and build. Preserve earlier Director selections, assistant exposure receipts and verified sessions verbatim. The team must approve a new bounded claim only after dataset review and reproducible results; these documents do not mark a calibration audit finding passed.
