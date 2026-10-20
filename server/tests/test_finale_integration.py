"""Cross-module regressions for the final integration boundaries."""
import copy
from server import storage
from server.review import build_review
from server.tests.response_fixtures import fixtures
from server.tests.test_crew import shared,visible
from server.tests.test_api import client


def test_delayed_ghost_uses_observed_horizon_and_names_resource_blocks():
    case=fixtures()[0];end=26
    events=[a for a in case['events'] if a['tick']<=end]
    commands=[a for a in case['commands'] if a['tick']<=end]
    review,card=build_review(case['scenario'],events,commands,'delayed-ghost',end,'completion',2700)
    first=next(r for r in review['decision_reviews'] if r['trainee_action'] and r['trainee_action']['k']=='engage' and r['track_id']=='T1')
    assert first['consequence']['immediate']=='remained_active'
    assert 'pending at the observed horizon' in first['consequence']['text']
    assert 'resolved at' not in first['consequence']['text']
    assert card['response_model']['reference_attempts'][0]['status']=='no_effect'
    blocked=next(r for r in review['decision_reviews'] if r['reason_code']=='RESPONSE_RESOURCE_BLOCKED')
    assert blocked['verdict']=='incorrect' and 'resource or cooldown' in blocked['explanation']


def test_crew_aggregate_rejected_as_individual_owner_without_any_profile_write(shared):
    c=shared['client'];shared['control']()
    assert c.post('/api/v1/crews/'+shared['cid']+'/complete',json={}).status_code==200
    with storage.connect() as db:
        owner=db.execute('SELECT trainee FROM sessions WHERE id=?',(shared['issued']['session_id'],)).fetchone()['trainee']
        before=list(db.iterdump())
    assert c.post('/api/v1/sessions',json={'scenario_id':shared['scenario']['id'],'trainee':owner}).status_code==422
    assert c.post('/api/v1/director-v2/prepare',json={'seed':2,'trainee':owner,'duration':60}).status_code==422
    assert c.post('/api/v1/rapid-id',json={'request_id':'crew-rapid-denied','trainee_id':owner,'seed':2,'rounds':10}).status_code==422
    assert c.post('/api/v1/evaluations',json={'request_id':'crew-eval-denied','trainee_id':owner,'participant':'P01','consent':True}).status_code==422
    assert c.get('/api/v1/trainees/'+owner+'/analytics').status_code==422
    assert all(t['trainee_id']!=owner for t in c.get('/api/v1/units/local/trainees').json()['trainees'])
    with storage.connect() as db:assert list(db.iterdump())==before


def test_crew_action_limit_preserves_exact_retry_receipts(shared):
    tid=visible(shared)
    original=shared['act'](0,'limit-retry','designate',tid)
    assert original.status_code==200
    sid=shared['issued']['session_id'];member=original.json()['member_id']
    # Fill only the boundedness metadata, avoiding 5,000 costly UI interactions.
    with storage.connect() as db:
        existing={r[0] for r in db.execute('SELECT timeline_order FROM crew_attribution WHERE session_id=?',(sid,))}
        order=0
        while db.execute('SELECT COUNT(*) FROM crew_attribution WHERE session_id=?',(sid,)).fetchone()[0]<5000:
            if order not in existing:db.execute('INSERT INTO crew_attribution VALUES (?,?,?,?)',(sid,order,member,'spotter'))
            order+=1
    retry=shared['act'](0,'limit-retry','designate',tid)
    assert retry.status_code==200 and retry.json()==original.json()
    assert shared['act'](0,'over-limit','designate',tid).status_code==422


def test_shared_crew_neutral_prior_never_distorts_individual_unit_averages(shared):
    c=shared['client']
    spec=c.post('/api/v1/scenarios/generate',json={}).json()
    r=c.post('/api/v1/sessions',json={'scenario_id':spec['id'],'trainee':'COHORT-INDIVIDUAL'})
    assert r.status_code==201
    sid=r.json()['id'];assert c.post(f'/api/v1/sessions/{sid}/complete',json={}).status_code==200
    prior=c.get('/api/v1/units/local/dashboard').json()
    assert prior['trainee_count']==1 and prior['shared_aggregate_count']==1
    assert c.post('/api/v1/crews/'+shared['cid']+'/complete',json={}).status_code==200
    after=c.get('/api/v1/units/local/dashboard').json()
    assert after['trainee_count']==1 and after['skill_means']==prior['skill_means']
    assert c.get('/api/v1/units/local/analytics').json()['trainee_count']==1
    with storage.connect() as db:
        owner=db.execute('SELECT trainee FROM sessions WHERE id=?',(shared['issued']['session_id'],)).fetchone()[0]
        assert db.execute('SELECT COUNT(*) FROM skill_profiles WHERE trainee=?',(owner,)).fetchone()[0]==0
    assert c.get('/api/v1/units/local/skill-heatmap',params={'trainee':owner}).status_code==404
