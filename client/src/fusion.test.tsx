import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {renderToStaticMarkup} from 'react-dom/server';
import {fusionAdvice,sanitizeFusionEvidence,brierScore,reviewReliance,fusionConfiguration,type FusionConfig} from './fusion';
import {FusionPanel} from './FusionPanel';
import type {SensorObservation} from './sensors-v2';
const context={session_id:'session-A',scenario_id:'scenario-A'};
const o:SensorObservation={version:'vyuha-0.4.0',tick:30,track_id:'T1',radar:{available:true,state:'confirmed',detected:true,fresh:true,position:{x:0,z:100,altitude:20},sample_tick:30},eo:{available:true,level:'recognise',position:{x:0,z:100,altitude:20},silhouette:'multirotor',sample_tick:30},ir:{available:false,level:'none',position:null,silhouette:null,sample_tick:null},rf:{available:true,detected:false,band_ghz:null,bearing_deg:null},iff:{available:true,cue:'no_reply',registration_id:null}};
const adv=(observation=o,config:Partial<FusionConfig>={})=>fusionAdvice(observation,{},config,context)!;
test('indistinguishable observations and injected truth cannot change advice',()=>{
 assert.deepEqual(adv({...o,kind:'fiber_fpv',identity:'hostile',rf_link:true} as SensorObservation),adv());
 assert.deepEqual(adv({...o,kind:'quad',identity:'friendly'} as SensorObservation),adv());
 assert.ok(!JSON.stringify(adv().evidence).includes('hostile'));
});
test('RF and IFF silence preserve unresolved intent and type ambiguity',()=>{
 const a=adv();assert.equal(a.identity,'unresolved');assert.equal(a.recommendation,'verify_identity');
 assert.ok(Math.abs(a.hypotheses.find(h=>h.kind==='quad')!.score-a.hypotheses.find(h=>h.kind==='fiber_fpv')!.score)<.025);
 assert.ok(a.uncertainty>.8);assert.ok(a.contributions.some(c=>/does not prove/.test(c.reason)));
 assert.equal(fusionAdvice(o,{identity:'hostile'},{},context)!.identity,'unresolved');
});
test('stale/future/unavailable/detection-only optics cannot provide shape',()=>{
 for(const optical of [{...o.eo,available:false},{...o.eo,sample_tick:23},{...o.eo,sample_tick:31},{...o.eo,level:'detect' as const}]) assert.ok(!adv({...o,eo:optical}).contributions.some(c=>c.cue==='optical_shape'));
 assert.equal(sanitizeFusionEvidence({...o,iff:{...o.iff,available:false,cue:'friendly_reply'}}).iff,'unavailable');
 assert.equal(sanitizeFusionEvidence({...o,rf:{...o.rf,available:false,detected:true}}).rf,'unavailable');
});
test('correlated optical shapes count once; disagreements preserve uncertainty',()=>{
 assert.deepEqual(adv().hypotheses,adv({...o,ir:{...o.eo}}).hypotheses);
 assert.ok(adv({...o,ir:{...o.eo,silhouette:'bird'}}).uncertainty>adv().uncertainty);
});
test('assessment and absent frozen config hide all UI advice',()=>{
 assert.equal(fusionAdvice(o,{}, {mode:'assessment'},context),null);
 assert.equal(renderToStaticMarkup(<FusionPanel observation={o} config={{mode:'assessment'}} context={context}/>),'');
 assert.equal(renderToStaticMarkup(<FusionPanel observation={o} context={context}/>),'');
 assert.match(renderToStaticMarkup(<FusionPanel observation={o} config={{}} context={context}/>),/not calibrated probabilities/);
});
test('synthetic wrong suggestion is reproducible and visibly labelled',()=>{
 const bird={...o,eo:{...o.eo,silhouette:'bird' as const}};assert.equal(adv(bird).hypotheses[0].kind,'bird');
 const wrong=adv(bird,{exercise:'rf_overweight',bias_seed:2});assert.equal(wrong.hypotheses[0].kind,'quad');assert.ok(wrong.bias_injected);
 assert.deepEqual(wrong,adv(bird,{exercise:'rf_overweight',bias_seed:2}));
 assert.match(renderToStaticMarkup(<FusionPanel observation={bird} config={{exercise:'rf_overweight'}} context={context}/>),/deliberately biased/);
});
test('receipt bound to scenario/session/evidence/config/prior; invalid config rejected',()=>{
 for(const b of [fusionAdvice(o,{}, {},{...context,session_id:'session-B'}),fusionAdvice(o,{}, {},{...context,scenario_id:'scenario-B'}),fusionAdvice(o,{kind:'bird'},{},context),adv({...o,tick:31}),adv(o,{bias_seed:1})]) assert.notEqual(adv().exposure_id,b!.exposure_id);
 assert.throws(()=>fusionConfiguration({bias_seed:NaN}));assert.throws(()=>fusionConfiguration({unknown:1} as Partial<FusionConfig>));
});
test('Brier diagnostic rejects malformed distributions and has proper bounds',()=>{
 assert.equal(brierScore({bird:1,quad:0,fixed_wing:0,fiber_fpv:0},'bird'),0);
 assert.equal(brierScore({bird:1,quad:0,fixed_wing:0,fiber_fpv:0},'quad'),2);
 assert.equal(brierScore({bird:.25,quad:.25,fixed_wing:.25,fiber_fpv:.25},'quad'),.75);
 assert.throws(()=>brierScore({bird:NaN,quad:0,fixed_wing:0,fiber_fpv:1},'quad'));
 assert.throws(()=>brierScore({bird:.5,quad:.5,fixed_wing:.5,fiber_fpv:.5},'quad'));
});
test('alignment does not imply reliance and unrelated/stale decisions are unassessable',()=>{
 const a=adv();assert.equal(reviewReliance(a,{tick:31,track:'T1',kind:a.hypotheses[0].kind}).relation,'aligned');
 assert.equal(reviewReliance(a,{tick:31,track:'T1',kind:'bird'}).relation,'overrode');
 for(const d of [{tick:29,track:'T1',kind:'bird' as const},{tick:121,track:'T1',kind:'bird' as const},{tick:31,track:'T2',kind:'bird' as const}])assert.equal(reviewReliance(a,d).relation,'unassessable');
 assert.match(reviewReliance(a,{tick:31,track:'T1',kind:'bird'}).note,/not proof/);
});
test('independent Python/TS Fusion results and receipt IDs match for64 cases',()=>{
 const inputs=[];
 for(const shape of [null,'bird','fixed_wing','multirotor'] as const)for(const signal of [true,false])for(const cue of ['friendly_reply','registered_civil','no_reply','unavailable'] as const)for(const exercise of ['normal','rf_overweight'] as const){
  const observation={...o,eo:{...o.eo,level:shape?'recognise' as const:'detect' as const,silhouette:shape},rf:{...o.rf,detected:signal},iff:{...o.iff,cue}};
  inputs.push({observation,prior:{kind:'quad' as const,identity:'hostile' as const},config:{exercise,bias_seed:2},context});
 }
 const script='import json,sys\nfrom server.fusion import advice\nprint(json.dumps([advice(**x) for x in json.load(sys.stdin)]))';
 const python=JSON.parse(execFileSync('.venv/bin/python',['-c',script],{cwd:process.cwd()+'/..',input:JSON.stringify(inputs),encoding:'utf8',maxBuffer:1000000}));
 inputs.forEach((x,i)=>assert.deepEqual(fusionAdvice(x.observation,x.prior,x.config,x.context),python[i],`case ${i}`));
});
