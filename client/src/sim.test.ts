import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {makeScenario} from './scenario';
import {HZ,inCivilZone,idealFor,replay,sample,score,Simulation} from './sim';
import type {Action,Scenario} from './types';

function expert(scenario:Scenario){const sim=new Simulation(scenario);while(!sim.state.done){for(const t of sim.state.tracks){if(!t.active||t.detected===null)continue;const tick=sim.state.tick;if(t.designated===null){sim.act({tick,k:'designate',track:t.id});sim.act({tick,k:'classify',track:t.id,kind:t.kind,identity:t.identity});}
const effector=idealFor(t);if(t.attempts.includes('hold'))continue;if(effector==='kinetic'&&(Math.hypot(t.x,t.z)>160||inCivilZone(t)))continue;sim.act({tick,k:'engage',track:t.id,effector});}sim.step();}return sim;}

test('scripted scenario is deterministic and changes with seed',()=>{assert.deepEqual(makeScenario(12),makeScenario(12));assert.notDeepEqual(makeScenario(12).tracks,makeScenario(13).tracks);});
test('example expert clears all hostile contacts with no safety flags',()=>{const sim=expert(makeScenario());const card=score(sim);assert.equal(card.score,100);assert.equal(card.leakers,0);assert.equal(card.fratricide,false);assert.equal(card.roe_breaches,0);assert.equal(card.passed,true);assert.deepEqual(score(replay(sim.scenario,sim.events,2250)),card);});
test('no-RF threat survives RF jamming',()=>{const sim=new Simulation(makeScenario());while(sim.state.tick<632)sim.step();const t=sim.state.tracks.find(t=>t.id==='T5')!;assert.notEqual(t.detected,null);sim.act({tick:632,k:'designate',track:'T5'});sim.act({tick:632,k:'classify',track:'T5',kind:'fiber_fpv',identity:'hostile'});sim.act({tick:632,k:'engage',track:'T5',effector:'rf_jam'});assert.equal(t.resolved,false);assert.match(sim.state.messages.at(-1)!.text,/No RF link/);});
test('non-hostile engagement fails the session',()=>{const sim=new Simulation(makeScenario());const t=sim.state.tracks.find(t=>t.id==='T2')!;while(t.detected===null)sim.step();const tick=sim.state.tick;sim.act({tick,k:'designate',track:'T2'});sim.act({tick,k:'classify',track:'T2',kind:'quad',identity:'friendly'});sim.act({tick,k:'engage',track:'T2',effector:'rf_jam'});while(!sim.state.done)sim.step();assert.equal(score(sim).fratricide,true);assert.equal(score(sim).score,0);});
test('detection begins at first observation, never before spawn',()=>{const sim=new Simulation(makeScenario());assert.equal(sim.state.tracks.find(t=>t.id==='T5')!.detected,null);while(sim.state.tick<630)sim.step();const t=sim.state.tracks.find(t=>t.id==='T5')!;assert.ok(t.detected===null||t.detected>=630);});
test('TypeScript and Python reproduce the same sensors, event outcomes, and score',()=>{for(const seed of [482913,7,4294967295]){const spec=makeScenario(seed);const sim=expert(spec);const snapshots=[0,60,632,700,900,1400,2250].map(tick=>{const s=replay(spec,sim.events.filter(e=>e.tick<=tick),tick);return {tick,tracks:s.state.tracks.map(t=>({id:t.id,detected:t.detected,resolved:t.resolved,impact:t.impact,radar:t.radar,thermal:t.thermal}))};});
 const input={seed,spec,events:sim.events,endTick:75*HZ,snapshots,samples:[0,1,700].map(t=>sample(seed,t,2,0))};
 const py=spawnSync('.venv/bin/python',['-c',`import json,sys\nfrom server.engine import make_scenario,replay,score,sample\nx=json.load(sys.stdin)\ns=make_scenario(x['seed'])\nassert s==x['spec']\nfor expected in x['snapshots']:\n r=replay(s,[e for e in x['events'] if e['tick']<=expected['tick']],expected['tick'])\n actual={'tick':r.tick,'tracks':[{k:t[k] for k in ['id','detected','resolved','impact','radar','thermal']} for t in r.tracks]}\n assert actual==expected,(actual,expected)\nassert [sample(x['seed'],t,2,0) for t in [0,1,700]]==x['samples']\nprint(json.dumps(score(replay(s,x['events'],x['endTick']))))`],{cwd:'..',input:JSON.stringify(input),encoding:'utf8'});
 // The subprocess cwd is the project root, so use its local interpreter.
 if(py.error&&String(py.error).includes('ENOENT'))throw py.error;
 assert.equal(py.status,0,py.stderr);assert.deepEqual(JSON.parse(py.stdout),score(sim));}});
