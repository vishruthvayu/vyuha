import json
import os
import secrets
import time
from fastapi.testclient import TestClient
from server import auth,storage
from server.main import app
import pytest

@pytest.fixture
def officer(tmp_path,monkeypatch):
    monkeypatch.setattr(storage,'DB_PATH',tmp_path/'secure.db')
    monkeypatch.setenv('VYUHA_AUTH_FILE',str(tmp_path/'officer.json'))
    with auth._LOCK:
        auth._SESSIONS.clear();auth._ATTEMPTS.clear()
    password=secrets.token_urlsafe(24)
    auth.provision(password)
    with TestClient(app) as c:yield c,password

@pytest.mark.parametrize('method,path',[
 ('GET','/api/v1/instructor/sessions'),('GET','/api/v1/instructor/sessions/other'),
 ('POST','/api/v1/instructor/sessions/other/commands'),
 ('POST','/api/v1/units/local/exercises'),('POST','/api/v1/units/local/doctrine'),
 ('POST','/api/v1/scenario-library/preview'),('POST','/api/v1/scenario-library'),
 ('POST','/api/v1/units/local/bundle/export'),('POST','/api/v1/bundle/import'),
 ('POST','/api/v1/recordings'),('POST','/api/v1/evaluations'),
 ('GET','/api/v1/white-cell/sessions'),('GET','/api/v1/white-cell/sessions/other'),
 ('GET','/api/v1/units/local/dashboard'),('GET','/api/v1/units/local/trainees'),
 ('GET','/api/v1/units/local/analytics'),('GET','/api/v1/units/local/skill-heatmap'),
 ('GET','/api/v1/trainees/OTHER/analytics'),('GET','/api/v1/units/local/exercises/other'),
 ('GET','/api/v1/raids'),('GET','/api/v1/raids/other'),('POST','/api/v1/raids'),
 ('GET','/api/v1/crews/catalogue'),('POST','/api/v1/crews'),
 ('POST','/api/v1/crews/other/control'),('POST','/api/v1/crews/other/complete'),
 ('GET','/api/v1/evaluations/other'),('POST','/api/v1/evaluations/other/post')])
def test_officer_operations_fail_closed(officer,method,path):
    c,_=officer
    with storage.connect() as db:before=list(db.iterdump())
    r=c.request(method,path,json={} if method=='POST' else None)
    assert r.status_code==401
    assert c.request(method,path,headers={'Authorization':'Bearer forged'},json={} if method=='POST' else None).status_code==401
    with storage.connect() as db:assert list(db.iterdump())==before

def test_session_is_expiring_revocable_and_not_a_cookie(officer,monkeypatch):
    c,password=officer
    response=c.post('/api/v1/auth/login',json={'password':password})
    assert response.status_code==200 and 'set-cookie' not in response.headers
    token=response.json()['token'];headers={'Authorization':'Bearer '+token}
    assert c.get('/api/v1/instructor/sessions',headers=headers).status_code==200
    assert c.get('/api/v1/auth/session',headers=headers).json()['authenticated']
    assert c.post('/api/v1/auth/logout',json={},headers=headers).status_code==200
    assert c.get('/api/v1/instructor/sessions',headers=headers).status_code==401
    token=c.post('/api/v1/auth/login',json={'password':password}).json()['token']
    with auth._LOCK:auth._SESSIONS[auth.token_hash(token)]=time.monotonic()-1
    assert c.get('/api/v1/instructor/sessions',headers={'Authorization':'Bearer '+token}).status_code==401

def test_provisioning_hash_permissions_and_rate_limit(officer):
    c,password=officer
    content=auth.credential_path().read_text()
    assert password not in content and json.loads(content)['iterations']==600000
    if os.name!='nt':assert auth.credential_path().stat().st_mode&0o777==0o600
    assert auth.verify(password) and not auth.verify('wrong')
    for _ in range(5):assert c.post('/api/v1/auth/login',json={'password':'wrong'}).status_code==401
    assert c.post('/api/v1/auth/login',json={'password':password}).status_code==429
    with pytest.raises(ValueError):auth.provision(password)

def test_trainee_paths_do_not_receive_officer_privilege(officer):
    c,_=officer
    assert c.post('/api/v1/units/join',json={'callsign':'PUBLIC'}).status_code==200
    assert not c.get('/api/v1/auth/session').json()['authenticated']
    assert c.post('/api/v1/auth/login',json={'password':'wrong','role':'instructor'}).status_code==422


def test_every_registered_sensitive_route_rejects_expired_revoked_and_ambient_credentials(officer):
    """Inventory real registrations independently of the middleware selector."""
    import re
    c,password=officer
    def expected(method,path):
        return (path.startswith(('/api/v1/instructor/','/api/v1/white-cell','/api/v1/raids','/api/v1/evaluations'))
            or re.fullmatch(r'/api/v1/trainees/[^/]+/analytics',path)
            or re.fullmatch(r'/api/v1/units/[^/]+/(dashboard|trainees|exercises(?:/[^/]+)?|analytics|skill-heatmap)',path)
            or path in ('/api/v1/crews/catalogue','/api/v1/crews/history','/api/v1/bundle/import')
            or re.fullmatch(r'/api/v1/crews/[^/]+/members(?:/[^/]+/(rotate|revoke))?',path)
            or re.fullmatch(r'/api/v1/units/[^/]+/bundle/export',path)
            or method=='POST' and (path=='/api/v1/crews' or re.fullmatch(r'/api/v1/crews/[^/]+/(control|complete)',path)
                or path.startswith('/api/v1/scenario-library') or path=='/api/v1/recordings'
                or re.fullmatch(r'/api/v1/units/[^/]+/(exercises|doctrine)',path)))
    routes=[(method.upper(),path) for path,methods in app.openapi()['paths'].items() for method in methods if method.upper() in ('GET','POST','PUT','DELETE','PATCH') and expected(method.upper(),path)]
    assert len(routes)>=32
    revoked=c.post('/api/v1/auth/login',json={'password':password}).json()['token']
    c.post('/api/v1/auth/logout',headers={'Authorization':'Bearer '+revoked},json={})
    expired=c.post('/api/v1/auth/login',json={'password':password}).json()['token']
    with auth._LOCK:auth._SESSIONS[auth.token_hash(expired)]=time.monotonic()-1
    with storage.connect() as db:before=list(db.iterdump())
    for method,path in routes:
        url=re.sub(r'\{[^}]+\}','inventory-placeholder',path)
        for headers in [{},{'Authorization':'Bearer forged'},{'Authorization':'Bearer '+expired},{'Authorization':'Bearer '+revoked},{'Cookie':'officer=pretend','Origin':'https://untrusted.example'}]:
            result=c.request(method,url,headers=headers,json={} if method!='GET' else None)
            assert result.status_code==401,(method,path,result.status_code)
    with storage.connect() as db:assert list(db.iterdump())==before
