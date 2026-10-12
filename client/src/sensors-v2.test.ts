import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { testPython } from './test-python';
import { observeSensors, falseTracks, opticalObservation, lineOfSight, radarProbability, sensorConfiguration, sensorSample, type SensorEnvironment, type SensorTrack, type SensorMemory, type SensorConfig } from './sensors-v2';

const track: SensorTrack = { id: 'T1', kind: 'quad', identity: 'hostile', rf: true, x: 0, z: 300, altitude: 20, active: true };
const env: SensorEnvironment = { night: false, fog: 0, radar_status: 'normal', rf_available: true };

test('v0.4 observation contract distinguishes channels without canonical kind/identity leakage', () => {
  const obs = observeSensors(17, 0, 0, track, env).observation;
  assert.equal(obs.version, 'vyuha-0.4.0');
  assert.deepEqual(Object.keys(obs).sort(), ['version', 'tick', 'track_id', 'radar', 'eo', 'ir', 'rf', 'iff'].sort());
  assert.equal(obs.radar.state, 'tentative');
  assert.equal(obs.radar.detected, false);
  assert.notEqual(obs.eo.level, 'none');
  assert.equal('identity' in obs, false);
  assert.equal('kind' in obs, false);
  assert.equal('range' in obs.rf, false);
  const night = observeSensors(17, 0, 0, track, { ...env, night: true }).observation;
  assert.equal(night.eo.available, false);
  assert.equal(night.ir.available, true);
  assert.notEqual(night.ir.level, 'none');
});

test('geometric occlusion, day/night and camera faults alter available evidence', () => {
  const boxes = [{ x_min: -20, x_max: 20, z_min: 40, z_max: 60, height: 30 }];
  const blocked = { ...env, terrain: boxes }, low = { ...track, z: 100 };
  assert.equal(lineOfSight(low, blocked), false);
  assert.equal(lineOfSight({ ...low, altitude: 100 }, blocked), true);
  assert.equal(opticalObservation(17, 0, 0, low, blocked, 'eo').position, null);
  assert.equal(opticalObservation(17, 0, 0, low, { ...env, eo_status: 'failed' }, 'eo').available, false);
  assert.ok(radarProbability(17, 0, low, blocked) < radarProbability(17, 0, low, env));
});

test('inconsistent/unbounded sensor settings fail explicitly rather than silently corrupting replay', () => {
  for (const value of [{ radar_pfa: 0 }, { eo_ifov_rad: NaN }, { radar_confirm_hits: 6, radar_window_sweeps: 5 }, { false_track_maximum: 3 }]) assert.throws(() => sensorConfiguration(value));
  assert.throws(() => observeSensors(1, -1, 0, track, env));
  assert.throws(() => observeSensors(1, 0, 0, { ...track, x: Infinity }, env));
});

test('Python and TypeScript agree at 1920 varied radar/optical/RF/IFF/clutter checkpoints', () => {
  const cases = Array.from({ length: 160 }, (_, i) => {
    const seed = 7 + i * 7919;
    const kind = ['bird', 'quad', 'fiber_fpv', 'fixed_wing'][i % 4];
    const identity = ['friendly', 'neutral', 'hostile'][i % 3];
    const range = 50 + i * 32;
    const truth: SensorTrack = { id: `T${i % 6}`, kind, identity, rf: kind === 'quad', x: i % 2 ? range * .6 : 0, z: range * .8, altitude: 10 + i % 80, active: true, rf_band_ghz: i % 2 ? 2.4 : 5.8, registration_id: identity === 'neutral' ? `CIV-${i}` : undefined };
    const environment: SensorEnvironment = { ...env, night: i % 2 === 1, fog: (i % 5) / 4, terrain: i % 4 === 0 ? [{ x_min: -100, x_max: 100, z_min: 100, z_max: 150, height: 60 }] : [] };
    const ticks = [0, 3, 30, 60, 90, 120, 150, 180, 210, 240, 271, 600];
    const inputs = ticks.map((tick, step) => ({ tick, track: { ...truth, z: truth.z - step * 8, active: step !== 10 }, environment: { ...environment, radar_status: (step === 4 ? 'failed' : step === 5 ? 'jammed' : 'normal') as SensorEnvironment['radar_status'], eo_status: (step === 6 ? 'failed' : step === 7 ? 'degraded' : 'normal') as SensorEnvironment['eo_status'], ir_status: (step === 8 ? 'failed' : 'normal') as SensorEnvironment['ir_status'], rf_available: step !== 9 } }));
    const config: Partial<SensorConfig> = { false_track_probability: .5, radar_reliability: i % 3 === 0 ? .65 : .95 };
    return { seed, index: i % 6, config, inputs };
  });
  const python = `import json,sys\nfrom server.sensors_v2 import observe_sensors,false_tracks\noutputs=[]\nfor case in json.load(sys.stdin):\n memory=None\n rows=[]\n for item in case['inputs']:\n  result=observe_sensors(case['seed'],item['tick'],case['index'],item['track'],item['environment'],memory,case['config'])\n  memory=result['memory']\n  rows.append({'result':result,'clutter':false_tracks(case['seed'],item['tick'],item['environment'],case['config'])})\n outputs.append(rows)\nprint(json.dumps(outputs))`;
  const expected = JSON.parse(execFileSync(testPython(), ['-c', python], { cwd: resolve(import.meta.dirname, '../..'), input: JSON.stringify(cases), env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' }, maxBuffer: 32 * 1024 * 1024 }).toString());
  cases.forEach((scenario, n) => {
    let memory: SensorMemory | null = null;
    scenario.inputs.forEach((input, k) => {
      const result = observeSensors(scenario.seed, input.tick, scenario.index, input.track, input.environment, memory, scenario.config);
      memory = result.memory;
      const clutter = falseTracks(scenario.seed, input.tick, input.environment, scenario.config);
      assert.deepEqual({ result, clutter }, expected[n][k], `seed ${scenario.seed}, tick ${input.tick}`);
    });
  });
  assert.equal(cases.reduce((n, c) => n + c.inputs.length, 0), 1920);
});

test('legacy sampler stream stays bit-identical while v0.4 channel draws remain separate', () => {
  assert.equal(sensorSample(1, 0, 0, 0), 0.9100430286489427);
  assert.notEqual(sensorSample(1, 0, 0, 32), sensorSample(1, 0, 0, 33));
});
