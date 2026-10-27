import { raidContactActive, raidPosition } from "./raid-v2";
import type { Scenario, TrackSpec } from "./types";

/** Author-only reference geometry; never a sensor report, score or runtime event. */
export const RAID_REHEARSAL_VERSION = "raid-reference-rehearsal-v1";
export const RAID_PROFILES = [
  ["hostile_quad", "RF-linked hostile quad"],
  ["no_rf_fpv", "No-RF hostile FPV"],
  ["fixed_wing", "Hostile fixed-wing"],
  ["bird", "Bird"],
  ["friendly_uav", "Friendly UAV"],
  ["civil_uav", "Registered civil UAV"],
] as const;
export type RaidProfile = (typeof RAID_PROFILES)[number][0];
export type RaidRoster = { [K in RaidProfile]: number };
export const initialRaidRoster: RaidRoster = {
  hostile_quad: 2,
  no_rf_fpv: 1,
  fixed_wing: 1,
  bird: 1,
  friendly_uav: 1,
  civil_uav: 1,
};
export function rosterMix(roster: RaidRoster): RaidProfile[] {
  const mix: RaidProfile[] = [];
  for (const [profile] of RAID_PROFILES) {
    const count = roster[profile];
    if (!Number.isInteger(count) || count < 0 || count > 200)
      throw new Error(
        "Each roster count must be a whole number from 0 to 200.",
      );
    if (mix.length + count > 200)
      throw new Error("The roster cannot exceed 200 contacts.");
    mix.push(...Array<RaidProfile>(count).fill(profile));
  }
  if (mix.length < 2) throw new Error("Choose at least two contacts.");
  if (!mix.some((p) => ["hostile_quad", "no_rf_fpv", "fixed_wing"].includes(p)))
    throw new Error("Include at least one hostile training contact.");
  return mix;
}
function finite(v: number) {
  return typeof v === "number" && Number.isFinite(v);
}
export function buildRaidRehearsal(scenario: Scenario) {
  if (
    scenario.engine_version !== "vyuha-0.4.0" ||
    scenario.raid?.version !== 2 ||
    !Number.isInteger(scenario.duration) ||
    scenario.duration < 60 ||
    scenario.duration > 180 ||
    !Array.isArray(scenario.tracks) ||
    scenario.tracks.length > 200
  )
    throw new Error("Reference rehearsal requires a compiled engine 0.4 raid.");
  const validation = scenario.raid.validation;
  const windows =
    validation &&
    typeof validation === "object" &&
    "response_windows" in validation
      ? validation.response_windows
      : null;
  const seen = new Set<string>();
  const endTick = scenario.duration * 30;
  const paths = scenario.tracks.map((track) => {
    if (
      !/^T[1-9][0-9]{0,2}$/.test(track.id) ||
      seen.has(track.id) ||
      !Number.isInteger(track.spawn) ||
      track.spawn < 0 ||
      track.spawn > endTick ||
      ![track.bearing, track.distance, track.speed, track.altitude].every(
        finite,
      ) ||
      track.bearing < 0 ||
      track.bearing >= 360 ||
      track.altitude < 0 ||
      track.altitude > 2000 ||
      track.distance <= 0 ||
      track.distance > 4000 ||
      track.speed <= 0 ||
      track.speed > 100 ||
      !track.motion ||
      track.motion.version !== 1 ||
      ![
        track.motion.phase_s,
        track.motion.lateral_m,
        track.motion.period_s,
        track.motion.turn_deg,
      ].every(finite) ||
      track.motion.phase_s < 0 ||
      track.motion.phase_s > 180 ||
      track.motion.lateral_m < 0 ||
      track.motion.lateral_m > 500 ||
      track.motion.period_s <= 0 ||
      track.motion.period_s > 120 ||
      Math.abs(track.motion.turn_deg) > 360 ||
      ![
        "direct",
        "weave",
        "orbit_then_dash",
        "dogleg",
        "probe_retreat",
      ].includes(track.motion.primitive)
    )
      throw new Error(
        "The compiled raid contains unsupported reference geometry.",
      );
    seen.add(track.id);
    const last = Math.min(track.expires_tick ?? endTick, endTick);
    if (!Number.isInteger(last) || last <= track.spawn)
      throw new Error("The compiled raid contains an invalid time interval.");
    const points: { x: number; z: number; tick: number }[] = [];
    // Bounded preview sampling, independent of frame schedule. Runtime is unchanged.
    for (let i = 0; i <= 80; i++) {
      const tick = Math.round(track.spawn + ((last - track.spawn) * i) / 80);
      const p = raidPosition(track, tick);
      if (!finite(p.x) || !finite(p.z))
        throw new Error("The compiled path cannot be projected safely.");
      points.push({ ...p, tick });
      if (Math.hypot(p.x, p.z) <= 8) break;
    }
    const value =
      windows && typeof windows === "object" && Object.hasOwn(windows, track.id)
        ? (windows as Record<string, unknown>)[track.id]
        : null;
    let responseWindow: {
      firstTick: number;
      lastTick: number;
      usableTicks: number;
    } | null = null;
    if (
      value &&
      typeof value === "object" &&
      "first_tick" in value &&
      "last_tick" in value &&
      "usable_ticks" in value
    ) {
      const first = value.first_tick,
        last = value.last_tick,
        usable = value.usable_ticks;
      if (
        typeof first === "number" &&
        typeof last === "number" &&
        typeof usable === "number" &&
        [first, last, usable].every(Number.isInteger) &&
        first >= track.spawn &&
        last >= first &&
        last < endTick &&
        usable > 0 &&
        usable <= last - first + 1
      )
        responseWindow = {
          firstTick: first,
          lastTick: last,
          usableTicks: usable,
        };
    }
    return { track, points, responseWindow };
  });
  const waves = scenario.raid.waves.map((wave, index) => {
    if (
      !Number.isInteger(wave.tick) ||
      wave.tick < 0 ||
      wave.tick > endTick ||
      !Array.isArray(wave.contacts) ||
      wave.contacts.some((id) => !seen.has(id))
    )
      throw new Error("The compiled wave cannot be linked to its roster.");
    return { ...wave, index };
  });
  const radius = Math.max(
    1000,
    ...paths.flatMap((p) => p.points.map((v) => Math.hypot(v.x, v.z))),
  );
  return { version: RAID_REHEARSAL_VERSION, endTick, paths, waves, radius };
}
export function referenceTrackAt(track: TrackSpec, tick: number) {
  const position = raidPosition(track, tick);
  return {
    ...position,
    scheduled: raidContactActive(track, tick),
    nearAsset: Math.hypot(position.x, position.z) <= 8,
  };
}
export function waveSeek(ticks: number[], tick: number, direction: -1 | 1) {
  const sorted = [...new Set(ticks)].sort((a, b) => a - b);
  return direction === 1
    ? (sorted.find((value) => value > tick) ?? tick)
    : (sorted.reverse().find((value) => value < tick) ?? tick);
}
