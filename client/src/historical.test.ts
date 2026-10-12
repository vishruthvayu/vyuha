import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeScenario} from './scenario';
import {Simulation,score,replay} from './sim';
import * as frozen from './sim_v1_0_1';
import type {Scenario} from './types';

test('released client trace and score remain exact after dispatch separation',()=>{
 const spec=makeScenario(482913);const a=new Simulation(spec),b=new frozen.Simulation(spec);
 for(let i=0;i<2250;i++){a.step();b.step();if(i%75===0)assert.deepEqual(a.snapshot(),b.snapshot());}
 assert.deepEqual(score(a),frozen.score(b));assert.equal(score(a).engine_version,'vyuha-0.2.0');
});
test('unknown future models and invalid replay horizons fail explicitly',()=>{
 const future={...makeScenario(),engine_version:'unknown'} as Scenario;
 assert.throws(()=>new Simulation(future),/Unsupported/);
 for(const tick of [2251,-1,1.5])assert.throws(()=>replay(makeScenario(),[],tick),/horizon/);
});
