#!/usr/bin/env python3
"""Read historical sessions using a disposable SQLite backup; output aggregates only."""
import sys,json,sqlite3,hashlib,tempfile
from pathlib import Path
root=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(root))
from fastapi.testclient import TestClient
from server import storage
from server.main import app
def rows(p):
 with sqlite3.connect(f'file:{p}?mode=ro',uri=True) as db:return db.execute("SELECT id,trainee,scenario_id,created_at,status,scorecard,end_tick FROM sessions WHERE status='completed' ORDER BY id").fetchall()
src=root/'data/vyuha.db';before=rows(src);baseline=rows(root/'data/stage5-before-stage6.db');assert len(baseline)==18;by_id={row[0]:row for row in before};assert all(by_id.get(row[0])==row for row in baseline)
with tempfile.TemporaryDirectory() as folder:
 target=Path(folder)/'history.db'
 with sqlite3.connect(f'file:{src}?mode=ro',uri=True) as original,sqlite3.connect(target) as copy:original.backup(copy)
 storage.DB_PATH=target
 with TestClient(app) as client:
  versions={};people=set()
  for row in before:
   aar=client.get(f'/api/v1/sessions/{row[0]}/aar').json()
   assert aar['verified'] and aar['scorecard']==json.loads(row[5])
   assert 'timeline' in aar and 'decision_reviews' in aar
   v=aar['scorecard']['engine_version'];versions[v]=versions.get(v,0)+1;people.add(row[1])
  for person in people:
   assert len(client.get(f'/api/v1/trainees/{person}/profile').json()['skills'])==4
  units=[r['id'] for r in storage.connect().execute('SELECT id FROM units')]
  maps=[client.get(f'/api/v1/units/{uid}/skill-heatmap').json() for uid in units]
  assert sum(m['included_sessions'] for m in maps)==len(before)
 assert rows(target)==before
assert rows(src)==before
out=dict(historical_completed=18,additional_current_completed=len(before)-18,all_current_completed_readable=len(before),stored_engine_versions=versions,exact_stored_cards_preserved=True,all_verified_aar_ghost_timelines_readable=True,all_four_skill_profiles_readable=True,heatmap_included_current_sessions=len(before),historical_immutable_fields_sha256=hashlib.sha256(json.dumps(baseline,separators=(',',':')).encode()).hexdigest(),current_immutable_fields_sha256=hashlib.sha256(json.dumps(before,separators=(',',':')).encode()).hexdigest(),production_database_unchanged=True,scope='Aggregate only; raw private records remain outside Git/submission. Checked on a disposable backup.')
(root/'docs/qa-navigation/history.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
