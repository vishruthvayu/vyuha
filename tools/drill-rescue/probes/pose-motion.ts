// Measures display motion of ObservedPoseBuffer for a constant-velocity contact
// observed every 3 logical ticks (the worker's 10 Hz snapshot cadence), rendered at 60 Hz.
import { ObservedPoseBuffer } from '../../../client/src/render-contacts';
const buf = new ObservedPoseBuffer();
const speed = 15; // m/s, a typical quad
const steps: number[] = []; const lags: number[] = [];
let tick = 0, x = 0, contacts = [{ id: 'T1', x: 0, y: 30, z: 500, shape: 'multirotor' as const }];
let lastX: number | null = null;
for (let frame = 0; frame < 600; frame++) {
  const t = frame / 60;
  const newTick = Math.floor(t * 30 / 3) * 3; // snapshots every 3 ticks
  if (newTick !== tick) { tick = newTick; x = speed * tick / 30; contacts = [{ ...contacts[0], x }]; }
  buf.update(contacts, tick, 'ctx');
  buf.forEachFrame(1 / 60, p => { if (frame > 60) { if (lastX !== null) steps.push((p.displayX - lastX) * 60); lags.push(speed * t - p.displayX); } lastX = p.displayX; });
}
const mean = steps.reduce((a, b) => a + b, 0) / steps.length;
const sd = Math.sqrt(steps.reduce((a, b) => a + (b - mean) ** 2, 0) / steps.length);
console.log(JSON.stringify({ model: 'exponential chase k=21.4/s', true_speed_mps: speed, display_speed_mean: +mean.toFixed(2), display_speed_sd: +sd.toFixed(2), display_speed_min: +Math.min(...steps).toFixed(2), display_speed_max: +Math.max(...steps).toFixed(2), lag_mean_m: +(lags.reduce((a, b) => a + b, 0) / lags.length).toFixed(2) }));
