"""Small revision-checked read cache; no learning, identity or score writes.

SQLite data_version is meaningful only on a retained observer connection. Every
commit from another connection invalidates the cache, including imports/recovery.
The half-second TTL also bounds live-status ageing when no database write occurs.
"""
import copy,sqlite3,threading,time
from collections import OrderedDict
from pathlib import Path
from . import storage

TTL=.5
LIMIT=64
DB_LIMIT=8
_LOCK=threading.RLock()
_ENTRIES=OrderedDict()
_OBSERVERS=OrderedDict()
_STATS={'hits':0,'misses':0,'invalidations':0}

def clear():
    with _LOCK:
        _ENTRIES.clear()
        for connection in _OBSERVERS.values():connection.close()
        _OBSERVERS.clear()
        for k in _STATS:_STATS[k]=0

def _observer():
    path=storage.DB_PATH.resolve();identity=(str(path),path.stat().st_ino)
    connection=_OBSERVERS.get(identity)
    if connection is None:
        connection=sqlite3.connect(path.as_uri()+'?mode=ro',uri=True,check_same_thread=False,timeout=15)
        _OBSERVERS[identity]=connection
        while len(_OBSERVERS)>DB_LIMIT:
            dead,conn=_OBSERVERS.popitem(last=False);conn.close()
            for key in list(_ENTRIES):
                if key[0]==dead:_ENTRIES.pop(key)
    _OBSERVERS.move_to_end(identity)
    return identity,connection

def cached(namespace,key,build):
    # Serialize construction to prevent a stampede of duplicate expensive reads.
    with _LOCK:
        identity,observer=_observer();version=observer.execute('PRAGMA data_version').fetchone()[0]
        cache_key=(identity,namespace,key);now=time.monotonic();entry=_ENTRIES.get(cache_key)
        if entry and entry[1]==version and now-entry[0]<TTL:
            _STATS['hits']+=1;_ENTRIES.move_to_end(cache_key);return copy.deepcopy(entry[2])
        if entry:_STATS['invalidations']+=1
        _STATS['misses']+=1
        result=build()
        after=observer.execute('PRAGMA data_version').fetchone()[0]
        # Legacy profile/stat backfill or a concurrent writer means no coherent
        # revision can be cached. Return its ordinary result, build again next time.
        if version==after:
            _ENTRIES[cache_key]=(time.monotonic(),version,copy.deepcopy(result));_ENTRIES.move_to_end(cache_key)
            while len(_ENTRIES)>LIMIT:_ENTRIES.popitem(last=False)
        else:_ENTRIES.pop(cache_key,None)
        return result

def metrics():
    with _LOCK:return dict(**_STATS,entries=len(_ENTRIES),entry_limit=LIMIT,observer_connections=len(_OBSERVERS),observer_limit=DB_LIMIT,ttl_seconds=TTL,scope='Process-local stored dashboard query cache; commits invalidate immediately, live-status aging bounded by TTL; not an operational capacity guarantee')
