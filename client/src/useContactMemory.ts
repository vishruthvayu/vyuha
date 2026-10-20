import { useEffect, useState } from "react";
import { reportedContacts } from "./observed-contacts";
import type { Snapshot, Track } from "./types";
export type ContactItem = {
  track: Track;
  lastTick: number;
  available: boolean;
};
export type ContactMemory = { key: string; tick: number; items: ContactItem[] };
/** List-only, bounded last-report memory. Never use these positions for radar,
 * camera, Fusion, action eligibility or scoring. An unseen contact is never added. */
export function contactMemory(
  previous: ContactMemory,
  state: Snapshot,
  key: string,
  selected: string | null,
): ContactMemory {
  const fresh = reportedContacts(state),
    live = new Map(fresh.map((t) => [t.id, t]));
  const old =
    previous.key === key && state.tick >= previous.tick ? previous.items : [];
  const items: ContactItem[] = [];
  for (const item of old) {
    const track = live.get(item.track.id);
    if (track) {
      items.push({ track, lastTick: state.tick, available: true });
      live.delete(track.id);
    } else if (state.tick - item.lastTick <= 60 || item.track.id === selected) {
      items.push({ ...item, available: false });
    }
  }
  for (const track of live.values())
    items.push({ track, lastTick: state.tick, available: true });
  return { key, tick: state.tick, items };
}
export function useContactMemory(
  state: Snapshot,
  key: string,
  selected: string | null,
) {
  const [memory, setMemory] = useState<ContactMemory>({
    key,
    tick: -1,
    items: [],
  });
  useEffect(
    () =>
      setMemory((previous) => contactMemory(previous, state, key, selected)),
    [state, key, selected],
  );
  return memory.key === key ? memory.items : [];
}
