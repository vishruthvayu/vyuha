import type { Snapshot, Track } from './types';
import type { OpticalLevel, SensorObservation } from './sensors-v2';

export type Vision = 'thermal' | 'day' | 'night';
/** 200 ms at the logical 30 Hz rate. Held geometry never follows hidden truth. */
export const OBSERVATION_HOLD_TICKS = 6;
export type VisibleTrack = Track & { visual_level?: OpticalLevel; visual_shape?: 'bird' | 'fixed_wing' | 'multirotor' | null };
export function opticalRenderShape(track: VisibleTrack) {
  if (track.visual_level === 'detect' || track.visual_level === 'none') return 'unresolved';
  if (track.visual_level) return track.visual_shape ?? 'unresolved';
  return track.kind === 'bird' ? 'bird' : track.kind === 'fixed_wing' ? 'fixed_wing' : 'multirotor';
}
export type VisibilityOptions = {
  key: string;
  groundTruth?: boolean;
  opticalAvailable?: boolean;
};

/**
 * v0.3 supplies one observed thermal/EO flag, not separate TV/NV observations.
 * All legacy optical presentation modes therefore share this conservative gate.
 * Radar discovery and historical `detected` are never optical observations.
 */
export class ObservationVisibility {
  private key = '';
  private tick: number | null = null;
  private held = new Map<string, { tick: number; track: VisibleTrack }>();

  clear() { this.held.clear(); this.tick = null; }

  tracks(state: Snapshot, vision: Vision, options: VisibilityOptions): VisibleTrack[] {
    const key = `${options.key}:${vision}:${options.groundTruth === true}`;
    // Backward seeks and discontinuous forward jumps are new observation contexts.
    if (state.tick === 0 || key !== this.key || this.tick !== null &&
        (state.tick < this.tick || state.tick - this.tick > OBSERVATION_HOLD_TICKS)) {
      this.clear();
    }
    this.key = key;
    this.tick = state.tick;
    if (options.groundTruth === true) {
      this.held.clear();
      return state.tracks.filter(t => t.active);
    }
    if (options.opticalAvailable === false) {
      this.held.clear();
      return [];
    }
    const activeIds = new Set(state.tracks.filter(t => t.active).map(t => t.id));
    for (const id of this.held.keys()) if (!activeIds.has(id)) this.held.delete(id);
    return state.tracks.flatMap(track => {
      if (!track.active) return [];
      const observation = (track as Track & { observation?: SensorObservation }).observation;
      // v0.4 night presentation is explicitly styled IR, not a separate NV model.
      const optical = observation ? vision === 'day' ? observation.eo : observation.ir : undefined;
      if (optical && !optical.available) { this.held.delete(track.id); return []; }
      if (optical ? optical.level !== 'none' && optical.position !== null : track.thermal) {
        const observed: VisibleTrack = { ...track, attempts: [...track.attempts], ...(optical ? optical.position : {}) };
        if (optical) {
          observed.visual_level = optical.level;
          observed.visual_shape = optical.silhouette;
          observed.distance = Math.hypot(observed.x, observed.z);
          observed.bearing = (Math.atan2(observed.x, observed.z) * 180 / Math.PI + 360) % 360;
        }
        this.held.set(track.id, { tick: state.tick, track: observed });
        return [observed];
      }
      const sample = this.held.get(track.id);
      if (sample && state.tick - sample.tick <= OBSERVATION_HOLD_TICKS) return [sample.track];
      this.held.delete(track.id);
      return [];
    });
  }
}
