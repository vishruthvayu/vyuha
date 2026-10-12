"""Strict v0.4 transfer through actual API/JavaScript with disposable history.
Synthetic actions test reconstruction, not human training efficacy.
"""
import copy,json
import pytest
from server import storage
from server.engine import Simulation
from server.engine_v2 import observed_position
from server.portable import sign
from server.tests.test_api import client
from server.tests.test_hardening import KEY,seed_history
from server.tests.test_portable_browser import browser_json,counts


def finale_history(client,monkeypatch,duration=60,late_actions=False):
    monkeypatch.setenv('VYUHA_BUNDLE_SECRET',KEY)
    r=client.post('/api/v1/raids',json=dict(seed=7,duration=duration,name='Portable frozen raid',family='STAGGERED_WAVES',terrain='rural',difficulty='standard'))
    assert r.status_code==201,r.text
    spec=r.json()
    r=client.post('/api/v1/sessions',json={'scenario_id':spec['id'],'trainee':'PORTABLE-V2'})
    assert r.status_code==201,r.text
    sid=r.json()['id'];end=duration*30
    if late_actions:
        sim=Simulation(spec)
        while sim.tick<end:
            if sim.tick>2250:
                t=next((t for t in sim.tracks if t['active'] and t['designated'] is None and observed_position(t)),None)
                if t:
                    assert sim.act(dict(tick=sim.tick,k='designate',track=t['id']))
                    assert sim.act(dict(tick=sim.tick,k='classify',track=t['id'],kind=t['kind'],identity=t['identity']))
                    break
            sim.step()
        assert sim.events and all(a['tick']>2250 for a in sim.events)
        r=client.post('/api/v1/sessions/'+sid+'/events',json={'seq':0,'events':sim.events})
        assert r.status_code==200,r.text
    r=client.post('/api/v1/sessions/'+sid+'/complete',json={'end_tick':end,'execution_tick':end})
    assert r.status_code==200,r.text
    aar=client.get('/api/v1/sessions/'+sid+'/aar')
    assert aar.status_code==200 and aar.json()['verified'],aar.text
    r=client.post('/api/v1/units/local/bundle/export',json={})
    assert r.status_code==200,r.text
    return r.json(),sid,aar.json()


def test_real_finale_browser_roundtrip_preserves_long_horizon_late_actions_and_aar(client,monkeypatch,tmp_path):
    original,sid,aar=finale_history(client,monkeypatch,180,True)
    bundle=browser_json(original);entry=bundle['payload']['sessions'][0]
    assert entry['end_tick']==entry['execution_tick']==5400
    assert entry['events'][0]['tick']>2250
    assert entry['scorecard']['engine_version']=='vyuha-0.4.0'
    assert any(type(v['alpha']) is float for skills in original['payload']['profiles'].values() for v in skills.values())
    assert all(type(v['alpha']) is int for skills in bundle['payload']['profiles'].values() for v in skills.values())
    monkeypatch.setattr(storage,'DB_PATH',tmp_path/'v2-destination.db');storage.init()
    r=client.post('/api/v1/bundle/import',json=bundle)
    assert r.status_code==200,r.text
    assert r.json()['inserted_sessions']==1
    reconstructed=client.get('/api/v1/sessions/'+sid+'/aar')
    assert reconstructed.status_code==200,reconstructed.text
    assert reconstructed.json()['scorecard']==aar['scorecard']
    assert reconstructed.json()['events']==aar['events']
    assert reconstructed.json()['endTick']==5400 and reconstructed.json()['executionTick']==5400
    before=counts()
    assert client.post('/api/v1/bundle/import',json=bundle).json()['skipped_sessions']==1
    assert counts()==before
    forwarded=client.post('/api/v1/units/'+bundle['payload']['unit']['id']+'/bundle/export',json={})
    assert forwarded.status_code==200,forwarded.text
    assert browser_json(forwarded.json())['payload']==bundle['payload']


@pytest.mark.parametrize('mutation',[
    'wrong_key','unsigned_tamper','duplicate','unknown_schema','malformed','score',
    'engine_marker','sensor_version','missing_sensor','unknown_sensor','unknown_motion',
    'motion','threat_config','effector_config','fingerprint','raid_hash','geometry',
    'end_tick','observed_horizon','unknown_scenario','unknown_track'])
def test_finale_strict_signed_validation_and_integrity_never_write(client,monkeypatch,mutation):
    bundle,_,_=finale_history(client,monkeypatch)
    bundle=browser_json(bundle);p=bundle['payload'];e=p['sessions'][0];s=e['scenario']
    if mutation=='wrong_key':monkeypatch.setenv('VYUHA_BUNDLE_SECRET','wrong-local-test-secret-at-least-32-bytes')
    elif mutation=='unsigned_tamper':s['title']='Altered unsigned title'
    elif mutation=='duplicate':p['sessions'].append(copy.deepcopy(e))
    elif mutation=='unknown_schema':p['schema_version']=99
    elif mutation=='score':e['scorecard']['score']=999
    elif mutation=='engine_marker':e['scorecard']['engine_version']='vyuha-0.3.0';p['engine_versions']=['vyuha-0.3.0']
    elif mutation=='sensor_version':s['sensor_version']='vyuha-unknown'
    elif mutation=='missing_sensor':s['sensor_config'].pop(next(iter(s['sensor_config'])))
    elif mutation=='unknown_sensor':s['sensor_config']['invented_sensor']=1
    elif mutation=='unknown_motion':s['tracks'][0]['motion']['primitive']='teleport'
    elif mutation=='motion':s['tracks'][0]['motion']['lateral_m']+=1
    elif mutation=='threat_config':s['threat_config']['profiles']['no_rf_fpv']['rf']=True
    elif mutation=='effector_config':s['effector_config']['effectors']['rf_jam']['requires_rf_link']=False
    elif mutation=='fingerprint':s['raid']['fingerprint']='0'*24
    elif mutation=='raid_hash':s['id']='raid_'+'0'*24
    elif mutation=='geometry':s['raid']['validation']['peak_simultaneous_hostiles']=12
    elif mutation=='end_tick':e['end_tick']=2250
    elif mutation=='observed_horizon':e['execution_tick']=1801
    elif mutation=='unknown_scenario':s['invented']=True
    elif mutation=='unknown_track':s['tracks'][0]['invented']=True
    if mutation not in ['wrong_key','unsigned_tamper','malformed']:bundle=sign(p,KEY.encode())
    before=counts()
    r=(client.post('/api/v1/bundle/import',content='{"payload":',headers={'content-type':'application/json'}) if mutation=='malformed' else client.post('/api/v1/bundle/import',json=bundle))
    assert r.status_code==422,r.text
    assert counts()==before


def test_mixed_historical_and_finale_history_reconstructs_without_engine_relabelling(client,monkeypatch,tmp_path):
    monkeypatch.setenv('VYUHA_BUNDLE_SECRET',KEY);seed_history(client)
    bundle,_,_=finale_history(client,monkeypatch)
    assert set(bundle['payload']['engine_versions'])=={'vyuha-0.3.0','vyuha-0.4.0'}
    monkeypatch.setattr(storage,'DB_PATH',tmp_path/'mixed-destination.db');storage.init()
    r=client.post('/api/v1/bundle/import',json=browser_json(bundle))
    assert r.status_code==200,r.text
    assert r.json()['inserted_sessions']==3
    for e in bundle['payload']['sessions']:
        aar=client.get('/api/v1/sessions/'+e['id']+'/aar')
        assert aar.status_code==200,aar.text
        assert aar.json()['scorecard']['engine_version']==e['scorecard']['engine_version']


def test_finale_atomic_conflict_rolls_back_preceding_valid_new_session(client,monkeypatch):
    bundle,sid,_=finale_history(client,monkeypatch)
    original=copy.deepcopy(bundle['payload']['sessions'][0]);preceding=copy.deepcopy(original)
    preceding['id']='new-v2-before-conflict';bundle['payload']['sessions']=[preceding,original]
    with storage.connect() as db:
        card=json.loads(db.execute('select scorecard from sessions where id=?',(sid,)).fetchone()['scorecard'])
        card['score']=999;db.execute('update sessions set scorecard=? where id=?',(json.dumps(card),sid))
    before=counts()
    r=client.post('/api/v1/bundle/import',json=sign(bundle['payload'],KEY.encode()))
    assert r.status_code==409,r.text
    assert counts()==before
    with storage.connect() as db:assert db.execute("select count(*) from sessions where id='new-v2-before-conflict'").fetchone()[0]==0


def director_history(client,monkeypatch):
    monkeypatch.setenv('VYUHA_BUNDLE_SECRET',KEY)
    r=client.post('/api/v1/director-v2/prepare',json={'trainee':'DIRECTOR-V2-QA','seed':7,'duration':60})
    assert r.status_code==200,r.text
    spec=r.json()
    r=client.post('/api/v1/sessions',json={'scenario_id':spec['id'],'trainee':'DIRECTOR-V2-QA'})
    assert r.status_code==201,r.text
    sid=r.json()['id']
    r=client.post('/api/v1/sessions/'+sid+'/complete',json={'end_tick':1800,'execution_tick':1800})
    assert r.status_code==200,r.text
    r=client.post('/api/v1/units/local/bundle/export',json={})
    assert r.status_code==200,r.text
    return r.json(),spec


def test_director_finale_owner_binding_survives_pseudonymous_browser_forwarding(client,monkeypatch,tmp_path):
    original,spec=director_history(client,monkeypatch);bundle=browser_json(original)
    entry=bundle['payload']['sessions'][0];frozen=entry['scenario']
    assert 'DIRECTOR-V2-QA' not in json.dumps(bundle)
    assert frozen['director_decision']['trainee_id']==entry['trainee']
    assert frozen['director_v2']['owner_binding']==spec['director_v2']['owner_binding']
    assert frozen['id']==spec['id']
    assert all(v['last_session_id'] is None and v['updated_at'] is None for v in frozen['director_v2']['selection_snapshot']['skills'].values())
    r=client.post('/api/v1/bundle/import',json=bundle)
    assert r.status_code==200 and r.json()['skipped_sessions']==1,r.text
    monkeypatch.setattr(storage,'DB_PATH',tmp_path/'director-recipient.db');storage.init()
    r=client.post('/api/v1/bundle/import',json=bundle)
    assert r.status_code==200 and r.json()['inserted_sessions']==1,r.text
    r=client.post('/api/v1/units/'+bundle['payload']['unit']['id']+'/bundle/export',json={})
    assert r.status_code==200,r.text
    assert browser_json(r.json())['payload']==bundle['payload']


@pytest.mark.parametrize('mutation',['missing_owner_binding','changed_owner_binding','unknown_metadata','snapshot_identifier','owner_mismatch'])
def test_director_finale_metadata_rejects_signed_structural_and_owner_changes(client,monkeypatch,mutation):
    bundle,_=director_history(client,monkeypatch);p=bundle['payload'];e=p['sessions'][0];s=e['scenario'];m=s['director_v2']
    if mutation=='missing_owner_binding':m.pop('owner_binding')
    elif mutation=='changed_owner_binding':m['owner_binding']='0'*64
    elif mutation=='unknown_metadata':m['invented_neural_policy']=True
    elif mutation=='snapshot_identifier':next(iter(m['selection_snapshot']['skills'].values()))['last_session_id']='PRIVATE-SESSION'
    else:s['director_decision']['trainee_id']='P_'+'0'*20
    before=counts();r=client.post('/api/v1/bundle/import',json=sign(p,KEY.encode()))
    assert r.status_code==422,r.text
    assert counts()==before
