import json
from server import storage
from server.engine import score,replay
from server.tests.test_api import client,session

def test_completed_reference_api_is_read_only_cached_copy_and_not_live(client):
    spec,sid=session(client)
    path=f'/api/v1/sessions/{sid}/expert-run'
    assert client.get(path).status_code==409
    assert client.post(f'/api/v1/sessions/{sid}/complete',json=dict(end_tick=2250,execution_tick=0)).status_code==200
    with storage.connect() as db:before=list(db.iterdump())
    result=client.get(path);assert result.status_code==200,result.text
    body=result.json();assert body['reference_score']['score']==100 and body['original_score']['score']==0
    assert client.get(path).json()==body
    assert client.get(path+'?mode=evidence_only').status_code==200
    assert client.get(path+'?mode=pretend_human').status_code==422
    with storage.connect() as db:assert list(db.iterdump())==before

def test_archived_score_marker_is_preserved_and_explicitly_unsupported(client):
    spec,sid=session(client)
    client.post(f'/api/v1/sessions/{sid}/complete',json={})
    with storage.connect() as db:
        card=json.loads(db.execute('SELECT scorecard FROM sessions WHERE id=?',(sid,)).fetchone()[0]);card['engine_version']='vyuha-0.1.0'
        db.execute('UPDATE sessions SET scorecard=? WHERE id=?',(storage.dumps(card),sid));before=list(db.iterdump())
    result=client.get(f'/api/v1/sessions/{sid}/expert-run')
    assert result.status_code==422 and 'ARCHIVED_CONTRACT_UNSUPPORTED' in result.text
    with storage.connect() as db:assert list(db.iterdump())==before


from server.tests.test_crew import shared

def test_crew_reference_route_requires_scoped_role_or_officer(shared):
    c=shared['client'];sid=shared['issued']['session_id'];path=f'/api/v1/sessions/{sid}/expert-run'
    assert c.post('/api/v1/crews/'+shared['cid']+'/complete',json={}).status_code==200
    c.headers.clear()
    assert c.get(path).status_code==401
    assert c.get(path,headers={'X-VYUHA-Crew-Token':'forged'}).status_code==401
    result=c.get(path,headers=shared['headers'][0])
    assert result.status_code==200,result.text
    with storage.connect() as db:assert db.execute('SELECT COUNT(*) FROM skill_outcomes WHERE session_id=?',(sid,)).fetchone()[0]==0
