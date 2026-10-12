# Executable real-data evaluation handoff

Implemented against candidate base `2bf90130eb02def330292673f18d1658f8259488` on 12 October 2026. No measured sensor export or participant study was received. This is now an executable offline interface, with synthetic examples and regression evidence. It neither runs a new detector on raw signals nor trains or changes production physics, Fusion, Director, scores or histories.

## Files and receipt sequence

Use `examples/finale-data-intake/manifest.json` and `records.jsonl` as exact version-1 schemas. Prepare a small lawful, sanitized observation export, predictions and dependency lock in one approved directory. Keep original recordings, raw private data and licensed archives outside Git. The manifest enumerates every local artifact by portable relative path, size and SHA-256; symlink/traversal escapes are rejected. The dependency lock must itself be a verified artifact. The source/prediction revision is a full commit ID; the report additionally records the evaluator file hash and Python runtime.

1. Preserve source/version/license, acquisition procedure and ordered transformations. Mark each record `real`, `synthetic` or `augmented_real`. A mixed manifest retains each kind. `real` means measured acquisition, not a favourable claim or synthetic label.
2. Domain reviewers verify rights, instruments/settings, independent label semantics, content-hash meaning, timestamps/origin and calibration. `license.review_status=permitted` is a declaration after review, not a permission grant from the validator. Pending/rejected intakes can validate hashes but cannot be evaluated.
3. Freeze train/validation/test assignment before preprocessing or fitting. Both recording and encounter IDs must be split-disjoint. Optional device/site groups enforce additional holdouts. Export a stable hash of each underlying measurement/window as `content_sha256`; duplicated measurement content across splits is rejected. This checks supplied identifiers/hashes, not undocumented near-duplicates or falsely renamed sessions.
4. Bind one prediction to every held-out sample ID. Keep uncertain labels `null` and abstentions `probabilities:null`; excluded/failed predictions cannot disappear. Reference labels and `truth_available_at_s` remain offline evaluation data and are never passed to a live evidence-only assistant by this utility.
5. Run intake, then metrics. Record the output hashes, exact method code and independently rerun the same locked inputs. Claim review and audit promotion happen separately.

```sh
PYTHONDONTWRITEBYTECODE=1 .venv/bin/python scripts/evaluate-real-data.py \
  --manifest /approved/sanitized/dataset-v1/manifest.json \
  --output /approved/results/intake.json
PYTHONDONTWRITEBYTECODE=1 .venv/bin/python scripts/evaluate-real-data.py \
  --manifest /approved/sanitized/dataset-v1/manifest.json \
  --predictions /approved/sanitized/dataset-v1/predictions.jsonl \
  --output /approved/results/evaluation.json
```

Exit 0 means the scoped contract/evaluation completed; exit 2 prints `REJECTED` and no report is written. Outputs may not overwrite manifests, predictions, proposals or input artifacts. `REAL_EXPORT_EVALUATED_UNREVIEWED` records received export computation, not independently validated calibration. `SYNTHETIC_INTERFACE_EVALUATED` remains software evidence. No automatic network, external publication or application write occurs.

## Metrics and modality contracts

Classification predictions declare exactly the manifest class probabilities summing to one, or abstain. Reports include full confusion/support, labelled/unknown counts, abstention coverage, accuracy including abstentions as unsuccessful, conditional accuracy, macro F1, multiclass Brier (sum across classes), clipped log loss (`1e-15` lower bound), equal-width confidence reliability bins and descriptive ECE. Proper scores and reliability exclude abstentions and unknown reference labels; their denominators remain explicit. They do not turn heuristic Fusion scores into calibrated posteriors. Classification of an RGB/thermal/RF feature does not establish intent, RF-control medium or detection curves for another instrument.

Detection uses independently labelled `observation.target_present` (boolean). Negative records must contain measured `observation.exposure_s` with units `s`; each prediction's `negative_exposure_s` must match that value. Positive records contribute no negative exposure. False-alarm counts and flags must agree. Reports include positive/negative sample denominators, detection probability, false-positive sample rate and false alarms/hour with actual negative exposure. A missing denominator yields null, never zero. This is a detection-export metric interface, not evaluated raw radar DSP. The observed detection threshold and algorithm belong in the preregistered metric-plan reference and instrument/settings report.

Optional `metric_plan.range_bins_m` gives strictly increasing boundaries; ranges must be metres. The final bin includes its upper boundary, prior bins exclude it; outside/missing-range samples are reported. Context metrics preserve each declared context map rather than merging night/weather/site claims. Range/context tables are descriptive denominators; pooled intervals do not certify their small subgroups.

RF exports declare frequency/sample-rate/bandwidth units and gain/reference in instrument settings; no signal cannot supply hostility or fiber-control truth. Thermal temperature in K/C requires declared radiometric calibration, with absolute-zero validation; uncalibrated counts/pixels remain counts/pixels. The interface intentionally accepts one modality per manifest. Unrelated datasets cannot declare fused or simultaneous measurements. Matched multi-sensor evaluation needs a separately reviewed synchronization/registration adapter and matching evidence before it is supported.

Confidence intervals use a seeded percentile bootstrap over connected recording/encounter acquisition groups, retaining all measurements in each sampled group. Related recordings of one encounter are one cluster. Fewer than two clusters or fewer than 100 valid metric resamples yields null. Reports include source-specific counts, seed and replicate count. These intervals assume independent clusters; they do not capture selection bias or reused-device/site dependence. Use stricter holdouts and independent review for those claims. Real, synthetic and augmented results always occupy separate strata; there is no blended headline result.

## Data-derived parameter proposal gate

Create a separate versioned proposal only after reproducing training/validation estimates and locked held-out evaluation. `validate_parameter_proposal` permits detection/dropout probabilities, latency seconds and false alarms/hour, explicit units/bounds/intervals, real source kind, domain/unsupported claims, new parameter version, and an exact dataset/manifest/evaluation-report hash. The fitting split must be train or validation; test cannot fit parameters. Values and intervals are consistency-checked; the supporting estimate is still independently reviewed. The utility returns `writes_to_model:false` and never applies a proposal.

The proposal object contains `schema_version`, `dataset_id`, `dataset_version`, `manifest_sha256`, `report_sha256`, `new_parameter_version`, `supersedes_version`, `modality`, `parameters`, `domain`, `unsupported_claims`, `review_status:"proposed"`. Each parameter contains `name`, `value`, `unit`, `interval_95:[low,high]`, `supporting_split`, `source_kind:"real"`, `evidence_reference`. Bind `report_sha256` to the bytes of the canonical sorted/indented report generated without a proposal, then rerun with `--proposal /approved/proposal.json`. Accepted integration still needs a separate reviewed engine/config version, Python/TypeScript parity, frozen history tests, regression/build and bounded claim review.

## Optional technical plotting

Core evaluation uses the standard library. For PNG/CSV reliability panels, use an isolated optional research environment and `scripts/research-plot-requirements.lock.txt`; the resolved plotting lock is smoke-tested on Python3.13/macOS, not a new native Windows/Linux claim. Run `python scripts/plot-data-evaluation.py --report evaluation.json --output-directory /approved/results/plots`. Nonempty bins retain denominators, real/synthetic/augmented strata remain separate, and plots do not write model parameters. Detection or study reports are not silently reinterpreted as classification calibration. See [Matplotlib subplots documentation](https://matplotlib.org/stable/api/_as_gen/matplotlib.pyplot.subplots.html).
