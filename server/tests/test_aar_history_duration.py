"""Lightweight history reports observed time, never the scoring projection."""
import json
import pytest
from server import storage
from server.tests.test_api import client


def dump():
    with storage.connect() as db:
        return list(db.iterdump())


@pytest.mark.parametrize('source', ['completion', 'telemetry', 'last_recorded_event'])
def test_lightweight_history_preserves_observed_horizon_and_original_evidence(client, source):
    who=client.post('/api/v1/units/join',json={'callsign':'EARLY-'+str(len(source))}).json()['trainee_id']
    spec=client.post('/api/v1/scenarios/generate',json={}).json()
    sid=client.post('/api/v1/sessions',json={'scenario_id':spec['id'],'trainee':who}).json()['id']
    event=dict(tick=30,k='designate',track='T1')
    assert client.post(f'/api/v1/sessions/{sid}/events',json={'seq':0,'events':[event]}).status_code==200
    score=client.post(f'/api/v1/sessions/{sid}/complete',json={'end_tick':spec['duration']*30,'execution_tick':30})
    assert score.status_code==200,score.text
    # Frozen legacy rows may lack explicit completion horizons; inference must
    # use retained telemetry or the real last action without rewriting history.
    with storage.connect() as db:
        if source=='telemetry':
            db.execute('UPDATE sessions SET execution_tick=NULL,control_state=? WHERE id=?',(json.dumps({'tick':45}),sid))
        elif source=='last_recorded_event':
            db.execute('UPDATE sessions SET execution_tick=NULL,control_state=NULL WHERE id=?',(sid,))
    expected=45 if source=='telemetry' else 30
    before=dump()
    for _ in range(2):
        full=client.get(f'/api/v1/sessions/{sid}/aar').json()
        assert full['executionTick']==full['replay_metadata']['observed_end_tick']==expected
        assert full['replay_metadata']['horizon_source']==source
        light=client.get(f'/api/v1/sessions/{sid}/aar?include_review=false').json()
        trainee=client.get(f'/api/v1/trainees/{who}/sessions').json()['sessions'][0]
        dashboard=client.get('/api/v1/units/local/dashboard').json()['sessions'][0]
        for result in (light,trainee,dashboard):
            assert result['executionTick']==expected
            assert result['endTick']==spec['duration']*30>expected
            assert result['scorecard']==score.json()
            assert result['events']==full['events']
            assert result['commands']==full['commands']
            assert result['verified'] is True
            assert 'replay_metadata' not in result, 'Keep lightweight reads free of reconstruction'
    assert dump()==before


def test_unplayed_legacy_history_reports_zero_observed_seconds(client):
    who=client.post('/api/v1/units/join',json={'callsign':'EARLY-ZERO'}).json()['trainee_id']
    spec=client.post('/api/v1/scenarios/generate',json={}).json()
    sid=client.post('/api/v1/sessions',json={'scenario_id':spec['id'],'trainee':who}).json()['id']
    result=client.post(f'/api/v1/sessions/{sid}/complete',json={'end_tick':spec['duration']*30})
    assert result.status_code==200,result.text
    before=dump()
    record=client.get(f'/api/v1/trainees/{who}/sessions').json()['sessions'][0]
    assert record['executionTick']==0
    assert record['endTick']==spec['duration']*30
    assert record['scorecard']==result.json()
    assert dump()==before
