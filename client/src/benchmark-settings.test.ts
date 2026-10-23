import test from 'node:test';
import assert from 'node:assert/strict';
import {benchmarkSettings,benchmarkLink} from './benchmark-settings';
test('fixed retained qualification settings survive a shareable link without personal hardware notes',()=>{
 const settings=benchmarkSettings('?contacts=200&seconds=180&retained=1&graphics=medium&world=urban_outpost&night=0&view=day&camera=observer&hardware=PRIVATE&callsign=PRIVATE');
 assert.equal(settings.count,200);assert.equal(settings.duration,180);assert.equal(settings.retained,true);assert.equal(settings.auto,false);assert.equal(settings.night,false);
 const path=benchmarkLink(settings);assert.equal(path.includes('PRIVATE'),false);assert.equal(path.includes('hardware'),false);assert.deepEqual(benchmarkSettings(path.split('?')[1]),settings);
});
test('unbounded/malformed contacts and incompatible legacy retention cannot create uncontrolled workloads',()=>{
 for(const value of ['999999999','NaN','-1','8.5','Infinity','0'])assert.equal(benchmarkSettings('?contacts='+value).count,8);
 const legacy=benchmarkSettings('?engine=legacy&seconds=180&retained=1&graphics=unknown');assert.equal(legacy.retained,false);assert.equal(legacy.duration,20);assert.equal(legacy.tier,'medium');
 assert.equal(benchmarkSettings('?seconds=999999999').duration,20);
 assert.equal(benchmarkSettings('?view=hidden&palette=truth&camera=server').vision,'thermal');
});
