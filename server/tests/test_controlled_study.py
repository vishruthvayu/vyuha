"""Synthetic participant placeholders exercise infrastructure only."""
from datetime import timedelta
import pytest
from server import controlled_study,storage
from server.tests.test_api import client
from server.tests.test_learning import joined,launch

PATH='/api/v1/evaluations/controlled'

def protocol(client,**extra):
    r=client.post(PATH,json=dict(request_id='registered-protocol',seed=7,intended_sample=2,retention_hours=24,transfer_question='Does evidence handling transfer to a different semantic raid?',**extra))
    assert r.status_code==201,r.text
    return r.json()


def test_protocol_frozen_authentication_consent_and_balanced_allocation(client):
    p=protocol(client);assert protocol(client)==p
    assert client.post(PATH,json=dict(request_id='registered-protocol',seed=8,intended_sample=2,retention_hours=24,transfer_question='A different question after allocation')).status_code==409
    participants=[]
    for n in range(2):
        tid=joined(client,'SYNTHETIC-'+str(n));body=dict(participant=f'P{n+1:02}',trainee=tid,consent=False)
        route=PATH+'/'+p['id']+'/participants'
        assert client.post(route,json=body).status_code==422
        body['consent']=True;r=client.post(route,json=body);assert r.status_code==201,r.text
        assert client.post(route,json=body).json()==r.json()
        participants.append(r.json())
    assert {p['arm'] for p in participants}=={'full','faded'}
    tid=joined(client,'SYNTHETIC-EXCESS')
    assert client.post(route,json=dict(participant='P03',trainee=tid,consent=True)).status_code==422
    report=client.get(PATH+'/'+p['id']).json()
    assert all(not x['attempts'] for x in report['participants'])
    assert 'No human learning gain' in report['note']
    client.headers.pop('Authorization')
    assert client.get(PATH+'/'+p['id']).status_code==401
    assert client.post(PATH,json={}).status_code==401
    assert client.post(PATH+'/'+p['id']+'/participants',json={}).status_code==401


def test_registered_phase_order_and_server_enforced_retention(client,monkeypatch):
    p=protocol(client);tid=joined(client)
    r=client.post(PATH+'/'+p['id']+'/participants',json=dict(participant='P01',trainee=tid,consent=True));assert r.status_code==201,r.text
    participant=r.json();prefix=PATH+'/'+p['id']+'/participants/'+participant['id']
    assert client.post(prefix+'/immediate/prepare',json={}).status_code==409
    contexts=[]
    for phase in ['baseline','practice1','practice2','practice3','immediate']:
        r=client.post(prefix+'/'+phase+'/prepare',json={});assert r.status_code==201,r.text
        prepared=r.json();contexts.append(prepared['context'])
        assert client.post(prefix+'/'+phase+'/prepare',json={}).json()==prepared
        sid=launch(client,prepared,tid)
        complete=client.post('/api/v1/sessions/'+sid+'/complete',json=dict(end_tick=1800,execution_tick=1800))
        assert complete.status_code==200,complete.text
    assert all(c['item_id'].startswith('C02_') for c in contexts)
    assert all(c['assistance']==participant['arm'] for c in contexts[1:4])
    assert contexts[0]['mode']==contexts[-1]['mode']=='assessment'
    assert client.post(prefix+'/retention/prepare',json={}).status_code==409
    later=controlled_study.now()+timedelta(hours=25);monkeypatch.setattr(controlled_study,'now',lambda:later)
    r=client.post(prefix+'/retention/prepare',json={});assert r.status_code==201,r.text
    assert r.json()['context']['item_id'].startswith('C02_RETENTION-C_')
    assert client.post(prefix+'/transfer/prepare',json={}).status_code==409
    sid=launch(client,r.json(),tid)
    assert client.post('/api/v1/sessions/'+sid+'/complete',json=dict(end_tick=1800,execution_tick=1800)).status_code==200
    assert client.post(prefix+'/transfer/prepare',json={}).status_code==201
    report=client.get(PATH+'/'+p['id']).json()
    assert len(report['participants'][0]['attempts'])==7
    with storage.connect() as db:
        assert db.execute('SELECT COUNT(*) FROM skill_outcomes').fetchone()[0]==3 # baseline/immediate/retention only


def test_early_end_is_retained_but_cannot_qualify_as_registered_dose(client):
    p=protocol(client);tid=joined(client)
    participant=client.post(PATH+'/'+p['id']+'/participants',json=dict(participant='P01',trainee=tid,consent=True)).json()
    prefix=PATH+'/'+p['id']+'/participants/'+participant['id']
    prep=client.post(prefix+'/baseline/prepare',json={}).json();sid=launch(client,prep,tid)
    assert client.post('/api/v1/sessions/'+sid+'/complete',json=dict(end_tick=1800,execution_tick=0)).status_code==200
    assert client.post(prefix+'/practice1/prepare',json={}).status_code==409
    report=client.get(PATH+'/'+p['id']).json()
    attempt=report['participants'][0]['attempts'][0]
    assert attempt['observed_ticks']==0 and attempt['exposure_eligible'] is False
    assert attempt['session_id']==sid
