import type { Scenario } from "./types";
import type { MissionMode, ObservationTemplate } from "./observation-missions";
export type ObservationEntry =
  | { kind: "published"; id: string; version?: 2 }
  | {
      kind: "preset";
      version?: 2;
      template: ObservationTemplate;
      mode: MissionMode;
      seed: number;
    };
export function observationEntry(search: string): {
  entry: ObservationEntry | null;
  error: string | null;
} {
  const p = new URLSearchParams(search);
  // An existing frozen Academy ticket retains its own independent admission.
  if (p.has("learning")) return { entry: null, error: null };
  if (!p.has("observation_mission") && !p.has("mission_template"))
    return { entry: null, error: null };
  const invalid = (error: string) => ({ entry: null, error });
  if (
    [
      "observation_mission",
      "mission_template",
      "mission_mode",
      "mission_version",
      "seed",
    ].some((k) => p.getAll(k).length > 1)
  )
    return invalid("Mission launch parameters must be unique.");
  const rawVersion = p.get("mission_version");
  if (rawVersion !== null && rawVersion !== "1" && rawVersion !== "2")
    return invalid("Unknown observation mission contract.");
  const version = rawVersion === "2" ? { version: 2 as const } : {};
  if (p.has("observation_mission")) {
    if (p.has("mission_template"))
      return invalid("Choose one frozen mission or one preset, not both.");
    const id = p.get("observation_mission")!;
    return /^raid_[a-f0-9]{24}$/.test(id)
      ? { entry: { kind: "published", id, ...version }, error: null }
      : invalid("The frozen observation mission identifier is invalid.");
  }
  const template = p.get("mission_template") as ObservationTemplate;
  if (!["night_switch", "civil_restraint", "timed_window"].includes(template))
    return invalid("Unknown observation mission template.");
  const mode = p.get("mission_mode") ?? "practice";
  if (mode !== "practice" && mode !== "assessment")
    return invalid("Unknown mission evidence mode.");
  const raw = p.get("seed");
  const seed = raw === null ? 482913 : Number(raw);
  if (
    (raw !== null && !/^\d{1,10}$/.test(raw)) ||
    !Number.isInteger(seed) ||
    seed < 0 ||
    seed > 4294967295
  )
    return invalid("Use an unsigned 32-bit mission seed.");
  return {
    entry: { kind: "preset", template, mode, seed, ...version },
    error: null,
  };
}
export function observationEntryKey(search: string) {
  return JSON.stringify(observationEntry(search));
}
export async function loadObservationMission(
  entry: ObservationEntry,
  request: (path: string, body?: unknown) => Promise<Scenario>,
) {
  const prefix =
    entry.version === 2 ? "/observation-missions-v2" : "/observation-missions";
  const spec =
    entry.kind === "published"
      ? await request(`${prefix}/${encodeURIComponent(entry.id)}`)
      : await request(`${prefix}/prepare`, {
          template: entry.template,
          mode: entry.mode,
          seed: entry.seed,
        });
  const m = spec.observation_mission;
  if (
    spec.engine_version !==
      (entry.version === 2 ? "vyuha-0.6.0" : "vyuha-0.5.0") ||
    m?.version !==
      (entry.version === 2
        ? "observation-mission-v2"
        : "observation-mission-v1") ||
    m.assessment_version !==
      (entry.version === 2
        ? "evidence-assessment-v2"
        : "evidence-assessment-v1")
  )
    throw Error("The returned mission uses an unsupported frozen contract.");
  if (
    entry.kind === "published"
      ? spec.id !== entry.id
      : m.template !== entry.template ||
        m.mode !== entry.mode ||
        spec.seed !== entry.seed
  )
    throw Error(
      "The prepared mission does not match the requested frozen exercise.",
    );
  return spec;
}
