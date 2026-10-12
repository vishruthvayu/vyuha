# Dataset review checklist

Status: **NOT EXECUTED — datasets not supplied**. Starting code checkpoint `8dc8405`; pin actual evaluation commit later. Record reviewer/date and PASS/PARTIAL/FAIL/NOT APPLICABLE per item with evidence. An unchecked item remains pending, not implicitly passed.

## Receipt and rights

- [ ] Stable dataset ID/version, official source and acquisition dates supplied.
- [ ] Raw/export artifact hashes and counts verified, including exclusions.
- [ ] License and redistribution/model-training rights reviewed; consent and privacy restrictions respected.
- [ ] Raw/sensitive data stored outside Git in an approved location; sanitized summary acceptable for submission.
- [ ] Source kind marks real/synthetic/augmented/mixed per record, not just per report.

## Instrument and labels

- [ ] Sensor model/class, settings, calibration and noise/saturation constraints recorded.
- [ ] Units and coordinate/time frames explicit; conversion fixtures checked.
- [ ] Missing values distinguished from zeros; censoring/limits recorded.
- [ ] RGB/thermal alignment and radiometric status documented; pixels not silently treated as temperature.
- [ ] Radar target/range/measurement context supports the proposed curve; negatives and false alarms represented.
- [ ] RF center frequency, sample rate, bandwidth, gain/reference and label acquisition procedure documented.
- [ ] Identity/intention labels have defensible independent provenance; unknowns retained.
- [ ] No unavailable ground truth appears in live assistant inputs.
- [ ] Annotation disagreement, uncertain labels and instrument limitations reported.

## Leakage-resistant evaluation

- [ ] Split by encounter/session/person/site/device/time as appropriate before fitting/preprocessing.
- [ ] Near-duplicates, successive video frames, radar sweeps or overlapping RF windows from one encounter cannot straddle train/test.
- [ ] Data-dependent normalization, feature selection, threshold fitting and calibration use training/validation only.
- [ ] Test split is locked; no repeated tuning on test results without declaring a new independent test set.
- [ ] Baselines, metrics, thresholds, subgroup evaluation and confidence interval method specified in advance.
- [ ] Class imbalance, exposure lengths and excluded/failed runs disclosed.
- [ ] Cross-dataset distribution mismatch assessed; matched multi-sensor pairs actually exist if fusion is evaluated.

## Reproducibility and product boundary

- [ ] Notebook/code revision, dependencies and seeds recreate the reported numbers.
- [ ] Independent rerun compares raw predictions/labels and aggregate results.
- [ ] Real and synthetic results appear in separate tables with denominators, uncertainty and failure cases.
- [ ] Proposed parameter/model changes use a new version; frozen scenarios and historical sessions remain unchanged.
- [ ] Regression, parity, historical fixtures and production build pass after accepted integration.
- [ ] Claim wording supports only measured modalities/domains; no military certification, intent inference or human-learning causality inferred.
- [ ] Report is linked to accepted source/build and evidence manifest; reviewer sign-off recorded.

Reject or quarantine intake if rights, label provenance or unit interpretation cannot be established. Request clarification without deleting the original artifacts. Failure of a dataset quality gate is not a failed architectural LAN test.
