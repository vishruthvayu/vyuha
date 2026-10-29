import { siteSurveyPose, type TrainingSite } from "./training-site-contract";
/** Public-scenery inspection only. No scenario roster, observed contact or clock input. */
export type SurveyPoint = { x: number; y: number; z: number };
export type SurveyCommand =
  "left" | "right" | "up" | "down" | "closer" | "farther" | "reset";
export type SurveyIntent = { revision: number; action: SurveyCommand };
export const SURVEY_BOUNDS = Object.freeze({
  minRadius: 160,
  maxRadius: 600,
  minPolar: 0.35,
  maxPolar: 1.22,
  turn: Math.PI / 12,
  tilt: Math.PI / 22.5,
  zoomFactor: 1.15,
});
/** Larger authored campuses need room to frame their public extent. This is
 * briefing-only; scored observation cameras retain their sensor-origin rules. */
export const surveyBounds = (site?: TrainingSite) =>
  site ? { ...SURVEY_BOUNDS, maxRadius: 1400 } : SURVEY_BOUNDS;
const clamp = (value: number, low: number, high: number) =>
  Math.max(low, Math.min(high, value));
export function publicSurveyPose(
  terrain?: string,
  trainingSite?: TrainingSite,
) {
  if (trainingSite) return siteSurveyPose(trainingSite);
  const rural = terrain === "rural_forward_base";
  return {
    target: rural ? { x: -5, y: 7, z: 70 } : { x: 15, y: 9, z: 65 },
    position: rural ? { x: 90, y: 100, z: -138 } : { x: -80, y: 100, z: -118 },
  };
}
export function isSurveyCommand(value: unknown): value is SurveyCommand {
  return (
    typeof value === "string" &&
    ["left", "right", "up", "down", "closer", "farther", "reset"].includes(
      value,
    )
  );
}
/** Keyboard/touch buttons and OrbitControls share these spatial limits. */
export function surveyPosition(
  position: SurveyPoint,
  action: SurveyCommand,
  terrain?: string,
  trainingSite?: TrainingSite,
): SurveyPoint {
  const preset = publicSurveyPose(terrain, trainingSite);
  const limits = surveyBounds(trainingSite);
  if (
    action === "reset" ||
    ![position.x, position.y, position.z].every(Number.isFinite)
  )
    return { ...preset.position };
  const x = position.x - preset.target.x,
    y = position.y - preset.target.y,
    z = position.z - preset.target.z;
  let radius = Math.hypot(x, y, z);
  let polar =
    radius > 0 ? Math.acos(clamp(y / radius, -1, 1)) : limits.maxPolar;
  let azimuth = Math.atan2(x, z);
  if (action === "left") azimuth -= limits.turn;
  if (action === "right") azimuth += limits.turn;
  if (action === "up") polar -= limits.tilt;
  if (action === "down") polar += limits.tilt;
  if (action === "closer") radius /= limits.zoomFactor;
  if (action === "farther") radius *= limits.zoomFactor;
  radius = clamp(radius, limits.minRadius, limits.maxRadius);
  polar = clamp(polar, limits.minPolar, limits.maxPolar);
  return {
    x: preset.target.x + radius * Math.sin(polar) * Math.sin(azimuth),
    y: preset.target.y + radius * Math.cos(polar),
    z: preset.target.z + radius * Math.sin(polar) * Math.cos(azimuth),
  };
}
