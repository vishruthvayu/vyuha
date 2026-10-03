import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {replay,score} from './sim';
import {recordedObservations,type Recording} from './observations';
import {audioCue} from './LocalAudio';
import {qualityAfterSamples,pixelRatio} from './quality';
import {parseJSONImport} from './import-json';
import {scaleScenario,median} from './Benchmark';
import Evidence from './Evidence';
import Transfer from './Transfer';
import Evaluation from './Evaluation';
import Recorded from './Recorded';
import type {Action,Scenario,ScoreCard,Track} from './types';

test('rural terrain/fog preserve score and sensor parity at 54 new checkpoints; recorded adapters match',()=>{
 const r=spawnSync('.venv/bin/python',['-m','server.tests.hardening_fixtures'],{cwd:'..',encoding:'utf8',maxBuffer:8*1024*1024});assert.equal(r.status,0,r.stderr);const f=JSON.parse(r.stdout) as {rural:{scenario:Scenario;events:Action[];checkpoints:{tick:number;radar_status:string;rf_available:boolean;tracks:unknown[]}[];scorecard:ScoreCard}[];recording:Recording;recorded_observations:unknown[]};assert.equal(f.rural.length,6);
 for(const x of f.rural){assert.equal(x.scenario.terrain_id,'rural_forward_base');for(const c of x.checkpoints){const s=replay(x.scenario,x.events.filter(e=>e.tick<=c.tick),c.tick).state;assert.deepEqual({tick:s.tick,radar_status:s.radarStatus,rf_available:s.rfAvailable,tracks:s.tracks.map(({id,detected,resolved,impact,radar,thermal,classification,declared,attempts})=>({id,detected,resolved,impact,radar,thermal,classification,declared,attempts}))},c);}assert.deepEqual(score(replay(x.scenario,x.events,2250)),x.scorecard);}
 assert.deepEqual([0,29,30,299,300].map(t=>recordedObservations(f.recording,t)),f.recorded_observations);
});

test('audio range, observed-contact gate, bird exclusion and fog attenuation prevent omniscient cues',()=>{
 const t={x:20,z:20,active:true,detected:0,kind:'quad'} as Track;const cue=audioCue(t,0)!;assert.ok(cue.gain>0&&cue.pan>0);assert.ok(audioCue(t,.6)!.gain<cue.gain);
 assert.equal(audioCue({...t,detected:null},0),null);assert.equal(audioCue({...t,x:80,z:0},0),null);assert.equal(audioCue({...t,kind:'bird'},0),null);assert.equal(audioCue({...t,active:false},0),null);
});

test('quality changes require sustained measured low FPS and reach tactical fallback',()=>{
 assert.equal(qualityAfterSamples('high',[10,10]),'high');assert.equal(qualityAfterSamples('high',[10,10,30]),'high');assert.equal(qualityAfterSamples('high',[10,10,10]),'medium');assert.equal(qualityAfterSamples('medium',[10,10,10]),'low');assert.equal(qualityAfterSamples('low',[10,10,10]),'tactical');assert.ok(pixelRatio.low<pixelRatio.high);
});

test('bounded JSON import errors reject malformed/object shape and UTF-8 byte overruns',()=>{
 assert.deepEqual(parseJSONImport('{"schema_version":1}',100),{schema_version:1});assert.throws(()=>parseJSONImport('[]',100),/object/);assert.throws(()=>parseJSONImport('{',100),/Invalid JSON/);assert.throws(()=>parseJSONImport('{"x":"🌾"}',10),/size limit/);
});

test('scale fixtures keep all contact kinds, deterministic positions and supported counts',()=>{
 for(const n of [8,25,50,100,200]){const s=scaleScenario(n);assert.equal(s.tracks.length,n);assert.equal(new Set(s.tracks.map(t=>t.id)).size,n);assert.deepEqual(s,scaleScenario(n));assert.ok(s.tracks.every(t=>t.spawn===0&&t.speed>0));}assert.throws(()=>scaleScenario(1000));assert.equal(median([1,5,2,4]),3);
});

test('evidence/import interfaces show limitations without fabricated final validation claims',()=>{
 const e=renderToStaticMarkup(<Evidence/>);assert.match(e,/versioned validation manifest/);assert.doesNotMatch(e,/106 passed|130 passed/);
 const t=renderToStaticMarkup(<Transfer/>);assert.match(t,/HMAC-SHA256/);assert.match(t,/No production authentication/);assert.match(t,/Validate and import bundle/);
 const r=renderToStaticMarkup(<Recorded/>);assert.match(r,/No tactical score/);assert.match(r,/missing ground truth remains unassessable/);assert.match(r,/Validate and import JSON/);
});

test('evaluation enrollment requires participant agreement and pseudonymous IDs',()=>{
 const old=globalThis.localStorage;Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>null}});
 try{const html=renderToStaticMarkup(<Evaluation/>);assert.match(html,/Participant ID/);assert.match(html,/Participant has agreed/);assert.match(html,/disabled=""[^>]*>Create evaluation protocol/);assert.match(html,/No human study is conducted automatically/);}finally{Object.defineProperty(globalThis,'localStorage',{configurable:true,value:old});}
});
