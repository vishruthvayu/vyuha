import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {testPython} from './test-python';
import {Simulation,score} from './sim';
import type {Scenario} from './types';
test('all 50 individual curriculum items preserve Python/TypeScript sensor and scoring parity at 300 checkpoints',()=>{
 const py=spawnSync(testPython(),['-m','server.tests.learning_fixtures'],{cwd:'..',encoding:'utf8',maxBuffer:32*1024*1024});
 assert.equal(py.status,0,py.stderr);
 type Point={tick:number;tracks:{x:number;z:number}[];[key:string]:unknown};
 const fixtures=JSON.parse(py.stdout) as {id:string;scenario:Scenario;checkpoints:Point[]}[];
 assert.equal(fixtures.length,50);let count=0;
 for(const f of fixtures){const sim=new Simulation(f.scenario);const expected=new Map(f.checkpoints.map(p=>[p.tick,p]));while(sim.state.tick<=1800){const p=expected.get(sim.state.tick);if(p){const s=sim.snapshot();const tracks=s.tracks.map(({id,x,z,altitude,active,detected,designated,resolved,impact,radar,thermal,classification,declared,attempts,observation})=>({id,x,z,altitude,active,detected,designated,resolved,impact,radar,thermal,classification,declared,attempts,observation}));for(let i=0;i<tracks.length;i++){assert.ok(Math.abs(tracks[i].x-p.tracks[i].x)<=1e-9);assert.ok(Math.abs(tracks[i].z-p.tracks[i].z)<=1e-9);tracks[i].x=p.tracks[i].x;tracks[i].z=p.tracks[i].z;}assert.deepEqual({tick:s.tick,radar_status:s.radarStatus,rf_available:s.rfAvailable,night:s.night,paused:s.paused,tracks,false_contacts:s.falseContacts??[],events:sim.events,commands:sim.commands,scorecard:score(sim)},p,`${f.id}@${s.tick}`);count++;}if(sim.state.tick===1800)break;sim.step(true);}}
 assert.equal(count,300);
});
