"""Bounded read-only completed-session reference playback API."""
import copy
import hashlib
import json
import threading
import time
from collections import OrderedDict
from typing import Literal
from fastapi import APIRouter,HTTPException
from . import storage
from .expert_run import run_completed_session,UnsupportedArchivedContract

router=APIRouter(prefix='/api/v1/sessions',tags=['Post-exercise reference run'])
_CACHE=OrderedDict();_LOCK=threading.RLock();TTL=20;MAX_CACHE=16

@router.get('/{session_id}/expert-run')
def expert_run(session_id:str,mode:Literal['canonical_reference','evidence_only']='canonical_reference'):
    from .main import session_record,logged_events,applied_commands
    with storage.connect() as db:
        db.execute('BEGIN')
        row=session_record(db,session_id)
        if row['status']!='completed':raise HTTPException(409,'Reference Run requires a completed frozen session')
        record=dict(status=row['status'],scenario=json.loads(row['spec']),events=logged_events(db,session_id),commands=applied_commands(db,session_id),end_tick=row['end_tick'],execution_tick=row['execution_tick'],scorecard=json.loads(row['scorecard']))
    key=hashlib.sha256(storage.dumps(dict(database=str(storage.DB_PATH.resolve()),session=session_id,mode=mode,record=record)).encode()).hexdigest()
    with _LOCK:
        stamp=time.monotonic()
        for k in list(_CACHE):
            if stamp-_CACHE[k][0]>=TTL:del _CACHE[k]
        if key in _CACHE:
            _CACHE.move_to_end(key);return copy.deepcopy(_CACHE[key][1])
        try:
            result=run_completed_session(record,mode)
            result['session_id']=session_id
        except UnsupportedArchivedContract as error:raise HTTPException(422,error.reason_code+': '+str(error)) from error
        except (ValueError,KeyError,TypeError,OverflowError) as error:raise HTTPException(422,'Reference rollout cannot reconstruct this frozen contract: '+str(error)[:160]) from error
        while len(_CACHE)>=MAX_CACHE:_CACHE.popitem(last=False)
        _CACHE[key]=(time.monotonic(),copy.deepcopy(result))
        return result
