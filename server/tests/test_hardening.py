import copy,json,sqlite3
from concurrent.futures import ThreadPoolExecutor
import pytest
from server.tests.test_api import client
from server.tests.test_director import complete_run
from server import storage
from server.exercises import AuthorScenario,compile_authored
from server.observations import Recording,RecordedSource,SimulatedSource
from server.engine import Simulation,replay
from server.durability import backup,restore
from server.portable import sign
from server.advanced import make_rapid
from server.experiment import run

KEY='synthetic-test-bundle-key-32-bytes-minimum'

def example():
 return dict(schema_version=1,title='Recorded fixture',duration_ticks=300,tracks=[dict(track_id='T1',samples=[dict(tick=t,x=20.0,z=90.0,altitude=10.0,radar=True,thermal=True,rf_signal=False,iff='no_reply') for t in [0,30,60]],ground_truth=dict(kind='fiber_fpv',identity='hostile',rf_link=False))])

def test_rural_version_fog_material_rules_and_legacy(client):
 legacy=client.post('/api/v1/scenario-library/preview',json={'name':'Old contract','terrain':'rural'});assert legacy.status_code==422
 a=client.post('/api/v1/scenario-library',json={'schema_version':2,'name':'Rural fixture','terrain':'rural','fog':.6,'sensor_fault':'radar_degraded'});assert a.status_code==201
 s=a.json();assert s['terrain_id']=='rural_forward_base' and s['terrain_version']==1 and s['fog']==.6 and s['authoring']['version']==2
 assert s['doctrine']['rules']['restricted']==dict(enabled=True,x_lt=-70,z_gt=0)
 sid,aar=complete_run(client,s,trainee='RURAL-QA');assert aar['scenario']==s and aar['verified']
 assert client.get('/api/v1/sessions/'+sid+'/aar').json()['scorecard']==aar['scorecard']
 for field in [{'terrain_version':2},{'fog':1.1},{'schema_version':3}]:assert client.post('/api/v1/scenario-library',json={'name':'Invalid version',**field}).status_code==422

@pytest.mark.parametrize('mutate',['reversed','duplicate','coordinate','sensor','duration','nan'])
def test_recorded_invalid_contract(client,mutate):
 r=example();samples=r['tracks'][0]['samples']
 if mutate=='reversed':samples.reverse()
 elif mutate=='duplicate':r['tracks'].append(copy.deepcopy(r['tracks'][0]))
 elif mutate=='coordinate':samples[0]['x']=9999
 elif mutate=='sensor':samples[0]['lidar']=True
 elif mutate=='duration':r['duration_ticks']=20
 else:samples[0]['x']=float('nan')
 body=json.dumps(r)
 assert client.post('/api/v1/recordings',content=body,headers={'content-type':'application/json'}).status_code==422
 assert client.get('/api/v1/recordings').json()=={'recordings':[]}

def test_recorded_import_provenance_retries_no_invented_outcomes(client):
 r=example();a=client.post('/api/v1/recordings',json=r).json();assert client.post('/api/v1/recordings',json=r).json()==a
 assert a['source_type']=='recorded' and len(a['import_hash'])==64
 source=RecordedSource(Recording.model_validate(r));assert len(source.observations_at(60))==3;assert source.observations_at(91)==[]
 actions=[dict(tick=0,order=0,k='designate',track='T1'),dict(tick=0,order=1,k='classify',track='T1',kind='fiber_fpv',identity='hostile'),dict(tick=0,order=2,k='engage',track='T1',effector='rf_jam')]
 body=dict(request_id='recording-retry-001',trainee_id='REC-QA',actions=actions);path='/api/v1/recordings/'+a['id']+'/practice'
 result=client.post(path,json=body);assert result.status_code==200 and result.json()['profile_updated'] is False and result.json()['tactical_score'] is None
 assert result.json()['reviews'][1]['classification_correct'] is True
 assert client.post(path,json=body).json()==result.json()
 body['actions']=[];assert client.post(path,json=body).status_code==409
 with storage.connect() as db:assert db.execute('select count(*) from skill_outcomes').fetchone()[0]==0
 no_truth=example();no_truth['tracks'][0].pop('ground_truth');b=client.post('/api/v1/recordings',json=no_truth).json()
 result=client.post('/api/v1/recordings/'+b['id']+'/practice',json={**body,'request_id':'no-truth-001','actions':actions}).json();assert result['reviews'][1]['classification_correct'] is None
 assert client.post(path,json={**body,'request_id':'bad-time-001','actions':[dict(tick=92,k='designate',track='T1')]}).status_code==422

@pytest.mark.parametrize('tick',[0,30,180,900])
def test_simulated_adapter_preserves_actual_sensor_output(tick):
 s=compile_authored(AuthorScenario(name='Adapter fixture'));sim=Simulation(s);obs=SimulatedSource(sim).observations_at(tick);ref=replay(s,[],tick)
 for o in obs:
  t=next(t for t in ref.tracks if t['id']==o['track_id']);assert o['position']==dict(x=t['x'],z=t['z'],altitude=t['altitude'])
  if o['sensor'] in ['radar','thermal']:assert o['detected']==t[o['sensor']]

def test_payload_stream_nested_and_nonfinite_limits(client):
 assert client.post('/api/v1/recordings',content=b'x'*(8*1024*1024+1)).status_code==413
 deep={};item=deep
 for _ in range(24):item['nested']={};item=item['nested']
 assert client.post('/api/v1/scenarios/generate',json=deep).status_code==422
 assert client.post('/api/v1/scenarios/generate',content='{"fog":1e9999}').status_code==422
 assert client.post('/api/v1/scenarios/generate',content='{"night": NaN}').status_code==422
 assert client.post('/api/v1/scenarios/generate',json={}).status_code==200

def seed_history(client):
 who=client.post('/api/v1/units/join',json={'callsign':'TRANSFER-QA'}).json()['trainee_id']
 s=client.post('/api/v1/scenario-library',json={'schema_version':2,'name':'Portable rural','terrain':'rural','fog':.6}).json()
 sid,aar=complete_run(client,s,trainee=who)
 rr=client.post('/api/v1/rapid-id',json=dict(request_id='rapid-transfer-test',trainee_id=who,seed=62147,rounds=10)).json()
 for i,r in enumerate(make_rapid(62147,10)):
  response=client.post('/api/v1/rapid-id/'+rr['id']+'/answers',json=dict(round_index=i,answer=r['correct_answer'],round_start_ms=i*1000,response_time_ms=1000));assert response.status_code==200
 client.post('/api/v1/recordings',json=example())
 return who,sid,aar,rr['id']

def test_bundle_tamper_roundtrip_duplicate_atomic_conflict_restore(client,monkeypatch,tmp_path):
 monkeypatch.setenv('VYUHA_BUNDLE_SECRET',KEY);who,sid,aar,rid=seed_history(client)
 before=client.get('/api/v1/trainees/'+who+'/profile').json()
 response=client.post('/api/v1/units/local/bundle/export',json={});assert response.status_code==200,response.text;bundle=response.json()
 assert who not in json.dumps(bundle) and 'TRANSFER-QA' not in json.dumps(bundle)
 tamper=copy.deepcopy(bundle);tamper['payload']['sessions'][0]['scorecard']['score']=999
 assert client.post('/api/v1/bundle/import',json=tamper).status_code==422
 # Existing origin recognizes exact duplicate histories even after metadata redaction.
 response=client.post('/api/v1/bundle/import',json=bundle);assert response.status_code==200,response.text;assert response.json()['skipped_sessions']==2
 destination=tmp_path/'recipient.db';monkeypatch.setattr(storage,'DB_PATH',destination);storage.init()
 response=client.post('/api/v1/bundle/import',json=bundle);assert response.status_code==200,response.text;assert response.json()['inserted_sessions']==2
 p=client.get('/api/v1/trainees/'+bundle['payload']['sessions'][0]['trainee']+'/profile').json()
 assert {k:(v['alpha'],v['beta']) for k,v in p['skills'].items()}=={k:(v['alpha'],v['beta']) for k,v in before['skills'].items()}
 assert client.get('/api/v1/sessions/'+sid+'/aar').json()['scorecard']==aar['scorecard']
 assert client.get('/api/v1/rapid-id/'+rid).json()['result']['correct']==10
 assert client.post('/api/v1/bundle/import',json=bundle).json()['skipped_sessions']==2
 backup_path=backup(destination,tmp_path/'safe.db');restored=restore(backup_path,tmp_path/'restored.db')
 with sqlite3.connect(restored) as db:assert db.execute('pragma quick_check').fetchone()[0]=='ok';assert db.execute('select count(*) from skill_outcomes').fetchone()[0]==2
 bad=copy.deepcopy(bundle);bad['payload']['sessions'][0]['scorecard']['score']=999;bad=sign(bad['payload'],KEY.encode())
 assert client.post('/api/v1/bundle/import',json=bad).status_code==422
 with storage.connect() as db:assert db.execute('select count(*) from skill_outcomes').fetchone()[0]==2
 conflict=copy.deepcopy(bundle);conflict['payload']['unit']['id']='U_'+'a'*20;conflict['payload']['sessions'][0]['execution_tick']=0;conflict=sign(conflict['payload'],KEY.encode())
 assert client.post('/api/v1/bundle/import',json=conflict).status_code in [409,422]
 with pytest.raises(ValueError):restore(backup_path,destination)

@pytest.mark.parametrize('broken',['pack','terrain','score_version','commands','rapid_summary','rapid_evidence'])
def test_signed_but_invalid_bundle_rejected_before_write(client,monkeypatch,broken):
 monkeypatch.setenv('VYUHA_BUNDLE_SECRET',KEY);seed_history(client);r=client.post('/api/v1/units/local/bundle/export',json={});assert r.status_code==200,r.text
 payload=r.json()['payload'];s=payload['sessions'][0]
 if broken=='pack':s['scenario']['doctrine']['rules']['rf_range']=-1
 elif broken=='terrain':s['scenario']['terrain_version']=99
 elif broken=='score_version':s['scorecard']['engine_version']='unknown'
 elif broken=='commands':s['commands']=[dict(type='pause',payload={},seq=1,tick=-1,order=0,command_id='bad',session_id=s['id'])]
 elif broken=='rapid_summary':payload['rapid'][0]['result']['correct']=99
 else:payload['rapid'][0]['answers'][0]['evidence']['rf']['signal']=False
 response=client.post('/api/v1/bundle/import',json=sign(payload,KEY.encode()));assert response.status_code==422,response.text
 with storage.connect() as db:assert db.execute('select count(*) from skill_outcomes').fetchone()[0]==2

def test_unconfigured_bundle_key_is_actionable(client,monkeypatch):
 monkeypatch.delenv('VYUHA_BUNDLE_SECRET',raising=False);monkeypatch.delenv('VYUHA_BUNDLE_KEYFILE',raising=False)
 r=client.post('/api/v1/units/local/bundle/export',json={});assert r.status_code==503 and 'key' in r.json()['detail']

def rapid_answers(client,sid,seed):
 for i,r in enumerate(make_rapid(seed,15)):
  a=client.post('/api/v1/rapid-id/'+sid+'/answers',json=dict(round_index=i,answer=r['correct_answer'],round_start_ms=i*1000,response_time_ms=1000));assert a.status_code==200

def test_evaluation_consent_pre_drills_post_equivalent_and_retry(client):
 tid=client.post('/api/v1/units/join',json={'callsign':'PILOT-QA'}).json()['trainee_id'];body=dict(request_id='pilot-protocol-test',participant='P03',trainee_id=tid,consent=False,drills=3,seed=62147)
 assert client.post('/api/v1/evaluations',json=body).status_code==422
 body['consent']=True;r=client.post('/api/v1/evaluations',json=body);assert r.status_code==201,r.text;pilot=r.json();eid=pilot['id'];assert client.post('/api/v1/evaluations',json=body).json()['id']==eid
 assert client.post('/api/v1/evaluations/'+eid+'/post',json={}).status_code==409
 rapid_answers(client,pilot['session_ids']['pre'],62147)
 for i in range(3):
  s=client.post('/api/v1/scenarios/generate',json=dict(trainee=tid,mode='adaptive',advanced=True,seed=62147+i)).json();complete_run(client,s,trainee=tid)
 r=client.post('/api/v1/evaluations/'+eid+'/post',json={});assert r.status_code==200,r.text;post=r.json();assert len(post['drills'])==3
 assert client.post('/api/v1/evaluations/'+eid+'/post',json={}).json()['session_ids']==post['session_ids']
 rapid_answers(client,post['session_ids']['post'],62147^0x9E3779B9)
 final=client.get('/api/v1/evaluations/'+eid).json();assert final['observed_difference']['accuracy_percentage_points']==0 and final['observed_difference']['median_response_ms']==0
 assert make_rapid(62147,15)!=make_rapid(62147^0x9E3779B9,15)
 assert final['pre']['rounds']==final['post']['rounds']==15

def test_experiment_is_paired_deterministic_and_separate_hidden_state():
 config=dict(schema_version=1,learners=2,sessions=4,seeds=[12,13],initial_range=[.25,.75],learning_gain=.08,threshold=.7)
 a=run(config);assert a==run(config) and 'NOT HUMAN' in a['label']
 for seed in config['seeds']:
  arms=[r for r in a['results'] if r['seed']==seed];assert arms[0]['initial_hidden']==arms[1]['initial_hidden']
  for r in arms:assert r['trajectory'][0]['hidden']!=r['trajectory'][0]['beta_means'];assert len(r['trajectory'])==4

def test_evidence_manifest_staleness(client,monkeypatch,tmp_path):
 from server import evidence
 p=tmp_path/'docs/qa-stage6';p.mkdir(parents=True);(p/'evidence.json').write_text(json.dumps({'source_tree_sha256':'older'}));monkeypatch.setattr(evidence,'ROOT',tmp_path);monkeypatch.setattr(evidence,'source_hash',lambda:'current')
 r=client.get('/api/v1/system/evidence').json();assert r['source_matches'] is False and 'historical' in r['freshness_note']

def test_conflicting_import_rolls_back_preceding_new_session_and_unit(client,monkeypatch):
 monkeypatch.setenv('VYUHA_BUNDLE_SECRET',KEY);_,sid,_,_=seed_history(client);bundle=client.post('/api/v1/units/local/bundle/export',json={}).json()
 original=copy.deepcopy(bundle['payload']['sessions'][0]);new=copy.deepcopy(original);new['id']='new-before-conflict';bundle['payload']['sessions']=[new,original]
 with storage.connect() as db:
  old=db.execute('select scorecard from sessions where id=?',(sid,)).fetchone()['scorecard'];card=json.loads(old);card['score']=999;db.execute('update sessions set scorecard=? where id=?',(json.dumps(card),sid))
 response=client.post('/api/v1/bundle/import',json=sign(bundle['payload'],KEY.encode()));assert response.status_code==409,response.text
 with storage.connect() as db:
  assert db.execute("select count(*) from sessions where id='new-before-conflict'").fetchone()[0]==0
  assert db.execute('select count(*) from units').fetchone()[0]==1
  assert db.execute('select count(*) from skill_outcomes').fetchone()[0]==2

def test_portable_forwarding_installation_namespace_and_unobserved_prior(client,monkeypatch,tmp_path):
 monkeypatch.setenv('VYUHA_BUNDLE_SECRET',KEY)
 who,sid,_,_=seed_history(client)
 idle=client.post('/api/v1/units/join',json={'callsign':'UNOBSERVED'}).json()['trainee_id']
 bundle=client.post('/api/v1/units/local/bundle/export',json={}).json()
 from server.portable import pseudonym
 idle_alias=pseudonym(idle,KEY.encode(),'P_')
 origin_unit=bundle['payload']['unit']['id']
 origin_db=storage.DB_PATH
 assert client.post('/api/v1/bundle/import',json=bundle).status_code==200
 with storage.connect() as db:assert db.execute('select count(*) from trainees').fetchone()[0]==2
 monkeypatch.setattr(storage,'DB_PATH',tmp_path/'forward.db');storage.init()
 assert pseudonym('local',KEY.encode(),'U_')!=origin_unit
 assert client.post('/api/v1/bundle/import',json=bundle).status_code==200
 prior=client.get('/api/v1/trainees/'+idle_alias+'/profile').json()
 assert all(s['alpha']==s['beta']==1 for s in prior['skills'].values())
 forwarded=client.post('/api/v1/units/'+origin_unit+'/bundle/export',json={}).json()
 assert forwarded['payload']==bundle['payload']
 assert client.post('/api/v1/bundle/import',json=forwarded).json()['skipped_sessions']==2
 monkeypatch.setattr(storage,'DB_PATH',origin_db)
 assert client.post('/api/v1/bundle/import',json=forwarded).json()['skipped_sessions']==2
 with storage.connect() as db:assert db.execute('select count(*) from skill_outcomes').fetchone()[0]==2


def test_startup_preflight_errors_are_actionable(tmp_path):
 import os,socket,subprocess,sys
 from pathlib import Path
 script=Path(__file__).resolve().parents[2]/'scripts/preflight.py'
 with socket.socket() as sock:
  sock.bind(('0.0.0.0',0));port=sock.getsockname()[1]
  r=subprocess.run([sys.executable,str(script),'--port',str(port)],capture_output=True,text=True)
  assert r.returncode==1 and 'Stop the existing server' in r.stderr
 env={**os.environ,'VYUHA_DB':str(tmp_path),'PATH':''}
 r=subprocess.run([sys.executable,str(script),'--build','--port','0'],env=env,capture_output=True,text=True)
 assert 'between 1 and 65535' in r.stderr
 r=subprocess.run([sys.executable,str(script),'--build','--port','65534'],env=env,capture_output=True,text=True)
 assert 'Node.js and npm' in r.stderr
 r=subprocess.run([sys.executable,str(script),'--port','65534'],env=env,capture_output=True,text=True)
 assert 'database path is not a file' in r.stderr
 r=subprocess.run([sys.executable,'-c',"import sys,runpy;sys.version_info=(3,10);sys.argv=['preflight'];runpy.run_path(sys.argv[1] if len(sys.argv)>1 else "+repr(str(script))+",run_name='__main__')"],capture_output=True,text=True)
 assert 'Python 3.11 or newer' in r.stderr
