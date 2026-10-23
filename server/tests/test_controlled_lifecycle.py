"""Synthetic lifecycle contracts; no participant or human-efficacy evidence."""
import hashlib
from datetime import datetime, timezone
import pytest
from fastapi import HTTPException
from server import controlled_study, learning, storage
from server.tests.test_api import client
from server.tests.test_controlled_study import PATH, protocol
from server.tests.test_learning import joined, launch, prepared


def participant(client, study, label='P01', callsign='LIFECYCLE-QA'):
    tid=joined(client,callsign)
    response=client.post(PATH+'/'+study['id']+'/participants',json=dict(participant=label,trainee=tid,consent=True))
    assert response.status_code==201,response.text
    return tid,response.json(),PATH+'/'+study['id']+'/participants/'+response.json()['id']


def disposition(client, prefix, kind='withdrawn', request_id='terminal-event-01', reason='Synthetic operator lifecycle check'):
    return client.post(prefix+'/dispositions',json=dict(request_id=request_id,disposition=kind,reason=reason))


def test_new_analysis_contract_is_frozen_hash_covered_and_explicit(client):
    study=protocol(client);p=study['protocol']
    assert p['version']=='controlled-pilot-v2'
    assert p['analysis_contract']['version']=='controlled-analysis-v1'
    assert p['analysis_contract']['primary']['phases']==['baseline','immediate']
    assert 'not a causal' in p['analysis_contract']['estimand']
    assert 'No imputation' in p['analysis_contract']['missing_data']
    assert 'power calculation' in p['analysis_contract']['power']
    unsigned={k:v for k,v in p.items() if k!='protocol_hash'}
    assert p['protocol_hash']==hashlib.sha256(storage.dumps(unsigned).encode()).hexdigest()
    assert protocol(client)==study
    with storage.connect() as db:
        frozen=db.execute('SELECT protocol FROM controlled_studies WHERE id=?',(study['id'],)).fetchone()[0]
    tid,person,prefix=participant(client,study)
    assert disposition(client,prefix).status_code==201
    assert client.get(PATH+'/'+study['id']).json()['protocol']==p
    with storage.connect() as db:
        assert frozen==db.execute('SELECT protocol FROM controlled_studies WHERE id=?',(study['id'],)).fetchone()[0]


def test_legacy_v1_protocol_bytes_hash_and_idempotent_read_remain_unchanged(client):
    study=protocol(client)
    legacy={k:v for k,v in study['protocol'].items() if k not in ['protocol_hash','analysis_contract','seed_schedule']}
    legacy['version']='controlled-pilot-v1'
    legacy['primary_outcome']='Change in reconstructed competency correct/incorrect/unassessable counts; original score reported separately'
    legacy['protocol_hash']=hashlib.sha256(storage.dumps(legacy).encode()).hexdigest()
    frozen=storage.dumps(legacy)
    with storage.connect() as db:
        db.execute('UPDATE controlled_studies SET protocol=? WHERE id=?',(frozen,study['id']))
    assert protocol(client)==dict(id=study['id'],protocol=legacy)
    tid,person,prefix=participant(client,study)
    prep=client.post(prefix+'/baseline/prepare',json={})
    assert prep.status_code==201,prep.text
    assert disposition(client,prefix,'dropout').status_code==201
    report=client.get(PATH+'/'+study['id']).json()
    assert report['protocol']==legacy
    assert 'analysis_contract' not in report['protocol']
    with storage.connect() as db:
        assert db.execute('SELECT protocol FROM controlled_studies WHERE id=?',(study['id'],)).fetchone()[0]==frozen


@pytest.mark.parametrize('kind',['withdrawn','dropout'])
def test_terminal_disposition_idempotency_history_and_future_preparation_block(client,kind):
    study=protocol(client);tid,person,prefix=participant(client,study)
    fixed=datetime(2026,10,23,12,0,tzinfo=timezone.utc)
    original=controlled_study.now
    # Keep a real server-generated timestamp in normal use; the synthetic clock
    # here verifies serialization, not elapsed human participation.
    controlled_study.now=lambda:fixed
    try:
        result=disposition(client,prefix,kind,reason='  Synthetic withdrawal reason  ')
        assert result.status_code==201,result.text
        assert result.json()['reason']=='Synthetic withdrawal reason'
        assert result.json()['recorded_at']==fixed.isoformat()
        assert disposition(client,prefix,kind,reason='Synthetic withdrawal reason').json()==result.json()
        assert disposition(client,prefix,kind,reason='Changed immutable reason').status_code==409
        assert disposition(client,prefix,'dropout' if kind=='withdrawn' else 'withdrawn').status_code==409
        assert client.post(prefix+'/baseline/prepare',json={}).status_code==409
        assert disposition(client,prefix,kind,request_id='terminal-event-02').status_code==201
    finally:
        controlled_study.now=original
    report=client.get(PATH+'/'+study['id']).json()['participants'][0]
    assert report['lifecycle_status']==kind
    assert len(report['dispositions'])==2
    assert report['attempts']==[]
    with storage.connect() as db:
        assert db.execute('SELECT COUNT(*) FROM controlled_dispositions').fetchone()[0]==2
        assert db.execute('SELECT COUNT(*) FROM learning_preparations').fetchone()[0]==0
    # Withdrawal from a protocol does not ban independent Academy training.
    assert prepared(client,tid,rid='independent-after-terminal')['context']['mode']=='practice'


def test_prepared_unstarted_ticket_cannot_launch_after_terminal_disposition(client):
    study=protocol(client);tid,person,prefix=participant(client,study)
    prep=client.post(prefix+'/baseline/prepare',json={}).json()
    with storage.connect() as db:
        original=[tuple(r) for r in db.execute('SELECT * FROM learning_preparations')]
        sessions=db.execute('SELECT COUNT(*) FROM sessions').fetchone()[0]
    assert disposition(client,prefix).status_code==201
    # Unprivileged session creation cannot bypass the officer lifecycle gate.
    client.headers.pop('Authorization')
    for _ in range(2):
        response=client.post('/api/v1/sessions',json=dict(scenario_id=prep['scenario']['id'],trainee=tid,learning_preparation=prep['preparation_id']))
        assert response.status_code==409,response.text
    read=client.get('/api/v1/learning/preparations/'+prep['preparation_id'],params=dict(trainee=tid)).json()
    assert read['context']==prep['context'] and read['session_id'] is None
    with storage.connect() as db:
        assert original==[tuple(r) for r in db.execute('SELECT * FROM learning_preparations')]
        assert db.execute('SELECT COUNT(*) FROM sessions').fetchone()[0]==sessions
        assert db.execute('SELECT COUNT(*) FROM learning_attempts').fetchone()[0]==0


def test_existing_active_completion_and_original_learning_evidence_survive_disposition(client):
    study=protocol(client);tid,person,prefix=participant(client,study)
    prep=client.post(prefix+'/baseline/prepare',json={}).json();sid=launch(client,prep,tid)
    assert disposition(client,prefix).status_code==201
    # A lost create reply can still recover its already-created active session.
    assert launch(client,prep,tid)==sid
    assert client.post('/api/v1/sessions/'+sid+'/events',json=dict(seq=0,events=[])).status_code==200
    result=client.post('/api/v1/sessions/'+sid+'/complete',json=dict(end_tick=1800,execution_tick=0))
    assert result.status_code==200,result.text
    aar=client.get('/api/v1/sessions/'+sid+'/aar').json()
    assert aar['verified'] and aar['learning']['context']==prep['context']
    assert client.post(prefix+'/practice1/prepare',json={}).status_code==409
    assert disposition(client,prefix,'dropout',request_id='append-dropout-history').status_code==201
    assert client.get('/api/v1/sessions/'+sid+'/aar').json()==aar
    assert client.post('/api/v1/sessions/'+sid+'/complete',json=dict(end_tick=1800,execution_tick=0)).json()==result.json()
    person=client.get(PATH+'/'+study['id']).json()['participants'][0]
    assert person['lifecycle_status']=='dropout' and len(person['dispositions'])==2
    assert person['attempts'][0]['session_id']==sid
    assert person['attempts'][0]['evidence']==aar['learning']['evidence']
    assert person['attempts'][0]['exposure_eligible'] is False


@pytest.mark.parametrize('body',[
    dict(request_id='too-short',disposition='active',reason='No reactivation'),
    dict(request_id='reason-empty',disposition='dropout',reason='   '),
    dict(request_id='reason-long',disposition='withdrawn',reason='x'*401),
    dict(request_id='reason-control',disposition='dropout',reason='line\nline'),
    dict(request_id='id',disposition='dropout',reason='Too short id'),
    dict(request_id='forged-time',disposition='withdrawn',reason='Server owns time',recorded_at='2000-01-01'),
])
def test_disposition_validation_does_not_mutate_history(client,body):
    study=protocol(client);tid,person,prefix=participant(client,study)
    assert client.post(prefix+'/dispositions',json=body).status_code==422
    assert client.get(PATH+'/'+study['id']).json()['participants'][0]['dispositions']==[]


def test_disposition_authorization_participant_scope_and_immutable_request_owner(client):
    study=protocol(client);tid,person,prefix=participant(client,study)
    _,other,otherprefix=participant(client,study,'P02','LIFECYCLE-OTHER')
    assert disposition(client,prefix).status_code==201
    assert disposition(client,otherprefix).status_code==409
    assert disposition(client,prefix.replace(study['id'],'study_missing'),request_id='wrong-study-request').status_code==404
    token=client.headers.pop('Authorization')
    assert disposition(client,prefix,request_id='unauthorized-event').status_code==401
    assert client.get(PATH+'/'+study['id']).status_code==401
    client.headers['Authorization']=token
    assert len(client.get(PATH+'/'+study['id']).json()['participants'][0]['dispositions'])==1
    assert client.delete(prefix+'/dispositions').status_code==405
    assert client.patch(prefix+'/dispositions',json={}).status_code==405


def test_controlled_preparation_mapping_and_ticket_commit_atomically(client,monkeypatch):
    study=protocol(client);tid,person,prefix=participant(client,study)
    real=learning.prepare_in_transaction
    def interrupted(db,req):
        assert db.in_transaction
        real(db,req)
        raise HTTPException(409,'Synthetic failure before attempt mapping')
    monkeypatch.setattr(controlled_study,'prepare_in_transaction',interrupted)
    assert client.post(prefix+'/baseline/prepare',json={}).status_code==409
    with storage.connect() as db:
        assert db.execute('SELECT COUNT(*) FROM learning_preparations').fetchone()[0]==0
        assert db.execute('SELECT COUNT(*) FROM controlled_attempts').fetchone()[0]==0
    monkeypatch.setattr(controlled_study,'prepare_in_transaction',real)
    assert client.post(prefix+'/baseline/prepare',json={}).status_code==201
    with storage.connect() as db:
        assert db.execute('SELECT COUNT(*) FROM learning_preparations').fetchone()[0]==1
        assert db.execute('SELECT COUNT(*) FROM controlled_attempts').fetchone()[0]==1


def test_disposition_limit_preserves_existing_idempotent_record(client):
    study=protocol(client);tid,person,prefix=participant(client,study)
    original=disposition(client,prefix)
    assert original.status_code==201
    with storage.connect() as db:
        for n in range(99):
            req=dict(request_id='synthetic-history-'+str(n),disposition='dropout',reason='Synthetic bounded history fixture')
            db.execute('INSERT INTO controlled_dispositions(id,request_id,participant_id,body,created_at) VALUES (?,?,?,?,?)',('fixture-'+str(n),req['request_id'],person['id'],storage.dumps(req),controlled_study.now().isoformat()))
    assert disposition(client,prefix,request_id='over-history-limit').status_code==422
    assert disposition(client,prefix).json()==original.json()
    report=client.get(PATH+'/'+study['id']).json()['participants'][0]
    assert len(report['dispositions'])==100
    assert report['dispositions'][0]==original.json()


def test_new_lifecycle_routes_authenticate_before_body_validation(client):
    study=protocol(client);tid,person,prefix=participant(client,study)
    token=client.headers.pop('Authorization')
    for route in [PATH,PATH+'/'+study['id']+'/participants',prefix+'/dispositions',prefix+'/baseline/prepare']:
        assert client.post(route,json={}).status_code==401
        client.headers['Authorization']='Bearer invalid-token'
        assert client.post(route,json={}).status_code==401
        client.headers.pop('Authorization')
    client.headers['Authorization']=token
    assert client.get(PATH+'/'+study['id']).json()['participants'][0]['dispositions']==[]


def test_populated_backup_restore_preserves_protocol_dispositions_and_gate(client,monkeypatch,tmp_path):
    from server.durability import backup,restore
    study=protocol(client);tid,person,prefix=participant(client,study)
    prep=client.post(prefix+'/baseline/prepare',json={}).json();sid=launch(client,prep,tid)
    assert client.post('/api/v1/sessions/'+sid+'/complete',json=dict(end_tick=1800,execution_tick=0)).status_code==200
    aar=client.get('/api/v1/sessions/'+sid+'/aar').json()
    assert disposition(client,prefix,'dropout').status_code==201
    other_tid,other,other_prefix=participant(client,study,'P02','RESTORED-PREPARED')
    pending=client.post(other_prefix+'/baseline/prepare',json={}).json()
    assert disposition(client,other_prefix,'withdrawn',request_id='other-terminal-event').status_code==201
    before=client.get(PATH+'/'+study['id']).json()
    with storage.connect() as db:
        rows={table:[tuple(r) for r in db.execute('SELECT * FROM '+table+' ORDER BY rowid')] for table in ['controlled_studies','controlled_participants','controlled_attempts','controlled_dispositions','learning_preparations','learning_attempts']}
    original_path=storage.DB_PATH
    backup_path=backup(original_path,tmp_path/'pilot-backup.db')
    restored=restore(backup_path,tmp_path/'pilot-restored.db')
    monkeypatch.setattr(storage,'DB_PATH',restored)
    storage.init()
    assert client.get(PATH+'/'+study['id']).json()==before
    assert client.get('/api/v1/sessions/'+sid+'/aar').json()==aar
    with storage.connect() as db:
        assert db.execute('PRAGMA quick_check').fetchone()[0]=='ok'
        assert rows=={table:[tuple(r) for r in db.execute('SELECT * FROM '+table+' ORDER BY rowid')] for table in rows}
    assert client.post(other_prefix+'/baseline/prepare',json={}).status_code==409
    assert client.post('/api/v1/sessions',json=dict(scenario_id=pending['scenario']['id'],trainee=other_tid,learning_preparation=pending['preparation_id'])).status_code==409
    # Restored autoincrement ordering appends without overwriting history.
    assert disposition(client,prefix,request_id='after-restore-event').status_code==201
    after=client.get(PATH+'/'+study['id']).json()['participants'][0]
    assert after['dispositions'][0]==before['participants'][0]['dispositions'][0]
    assert len(after['dispositions'])==2
    # Explicit restore did not mutate the original source database.
    monkeypatch.setattr(storage,'DB_PATH',original_path)
    assert client.get(PATH+'/'+study['id']).json()==before


def test_concurrent_prepare_and_terminal_disposition_leave_no_launchable_ticket(client):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    study=protocol(client);tid,person,prefix=participant(client,study)
    barrier=Barrier(2)
    def prepare_race():
        barrier.wait(timeout=5)
        return client.post(prefix+'/baseline/prepare',json={})
    def terminate_race():
        barrier.wait(timeout=5)
        return disposition(client,prefix)
    with ThreadPoolExecutor(max_workers=2) as pool:
        prepared_future=pool.submit(prepare_race);terminal_future=pool.submit(terminate_race)
        prep=prepared_future.result(timeout=20);terminal=terminal_future.result(timeout=20)
    assert terminal.status_code==201,terminal.text
    assert prep.status_code in [201,409],prep.text
    if prep.status_code==201:
        ticket=prep.json()
        assert client.post('/api/v1/sessions',json=dict(scenario_id=ticket['scenario']['id'],trainee=tid,learning_preparation=ticket['preparation_id'])).status_code==409
    with storage.connect() as db:
        preparations=db.execute('SELECT COUNT(*) FROM learning_preparations').fetchone()[0]
        attempts=db.execute('SELECT COUNT(*) FROM controlled_attempts').fetchone()[0]
        assert preparations==attempts==(1 if prep.status_code==201 else 0)
        assert db.execute('SELECT COUNT(*) FROM sessions').fetchone()[0]==0


def test_concurrent_launch_and_disposition_preserve_only_an_already_created_session(client):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    study=protocol(client);tid,person,prefix=participant(client,study)
    ticket=client.post(prefix+'/baseline/prepare',json={}).json()
    body=dict(scenario_id=ticket['scenario']['id'],trainee=tid,learning_preparation=ticket['preparation_id'])
    barrier=Barrier(2)
    def start_race():
        barrier.wait(timeout=5)
        return client.post('/api/v1/sessions',json=body)
    def terminate_race():
        barrier.wait(timeout=5)
        return disposition(client,prefix)
    with ThreadPoolExecutor(max_workers=2) as pool:
        started_future=pool.submit(start_race);terminal_future=pool.submit(terminate_race)
        started=started_future.result(timeout=20);terminal=terminal_future.result(timeout=20)
    assert terminal.status_code==201,terminal.text
    assert started.status_code in [201,409],started.text
    repeated=client.post('/api/v1/sessions',json=body)
    with storage.connect() as db:
        sessions=db.execute('SELECT COUNT(*) FROM sessions').fetchone()[0]
        attempts=db.execute('SELECT COUNT(*) FROM learning_attempts').fetchone()[0]
    if started.status_code==201:
        assert repeated.status_code==201 and repeated.json()==started.json()
        assert sessions==attempts==1
    else:
        assert repeated.status_code==409
        assert sessions==attempts==0


def test_concurrent_identical_dispositions_append_only_one_record(client):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    study=protocol(client);tid,person,prefix=participant(client,study)
    barrier=Barrier(2)
    def terminate():
        barrier.wait(timeout=5)
        return disposition(client,prefix)
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses=list(pool.map(lambda _:terminate(),range(2)))
    assert all(r.status_code==201 for r in responses)
    assert responses[0].json()==responses[1].json()
    report=client.get(PATH+'/'+study['id']).json()['participants'][0]
    assert report['dispositions']==[responses[0].json()]


@pytest.mark.parametrize('seed',[4294967293,4294967294,4294967295])
def test_registered_uint32_boundary_seed_prepares_every_practice_phase_without_500(client,seed):
    response=client.post(PATH,json=dict(request_id='boundary-seed-protocol',seed=seed,intended_sample=2,retention_hours=24,transfer_question='Synthetic boundary-seed phase preparation only'))
    assert response.status_code==201,response.text
    study=response.json();frozen=study['protocol'];tid,person,prefix=participant(client,study)
    for ordinal,phase in enumerate(['baseline','practice1','practice2','practice3']):
        response=client.post(prefix+'/'+phase+'/prepare',json={})
        assert response.status_code==201,response.text
        prep=response.json();assert prep['context']['seed']==(seed+ordinal)%4294967296
        assert client.post(prefix+'/'+phase+'/prepare',json={}).json()==prep
        sid=launch(client,prep,tid)
        result=client.post('/api/v1/sessions/'+sid+'/complete',json=dict(end_tick=1800,execution_tick=1800))
        assert result.status_code==200,result.text
    assert client.get(PATH+'/'+study['id']).json()['protocol']==frozen


def test_officer_protocol_report_names_the_actual_ticket_owner(client):
    study=protocol(client);tid,person,prefix=participant(client,study)
    prep=client.post(prefix+'/baseline/prepare',json={}).json()
    row=client.get(PATH+'/'+study['id']).json()['participants'][0]
    assert row['trainee']==tid
    other=joined(client,'DIFFERENT-JOINED-QA')
    assert client.get('/api/v1/learning/preparations/'+prep['preparation_id'],params=dict(trainee=other)).status_code==404
    assert client.get('/api/v1/learning/preparations/'+prep['preparation_id'],params=dict(trainee=row['trainee'])).status_code==200
