"""Officer authentication: hashed provisioning secret and expiring bearer sessions.

No authentication cookies are issued. Browsers send Authorization explicitly, so
cross-site requests do not acquire ambient officer credentials. LAN TLS is still
required to keep the password and bearer session confidential on the network.
"""
import hashlib
import hmac
import json
import os
import re
import secrets
import threading
import time
from pathlib import Path
from starlette.responses import JSONResponse

ITERATIONS = 600_000
TTL = 8 * 3600
_LOCK = threading.Lock()
_SESSIONS = {}
_ATTEMPTS = {}

def credential_path():
    from .storage import DB_PATH
    return Path(os.environ.get('VYUHA_AUTH_FILE', DB_PATH.parent / 'officer-auth.json'))

def provision(password, path=None):
    if not isinstance(password,str) or not 12 <= len(password) <= 256:
        raise ValueError('Use an officer password of 12–256 characters')
    path = Path(path) if path else credential_path()
    if path.exists():
        raise ValueError('Officer credential already exists; rotate explicitly with the server stopped')
    path.parent.mkdir(parents=True, exist_ok=True)
    salt = secrets.token_hex(32)
    digest = hashlib.pbkdf2_hmac('sha256',password.encode(),bytes.fromhex(salt),ITERATIONS).hex()
    with path.open('x') as f:
        os.chmod(path,0o600)
        json.dump({'version':1,'salt':salt,'digest':digest,'iterations':ITERATIONS},f)
    return path

def verify(password):
    try:
        c=json.loads(credential_path().read_text())
        if c['version']!=1 or c['iterations']!=ITERATIONS:return False
        digest=hashlib.pbkdf2_hmac('sha256',password.encode(),bytes.fromhex(c['salt']),ITERATIONS).hex()
        return hmac.compare_digest(digest,c['digest'])
    except (OSError,ValueError,KeyError,TypeError):return False

def protected(method,path):
    if method=='POST' and path in ['/api/v1/observation-missions/compile','/api/v1/observation-missions/publish','/api/v1/observation-missions-v2/compile','/api/v1/observation-missions-v2/publish','/api/v1/observation-missions-v3/compile','/api/v1/observation-missions-v3/publish']:
        return True
    if re.fullmatch(r'/api/v1/units/[^/]+/exercises/[^/]+/observation-evidence',path):return True
    if path.startswith('/api/v1/instructor/') or path.startswith('/api/v1/white-cell') or path.startswith('/api/v1/raids'):
        return True
    if re.fullmatch(r'/api/v1/trainees/[^/]+/analytics',path) or path=='/api/v1/evaluations' or path.startswith('/api/v1/evaluations/'):
        return True
    if path in ['/api/v1/crews/catalogue','/api/v1/crews/history','/api/v1/crews/manage'] or re.fullmatch(r'/api/v1/crews/[^/]+/members(?:/[^/]+/(?:rotate|revoke))?',path):return True
    if method=='POST' and (path=='/api/v1/crews' or re.fullmatch(r'/api/v1/crews/[^/]+/(control|complete)',path)):return True
    if path in ['/api/v1/bundle/import'] or re.fullmatch(r'/api/v1/units/[^/]+/bundle/export',path):return True
    if re.fullmatch(r'/api/v1/units/[^/]+/(dashboard|trainees|exercises(?:/[^/]+)?|analytics|skill-heatmap)',path):return True
    if method=='POST' and (path.startswith('/api/v1/scenario-library') or path=='/api/v1/recordings' or path=='/api/v1/evaluations' or re.fullmatch(r'/api/v1/units/[^/]+/(exercises|doctrine)',path)):
        return True
    return False

def token_hash(token):return hashlib.sha256(token.encode()).hexdigest()
def valid(token):
    with _LOCK:
        now=time.monotonic()
        for k,expiry in list(_SESSIONS.items()):
            if expiry<=now:del _SESSIONS[k]
        return _SESSIONS.get(token_hash(token),0)>now

def bearer(headers):
    value=headers.get('authorization','')
    return value[7:] if value.startswith('Bearer ') else ''

class OfficerAuthorization:
    def __init__(self,app):self.app=app
    async def __call__(self,scope,receive,send):
        if scope['type']=='http' and protected(scope['method'],scope['path']):
            headers={k.decode('latin-1').lower():v.decode('latin-1') for k,v in scope.get('headers',[])}
            if not valid(bearer(headers)):
                return await JSONResponse({'detail':'Officer sign-in required'},status_code=401,headers={'WWW-Authenticate':'Bearer'})(scope,receive,send)
        return await self.app(scope,receive,send)

def install(app):
    from fastapi import Request,HTTPException
    from pydantic import BaseModel,ConfigDict,Field
    class Login(BaseModel):
        model_config=ConfigDict(extra='forbid')
        password:str=Field(min_length=1,max_length=256)
    # Resolve local types for FastAPI's annotation inspection.
    @app.post('/api/v1/auth/login')
    def login(body:Login,request:Request):
        address=request.client.host if request.client else 'unknown'
        now=time.monotonic()
        with _LOCK:
            for key,attempts in list(_ATTEMPTS.items()):
                if not attempts or now-attempts[-1]>=300:_ATTEMPTS.pop(key,None)
            if len(_ATTEMPTS)>=1024 and address not in _ATTEMPTS:raise HTTPException(429,'Sign-in service busy; retry later')
            recent=[t for t in _ATTEMPTS.get(address,[]) if now-t<300]
            if len(recent)>=5:raise HTTPException(429,'Too many sign-in attempts; wait five minutes')
            _ATTEMPTS[address]=recent+[now]
        if not verify(body.password):raise HTTPException(401,'Invalid officer credential or officer setup missing')
        token=secrets.token_urlsafe(48)
        with _LOCK:
            _ATTEMPTS.pop(address,None)
            if len(_SESSIONS)>=256:_SESSIONS.pop(next(iter(_SESSIONS)),None)
            _SESSIONS[token_hash(token)]=time.monotonic()+TTL
        return {'token':token,'role':'instructor','expires_in':TTL}
    @app.get('/api/v1/auth/session')
    def session(request:Request):
        return {'authenticated':valid(bearer(request.headers)),'role':'instructor' if valid(bearer(request.headers)) else None,'configured':credential_path().is_file()}
    @app.post('/api/v1/auth/logout')
    def logout(request:Request):
        with _LOCK:_SESSIONS.pop(token_hash(bearer(request.headers)),None)
        return {'signed_out':True}
    app.add_middleware(OfficerAuthorization)
