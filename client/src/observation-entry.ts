import type { Scenario } from "./types";
import { validateTrainingSite } from "./training-site-contract";
import type { MissionMode, ObservationTemplate } from "./observation-missions";
export type ObservationEntry =
  | { kind: "published"; id: string; version?: 2 | 3 }
  | {
      kind: "preset";
      version?: 2 | 3;
      site?: "freight_corridor" | "open_campus";
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
    return p.has("mission_version") || p.has("mission_site")
      ? {
          entry: null,
          error:
            "Choose a published mission or a mission template before selecting its contract/site.",
        }
      : { entry: null, error: null };
  const invalid = (error: string) => ({ entry: null, error });
  if (
    [
      "observation_mission",
      "mission_template",
      "mission_mode",
      "mission_version",
      "mission_site",
      "seed",
    ].some((k) => p.getAll(k).length > 1)
  )
    return invalid("Mission launch parameters must be unique.");
  const rawVersion = p.get("mission_version");
  if (
    rawVersion !== null &&
    rawVersion !== "1" &&
    rawVersion !== "2" &&
    rawVersion !== "3"
  )
    return invalid("Unknown observation mission contract.");
  const version =
    rawVersion === "3"
      ? { version: 3 as const }
      : rawVersion === "2"
        ? { version: 2 as const }
        : {};
  const rawSite = p.get("mission_site");
  if (
    rawSite !== null &&
    (rawVersion !== "3" ||
      !["freight_corridor", "open_campus"].includes(rawSite) ||
      p.has("observation_mission"))
  )
    return invalid("A public site preset requires mission contract 3.");
  const site =
    rawVersion === "3"
      ? {
          site: (rawSite ?? "freight_corridor") as
            "freight_corridor" | "open_campus",
        }
      : {};
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
    entry: { kind: "preset", template, mode, seed, ...version, ...site },
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
    entry.version === 3
      ? "/observation-missions-v3"
      : entry.version === 2
        ? "/observation-missions-v2"
        : "/observation-missions";
  const spec =
    entry.kind === "published"
      ? await request(`${prefix}/${encodeURIComponent(entry.id)}`)
      : await request(`${prefix}/prepare`, {
          template: entry.template,
          mode: entry.mode,
          seed: entry.seed,
          ...(entry.version === 3
            ? { site: entry.site ?? "freight_corridor" }
            : {}),
        });
  const m = spec.observation_mission;
  if (
    spec.engine_version !==
      (entry.version === 2 || entry.version === 3
        ? "vyuha-0.6.0"
        : "vyuha-0.5.0") ||
    m?.version !==
      (entry.version === 3
        ? "observation-mission-v3"
        : entry.version === 2
          ? "observation-mission-v2"
          : "observation-mission-v1") ||
    m.assessment_version !==
      (entry.version === 2 || entry.version === 3
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
  if (entry.version === 3) {
    if (
      !spec.training_site ||
      (entry.kind === "preset" &&
        spec.training_site.id !== (entry.site ?? "freight_corridor"))
    )
      throw Error("The authored site does not match the prepared mission.");
    validateTrainingSite(spec.training_site, spec.terrain_boxes ?? []);
  }
  return spec;
}
