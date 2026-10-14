/** Formula-shaped training sensors; assumptions and source links are frozen JSON.
 * No operational calibration. Canonical identity/kind never enter observations.
 */
import spec from '../../server/config/sensors-v2.json';

export const SENSOR_VERSION = 'vyuha-0.4.0';
export const sensorSpecification = spec;
export const defaultSensorConfig = spec.parameters;
export type SensorConfig = typeof defaultSensorConfig;
export type SensorPosition = { x: number; z: number; altitude: number };
export type TerrainBox = { x_min: number; x_max: number; z_min: number; z_max: number; height: number };
export type SensorTrack = SensorPosition & { id: string; kind: string; identity: string; rf: boolean; active?: boolean; rcs_db?: number; signature_m?: number; rf_band_ghz?: 2.4 | 5.8; registration_id?: string };
export type SensorEnvironment = { night: boolean; fog: number; radar_status?: 'normal' | 'jammed' | 'failed'; eo_status?: 'normal' | 'degraded' | 'failed'; ir_status?: 'normal' | 'degraded' | 'failed'; rf_available?: boolean; iff_available?: boolean; terrain?: TerrainBox[]; sensor_origin?: SensorPosition };
export type RadarState = 'none' | 'tentative' | 'confirmed' | 'lost';
export type OpticalLevel = 'none' | 'detect' | 'recognise' | 'identify';
export type OpticalObservation = { available: boolean; level: OpticalLevel; position: SensorPosition | null; silhouette: 'bird' | 'fixed_wing' | 'multirotor' | null; sample_tick: number | null };
export type RadarObservation = { available: boolean; state: RadarState; detected: boolean; fresh: boolean; position: SensorPosition | null; sample_tick: number | null };
export type SensorObservation = {
  version: typeof SENSOR_VERSION; tick: number; track_id: string;
  radar: RadarObservation; eo: OpticalObservation; ir: OpticalObservation;
  rf: { available: boolean; detected: boolean; band_ghz: number | null; bearing_deg: number | null };
  iff: { available: boolean; cue: 'friendly_reply' | 'registered_civil' | 'no_reply' | 'unavailable'; registration_id: string | null };
};
export type SensorMemory = { key: string; tick: number; sweep: number | null; paints: boolean[]; misses: number; confirmed: boolean; position: SensorPosition | null; sample_tick: number | null; radar_status: SensorEnvironment['radar_status'] | null; last_state?: RadarState };
const RCS: { [kind: string]: number } = { bird: -25, fiber_fpv: -20, quad: -15, fixed_wing: -10, loitering: -8, loitering_munition: -8 };
const SIGNATURE: { [kind: string]: number } = { bird: .35, fiber_fpv: .45, quad: .6, fixed_wing: 1.5, loitering: 1.5, loitering_munition: 1.5 };
const bounds: { [K in keyof SensorConfig]: [number, number] } = {
  radar_reference_range_m: [100, 10000], radar_reference_rcs_db: [-60, 20], radar_reference_snr: [0, 10000], radar_max_range_m: [100, 20000], radar_pfa: [1e-9, .01],
  radar_reliability: [0, 1], radar_jam_factor: [0, 1], radar_occlusion_factor: [0, 1], radar_confirm_hits: [1, 8], radar_window_sweeps: [1, 8], radar_loss_sweeps: [1, 8], radar_sweep_ticks: [3, 90], rcs_spread_db: [0, 12],
  eo_ifov_rad: [1e-6, .01], ir_ifov_rad: [1e-6, .01], eo_max_range_m: [50, 10000], ir_max_range_m: [50, 10000], optical_reliability: [0, 1], optical_sample_ticks: [1, 30],
  clear_visibility_m: [100, 100000], dense_visibility_m: [50, 10000], ir_fog_factor: [.1, 2], rf_tx_dbm: [-20, 40], rf_gain_db: [-10, 30], rf_sensitivity_dbm: [-130, -30], rf_path_exponent: [1.5, 5], rf_shadow_db: [0, 20], rf_reliability: [0, 1], rf_max_range_m: [50, 15000], rf_bearing_error_deg: [0, 30], iff_reply_probability: [0, 1], civil_beacon_probability: [0, 1], iff_max_range_m: [50, 10000], false_track_probability: [0, .5], false_track_lifetime_sweeps: [1, 3], false_track_maximum: [0, 2],
};
const integerConfig = new Set(['radar_confirm_hits', 'radar_window_sweeps', 'radar_loss_sweeps', 'radar_sweep_ticks', 'optical_sample_ticks', 'false_track_lifetime_sweeps', 'false_track_maximum']);

export function sensorSample(seed: number, tick: number, index: number, sensor: number) {
  let x = (seed ^ Math.imul(tick + 1, 374761393) ^ Math.imul(index + 1, 668265263) ^ Math.imul(sensor + 1, 69069)) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}
export function sensorConfiguration(overrides?: Partial<SensorConfig>): SensorConfig {
  const result = { ...defaultSensorConfig };
  for (const [name, value] of Object.entries(overrides ?? {})) {
    const key = name as keyof SensorConfig;
    if (!(key in bounds) || typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Invalid sensor parameter: ${key}`);
    const [low, high] = bounds[key];
    if (value < low || value > high || integerConfig.has(key) && !Number.isInteger(value)) throw new Error(`Sensor parameter outside bounds: ${key}`);
    result[key] = value;
  }
  if (result.radar_confirm_hits > result.radar_window_sweeps || result.dense_visibility_m > result.clear_visibility_m) throw new Error('Inconsistent sensor parameters');
  return result;
}
const q = (v: number) => Math.floor(v * 1e6 + .5) / 1e6;
const position = (t: SensorTrack): SensorPosition => ({ x: q(t.x), z: q(t.z), altitude: q(t.altitude) });
const origin = (e: SensorEnvironment) => e.sensor_origin ?? { x: 0, z: 0, altitude: 2 };
export const sensorRange = (t: SensorTrack, e: SensorEnvironment) => Math.hypot(t.x - origin(e).x, t.z - origin(e).z, t.altitude - origin(e).altitude);
function validateEnvironment(e: SensorEnvironment) {
  const fog = e.fog ?? 0;
  if (typeof fog !== 'number' || !Number.isFinite(fog) || fog < 0 || fog > 1) throw new Error('Fog must be finite and within 0..1');
  for (const name of ['night', 'rf_available', 'iff_available'] as const) if (e[name] !== undefined && typeof e[name] !== 'boolean') throw new Error(`${name} must be boolean`);
  for (const [name, allowed] of [['radar_status', ['normal', 'jammed', 'failed']], ['eo_status', ['normal', 'degraded', 'failed']], ['ir_status', ['normal', 'degraded', 'failed']]] as const) if (e[name] !== undefined && !(allowed as readonly string[]).includes(e[name])) throw new Error(`Unknown ${name}`);
  if (![origin(e).x, origin(e).z, origin(e).altitude].every(Number.isFinite)) throw new Error('Sensor origin must be finite');
}

export function lineOfSight(t: SensorTrack, e: SensorEnvironment) {
  validateEnvironment(e);
  if ((e.terrain?.length ?? 0) > 128) throw new Error('At most 128 terrain boxes');
  for (const box of e.terrain ?? []) {
    let lower = 0, upper = 1;
    for (const [axis, lo, hi] of [['x', box.x_min, box.x_max], ['z', box.z_min, box.z_max], ['altitude', 0, box.height]] as const) {
      if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo > hi) throw new Error('Invalid terrain box');
      const start = origin(e)[axis], delta = t[axis] - start;
      if (Math.abs(delta) < 1e-12) {
        if (start < lo || start > hi) { lower = 1; upper = 0; break; }
      } else {
        const a = (lo - start) / delta, b = (hi - start) / delta;
        lower = Math.max(lower, Math.min(a, b)); upper = Math.min(upper, Math.max(a, b));
        if (lower > upper) break;
      }
    }
    if (lower <= upper && upper > 1e-8 && lower < 1 - 1e-8) return false;
  }
  return true;
}

export function radarProbability(seed: number, index: number, t: SensorTrack, e: SensorEnvironment, config?: Partial<SensorConfig>) {
  validateEnvironment(e);
  const c = sensorConfiguration(config);
  return configuredRadarProbability(seed, index, t, e, c);
}
// Private callers have already validated the environment and normalized settings.
// Reuse that value without a cache or any change to the frozen arithmetic.
function configuredRadarProbability(seed: number, index: number, t: SensorTrack, e: SensorEnvironment, c: SensorConfig) {
  if (e.radar_status === 'failed') return 0;
  const distance = Math.max(1, sensorRange(t, e));
  if (distance > c.radar_max_range_m) return 0;
  const rcs = (t.rcs_db ?? RCS[t.kind] ?? -15) + (sensorSample(seed, 0, index, 30) * 2 - 1) * c.rcs_spread_db;
  const fog = e.fog ?? 0;
  let snr = c.radar_reference_snr * 10 ** ((rcs - c.radar_reference_rcs_db) / 10) * (c.radar_reference_range_m / distance) ** 4 * (1 - .15 * fog);
  if (!lineOfSight(t, e)) snr *= c.radar_occlusion_factor;
  let p = c.radar_pfa ** (1 / (1 + snr)) * c.radar_reliability;
  if (e.radar_status === 'jammed') p *= c.radar_jam_factor;
  return p;
}
export function opticalProbability(linePairs: number, threshold: number) {
  const ratio = Math.max(0, Math.min(100, linePairs / threshold));
  const power = ratio ** (2.7 + .7 * ratio);
  return power / (1 + power);
}
export function opticalObservation(seed: number, tick: number, index: number, t: SensorTrack, e: SensorEnvironment, channel: 'eo' | 'ir', config?: Partial<SensorConfig>): OpticalObservation {
  validateEnvironment(e);
  const c = sensorConfiguration(config);
  return configuredOpticalObservation(seed, tick, index, t, e, channel, c);
}
function configuredOpticalObservation(seed: number, tick: number, index: number, t: SensorTrack, e: SensorEnvironment, channel: 'eo' | 'ir', c: SensorConfig): OpticalObservation {
  const status = e[channel === 'eo' ? 'eo_status' : 'ir_status'] ?? 'normal';
  const available = status !== 'failed' && (channel !== 'eo' || !e.night);
  const result: OpticalObservation = { available, level: 'none', position: null, silhouette: null, sample_tick: null };
  if (!available || t.active === false || !lineOfSight(t, e)) return result;
  const distance = Math.max(1, sensorRange(t, e));
  if (distance > c[channel === 'eo' ? 'eo_max_range_m' : 'ir_max_range_m']) return result;
  const fog = e.fog ?? 0;
  const visibility = c.clear_visibility_m * (1 - fog) ** 3 + c.dense_visibility_m * (1 - (1 - fog) ** 3);
  const transmission = Math.exp(-3.912 * distance / visibility * (channel === 'ir' ? c.ir_fog_factor : 1));
  const dimension = t.signature_m ?? SIGNATURE[t.kind] ?? .6;
  const linePairs = dimension / (2 * distance * c[channel === 'eo' ? 'eo_ifov_rad' : 'ir_ifov_rad']) * transmission;
  const sampleTick = Math.floor(tick / c.optical_sample_ticks) * c.optical_sample_ticks;
  const draw = sensorSample(seed, sampleTick, index, channel === 'eo' ? 32 : 33);
  const reliability = c.optical_reliability * (status === 'degraded' ? .35 : 1);
  for (const [level, threshold] of [['identify', 6.4], ['recognise', 4], ['detect', 1]] as const) {
    if (draw < opticalProbability(linePairs, threshold) * reliability) {
      result.level = level; result.position = position(t); result.sample_tick = sampleTick;
      if (level !== 'detect') result.silhouette = t.kind === 'bird' ? 'bird' : ['fixed_wing', 'loitering', 'loitering_munition'].includes(t.kind) ? 'fixed_wing' : 'multirotor';
      break;
    }
  }
  return result;
}

export function observeSensors(seed: number, tick: number, index: number, t: SensorTrack, e: SensorEnvironment, previous?: SensorMemory | null, config?: Partial<SensorConfig>): { observation: SensorObservation; memory: SensorMemory } {
  validateEnvironment(e);
  if (!Number.isInteger(tick) || tick < 0 || !Number.isInteger(index) || index < 0) throw new Error('Sensor tick/index must be nonnegative integers');
  if (![t.x, t.z, t.altitude].every(Number.isFinite)) throw new Error('Sensor positions must be finite');
  const c = sensorConfiguration(config), key = `${seed}:${index}:${t.id}`;
  const memory: SensorMemory = !previous || previous.key !== key || tick < previous.tick ? { key, tick, sweep: null, paints: [], misses: 0, confirmed: false, position: null, sample_tick: null, radar_status: null } : { ...previous, paints: [...previous.paints], position: previous.position ? { ...previous.position } : null };
  memory.tick = tick;
  const active = t.active !== false, radarStatus = e.radar_status ?? 'normal';
  if (!['normal', 'jammed', 'failed'].includes(radarStatus)) throw new Error('Unknown radar status');
  const sweep = Math.floor(tick / c.radar_sweep_ticks);
  const radar: RadarObservation = { available: radarStatus !== 'failed', state: 'none', detected: false, fresh: false, position: null, sample_tick: null };
  if (!active || radarStatus === 'failed') {
    Object.assign(memory, { sweep: null, paints: [], misses: 0, confirmed: false, position: null, sample_tick: null });
  } else {
    if (memory.sweep !== sweep) {
      if (memory.sweep !== null && sweep - memory.sweep > 1) Object.assign(memory, { paints: [], misses: 0, confirmed: false, position: null, sample_tick: null });
      const sweepTick = sweep * c.radar_sweep_ticks;
      const hit = sensorSample(seed, sweepTick, index, 31) < configuredRadarProbability(seed, index, t, e, c);
      memory.paints = [...memory.paints, hit].slice(-c.radar_window_sweeps);
      memory.misses = hit ? 0 : memory.misses + 1;
      if (hit) { memory.position = position(t); memory.sample_tick = tick; }
      const lost = memory.confirmed && memory.misses >= c.radar_loss_sweeps;
      memory.confirmed = !lost && (memory.confirmed || memory.paints.filter(Boolean).length >= c.radar_confirm_hits);
      memory.sweep = sweep;
      memory.last_state = lost ? 'lost' : memory.confirmed ? 'confirmed' : hit ? 'tentative' : 'none';
    }
    Object.assign(radar, { state: memory.last_state ?? 'none', detected: memory.confirmed, fresh: memory.sample_tick === tick, position: memory.confirmed || memory.last_state === 'tentative' ? memory.position && { ...memory.position } : null, sample_tick: memory.sample_tick });
  }
  memory.radar_status = radarStatus;
  const eo = configuredOpticalObservation(seed, tick, index, t, e, 'eo', c), ir = configuredOpticalObservation(seed, tick, index, t, e, 'ir', c);
  const distance = sensorRange(t, e), rfAvailable = e.rf_available ?? true;
  const rf: SensorObservation['rf'] = { available: rfAvailable, detected: false, band_ghz: null, bearing_deg: null };
  const sampleTick = sweep * c.radar_sweep_ticks;
  if (active && rfAvailable && t.rf && distance <= c.rf_max_range_m) {
    const band = t.rf_band_ghz ?? (sensorSample(seed, 0, index, 34) >= .5 ? 5.8 : 2.4);
    if (band !== 2.4 && band !== 5.8) throw new Error('RF band must be 2.4 or 5.8 GHz');
    const wavelength = 299792458 / (band * 1e9);
    const pathLoss = 20 * Math.log10(4 * Math.PI / wavelength) + 10 * c.rf_path_exponent * Math.log10(Math.max(1, distance));
    const shadow = (sensorSample(seed, sampleTick, index, 34) * 2 - 1) * c.rf_shadow_db;
    const margin = c.rf_tx_dbm + c.rf_gain_db - pathLoss + shadow - c.rf_sensitivity_dbm;
    const p = c.rf_reliability / (1 + Math.exp(-Math.max(-50, Math.min(50, margin / 4))));
    if (sensorSample(seed, sampleTick, index, 35) < p) {
      const bearing = Math.atan2(t.x - origin(e).x, t.z - origin(e).z) * 180 / Math.PI;
      Object.assign(rf, { detected: true, band_ghz: band, bearing_deg: q((bearing + (sensorSample(seed, sampleTick, index, 36) * 2 - 1) * c.rf_bearing_error_deg + 360) % 360) });
    }
  }
  const iffAvailable = rfAvailable && (e.iff_available ?? true);
  const iff: SensorObservation['iff'] = { available: iffAvailable, cue: iffAvailable ? 'no_reply' : 'unavailable', registration_id: null };
  if (active && iffAvailable && distance <= c.iff_max_range_m) {
    if (t.identity === 'friendly' && sensorSample(seed, sampleTick, index, 37) < c.iff_reply_probability) iff.cue = 'friendly_reply';
    else if (t.identity === 'neutral' && t.registration_id && sensorSample(seed, sampleTick, index, 38) < c.civil_beacon_probability) { iff.cue = 'registered_civil'; iff.registration_id = String(t.registration_id).slice(0, 32); }
  }
  return { observation: { version: SENSOR_VERSION, tick, track_id: t.id, radar, eo, ir, rf, iff }, memory };
}

export function falseTracks(seed: number, tick: number, e: SensorEnvironment, config?: Partial<SensorConfig>) {
  validateEnvironment(e);
  if (!Number.isInteger(tick) || tick < 0) throw new Error('Sensor tick must be a nonnegative integer');
  const c = sensorConfiguration(config);
  if (e.radar_status === 'failed') return [];
  const sweep = Math.floor(tick / c.radar_sweep_ticks);
  const candidates: { track_id: string; tick: number; radar: RadarObservation }[] = [];
  for (let born = Math.max(0, sweep - c.false_track_lifetime_sweeps + 1); born <= sweep; born++) {
    for (let slot = 0; slot < c.false_track_maximum; slot++) {
      if (sensorSample(seed, born, 900 + slot, 39) >= c.false_track_probability) continue;
      const angle = sensorSample(seed, born, 900 + slot, 40) * Math.PI * 2;
      const minimum = Math.min(300, c.radar_max_range_m * .2);
      const distance = minimum + sensorSample(seed, born, 900 + slot, 41) * Math.min(3000, c.radar_max_range_m - minimum);
      candidates.push({ track_id: `C${born}-${slot}`, tick, radar: { available: true, state: 'tentative', detected: false, fresh: sweep === born, position: { x: q(Math.sin(angle) * distance), z: q(Math.cos(angle) * distance), altitude: 0 }, sample_tick: born * c.radar_sweep_ticks } });
    }
  }
  return c.false_track_maximum ? candidates.slice(-c.false_track_maximum) : [];
}
