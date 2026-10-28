import type { Scenario } from "./types";
import type { MissionMode, ObservationTemplate } from "./observation-missions";
export type ObservationEntry =
  | { kind: "published"; id: string }
  | {
      kind: "preset";
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
    ["observation_mission", "mission_template", "mission_mode", "seed"].some(
      (k) => p.getAll(k).length > 1,
    )
  )
    return invalid("Mission launch parameters must be unique.");
  if (p.has("observation_mission")) {
    if (p.has("mission_template"))
      return invalid("Choose one frozen mission or one preset, not both.");
    const id = p.get("observation_mission")!;
    return /^raid_[a-f0-9]{24}$/.test(id)
      ? { entry: { kind: "published", id }, error: null }
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
  return { entry: { kind: "preset", template, mode, seed }, error: null };
}
export function observationEntryKey(search: string) {
  return JSON.stringify(observationEntry(search));
}
export async function loadObservationMission(
  entry: ObservationEntry,
  request: (path: string, body?: unknown) => Promise<Scenario>,
) {
  const spec =
    entry.kind === "published"
      ? await request(`/observation-missions/${encodeURIComponent(entry.id)}`)
      : await request("/observation-missions/prepare", {
          template: entry.template,
          mode: entry.mode,
          seed: entry.seed,
        });
  const m = spec.observation_mission;
  if (
    spec.engine_version !== "vyuha-0.5.0" ||
    m?.version !== "observation-mission-v1" ||
    m.assessment_version !== "evidence-assessment-v1"
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
