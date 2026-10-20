"""Real HTTP role clients share a single durable authoritative engine."""
from concurrent.futures import ThreadPoolExecutor
import json
import pytest
from server import crew,storage
from server.engine import replay,score
from server.tests.test_api import client

@pytest.fixture
def shared(client,monkeypatch):
    stamp=[1000.];monkeypatch.setattr(crew,'clock',lambda:stamp[0])
    scenario=client.post('/api/v1/raids',json={'name':'Crew isolation QA','duration':60,'seed':62,'difficulty':'foundational','family':'DIRECT','terrain':'rural'}).json()
    r=client.post('/api/v1/crews',json={'name':'Shared QA','scenario_id':scenario['id'],'members':[{'callsign':'WATCH','role':'spotter'},{'callsign':'RESP','role':'responder'}]})
    assert r.status_code==201,r.text
    issued=r.json();cid=issued['id'];members=issued['members']
    headers=[{'X-VYUHA-Crew-Token':m['code']} for m in members]
    def state(role=0):
        r=client.get(f'/api/v1/crews/{cid}/state',headers=headers[role]);assert r.status_code==200,r.text;return r.json()
    def control(type='resume'):
        r=client.post(f'/api/v1/crews/{cid}/control',json={'command_id':f'{type}-{int(stamp[0]*1000)}','type':type,'payload':{}})
        assert r.status_code==200,r.text
    def act(role,request_id,k,track,**extra):return client.post(f'/api/v1/crews/{cid}/actions',headers=headers[role],json=dict(request_id=request_id,k=k,track=track,**extra))
    return dict(client=client,stamp=stamp,scenario=scenario,issued=issued,headers=headers,cid=cid,state=state,control=control,act=act)


def visible(shared):
    shared['control']()
    for _ in range(50):
        s=shared['state']()
        candidates=[t for t in s['contacts'] if t['observation']['radar']['detected'] or any(t['observation'][c]['level']!='none' for c in ['eo','ir'])]
        if candidates:return candidates[0]['id']
        shared['stamp'][0]+=.5
    pytest.fail('No observed contact in issued seeded crew exercise')


def test_crew_role_boundaries_and_regular_session_bypass_fail_closed(shared):
    c=shared['client'];cid=shared['cid'];sid=shared['issued']['session_id']
    c.headers.clear()
    assert c.post('/api/v1/crews',json={}).status_code==401
    assert c.get(f'/api/v1/crews/{cid}/state').status_code==401
    assert c.post(f'/api/v1/crews/{cid}/complete',json={}).status_code==401
    assert c.post(f'/api/v1/crews/{cid}/control',json={}).status_code==401
    assert c.get(f'/api/v1/sessions/{sid}/aar').status_code==401
    for endpoint in ['events','control-state','complete']:
        assert c.post(f'/api/v1/sessions/{sid}/{endpoint}',json={}).status_code==403
    assert shared['act'](0,'bad-role','engage','T1',effector='hold').status_code==403
    assert shared['act'](1,'bad-role2','designate','T1').status_code==403
    assert shared['act'](0,'bad-shape','classify','T1').status_code==422


def test_two_roles_observe_one_state_and_share_attributed_actions(shared):
    tid=visible(shared)
    a,b=shared['state'](0),shared['state'](1)
    assert a['tick']==b['tick'] and a['contacts']==b['contacts']
    assert all('kind' not in t and 'identity' not in t and 'rf' not in t for t in a['contacts'])
    assert shared['act'](1,'too-early','classify',tid,kind='quad',identity='hostile').status_code==422
    r=shared['act'](0,'mark','designate',tid);assert r.status_code==200,r.text
    assert shared['state'](1)['contacts'][next(i for i,t in enumerate(shared['state'](1)['contacts']) if t['id']==tid)]['designated'] is not None
    for request_id,k,extra in [('identify','classify',{'kind':'quad','identity':'hostile'}),('respond','engage',{'effector':'hold'})]:
        r=shared['act'](1,request_id,k,tid,**extra);assert r.status_code==200,r.text
    attribution=shared['state']()['attribution']
    assert [a['role'] for a in attribution]==['spotter','responder','responder']
    assert len({a['timeline_order'] for a in attribution})==3
    with storage.connect() as db:
        from server.main import logged_events,applied_commands
        events=logged_events(db,shared['issued']['session_id']);commands=applied_commands(db,shared['issued']['session_id'])
        before=list(db.execute('SELECT * FROM skill_profiles'));outcomes=list(db.execute('SELECT * FROM skill_outcomes'))
    r=shared['client'].post(f"/api/v1/crews/{shared['cid']}/complete",json={});assert r.status_code==200,r.text
    assert r.json()==score(replay(shared['scenario'],events,1800,commands))
    assert shared['state'](1)['scorecard']==r.json()
    aar=shared['client'].get(f"/api/v1/sessions/{shared['issued']['session_id']}/aar",headers=shared['headers'][1])
    assert aar.status_code==200 and aar.json()['verified'] and aar.json()['decision_reviews']
    with storage.connect() as db:
        assert list(db.execute('SELECT * FROM skill_profiles'))==before
        assert list(db.execute('SELECT * FROM skill_outcomes'))==outcomes


def test_concurrent_retries_do_not_duplicate_or_reassign_actions(shared):
    tid=visible(shared)
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses=list(pool.map(lambda _:shared['act'](0,'shared-nonce','designate',tid),range(2)))
    assert all(r.status_code==200 for r in responses)
    assert responses[0].json()==responses[1].json()
    assert len(shared['state']()['attribution'])==1
    assert shared['act'](0,'shared-nonce','designate','T999').status_code==409
    assert shared['act'](1,'shared-nonce','classify',tid,kind='quad',identity='hostile').status_code==409


def test_reconnect_and_process_cache_loss_resume_at_checkpoint_without_wall_jump(shared):
    tid=visible(shared);assert shared['act'](0,'before-outage','designate',tid).status_code==200
    before=shared['state']();shared['stamp'][0]+=100
    crew._CACHE.clear()
    recovered=shared['state'](1)
    assert recovered['tick']==before['tick'] and recovered['paused']
    assert recovered['attribution']==before['attribution']
    assert shared['act'](1,'during-paused','classify',tid,kind='quad',identity='hostile').status_code==409
    shared['control']();shared['stamp'][0]+=.1
    resumed=shared['state'](1)
    assert not resumed['paused'] and 1<=resumed['tick']-before['tick']<=3
    r=shared['act'](0,'before-outage','designate',tid)
    assert r.status_code==200 and len(shared['state']()['attribution'])==1


def test_role_code_is_hashed_scoped_and_cannot_cross_crews(shared):
    c=shared['client'];spec=shared['scenario']
    second=c.post('/api/v1/crews',json={'name':'Other crew','scenario_id':spec['id'],'members':[{'callsign':'WATCH2','role':'spotter'},{'callsign':'RESP2','role':'responder'}]}).json()
    assert c.get(f"/api/v1/crews/{second['id']}/state",headers=shared['headers'][0]).status_code==401
    with storage.connect() as db:
        content='\n'.join(db.iterdump())
    assert all(m['code'] not in content for m in shared['issued']['members'])


def test_profile_backfill_does_not_convert_shared_result_into_individual_evidence(shared):
    shared['control']()
    r=shared['client'].post(f"/api/v1/crews/{shared['cid']}/complete",json={});assert r.status_code==200,r.text
    with storage.connect() as db:
        owner=db.execute('SELECT trainee FROM sessions WHERE id=?',(shared['issued']['session_id'],)).fetchone()['trainee']
        before=list(db.execute('SELECT * FROM skill_profiles'));outcomes=list(db.execute('SELECT * FROM skill_outcomes'))
    r=shared['client'].get(f'/api/v1/trainees/{owner}/profile')
    assert r.status_code==200 and r.json()['version']=='shared-crew-not-individual'
    assert r.json()['outcomes']==[]
    with storage.connect() as db:
        assert list(db.execute('SELECT * FROM skill_profiles'))==before
        assert list(db.execute('SELECT * FROM skill_outcomes'))==outcomes


def test_failed_commit_restores_cache_and_durable_checkpoint(shared,monkeypatch):
    tid=visible(shared);before=shared['state']();real_connect=storage.connect
    class CommitFailure:
        def __init__(self):self.db=real_connect()
        def __enter__(self):self.db.__enter__();return self.db
        def __exit__(self,typ,value,tb):
            self.db.rollback();self.db.close()
            if typ is None:raise OSError('synthetic commit failure')
    monkeypatch.setattr(storage,'connect',CommitFailure)
    with pytest.raises(OSError,match='commit failure'):
        shared['act'](0,'commit-retry','designate',tid)
    monkeypatch.setattr(storage,'connect',real_connect)
    after=shared['state']()
    assert after['tick']==before['tick'] and after['contacts']==before['contacts'] and after['attribution']==[]
    assert shared['act'](0,'commit-retry','designate',tid).status_code==200


def test_completed_crew_reconnection_is_read_only_and_reports_coordination_without_profile_credit(shared):
    track=visible(shared)
    assert shared['act'](0,'metrics-designate','designate',track).status_code==200
    shared['stamp'][0]+=.5
    assert shared['act'](1,'metrics-classify','classify',track,kind='quad',identity='hostile').status_code==200
    shared['stamp'][0]+=.2
    assert shared['act'](1,'metrics-respond','engage',track,effector='hold').status_code==200
    result=shared['client'].post(f"/api/v1/crews/{shared['cid']}/complete",json={})
    assert result.status_code==200
    with storage.connect() as db:before=list(db.iterdump())
    crew._CACHE.clear();shared['stamp'][0]+=100
    for role in [0,1,1]:
        state=shared['state'](role)
        assert state['status']=='completed' and state['scorecard']==result.json()
        assert 'history is frozen' in state['clock_note']
        metrics=state['coordination_metrics']
        assert metrics['accepted_actions']==metrics['attributed_actions']==3
        assert metrics['unattributed_actions']==0 and metrics['contacts_with_actions']==1
        assert metrics['median_designation_to_classification_s']==.5
        assert metrics['median_classification_to_response_s']==.2
        member={m['role']:m for m in metrics['members']}
        assert member['spotter']['designations']==1 and member['spotter']['accepted_actions']==1
        assert member['responder']['classifications']==member['responder']['responses']==1
    with storage.connect() as db:assert list(db.iterdump())==before


def test_stale_designation_is_explicit_and_never_changes_accepted_history(shared,monkeypatch):
    tid=visible(shared);cid=shared['cid'];key=(str(storage.DB_PATH.resolve()),cid)
    rt=crew._CACHE[key];track=next(t for t in rt['sim'].tracks if t['id']==tid)
    # Deterministic receipt race: a displayed contact loses every current position.
    for channel in ['ir','eo','radar']:track['observation'][channel]['position']=None
    with storage.connect() as db:
        before={table:db.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0] for table in ['chunks','crew_attribution','crew_receipts','skill_outcomes']}
    result=shared['act'](0,'stale-designation','designate',tid)
    assert result.status_code==422 and 'No current sensor observation' in result.json()['detail']
    assert 'no decision was recorded' in result.json()['detail']
    with storage.connect() as db:
        after={table:db.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0] for table in before}
    assert after==before
    # Reacquisition is required; a rejected nonce is not an accepted receipt.
    shared['stamp'][0]+=.5
    for _ in range(100):
        if any(t['id']==tid for t in shared['state']()['contacts']):break
        shared['stamp'][0]+=.1
    accepted=shared['act'](0,'stale-designation','designate',tid)
    assert accepted.status_code==200,accepted.text
    assert shared['act'](0,'stale-designation','designate',tid).json()==accepted.json()
    assert len(shared['state']()['attribution'])==1


def test_equal_tick_control_snapshots_have_monotonic_revision(shared):
    initial=shared['state']();shared['control']('resume');running=shared['state']()
    shared['control']('pause');paused=shared['state']()
    result=shared['client'].post(f"/api/v1/crews/{shared['cid']}/control",json={'command_id':'resume-revision-new','type':'resume','payload':{}})
    assert result.status_code==200
    resumed=shared['state']()
    assert initial['tick']==running['tick']==paused['tick']==resumed['tick']==0
    assert [s['revision'] for s in [initial,running,paused,resumed]]==[0,1,2,3]
    assert paused['paused'] and not resumed['paused']
    assert resumed['attribution']==[]


def test_designation_eligibility_uses_server_detection_without_leaking_truth(shared):
    tid=visible(shared);key=(str(storage.DB_PATH.resolve()),shared['cid'])
    sim=crew._CACHE[key]['sim'];track=next(t for t in sim.tracks if t['id']==tid)
    # A reported position alone does not satisfy the authoritative detected gate.
    track['detected']=None
    state=shared['state']();contact=next(t for t in state['contacts'] if t['id']==tid)
    assert contact['designatable'] is False
    assert 'Wait for' in contact['designation_reason']
    assert not {'kind','identity','detected','truth'} & set(contact)
    before=len(state['attribution'])
    assert shared['act'](0,'ineligible','designate',tid).status_code==422
    assert len(shared['state']()['attribution'])==before
    # Prior working-sensor detection remains valid even with a tentative/coasting
    # current plot; don't invent a stricter "confirmed radar now" client rule.
    # Rejected transactions restore a private runtime copy; reacquire it.
    sim=crew._CACHE[key]['sim'];track=next(t for t in sim.tracks if t['id']==tid)
    track['detected']=max(0,sim.tick-1)
    track['observation']['radar']['state']='coasting'
    contact=next(t for t in shared['state']()['contacts'] if t['id']==tid)
    assert contact['designatable'] is True
    assert shared['act'](0,'eligible','designate',tid).status_code==200
    assert next(t for t in shared['state']()['contacts'] if t['id']==tid)['designatable'] is False
    assert shared['act'](1,'wrong-role-eligibility','designate',tid).status_code==403
