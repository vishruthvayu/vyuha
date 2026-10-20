"""Bounded SSE notifications, explicit bearer headers, immutable POST acknowledgments.

The server samples SQLite every250ms, emits only changed snapshots/commands and
heartbeats. This removes repeated client GET handshakes, not all database polling.
"""
import asyncio,hashlib,json,time,threading
from fastapi import APIRouter,Request,Query,HTTPException
from fastapi.responses import StreamingResponse
from . import storage,auth

router=APIRouter(prefix='/api/v1',tags=['Streams'])
INTERVAL=.25
MAX_SECONDS=120
MAX_CONNECTIONS=32
_LOCK=threading.Lock();_ACTIVE=0

def frame(event,data,cursor=None):
    return (('id: '+str(cursor)+'\n' if cursor is not None else '')+'event: '+event+'\ndata: '+storage.dumps(data)+'\n\n').encode()

def authorized(request,sid=None):
    if auth.valid(auth.bearer(request.headers)):return True
    if sid is None:return False
    from .crew import capability_valid
    with storage.connect() as db:
        shared=db.execute('SELECT id FROM crews WHERE session_id=?',(sid,)).fetchone()
        archive=db.execute('SELECT 1 FROM crew_archive WHERE session_id=?',(sid,)).fetchone()
        if archive:return False
        if not shared:return True # same explicitly trusted-LAN session capability as GET commands
        token=request.headers.get('x-vyuha-crew-token','')
        member=db.execute('SELECT * FROM crew_members WHERE crew_id=? AND token_hash=?',(shared['id'],hashlib.sha256(token.encode()).hexdigest())).fetchone() if token else None
        return capability_valid(member)

async def notifications(request,reader,*,sid=None,cursor=None):
    global _ACTIVE
    previous=cursor;started=time.monotonic();heartbeat=started;first=True
    try:
        while time.monotonic()-started<MAX_SECONDS:
            if await request.is_disconnected():return
            if not authorized(request,sid):
                yield frame('auth-expired',{'detail':'Stream authorization expired or was revoked'});return
            data,new_cursor,complete=await asyncio.to_thread(reader,previous)
            if first or new_cursor!=previous:
                first=False;previous=new_cursor;yield frame('update',data,previous);heartbeat=time.monotonic()
            elif time.monotonic()-heartbeat>=10:
                yield b': heartbeat\n\n';heartbeat=time.monotonic()
            if complete:
                yield frame('closed',{'reason':'Session completed'});return
            await asyncio.sleep(INTERVAL)
        yield frame('closed',{'reason':'Reconnect bounded stream'})
    finally:
        with _LOCK:_ACTIVE-=1

def response(request,reader,**kwargs):
    global _ACTIVE
    with _LOCK:
        if _ACTIVE>=MAX_CONNECTIONS:raise HTTPException(429,'Stream limit reached; use polling fallback')
        _ACTIVE+=1
    return StreamingResponse(notifications(request,reader,**kwargs),media_type='text/event-stream',headers={'Cache-Control':'no-store','X-Accel-Buffering':'no','X-Content-Type-Options':'nosniff'})

@router.get('/instructor/stream')
def instructor_stream(request:Request):
    from .main import instructor_sessions
    if not authorized(request):raise HTTPException(401,'Officer sign-in required')
    cursor=request.headers.get('last-event-id')
    if cursor and (len(cursor)!=64 or any(c not in '0123456789abcdef' for c in cursor)):raise HTTPException(422,'Invalid snapshot cursor')
    def read(previous):
        data=instructor_sessions();digest=hashlib.sha256(storage.dumps(data).encode()).hexdigest()
        return data,digest,False
    return response(request,read,cursor=cursor)

@router.get('/sessions/{sid}/command-stream')
def command_stream(sid:str,request:Request,after:int=Query(default=0,ge=0,le=100)):
    from .main import session_record,command_records
    with storage.connect() as db:session_record(db,sid)
    if not authorized(request,sid):raise HTTPException(401,'Crew membership or officer sign-in required')
    raw=request.headers.get('last-event-id')
    if raw is not None:
        # Only server-issued ASCII sequence IDs are valid. Unicode isdigit()
        # also accepts characters int() cannot parse; bound length before int()
        # so oversized headers cannot trigger Python's integer conversion limit.
        if not 1<=len(raw)<=3 or not raw.isascii() or not raw.isdecimal() or not 0<=int(raw)<=100:
            raise HTTPException(422,'Invalid command cursor')
        after=max(after,int(raw))
    def read(previous):
        with storage.connect() as db:
            row=session_record(db,sid);commands=command_records(db,sid,previous or 0)
            return {'commands':commands},commands[-1]['seq'] if commands else previous,row['status']=='completed'
    return response(request,read,sid=sid,cursor=after)
