import json
import pytest
from server import storage
from server.tests.test_api import client, session

def dump():
    with storage.connect() as db:return list(db.iterdump())

def test_teaching_note_is_atomic_idempotent_scoped_and_not_scoring(client):
    _,sid=session(client);_,other=session(client)
    body={'request_id':'teaching_1','text':'  Compare available RF evidence before responding.  '}
    r=client.post(f'/api/v1/instructor/sessions/{sid}/teaching-pauses',json=body)
    assert r.status_code==200,r.text
    assert r.json()['command']['type']=='pause' and r.json()['command']['payload']=={}
    assert r.json()['notes'][0]['status']=='awaiting application'
    before=dump();assert client.post(f'/api/v1/instructor/sessions/{sid}/teaching-pauses',json=body).json()['duplicate'];assert dump()==before
    assert client.post(f'/api/v1/instructor/sessions/{sid}/teaching-pauses',json={**body,'text':'changed'}).status_code==409
    assert client.get(f'/api/v1/instructor/sessions/{other}/teaching-notes').json()['notes']==[]
    assert client.post(f'/api/v1/sessions/{sid}/control-state',json={'tick':30,'paused':True,'active_contacts':0,'radar_status':'normal','rf_available':True,'night':False,'applied':[{'seq':1,'tick':30,'order':0}]}).status_code==200
    card=client.post(f'/api/v1/sessions/{sid}/complete',json={'execution_tick':30}).json()
    before=dump();aar=client.get(f'/api/v1/sessions/{sid}/aar').json()
    assert aar['scorecard']==card and aar['teaching_notes'][0]['tick']==30
    assert any('Compare available RF' in e['title'] for e in aar['timeline'] if e['category']=='instructor_action')
    assert dump()==before
    assert client.post(f'/api/v1/instructor/sessions/{sid}/teaching-pauses',json={'request_id':'new','text':'later'}).status_code==409
    assert client.post(f'/api/v1/instructor/sessions/{sid}/teaching-pauses',json=body).json()['duplicate']

@pytest.mark.parametrize('text',['','   ','x'*1001,'bad\x00data'])
def test_invalid_teaching_annotations_write_nothing(client,text):
    _,sid=session(client);before=dump()
    assert client.post(f'/api/v1/instructor/sessions/{sid}/teaching-pauses',json={'request_id':'invalid','text':text}).status_code==422
    assert dump()==before

def test_teaching_routes_require_server_officer_authorization(client):
    _,sid=session(client);before=dump();client.headers.pop('Authorization')
    assert client.get(f'/api/v1/instructor/sessions/{sid}/teaching-notes').status_code==401
    assert client.post(f'/api/v1/instructor/sessions/{sid}/teaching-pauses',json={'request_id':'none','text':'No authorization'}).status_code==401
    assert dump()==before

def test_unapplied_completed_note_is_truthful_and_contract_valid(client):
    from server.review_models import GhostAAR
    _,sid=session(client)
    client.post(f'/api/v1/instructor/sessions/{sid}/teaching-pauses',json={'request_id':'unapplied','text':'This note was issued but not applied.'})
    client.post(f'/api/v1/sessions/{sid}/complete',json={})
    before=dump();body=client.get(f'/api/v1/sessions/{sid}/aar').json()
    assert body['teaching_notes'][0]['status']=='not applied before completion'
    assert body['teaching_notes'][0]['tick'] is None
    assert not any('issued but not applied' in e['title'] for e in body['timeline'])
    GhostAAR.model_validate({k:body[k] for k in GhostAAR.model_fields if k in body})
    assert dump()==before
