from concurrent.futures import ThreadPoolExecutor
from server.tests.test_api import client, session
from server.engine import Simulation, replay, score
from server import storage


def issue(client, sid, kind, payload=None, key=None):
    response = client.post(f"/api/v1/instructor/sessions/{sid}/commands", json={"command_id":key or kind,"type":kind,"payload":payload or {}})
    assert response.status_code == 200, response.text
    return response.json()["command"]


def heartbeat(client, sid, applied=None, tick=30, paused=False):
    return client.post(f"/api/v1/sessions/{sid}/control-state", json=dict(tick=tick,paused=paused,active_contacts=3,radar_status="normal",rf_available=True,night=True,
           applied=[{k:c[k] for k in ["seq","tick","order"]} for c in (applied or [])]))


def test_pause_is_persisted_ordered_and_discoverable(client):
    _,sid = session(client)
    assert heartbeat(client,sid).status_code == 200
    assert client.get('/api/v1/instructor/sessions').json()['sessions'][0]['status']=='ACTIVE'
    c = issue(client,sid,'pause')
    assert c['seq']==1 and c['session_id']==sid and c['issued_at']
    storage.init()  # additive init/restart preserves queued commands
    assert client.get(f'/api/v1/sessions/{sid}/commands?after=0').json()['commands']==[c]
    assert client.get(f'/api/v1/sessions/{sid}/commands?after=1').json()['commands']==[]
    assert heartbeat(client,sid,[{**c,'tick':30,'order':0}],paused=True).status_code==200
    assert client.get(f'/api/v1/instructor/sessions/{sid}').json()['status']=='PAUSED'


def test_duplicate_commands_and_acknowledgements_are_idempotent(client):
    _,sid=session(client)
    c=issue(client,sid,'inject_swarm',{'count':6,'bearing':40},'same')
    assert issue(client,sid,'inject_swarm',{'count':6,'bearing':40},'same')['seq']==c['seq']
    assert len(client.get(f'/api/v1/sessions/{sid}/commands').json()['commands'])==1
    assert client.post(f'/api/v1/instructor/sessions/{sid}/commands',json={'command_id':'same','type':'pause','payload':{}}).status_code==409
    applied=[{**c,'tick':30,'order':0}]
    assert heartbeat(client,sid,applied).status_code==200
    assert heartbeat(client,sid,applied).status_code==200
    assert heartbeat(client,sid,[{**c,'tick':29,'order':0}]).status_code==409
    assert heartbeat(client,sid,[]).status_code==409


def test_injected_fpv_is_in_authoritative_reconstruction_and_aar(client):
    spec,sid=session(client)
    c={**issue(client,sid,'inject_contact',{'kind':'fiber_fpv','bearing':40}),'tick':30,'order':0}
    sim=replay(spec,[],30,[c]);target=sim.tracks[-1]
    assert target['id']=='T9' and not target['rf'] and target['spawn']==30
    log=[dict(tick=30,order=i+1,k=k,track='T9',**payload) for i,(k,payload) in enumerate([
        ('designate',{}),('classify',{'kind':'fiber_fpv','identity':'hostile'}),('engage',{'effector':'rf_jam'})])]
    reconstructed=replay(spec,log,2250,[c])
    assert not reconstructed.tracks[-1]['resolved'] and reconstructed.tracks[-1]['impact']
    assert heartbeat(client,sid,[c]).status_code==200
    assert client.post(f'/api/v1/sessions/{sid}/events',json={'seq':0,'events':log}).status_code==200
    result=client.post(f'/api/v1/sessions/{sid}/complete',json={})
    assert result.status_code==200 and result.json()==score(reconstructed)
    assert result.json()['threats']==7
    aar=client.get(f'/api/v1/sessions/{sid}/aar').json()
    assert aar['commands']==[c] and aar['verified']
    assert client.post(f'/api/v1/instructor/sessions/{sid}/commands',json={'command_id':'after','type':'pause','payload':{}}).status_code==409


def test_radar_jam_degrades_and_restore_overrides_scheduled_fault(client):
    spec,sid=session(client)
    jam={**issue(client,sid,'sensor_fault',{'sensor':'radar','mode':'jammed'}),'tick':30,'order':0}
    restore={**issue(client,sid,'sensor_restore',{'sensor':'radar'}),'tick':700,'order':1}
    seen=sum(any(t['radar'] for t in replay(spec,[],tick,[jam]).tracks) for tick in range(30,100))
    assert 0<seen<70
    jammed=replay(spec,[],100,[jam]);assert jammed.radar_status=='jammed'
    restored=replay(spec,[],700,[jam,restore]);normal=replay(spec,[],700)
    assert restored.radar_status=='normal' and normal.radar_status=='jammed'
    assert any(t['radar'] for t in restored.tracks)


def test_sensor_failures_and_environment_reconstruct(client):
    spec,sid=session(client)
    commands=[]
    for i,(kind,payload) in enumerate([
        ('sensor_fault',{'sensor':'radar','mode':'failed'}),('sensor_fault',{'sensor':'rf','mode':'failed'}),
        ('environment',{'night':False}),('sensor_restore',{'sensor':'rf'})]):
        commands.append({**issue(client,sid,kind,payload,f'c{i}'),'tick':30+i,'order':i})
    failed=replay(spec,[],32,commands[:3]);assert not any(t['radar'] for t in failed.tracks)
    assert failed.radar_status=='failed' and not failed.rf_available and not failed.night
    assert replay(spec,[],33,commands).rf_available


def test_malformed_commands_and_forged_order_are_rejected(client):
    _,sid=session(client)
    url=f'/api/v1/instructor/sessions/{sid}/commands'
    invalid=[{'type':'explode','payload':{}},{'type':'inject_contact','payload':{'kind':'bird','bearing':40}},
             {'type':'inject_swarm','payload':{'count':12,'bearing':40}}, {'type':'sensor_fault','payload':{'sensor':'rf','mode':'jammed'}},
             {'type':'environment','payload':{'night':'yes'}}, {'type':'inject_contact','payload':{'kind':'quad','bearing':360}}]
    for c in invalid:assert client.post(url,json={'command_id':'bad',**c}).status_code==422
    c=issue(client,sid,'pause');assert heartbeat(client,sid,[{**c,'tick':31,'order':0}],tick=30).status_code==422
    assert client.get(f'/api/v1/sessions/{sid}/commands?after=-1').status_code==422


def test_concurrent_commands_have_unique_contiguous_sequences(client):
    _,sid=session(client)
    with ThreadPoolExecutor(max_workers=8) as pool:
        values=list(pool.map(lambda i:issue(client,sid,'sensor_restore',{'sensor':'radar'},f'c{i}'),range(20)))
    assert sorted(c['seq'] for c in values)==list(range(1,21))


def test_recoverable_and_completed_sessions_are_distinguished(client):
    _,sid=session(client)
    assert client.get(f'/api/v1/instructor/sessions/{sid}').json()['status']=='RECOVERABLE'
    assert heartbeat(client,sid).status_code==200
    with storage.connect() as db:db.execute("UPDATE sessions SET last_seen='2000-01-01T00:00:00+00:00' WHERE id=?",(sid,))
    assert client.get(f'/api/v1/instructor/sessions/{sid}').json()['status']=='RECOVERABLE'
    issue(client,sid,'pause')  # queued but never applied, omitted from the reconstructed world
    assert client.post(f'/api/v1/sessions/{sid}/complete',json={}).status_code==200
    assert client.get(f'/api/v1/instructor/sessions/{sid}').json()['status']=='COMPLETED'
    assert client.get(f'/api/v1/sessions/{sid}/aar').json()['commands']==[]


def test_same_tick_actions_cannot_precede_their_injection(client):
    spec,sid=session(client)
    c={**issue(client,sid,'inject_contact',{'kind':'quad','bearing':40}),'tick':30,'order':1}
    assert heartbeat(client,sid,[c]).status_code==200
    assert client.post(f'/api/v1/sessions/{sid}/events',json={'seq':0,'events':[dict(tick=30,order=0,k='designate',track='T9')]}).status_code==200
    assert client.post(f'/api/v1/sessions/{sid}/complete',json={}).status_code==422


def test_offline_completion_can_retry_missing_execution_acknowledgements(client):
    spec,sid=session(client)
    c={**issue(client,sid,'inject_contact',{'kind':'fiber_fpv','bearing':40}),'tick':30,'order':0}
    log=[dict(tick=30,order=1,k='designate',track='T9')]
    # The worker executed the issued command, but the server was unavailable for its ack.
    assert client.post(f'/api/v1/sessions/{sid}/events',json={'seq':0,'events':log}).status_code==200
    assert client.post(f'/api/v1/sessions/{sid}/complete',json={}).status_code==422
    assert heartbeat(client,sid,[c],tick=60,paused=True).status_code==200
    assert heartbeat(client,sid,[c],tick=60,paused=True).status_code==200
    assert client.post(f'/api/v1/sessions/{sid}/events',json={'seq':0,'events':log}).status_code==200
    result=client.post(f'/api/v1/sessions/{sid}/complete',json={})
    assert result.status_code==200 and result.json()==score(replay(spec,log,2250,[c]))
    assert client.get(f'/api/v1/sessions/{sid}/aar').json()['commands']==[c]


def test_additive_schema_preserves_legacy_sessions(tmp_path,monkeypatch):
    import sqlite3
    db_path=tmp_path/'legacy.db'
    with sqlite3.connect(db_path) as db:
        db.executescript("CREATE TABLE sessions(id TEXT PRIMARY KEY,trainee TEXT NOT NULL,scenario_id TEXT NOT NULL,created_at TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'active',scorecard TEXT,end_tick INTEGER);")
        db.execute("INSERT INTO sessions(id,trainee,scenario_id,created_at,status) VALUES ('legacy','CADET-01','sc_old','2026-10-02','completed')")
    monkeypatch.setattr(storage,'DB_PATH',db_path)
    storage.init();storage.init()
    with storage.connect() as db:
        row=db.execute("SELECT * FROM sessions WHERE id='legacy'").fetchone()
        assert row['status']=='completed' and row['trainee']=='CADET-01' and row['last_seen'] is None


def test_parallel_trainees_keep_commands_acknowledgements_and_completion_isolated(client):
    spec=client.post('/api/v1/scenarios/generate',json={}).json()
    sessions=[client.post('/api/v1/sessions',json={'scenario_id':spec['id'],'trainee':f'ISOLATED-{i}'}).json()['id'] for i in range(3)]

    def operate(sid):
        commands=[]
        for index,(kind,payload) in enumerate([
            ('pause',{}),('sensor_fault',{'sensor':'rf','mode':'failed'}),
            ('sensor_restore',{'sensor':'rf'})]):
            commands.append(issue(client,sid,kind,payload,f'{sid}-{index}'))
        return commands

    with ThreadPoolExecutor(max_workers=3) as pool:
        issued=list(pool.map(operate,sessions))
    for sid,commands in zip(sessions,issued):
        actual=client.get(f'/api/v1/sessions/{sid}/commands').json()['commands']
        assert actual==commands
        assert [command['seq'] for command in commands]==[1,2,3]
        assert all(command['session_id']==sid for command in commands)

    # Acknowledging and completing A must not apply or end B/C.
    sid=sessions[0]
    applied=[{**command,'tick':0,'order':i} for i,command in enumerate(issued[0])]
    assert heartbeat(client,sid,applied,tick=0,paused=True).status_code==200
    assert client.post(f'/api/v1/sessions/{sid}/complete',json={'end_tick':spec['duration']*30,'execution_tick':0}).status_code==200
    assert client.get(f'/api/v1/sessions/{sid}/aar').json()['commands']==applied
    for untouched in sessions[1:]:
        detail=client.get(f'/api/v1/instructor/sessions/{untouched}').json()
        assert detail['status']=='RECOVERABLE' and detail['telemetry'] is None
        assert all(command['tick'] is None for command in detail['commands'])
        assert client.get(f'/api/v1/sessions/{untouched}/aar').status_code==409
    assert client.get('/api/v1/trainees/ISOLATED-0/profile').json()['sessions']==1
    assert client.get('/api/v1/trainees/ISOLATED-1/profile').json()['sessions']==0
    assert client.get('/api/v1/trainees/ISOLATED-2/profile').json()['sessions']==0
