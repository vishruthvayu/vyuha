# Real-world data intake contract

Prepared 12 October 2026 for the Finale candidate originating at `8dc8405`. **No external RGB/thermal, radar, RF or human-study dataset has been received or evaluated in this contract.** Current synthetic sensor parameters and synthetic learner experiments do not become calibrated evidence through this handoff.

## Intake boundary

Four research tracks deliver separately: RGB/thermal observation, radar measurement, RF signal measurement and human usability/evidence. Submit a small sanitized manifest/report/notebook into a reviewed handoff; retain raw or sensitive data in an approved access-controlled location outside Git. Do not commit large datasets, personally identifying study data, licensed material without permission or operational/security-sensitive recordings. This contract is a review format. The offline version-1 intake/evaluation utilities are now implemented in `server/data_validation.py` and `scripts/evaluate-real-data.py`; see `EVALUATION-RUNBOOK.md` for the exact executable schema. They are not application endpoints or an automatic training pipeline.

Every dataset manifest must specify:

| Field | Required content |
| --- | --- |
| identity | Stable dataset ID/version, owner, contact, acquisition/retrieval date, authoritative source URL or access reference |
| provenance | Real measurement, synthetic simulation, augmented real sample or mixed; acquisition instruments/procedures; transformations in order |
| rights | License text/link/version, redistribution/commercial-use constraints, consent/ethics basis where applicable |
| artifacts | Relative filenames/approved external locations, byte sizes and SHA-256 hashes; no secrets in paths/URLs |
| records | Record count, sample IDs, encounter/session/subject/site/device grouping IDs; missing/corrupt/excluded record counts |
| sensing | Modality, hardware class, instrument configuration/calibration, location/context if publishable, coordinate frame and timestamp clock basis |
| units | Explicit units and conversion for every numeric field; distance/range, frequency/bandwidth, power/reference, angles, temperatures and time |
| ground truth | Label origin, annotator procedure, uncertainty/disagreements, unknown label policy and truth availability time |
| evaluation | Train/validation/test split IDs or deterministic recipe, grouping keys, held-out sites/devices/dates, preregistered metrics/thresholds |
| processing | Code/notebook revision, dependency lock/runtime, seed, preprocessing/feature extraction and model fitting |
| limitations | Domain mismatch, selection bias, sensor saturation/noise, license/consent limits and unsupported claims |

## Proposed canonical observation envelope

For reviewed exports use an explicitly versioned envelope, for example `schema_version: 1`, `dataset_id`, `sample_id`, `encounter_id`, `modality`, `source_kind`, `timestamp`, `clock_basis`, `instrument_id`, `instrument_config`, `units`, `observation`, `label`, `label_provenance`, `uncertainty`, `artifact_hash` and `split`. This paragraph is the conceptual envelope. The exact executable version-1 export uses `records.jsonl` and the manifest in `examples/finale-data-intake`, documented in `EVALUATION-RUNBOOK.md`; it is **not an application endpoint contract**. The manifest carries dataset/version, units, instrument configuration, label definition, artifact hashes and processing code; each record carries source kind, acquisition grouping, modality, relative time/clock basis, independent label provenance and truth-availability time. Missing observations are omitted; unlabelled reference labels are null. Document missing observation reasons in the source/limitations report; zero means an actual measured zero. Keep instrument observations separate from identity/intention labels and hidden target truth. A label created after an encounter must not be passed to a live evidence-only assistant.

Time is UTC where known; relative clocks must carry origin/synchronization accuracy. Coordinates state origin/frame and units. Frequencies are Hz, distances metres, angles degrees/radians explicitly declared, and power declares dBm/dBW/relative scale rather than guessing a reference. Thermal image counts are not temperatures unless radiometric calibration is supplied. No-RF labels require an actual acquisition/annotation basis; RF silence alone cannot establish fiber-control or hostility.

## Safe simulation integration

Approved real measurements may inform **new versioned parameter sets** for supported observation distributions: detection versus range/context, false alarms, confusion/uncertainty, latency and signal dropout. First reproduce measurement results offline, then propose a parameter change with confidence bounds/domain limits. Keep the existing frozen engine/scenario/selection receipts unchanged. Never refit legacy sessions or tune against the held-out test set to improve displayed metrics.

RGB/thermal object classification does not validate radar probability, hostile intent or tactical scoring. Radar detection curves do not establish target identity or human learning. RF recordings do not establish a multi-sensor fusion capability without matched encounters. Cross-modality fusion requires synchronized same-encounter measurements, registration and independent labels; unrelated datasets cannot be stitched into a fictitious paired test. Human usability can validate task comprehension/usability under the observed sample, not causally improved learning without an appropriate design.

An accepted parameter change requires a separate proposal/commit, units checks, boundary validation, fixed-seed TypeScript/Python parity, authoritative review/card equality where behavior should stay fixed, historical scorecard preservation and clean-source regression/build. Behavior-changing calibration must be explicitly versioned and evaluated on held-out real data; do not require equality to the old synthetic output for a intentionally changed new model. No real-data result is promoted into System Evidence until its report, hashes, provenance and reviewed claim scope are attached.

## Implemented evaluation boundary — 12 October 2026

The utilities verify local export hashes/units/grouping, bound held-out predictions, produce separate source-kind metrics and acquisition-cluster intervals, and validate unapplied versioned parameter proposals. `scripts/evaluate-study.py` provides participant-level parallel-arm outcome and descriptive independently observed advice analysis. Runnable examples and automated tests use generated interface fixtures exclusively. No measured dataset, public benchmark evaluation, hardware calibration or human result is newly supplied. A valid schema or `REAL_EXPORT_EVALUATED_UNREVIEWED` status does not independently authenticate the declared source or license.
