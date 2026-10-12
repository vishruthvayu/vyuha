"""All generated samples are interface fixtures, never real measurement evidence."""
import copy
import hashlib
import json
import subprocess
import sys
from pathlib import Path

import pytest

from server.data_validation import (ingest, evaluate, validate_manifest,
                                    validate_records, validate_predictions,
                                    validate_parameter_proposal, read_json)


def fixture(source='synthetic', task='classification'):
    manifest = dict(schema_version=1, dataset_id='INTERFACE-FIXTURE', version='1', source_kind=source,
                    source=dict(reference='local synthetic fixture', owner='VYUHA tests', acquisition_procedure='Generated interface values; no physical sensor', transformations=[]),
                    license=dict(name='Test fixture', version='1', reference='generated locally', review_status='permitted', permitted_use='Interface testing', redistribution='test fixture only'),
                    acquired_at='2026-10-12T00:00:00Z', modality='radar',
                    instruments=dict(fixture=dict(hardware_class='No physical hardware', settings='test values', calibration_status='not_applicable', calibration_reference='No measured calibration')),
                    units=dict(range_m='m', target_present='boolean', exposure_s='s'),
                    label_schema=dict(classes=['drone', 'background'], meaning='Interface class names only', origin='Generated fixture', uncertainty_policy='null label excludes unknown from supervised metrics'),
                    split=dict(group_keys=['recording_id', 'encounter_id'], recipe='distinct fixture groups', locked_test_reference='fixture split v1'),
                    processing=dict(code_revision='a'*40, dependency_lock_sha256='b'*64, dependency_lock_artifact='dependencies.lock.txt', runtime='Python standard-library fixture', seed=42, fitting_splits=['train']),
                    metric_plan=dict(task=task, reference='test preregistration', bootstrap_seed=41, bootstrap_replicates=100, reliability_bins=5),
                    artifacts=[dict(path='records.jsonl', bytes=1, sha256='c'*64), dict(path='dependencies.lock.txt', bytes=1, sha256='b'*64)], records_artifact='records.jsonl', limitations=['Synthetic interface values; no empirical claim'])
    rows = []
    for index in range(8):
        split = ['train', 'validation', 'test', 'test'][index//2]
        target = index % 2 == 0
        rows.append(dict(sample_id=f's{index}', recording_id=f'r{index//2}', encounter_id=f'e{index//2}', device_id='fixture', site_id='fixture', instrument_id='fixture', split=split, source_kind=source, modality='radar', timestamp_s=index, clock_basis='fixture relative origin 0', observation=dict(range_m=index*100, target_present=target, exposure_s=60), label='drone' if target else 'background', label_provenance='generated fixture reference', truth_available_at_s=index+1, context=dict(lighting='synthetic-day',weather='synthetic-clear'), content_sha256=hashlib.sha256(f'fixture-{index}'.encode()).hexdigest()))
    if task == 'classification':
        predictions = [dict(sample_id=row['sample_id'], probabilities={'drone': .8 if row['label']=='drone' else .2, 'background': .2 if row['label']=='drone' else .8}) for row in rows if row['split']=='test']
    else:
        predictions = [dict(sample_id=row['sample_id'], detected=row['observation']['target_present'], false_alarm_count=0, negative_exposure_s=0 if row['observation']['target_present'] else 60) for row in rows if row['split']=='test']
    return manifest, rows, predictions


def export(tmp_path, manifest, rows):
    raw = ''.join(json.dumps(row, sort_keys=True)+'\n' for row in rows).encode()
    (tmp_path/'records.jsonl').write_bytes(raw)
    lock=b'Interface fixture: no external dependencies\n'
    (tmp_path/'dependencies.lock.txt').write_bytes(lock)
    manifest['artifacts'][1].update(bytes=len(lock), sha256=hashlib.sha256(lock).hexdigest())
    manifest['processing']['dependency_lock_sha256']=hashlib.sha256(lock).hexdigest()
    manifest['artifacts'][0].update(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())
    path = tmp_path/'manifest.json'
    path.write_text(json.dumps(manifest, sort_keys=True))
    return path


def test_intake_hashes_and_no_model_write(tmp_path):
    m, rows, _ = fixture()
    path = export(tmp_path, m, rows)
    manifest, received, digest = ingest(path)
    assert manifest == m and received == rows
    assert digest == hashlib.sha256(path.read_bytes()).hexdigest()
    (tmp_path/'records.jsonl').write_text('modified')
    with pytest.raises(ValueError, match='integrity'):
        ingest(path)


@pytest.mark.parametrize('key', ['recording_id', 'encounter_id'])
def test_recording_and_encounter_leakage(key):
    m, rows, _ = fixture()
    rows[-1][key] = rows[0][key]
    with pytest.raises(ValueError, match='leakage'):
        validate_records(m, rows)


def test_optional_device_and_site_holdout():
    m, rows, _ = fixture()
    m['split']['group_keys'] += ['device_id']
    with pytest.raises(ValueError, match='device_id'):
        validate_records(m, rows)


def test_duplicate_content_leakage():
    m, rows, _ = fixture()
    rows[-1]['content_sha256'] = rows[0]['content_sha256']
    with pytest.raises(ValueError, match='content spans'):
        validate_records(m, rows)


@pytest.mark.parametrize('mutation', [
    lambda m: m.update(extra=True), lambda m: m.update(schema_version=True),
    lambda m: m['processing'].update(fitting_splits=['test']),
    lambda m: m['processing'].update(seed=True),
    lambda m: m['units'].update(range_m='km'),
    lambda m: m['units'].update(range_m='s'),
    lambda m: m['label_schema'].update(classes=['same', 'same']),
    lambda m: m['split'].update(group_keys=['sample_id']),
    lambda m: m['artifacts'][0].update(path='../outside'),
    lambda m: m['artifacts'][0].update(path='/tmp/outside'),
    lambda m: m['artifacts'][0].update(sha256='bad'),
    lambda m: m.update(modality='fusion'),
])
def test_manifest_rejects_ambiguous_or_unsafe_contract(mutation):
    m, _, _ = fixture()
    mutation(m)
    with pytest.raises(ValueError):
        validate_manifest(m)


@pytest.mark.parametrize('mutation', [
    lambda r: r.update(sample_id='bad id'), lambda r: r.update(source_kind='real'),
    lambda r: r.update(label='hostile'), lambda r: r.update(instrument_id='missing'),
    lambda r: r.update(timestamp_s=float('nan')),
    lambda r: r['observation'].update(range_m=None),
    lambda r: r['observation'].update(range_m=-1),
    lambda r: r['observation'].update(secret_truth=4),
    lambda r: r['observation'].update(target_present=1),
])
def test_record_contract(mutation):
    m, rows, _ = fixture()
    mutation(rows[-1])
    with pytest.raises(ValueError):
        validate_records(m, rows)


def test_thermal_counts_are_not_uncalibrated_temperature():
    m, rows, _ = fixture()
    m['modality']='thermal'
    m['units']['temperature']='K'
    for r in rows:
        r['modality']='thermal'
        r['observation']['temperature']=300
    with pytest.raises(ValueError, match='radiometric'):
        validate_records(m, rows)
    m['units']['temperature']='count'
    validate_records(m, rows)


def test_symlink_escape(tmp_path):
    m, rows, _ = fixture()
    path = export(tmp_path, m, rows)
    outside = tmp_path.parent/'outside-records.jsonl'
    outside.write_bytes((tmp_path/'records.jsonl').read_bytes())
    (tmp_path/'records.jsonl').unlink()
    (tmp_path/'records.jsonl').symlink_to(outside)
    with pytest.raises(ValueError, match='escapes'):
        ingest(path)


def test_json_duplicate_keys_and_nonfinite_rejected(tmp_path):
    path = tmp_path/'bad.json'
    path.write_text('{"x":1,"x":2}')
    with pytest.raises(ValueError, match='Duplicate'):
        read_json(path)
    path.write_text('{"x":NaN}')
    with pytest.raises(ValueError, match='Non-finite'):
        read_json(path)


def test_classification_denominators_proper_scores_and_reproducibility():
    m, rows, p = fixture()
    before = copy.deepcopy((m, rows, p))
    result = evaluate(m, rows, p, 'a'*64, 'b'*64)
    assert result == evaluate(m, rows, p, 'a'*64, 'b'*64)
    assert (m, rows, p) == before
    assert result['evidence_status']=='SYNTHETIC_INTERFACE_EVALUATED'
    metrics = result['strata']['synthetic']['metrics']
    assert metrics['accuracy']==1 and metrics['coverage']==1
    assert metrics['brier']==pytest.approx(.08)
    assert metrics['log_loss']==pytest.approx(-__import__('math').log(.8))
    assert metrics['expected_calibration_error']==pytest.approx(.2)
    assert sum(x['count'] for x in metrics['reliability'])==4
    assert result['strata']['synthetic']['intervals']['accuracy']['interval_95']==[1, 1]


def test_abstention_unknown_labels_and_no_fake_single_recording_interval():
    m, rows, p = fixture()
    rows[-1]['label']=None
    p[0]['probabilities']=None
    for row in rows[4:]:
        row['recording_id']='one-test-recording'
    result = evaluate(m, rows, p, 'a'*64, 'b'*64)['strata']['synthetic']
    assert result['metrics']['labelled_samples']==3
    assert result['metrics']['unknown_labels']==1
    assert result['metrics']['abstentions']==1
    assert result['metrics']['accuracy']==pytest.approx(2/3)
    assert all(row['interval_95'] is None for row in result['intervals'].values())


@pytest.mark.parametrize('mutation', [
    lambda p: p.pop(), lambda p: p.append(copy.deepcopy(p[0])),
    lambda p: p[0].update(sample_id='s0'),
    lambda p: p[0].update(probabilities={'drone':.9, 'background':.9}),
    lambda p: p[0].update(probabilities={'drone':True, 'background':0}),
    lambda p: p[0].update(probabilities={'drone':1}),
])
def test_prediction_binding_and_distributions(mutation):
    m, rows, p=fixture()
    mutation(p)
    with pytest.raises(ValueError):
        validate_predictions(m, rows, p)


def test_mixed_results_are_separate_and_rights_pending_quarantines():
    m, rows, p=fixture()
    m['source_kind']='mixed'
    for r in rows[4:6]:
        r['source_kind']='real'  # schema-path fixture, not acquired data
    result=evaluate(m, rows, p, 'a'*64, 'b'*64)
    assert set(result['strata'])=={'real','synthetic'}
    assert all(s['metrics']['test_samples']==2 for s in result['strata'].values())
    assert result['evidence_status']=='REAL_EXPORT_EVALUATED_UNREVIEWED'
    m['license']['review_status']='pending'
    with pytest.raises(ValueError, match='rights'):
        evaluate(m, rows, p, 'a'*64, 'b'*64)


def test_detection_requires_real_denominators():
    m, rows, p=fixture(task='detection')
    p[1].update(detected=True, false_alarm_count=2)
    result=evaluate(m, rows, p, 'a'*64, 'b'*64)['strata']['synthetic']['metrics']
    assert result['positive_samples']==2 and result['negative_samples']==2
    assert result['detection_probability']==1
    assert result['negative_exposure_s']==120
    assert result['false_alarms_per_hour']==60
    p[1]['negative_exposure_s']=0
    with pytest.raises(ValueError, match='exposure'):
        validate_predictions(m, rows, p)


def test_parameter_proposal_is_never_a_model_write():
    m, rows, p=fixture(source='real')  # synthetic objects exercise real-path checks
    report=evaluate(m, rows, p, 'a'*64, 'b'*64)
    proposal=dict(schema_version=1,dataset_id=m['dataset_id'],dataset_version='1',manifest_sha256='a'*64,report_sha256='c'*64,new_parameter_version='research-2',supersedes_version='research-1',modality='radar',parameters=[dict(name='detection_probability',value=.7,unit='relative',interval_95=[.6,.8],supporting_split='train',source_kind='real',evidence_reference='fixture training estimate; not real')],domain='fixture only',unsupported_claims=['No real calibration'],review_status='proposed')
    proposal['report_sha256']=hashlib.sha256((json.dumps(report,indent=2,sort_keys=True,allow_nan=False)+'\n').encode()).hexdigest()
    before=copy.deepcopy((proposal,m,report))
    assert validate_parameter_proposal(proposal,m,report)['writes_to_model'] is False
    assert (proposal,m,report)==before
    proposal['parameters'][0]['supporting_split']='test'
    with pytest.raises(ValueError, match='test cannot fit'):
        validate_parameter_proposal(proposal,m,report)


def test_cli_outputs_reviewable_report_and_prevents_overwrite(tmp_path):
    m, rows, predictions=fixture()
    path=export(tmp_path,m,rows)
    p=tmp_path/'predictions.jsonl'
    p.write_text(''.join(json.dumps(row)+'\n' for row in predictions))
    cli=Path(__file__).resolve().parents[2]/'scripts/evaluate-real-data.py'
    command=[sys.executable,str(cli),'--manifest',str(path),'--predictions',str(p),'--output',str(tmp_path/'report.json')]
    result=subprocess.run(command,text=True,capture_output=True)
    assert result.returncode==0, result.stderr
    assert read_json(tmp_path/'report.json')['evidence_status']=='SYNTHETIC_INTERFACE_EVALUATED'
    result=subprocess.run(command[:-1]+[str(path)],text=True,capture_output=True)
    assert result.returncode==2 and 'overwrite' in result.stderr


def test_context_and_preregistered_range_denominators():
    m, rows, p=fixture(task='detection')
    m['metric_plan']['range_bins_m']=[0,500,600]
    rows[-1]['context']['lighting']='synthetic-night'
    result=evaluate(m,rows,p,'a'*64,'b'*64)['strata']['synthetic']
    assert len(result['context_metrics'])==2
    assert [r['metrics']['test_samples'] for r in result['range_metrics'][:-1]]==[1,2]
    assert result['range_metrics'][-1]['outside_or_missing_range_samples']==1
    assert result['range_metrics'][0]['metrics']['negative_exposure_s']==0
    assert result['range_metrics'][0]['metrics']['false_alarms_per_hour'] is None
    m['metric_plan']['range_bins_m']=[0,500,500]
    with pytest.raises(ValueError,match='strictly'):validate_manifest(m)


def test_false_alarm_denominator_cannot_be_invented():
    m, rows, p=fixture(task='detection')
    p[1]['negative_exposure_s']=6000
    with pytest.raises(ValueError,match='recorded exposure'):validate_predictions(m,rows,p)


def test_related_recordings_cluster_by_encounter():
    m, rows, p=fixture()
    rows[-1]['encounter_id']=rows[4]['encounter_id']
    rows[-2]['encounter_id']=rows[4]['encounter_id']
    result=evaluate(m,rows,p,'a'*64,'b'*64)['strata']['synthetic']
    assert result['recording_count']==2
    assert result['independent_acquisition_clusters']==1
    assert result['intervals']['accuracy']['interval_95'] is None

def test_raw_artifact_digest_streams_instead_of_materializing_recording(tmp_path,monkeypatch):
    from server.data_validation import artifact_digest
    data=b'bounded-recording-chunk'*100000
    path=tmp_path/'raw.bin';path.write_bytes(data)
    def forbidden(*args,**kwargs):raise AssertionError('Raw recordings must not use read_bytes')
    monkeypatch.setattr(Path,'read_bytes',forbidden)
    assert artifact_digest(path)==(len(data),hashlib.sha256(data).hexdigest())
