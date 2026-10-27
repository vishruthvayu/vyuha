import { api } from "./storage";
import type { Scenario } from "./types";
export const OPPORTUNITY_CHANNELS = ["radar", "eo", "ir", "rf", "iff"] as const;
export type OpportunityChannel = (typeof OPPORTUNITY_CHANNELS)[number];
export type OpportunityInterval = {
  first_tick: number;
  end_tick_exclusive: number;
  state: string;
  available: boolean;
  first_sample_tick: number | null;
  last_sample_tick: number | null;
};
export type OpportunityContact = {
  track_id: string;
  active_ticks: number;
  channels: Record<
    OpportunityChannel,
    {
      state_ticks: Record<string, number>;
      intervals: OpportunityInterval[];
    }
  >;
};
export type EpisodeOpportunities = {
  version: "episode-opportunities-v1";
  scenario_id: string;
  raid_fingerprint: string;
  scenario_hash: string;
  engine_version: "vyuha-0.4.0";
  sensor_version: "vyuha-0.4.0";
  scope: "counterfactual-unintervened-author-reference";
  horizon: { first_tick: 0; end_tick_exclusive: number; hz: 30 };
  actions_applied: 0;
  commands_applied: 0;
  planned_contacts: number;
  segment_count: number;
  contacts: OpportunityContact[];
  limitation: string;
};
const states: Record<OpportunityChannel, readonly string[]> = {
  radar: ["inactive", "unavailable", "none", "tentative", "confirmed", "lost"],
  eo: ["inactive", "unavailable", "none", "detect", "recognise", "identify"],
  ir: ["inactive", "unavailable", "none", "detect", "recognise", "identify"],
  rf: ["inactive", "unavailable", "detected", "not_detected"],
  iff: [
    "inactive",
    "unavailable",
    "no_reply",
    "friendly_reply",
    "registered_civil",
  ],
};
function object(v: unknown, keys: readonly string[]): Record<string, unknown> {
  if (
    !v ||
    typeof v !== "object" ||
    Array.isArray(v) ||
    Object.keys(v).sort().join() !== [...keys].sort().join()
  )
    throw new Error("Unsupported or incomplete modeled-report rehearsal.");
  return v as Record<string, unknown>;
}
function integer(v: unknown, lo: number, hi: number): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi;
}
function freeze<T>(v: T): T {
  if (v && typeof v === "object") {
    for (const x of Object.values(v)) freeze(x);
    Object.freeze(v);
  }
  return v;
}
/** Validate source correlation and complete exact intervals before showing them.
 * This does not turn an author-only counterfactual into trainee evidence. */
export function readEpisodeOpportunities(
  value: unknown,
  scenario: Scenario,
): EpisodeOpportunities {
  const r = object(value, [
    "version",
    "scenario_id",
    "raid_fingerprint",
    "scenario_hash",
    "engine_version",
    "sensor_version",
    "scope",
    "horizon",
    "actions_applied",
    "commands_applied",
    "planned_contacts",
    "segment_count",
    "contacts",
    "limitation",
  ]);
  if (
    scenario.engine_version !== "vyuha-0.4.0" ||
    scenario.version !== 2 ||
    !integer(scenario.duration, 60, 180) ||
    !Array.isArray(scenario.tracks) ||
    !integer(scenario.tracks.length, 1, 20) ||
    scenario.tracks.length * scenario.duration * 30 > 72000 ||
    r.version !== "episode-opportunities-v1" ||
    r.engine_version !== "vyuha-0.4.0" ||
    r.sensor_version !== "vyuha-0.4.0" ||
    r.scope !== "counterfactual-unintervened-author-reference" ||
    r.scenario_id !== scenario.id ||
    r.raid_fingerprint !== scenario.raid?.fingerprint ||
    typeof r.scenario_hash !== "string" ||
    !/^[a-f0-9]{64}$/.test(r.scenario_hash) ||
    r.actions_applied !== 0 ||
    r.commands_applied !== 0 ||
    r.planned_contacts !== scenario.tracks.length ||
    !integer(r.segment_count, 1, 16000) ||
    !Array.isArray(r.contacts) ||
    r.contacts.length !== scenario.tracks.length ||
    typeof r.limitation !== "string" ||
    !r.limitation ||
    r.limitation.length > 2000
  )
    throw new Error(
      "The modeled-report rehearsal does not belong to this frozen raid.",
    );
  const horizon = object(r.horizon, ["first_tick", "end_tick_exclusive", "hz"]),
    end = scenario.duration * 30;
  if (
    horizon.first_tick !== 0 ||
    horizon.hz !== 30 ||
    horizon.end_tick_exclusive !== end
  )
    throw new Error("The rehearsal horizon differs from the frozen exercise.");
  const expected = new Set(scenario.tracks.map((t) => t.id)),
    seen = new Set<string>();
  let segments = 0;
  for (const value of r.contacts) {
    const row = object(value, ["track_id", "active_ticks", "channels"]);
    if (
      typeof row.track_id !== "string" ||
      !expected.has(row.track_id) ||
      seen.has(row.track_id) ||
      !integer(row.active_ticks, 0, end)
    )
      throw new Error("The modeled-report roster is inconsistent.");
    seen.add(row.track_id);
    const channels = object(row.channels, OPPORTUNITY_CHANNELS);
    for (const channel of OPPORTUNITY_CHANNELS) {
      const c = object(channels[channel], ["state_ticks", "intervals"]);
      if (
        !c.state_ticks ||
        typeof c.state_ticks !== "object" ||
        Array.isArray(c.state_ticks) ||
        !Array.isArray(c.intervals) ||
        !c.intervals.length
      )
        throw new Error("Modeled report intervals are missing.");
      const counts = c.state_ticks as Record<string, unknown>,
        actual: Record<string, number> = {};
      if (
        Object.entries(counts).some(
          ([name, count]) =>
            !states[channel].includes(name) || !integer(count, 1, end),
        )
      )
        throw new Error("Invalid modeled-report counts.");
      let tick = 0;
      for (const value of c.intervals) {
        const interval = object(value, [
          "first_tick",
          "end_tick_exclusive",
          "state",
          "available",
          "first_sample_tick",
          "last_sample_tick",
        ]);
        if (
          interval.first_tick !== tick ||
          !integer(interval.end_tick_exclusive, tick + 1, end) ||
          typeof interval.state !== "string" ||
          !states[channel].includes(interval.state) ||
          typeof interval.available !== "boolean" ||
          (interval.state === "unavailable" && interval.available) ||
          (interval.state !== "inactive" &&
            interval.state !== "unavailable" &&
            !interval.available)
        )
          throw new Error(
            "The modeled-report timeline has a gap, overlap or invalid state.",
          );
        const first = interval.first_sample_tick,
          last = interval.last_sample_tick;
        if (
          (first === null) !== (last === null) ||
          (first !== null &&
            (!integer(first, 0, tick) ||
              !integer(last, first, interval.end_tick_exclusive - 1))) ||
          ((channel === "rf" || channel === "iff") && first !== null)
        )
          throw new Error("Unsupported or future modeled sample clock.");
        actual[interval.state] =
          (actual[interval.state] ?? 0) + interval.end_tick_exclusive - tick;
        tick = interval.end_tick_exclusive;
        if (++segments > 16000)
          throw new Error("Modeled-report interval budget exceeded.");
      }
      if (
        tick !== end ||
        (actual.inactive ?? 0) !== end - row.active_ticks ||
        JSON.stringify(Object.entries(actual).sort()) !==
          JSON.stringify(Object.entries(counts).sort())
      )
        throw new Error(
          "The modeled-report counts disagree with exact intervals.",
        );
    }
  }
  if (segments !== r.segment_count)
    throw new Error("The modeled-report interval receipt is incomplete.");
  return freeze(structuredClone(r)) as EpisodeOpportunities;
}
export async function requestEpisodeOpportunities(
  scenario: Scenario,
): Promise<EpisodeOpportunities> {
  const value = await api<unknown>(
    "/raids/opportunities",
    {
      version: "episode-opportunities-request-v1",
      expected_scenario_id: scenario.id,
      expected_fingerprint: scenario.raid?.fingerprint,
      scenario,
    },
    12000,
  );
  return readEpisodeOpportunities(value, scenario);
}
export function opportunityStateLabel(state: string) {
  return (
    (
      {
        inactive: "Outside active interval",
        unavailable: "Channel unavailable",
        none: "No modeled detection",
        tentative: "Tentative radar report",
        confirmed: "Confirmed radar report",
        lost: "Radar track lost",
        detect: "Detection only",
        recognise: "Shape recognition level",
        identify: "Shape identification level",
        detected: "RF signal reported",
        not_detected: "No RF signal reported",
        no_reply: "No IFF reply · identity unresolved",
        friendly_reply: "Friendly IFF cue",
        registered_civil: "Registered civil cue",
      } as Record<string, string>
    )[state] ?? "Unsupported state"
  );
}
