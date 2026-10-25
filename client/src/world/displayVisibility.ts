import { defaultSensorConfig, type SensorConfig } from "../sensors-v2";

/** Visibility (m) shown as haze for the scenario fog value, log-interpolated
 * between the sensor model's clear and dense visibility. Display only. */
export function displayVisibility(
  fog: number,
  config: Pick<
    SensorConfig,
    "clear_visibility_m" | "dense_visibility_m"
  > = defaultSensorConfig,
) {
  const f = Math.min(1, Math.max(0, Number.isFinite(fog) ? fog : 0));
  const clear = config.clear_visibility_m;
  const dense = config.dense_visibility_m;
  return clear * Math.pow(dense / clear, f);
}
/** Longest range at which any camera channel can produce an observation. */
export function nextOpticalRange(
  config: Pick<
    SensorConfig,
    "eo_max_range_m" | "ir_max_range_m"
  > = defaultSensorConfig,
) {
  return Math.max(config.eo_max_range_m, config.ir_max_range_m);
}

/** Existing display approximation, now parameterized by the frozen sensor
 * configuration. This does not replace the sensor engine's transmission law. */
export function displayFogDensity(
  fog: number,
  thermal: boolean,
  config: Pick<
    SensorConfig,
    "clear_visibility_m" | "dense_visibility_m" | "ir_fog_factor"
  > = defaultSensorConfig,
) {
  const visibility =
    displayVisibility(fog, config) * (thermal ? 1 / config.ir_fog_factor : 1);
  return 1.6 / visibility;
}
