import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {testPython} from './test-python';
import {raidPosition,raidContactActive,type RaidTrack} from './raid-v2';

test('all eight procedural raid families preserve closed-form Python/TypeScript motion parity',()=>{
 const py=spawnSync(testPython(),['-m','server.tests.raid_v2_fixtures'],{cwd:'..',encoding:'utf8',maxBuffer:12*1024*1024});
 assert.equal(py.status,0,py.stderr);
 const cases=JSON.parse(py.stdout) as {family:string;tracks:{track:RaidTrack;positions:{tick:number;x:number;z:number}[]}[]}[];
 assert.equal(cases.length,8);
 let comparisons=0;
 for(const row of cases)for(const item of row.tracks)for(const point of item.positions){
  assert.deepEqual(raidPosition(item.track,point.tick),{x:point.x,z:point.z},`${row.family}/${item.track.id}@${point.tick}`);
  comparisons++;
 }
 assert.ok(comparisons>3000,`Only ${comparisons} comparisons`);
});

test('v2 contact expiry is exact and closed-form seek is independent of callback schedules',()=>{
 const t:RaidTrack={id:'T1',kind:'quad',identity:'hostile',rf:true,spawn:30,bearing:42,distance:800,speed:12,altitude:40,motion:{version:1,primitive:'weave',phase_s:8,lateral_m:30,period_s:12,turn_deg:0},expires_tick:900};
 assert.equal(raidContactActive(t,29),false);
 assert.equal(raidContactActive(t,30),true);
 assert.equal(raidContactActive(t,899),true);
 assert.equal(raidContactActive(t,900),false);
 const direct=raidPosition(t,700);
 for(const tick of [0,30,280,900,1,699])raidPosition(t,tick);
 assert.deepEqual(raidPosition(t,700),direct);
});
