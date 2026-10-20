"""Procedural selection, frozen owner isolation and read-only evidence contracts."""
import copy
import json
import pytest
from server import storage
from server.director import SKILLS
from server.director_v2 import snapshot, select_policy, owner_binding, DirectorV2Metadata
from server.portable import validate_snapshot_v2, export_scenario
from server.raid_v2 import raid_id
from server.tests.test_api import client


def prepared(client, trainee='PROC-A', seed=92, duration=60):
    r=client.post('/api/v1/director-v2/prepare', json=dict(trainee=trainee,seed=seed,duration=duration))
    assert r.status_code==200,r.text
    return r.json()


def profiles():
    with storage.connect() as db:
        return [list(db.execute('SELECT * FROM '+t)) for t in ['skill_profiles','skill_outcomes','director_history']]


@pytest.mark.parametrize('duration',[60,90,120,180])
def test_preparation_is_repeatable_frozen_and_does_not_create_profile_evidence(client,duration):
    before=profiles()
    a=prepared(client,duration=duration)
    assert prepared(client,duration=duration)==a
    assert profiles()==before
    assert a['engine_version']=='vyuha-0.4.0' and a['duration']==duration
    validate_snapshot_v2(a)
    assert a['id']==raid_id(a)
    meta=a['director_v2']
    assert meta['selection_snapshot']['sessions']==0
    assert 'trainee' not in meta['selection_snapshot']
    assert meta['family']==a['raid']['family']
    assert all(s['updated_at'] is None and s['last_session_id'] is None for s in meta['selection_snapshot']['skills'].values())


def test_equal_prior_owners_do_not_share_a_frozen_scenario(client):
    a,b=prepared(client,'PROC-A'),prepared(client,'PROC-B')
    assert a['director_v2']['raw_samples']==b['director_v2']['raw_samples']
    assert a['tracks']==b['tracks']
    assert a['id']!=b['id'] and a['director_v2']['owner_binding']!=b['director_v2']['owner_binding']
    for scenario,owner in [(a,'PROC-A'),(b,'PROC-B')]:
        assert client.post('/api/v1/sessions',json={'scenario_id':scenario['id'],'trainee':owner}).status_code==201
    with storage.connect() as db:before=list(db.iterdump())
    assert client.post('/api/v1/sessions',json={'scenario_id':a['id'],'trainee':'PROC-B'}).status_code==422
    with storage.connect() as db:assert list(db.iterdump())==before


def test_pseudonymous_portable_snapshot_preserves_hash_and_owner_binding(client):
    a=prepared(client)
    moved=export_scenario(a,b'synthetic-director-validation-key-32-bytes')
    assert moved['director_decision']['trainee_id'].startswith('P_')
    assert moved['director_v2']['owner_binding']==a['director_v2']['owner_binding']
    assert 'PROC-A' not in json.dumps(moved)
    assert moved['id']==raid_id(moved)
    validate_snapshot_v2(moved)
    tampered=copy.deepcopy(moved)
    tampered['director_v2']['weights']['retention_gap']=.99
    with pytest.raises(ValueError):validate_snapshot_v2(tampered)


def test_uncertainty_progress_retention_inputs_change_policy_without_changing_posteriors(client):
    with storage.connect() as db:
        profile,history,_=snapshot(db,'MODELLED-LEARNER')
        binding=owner_binding(db,'MODELLED-LEARNER')
    # Synthetic selection evidence, not a claim of demonstrated human learning.
    for skill in SKILLS:
        profile['skills'][skill].update(alpha=7.,beta=5.,observations=10,mean=7/12)
    profile['sessions']=6
    zero={s:{'successes':0,'failures':0} for s in SKILLS}
    outcomes=[]
    for i in range(6):
        counts=copy.deepcopy(zero)
        counts['detection']={'successes':0 if i<3 else 3,'failures':3 if i<3 else 0}
        outcomes.append({'skills':counts})
    profile['outcomes']=outcomes
    before=copy.deepcopy(profile)
    decision,meta=select_policy(profile,history,5,binding)
    assert profile==before
    assert meta['skill_evidence']['detection']['learning_progress']>.5
    assert meta['skill_evidence']['classification_iff']['last_evidence_gap_sessions']==6
    assert meta['skill_evidence']['classification_iff']['retention_gap']==.6
    assert all(meta['adjusted_samples'][s]<=meta['raw_samples'][s] for s in SKILLS)
    assert decision['focus_skill']==min(SKILLS,key=lambda s:meta['adjusted_samples'][s])
    assert select_policy(profile,history,5,binding)==(decision,meta)
    DirectorV2Metadata(**meta)


def test_recent_families_avoid_immediate_repeat_when_alternatives_exist(client):
    with storage.connect() as db:
        profile,_,_=snapshot(db,'MODELLED');binding=owner_binding(db,'MODELLED')
    first,meta=select_policy(profile,[],4,binding)
    history=[{'scenario_template':first['scenario_template']}]
    next_decision,next_meta=select_policy(profile,history,4,binding)
    assert next_meta['family']!=meta['family']
    assert next_decision['focus_skill']==first['focus_skill']
