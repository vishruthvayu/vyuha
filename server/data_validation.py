"""Offline research intake/evaluation. Never changes live models or session history.

Validation checks an export's declared contract; it cannot authenticate acquisition,
license permission, calibration, independent labels or human consent by itself.
"""
from __future__ import annotations

import hashlib
import json
import math
import random
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

SOURCE_KINDS = {'real', 'synthetic', 'augmented_real'}
MODALITIES = {'rgb', 'thermal', 'radar', 'rf'}
UNITS = {'m', 'm/s', 's', 'Hz', 'dBm', 'dBW', 'deg', 'rad', 'K', 'C', 'pixel', 'count', 'relative', 'boolean'}
HEX = re.compile(r'^[a-f0-9]{64}$')
ID = re.compile(r'^[-A-Za-z0-9_.:]{1,128}$')
LIMITATION = 'Offline supplied-export evaluation only; no equipment calibration, hostile-intent inference, simultaneous sensor fusion or human training benefit is established.'


def _fail(message):
    raise ValueError(message)


def _object(value, required, optional=(), at='object'):
    if not isinstance(value, dict) or set(value) - set(required) - set(optional) or set(required) - set(value):
        _fail(f'{at}: missing or unknown fields')


def _text(value, at):
    if not isinstance(value, str) or not value.strip() or len(value) > 4096 or any(ord(c) < 32 for c in value):
        _fail(f'{at}: expected nonempty text without control characters')


def _id(value, at):
    if not isinstance(value, str) or not ID.fullmatch(value):
        _fail(f'{at}: invalid identifier')


def _number(value, at, lower=None, upper=None, integer=False):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or (lower is not None and value < lower) or (upper is not None and value > upper) or (integer and int(value) != value):
        _fail(f'{at}: invalid finite number')


def _hash(value, at):
    if not isinstance(value, str) or not HEX.fullmatch(value):
        _fail(f'{at}: expected lowercase SHA-256')


def read_json(path):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                _fail(f'Duplicate JSON key: {key}')
            result[key] = value
        return result
    return json.loads(Path(path).read_text(encoding='utf-8'), object_pairs_hook=unique,
                      parse_constant=lambda x: _fail(f'Non-finite JSON value: {x}'))


def _json_line(line):
    # Use the same strict parser without writing a temporary artifact.
    def unique(pairs):
        d = {}
        for k, v in pairs:
            if k in d:
                _fail(f'Duplicate JSON key: {k}')
            d[k] = v
        return d
    return json.loads(line, object_pairs_hook=unique, parse_constant=lambda x: _fail(f'Non-finite JSON value: {x}'))


def validate_manifest(manifest):
    _object(manifest, ['schema_version', 'dataset_id', 'version', 'source_kind', 'source', 'license',
                      'acquired_at', 'modality', 'instruments', 'units', 'label_schema', 'split',
                      'processing', 'artifacts', 'records_artifact', 'limitations', 'metric_plan'], at='manifest')
    if type(manifest['schema_version']) is not int or manifest['schema_version'] != 1:
        _fail('Unsupported manifest schema')
    for key in ['dataset_id', 'version']:
        _id(manifest[key], key)
    if manifest['source_kind'] not in SOURCE_KINDS | {'mixed'} or manifest['modality'] not in MODALITIES:
        _fail('Invalid source kind or modality; unmatched datasets cannot declare fused measurements')
    _object(manifest['source'], ['reference', 'owner', 'acquisition_procedure', 'transformations'], at='source')
    for key in ['reference', 'owner', 'acquisition_procedure']:
        _text(manifest['source'][key], f'source.{key}')
    if not isinstance(manifest['source']['transformations'], list):
        _fail('transformations must be an ordered list')
    for item in manifest['source']['transformations']:
        _text(item, 'transformation')
    _object(manifest['license'], ['name', 'version', 'reference', 'review_status', 'permitted_use', 'redistribution'], at='license')
    for key in ['name', 'version', 'reference', 'permitted_use', 'redistribution']:
        _text(manifest['license'][key], f'license.{key}')
    if manifest['license']['review_status'] not in {'pending', 'permitted', 'rejected'}:
        _fail('Invalid license review status')
    _text(manifest['acquired_at'], 'acquired_at')
    try:
        parsed = datetime.strptime(manifest['acquired_at'], '%Y-%m-%dT%H:%M:%SZ')
    except ValueError:
        _fail('acquired_at must be a valid UTC ISO date/time')
    if parsed.strftime('%Y-%m-%dT%H:%M:%SZ') != manifest['acquired_at']:
        _fail('acquired_at must use canonical UTC date/time')
    if not isinstance(manifest['instruments'], dict) or not manifest['instruments']:
        _fail('Instrument descriptions required')
    for key, instrument in manifest['instruments'].items():
        _id(key, 'instrument_id')
        _object(instrument, ['hardware_class', 'settings', 'calibration_status', 'calibration_reference'], at='instrument')
        for field in instrument:
            _text(instrument[field], f'instrument.{field}')
        if instrument['calibration_status'] not in {'unknown', 'uncalibrated', 'calibrated', 'not_applicable'}:
            _fail('Invalid calibration status')
    if not isinstance(manifest['units'], dict) or not manifest['units']:
        _fail('Observation unit map required')
    for key, unit in manifest['units'].items():
        _id(key, 'observation field')
        if unit not in UNITS:
            _fail(f'Unknown unit for {key}; convert explicitly before intake')
        if key.endswith('_s') and unit != 's' or key.endswith('_m') and unit != 'm' or key.endswith('_hz') and unit != 'Hz':
            _fail(f'Unit contradicts field suffix: {key}')
    _object(manifest['label_schema'], ['classes', 'meaning', 'origin', 'uncertainty_policy'], at='label_schema')
    classes = manifest['label_schema']['classes']
    if not isinstance(classes, list) or not all(isinstance(v, str) for v in classes) or len(classes) < 2 or len(classes) > 100 or len(set(classes)) != len(classes):
        _fail('At least two distinct classes required')
    for value in classes:
        _id(value, 'class')
    for key in ['meaning', 'origin', 'uncertainty_policy']:
        _text(manifest['label_schema'][key], f'label_schema.{key}')
    _object(manifest['split'], ['group_keys', 'recipe', 'locked_test_reference'], at='split')
    groups = manifest['split']['group_keys']
    if not isinstance(groups, list) or not {'recording_id', 'encounter_id'} <= set(groups) or set(groups) - {'recording_id', 'encounter_id', 'device_id', 'site_id'} or len(set(groups)) != len(groups):
        _fail('Split must be recording- and encounter-disjoint; additional device/site groups optional')
    for key in ['recipe', 'locked_test_reference']:
        _text(manifest['split'][key], f'split.{key}')
    _object(manifest['processing'], ['code_revision', 'dependency_lock_sha256', 'dependency_lock_artifact', 'runtime', 'seed', 'fitting_splits'], at='processing')
    if not isinstance(manifest['processing']['code_revision'], str) or not re.fullmatch(r'[a-f0-9]{40}', manifest['processing']['code_revision']):
        _fail('Full processing code revision required')
    _hash(manifest['processing']['dependency_lock_sha256'], 'dependency lock')
    _text(manifest['processing']['runtime'], 'processing runtime')
    _number(manifest['processing']['seed'], 'seed', 0, 2**32-1, True)
    fitting = manifest['processing']['fitting_splits']
    if not isinstance(fitting, list) or set(fitting) - {'train', 'validation'} or len(fitting) != len(set(fitting)):
        _fail('Fitting/preprocessing may not use held-out test')
    _object(manifest['metric_plan'], ['task', 'reference', 'bootstrap_seed', 'bootstrap_replicates', 'reliability_bins'], ['range_bins_m'], at='metric_plan')
    plan = manifest['metric_plan']
    if plan['task'] not in {'classification', 'detection'}:
        _fail('Unsupported metric task')
    _text(plan['reference'], 'preregistered metric plan reference')
    _number(plan['bootstrap_seed'], 'bootstrap seed', 0, 2**32-1, True)
    _number(plan['bootstrap_replicates'], 'bootstrap replicates', 100, 10000, True)
    _number(plan['reliability_bins'], 'reliability bins', 2, 50, True)
    if 'range_bins_m' in plan:
        bins = plan['range_bins_m']
        if not isinstance(bins, list) or not 2 <= len(bins) <= 51:
            _fail('Range bins require 2 to 51 finite boundaries')
        for boundary in bins:
            _number(boundary, 'range bin boundary', 0)
        if any(a >= b for a, b in zip(bins, bins[1:])) or manifest['units'].get('range_m') != 'm':
            _fail('Range bins must increase strictly and range_m must use metres')
    if not isinstance(manifest['limitations'], list) or not manifest['limitations']:
        _fail('Domain limitations required')
    for value in manifest['limitations']:
        _text(value, 'limitation')
    if not isinstance(manifest['artifacts'], list) or not manifest['artifacts']:
        _fail('Artifacts required')
    seen = set()
    for artifact in manifest['artifacts']:
        _object(artifact, ['path', 'bytes', 'sha256'], at='artifact')
        path = artifact['path']
        _text(path, 'artifact.path')
        if Path(path).is_absolute() or '..' in Path(path).parts or '\\' in path or path in seen:
            _fail('Artifact paths must be unique portable relative paths without traversal')
        seen.add(path)
        _number(artifact['bytes'], 'artifact bytes', 1, integer=True)
        _hash(artifact['sha256'], 'artifact sha256')
    if manifest['records_artifact'] not in seen:
        _fail('records_artifact must be a hashed artifact')
    lock = next((a for a in manifest['artifacts'] if a['path'] == manifest['processing']['dependency_lock_artifact']), None)
    if lock is None or lock['sha256'] != manifest['processing']['dependency_lock_sha256']:
        _fail('Dependency lock must be a hashed artifact matching processing declaration')
    return manifest


def validate_records(manifest, rows):
    if not rows:
        _fail('Empty record export')
    seen, groups, content = set(), {}, {}
    for row in rows:
        _object(row, ['sample_id', 'recording_id', 'encounter_id', 'device_id', 'site_id', 'instrument_id',
                      'split', 'source_kind', 'modality', 'timestamp_s', 'clock_basis', 'observation',
                      'label', 'label_provenance', 'truth_available_at_s', 'content_sha256', 'context'], at='record')
        for key in ['sample_id', 'recording_id', 'encounter_id', 'device_id', 'site_id', 'instrument_id']:
            _id(row[key], key)
        if row['sample_id'] in seen:
            _fail('Duplicate sample ID')
        seen.add(row['sample_id'])
        if row['split'] not in {'train', 'validation', 'test'} or row['source_kind'] not in SOURCE_KINDS or row['modality'] != manifest['modality']:
            _fail('Invalid record split/source/modality')
        if manifest['source_kind'] != 'mixed' and row['source_kind'] != manifest['source_kind']:
            _fail('Record source kind contradicts manifest')
        if row['instrument_id'] not in manifest['instruments']:
            _fail('Unknown instrument')
        _number(row['timestamp_s'], 'timestamp_s', 0)
        _number(row['truth_available_at_s'], 'truth_available_at_s', 0)
        _text(row['clock_basis'], 'clock basis with origin/synchronization limits')
        _text(row['label_provenance'], 'independent label provenance')
        if row['label'] is not None and row['label'] not in manifest['label_schema']['classes']:
            _fail('Unknown label; unlabelled/uncertain samples must use null')
        _hash(row['content_sha256'], 'sample content hash')
        if not isinstance(row['context'], dict) or not row['context']:
            _fail('Context metadata required, unknown values must be explicit')
        for key, value in row['context'].items():
            _id(key, 'context key')
            _text(value, 'context value')
        # Acquisition groups remain disjoint even if source kinds differ.
        for key in manifest['split']['group_keys']:
            group = (key, row[key])
            if group in groups and groups[group] != row['split']:
                _fail(f'Split leakage: {key}={row[key]} spans splits')
            groups[group] = row['split']
        digest = row['content_sha256']
        if digest in content and content[digest] != row['split']:
            _fail('Duplicate measurement content spans splits')
        content[digest] = row['split']
        observation = row['observation']
        if not isinstance(observation, dict) or not observation or set(observation) - set(manifest['units']):
            _fail('Observation fields require declared units')
        for key, value in observation.items():
            unit = manifest['units'][key]
            if value is None:
                _fail('Omit unavailable measurements; zero must mean measured zero')
            if unit == 'boolean':
                if type(value) is not bool:
                    _fail('Boolean observation must be a JSON boolean')
            else:
                _number(value, f'observation.{key}')
                if unit in {'m', 's', 'Hz', 'count', 'pixel', 'K'} and value < 0:
                    _fail('Physical observation outside nonnegative unit domain')
                if unit == 'C' and value < -273.15:
                    _fail('Temperature below absolute zero')
                if unit == 'count' and int(value) != value:
                    _fail('Counts must be integers')
        if manifest['modality'] == 'thermal' and any(manifest['units'][k] in {'K', 'C'} for k in observation):
            if manifest['instruments'][row['instrument_id']]['calibration_status'] != 'calibrated':
                _fail('Thermal temperature needs declared radiometric calibration; use pixel/count otherwise')
    if not any(row['split'] == 'test' for row in rows):
        _fail('Held-out test records required')
    return rows


def ingest(manifest_path):
    path = Path(manifest_path).resolve()
    manifest = validate_manifest(read_json(path))
    root = path.parent
    for artifact in manifest['artifacts']:
        target = (root / artifact['path']).resolve()
        if not target.is_relative_to(root) or not target.is_file():
            _fail('Artifact is absent or escapes manifest directory (including symlinks)')
        data = target.read_bytes()
        if len(data) != artifact['bytes'] or hashlib.sha256(data).hexdigest() != artifact['sha256']:
            _fail(f'Artifact integrity mismatch: {artifact["path"]}')
    lines = (root / manifest['records_artifact']).read_text(encoding='utf-8').splitlines()
    rows = validate_records(manifest, [_json_line(line) for line in lines if line.strip()])
    return manifest, rows, hashlib.sha256(path.read_bytes()).hexdigest()


def validate_predictions(manifest, records, predictions):
    test = {row['sample_id']: row for row in records if row['split'] == 'test'}
    seen = set()
    task = manifest['metric_plan']['task']
    classes = manifest['label_schema']['classes']
    for row in predictions:
        required = ['sample_id', 'probabilities'] if task == 'classification' else ['sample_id', 'detected', 'false_alarm_count', 'negative_exposure_s']
        _object(row, required, at='prediction')
        if row['sample_id'] not in test or row['sample_id'] in seen:
            _fail('Predictions must bind uniquely to held-out sample IDs')
        seen.add(row['sample_id'])
        if task == 'classification':
            values = row['probabilities']
            if values is not None:
                if not isinstance(values, dict) or set(values) != set(classes):
                    _fail('Prediction must cover exactly the declared classes; null means abstain')
                for v in values.values():
                    _number(v, 'probability', 0, 1)
                if abs(sum(values.values()) - 1) > 1e-6:
                    _fail('Probabilities must sum to one')
        else:
            if type(row['detected']) is not bool:
                _fail('detected must be boolean')
            _number(row['false_alarm_count'], 'false alarm count', 0, integer=True)
            _number(row['negative_exposure_s'], 'negative exposure', 0)
            truth = test[row['sample_id']]['observation'].get('target_present')
            if type(truth) is not bool or manifest['units'].get('target_present') != 'boolean':
                _fail('Detection requires independently measured target_present boolean')
            if truth and (row['false_alarm_count'] != 0 or row['negative_exposure_s'] != 0):
                _fail('Positive sample cannot contribute negative exposure or false alarms')
            if not truth:
                measured_exposure = test[row['sample_id']]['observation'].get('exposure_s')
                if manifest['units'].get('exposure_s') != 's' or isinstance(measured_exposure, bool) or not isinstance(measured_exposure, (int, float)) or not math.isfinite(measured_exposure) or measured_exposure <= 0 or row['negative_exposure_s'] != measured_exposure:
                    _fail('Negative exposure denominator must equal recorded exposure_s in seconds')
            if not truth and row['detected'] != (row['false_alarm_count'] > 0):
                _fail('Negative detection flag contradicts false alarm count')
    if seen != set(test):
        _fail('Prediction coverage must include all test samples, including abstentions and unknowns')
    return [(test[p['sample_id']], p) for p in predictions]


def _classification(pairs, classes, bins):
    labelled = [(r, p) for r, p in pairs if r['label'] is not None]
    scored = [(r, p) for r, p in labelled if p['probabilities'] is not None]
    confusion = {label: {other: 0 for other in classes + ['abstain']} for label in classes}
    correct, brier, loss = 0, [], []
    buckets = [[] for _ in range(bins)]
    for r, p in labelled:
        probs = p['probabilities']
        if probs is None:
            confusion[r['label']]['abstain'] += 1
            continue
        predicted = max(classes, key=lambda key: probs[key])  # stable class-order ties
        hit = int(predicted == r['label'])
        correct += hit
        confusion[r['label']][predicted] += 1
        brier.append(sum((probs[k] - int(k == r['label']))**2 for k in classes))
        loss.append(-math.log(max(1e-15, probs[r['label']])))
        confidence = probs[predicted]
        buckets[min(bins - 1, int(confidence*bins))].append((confidence, hit))
    reliability = [dict(lower=i/bins, upper=(i+1)/bins, count=len(b), mean_confidence=sum(c for c, _ in b)/len(b) if b else None, accuracy=sum(h for _, h in b)/len(b) if b else None) for i, b in enumerate(buckets)]
    support = {k: sum(confusion[k].values()) for k in classes}
    f1 = []
    for key in classes:
        tp = confusion[key][key]
        fn = support[key]-tp
        fp = sum(confusion[k][key] for k in classes if k != key)
        f1.append(2*tp/(2*tp+fn+fp) if 2*tp+fn+fp else None)
    mean = lambda values: sum(values)/len(values) if values else None
    return dict(test_samples=len(pairs), labelled_samples=len(labelled), unknown_labels=len(pairs)-len(labelled), predicted_labelled_samples=len(scored), abstentions=len(labelled)-len(scored), coverage=len(scored)/len(labelled) if labelled else None, accuracy=correct/len(labelled) if labelled else None, conditional_accuracy=correct/len(scored) if scored else None, macro_f1=mean([v for v in f1 if v is not None]), class_support=support, confusion=confusion, brier=mean(brier), log_loss=mean(loss), expected_calibration_error=sum(len(b)/len(scored)*abs(sum(c for c, _ in b)/len(b)-sum(h for _, h in b)/len(b)) for b in buckets if b) if scored else None, reliability=reliability)


def _detection(pairs):
    positives = [(r, p) for r, p in pairs if r['observation']['target_present']]
    negatives = [(r, p) for r, p in pairs if not r['observation']['target_present']]
    detected = sum(p['detected'] for _, p in positives)
    false = sum(p['false_alarm_count'] for _, p in negatives)
    exposure = sum(p['negative_exposure_s'] for _, p in negatives)
    return dict(test_samples=len(pairs), positive_samples=len(positives), negative_samples=len(negatives), detected_positives=detected, detection_probability=detected/len(positives) if positives else None, false_alarm_count=false, negative_exposure_s=exposure, false_alarms_per_hour=false/exposure*3600 if exposure else None, false_positive_sample_rate=sum(p['detected'] for _, p in negatives)/len(negatives) if negatives else None)


def _percentile(values, fraction):
    values = sorted(values)
    index = (len(values)-1)*fraction
    left = int(index)
    right = min(left+1, len(values)-1)
    return values[left] + (values[right]-values[left])*(index-left)


def evaluate(manifest, records, predictions, manifest_sha256, predictions_sha256):
    validate_manifest(manifest)
    validate_records(manifest, records)
    _hash(manifest_sha256, 'manifest_sha256')
    _hash(predictions_sha256, 'predictions_sha256')
    if manifest['license']['review_status'] != 'permitted':
        _fail('Evaluation quarantined until declared rights review permits this use')
    pairs = validate_predictions(manifest, records, predictions)
    plan = manifest['metric_plan']
    metric = (lambda rows: _classification(rows, manifest['label_schema']['classes'], plan['reliability_bins'])) if plan['task'] == 'classification' else _detection
    interval_keys = ['accuracy', 'macro_f1', 'brier', 'log_loss', 'expected_calibration_error'] if plan['task'] == 'classification' else ['detection_probability', 'false_alarms_per_hour', 'false_positive_sample_rate']
    strata = {}
    for source in sorted(SOURCE_KINDS):
        subset = [(r, p) for r, p in pairs if r['source_kind'] == source]
        if not subset:
            continue
        # Any shared recording OR encounter links measurements into one cluster.
        # This prevents treating multiple clips of the same encounter as independent.
        parent = {}
        def find(key):
            parent.setdefault(key, key)
            if parent[key] != key:
                parent[key] = find(parent[key])
            return parent[key]
        for r, _ in subset:
            recording, encounter = ('recording', r['recording_id']), ('encounter', r['encounter_id'])
            a, b = find(recording), find(encounter)
            parent[max(a, b)] = min(a, b)
        by_cluster = defaultdict(list)
        for r, p in subset:
            by_cluster[find(('recording', r['recording_id']))].append((r, p))
        keys = sorted(by_cluster)
        samples = {key: [] for key in interval_keys}
        if len(keys) >= 2:
            rng = random.Random(plan['bootstrap_seed'])
            for _ in range(plan['bootstrap_replicates']):
                resampled = [pair for _ in keys for pair in by_cluster[rng.choice(keys)]]
                scores = metric(resampled)
                for key in interval_keys:
                    if scores[key] is not None:
                        samples[key].append(scores[key])
        intervals = {key: dict(interval_95=[_percentile(values, .025), _percentile(values, .975)] if len(values) >= 100 else None, valid_replicates=len(values)) for key, values in samples.items()}
        contexts = defaultdict(list)
        for record, prediction in subset:
            contexts[json.dumps(record['context'], sort_keys=True, separators=(',', ':'))].append((record, prediction))
        context_metrics = [dict(context=json.loads(key), metrics=metric(values), recording_count=len({r['recording_id'] for r, _ in values})) for key, values in sorted(contexts.items())]
        range_metrics = []
        if 'range_bins_m' in plan:
            boundaries = plan['range_bins_m']
            in_range = 0
            for index, (low, high) in enumerate(zip(boundaries, boundaries[1:])):
                values = [(r, p) for r, p in subset if 'range_m' in r['observation'] and low <= r['observation']['range_m'] and (r['observation']['range_m'] < high or index == len(boundaries)-2 and r['observation']['range_m'] == high)]
                in_range += len(values)
                range_metrics.append(dict(lower_m=low, upper_m=high, right_boundary_included=index == len(boundaries)-2, metrics=metric(values)))
            range_metrics.append(dict(outside_or_missing_range_samples=len(subset)-in_range))
        strata[source] = dict(metrics=metric(subset), context_metrics=context_metrics, range_metrics=range_metrics, recording_count=len({r['recording_id'] for r, _ in subset}), encounter_count=len({r['encounter_id'] for r, _ in subset}), independent_acquisition_clusters=len(keys), intervals=intervals, interval_method='Seeded recording/encounter connected-cluster percentile bootstrap; null when fewer than 2 clusters or fewer than 100 valid resamples', interval_limit='Assumes independent acquisition clusters; selection bias/domain transfer and reused sites/devices are not captured')
    return dict(schema_version=1, evaluator=dict(module_sha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), runtime=sys.version), dataset_id=manifest['dataset_id'], dataset_version=manifest['version'], manifest_sha256=manifest_sha256, predictions_sha256=predictions_sha256, processing=manifest['processing'], metric_plan=plan, modality=manifest['modality'], strata=strata, source_counts=dict(Counter(r['source_kind'] for r in records)), split_counts=dict(Counter(r['split'] for r in records)), evidence_status='REAL_EXPORT_EVALUATED_UNREVIEWED' if 'real' in strata else 'SYNTHETIC_INTERFACE_EVALUATED' if set(strata) == {'synthetic'} else 'AUGMENTED_EXPORT_EVALUATED_UNREVIEWED', limitation=LIMITATION, domain_limitations=manifest['limitations'], promotion='No application writes or audit promotion. Independent provenance/rights/reproduction review required.')


def validate_parameter_proposal(proposal, manifest, report):
    """Validate a review proposal, never apply it to physics or stored scenarios."""
    _object(proposal, ['schema_version', 'dataset_id', 'dataset_version', 'manifest_sha256', 'report_sha256', 'new_parameter_version', 'supersedes_version', 'modality', 'parameters', 'domain', 'unsupported_claims', 'review_status'], at='proposal')
    if type(proposal['schema_version']) is not int or proposal['schema_version'] != 1:
        _fail('Unsupported proposal schema')
    if proposal['dataset_id'] != manifest['dataset_id'] or proposal['dataset_version'] != manifest['version'] or proposal['manifest_sha256'] != report['manifest_sha256'] or proposal['modality'] != manifest['modality']:
        _fail('Proposal dataset/modality/hash mismatch')
    for key in ['manifest_sha256', 'report_sha256']:
        _hash(proposal[key], key)
    if report.get('dataset_id') != manifest['dataset_id'] or report.get('dataset_version') != manifest['version']:
        _fail('Proposal evaluation identity mismatch')
    report_digest = hashlib.sha256((json.dumps(report, indent=2, sort_keys=True, allow_nan=False)+'\n').encode()).hexdigest()
    if proposal['report_sha256'] != report_digest:
        _fail('Proposal report hash does not match evaluation')
    for key in ['new_parameter_version', 'supersedes_version']:
        _id(proposal[key], key)
    if proposal['new_parameter_version'] == proposal['supersedes_version'] or proposal['review_status'] != 'proposed':
        _fail('Proposal requires a new version and proposed review status')
    if not isinstance(proposal['domain'], str) or not proposal['domain'].strip() or not isinstance(proposal['unsupported_claims'], list) or not proposal['unsupported_claims']:
        _fail('Domain and unsupported claims required')
    if not isinstance(proposal['parameters'], list) or not proposal['parameters']:
        _fail('Parameters required')
    allowed = {'detection_probability': 'relative', 'false_alarms_per_hour': 'count/hour', 'latency_s': 's', 'dropout_probability': 'relative'}
    seen = set()
    for parameter in proposal['parameters']:
        _object(parameter, ['name', 'value', 'unit', 'interval_95', 'supporting_split', 'source_kind', 'evidence_reference'], at='parameter')
        name = parameter['name']
        if name not in allowed or name in seen or parameter['unit'] != allowed[name] or parameter['supporting_split'] not in {'train', 'validation'} or parameter['source_kind'] != 'real' or 'real' not in report['strata']:
            _fail('Invalid parameter, unit or real-data fitting source; test cannot fit parameters')
        seen.add(name)
        _number(parameter['value'], 'parameter value', 0, 1 if name.endswith('probability') else None)
        interval = parameter['interval_95']
        if not isinstance(interval, list) or len(interval) != 2:
            _fail('Parameter interval required')
        for value in interval:
            _number(value, 'interval bound', 0, 1 if name.endswith('probability') else None)
        if not interval[0] <= parameter['value'] <= interval[1]:
            _fail('Parameter must lie within its ordered interval')
        _text(parameter['evidence_reference'], 'training/validation estimate reference')
    return dict(status='VALID_PROPOSAL_UNREVIEWED', writes_to_model=False, limitation='Declared proposal consistency only; estimates and domain must be independently reproduced before a versioned implementation.')
