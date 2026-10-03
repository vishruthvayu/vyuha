import copy
import json
import pytest
from unittest.mock import patch
from server import storage, main
from server.director import SKILLS,TEMPLATES,session_outcomes,select_director,adapt_scenario,difficulty
from server.review import build_review
from server.engine import make_scenario,Simulation,ideal,civil
from server.tests.test_api import client
from server.engine import engagement_rule


def expert(spec):
    sim=Simulation(spec)
    while sim.tick<2250:
        for t in sim.tracks:
            if not t['active'] or t['detected'] is None:continue
            if t['designated'] is None:
                sim.act(dict(tick=sim.tick,k='designate',track=t['id']))
                sim.act(dict(tick=sim.tick,k='classify',track=t['id'],kind=t['kind'],identity=t['identity']))
            e=ideal(t);rule=engagement_rule(t,e)
            if 'hold' in t['attempts'] or (e!='hold' and (not rule['in_range'] or rule['restricted'])):continue
            sim.act(dict(tick=sim.tick,k='engage',track=t['id'],effector=e))
        sim.step()
    return sim


def complete_run(client,spec,trainee='DIRECTOR-QA',events=None,end=2250):
    sid=client.post('/api/v1/sessions',json=dict(scenario_id=spec['id'],trainee=trainee)).json()['id']
    if events is None:events=expert(spec).events
    assert client.post(f'/api/v1/sessions/{sid}/events',json=dict(seq=0,events=events)).status_code==200
    result=client.post(f'/api/v1/sessions/{sid}/complete',json=dict(execution_tick=end))
    assert result.status_code==200,result.text
    return sid,client.get(f'/api/v1/sessions/{sid}/aar').json()


def fresh(client,name='DIRECTOR-QA'):
    return client.get(f'/api/v1/trainees/{name}/profile').json()


def test_prior_and_fresh_determinism(client):
    p=fresh(client);assert list(p['skills'])==SKILLS
    assert all(x['alpha']==x['beta']==1 and x['mean']==.5 and x['observations']==0 for x in p['skills'].values())
    a=client.post('/api/v1/scenarios/generate',json=dict(mode='adaptive',trainee=p['trainee'],seed=17)).json()
    assert a==client.post('/api/v1/scenarios/generate',json=dict(mode='adaptive',trainee=p['trainee'],seed=17)).json()
    assert a['director_decision']['reason_code']=='INITIAL_ASSESSMENT'
    assert a['director_decision']['mastery_estimate']==.5
    assert len(a['tracks'])>=5


def test_completion_outcomes_idempotent_and_rebuildable(client):
    spec=client.post('/api/v1/scenarios/generate',json={}).json()
    sid,aar=complete_run(client,spec)
    first=fresh(client)
    expected=session_outcomes(aar)
    assert first['outcomes'][0]['skills']==expected
    for s in SKILLS:
        assert first['skills'][s]['alpha']==1+expected[s]['successes']
        assert first['skills'][s]['beta']==1+expected[s]['failures']
        assert first['skills'][s]['observations']==sum(expected[s].values())
    client.post(f'/api/v1/sessions/{sid}/complete',json={})
    assert fresh(client)==first
    assert all(x['mean']==x['alpha']/(x['alpha']+x['beta']) for x in first['skills'].values())
    # The provenance alone reproduces every posterior.
    for s in SKILLS:
        assert first['skills'][s]['alpha']==1+sum(o['skills'][s]['successes'] for o in first['outcomes'])


def test_no_rf_error_then_corrected_is_single_failure(client):
    spec=client.post('/api/v1/scenarios/generate',json={}).json()
    sim=Simulation(spec)
    while sim.tick<632:sim.step()
    for a in [dict(k='designate'),dict(k='classify',kind='fiber_fpv',identity='hostile'),dict(k='engage',effector='rf_jam'),dict(k='engage',effector='kinetic')]:
        assert sim.act(dict(tick=632,track='T5',**a))
    sid,aar=complete_run(client,spec,events=sim.events,end=633)
    outcomes=fresh(client)['outcomes'][0]['skills']
    assert outcomes['effector_choice']==dict(successes=0,failures=1)
    assert fresh(client)['skills']['effector_choice']['beta']==2
    assert any(r['reason_code']=='NO_RF_JAM_INEFFECTIVE' for r in aar['decision_reviews'])


def test_correct_hold_jam_kinetic_and_mixed_identity(client):
    spec=client.post('/api/v1/scenarios/generate',json={}).json();sid,aar=complete_run(client,spec)
    codes={r['reason_code'] for r in aar['decision_reviews']}
    assert {'CORRECT_HOLD','CORRECT_RF_JAM','CORRECT_KINETIC','CORRECT_CLASSIFICATION'}<=codes
    assert fresh(client)['skills']['effector_choice']['alpha']==9
    assert fresh(client)['skills']['classification_iff']['alpha']==9


def test_degraded_success_failure_and_detection_classification_mapping():
    s=make_scenario();cs=[dict(seq=1,type='sensor_fault',payload=dict(sensor='radar',mode='failed'),tick=30,order=0)]
    actions=[dict(tick=31,order=1,k='designate',track='T2'),dict(tick=31,order=2,k='classify',track='T2',kind='bird',identity='hostile'),dict(tick=31,order=3,k='engage',track='T2',effector='hold')]
    review,_=build_review(s,actions,cs,'test',32)
    outcome=session_outcomes(review)
    assert outcome['detection']==dict(successes=1,failures=0)
    assert outcome['classification_iff']==dict(successes=0,failures=1)
    assert outcome['effector_choice']==dict(successes=1,failures=0)
    assert outcome['degraded_sensor_response']==dict(successes=0,failures=1)
    # One contact with all correct degraded decisions becomes one degraded success.
    actions[1].update(kind='quad',identity='friendly')
    review,_=build_review(s,actions,cs,'test',32)
    assert session_outcomes(review)['degraded_sensor_response']==dict(successes=1,failures=0)
    missed,_=build_review(s,[],[], 'test',2250)
    assert session_outcomes(missed)['detection']['failures']==6
    assert all(session_outcomes(missed)[x]==dict(successes=0,failures=0) for x in ['classification_iff','effector_choice'])


@pytest.mark.parametrize('mean,level',[(.1,1),(.399,1),(.4,2),(.699,2),(.7,3),(.99,3)])
def test_difficulty_bands(mean,level):assert difficulty(mean)==level


def test_weakness_selection_seeded_distribution_and_relevant_scenario(client):
    p=fresh(client)
    for s,v in p['skills'].items():v.update(alpha=80.,beta=2.,mean=80/82,observations=80)
    p['skills']['effector_choice'].update(alpha=2.,beta=80.,mean=2/82)
    draws=[select_director(p,[],seed) for seed in range(30)]
    assert all(d['focus_skill']=='effector_choice' for d in draws)
    assert select_director(p,[],12)==select_director(p,[],12)
    spec=adapt_scenario(draws[0]);assert spec['director_decision']['difficulty']==1
    assert any(t['kind']=='fiber_fpv' and not t['rf'] for t in spec['tracks'])
    assert any(t['rf'] and t['identity']=='hostile' for t in spec['tracks'])


def test_all_36_adaptations_distinct_and_playable(client):
    p=fresh(client);worlds=set()
    for skill in SKILLS:
        for template in TEMPLATES[skill]:
            for level in [1,2,3]:
                d=select_director(p,[],31);d.update(focus_skill=skill,scenario_template=f'{skill}/{template}',difficulty=level,difficulty_label=['foundational','standard','challenging'][level-1])
                spec=adapt_scenario(d);worlds.add(json.dumps({k:spec[k] for k in ['tracks','night','fog','jamStart','jamEnd']},sort_keys=True))
                sim=expert(spec);assert not any(t['impact'] for t in sim.tracks if t['identity']=='hostile')
                review,_=build_review(spec,sim.events,[],'adaptive',2250)
                assert review['ghost_summary']['no_major_errors']
    assert len(worlds)==36


def test_anti_rote_preview_not_history_and_fallback(client):
    p=fresh(client);history=[]
    for i in range(7):
        d=select_director(p,history,19)
        if history:assert d['scenario_template']!=history[0]['scenario_template']
        history.insert(0,d);history=history[:5]
        if i>=3:assert d['anti_rote']['fallback']
    first=client.post('/api/v1/scenarios/generate',json=dict(mode='adaptive',trainee=p['trainee'],seed=19)).json()
    client.post('/api/v1/sessions',json=dict(scenario_id=first['id'],trainee=p['trainee']))
    second=client.post('/api/v1/scenarios/generate',json=dict(mode='adaptive',trainee=p['trainee'],seed=19)).json()
    assert first['director_decision']['scenario_template']!=second['director_decision']['scenario_template']
    assert second==client.post('/api/v1/scenarios/generate',json=dict(mode='adaptive',trainee=p['trainee'],seed=19)).json()


def test_completion_rolls_back_all_skills_on_failure(client):
    s=client.post('/api/v1/scenarios/generate',json={}).json()
    sid=client.post('/api/v1/sessions',json=dict(scenario_id=s['id'])).json()['id']
    with patch.object(main,'persist_outcomes',side_effect=RuntimeError('fail')):
        with pytest.raises(RuntimeError):client.post(f'/api/v1/sessions/{sid}/complete',json={})
    assert client.get(f'/api/v1/sessions/{sid}/aar').status_code==409
    assert fresh(client,'CADET-01')['sessions']==0


def test_no_profile_updates_from_active_or_invalid_preview(client):
    spec=client.post('/api/v1/scenarios/generate',json={}).json()
    client.post('/api/v1/sessions',json=dict(scenario_id=spec['id'],trainee='DIRECTOR-QA'))
    assert fresh(client)['sessions']==0
    assert all(s['observations']==0 for s in fresh(client)['skills'].values())


def test_legacy_backfill_and_corrupt_exclusion(client):
    spec=client.post('/api/v1/scenarios/generate',json={}).json();sid,aar=complete_run(client,spec)
    # Emulate pre-Stage-3 storage without changing original session truth.
    with storage.connect() as db:
        db.execute('DELETE FROM skill_outcomes');db.execute('DELETE FROM skill_profiles')
    p=fresh(client);assert p['sessions']==1
    assert fresh(client)==p
    with storage.connect() as db:
        db.execute('DELETE FROM skill_outcomes');db.execute('DELETE FROM skill_profiles')
        db.execute("UPDATE sessions SET scorecard='{}' WHERE id=?",(sid,))
    p=fresh(client);assert p['sessions']==0 and p['unprocessed_sessions']==[sid]


def test_api_loop_changes_mastery_and_supports_adaptive_instructor(client):
    s=client.post('/api/v1/scenarios/generate',json={}).json()
    complete_run(client,s)  # real verified history, no posterior edits
    before=fresh(client)
    sim=Simulation(s)
    while sim.tick<632:sim.step()
    for a in [dict(k='designate'),dict(k='classify',kind='fiber_fpv',identity='hostile'),dict(k='engage',effector='rf_jam')]:sim.act(dict(tick=632,track='T5',**a))
    complete_run(client,s,events=sim.events,end=633)
    after=fresh(client);assert after['skills']['effector_choice']['mean']<before['skills']['effector_choice']['mean']
    # Deterministic fixed search demonstrates sampling can select the updated weakness.
    seed=next(seed for seed in range(100) if select_director(after,[],seed)['focus_skill']=='effector_choice')
    spec=client.post('/api/v1/scenarios/generate',json=dict(mode='adaptive',trainee='DIRECTOR-QA',seed=seed)).json()
    assert spec['director_decision']['profile_snapshot']==after['skills']
    sid,aar=complete_run(client,spec)
    assert fresh(client)['skills']['effector_choice']['mean']>after['skills']['effector_choice']['mean']
    next_spec=client.post('/api/v1/scenarios/generate',json=dict(mode='adaptive',trainee='DIRECTOR-QA',seed=seed)).json()
    # If the focus remains the same, the just-started template is excluded.
    assert next_spec['director_decision']['scenario_template']!=spec['director_decision']['scenario_template']
    sid=client.post('/api/v1/sessions',json=dict(scenario_id=next_spec['id'],trainee='DIRECTOR-QA')).json()['id']
    assert client.post(f'/api/v1/instructor/sessions/{sid}/commands',json=dict(command_id='inject',type='inject_contact',payload=dict(kind='fiber_fpv'))).status_code==200
    assert client.post('/api/v1/sessions',json=dict(scenario_id=next_spec['id'],trainee='OTHER')).status_code==422
