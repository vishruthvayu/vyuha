import type { LearningPreparation } from "./learning";
/** Public prose for one server-frozen preparation. This contract does not add
 * sensor observations, scoring rules, a scenario roster or a new engine. */
export type EpisodeBriefing = Readonly<{
  version: "episode-briefing-v1";
  preparation_id: string;
  scenario_id: string;
  catalog_version: "learning-v1";
  catalog_hash: string;
  item_id: string;
  competency_id: "C01" | "C02" | "C03" | "C04" | "C05";
  mode: "practice" | "assessment" | "adaptive";
  assistance: "full" | "faded" | "none";
  title: string;
  objective: string;
  instructions: readonly string[];
}>;
const fields = [
  "version",
  "preparation_id",
  "scenario_id",
  "catalog_version",
  "catalog_hash",
  "item_id",
  "competency_id",
  "mode",
  "assistance",
  "title",
  "objective",
  "instructions",
]
  .sort()
  .join();
const text = (v: unknown, max: number): v is string =>
  typeof v === "string" && v.trim().length > 0 && v.length <= max;
/** Absence, unknown versions and mismatched scopes deliberately return null.
 * Do not replace missing historical prose with the current catalog's lesson.
 * Returning a fresh frozen copy prevents consumers mutating the preparation. */
export function readEpisodeBriefing(
  preparation: LearningPreparation | null | undefined,
  expectedScenarioId?: string,
): EpisodeBriefing | null {
  const value: unknown = preparation?.briefing;
  if (
    !preparation ||
    (expectedScenarioId !== undefined &&
      preparation.scenario?.id !== expectedScenarioId) ||
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  )
    return null;
  const b = value as Record<string, unknown>,
    context = preparation.context;
  if (
    Object.keys(b).sort().join() !== fields ||
    !context ||
    context.version !== "learning-v1" ||
    b.version !== "episode-briefing-v1" ||
    b.catalog_version !== context.version ||
    !text(preparation.preparation_id, 80) ||
    !/^[A-Za-z0-9_-]{8,80}$/.test(preparation.preparation_id) ||
    b.preparation_id !== preparation.preparation_id ||
    !text(preparation.scenario?.id, 100) ||
    b.scenario_id !== preparation.scenario.id ||
    typeof b.catalog_hash !== "string" ||
    !/^[a-f0-9]{64}$/.test(b.catalog_hash) ||
    b.catalog_hash !== context.catalog_hash ||
    b.item_id !== context.item_id ||
    typeof b.item_id !== "string" ||
    !/^[A-Z0-9_-]{3,64}$/.test(b.item_id) ||
    typeof b.competency_id !== "string" ||
    !/^C0[1-5]$/.test(b.competency_id) ||
    b.mode !== context.mode ||
    typeof b.mode !== "string" ||
    !["practice", "assessment", "adaptive"].includes(b.mode) ||
    b.assistance !== context.assistance ||
    (b.mode === "assessment"
      ? b.assistance !== "none"
      : typeof b.assistance !== "string" ||
        !["full", "faded"].includes(b.assistance)) ||
    !text(b.title, 240) ||
    !text(b.objective, 1000) ||
    !Array.isArray(b.instructions) ||
    b.instructions.length < 1 ||
    b.instructions.length > 12 ||
    !Array.from(b.instructions).every((line) => text(line, 1000))
  )
    return null;
  return Object.freeze({
    version: "episode-briefing-v1",
    preparation_id: preparation.preparation_id,
    scenario_id: preparation.scenario.id,
    catalog_version: "learning-v1",
    catalog_hash: context.catalog_hash,
    item_id: context.item_id,
    competency_id: b.competency_id as EpisodeBriefing["competency_id"],
    mode: context.mode,
    assistance: context.assistance,
    title: b.title,
    objective: b.objective,
    instructions: Object.freeze([...b.instructions] as string[]),
  });
}
export function episodeStartLabel(briefing: EpisodeBriefing): string {
  return briefing.mode === "assessment"
    ? "Start independent assessment"
    : briefing.mode === "adaptive"
      ? "Start adaptive practice"
      : "Start Academy practice";
}
