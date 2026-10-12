import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { testPython } from './test-python';
import { Simulation, replay, score } from './sim';
import type { Scenario, Action, AppliedCommand, ScoreCard, Snapshot } from './types';

type Checkpoint = { tick: number; radar_status: string; rf_available: boolean; night: boolean; paused: boolean; tracks: unknown[]; false_contacts: unknown[]; events: Action[]; commands: AppliedCommand[]; scorecard: ScoreCard };
type Fixture = { scenario: Scenario; events: Action[]; commands: AppliedCommand[]; checkpoints: Checkpoint[]; scorecard: ScoreCard };
function projection(sim: Simulation): Checkpoint {
  const s: Snapshot = sim.snapshot();
  return { tick: s.tick, radar_status: s.radarStatus, rf_available: s.rfAvailable, night: s.night, paused: s.paused,
    tracks: s.tracks.map(({ id, x, z, altitude, active, detected, designated, resolved, impact, radar, thermal, classification, declared, attempts, observation }) => ({ id, x, z, altitude, active, detected, designated, resolved, impact, radar, thermal, classification, declared, attempts, observation })),
    false_contacts: s.falseContacts ?? [], events: sim.events, commands: sim.commands, scorecard: score(sim) };
}
function assertCheckpoint(actual: Checkpoint, expected: Checkpoint, label: string) {
  // Inactive contacts retain the frozen legacy constructor's trig position;
  // Python/libm and JS differ at ~1e-13 m. All decisions, observations, logs,
  // booleans and score fields still compare exactly. Position tolerance is 1 nm.
  const tracks = actual.tracks as { x: number; z: number }[];
  const reference = expected.tracks as { x: number; z: number }[];
  assert.equal(tracks.length, reference.length, label);
  tracks.forEach((track, i) => {
    for (const coordinate of ['x', 'z'] as const) {
      assert.ok(Math.abs(track[coordinate] - reference[i][coordinate]) <= 1e-9, `${label}:track${i}.${coordinate}`);
      track[coordinate] = reference[i][coordinate];
    }
  });
  assert.deepEqual(actual, expected, label);
}

test('finale dispatch preserves integrated Python/TS sensor/motion/action/scoring parity at 544 checkpoints', () => {
  const result = spawnSync(testPython(), ['-m', 'server.tests.finale_sensor_fixtures'], { cwd: '..', encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' }, maxBuffer: 64 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr);
  const fixtures = JSON.parse(result.stdout) as Fixture[];
  assert.equal(fixtures.length, 32);
  let checkpoints = 0;
  for (const fixture of fixtures) {
    const sim = new Simulation(fixture.scenario);
    const timeline = [...fixture.events.map(action => ({ tick: action.tick, order: action.order!, action, command: null as AppliedCommand | null })), ...fixture.commands.map(command => ({ tick: command.tick, order: command.order, action: null as Action | null, command }))].sort((a, b) => a.tick - b.tick || a.order - b.order);
    let next = 0;
    const expected = new Map(fixture.checkpoints.map(point => [point.tick, point]));
    while (sim.state.tick <= fixture.scenario.duration * 30) {
      while (next < timeline.length && timeline[next].tick === sim.state.tick) {
        const item = timeline[next++];
        assert.equal(item.command ? sim.control(item.command, item.tick, item.order) : sim.act(item.action!), true, `${fixture.scenario.raid?.family} accepted order ${item.order}`);
      }
      const point = expected.get(sim.state.tick);
      if (point) {
        assertCheckpoint(projection(sim), point, `${fixture.scenario.seed}:${fixture.scenario.raid?.family}:${fixture.scenario.night}:${sim.state.tick}`);
        checkpoints++;
      }
      if (sim.state.tick === fixture.scenario.duration * 30) break;
      sim.step(true);
    }
    assert.equal(next, timeline.length);
    assert.deepEqual(score(sim), fixture.scorecard);
    // Reconstruct a same-tick pre-action boundary independently of streaming.
    const boundary = fixture.events.find(a => a.k === 'engage' && a.tick >= 420);
    if (boundary && fixture.scenario.raid?.family === 'DIRECT') {
      const before = replay(fixture.scenario, fixture.events, boundary.tick, fixture.commands, boundary.order);
      assert.equal(before.events.some(a => a.order === boundary.order), false);
      assert.equal(before.commands.every(c => c.order < boundary.order!), true);
    }
  }
  assert.equal(checkpoints, 544);
});
