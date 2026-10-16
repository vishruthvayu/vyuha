import { defaultSensorConfig } from "../sensors-v2";

/** Visibility (m) shown as haze for the scenario fog value, log-interpolated
 * between the sensor model's clear and dense visibility. Display only. */
export function displayVisibility(fog: number) {
  const f = Math.min(1, Math.max(0, Number.isFinite(fog) ? fog : 0));
  const clear = defaultSensorConfig.clear_visibility_m;
  const dense = defaultSensorConfig.dense_visibility_m;
  return clear * Math.pow(dense / clear, f);
}
/** Longest range at which any camera channel can produce an observation. */
export function nextOpticalRange() {
  return Math.max(
    defaultSensorConfig.eo_max_range_m,
    defaultSensorConfig.ir_max_range_m,
  );
}
