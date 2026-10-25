import type { Snapshot } from "./types";

/** Briefing is public scenery, never a second view of the scenario roster.
 * Strip all observations/actions/messages before any renderer/camera consumer. */
export function briefingSnapshot(state: Snapshot): Snapshot {
  return {
    ...state,
    tick: 0,
    tracks: [],
    falseContacts: [],
    messages: [],
    paused: true,
    done: false,
    response: undefined,
  };
}
export function arrivalCamera(
  terrain: string | undefined,
  seconds: number,
  reducedMotion: boolean,
) {
  const rural = terrain === "rural_forward_base";
  const p = reducedMotion
    ? 1
    : Math.min(1, Math.max(0, Number.isFinite(seconds) ? seconds / 7 : 0));
  const ease = p * p * (3 - 2 * p);
  return {
    position: (rural
      ? [100 - 10 * ease, 35 - 3 * ease, -150 + 12 * ease]
      : [-90 + 10 * ease, 35 - 3 * ease, -130 + 12 * ease]) as [
      number,
      number,
      number,
    ],
    aim: (rural ? [-5, 7, 70] : [15, 9, 65]) as [number, number, number],
  };
}
