import copy
import hashlib
import json
import pytest
from server.capabilities import CATALOG, validate_catalog, validate_receipt, safe_file
from server.tests.test_api import client


def proof(tmp_path):
    p=tmp_path/'docs/proof.txt';p.parent.mkdir();p.write_text('real test output')
    return dict(id='proof',status='PASS',source_hash='a'*64,source_revision='b'*40,scopes=['backend'],artifacts=[dict(path='docs/proof.txt',sha256=hashlib.sha256(p.read_bytes()).hexdigest())],note='Scoped software evidence')


def test_catalog_covers_every_roadmap_without_conflating_implementation_and_acceptance(client):
    result=client.get('/api/v1/system/capabilities');assert result.status_code==200,result.text
    data=result.json();assert {r['id'] for r in data['roadmap']}=={f'R{i:02}' for i in range(1,41)}
    old=next(r for r in data['capabilities'] if r['id']=='deterministic-training')
    assert old['implementation']=='IMPLEMENTED'
    assert old['validation'][0]['freshness']=='HISTORICAL_PASS'
    assert old['validation'][0]['current_pass'] is False
    assert next(r for r in data['capabilities'] if r['id']=='academy-course')['implementation']=='PLANNED'
    assert 'No human' not in str(data.get('current_source_hash'))


@pytest.mark.parametrize('mutation',['duplicate','missing-source','unsafe-path','planned-pass','missing-roadmap','unknown-dependency','cycle','remote-route'])
def test_catalog_rejects_misleading_or_unsafe_definitions(mutation):
    data=json.loads(CATALOG.read_text())
    if mutation=='duplicate':data['capabilities'].append(copy.deepcopy(data['capabilities'][0]))
    elif mutation=='missing-source':data['capabilities'][0]['source_files']=['server/missing-implementation.py']
    elif mutation=='unsafe-path':data['capabilities'][0]['source_files']=['server/../../private-key.pem']
    elif mutation=='planned-pass':data['capabilities'][0]['implementation']='PLANNED'
    elif mutation=='missing-roadmap':data['roadmap'].pop()
    elif mutation=='unknown-dependency':data['roadmap'][0]['dependencies']=['R99']
    elif mutation=='cycle':data['roadmap'][0]['dependencies']=['R02'];data['roadmap'][1]['dependencies']=['R01']
    else:data['capabilities'][0]['route']='//outside.example'
    with pytest.raises(ValueError):validate_catalog(data)


def test_validation_is_bound_to_source_and_unchanged_proof_bytes(tmp_path):
    r=proof(tmp_path);assert validate_receipt(r,'a'*64,tmp_path)['current_pass']
    old=validate_receipt(r,'c'*64,tmp_path);assert old['freshness']=='HISTORICAL_PASS' and not old['current_pass']
    (tmp_path/'docs/proof.txt').write_text('modified')
    with pytest.raises(ValueError,match='changed'):validate_receipt(r,'a'*64,tmp_path)


@pytest.mark.parametrize('mutation',['missing-artifact','bad-hash','bad-revision','no-proof','no-device','no-method','incomplete-device'])
def test_pass_requires_source_proof_and_physical_scope(mutation,tmp_path):
    r=proof(tmp_path)
    if mutation=='missing-artifact':r['artifacts'][0]['path']='docs/absent.txt'
    elif mutation=='bad-hash':r['source_hash']='unmeasured'
    elif mutation=='bad-revision':r['source_revision']='main'
    elif mutation=='no-proof':r['artifacts']=[]
    else:
        r['scopes']=['physical'];r['method']='physical';r['devices']=[dict(platform='Android',browser='Chrome',tested_at='2026-10-22T12:00:00+05:30',workflow='Training and AAR')]
        if mutation=='no-device':r['devices']=[]
        elif mutation=='no-method':r['method']='emulated'
        else:r['devices'][0].pop('workflow')
    with pytest.raises(ValueError):validate_receipt(r,'a'*64,tmp_path)


def test_public_evidence_path_cannot_follow_a_symlink_outside_repository(tmp_path):
    (tmp_path/'docs').mkdir();(tmp_path/'docs/escape').symlink_to(tmp_path.parent,target_is_directory=True)
    with pytest.raises(ValueError,match='escapes'):safe_file(tmp_path,'docs/escape/secret',['docs'])
