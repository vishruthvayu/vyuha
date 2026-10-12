import json
import pytest
from server.tests.test_api import client
from server.tests.test_director import complete_run
from server.tests.test_advanced import rapid_run
from server.review import SKILLS
from server import storage

def get(client,who=None,unit='local'):
 r=client.get(f'/api/v1/units/{unit}/skill-heatmap',params={'trainee':who} if who else {})
 assert r.status_code==200,r.text
 return r.json()
def row(data,family):return next(r for r in data['rows'] if r['family']==family)
def join(client,name):return client.post('/api/v1/units/join',json={'callsign':name}).json()['trainee_id']

def test_empty_cells_are_not_prior_evidence(client):
 d=get(client);assert d['included_sessions']==0
 assert d['skills']==SKILLS and len(d['rows'])==10
 assert all(c['observations']==0 and c['estimate'] is None for r in d['rows'] for c in r['cells'].values())

def test_heatmap_exact_persisted_counts_trainee_isolation_and_unit_pool(client):
 a=join(client,'HM-A');b=join(client,'HM-B')
 s=client.post('/api/v1/scenario-library',json={'name':'Heatmap known fixtures','tactic':'DECOY_THEN_STRIKE','mix':['bird','hostile_quad','no_rf_fpv']}).json()
 one,_=complete_run(client,s,a);two,_=complete_run(client,s,b)
 # Explicit test fixture counts in the canonical ledger; never shipped demo data.
 with storage.connect() as db:
  for sid,success,failure in [(one,9,5),(two,2,4)]:
   values={k:dict(successes=0,failures=0) for k in SKILLS};values['effector_choice']=dict(successes=success,failures=failure)
   db.execute('UPDATE skill_outcomes SET outcomes=? WHERE session_id=?',(json.dumps(values),sid))
 d=get(client,a);c=row(d,'DECOY_THEN_STRIKE')['cells']['effector_choice']
 assert c==dict(successes=9,failures=5,sessions=1,observations=14,estimate=10/16)
 c=row(get(client),'DECOY_THEN_STRIKE')['cells']['effector_choice']
 assert c==dict(successes=11,failures=9,sessions=2,observations=20,estimate=12/22)
 assert get(client,b)['included_sessions']==1
 assert get(client,a)==d # no accumulation on repeated reads

def test_rapid_id_only_contributes_classification(client):
 who=join(client,'HM-RAPID');rapid_run(client,who,mistakes=True)
 r=row(get(client,who),'RAPID_ID');assert r['sessions']==1
 assert r['cells']['classification_iff']==dict(successes=6,failures=4,sessions=1,observations=10,estimate=7/12)
 assert all(c['observations']==0 and c['estimate'] is None for k,c in r['cells'].items() if k!='classification_iff')

def test_historical_without_tactic_backfills_once_and_never_invents_family(client):
 who=join(client,'HM-LEGACY');s=client.post('/api/v1/scenarios/generate',json={}).json();sid,aar=complete_run(client,s,who)
 with storage.connect() as db:db.execute('DELETE FROM skill_outcomes WHERE session_id=?',(sid,))
 d=get(client,who);assert row(d,'LEGACY')['sessions']==1 and d['included_sessions']==1
 assert get(client,who)==d
 from server.director import session_outcomes
 expected=session_outcomes(aar)
 for k,v in expected.items():
  c=row(d,'LEGACY')['cells'][k];assert c['successes']==v['successes'] and c['failures']==v['failures']

def test_cross_unit_filter_missing_unit_and_incomplete_sessions(client):
 who=join(client,'HM-SCOPE')
 with storage.connect() as db:db.execute("INSERT INTO units VALUES ('other','Other unit')")
 assert client.get('/api/v1/units/other/skill-heatmap',params={'trainee':who}).status_code==404
 assert client.get('/api/v1/units/missing/skill-heatmap').status_code==404
 assert client.get('/api/v1/units/local/skill-heatmap',params={'trainee':'missing'}).status_code==404
 s=client.post('/api/v1/scenarios/generate',json={}).json();client.post('/api/v1/sessions',json={'scenario_id':s['id'],'trainee':who})
 assert get(client,who)['included_sessions']==0 and get(client,unit='other')['included_sessions']==0


def test_finale_additional_family_is_never_mislabelled_as_legacy(client):
 who=join(client,'HM-SPLIT')
 r=client.post('/api/v1/raids',json={'name':'Heatmap split-swarm QA','family':'SPLIT_SWARM','seed':7,'duration':60,'terrain':'rural'})
 assert r.status_code==201,r.text
 spec=r.json()
 r=client.post('/api/v1/sessions',json={'scenario_id':spec['id'],'trainee':who});assert r.status_code==201
 sid=r.json()['id']
 r=client.post(f'/api/v1/sessions/{sid}/complete',json={'end_tick':1800,'execution_tick':0});assert r.status_code==200,r.text
 data=get(client,who)
 assert row(data,'SPLIT_SWARM')['sessions']==1 and row(data,'LEGACY')['sessions']==0
 assert {'PROBE_AND_RETREAT','BLIND_SECTOR'}<=set(r['family'] for r in data['rows'])
