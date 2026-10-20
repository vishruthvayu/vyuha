"""Shared results/exposure attribution transfer without individual Beta credit."""
import copy,json
import pytest
from server import storage,crew
from server.fusion import advice,configuration
from server.raid_v2 import raid_id
from server.portable import sign
from server.tests.test_api import client
from server.tests.test_hardening import KEY
from server.tests.test_portable_browser import browser_json


def beta_state():
 with storage.connect() as db:return ([tuple(r) for r in db.execute('SELECT * FROM skill_profiles ORDER BY trainee,skill')],[tuple(r) for r in db.execute('SELECT * FROM skill_outcomes ORDER BY session_id')])

def rows():
 with storage.connect() as db:return {t:db.execute('SELECT COUNT(*) FROM '+t).fetchone()[0] for t in ['sessions','trainees','skill_profiles','skill_outcomes','crew_archive','fusion_exposures']}

@pytest.fixture
def shared_bundle(client,monkeypatch):
 monkeypatch.setenv('VYUHA_BUNDLE_SECRET',KEY)
 stamp=[1000.];monkeypatch.setattr(crew,'clock',lambda:stamp[0])
 r=client.post('/api/v1/raids',json=dict(name='Crew transfer source',seed=62,duration=60,difficulty='foundational',family='DIRECT',terrain='rural'))
 assert r.status_code==201,r.text
 spec=r.json()
 # Enable the frozen supported training configuration before issuing a session.
 spec['fusion']=configuration();spec['id']=raid_id(spec)
 with storage.connect() as db:db.execute('INSERT OR IGNORE INTO scenarios VALUES (?,?)',(spec['id'],storage.dumps(spec)))
 r=client.post('/api/v1/crews',json=dict(name='Private Crew Label',scenario_id=spec['id'],members=[dict(callsign='PRIVATE-WATCH',role='spotter'),dict(callsign='PRIVATE-RESP',role='responder')]))
 assert r.status_code==201,r.text
 issued=r.json();cid=issued['id'];sid=issued['session_id'];tokens=[dict(headers={'X-VYUHA-Crew-Token':m['code']}) for m in issued['members']]
 r=client.post('/api/v1/crews/'+cid+'/control',json=dict(command_id='crew-transfer-resume',type='resume',payload={}))
 assert r.status_code==200,r.text
 for _ in range(50):
  r=client.get('/api/v1/crews/'+cid+'/state',**tokens[0]);assert r.status_code==200,r.text
  state=r.json()
  if state['contacts']:break
  stamp[0]+=.5
 assert state['contacts']
 contact=state['contacts'][0];tid=contact['id']
 with storage.connect() as db:boundary=db.execute('SELECT next_order FROM crews WHERE id=?',(cid,)).fetchone()[0]
 assistant=advice(contact['observation'],config=spec['fusion'],context=dict(session_id=sid,scenario_id=spec['id'],before_order=boundary))
 exposure=dict(tick=state['tick'],before_order=boundary,track=tid,exposure_id=assistant['exposure_id'],action_order=boundary+1,association='independent',distribution=dict.fromkeys(['bird','quad','fixed_wing','fiber_fpv'],.25))
 for role,body in [(0,dict(request_id='spotter-mark',k='designate',track=tid)),(1,dict(request_id='responder-id',k='classify',track=tid,kind='quad',identity='hostile')),(1,dict(request_id='responder-hold',k='engage',track=tid,effector='hold'))]:
  r=client.post('/api/v1/crews/'+cid+'/actions',json=body,**tokens[role]);assert r.status_code==200,r.text
 r=client.post('/api/v1/crews/'+cid+'/complete',json={});assert r.status_code==200,r.text
 r=client.post('/api/v1/sessions/'+sid+'/fusion-exposures',json={'exposures':[exposure]});assert r.status_code==200,r.text
 with storage.connect() as db:owner=db.execute('SELECT trainee FROM sessions WHERE id=?',(sid,)).fetchone()[0]
 before=beta_state()
 # Public profile reads and export must not backfill shared credit.
 r=client.get('/api/v1/trainees/'+owner+'/profile');assert r.status_code==200,r.text
 assert beta_state()==before
 aar=client.get('/api/v1/sessions/'+sid+'/aar').json()
 fusion=client.get('/api/v1/sessions/'+sid+'/fusion-review').json()
 r=client.post('/api/v1/units/local/bundle/export',json={});assert r.status_code==200,r.text
 assert beta_state()==before
 return dict(bundle=r.json(),issued=issued,sid=sid,aar=aar,fusion=fusion,owner=owner,beta=before)


def test_shared_crew_browser_roundtrip_keeps_attribution_receipts_and_never_profiles(client,shared_bundle,monkeypatch,tmp_path):
 source=shared_bundle;bundle=browser_json(source['bundle']);entry=bundle['payload']['sessions'][0]
 assert entry['outcomes'] is None and not bundle['payload']['profiles']
 assert [a['role'] for a in entry['shared_crew']['attribution']]==['spotter','responder','responder']
 serialized=json.dumps(bundle)
 assert all(m['code'] not in serialized for m in source['issued']['members'])
 assert all(m['callsign'] not in serialized for m in source['issued']['members'])
 assert source['owner'] not in serialized and 'Private Crew Label' not in serialized and 'token_hash' not in serialized
 assert len(entry['fusion_exposures'])==1 and 'receipt' not in entry['fusion_exposures'][0]
 r=client.post('/api/v1/bundle/import',json=bundle);assert r.status_code==200 and r.json()['skipped_sessions']==1,r.text
 assert beta_state()==source['beta']
 monkeypatch.setattr(storage,'DB_PATH',tmp_path/'crew-recipient.db');storage.init()
 r=client.post('/api/v1/bundle/import',json=bundle);assert r.status_code==200 and r.json()['inserted_sessions']==1,r.text
 assert beta_state()==([],[])
 sid=source['sid']
 r=client.get('/api/v1/sessions/'+sid+'/aar');assert r.status_code==200 and r.json()['verified'],r.text
 assert r.json()['scorecard']==source['aar']['scorecard'] and r.json()['events']==source['aar']['events']
 assert client.get('/api/v1/sessions/'+sid+'/fusion-review').json()==source['fusion']
 assert client.get('/api/v1/trainees/'+entry['trainee']+'/profile').json()['sessions']==0
 assert beta_state()==([],[])
 before=rows();r=client.post('/api/v1/bundle/import',json=bundle)
 assert r.status_code==200 and r.json()['skipped_sessions']==1,r.text
 assert rows()==before
 r=client.post('/api/v1/units/'+bundle['payload']['unit']['id']+'/bundle/export',json={});assert r.status_code==200,r.text
 assert browser_json(r.json())['payload']==bundle['payload'] and beta_state()==([],[])
 assert client.post('/api/v1/sessions/'+sid+'/events',json={}).status_code==403
 client.headers.clear()
 assert client.get('/api/v1/sessions/'+sid+'/aar').status_code==401
 assert client.get('/api/v1/sessions/'+sid+'/aar',headers={'X-VYUHA-Crew-Token':source['issued']['members'][0]['code']}).status_code==401
 assert client.get('/api/v1/crews/'+entry['shared_crew']['id']+'/state',headers={'X-VYUHA-Crew-Token':source['issued']['members'][0]['code']}).status_code==404
 assert client.post('/api/v1/sessions/'+sid+'/events',json={}).status_code==401


@pytest.mark.parametrize('mutation',['code','role','missing_attribution','outcomes','profile','fusion_id','fusion_boundary','duplicate_exposure','receipt'])
def test_signed_shared_or_fusion_metadata_changes_fail_atomically(client,shared_bundle,mutation):
 bundle=copy.deepcopy(shared_bundle['bundle']);p=bundle['payload'];e=p['sessions'][0]
 if mutation=='code':e['shared_crew']['members'][0]['code']='never-export-code'
 elif mutation=='role':e['shared_crew']['attribution'][0]['role']='responder'
 elif mutation=='missing_attribution':e['shared_crew']['attribution'].pop()
 elif mutation=='outcomes':e['outcomes']={}
 elif mutation=='profile':p['profiles'][e['trainee']]={s:dict(alpha=1,beta=1) for s in ['detection','classification_iff','effector_choice','degraded_sensor_response']}
 elif mutation=='fusion_id':e['fusion_exposures'][0]['exposure_id']='fusion-00000000'
 elif mutation=='fusion_boundary':e['fusion_exposures'][0]['before_order']=999
 elif mutation=='duplicate_exposure':e['fusion_exposures'].append(copy.deepcopy(e['fusion_exposures'][0]))
 else:e['fusion_exposures'][0]['receipt']={'forged':'never trusted'}
 before=rows();r=client.post('/api/v1/bundle/import',json=sign(p,KEY.encode()))
 assert r.status_code==422,r.text
 assert rows()==before and beta_state()==shared_bundle['beta']


def test_shared_import_conflict_rolls_back_archive_receipt_and_session(client,shared_bundle):
 p=copy.deepcopy(shared_bundle['bundle']['payload']);first=copy.deepcopy(p['sessions'][0])
 # A new empty-exposure shared record is individually valid, before a later ID conflict.
 first['id']='crew-before-conflict';first.pop('fusion_exposures',None)
 first['shared_crew']['id']='C_'+'f'*20
 for command in first['commands']:command['session_id']=first['id']
 p['sessions'].insert(0,first)
 with storage.connect() as db:
  card=copy.deepcopy(shared_bundle['aar']['scorecard']);card['score']=999
  db.execute('UPDATE sessions SET scorecard=? WHERE id=?',(storage.dumps(card),shared_bundle['sid']))
 before=rows();r=client.post('/api/v1/bundle/import',json=sign(p,KEY.encode()))
 assert r.status_code==409,r.text
 assert rows()==before and beta_state()==shared_bundle['beta']
 with storage.connect() as db:assert db.execute("SELECT COUNT(*) FROM crew_archive WHERE session_id='crew-before-conflict'").fetchone()[0]==0


def test_individual_fusion_requests_reconstruct_without_changing_score_or_beta(client,monkeypatch,tmp_path):
 from server.engine import Simulation
 from server.engine_v2 import observed_position
 monkeypatch.setenv('VYUHA_BUNDLE_SECRET',KEY)
 r=client.post('/api/v1/raids',json=dict(name='Individual fusion transfer',seed=62,duration=60,difficulty='foundational',family='DIRECT',terrain='rural'))
 assert r.status_code==201,r.text
 spec=r.json();spec['fusion']=configuration();spec['id']=raid_id(spec)
 with storage.connect() as db:db.execute('INSERT OR IGNORE INTO scenarios VALUES (?,?)',(spec['id'],storage.dumps(spec)))
 r=client.post('/api/v1/sessions',json=dict(scenario_id=spec['id'],trainee='FUSION-INDIVIDUAL'))
 assert r.status_code==201,r.text
 sid=r.json()['id'];sim=Simulation(spec)
 while sim.tick<1800:
  t=next((t for t in sim.tracks if t['active'] and observed_position(t)),None)
  if t:break
  sim.step()
 assert t is not None
 shown=advice(t['observation'],config=spec['fusion'],context=dict(session_id=sid,scenario_id=spec['id'],before_order=0))
 exposure=dict(tick=sim.tick,before_order=0,track=t['id'],exposure_id=shown['exposure_id'],action_order=1,association='independent')
 assert sim.act(dict(tick=sim.tick,order=0,k='designate',track=t['id']))
 assert sim.act(dict(tick=sim.tick,order=1,k='classify',track=t['id'],kind=t['kind'],identity=t['identity']))
 r=client.post('/api/v1/sessions/'+sid+'/events',json=dict(seq=0,events=sim.events));assert r.status_code==200,r.text
 r=client.post('/api/v1/sessions/'+sid+'/complete',json=dict(end_tick=1800,execution_tick=sim.tick));assert r.status_code==200,r.text
 card=r.json();before=beta_state()
 r=client.post('/api/v1/sessions/'+sid+'/fusion-exposures',json=dict(exposures=[exposure]));assert r.status_code==200,r.text
 assert beta_state()==before
 review=client.get('/api/v1/sessions/'+sid+'/fusion-review').json()
 r=client.post('/api/v1/units/local/bundle/export',json={});assert r.status_code==200,r.text
 bundle=browser_json(r.json());entry=bundle['payload']['sessions'][0]
 assert 'shared_crew' not in entry and entry['outcomes'] is not None
 source_profile=client.get('/api/v1/trainees/FUSION-INDIVIDUAL/profile').json()['skills']
 monkeypatch.setattr(storage,'DB_PATH',tmp_path/'individual-recipient.db');storage.init()
 r=client.post('/api/v1/bundle/import',json=bundle);assert r.status_code==200 and r.json()['inserted_sessions']==1,r.text
 assert client.get('/api/v1/sessions/'+sid+'/aar').json()['scorecard']==card
 assert client.get('/api/v1/sessions/'+sid+'/fusion-review').json()==review
 recipient_profile=client.get('/api/v1/trainees/'+entry['trainee']+'/profile').json()['skills']
 assert recipient_profile==source_profile
 before=beta_state();r=client.post('/api/v1/bundle/import',json=bundle)
 assert r.status_code==200 and r.json()['skipped_sessions']==1,r.text
 assert beta_state()==before
