import copy
import pytest
from server.tests.test_api import client
from server.observation_missions import MissionRequest,TEMPLATES,compile_mission,validate_mission,rehearse
from server.acquisition import validate_snapshot_v3
from server.engine import Simulation,replay
from server.storage import connect

@pytest.mark.parametrize('template',list(TEMPLATES))
def test_frozen_missions_are_reproducible_portable_and_have_actual_attainable_probes(template):
 request=MissionRequest(template=template)
 s=compile_mission(request)
 assert compile_mission(request)==s
 validate_snapshot_v3(s)
 report=rehearse(s)
 assert report['attainable_probe'],report['checks']
 assert 1<=len(report['request_schedule'])<=12
 sim=replay(s,report['request_schedule'],s['duration']*30)
 assert sim.acquisition_snapshot()['results']==report['results']
 assert 'rehearsal' not in s and 'results' not in s['observation_mission']
 bad=copy.deepcopy(s);bad['observation_mission']['objectives'][0]='Forged objective'
 with pytest.raises(ValueError):validate_mission(bad)
 bad=copy.deepcopy(s);bad['acquisition_policy']['expiryTicks']+=1
 with pytest.raises(ValueError):validate_snapshot_v3(bad)


def test_missions_are_distinct_information_problems_and_assessment_suppresses_live_advice():
 scenarios=[compile_mission(MissionRequest(template=k)) for k in TEMPLATES]
 assert len({s['id'] for s in scenarios})==3
 assert [s['night'] for s in scenarios]==[True,False,False]
 assert len({s['acquisition_policy']['expiryTicks'] for s in scenarios})==3
 assert len({s['terrain'] for s in scenarios})==2
 assert scenarios[-1]['raid']['family']=='LOW_APPROACH'
 assessment=compile_mission(MissionRequest(mode='assessment'))
 assert assessment['fusion']['mode']=='assessment'
 assert assessment['observation_mission']['assessment_version']=='evidence-assessment-v1'
 assert all(s['engine_version']=='vyuha-0.5.0' for s in scenarios)


def test_mission_api_security_pure_preview_frozen_admission_and_custom_rejection(client):
 auth=client.headers.pop('Authorization')
 assert client.get('/api/v1/observation-missions/catalog').status_code==200
 for endpoint in ('compile','publish'):
  assert client.post('/api/v1/observation-missions/'+endpoint,json={}).status_code==401
 assert client.post('/api/v1/observation-missions/prepare',json={'template':'night_switch','fog':.1}).status_code==422
 prepared=client.post('/api/v1/observation-missions/prepare',json={'template':'civil_restraint','seed':77,'mode':'practice'})
 assert prepared.status_code==200,prepared.text
 s=prepared.json()
 assert client.get('/api/v1/observation-missions/'+s['id']).json()==s
 client.headers['Authorization']=auth
 before=None
 with connect() as db:before=db.execute('SELECT COUNT(*) FROM scenarios').fetchone()[0]
 preview=client.post('/api/v1/observation-missions/compile',json={'template':'timed_window','title':'A timed evidence challenge'})
 assert preview.status_code==200,preview.text
 with connect() as db:assert db.execute('SELECT COUNT(*) FROM scenarios').fetchone()[0]==before
 saved=client.post('/api/v1/observation-missions/publish',json={'template':'timed_window','title':'A timed evidence challenge'})
 assert saved.status_code==200,saved.text
 assert saved.json()==preview.json()['scenario']
 assert client.post('/api/v1/observation-missions/publish',json={'title':'   '}).status_code==422
 assert client.get('/api/v1/observation-missions/raid_000000000000000000000000').status_code==404


def test_v1_compiler_preserves_frozen_default_semantics_without_rebasing_fixtures():
    import json
    from pathlib import Path
    path=Path(__file__).parent/'fixtures/observation-missions-v1.json'
    fixture=json.loads(path.read_text())
    assert fixture['version']=='observation-mission-v1-frozen-defaults'
    for case in fixture['cases']:
        assert compile_mission(MissionRequest.model_validate(case['request']))==case['scenario'], 'Changing v1 defaults requires a new mission version, not rewriting this fixture'
        validate_mission(case['scenario'])
