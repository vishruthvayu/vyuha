"""Real API bundles through the browser's ordinary JSON number conversion."""
import copy,json,subprocess
import pytest
from server import storage
from server.portable import canonical_payload,digest,sign,CANONICALIZATION
from server.tests.test_api import client
from server.tests.test_hardening import KEY,seed_history


def browser_json(value):
 result=subprocess.run(['node','-e','let s="";process.stdin.on("data",x=>s+=x);process.stdin.on("end",()=>process.stdout.write(JSON.stringify(JSON.parse(s))));'],input=json.dumps(value),text=True,capture_output=True,check=True)
 return json.loads(result.stdout)


def exported(client,monkeypatch):
 monkeypatch.setenv('VYUHA_BUNDLE_SECRET',KEY)
 seed_history(client)
 r=client.post('/api/v1/units/local/bundle/export',json={})
 assert r.status_code==200,r.text
 return r.json()


def counts():
 with storage.connect() as db:return tuple(db.execute('SELECT COUNT(*) FROM '+t).fetchone()[0] for t in ['units','trainees','sessions','rapid_sessions','skill_outcomes','recordings'])


def test_actual_browser_reencoding_imports_into_clean_destination_and_deduplicates(client,monkeypatch,tmp_path):
 bundle=exported(client,monkeypatch)
 assert bundle['canonicalization']==CANONICALIZATION
 js=browser_json(bundle)
 # SQLite REAL posterior values really are rewritten by JSON.stringify.
 assert any(type(v['alpha']) is float for skills in bundle['payload']['profiles'].values() for v in skills.values())
 assert all(type(v['alpha']) is int for skills in js['payload']['profiles'].values() for v in skills.values())
 monkeypatch.setattr(storage,'DB_PATH',tmp_path/'destination.db');storage.init()
 response=client.post('/api/v1/bundle/import',json=js)
 assert response.status_code==200,response.text
 assert response.json()['inserted_sessions']==2
 before=counts()
 assert client.post('/api/v1/bundle/import',json=js).json()['skipped_sessions']==2
 assert counts()==before


def test_legacy_original_verifies_but_legacy_reencoded_hmac_does_not(client,monkeypatch):
 bundle=exported(client,monkeypatch)
 legacy=dict(algorithm='HMAC-SHA256',payload=bundle['payload'],hmac=digest(bundle['payload'],KEY.encode()))
 assert client.post('/api/v1/bundle/import',content=json.dumps(legacy),headers={'content-type':'application/json'}).status_code==200
 before=counts()
 response=client.post('/api/v1/bundle/import',json=browser_json(legacy))
 assert response.status_code==422 and response.json()=={'detail':'Bundle integrity check failed; no data imported'}
 assert counts()==before


@pytest.mark.parametrize('mutation',['wrong_key','altered','duplicate','schema','malformed','canonicalization'])
def test_browser_transfer_keeps_integrity_schema_and_reconstruction_gates(client,monkeypatch,mutation):
 bundle=browser_json(exported(client,monkeypatch));payload=bundle['payload']
 if mutation=='wrong_key':monkeypatch.setenv('VYUHA_BUNDLE_SECRET','different-local-test-key-of-at-least-32-bytes')
 elif mutation=='altered':payload['unit']['name']='Altered without resigning'
 elif mutation=='canonicalization':bundle['canonicalization']='unknown-version'
 else:
  if mutation=='duplicate':payload['sessions'].append(copy.deepcopy(payload['sessions'][0]))
  elif mutation=='schema':payload['schema_version']=99
  else:payload['sessions'][0]['scorecard']['score']=999
  bundle=sign(payload,KEY.encode())
 before=counts();response=client.post('/api/v1/bundle/import',json=bundle)
 assert response.status_code==422,response.text
 assert counts()==before


def test_canonical_numbers_and_types_are_explicit_and_version_separated():
 a={'a':1.0,'b':-0.0,'c':1e-7,'d':'日本','e':False}
 b={'e':False,'d':'日本','c':.0000001,'b':0,'a':1}
 assert canonical_payload(a)==canonical_payload(b)
 assert canonical_payload({'v':True})!=canonical_payload({'v':1})
 assert canonical_payload({'v':'1'})!=canonical_payload({'v':1})
 assert digest(a,KEY.encode())!=digest(a,KEY.encode(),CANONICALIZATION)
 for value in [9007199254740992,1e20,float('inf'),float('nan')]:
  with pytest.raises(ValueError):canonical_payload({'value':value})
