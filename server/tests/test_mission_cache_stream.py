import asyncio,json,time
from types import SimpleNamespace
import pytest
from server import storage,query_cache,streams,auth
from server.tests.test_api import client,session

@pytest.fixture(autouse=True)
def reset_cache():
    query_cache.clear();yield;query_cache.clear()

def test_dashboard_cache_is_detached_invalidated_by_commit_and_scoped_to_database(client,tmp_path,monkeypatch):
    from server.units import unit_dashboard
    first=unit_dashboard('local');second=unit_dashboard('local');assert first==second
    assert query_cache.metrics()['hits']>=1
    first['unit']['name']='caller mutation';assert unit_dashboard('local')['unit']['name']!='caller mutation'
    client.post('/api/v1/units/join',json={'callsign':'CACHE-NEW'})
    assert unit_dashboard('local')['trainee_count']==1
    assert query_cache.metrics()['invalidations']>=1
    monkeypatch.setattr(storage,'DB_PATH',tmp_path/'other.db');storage.init()
    assert unit_dashboard('local')['trainee_count']==0

def test_query_cache_caps_entries_expires_and_errors_never_cached(client,monkeypatch):
    for i in range(80):query_cache.cached('test',i,lambda:i)
    assert query_cache.metrics()['entries']==query_cache.LIMIT
    query_cache.clear();calls=[]
    def build():calls.append(1);return {'nested':[len(calls)]}
    query_cache.cached('test','one',build)
    monkeypatch.setattr(query_cache.time,'monotonic',lambda:time.perf_counter()+1000000)
    query_cache.cached('test','one',build);assert len(calls)==2
    def fail():raise ValueError('failed read')
    with pytest.raises(ValueError):query_cache.cached('test','failed',fail)
    assert query_cache.cached('test','failed',lambda:42)==42

def test_stream_cursor_and_authorization_paths(client):
    _,sid=session(client)
    assert client.get(f'/api/v1/sessions/{sid}/command-stream?after=101').status_code==422
    assert client.get(f'/api/v1/sessions/{sid}/command-stream',headers={'Last-Event-ID':'bad'}).status_code==422
    assert client.get('/api/v1/instructor/stream',headers={'Last-Event-ID':'bad'}).status_code==422
    client.headers.pop('Authorization');assert client.get('/api/v1/instructor/stream').status_code==401

def test_open_stream_rechecks_revocation_and_cleans_connection_slot(client):
    request=SimpleNamespace(headers={'authorization':client.headers['Authorization']})
    async def disconnected():return False
    request.is_disconnected=disconnected
    def read(previous):return {'sessions':[]},'a'*64,False
    async def exercise():
        response=streams.response(request,read);it=response.body_iterator
        first=await anext(it);assert b'event: update' in first
        token=auth.bearer(request.headers)
        with auth._LOCK:auth._SESSIONS.pop(auth.token_hash(token),None)
        assert b'auth-expired' in await anext(it)
        with pytest.raises(StopAsyncIteration):await anext(it)
    before=streams._ACTIVE;asyncio.run(exercise());assert streams._ACTIVE==before

def test_command_stream_resumes_prefix_and_stops_completed_without_writes(client):
    _,sid=session(client)
    for i in range(2):client.post(f'/api/v1/instructor/sessions/{sid}/commands',json={'command_id':f'c{i}','type':'pause','payload':{}})
    client.post(f'/api/v1/sessions/{sid}/complete',json={})
    with storage.connect() as db:before=list(db.iterdump())
    request=SimpleNamespace(headers={'last-event-id':'1'})
    async def disconnected():return False
    request.is_disconnected=disconnected
    async def exercise():
        response=streams.command_stream(sid,request,0);it=response.body_iterator
        first=await anext(it);assert b'"seq":2' in first and b'"seq":1,' not in first
        assert b'event: closed' in await anext(it)
        with pytest.raises(StopAsyncIteration):await anext(it)
    asyncio.run(exercise())
    with storage.connect() as db:assert list(db.iterdump())==before

def test_crew_stream_rejects_unauthorized_and_checks_live_expiry(shared,monkeypatch):
    from server import crew
    c=shared['client'];sid=shared['issued']['session_id'];officer=dict(c.headers);c.headers.clear()
    assert c.get(f'/api/v1/sessions/{sid}/command-stream',headers={}).status_code==401
    assert c.get(f'/api/v1/sessions/{sid}/command-stream',headers=shared['headers'][0]|{'Last-Event-ID':'bad'}).status_code==422
    request=SimpleNamespace(headers={k.lower():v for k,v in shared['headers'][0].items()})
    assert streams.authorized(request,sid)
    with storage.connect() as db:expiry=db.execute('SELECT expires_at FROM crew_members WHERE id=?',(shared['issued']['members'][0]['member_id'],)).fetchone()[0]
    monkeypatch.setattr(crew,'capability_time',lambda:expiry)
    assert not streams.authorized(request,sid)
    assert c.get(f'/api/v1/sessions/{sid}/command-stream',headers=shared['headers'][0]).status_code==401
    c.headers.update(officer)

from server.tests.test_crew import shared


@pytest.mark.parametrize('cursor', ['²', '١', '9'*5000, '101', '-1', '1.0', ''])
def test_command_stream_malformed_cursor_fails_closed_without_consuming_slot(client,cursor):
    # Direct request objects retain non-ASCII header text that HTTP clients reject.
    _,sid=session(client)
    request=SimpleNamespace(headers={'last-event-id':cursor})
    before=streams._ACTIVE
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as rejected:
        streams.command_stream(sid,request,0)
    assert rejected.value.status_code==422
    assert streams._ACTIVE==before


def test_command_stream_oversized_http_cursor_returns_validation_error(client):
    _,sid=session(client)
    before=streams._ACTIVE
    response=client.get(f'/api/v1/sessions/{sid}/command-stream',headers={'Last-Event-ID':'9'*5000})
    assert response.status_code==422
    assert response.json()['detail']=='Invalid command cursor'
    assert streams._ACTIVE==before
