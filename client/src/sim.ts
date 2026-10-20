/** Explicit dispatch; frozen released algorithms remain independent of new models. */
import * as legacy from './sim_v1_0_1';
import * as finale from './sim-v2';
import type {Scenario,Action,AppliedCommand} from './types';
export * from './sim_v1_0_1';
export function validateEngine(scenario:Scenario){
 if(scenario.engine_version==='vyuha-0.4.0'){if(scenario.version!==2||!Number.isInteger(scenario.duration)||scenario.duration<60||scenario.duration>180)throw new Error('Unsupported finale scenario duration/schema');return;}
 const version=(scenario as Scenario&{engine_version?:string}).engine_version;
 if(version!==undefined&&!['vyuha-0.2.0','vyuha-0.3.0'].includes(version))throw new Error('Unsupported frozen scenario engine version');
 if(scenario.version!==1)throw new Error('Unsupported frozen scenario schema version');
}
export class Simulation extends legacy.Simulation {
 constructor(scenario:Scenario){validateEngine(scenario);super(scenario);if(scenario.engine_version==='vyuha-0.4.0')return new finale.Simulation(scenario);}
}
export function replay(scenario:Scenario,events:Action[],endTick:number,commands:AppliedCommand[]=[],beforeOrder?:number){
 validateEngine(scenario);
 if(!Number.isInteger(endTick)||endTick<0||endTick>Math.round(scenario.duration*legacy.HZ))throw new Error('Replay horizon exceeds the frozen exercise duration');
 return scenario.engine_version==='vyuha-0.4.0'?finale.replay(scenario,events,endTick,commands,beforeOrder):legacy.replay(scenario,events,endTick,commands,beforeOrder);
}
export function score(sim:legacy.Simulation){return sim.scenario.engine_version==='vyuha-0.4.0'?finale.score(sim as finale.Simulation):legacy.score(sim);}
export function position(track:import('./types').Track,tick:number){return track.motion?finalePosition(track,tick):legacy.position(track,tick);}
import {raidPosition as finalePosition} from './raid-v2';
