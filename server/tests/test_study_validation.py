"""Synthetic instrument fixtures; these tests do not involve participants."""
import copy
import hashlib
import json
import subprocess
import sys
from pathlib import Path

import pytest
from server.study_validation import evaluate_study


def fixture():
    manifest=dict(schema_version=1,study_id='STUDY-INTERFACE-FIXTURE',version='1',source_kind='synthetic',design='parallel_assigned',ethics_reference='No participants; synthetic fixture',consent_status='not_applicable',consent_reference='No participants',preregistration_reference='Fixture planned analysis',assignment_reference='Fixture assignment',scoring_reference='Generated fixture correctness',source_revision='a'*40,bootstrap_seed=1,bootstrap_replicates=100,limitations=['Synthetic interface only; no human learning result'])
    trials=[]
    for i in range(4):
        for phase in ['baseline','post','retention']:
            trials.append(dict(participant_id=f'P{i}',session_id=f'P{i}-{phase}',condition='control' if i<2 else 'adaptive',phase=phase,task_id=f'{phase}-task',context='fixture-day',task_correct=phase != 'baseline' and i>=2,completion_s=10))
    return manifest,trials


def report(m,t):
    return evaluate_study(m,t,'b'*64,'c'*64)


def test_paired_participant_intervals_and_unchanged_inputs():
    m,t=fixture();before=copy.deepcopy((m,t));result=report(m,t)
    assert result==report(m,t) and (m,t)==before
    assert result['evidence_status']=='SYNTHETIC_STUDY_INTERFACE_TESTED'
    assert result['contrasts']['post']['adaptive_minus_control_change']==1
    assert result['contrasts']['post']['interval_95']==[1,1]
    assert result['arms']['adaptive']['participants']==2


def test_missing_followups_are_explicit_and_small_samples_have_no_interval():
    m,t=fixture();t=[r for r in t if not (r['participant_id']=='P3' and r['phase'] in {'post','retention'})]
    result=report(m,t)
    assert result['contrasts']['post']['missing_paired_participants']['adaptive']==1
    assert result['contrasts']['post']['interval_95'] is None


@pytest.mark.parametrize('mutation',[
    lambda m,t:m.update(source_kind='human'),
    lambda m,t:m.update(source_revision='short'),
    lambda m,t:t.append(copy.deepcopy(t[0])),
    lambda m,t:t[-1].update(condition='control'),
    lambda m,t:t[-1].update(task_correct=1),
    lambda m,t:t[-1].update(completion_s=-1),
    lambda m,t:t[-1].update(task_id='different-test'),
    lambda m,t:t[-1].update(session_id=t[0]['session_id']),
])
def test_rejects_invalid_human_declaration_and_study_leakage(mutation):
    m,t=fixture();mutation(m,t)
    with pytest.raises(ValueError):report(m,t)


def test_correct_and_incorrect_advice_remain_descriptive_with_viewing_boundary():
    m,t=fixture()
    t[0]['advice']=dict(reference_label='drone',initial_label='drone',recommendation='bird',final_label='bird',viewing_basis='independently_observed',viewing_reference='Synthetic fixture observer')
    t[1]['advice']=dict(reference_label='drone',initial_label='bird',recommendation='drone',final_label='bird',viewing_basis='self_report',viewing_reference='Synthetic self report')
    result=report(m,t)['advice_descriptive_counts']
    assert result['verified_trials']==1 and result['unverified_trials']==1
    assert result['followed_incorrect']==1 and result['worsened']==1
    assert result['rejected_correct']==0  # unverified viewing excluded
    t[0]['task_correct']=True
    with pytest.raises(ValueError,match='contradicts'):report(m,t)


def test_cli_report_and_no_input_overwrite(tmp_path):
    m,t=fixture();manifest=tmp_path/'manifest.json';trials=tmp_path/'trials.jsonl';out=tmp_path/'report.json'
    manifest.write_text(json.dumps(m));trials.write_text(''.join(json.dumps(r)+'\n' for r in t))
    cli=Path(__file__).resolve().parents[2]/'scripts/evaluate-study.py'
    cmd=[sys.executable,str(cli),'--manifest',str(manifest),'--trials',str(trials),'--output',str(out)]
    result=subprocess.run(cmd,text=True,capture_output=True)
    assert result.returncode==0,result.stderr
    report=json.loads(out.read_text());assert report['trials_sha256']==hashlib.sha256(trials.read_bytes()).hexdigest()
    result=subprocess.run(cmd[:-1]+[str(manifest)],text=True,capture_output=True)
    assert result.returncode==2 and 'overwrite' in result.stderr
