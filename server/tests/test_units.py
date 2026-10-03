import json
from concurrent.futures import ThreadPoolExecutor
from collections import Counter
from threading import Barrier
from unittest.mock import patch
from server.tests.test_api import client
from server.tests.test_director import expert
from server.tests.test_instructor import issue,heartbeat
from server.engine import replay,score,Simulation
from server.director import SKILLS,session_outcomes
from server import storage,main

def join(c,name):
 r=c.post('/api/v1/units/join',json={'callsign':name});assert r.status_code==200,r.text;return r.json()
def start(c,who,seed=482913,mode='scripted'):
 spec=c.post('/api/v1/scenarios/generate',json={'seed':seed,'mode':mode,'trainee':who['trainee_id']}).json()
 r=c.post('/api/v1/sessions',json={'scenario_id':spec['id'],'trainee':who['trainee_id']});assert r.status_code==201,r.text
 return spec,r.json()['id']
def finish(c,sid,events,end=2250):
 assert c.post(f'/api/v1/sessions/{sid}/events',json={'seq':0,'events':events}).status_code==200
 r=c.post(f'/api/v1/sessions/{sid}/complete',json={'execution_tick':end});assert r.status_code==200,r.text
 return c.get(f'/api/v1/sessions/{sid}/aar').json()
def profile(c,who):return c.get(f"/api/v1/trainees/{who['trainee_id']}/profile").json()
def presence(c,who,sid=None):
 r=c.post(f"/api/v1/trainees/{who['trainee_id']}/presence",json={'client_id':who['trainee_id'],'session_id':sid});assert r.status_code==200,r.text

def test_join_stable_pseudonyms_and_resume(client):
 a=join(client,'T-01');assert a['trainee_id']!='T-01' and len(a['trainee_id'])<=24
 assert client.post('/api/v1/units/join',json={'callsign':'t-01'}).status_code==409
 assert client.post('/api/v1/units/join',json={'callsign':'T-01',**{'trainee_id':a['trainee_id'],'unit_id':a['unit_id']}}).json()==a
 assert client.post('/api/v1/units/join',json={'callsign':'Wrong','trainee_id':a['trainee_id']}).status_code==409
 assert client.post('/api/v1/units/join',json={'callsign':'real name'}).status_code==422
 assert client.post('/api/v1/units/join',json={'callsign':'T-02','unit_id':'unknown'}).status_code==404

def test_unit_start_requires_registry_and_presence_ownership(client,monkeypatch):
 monkeypatch.setenv('VYUHA_UNIT_MODE','1');assert client.get('/api/v1/health').json()['mode']=='unit'
 spec=client.post('/api/v1/scenarios/generate',json={}).json()
 assert client.post('/api/v1/sessions',json={'scenario_id':spec['id']}).status_code==422
 a,b=join(client,'A'),join(client,'B');_,sid=start(client,a)
 assert client.post(f"/api/v1/trainees/{b['trainee_id']}/presence",json={'client_id':'B','session_id':sid}).status_code==422
 presence(client,a,sid);r=client.get('/api/v1/units/local/trainees').json()['trainees'];assert next(x for x in r if x['trainee_id']==a['trainee_id'])['busy']

def test_three_active_sessions_commands_and_injections_are_isolated(client):
 people=[join(client,f'T-{i}') for i in range(3)];runs=[start(client,p,482900+i) for i,p in enumerate(people)]
 for spec,sid in runs:assert heartbeat(client,sid).status_code==200
 radar={**issue(client,runs[0][1],'sensor_fault',{'sensor':'radar','mode':'failed'}),'tick':30,'order':0}
 swarm={**issue(client,runs[1][1],'inject_swarm',{'count':6,'bearing':40}),'tick':30,'order':0}
 for i,(spec,sid) in enumerate(runs):
  stream=client.get(f'/api/v1/sessions/{sid}/commands').json()['commands']
  assert len(stream)==(1 if i<2 else 0)
  sim=replay(spec,[],30,[radar] if i==0 else [swarm] if i==1 else [])
  assert sim.radar_status==('failed' if i==0 else 'normal')
  assert len(sim.tracks)==(14 if i==1 else 8)
  assert all(c['session_id']==sid for c in stream)
 assert len([r for r in client.get('/api/v1/instructor/sessions').json()['sessions'] if r['status']=='ACTIVE'])==3

def test_unit_aggregation_failure_counts_profile_and_director_isolation(client):
 a,b,c=[join(client,s) for s in ['A','B','C']];sa,ida=start(client,a);sb,idb=start(client,b)
 aar_a=finish(client,ida,expert(sa).events)
 sim=Simulation(sb)
 while sim.tick<632:sim.step()
 for k,extra in [('designate',{}),('classify',{'kind':'fiber_fpv','identity':'hostile'}),('engage',{'effector':'rf_jam'})]:sim.act(dict(tick=632,k=k,track='T5',**extra))
 aar_b=finish(client,idb,sim.events,633)
 pa,pb,pc=[profile(client,x) for x in [a,b,c]]
 assert pa['skills']['effector_choice']['alpha']==9 and pb['skills']['effector_choice']['beta']==2
 assert all(p['observations']==0 for p in pc['skills'].values())
 dashboard=client.get('/api/v1/units/local/dashboard').json()
 assert dashboard['trainee_count']==3 and dashboard['session_count']==2 and dashboard['completed_today']==2
 for skill in SKILLS:assert dashboard['skill_means'][skill]==sum(p['skills'][skill]['mean'] for p in [pa,pb,pc])/3
 counts=Counter()
 for aar in [aar_a,aar_b]:counts.update(code for _,code in {(r['track_id'],r['reason_code']) for r in aar['decision_reviews'] if r['verdict']=='incorrect'})
 assert dashboard['failures']==dict(counts) and counts['NO_RF_JAM_INEFFECTIVE']==1
 assert dashboard['weakest_skill']==min(SKILLS,key=lambda s:dashboard['skill_means'][s])
 for who,p in [(a,pa),(b,pb),(c,pc)]:
  d=client.post('/api/v1/scenarios/generate',json={'mode':'adaptive','seed':2,'trainee':who['trainee_id']}).json()['director_decision']
  assert d['profile_snapshot']==p['skills'] and d['trainee_id']==who['trainee_id']
 assert len(client.get(f"/api/v1/trainees/{a['trainee_id']}/sessions").json()['sessions'])==1
 assert client.get('/api/v1/units/local/dashboard').json()==dashboard

def test_anti_rote_history_does_not_leak_between_trainees(client):
 a,b=join(client,'A'),join(client,'B')
 body=lambda who:{'mode':'adaptive','seed':19,'trainee':who['trainee_id']}
 before=client.post('/api/v1/scenarios/generate',json=body(b)).json()
 spec=client.post('/api/v1/scenarios/generate',json=body(a)).json()
 client.post('/api/v1/sessions',json={'scenario_id':spec['id'],'trainee':a['trainee_id']})
 assert client.post('/api/v1/scenarios/generate',json=body(b)).json()==before
 after=client.post('/api/v1/scenarios/generate',json=body(a)).json()
 assert after['director_decision']['scenario_template']!=spec['director_decision']['scenario_template']

def test_group_assignment_independent_sessions_acceptance_and_results(client):
 people=[join(client,f'T-{i}') for i in range(3)]
 for p in people:presence(client,p)
 body={'request_id':'group-1','trainees':[p['trainee_id'] for p in people],'seed':7,'night':True}
 r=client.post('/api/v1/units/local/exercises',json=body);assert r.status_code==201,r.text
 group=r.json();assert len({x['session_id'] for x in group['results']})==3
 assert client.post('/api/v1/units/local/exercises',json=body).json()==group
 assert client.post('/api/v1/units/local/exercises',json={**body,'seed':8}).status_code==409
 for p in people:
  item=client.get(f"/api/v1/trainees/{p['trainee_id']}/assignment").json()['assignment']
  assert item['exercise_group_id']==group['exercise_group_id'] and item['scenario']['id']==group['scenario_id']
  sid=item['session_id'];assert client.post(f'/api/v1/assignments/{sid}/accept',json={'trainee_id':'other'}).status_code==422
  assert client.post(f'/api/v1/assignments/{sid}/accept',json={'trainee_id':p['trainee_id']}).status_code==200
  assert client.get(f"/api/v1/trainees/{p['trainee_id']}/assignment").json()['assignment'] is None
  aar=finish(client,sid,expert(item['scenario']).events)
  assert aar['exercise_group_id']==group['exercise_group_id'] and aar['unit_id']=='local'
 result=client.get(f"/api/v1/units/local/exercises/{group['exercise_group_id']}").json()
 assert all(r['score']==100 and r['status']=='completed' for r in result['results'])
 assert all(r['node_averages']=={'detect':25,'classify':25,'engage':35} for r in result['results'])

def test_group_rejects_disconnected_busy_and_duplicate_people(client):
 a=join(client,'A');body={'request_id':'g','trainees':[a['trainee_id']]}
 assert client.post('/api/v1/units/local/exercises',json=body).status_code==409
 presence(client,a);assert client.post('/api/v1/units/local/exercises',json={**body,'trainees':[a['trainee_id']]*2}).status_code==422
 _,sid=start(client,a);presence(client,a,sid)
 assert client.post('/api/v1/units/local/exercises',json=body).status_code==409

def test_duplicate_event_batches_are_atomic_under_concurrency(client):
 a=join(client,'A');spec,sid=start(client,a);body={'seq':0,'events':expert(spec).events}
 with ThreadPoolExecutor(max_workers=12) as pool:results=list(pool.map(lambda _:client.post(f'/api/v1/sessions/{sid}/events',json=body),range(24)))
 assert all(r.status_code==200 for r in results)
 assert sum(not r.json()['duplicate'] for r in results)==1

def test_six_concurrent_clients_complete_idempotently_with_own_profiles(client):
 barrier=Barrier(6)
 def run(i):
  who=join(client,f'Load-{i}');spec,sid=start(client,who,900+i,'adaptive');sim=expert(spec)
  barrier.wait(timeout=20)
  for seq,start_index in enumerate(range(0,len(sim.events),3)):
   body={'seq':seq,'events':sim.events[start_index:start_index+3]}
   for _ in range(2):assert client.post(f'/api/v1/sessions/{sid}/events',json=body).status_code==200
   assert client.get(f'/api/v1/sessions/{sid}/commands').json()['commands']==[]
  result=client.post(f'/api/v1/sessions/{sid}/complete',json={'execution_tick':2250});assert result.status_code==200,result.text
  assert result.json()==score(sim)
  assert client.post(f'/api/v1/sessions/{sid}/complete',json={}).json()==result.json()
  aar=client.get(f'/api/v1/sessions/{sid}/aar').json();p=profile(client,who)
  assert aar['verified'] and aar['trainee']==who['trainee_id'] and aar['scenario']==spec
  assert p['sessions']==1 and len(p['outcomes'])==1
  for skill,outcome in session_outcomes(aar).items():
   assert p['skills'][skill]['alpha']==1+outcome['successes'] and p['skills'][skill]['beta']==1+outcome['failures']
  return sid
 with ThreadPoolExecutor(max_workers=6) as pool:sids=list(pool.map(run,range(6)))
 assert len(set(sids))==6
 with storage.connect() as db:assert db.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
 assert client.get('/api/v1/units/local/dashboard').json()['session_count']==6

def test_completion_revalidates_snapshot_without_partial_update(client):
 who=join(client,'A');spec,sid=start(client,who);original=main.build_review
 def change(*args,**kwargs):
  review,card=original(*args,**kwargs)
  with storage.connect() as db:db.execute('INSERT INTO chunks VALUES (?,?,?)',(sid,0,'[]'))
  return review,card
 with patch.object(main,'build_review',side_effect=change):
  r=client.post(f'/api/v1/sessions/{sid}/complete',json={})
 # Empty appended batch leaves the authoritative event list unchanged; still valid.
 assert r.status_code==200
 assert profile(client,who)['sessions']==1

def test_late_log_change_requires_completion_retry(client):
 who=join(client,'A');spec,sid=start(client,who);original=main.build_review
 def change(*args,**kwargs):
  review,card=original(*args,**kwargs)
  with storage.connect() as db:db.execute('INSERT INTO chunks VALUES (?,?,?)',(sid,0,json.dumps([{'tick':30,'k':'designate','track':'T2'}])))
  return review,card
 with patch.object(main,'build_review',side_effect=change):assert client.post(f'/api/v1/sessions/{sid}/complete',json={}).status_code==409
 assert profile(client,who)['sessions']==0
 assert client.post(f'/api/v1/sessions/{sid}/complete',json={'execution_tick':31}).status_code==200

def test_replayed_queued_uploads_after_disconnection_reconstruct(client):
 who=join(client,'A');spec,sid=start(client,who);sim=expert(spec)
 # Browser-equivalent retained immutable batches; lost ACK is retried with the same sequence/payload.
 batches=[sim.events[:6],sim.events[6:]]
 client.post(f'/api/v1/sessions/{sid}/events',json={'seq':0,'events':batches[0]})
 storage.init()  # restart persists the first batch
 for seq,batch in enumerate(batches):assert client.post(f'/api/v1/sessions/{sid}/events',json={'seq':seq,'events':batch}).status_code==200
 assert client.post(f'/api/v1/sessions/{sid}/complete',json={'execution_tick':2250}).json()==score(sim)
 assert profile(client,who)['sessions']==1

def test_diagnostics_do_not_invent_offline_queue_counts(client):
 who=join(client,'A');presence(client,who);r=client.get('/api/v1/units/local/status').json()
 assert r['status']=='healthy' and r['database']=='ok' and r['connected_clients']==1
 assert r['pending_client_sync'] is None


def test_join_retry_after_lost_response_returns_original_identity(client):
 body={'callsign':'Join-retry','request_id':'same-join-request'}
 first=client.post('/api/v1/units/join',json=body).json()
 assert client.post('/api/v1/units/join',json=body).json()==first
 assert client.post('/api/v1/units/join',json={**body,'callsign':'Other'}).status_code==409
 assert len(client.get('/api/v1/units/local/trainees').json()['trainees'])==1


def test_completed_today_uses_completion_not_start_date(client):
 a=join(client,'Yesterday');spec,sid=start(client,a)
 with storage.connect() as db:db.execute("UPDATE sessions SET created_at='2000-01-01T00:00:00+00:00' WHERE id=?",(sid,))
 finish(client,sid,expert(spec).events)
 assert client.get('/api/v1/units/local/dashboard').json()['completed_today']==1
