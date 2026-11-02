"""Synthetic policy behavior checks, not evidence of human learning effects."""
import copy
import pytest
from server.observation_journey import aggregate, journey, WINDOW
from server.observation_assessment import assess_mission
from server.observation_missions import compile_mission
from server.tests.test_api import client


def entry(name, *, mode='practice', template='civil_restraint', statuses=None,
          version=3, site='freight_corridor', seed=19):
    statuses = statuses or {'C02': 'unsupported'}
    return dict(created_at=name, scenario=dict(id='fixture-'+name, seed=seed,
        observation_mission=dict(template=template, version=f'observation-mission-v{version}'),
        **({'training_site': {'id': site}} if version == 3 else {})),
        report=dict(session_id=name, version='evidence-assessment-v2' if version >= 2 else 'evidence-assessment-v1',
            mode=mode, report_hash='hash-'+name,
            decisions=[dict(id='decision-'+name, tick=150, order=2)],
            competencies=[dict(id=k, status=v, criterion='frozen criterion '+k,
                               decision_ids=['decision-'+name] if v != 'unassessable' else [])
                          for k,v in statuses.items()]))


def test_latest_evidence_remains_separate_and_repeated_context_is_not_independent():
    history = [entry('new-practice', statuses={'C02': 'supported'}),
               entry('independent-gap', mode='assessment'),
               entry('older-repeat', mode='assessment', seed=200)]
    before = copy.deepcopy(history)
    result = aggregate('A', history, 3)
    c = next(c for c in result['competencies'] if c['id'] == 'C02')
    assert c['state'] == 'independent-gap'
    assert c['latest_practice']['status'] == 'supported'
    assert c['latest_independent']['status'] == 'unsupported'
    assert c['independent_contexts'] == 1
    assert c['latest_independent']['report_hash'] == 'hash-independent-gap'
    assert c['latest_independent']['decisions'] == [dict(id='decision-independent-gap', tick=150, order=2)]
    candidate = next(c for c in result['candidates'] if c['competency'] == 'C02')
    assert candidate['mode'] == 'assessment'
    assert [e['session_id'] for e in candidate['based_on']] == ['independent-gap', 'new-practice']
    assert history == before


def test_unassessable_does_not_erase_assessable_independent_history():
    result = aggregate('A', [entry('empty', mode='assessment', statuses={'C02':'unassessable'}),
                             entry('gap', mode='assessment')], 2)
    row = next(c for c in result['competencies'] if c['id'] == 'C02')
    assert row['latest_independent']['session_id'] == 'gap'
    assert len(row['evidence']) == 2


@pytest.mark.parametrize('version,site', [(1,None),(2,None),(3,'open_campus')])
def test_contract_and_site_handoff_are_preserved_and_seed_collision_is_skipped(version,site):
    result = aggregate('A', [entry('latest',version=version,site=site),
                             entry('prior-seed',version=version,site=site,seed=19+104729)], 45)
    rec = result['recommendation']
    assert f'mission_version={version}' in rec['href']
    assert rec['seed'] not in (19,19+104729)
    assert rec['site'] == site
    assert ('mission_site=open_campus' in rec['href']) == (version == 3)
    assert result['window']['truncated'] is True
    assert result['window']['limit'] == WINDOW


def test_repeated_successful_context_does_not_outweigh_unobserved_context_and_policy_is_deterministic():
    entries = [entry('new', statuses={'C02': 'unsupported'}), entry('older', statuses={'C02': 'supported'})]
    result = aggregate('A', entries, 2)
    assert result == aggregate('A', entries, 2)
    assert result['recommendation']['competency'] == 'C02'
    assert result['recommendation']['template'] != 'civil_restraint'
    assert result['recommendation']['prior_context_sessions'] == 0
    assert result['recommendation']['rank'] == min(c['rank'] for c in result['candidates'])


def test_real_frozen_follow_up_repeats_template_while_longitudinal_policy_uses_uncovered_opportunity():
    scenario = compile_mission(dict(template='civil_restraint', seed=482913))
    # A valid public-ledger declaration with unresolved/unsupported affiliation.
    from server.engine import Simulation
    sim = Simulation(scenario)
    while sim.tick < 150: sim.step(force=True)
    assert sim.act(dict(k='designate', track='T1', tick=150, order=sim.next_order))
    assert sim.act(dict(k='classify', track='T1', tick=150, order=sim.next_order,
                        kind='quad', identity='hostile'))
    report = assess_mission(scenario, sim.events, [], 'baseline-fixture', 160)
    assert report['follow_up']['template'] == 'civil_restraint'
    history = [dict(report=report, scenario=scenario, created_at='2026-01-01')]
    result = aggregate('A', history, 1)
    assert result['recommendation']['competency'] == report['follow_up']['competency'] == 'C02'
    assert result['recommendation']['template'] != report['follow_up']['template']
    assert result['recommendation']['prior_context_sessions'] == 0
    assert result['recommendation']['based_on'][0]['report_hash'] == report['report_hash']


def test_read_route_is_isolated_read_only_and_does_not_include_active_or_other_learner(client):
    from server import storage
    from server.storage import dumps
    spec = compile_mission(dict(template='civil_restraint', seed=482913))
    with storage.connect() as db: db.execute('INSERT INTO scenarios VALUES (?,?)', (spec['id'],dumps(spec)))
    for trainee, complete in [('A',True), ('B',True), ('A',False)]:
        sid = client.post('/api/v1/sessions',json=dict(scenario_id=spec['id'],trainee=trainee)).json()['id']
        if complete:
            assert client.post(f'/api/v1/sessions/{sid}/complete',json=dict(end_tick=2700,execution_tick=200)).status_code == 200
    with storage.connect() as db:
        before = [tuple(r) for r in db.execute('SELECT * FROM sessions ORDER BY id')]
        scores = [tuple(r) for r in db.execute('SELECT * FROM skill_outcomes')]
    response = client.get('/api/v1/observation-learning/trainees/A/journey')
    assert response.status_code == 200, response.text
    result = response.json()
    assert result == journey('A')
    assert result['trainee'] == 'A' and result['window']['included_sessions'] == 1
    assert client.get('/api/v1/observation-learning/trainees/UNKNOWN/journey').json()['sessions'] == []
    with storage.connect() as db:
        assert before == [tuple(r) for r in db.execute('SELECT * FROM sessions ORDER BY id')]
        assert scores == [tuple(r) for r in db.execute('SELECT * FROM skill_outcomes')]


def test_shared_crew_owner_is_rejected_even_with_personal_looking_mission_rows(client):
    from server import storage
    from server.storage import dumps
    spec = compile_mission(dict(template='civil_restraint', seed=482913))
    with storage.connect() as db: db.execute('INSERT INTO scenarios VALUES (?,?)', (spec['id'],dumps(spec)))
    sid = client.post('/api/v1/sessions',json=dict(scenario_id=spec['id'],trainee='aggregate-owner')).json()['id']
    assert client.post(f'/api/v1/sessions/{sid}/complete',json=dict(end_tick=2700,execution_tick=200)).status_code == 200
    with storage.connect() as db:
        db.execute('INSERT INTO crews(id,session_id,name) VALUES (?,?,?)', ('crew-fixture',sid,'Shared fixture'))
    result = client.get('/api/v1/observation-learning/trainees/aggregate-owner/journey')
    assert result.status_code == 422
    assert 'Crew aggregates' in result.json()['detail']


def test_newer_supported_independent_evidence_does_not_reopen_older_practice_gap():
    result = aggregate('A', [entry('new-independent',mode='assessment',statuses={'C02':'supported'}),
                             entry('old-practice')], 2)
    choices = [c for c in result['candidates'] if c['competency'] == 'C02']
    assert all(c['priority'] == 4 for c in choices)
    row = next(c for c in result['competencies'] if c['id'] == 'C02')
    assert row['latest_practice']['status'] == 'unsupported'
    assert row['latest_independent']['status'] == 'supported'


def test_seed_wrap_stays_inside_existing_compiler_uint32_contract():
    result = aggregate('A', [entry('wrap',seed=4294967295)], 1)
    seed = result['recommendation']['seed']
    assert seed == (4294967295+104729)&0xffffffff
    assert 0 <= seed <= 4294967295
    assert compile_mission(dict(template=result['recommendation']['template'],seed=seed))['seed'] == seed


@pytest.mark.parametrize('mode', ['practice', 'assessment'])
def test_evidence_recency_uses_completion_not_creation_and_discloses_legacy_fallback(client, mode):
    from server import storage
    from server.storage import dumps
    from server.engine import Simulation
    spec = compile_mission(dict(template='civil_restraint',seed=482913,mode=mode))
    sim = Simulation(spec)
    while sim.tick < 150: sim.step(force=True)
    assert sim.act(dict(k='designate',track='T1',tick=150,order=sim.next_order))
    assert sim.act(dict(k='classify',track='T1',tick=150,order=sim.next_order,
                        kind='quad',identity='hostile'))
    with storage.connect() as db:
        db.execute('INSERT INTO scenarios VALUES (?,?)',(spec['id'],dumps(spec)))
    stamps = [
        ('2026-01-01T00:00:00+00:00','2026-01-05T00:00:00+00:00'),
        ('2026-01-02T00:00:00+00:00','2026-01-03T00:00:00+00:00'),
        ('2026-01-04T00:00:00+00:00',None),
    ]
    ids = []
    for created, completed in stamps:
        sid = client.post('/api/v1/sessions',json=dict(scenario_id=spec['id'],trainee='completion-order')).json()['id']
        ids.append(sid)
        assert client.post(f'/api/v1/sessions/{sid}/events',json=dict(seq=0,events=sim.events)).status_code == 200
        assert client.post(f'/api/v1/sessions/{sid}/complete',json=dict(end_tick=2700,execution_tick=160)).status_code == 200
        with storage.connect() as db:
            db.execute('UPDATE sessions SET created_at=?,completed_at=? WHERE id=?',(created,completed,sid))
    with storage.connect() as db:
        before = [tuple(r) for r in db.execute('SELECT * FROM sessions ORDER BY id')]
    response = client.get('/api/v1/observation-learning/trainees/completion-order/journey')
    assert response.status_code == 200, response.text
    result = response.json()
    assert [s['session_id'] for s in result['sessions']] == [ids[0],ids[2],ids[1]]
    row = next(c for c in result['competencies'] if c['id'] == 'C02')
    source = row['latest_independent' if mode == 'assessment' else 'latest_practice']
    assert source['session_id'] == ids[0]
    assert source['created_at'] == stamps[0][0]
    assert source['completed_at'] == source['evidence_at'] == stamps[0][1]
    assert source['evidence_time_source'] == 'completed_at'
    legacy = result['sessions'][1]
    assert legacy['completed_at'] is None
    assert legacy['evidence_at'] == legacy['created_at'] == stamps[2][0]
    assert legacy['evidence_time_source'] == 'created_at_legacy_fallback'
    assert result['recommendation']['based_on'][0]['session_id'] == ids[0]
    assert 'completed_at (legacy fallback created_at)' in result['window']['ordering']
    with storage.connect() as db:
        assert before == [tuple(r) for r in db.execute('SELECT * FROM sessions ORDER BY id')]
