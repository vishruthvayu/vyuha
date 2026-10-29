"""Semantic site contracts, real LOS timing, portable verified evidence and isolation."""
import copy
import json
import math
from pathlib import Path
import pytest
from server.tests.test_api import client
from server.training_sites import training_site, terrain_boxes, validate_site, SITE_IDS
from server.observation_missions_v3 import compile_mission, validate_snapshot, rehearse
from server.engine import Simulation, replay, score


@pytest.mark.parametrize('site_id', SITE_IDS)
def test_public_site_is_bounded_deterministic_and_exact_authoritative_geometry(site_id):
    site = training_site(site_id)
    assert site == training_site(site_id)
    assert validate_site(site) is site
    assert len(site['structures']) <= 12 and len(site['surfaces']) <= 24 and len(site['landmarks']) <= 12
    for structure in site['structures']:
        assert structure['x_max']-structure['x_min'] > 1
        assert structure['z_max']-structure['z_min'] > 1
        assert 2 <= structure['height'] <= 60
        for key in ('x_min', 'x_max', 'z_min', 'z_max'):
            assert math.isfinite(structure[key]) and abs(structure[key]) <= 1200
        assert not structure['x_min']-16 <= 0 <= structure['x_max']+16 or not structure['z_min']-16 <= 0 <= structure['z_max']+16
    for surface in site['surfaces']:
        assert all(math.isfinite(v) and abs(v) <= 1200 for p in surface['path'] for v in p)
        if 'width' in surface:
            assert 0 < surface['width'] <= 80
    for landmark in site['landmarks']:
        assert all(math.isfinite(v) and abs(v) <= 1200 for v in landmark['position'].values())
    s = compile_mission({'site': site_id})
    assert s['terrain_boxes'] == terrain_boxes(site)
    assert set(site) == {'version', 'id', 'title', 'summary', 'structures', 'surfaces', 'landmarks'}
    assert 'tracks' not in site and 'outcomes' not in site
    site['structures'][0]['height'] += 1
    with pytest.raises(ValueError):
        validate_site(site)
    assert training_site(site_id)['structures'][0]['height'] != site['structures'][0]['height']


@pytest.mark.parametrize('site_id', SITE_IDS)
def test_site_rehearsal_uses_real_engine_reports_and_actual_los_loss_reacquisition(site_id):
    s = compile_mission({'site': site_id})
    validate_snapshot(s)
    report = rehearse(s)
    intervals = report['site_geometry']['line_of_sight_intervals']
    assert report['site_geometry']['clear_after_occlusion']
    assert any(i['clear'] for i in intervals) and any(not i['clear'] for i in intervals)
    assert all(a['end_tick'] == b['start_tick'] for a, b in zip(intervals, intervals[1:]))
    sim = replay(s, report['request_schedule'], s['duration']*30)
    assert sim.acquisition_snapshot()['results'] == report['results']
    assert report['attainable_probe'], report['checks']
    assert report['coverage']['published_results'] and report['coverage']['optical_detections']
    assert 'site_geometry' not in s and 'request_schedule' not in s['training_site']


def test_frozen_site_definitions_and_v1_v2_compilers_are_not_rebased():
    fixture = json.loads((Path(__file__).parent/'fixtures/observation-missions-v3.json').read_text())
    for case in fixture['cases']:
        assert compile_mission(case['request']) == case['scenario']
        validate_snapshot(case['scenario'])
    from server.observation_missions import compile_mission as v1
    from server.observation_missions_v2 import compile_mission as v2
    for version, compiler in [(1, v1), (2, v2)]:
        frozen = json.loads((Path(__file__).parent/f'fixtures/observation-missions-v{version}.json').read_text())
        for case in frozen['cases']:
            assert compiler(case['request']) == case['scenario']
            assert 'training_site' not in case['scenario']


def test_site_compiler_rejects_forged_topology_metadata_and_future_contract():
    s = compile_mission({})
    for mutate in [
        lambda x: x['training_site']['structures'][0].update(height=3),
        lambda x: x['training_site']['landmarks'][0]['position'].update(x=999),
        lambda x: x['training_site'].update(version='future'),
        lambda x: x['terrain_boxes'][0].update(height=3),
        lambda x: x['tracks'][0].update(altitude=500),
        lambda x: x['observation_mission']['authoring'].update(site='open_campus'),
    ]:
        forged = copy.deepcopy(s)
        mutate(forged)
        from server.raid_v2 import raid_id
        forged['id'] = raid_id(forged)
        with pytest.raises(ValueError):
            validate_snapshot(forged)
    for body in [dict(site='future'), dict(version='observation-mission-v2'), dict(site={'id': 'freight_corridor'})]:
        with pytest.raises(ValueError):
            compile_mission(body)


def test_v3_api_keeps_authoring_protected_pure_and_published_admission_exact(client):
    auth = client.headers.pop('Authorization')
    for endpoint in ('compile', 'publish'):
        assert client.post('/api/v1/observation-missions-v3/'+endpoint, json={}).status_code == 401
    assert client.get('/api/v1/observation-missions-v3/catalog').json()['sites'][0]['id'] == 'freight_corridor'
    assert client.post('/api/v1/observation-missions-v3/prepare', json={'site':'future'}).status_code == 422
    assert client.post('/api/v1/observation-missions-v3/prepare', json={'fog':.1}).status_code == 422
    request = dict(site='open_campus', template='civil_restraint', seed=587642, mode='assessment')
    prepared = client.post('/api/v1/observation-missions-v3/prepare', json=request)
    assert prepared.status_code == 200, prepared.text
    s = prepared.json()
    assert s['fusion']['mode'] == 'assessment'
    assert client.get('/api/v1/observation-missions-v3/'+s['id']).json() == s
    client.headers['Authorization'] = auth
    from server.storage import connect
    with connect() as db:
        before = db.execute('SELECT COUNT(*) FROM scenarios').fetchone()[0]
    preview = client.post('/api/v1/observation-missions-v3/compile', json=request)
    assert preview.status_code == 200, preview.text
    with connect() as db:
        assert db.execute('SELECT COUNT(*) FROM scenarios').fetchone()[0] == before
    published = client.post('/api/v1/observation-missions-v3/publish', json=request)
    assert published.json() == preview.json()['scenario'] == s
    assert any(m['id'] == s['id'] and m['mission_version'] == 3 and m['site'] == 'open_campus'
               for m in client.get('/api/v1/observation-missions-v3/catalog').json()['missions'])


def test_site_mission_completion_assessment_transfer_restore_and_mastery_isolation(client, monkeypatch, tmp_path):
    from server import storage
    from server.tests.test_hardening import KEY
    s = client.post('/api/v1/observation-missions-v3/prepare', json={'site':'open_campus','mode':'assessment'}).json()
    sid = client.post('/api/v1/sessions', json={'scenario_id':s['id'],'trainee':'SITE-QA'}).json()['id']
    sim = Simulation(s)
    while sim.tick < 300:
        sim.step(force=True)
    t = next(t for t in sim.tracks if t['active'] and t['detected'] is not None)
    assert sim.act(dict(tick=sim.tick, order=sim.next_order, k='inspect', track=t['id'], channel='ir', request_id='site_ir'))
    while sim.tick < 345:
        sim.step(force=True)
    assert sim.act(dict(tick=sim.tick, order=sim.next_order, k='defer', track=t['id'], decision_version='uncertainty-decisions-v1', reason='affiliation_unresolved'))
    assert client.post(f'/api/v1/sessions/{sid}/events',json={'seq':0,'events':sim.events}).status_code == 200
    assert client.post(f'/api/v1/sessions/{sid}/complete',json={'end_tick':2700,'execution_tick':360}).status_code == 200
    original = client.get(f'/api/v1/sessions/{sid}/aar').json()
    assert original['verified']
    report = original['observation_assessment']
    assert report['version'] == 'evidence-assessment-v2' and report['mission_version'] == 'observation-mission-v3'
    assert report['summary']['mastery_awarded'] is False
    assert 'mission_version=3&mission_site=open_campus' in report['follow_up']['href']
    assert any(d['action']['k'] == 'defer' for d in report['decisions'])
    assert client.get('/api/v1/trainees/SITE-QA/profile').json()['sessions'] == 0
    p = client.get('/api/v1/observation-learning/trainees/SITE-QA/progression').json()
    assert p['version'] == 'observation-progression-v3' and p['assessment']['sessions'] == 1
    assert 'mission_version=3&mission_site=open_campus' in p['recommendation']['href']
    with storage.connect() as db:
        assert db.execute('SELECT COUNT(*) FROM skill_outcomes WHERE trainee=?', ('SITE-QA',)).fetchone()[0] == 0
    monkeypatch.setenv('VYUHA_BUNDLE_SECRET', KEY)
    bundle = client.post('/api/v1/units/local/bundle/export',json={})
    assert bundle.status_code == 200, bundle.text
    monkeypatch.setattr(storage, 'DB_PATH', tmp_path/'site-restored.db')
    storage.init()
    restored = client.post('/api/v1/bundle/import',json=bundle.json())
    assert restored.status_code == 200, restored.text
    imported = client.get(f'/api/v1/sessions/{sid}/aar').json()
    assert imported['scenario'] == original['scenario']
    assert imported['events'] == original['events'] and imported['scorecard'] == original['scorecard']
    assert imported['observation_assessment'] == report
    assert client.post('/api/v1/bundle/import',json=bundle.json()).json()['skipped_sessions'] == 1
