import test from 'node:test';
import assert from 'node:assert/strict';
import { FixedStepClock, MAX_CATCH_UP_TICKS } from './clock';
import { Simulation } from './sim';
import { makeScenario } from './scenario';
import { replay } from './sim';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transpileModule, ModuleKind } from 'typescript';

test('different callback schedules produce the same 30 logical steps per second', () => {
  for (const spacing of [10, 20, 1000 / 60, 1000 / 30, 100]) {
    const clock = new FixedStepClock();
    clock.reset(0);
    let ticks = 0;
    for (let now = spacing; now < 1000 - 1e-8; now += spacing) ticks += clock.advance(now, true).ticks;
    ticks += clock.advance(1000, true).ticks;
    assert.equal(ticks, 30, `callback spacing ${spacing}`);
  }
});

test('fixed stepping preserves deterministic snapshots at equal logical horizons', () => {
  const clock = new FixedStepClock();
  clock.reset(0);
  const scheduled = new Simulation(makeScenario(7));
  const direct = new Simulation(makeScenario(7));
  for (let now = 20; now <= 1000; now += 20) {
    const { ticks } = clock.advance(now, true);
    for (let i = 0; i < ticks; i++) scheduled.step();
  }
  for (let i = 0; i < 30; i++) direct.step();
  assert.deepEqual(scheduled.snapshot(), direct.snapshot());
});

test('long stalls catch up at most five steps and report discarded wall time', () => {
  const clock = new FixedStepClock();
  clock.reset(0);
  const step = clock.advance(10000, true);
  assert.equal(step.ticks, MAX_CATCH_UP_TICKS);
  assert.equal(step.throttled, true);
  assert.ok(step.droppedMs > 9800);
  assert.equal(clock.advance(10000, true).ticks, 0);
  assert.equal(clock.advance(10000 + clock.stepMs, true).ticks, 1);
});

test('pause/hidden reset prevents accumulated wall time from executing on resume', () => {
  const clock = new FixedStepClock();
  clock.reset(0);
  assert.equal(clock.advance(20, true).ticks, 0);
  assert.equal(clock.advance(10000, false).ticks, 0);
  clock.reset(20000); // play/visibility messages reset immediately in the worker
  assert.equal(clock.advance(20000, true).ticks, 0);
  assert.equal(clock.advance(20000 + clock.stepMs, true).ticks, 1);
});

test('backward and invalid monotonic time samples reset without stepping', () => {
  const clock = new FixedStepClock();
  clock.reset(100);
  assert.equal(clock.advance(50, true).ticks, 0);
  assert.equal(clock.advance(NaN, true).ticks, 0);
  assert.equal(clock.advance(5000, true).ticks, 0);
});

test('worker uses bounded stepping and reports hidden/throttled time instead of advancing through it', () => {
  let now = 0;
  let callback: () => void = () => {};
  const messages: { type: string; status?: string; state?: { tick: number }; dropped_ms?: number }[] = [];
  const context = {
    onmessage: null as unknown as (event: { data: object }) => void,
    performance: { now: () => now },
    postMessage: (message: typeof messages[number]) => messages.push(message),
    setInterval: (fn: () => void) => { callback = fn; return 1; },
    clearInterval: () => {},
    exports: {},
    require: (path: string) => path === './sim' ? { Simulation, replay } : path === './clock' ? { FixedStepClock } : undefined,
  };
  const worker = readFileSync(new URL('./sim.worker.ts', import.meta.url), 'utf8');
  runInNewContext(transpileModule(worker, { compilerOptions: { module: ModuleKind.CommonJS } }).outputText, context);
  const send = (data: object) => context.onmessage({ data });
  const lastTick = () => messages.filter(m => m.type === 'snapshot').at(-1)?.state?.tick;
  send({ type: 'init', scenario: makeScenario(7) });
  send({ type: 'play' });
  now = 100; callback(); assert.equal(lastTick(), 3);
  send({ type: 'visibility', hidden: true });
  now = 5000; callback(); assert.equal(lastTick(), 3);
  assert.equal(messages.find(m => m.type === 'clock-status')?.status, 'hidden');
  send({ type: 'visibility', hidden: false });
  now = 5100; callback(); assert.equal(lastTick(), 6);
  now = 15100; callback();
  assert.ok(messages.some(m => m.status === 'throttled' && (m.dropped_ms ?? 0) > 9800));
  send({ type: 'pause' }); assert.equal(lastTick(), 11);
  now = 25100; callback(); assert.equal(lastTick(), 11);
  send({ type: 'play' });
  now = 25200; callback(); send({ type: 'pause' }); assert.equal(lastTick(), 14);
});
