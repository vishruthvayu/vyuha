// Display motion of ObservedPoseBuffer: constant 15 m/s contact, samples every 3 ticks,
// snapshot delivery jittered +-12 ms, 60 Hz frames. Prints displayed-speed statistics.
import { ObservedPoseBuffer } from '../../../client/src/render-contacts';
const jitter = process.argv.includes('--jitter');
const buf = new ObservedPoseBuffer();
const speed = 15; const steps: number[] = []; const lags: number[] = [];
let tick = 0, next = 0.1, rnd = 7, lastX: number | null = null;
const rand = () => { rnd = (rnd * 1103515245 + 12345) % 2147483648; return rnd / 2147483648; };
let contacts = [{ id: 'T1', x: 0, y: 30, z: 500, shape: 'multirotor' as const }];
for (let frame = 0; frame < 900; frame++) {
  const t = frame / 60;
  if (t >= next) { tick += 3; contacts = [{ ...contacts[0], x: speed * tick / 30 }]; next += 0.1 + (jitter ? (rand() - 0.5) * 0.024 : 0); }
  buf.update(contacts, tick, 'ctx');
  buf.forEachFrame(1 / 60, p => { if (frame > 60) { if (lastX !== null) steps.push((p.displayX - lastX) * 60); lags.push(speed * t - p.displayX); } lastX = p.displayX; });
}
const mean = steps.reduce((a, b) => a + b, 0) / steps.length;
const sd = Math.sqrt(steps.reduce((a, b) => a + (b - mean) ** 2, 0) / steps.length);
console.log(JSON.stringify({ model: 'segment interpolation', jitter, display_speed_mean: +mean.toFixed(2), display_speed_sd: +sd.toFixed(2), min: +Math.min(...steps).toFixed(2), max: +Math.max(...steps).toFixed(2), lag_mean_m: +(lags.reduce((a, b) => a + b, 0) / lags.length).toFixed(2) }));
