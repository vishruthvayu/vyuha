import type { SensorPosition } from "./sensors-v2";
/** Display pointing only. Does not modify sensor sampling, visibility or scoring. */
export type OpticalAim = Readonly<{ azimuthDeg: number; elevationDeg: number }>;
const DEG = Math.PI / 180;
export function boundedAim(aim: OpticalAim): OpticalAim | null {
  if (!Number.isFinite(aim.azimuthDeg) || !Number.isFinite(aim.elevationDeg))
    return null;
  return {
    azimuthDeg: ((aim.azimuthDeg % 360) + 360) % 360,
    elevationDeg: Math.max(-30, Math.min(85, aim.elevationDeg)),
  };
}
export function reportedAim(
  position: SensorPosition | null | undefined,
  origin: SensorPosition,
): OpticalAim | null {
  if (
    !position ||
    ![
      position.x,
      position.z,
      position.altitude,
      origin.x,
      origin.z,
      origin.altitude,
    ].every(Number.isFinite)
  )
    return null;
  const x = position.x - origin.x,
    z = position.z - origin.z,
    y = position.altitude - origin.altitude;
  if (Math.hypot(x, z, y) < 1e-6) return null;
  return boundedAim({
    azimuthDeg: Math.atan2(x, z) / DEG,
    elevationDeg: Math.atan2(y, Math.hypot(x, z)) / DEG,
  });
}
export function aimPoint(
  origin: SensorPosition,
  aim: OpticalAim,
): SensorPosition | null {
  const a = boundedAim(aim);
  if (!a || ![origin.x, origin.z, origin.altitude].every(Number.isFinite))
    return null;
  const horizontal = 1000 * Math.cos(a.elevationDeg * DEG);
  return {
    x: origin.x + horizontal * Math.sin(a.azimuthDeg * DEG),
    z: origin.z + horizontal * Math.cos(a.azimuthDeg * DEG),
    altitude: origin.altitude + 1000 * Math.sin(a.elevationDeg * DEG),
  };
}
/** The same ownership key is required at dispatch and render. No prior scope fallback. */
export function scopedAim(
  state: { scopeId: string; aim: OpticalAim } | null,
  scopeId: string,
) {
  return state?.scopeId === scopeId ? boundedAim(state.aim) : null;
}

/** Review/briefing adapters can never inherit live manual pointing. */
export function liveManualAim(
  aim: OpticalAim | null | undefined,
  context: { briefing: boolean; referenceTruth: boolean; preset: boolean },
) {
  return !context.briefing && !context.referenceTruth && !context.preset && aim
    ? boundedAim(aim)
    : null;
}

/** A direct display gesture uses the visible field of view; never sensor IFOV.
 * Starting aim is frozen for a gesture, avoiding frame-rate-dependent drift. */
export function draggedOpticalAim(
  start: OpticalAim,
  dx: number,
  dy: number,
  width: number,
  height: number,
  verticalFov: number,
): OpticalAim | null {
  if (
    ![dx, dy, width, height, verticalFov].every(Number.isFinite) ||
    width <= 0 ||
    height <= 0 ||
    verticalFov <= 0 ||
    verticalFov >= 180
  )
    return null;
  const horizontal =
    (2 * Math.atan((Math.tan((verticalFov * DEG) / 2) * width) / height)) / DEG;
  return boundedAim({
    azimuthDeg: start.azimuthDeg - (dx / width) * horizontal,
    elevationDeg: start.elevationDeg + (dy / height) * verticalFov,
  });
}
