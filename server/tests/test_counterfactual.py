import copy
from server.counterfactual import branch,reference_choice
from server.engine import make_scenario,score
from server.tests.test_api import client,session,expert
import pytest

def test_what_if_reconstructs_alternative_without_writing_history(client):
    spec,sid=session(client);sim=expert(spec)
    client.post(f'/api/v1/sessions/{sid}/events',json={'seq':0,'events':sim.events})
    assert client.post(f'/api/v1/sessions/{sid}/complete',json={'execution_tick':2250}).status_code==200
    from server.storage import connect
    with connect() as db:before=list(db.iterdump())
    index=next(i for i,a in enumerate(sim.events) if a['k']=='engage' and a['effector']=='rf_jam')
    alternative={**sim.events[index],'effector':'hold'}
    r=client.post(f'/api/v1/sessions/{sid}/what-if',json={'decision_index':index,'action':alternative})
    assert r.status_code==200,r.text
    result=r.json();assert result['kind']=='counterfactual' and result['delta']<0
    assert result['original_score']==score(sim)
    assert client.post(f'/api/v1/sessions/{sid}/what-if',json={'decision_index':index,'action':alternative}).json()==result
    with connect() as db:assert list(db.iterdump())==before
    invalid={**alternative,'track':'T999'}
    assert client.post(f'/api/v1/sessions/{sid}/what-if',json={'decision_index':index,'action':invalid}).status_code==422

def test_policy_cannot_change_with_hidden_truth():
    ev={'rf':{'available':True,'signal':False,'iff':'no_reply'},'visual':{'available':False,'silhouette':None},'prior_identity':None,'prior_classification':None,'range_m':100,'restricted':False}
    a=reference_choice(ev,{'kind':'fiber_fpv','identity':'hostile','rf':False},{})
    b=reference_choice(ev,{'kind':'quad','identity':'friendly','rf':True},{})
    assert a==b and a['action']=='hold' and a['confidence']=='uncertain'
    ev['rf']['iff']='friendly_reply'
    assert reference_choice(ev,{}, {})['action']=='hold'

@pytest.mark.parametrize('new_engine',[False,True])
def test_branch_replays_commands_before_and_after_same_tick_decision(new_engine):
    from server.engine import Simulation,replay
    from server.raid_v2 import compose_raid
    spec=compose_raid({'seed':92,'duration':60,'difficulty':'foundational','family':'DIRECT'}) if new_engine else make_scenario(482913)
    sim=Simulation(spec)
    while not any(t['active'] and (t.get('observation',{}).get('radar',{}).get('detected') or t['thermal'] or (not new_engine and t['radar'])) for t in sim.tracks):
        sim.step()
        assert sim.tick<spec['duration']*30
    target=next(t for t in sim.tracks if t['active'] and (t.get('observation',{}).get('radar',{}).get('detected') or t['thermal'] or (not new_engine and t['radar'])))
    actions=[dict(tick=sim.tick,order=0,k='designate',track=target['id']),dict(tick=sim.tick,order=1,k='classify',track=target['id'],kind=target['kind'],identity=target['identity'])]
    for a in actions:assert sim.act(a)
    def command(seq,order,sensor,kind):
        return dict(seq=seq,order=order,tick=sim.tick,type=kind,payload={'sensor':sensor,**({'mode':'failed'} if kind=='sensor_fault' else {})},command_id=str(seq),session_id='MODELLED',issued_at='synthetic')
    before=command(1,2,'rf','sensor_fault')
    assert sim.control(before)
    actions.append(dict(tick=sim.tick,order=3,k='engage',track=target['id'],effector='hold'))
    assert sim.act(actions[-1])
    after=command(2,4,'rf','sensor_restore')
    assert sim.control(after)
    result=branch(spec,actions,[before,after],spec['duration']*30,2,actions[-1])
    assert result['evidence_at_branch']['rf']['available'] is False
    assert result['original_score']==result['hypothetical_score']==score(replay(spec,actions,spec['duration']*30,[before,after]))
