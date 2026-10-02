import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {renderToStaticMarkup} from 'react-dom/server';
import {EvidenceView,GhostPanel,GhostTimeline,timelineSeek,actionLabel,ReplayTracks} from './Ghost';
import {replay} from './sim';
import type {Record as TrainingRecord} from './types';

const generated=spawnSync('.venv/bin/python',['-c',`import json
from server.engine import make_scenario
from server.review import build_review
spec=make_scenario()
records=[]
for failed in [False,True]:
 cs=[dict(command_id='jam',session_id='test',seq=1,issued_at='2026-10-03T00:00:00Z',type='sensor_fault',payload=dict(sensor='radar',mode='jammed'),tick=10,order=0)]
 if failed:cs.append(dict(command_id='rf',session_id='test',seq=2,issued_at='2026-10-03T00:00:00Z',type='sensor_fault',payload=dict(sensor='rf',mode='failed'),tick=10,order=1))
 n=len(cs)
 cs.append(dict(command_id='inject',session_id='test',seq=n+1,issued_at='2026-10-03T00:00:00Z',type='inject_contact',payload=dict(kind='fiber_fpv',bearing=40),tick=30,order=n))
 log=[dict(tick=31,order=n+1,k='designate',track='T9'),dict(tick=31,order=n+2,k='classify',track='T9',kind='fiber_fpv',identity='hostile'),dict(tick=31,order=n+3,k='engage',track='T9',effector='rf_jam')]
 review,card=build_review(spec,log,cs,'test',2250)
 records.append(dict(id='test',trainee='QA-GHOST',scenario=spec,events=log,commands=cs,endTick=2250,scorecard=card,created_at='2026-10-03T00:00:00Z',verified=True,**review))
print(json.dumps(records))`],{cwd:'..',encoding:'utf8'});
assert.equal(generated.status,0,generated.stderr);
const [record,rfFailed]=JSON.parse(generated.stdout) as TrainingRecord[];
const mistake=(r:TrainingRecord)=>r.decision_reviews!.find(d=>d.reason_code==='NO_RF_JAM_INEFFECTIVE')!;
const html=(r:TrainingRecord)=>renderToStaticMarkup(<GhostPanel record={r} selectedId={mistake(r).decision_id} onChoose={()=>{}}/>);

test('timeline decision jump reconstructs the exact pre-action boundary',()=>{
 const d=mistake(record);const entry=record.timeline!.find(e=>e.decision_id===d.decision_id&&e.category==='trainee_action')!;
 const point=timelineSeek(entry);assert.equal(point.tick,d.tick);assert.equal(point.beforeOrder,d.order);
 const before=replay(record.scenario,record.events,point.tick,record.commands,point.beforeOrder).state.tracks.find(t=>t.id==='T9')!;
 assert.equal(before.classification,'fiber_fpv');assert.deepEqual(before.attempts,[]);
 const after=replay(record.scenario,record.events,d.tick,record.commands).state.tracks.find(t=>t.id==='T9')!;
 assert.deepEqual(after.attempts,['rf_jam']);assert.equal(after.resolved,false);
});
test('Ghost panel renders actual and authoritative expected decisions',()=>{const output=html(record);assert.match(output,/Your decision/);assert.match(output,/RF jammer/);assert.match(output,/Expected decision/);assert.match(output,/>Kinetic</);assert.match(output,/Ground-truth rubric reference/);});
test('failed RF and IFF evidence renders unavailable without hidden truth',()=>{const output=renderToStaticMarkup(<EvidenceView review={mistake(rfFailed)}/>);assert.match(output,/Unavailable/);assert.doesNotMatch(output,/No control link detected|Friendly reply|>hostile<|>No-RF FPV</);});
test('degraded radar evidence and modeled silhouette render grounded values',()=>{const output=renderToStaticMarkup(<EvidenceView review={mistake(record)}/>);assert.match(output,/DEGRADED/);assert.match(output,/multirotor silhouette/);assert.match(output,/identity unconfirmed/);assert.doesNotMatch(output,/>No-RF FPV</);});
test('instructor commands and sensor transitions appear as separate timeline categories',()=>{const output=renderToStaticMarkup(<GhostTimeline record={record} onJump={()=>{}}/>);assert.match(output,/data-category="instructor_action"/);assert.match(output,/data-category="sensor_transition"/);assert.match(output,/RADAR jammed/);const injection=record.timeline!.find(e=>e.category==='instructor_action'&&e.code==='inject_contact')!;const p=timelineSeek(injection);assert.equal(replay(record.scenario,record.events,p.tick,record.commands,p.beforeOrder).state.tracks.length,9);});
test('no-RF explanation and score scope come from the server review',()=>{const r=mistake(record);const output=html(record);assert.match(output,/NO_RF_JAM_INEFFECTIVE/);assert.match(output,/no RF control link/);assert.match(output,/Final contact node, shared across all attempts/);assert.match(output,/Engagement: 0 \/ 35/);assert.match(output,/Effector choice/);assert.equal(r.score_effect.session_penalty,10);assert.match(output,new RegExp((r.consequence.tick!/30).toFixed(2).replace('.','\\.')));});
test('device-only scores do not produce client-generated Ghost expectations',()=>{const output=renderToStaticMarkup(<GhostPanel record={{...record,verified:false,decision_reviews:undefined}} selectedId={null} onChoose={()=>{}}/>);assert.match(output,/Verification pending/);assert.doesNotMatch(output,/Expected decision/);});
test('same-tick designation seek shows unmodified prior classification',()=>{const d=record.decision_reviews!.find(d=>d.track_id==='T9'&&d.decision_kind==='detection')!;const state=replay(record.scenario,record.events,d.tick,record.commands,d.order??undefined).state;assert.equal(state.tracks.find(t=>t.id==='T9')!.designated,null);assert.equal(actionLabel(d.trainee_action),'Designate');});

test('replay contact history uses observed contacts and trainee labels across seek boundaries',()=>{const before=renderToStaticMarkup(<ReplayTracks state={replay(record.scenario,record.events,0,record.commands).state} onSelect={()=>{}}/>);assert.doesNotMatch(before,/T9|No-RF FPV/);const after=renderToStaticMarkup(<ReplayTracks state={replay(record.scenario,record.events,31,record.commands).state} onSelect={()=>{}}/>);assert.match(after,/Replay track T9/);assert.match(after,/No-RF FPV/);assert.match(after,/active/);});
