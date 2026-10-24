import type {
  LearningCatalogue,
  LearningItem,
  LearningPreparation,
} from "./learning";
export type AcademyStage = "supported" | "faded" | "assessment";
export type AcademyProgress = {
  practiced_items?: string[];
  practice_attempts: number;
  assessed_attempts: number;
  competencies: Record<
    string,
    {
      correct: number;
      incorrect: number;
      unassessable: number;
      assessed_sessions: number;
    }
  >;
  limitation: string;
};
export const stages: {
  id: AcademyStage;
  title: string;
  label: string;
  detail: string;
}[] = [
  {
    id: "supported",
    title: "Supported practice",
    label: "1 · Learn with guidance",
    detail:
      "Use the lesson guidance, make a decision and reconstruct the evidence afterward.",
  },
  {
    id: "faded",
    title: "Less-guided practice",
    label: "2 · Try with less guidance",
    detail:
      "Apply the same competency with the catalog's faded assistance. Practice remains separate from assessment.",
  },
  {
    id: "assessment",
    title: "Independent assessment",
    label: "3 · Demonstrate independently",
    detail:
      "Attempt a separate assessment item with assistance disabled. The result is scenario-bound evidence, not mastery.",
  },
];
export const assessmentForms = [
  { id: "baseline-a", label: "Baseline A" },
  { id: "immediate-b", label: "Immediate B" },
  { id: "retention-c", label: "Retention C" },
  { id: "transfer-d", label: "Transfer D" },
];
export type AcademyCourse = {
  competency: LearningCatalogue["competencies"][number];
  supported: LearningItem[];
  faded: LearningItem[];
  assessment: LearningItem[];
};
export function academyCourses(catalogue: LearningCatalogue): AcademyCourse[] {
  return catalogue.competencies
    .filter((c) => c.scope === "individual")
    .map((competency) => {
      const items = catalogue.items
        .filter(
          (i) =>
            i.audience === "individual" && i.competency_id === competency.id,
        )
        .sort((a, b) => a.id.localeCompare(b.id));
      return {
        competency,
        supported: items.filter(
          (i) =>
            i.pool === "practice" && i.form === null && i.assistance === "full",
        ),
        faded: items.filter(
          (i) =>
            i.pool === "practice" &&
            i.form === null &&
            i.assistance === "faded",
        ),
        assessment: items.filter(
          (i) =>
            i.pool === "assessment" &&
            i.assistance === "none" &&
            assessmentForms.some((f) => f.id === i.form),
        ),
      };
    });
}
export function initialCompetency(
  courses: AcademyCourse[],
  requested: string | null,
) {
  return requested &&
    /^C0[1-5]$/.test(requested) &&
    courses.some((c) => c.competency.id === requested)
    ? requested
    : (courses[0]?.competency.id ?? "");
}
export function stageItems(
  course: AcademyCourse,
  stage: AcademyStage,
  form: string,
) {
  return stage === "assessment"
    ? course.assessment.filter((i) => i.form === form)
    : course[stage];
}
export function practiceRecorded(
  items: LearningItem[],
  progress: AcademyProgress | null,
) {
  return items.some((i) => progress?.practiced_items?.includes(i.id));
}
export function nextAcademyStage(
  course: AcademyCourse,
  progress: AcademyProgress | null,
): AcademyStage {
  if (course.supported.length && !practiceRecorded(course.supported, progress))
    return "supported";
  if (course.faded.length && !practiceRecorded(course.faded, progress))
    return "faded";
  if (course.assessment.length) return "assessment";
  return course.supported.length ? "supported" : "faded";
}
export function stageEvidence(
  course: AcademyCourse,
  stage: AcademyStage,
  progress: AcademyProgress | null,
) {
  if (stage === "assessment") {
    const n = progress?.competencies[course.competency.id]?.assessed_sessions;
    return n === undefined
      ? "Assessment evidence unavailable"
      : n
        ? `${n} assessed session${n === 1 ? "" : "s"}`
        : "No assessable session recorded";
  }
  if (!progress?.practiced_items) return "Practice-item evidence unavailable";
  return practiceRecorded(course[stage], progress)
    ? "Supporting practice observation recorded"
    : "No supporting practice observation recorded";
}
export function preparationMatches(
  p: LearningPreparation,
  catalogue: LearningCatalogue,
  mode: "practice" | "assessment" | "adaptive",
  expected?: LearningItem,
): boolean {
  const ctx = p?.context;
  const item = catalogue.items.find(
    (i) => i.id === ctx?.item_id && i.audience === "individual",
  );
  return Boolean(
    typeof p?.preparation_id === "string" &&
    p.preparation_id.length > 0 &&
    typeof p.scenario?.title === "string" &&
    ctx?.version === "learning-v1" &&
    ctx.catalog_hash === catalogue.catalog_hash &&
    ctx.mode === mode &&
    item &&
    (!expected || item.id === expected.id) &&
    item.pool === (mode === "assessment" ? "assessment" : "practice") &&
    ctx.assistance === (mode === "assessment" ? "none" : item.assistance) &&
    ctx.selection?.policy ===
      (mode === "adaptive" ? "coverage-director-v1" : "direct-item-v1") &&
    ctx.selection.candidates?.includes(item.id),
  );
}
