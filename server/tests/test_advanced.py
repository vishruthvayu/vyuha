import copy,json
import pytest
from server.tests.test_api import client
from server.tests.test_director import complete_run
from server.exercises import PACKS,TACTICS,AuthorScenario,compile_authored,enrich
from server.engine import Simulation,replay,score,engagement_rule
from server.prioritisation import evaluate
from server.advanced import make_rapid
from server.review import build_review
from server import storage

@pytest.mark.parametrize('tactic',TACTICS)
def test_tactics_reproduce_and_change_contact_mechanics(tactic):
 req=AuthorScenario(name='Test exercise',tactic=tactic,mix=['bird','friendly_uav','hostile_quad','hostile_quad','no_rf_fpv','fixed_wing'])
 a=compile_authored(req);assert a==compile_authored(req)
 assert a['red_force']['tactic']==tactic
 assert len(a['red_force']['phases'])>=2
 assert a['tracks']!=compile_authored(req.model_copy(update={'seed':req.seed+1}))['tracks']
 if tactic=='SATURATION':assert max(t['spawn'] for t in a['tracks'] if t['identity']=='hostile')-min(t['spawn'] for t in a['tracks'] if t['identity']=='hostile')<=12
 if tactic=='DECOY_THEN_STRIKE':assert a['tracks'][4]['spawn']>a['tracks'][2]['spawn']
 if tactic=='LOW_APPROACH':
  assert all(t['altitude']==4 and t['radar_range']==100 for t in a['tracks'] if t['identity']=='hostile')
  sim=replay(a,[],480)
  assert all(t['detected'] is None for t in sim.tracks if t['identity']=='hostile')

@pytest.mark.parametrize('fields',[{'mix':[]},{'mix':['bird']*19},{'duration':60},{'terrain':'rural'},{'pack_id':'fake'},{'tactic':'SATURATION','mix':['bird','hostile_quad']},{'tactic':'DECOY_THEN_STRIKE','mix':['bird','hostile_quad']},{'tactic':'STAGGERED_WAVES','mix':['bird']},{'tactic':'LOW_APPROACH','mix':['bird']},{'name':'   '},{'sensor_fault':'unknown'},{'restricted':'true'}])
def test_authoring_rejects_invalid_contract(client,fields):
 r=client.post('/api/v1/scenario-library/preview',json={'name':'Valid test',**fields});assert r.status_code==422

@pytest.mark.parametrize('fault,field,value',[('radar_degraded','radar_status','jammed'),('radar_failed','radar_status','failed'),('rf_failed','rf_available',False)])
def test_authored_sensor_windows_and_instructor_restore(fault,field,value):
 s=compile_authored(AuthorScenario(name='Sensor window',sensor_fault=fault));sim=replay(s,[],180)
 assert getattr(sim,field)==value
 sensor='rf' if fault=='rf_failed' else 'radar'
 sim.control(dict(seq=1,tick=180,order=0,type='sensor_restore',payload={'sensor':sensor}))
 assert sim.rf_available and sim.radar_status=='normal'
 sim=replay(s,[],660);assert sim.rf_available and sim.radar_status=='normal'

def test_pack_rules_have_material_effect_and_frozen_snapshot(client):
 a=compile_authored(AuthorScenario(name='Army snapshot'));b=compile_authored(AuthorScenario(name='Critical snapshot',pack_id='critical-infrastructure'))
 t=dict(x=120,z=0,identity='hostile',rf=False,rules=a['doctrine']['rules']);assert engagement_rule(t,'kinetic')['effective']
 t['rules']=b['doctrine']['rules'];assert not engagement_rule(t,'kinetic')['effective']
 t.update(x=-20,z=50);assert engagement_rule(t,'kinetic')['restricted']
 t['rules']=a['doctrine']['rules'];assert not engagement_rule(t,'kinetic')['restricted']
 s=client.post('/api/v1/scenario-library',json={'name':'Frozen snapshot'}).json()
 sid,aar=complete_run(client,s,trainee='PACK-QA')
 old=PACKS['army-forward-post']['rules']['rf_range']
 try:
  PACKS['army-forward-post']['rules']['rf_range']=12
  assert client.get(f"/api/v1/scenarios/{s['id']}").json()==s
  assert client.get(f'/api/v1/sessions/{sid}/aar').json()['scorecard']==aar['scorecard']
 finally:PACKS['army-forward-post']['rules']['rf_range']=old

def test_library_save_immutable_playable_and_unit_launch(client):
 s=client.post('/api/v1/scenario-library',json={'name':'Library test'}).json()
 assert client.post('/api/v1/scenario-library',json={'name':'Library test'}).json()==s
 assert client.get('/api/v1/scenario-library').json()['scenarios']==[s]
 who=client.post('/api/v1/units/join',json={'callsign':'ADV-QA'}).json()['trainee_id']
 client.post(f'/api/v1/trainees/{who}/presence',json={'client_id':'advanced-client'})
 launch=dict(request_id='advanced-launch',trainees=[who],scenario_id=s['id'])
 r=client.post('/api/v1/units/local/exercises',json=launch);assert r.status_code==201,r.text
 assert client.post('/api/v1/units/local/exercises',json=launch).json()==r.json()
 assignment=client.get(f'/api/v1/trainees/{who}/assignment').json()['assignment'];assert assignment['scenario']==s
 sid=assignment['session_id'];assert client.post(f'/api/v1/sessions/{sid}/complete',json={'execution_tick':0}).status_code==200
 aar=client.get(f'/api/v1/sessions/{sid}/aar').json();assert aar['verified'] and aar['scenario']==s
 assert 'prioritisation' in aar['scorecard']

def ranking_scenario(n=3,tie=False):
 s=compile_authored(AuthorScenario(name='Ranking test',mix=['hostile_quad']*n,restricted=False))
 for i,t in enumerate(s['tracks']):t.update(spawn=0,bearing=30,distance=80 if tie else 60+i*20,speed=3,rf=True)
 s['red_force']['phases']=[dict(tick=0,role='direct',contacts=[t['id'] for t in s['tracks']])]
 return s

def actions_for(sim,ids):
 for id in ids:
  t=next(t for t in sim.tracks if t['id']==id)
  for a in [dict(k='designate'),dict(k='classify',kind=t['kind'],identity=t['identity']),dict(k='engage',effector='rf_jam')]:assert sim.act(dict(tick=sim.tick,track=id,order=len(sim.events),**a))
 return sim

@pytest.mark.parametrize('order,points,tau',[(['T1','T2','T3'],15,1),(['T3','T2','T1'],0,-1),(['T2','T1','T3'],10,1/3)])
def test_real_kendall_order_and_15_point_mapping(order,points,tau):
 sim=actions_for(Simulation(ranking_scenario()),order);r=evaluate(sim)
 assert r['points']==points;assert r['tau']==pytest.approx(tau);assert len(r['comparisons'])==3
 assert score(sim)['rows'][0]['prioritise']==points
 assert 0<=score(sim)['score']<=100

@pytest.mark.parametrize('n,engaged,expected',[(0,[],0),(1,[],0),(1,['T1'],15),(3,['T1'],5)])
def test_empty_single_unengaged_priority(n,engaged,expected):
 sim=actions_for(Simulation(ranking_scenario(n or 1)),engaged)
 if n==0:sim.tracks=[]
 assert evaluate(sim)['points']==expected

def test_ties_late_spawn_injected_and_ineffective_choices():
 sim=actions_for(Simulation(ranking_scenario(tie=True)),['T3','T1','T2']);r=evaluate(sim)
 assert r['tau'] is None and r['points']==15 and all(c['outcome']=='tie' for c in r['comparisons'])
 s=ranking_scenario(2);s['tracks'][1]['spawn']=60
 sim=actions_for(Simulation(s),['T1']);assert evaluate(sim)['comparisons']==[]
 while sim.tick<60:sim.step()
 sim.control(dict(seq=1,tick=60,order=3,type='inject_contact',payload={'kind':'fiber_fpv','bearing':60}))
 actions_for(sim,['T3','T2']);r=evaluate(sim)
 assert sim.tracks[2]['resolved'] is False and r['coverage']==1
 assert any(c['chosen']['track_id']=='T3' for c in r['comparisons'])
 assert not any({c['chosen']['track_id'],c['other']['track_id']}=={'T1','T2'} for c in r['comparisons'])

def test_ghost_priority_explains_facts_and_does_not_create_skill(client):
 s=ranking_scenario();sim=actions_for(Simulation(s),['T3','T2','T1'])
 review,card=build_review(s,sim.events,[],'priority-test',0)
 errors=[r for r in review['decision_reviews'] if r['reason_code']=='PRIORITY_INVERSION']
 assert errors and 'time to impact' in errors[0]['explanation'] and errors[0]['expected_action']['track_id']=='T1'
 assert all(r['skill_tags']==[] for r in errors)
 assert any(t['category']=='tactic_phase' for t in review['timeline'])
 from server.director import session_outcomes
 assert session_outcomes(review)['effector_choice']==dict(successes=3,failures=0)

@pytest.mark.parametrize('count',[10,15,20])
def test_rapid_rounds_seeded_real_evidence_and_balanced(count):
 rounds=make_rapid(7,count);assert rounds==make_rapid(7,count)
 assert len(rounds)==count and set(r['correct_answer'] for r in rounds)=={'bird','friendly_uav','hostile_quad','no_rf_fpv','fixed_wing'}
 for r in rounds:
  assert r['evidence']['visual']['available']
  if r['correct_answer']=='friendly_uav':assert r['evidence']['rf']['iff']=='friendly_reply'
  if r['correct_answer']=='no_rf_fpv':assert r['evidence']['rf']['signal'] is False
  if r['correct_answer']=='bird':assert r['evidence']['visual']['silhouette']=='bird'

def rapid_run(client,who,request='rapid-test',mistakes=False):
 start={'request_id':request,'trainee_id':who,'seed':7,'rounds':10};session=client.post('/api/v1/rapid-id',json=start).json()
 assert client.post('/api/v1/rapid-id',json=start).json()==session
 assert 'correct_answer' not in session['current'] and 'visual_type' not in session['current']
 rounds=make_rapid(7,10);sid=session['id']
 for i,r in enumerate(rounds):
  answer='hostile_quad' if mistakes and r['correct_answer'] in ['bird','friendly_uav'] else r['correct_answer']
  body={'round_index':i,'answer':answer,'round_start_ms':i*1000,'response_time_ms':1000}
  response=client.post(f'/api/v1/rapid-id/{sid}/answers',json=body);assert response.status_code==200,response.text
  assert client.post(f'/api/v1/rapid-id/{sid}/answers',json=body).json()==response.json()
  assert client.post(f'/api/v1/rapid-id/{sid}/answers',json={**body,'response_time_ms':900}).status_code==409
 return response.json()

def test_rapid_authoritative_metrics_idempotent_skill_and_analytics(client):
 who=client.post('/api/v1/units/join',json={'callsign':'RAPID-QA'}).json()['trainee_id']
 result=rapid_run(client,who,mistakes=True);metrics=result['result']
 assert metrics['correct']==6 and metrics['friendly_false_hostile']==2 and metrics['bird_confusion']==2 and metrics['median_response_ms']==1000
 p=client.get(f'/api/v1/trainees/{who}/profile').json();assert p['sessions']==1
 assert p['skills']['classification_iff']['alpha']==7 and p['skills']['classification_iff']['beta']==5
 assert all(v['observations']==0 and v['mean']==.5 for k,v in p['skills'].items() if k!='classification_iff')
 h=client.get(f'/api/v1/trainees/{who}/analytics').json();assert h['points'][-1]['means']=={k:v['mean'] for k,v in p['skills'].items()}
 assert h['points'][-1]['kind']=='Rapid ID'
 unit=client.get('/api/v1/units/local/analytics').json();assert unit['points'][-1]['means']==h['points'][-1]['means']

def test_rapid_sequence_bounds_timeout_and_conflicts(client):
 who=client.post('/api/v1/units/join',json={'callsign':'RAPID-BOUNDS'}).json()['trainee_id']
 start={'request_id':'bounds-test','trainee_id':who,'rounds':10}
 r=client.post('/api/v1/rapid-id',json=start).json();sid=r['id']
 assert client.post('/api/v1/rapid-id',json={**start,'rounds':20}).status_code==409
 for body,status in [({'round_index':1,'answer':'bird','round_start_ms':0,'response_time_ms':100},409),({'round_index':0,'answer':None,'round_start_ms':0,'response_time_ms':4999},422),({'round_index':0,'answer':'bird','round_start_ms':0,'response_time_ms':5001},422)]:assert client.post(f'/api/v1/rapid-id/{sid}/answers',json=body).status_code==status
 timeout={'round_index':0,'answer':None,'round_start_ms':0,'response_time_ms':5000};assert client.post(f'/api/v1/rapid-id/{sid}/answers',json=timeout).json()['reviews'][0]['correct'] is False
 assert client.post(f'/api/v1/rapid-id/{sid}/answers',json={**timeout,'round_index':1,'answer':'bird','response_time_ms':100}).status_code==422

def test_analytics_exact_comparison_director_focus_and_unit_cohort(client):
 who=client.post('/api/v1/units/join',json={'callsign':'TREND-QA'}).json()['trainee_id']
 other=client.post('/api/v1/units/join',json={'callsign':'UNTRAINED'}).json()['trainee_id']
 assert client.post('/api/v1/units/local/doctrine',json={'pack_id':'critical-infrastructure'}).status_code==200
 spec=client.post('/api/v1/scenarios/generate',json={'seed':17,'mode':'adaptive','trainee':who,'advanced':True}).json()
 assert spec['doctrine']['id']=='critical-infrastructure'
 sid,aar=complete_run(client,spec,who)
 rapid_run(client,who)
 h=client.get(f'/api/v1/trainees/{who}/analytics').json();p=client.get(f'/api/v1/trainees/{who}/profile').json()
 assert h['points'][-1]['means']=={k:v['mean'] for k,v in p['skills'].items()}
 assert h['points'][0]['director_focus']==spec['director_decision']['focus_skill']
 assert h['sessions'][0]['nodes']==aar['node_averages'] and h['sessions'][0]['leakers']==aar['scorecard']['leakers']
 u=client.get('/api/v1/units/local/analytics').json()
 assert u['points'][-1]['means']=={k:(v['mean']+.5)/2 for k,v in p['skills'].items()}
 assert client.get('/api/v1/units/local/doctrine').json()['version']==1
 history=[spec['director_decision']]
 another=enrich(spec,'critical-infrastructure',history=history)
 assert another['red_force']['tactic']!=spec['red_force']['tactic']


def test_three_default_packs_and_invalid_selector(client):
 packs=client.get('/api/v1/doctrine-packs').json()['packs']
 assert {p['id'] for p in packs}==set(PACKS) and all(p['version']==1 and p['example_values'] for p in packs)
 assert client.post('/api/v1/units/local/doctrine',json={'pack_id':'invalid'}).status_code==422
 assert client.post('/api/v1/scenarios/generate',json={'advanced':True,'pack_id':'invalid'}).status_code==422
 assert client.get('/api/v1/units/absent/analytics').status_code==404


def test_priority_excludes_nonhostiles_and_preserves_safety_failure():
 s=compile_authored(AuthorScenario(name='Mixed ordering',mix=['bird','friendly_uav','hostile_quad'],restricted=False))
 for t in s['tracks']:t.update(spawn=0,distance=60,bearing=45)
 sim=actions_for(Simulation(s),['T1','T2','T3'])
 r=evaluate(sim)
 assert [d['chosen']['track_id'] for d in r['choices']]==['T3'] and r['comparisons']==[]
 assert r['points']==15 and score(sim)['fratricide'] and score(sim)['score']==0


def test_unavailable_effector_respects_frozen_configuration_and_ghost():
 s=ranking_scenario(1);s['doctrine']['rules']['effectors']=['hold']
 sim=actions_for(Simulation(s),['T1']);assert not sim.tracks[0]['resolved']
 review,card=build_review(s,sim.events,[],'unavailable',0)
 r=next(r for r in review['decision_reviews'] if r['decision_kind']=='engagement')
 assert r['reason_code']=='EFFECTOR_UNAVAILABLE' and r['expected_action']['effector']=='hold'
 assert card['rows'][0]['engage']==0


def test_new_pack_hold_credit_works_outside_effector_range():
 s=compile_authored(AuthorScenario(name='Hold friendly',mix=['friendly_uav']))
 s['tracks'][0]['distance']=189
 sim=Simulation(s)
 while sim.tracks[0]['detected'] is None:sim.step()
 t=sim.tracks[0]
 for a in [dict(k='designate'),dict(k='classify',kind='quad',identity='friendly'),dict(k='engage',effector='hold')]:assert sim.act(dict(tick=sim.tick,track=t['id'],**a))
 assert score(sim)['rows'][0]['engage']==35 and not t['resolved']
