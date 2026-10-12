#!/usr/bin/env python3
"""Disposable HTTP release walkthrough using ordinary scoring, never human evidence."""
import argparse,json,os,sys,time,urllib.request
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from server.engine import Simulation,ideal,engagement_rule
from server.advanced import make_rapid
from server import storage
p=argparse.ArgumentParser();p.add_argument('--url',default='http://127.0.0.1:8002');p.add_argument('--output',type=Path,required=True);p.add_argument('--officer-password-env',default='VYUHA_VALIDATION_PASSWORD');args=p.parse_args()
token=None
def call(path,body=None):
 req=urllib.request.Request(args.url+'/api/v1'+path,data=json.dumps(body).encode() if body is not None else None,headers={'Content-Type':'application/json',**({'Authorization':'Bearer '+token} if token else {})})
 with urllib.request.urlopen(req,timeout=120) as r:return json.load(r)
password=os.environ.get(args.officer_password_env)
if not password: p.error('Set the officer password in the requested environment variable; never include it in evidence output.')
token=call('/auth/login',dict(password=password))['token']
t0=time.monotonic()
with storage.connect() as db:
 assert db.execute('SELECT COUNT(*) FROM sessions').fetchone()[0]==0,'Use a completely new disposable DB'
 assert db.execute('SELECT COUNT(*) FROM trainees').fetchone()[0]==0
 db.execute("INSERT INTO units VALUES ('demo-release','Release Validation — synthetic QA')")
identity=call('/units/join',dict(unit_id='demo-release',callsign='DEMO-QA',request_id='stage7-fresh'))
tid=identity['trainee_id'];before=call(f'/trainees/{tid}/profile');assert before['sessions']==0
spec=call('/scenarios/generate',dict(mode='adaptive',advanced=True,trainee=tid,seed=482913))
sid=call('/sessions',dict(scenario_id=spec['id'],trainee=tid))['id']
command=call(f'/instructor/sessions/{sid}/commands',dict(command_id='release-radar',type='sensor_fault',payload=dict(sensor='radar',mode='jammed')))['command']
sim=Simulation(spec);order=0;err=False
while sim.tick<2250:
 if sim.tick==30:
  command.update(tick=30,order=order);order+=1;assert sim.control(command)
 for t in sim.tracks:
  if not t['active'] or t['detected'] is None:continue
  def act(k,**kw):
   global order
   assert sim.act(dict(tick=sim.tick,order=order,k=k,track=t['id'],**kw));order+=1
  if t['designated'] is None:
   act('designate');act('classify',kind=t['kind'],identity=t['identity'])
  if t['kind']=='fiber_fpv' and not err:
   act('engage',effector='rf_jam');err=True
  e=ideal(t);rule=engagement_rule(t,e)
  if 'hold' in t['attempts'] or (e!='hold' and (not rule['in_range'] or rule['restricted'])):continue
  act('engage',effector=e)
 sim.step()
assert err
call(f'/sessions/{sid}/control-state',dict(tick=2249,paused=False,active_contacts=0,radar_status='jammed',rf_available=True,night=True,applied=[{k:command[k] for k in ['seq','tick','order']}]))
call(f'/sessions/{sid}/events',dict(seq=0,events=sim.events))
card=call(f'/sessions/{sid}/complete',dict(execution_tick=2250))
aar=call(f'/sessions/{sid}/aar');assert aar['verified'] and aar['scorecard']==card
assert any(r['reason_code']=='NO_RF_JAM_INEFFECTIVE' for r in aar['decision_reviews'])
after=call(f'/trainees/{tid}/profile');assert after['sessions']==1
next_spec=call('/scenarios/generate',dict(mode='adaptive',advanced=True,trainee=tid,seed=482914))
assert next_spec['director_decision']['trainee_id']==tid
rapid=call('/rapid-id',dict(request_id='stage7-rapid-qa',trainee_id=tid,seed=482913,rounds=10))
for i,r in enumerate(make_rapid(482913,10)):
 rapid=call(f"/rapid-id/{rapid['id']}/answers",dict(round_index=i,answer=r['correct_answer'],round_start_ms=i*1000,response_time_ms=500))
assert rapid['result']['verified'] and rapid['result']['correct']==10
analytics=call(f'/trainees/{tid}/analytics');unit=call('/units/demo-release/dashboard');unit_trend=call('/units/demo-release/analytics')
assert len(analytics['points'])==2 and len(unit_trend['points'])==2 and unit['session_count']==1
out=dict(scope='Synthetic QA via real HTTP and ordinary Python engine; disposable fresh database. Not a human test, physical LAN test or WAN-off validation.',initial_sessions=0,initial_trainees=0,new_unit='demo-release',new_trainee=tid,adaptive_focus=spec['director_decision']['focus_skill'],session_id=sid,instructor_command='radar jam acknowledged at tick 30',verified_score=card['score'],ghost='NO_RF_JAM_INEFFECTIVE present',time_machine_basis='Full ordered actions/command timeline returned by verified AAR; UI replay checked separately',profile_sessions=after['sessions'],next_director=next_spec['director_decision'],rapid=dict(rounds=10,correct=10,timing='Synthetic 500 ms per answer, not human performance'),analytics_points=2,unit_completed_tactical=1,elapsed_seconds=round(time.monotonic()-t0,3))
args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
