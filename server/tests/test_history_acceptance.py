"""Historical acceptance separates training, Rapid ID and Crew evidence exactly."""
import importlib.util
import sqlite3
from pathlib import Path
import httpx
import pytest
from fastapi.testclient import TestClient
from server import storage
from server.tests.test_api import client
from server.tests.test_advanced import rapid_run
from server.tests.test_crew import shared
from server.tests.test_director import complete_run

spec=importlib.util.spec_from_file_location('history_acceptance_script', Path(__file__).resolve().parents[2]/'scripts/check-finale-history.py')
history=importlib.util.module_from_spec(spec)
spec.loader.exec_module(history)

def backup(path):
    with storage.connect() as source, sqlite3.connect(path) as target:
        source.backup(target)

@pytest.fixture
def mixed_history(client,tmp_path):
    who=client.post('/api/v1/units/join',json={'callsign':'HISTORY-MIXED'}).json()['trainee_id']
    scenario=client.post('/api/v1/scenarios/generate',json={}).json()
    complete_run(client,scenario,who,events=[],end=0)
    baseline=tmp_path/'baseline.db';backup(baseline)
    rapid_run(client,who,mistakes=True)
    source=tmp_path/'mixed.db';backup(source)
    return source,baseline

def test_real_rapid_id_does_not_fail_or_inflate_training_history(mixed_history):
    source,baseline=mixed_history
    before=source.read_bytes()
    result=history.validate(source,baseline)
    assert result['historical_completed']==result['all_current_completed_readable']==1
    assert result['heatmap_included_current_sessions']==1
    assert result['heatmap_included_rapid_sessions']==1
    assert result['heatmap_included_total_sessions']==2
    assert result['shared_completed_sessions_excluded_from_individual_heatmap']==0
    assert result['exact_stored_cards_preserved'] and source.read_bytes()==before

@pytest.mark.parametrize('family',['LEGACY','RAPID_ID'])
def test_mismatched_disaggregated_heatmap_is_rejected(mixed_history,monkeypatch,family):
    original=TestClient.get
    def changed(self,url,*args,**kwargs):
        response=original(self,url,*args,**kwargs)
        if str(url).endswith('/skill-heatmap'):
            body=response.json()
            next(r for r in body['rows'] if r['family']==family)['sessions']+=1
            body['included_sessions']+=1
            return httpx.Response(200,json=body)
        return response
    monkeypatch.setattr(TestClient,'get',changed)
    with pytest.raises(AssertionError,match='heatmap count changed'):
        history.validate(*mixed_history)

def test_completed_shared_result_is_readable_but_not_individual_heatmap_credit(shared,tmp_path):
    client=shared['client'];cid=shared['issued']['id']
    assert client.post(f'/api/v1/crews/{cid}/complete',json={}).status_code==200
    source=tmp_path/'crew-history.db';backup(source)
    baseline=tmp_path/'crew-baseline.db';backup(baseline)
    result=history.validate(source,baseline)
    assert result['all_current_completed_readable']==1
    assert result['heatmap_included_current_sessions']==0
    assert result['heatmap_included_rapid_sessions']==0
    assert result['heatmap_included_total_sessions']==0
    assert result['shared_completed_sessions_excluded_from_individual_heatmap']==1
