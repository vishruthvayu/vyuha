import type {
  LearningCatalogue,
  LearningItem,
  LearningReview,
} from "./learning";
export type TrainingBridgeCase = {
  decisionId: string;
  tick: number;
  verdict: "correct" | "incorrect" | "unassessable";
  reason: string;
};
export type TrainingBridgePath = {
  competencyId: string;
  counts: { correct: number; incorrect: number; unassessable: number };
  priority: "reconsider" | "seek_evidence" | "extend";
  explanation: string;
  cases: TrainingBridgeCase[];
};
const hash = (v: unknown): v is string =>
  typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const count = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
/** Navigation over original server-reconstructed evidence; no rescoring or mastery estimate.
 * Summary votes are per contact/competency, not the number of decision cases. */
export function trainingBridgePaths(
  review: LearningReview,
): TrainingBridgePath[] {
  const e = review.evidence;
  if (!e) return [];
  if (
    review.context.version !== "learning-v1" ||
    e.version !== "competency-evidence-v1" ||
    !hash(e.original_review_hash) ||
    !hash(review.context.catalog_hash) ||
    e.item_id !== review.context.item_id ||
    e.mode !== review.context.mode ||
    e.assistance !== review.context.assistance ||
    e.assessed !== (review.context.mode === "assessment") ||
    !e.summary ||
    !Array.isArray(e.observations) ||
    e.observations.length > 10000
  )
    throw new Error(
      "The rehearsal path does not match the original learning review.",
    );
  const paths = new Map<string, TrainingBridgePath>();
  for (const [id, counts] of Object.entries(e.summary)) {
    if (!/^C0[1-5]$/.test(id)) continue;
    if (
      !counts ||
      ![counts.correct, counts.incorrect, counts.unassessable].every(count)
    )
      throw new Error("Invalid competency evidence counts.");
    if (counts.correct + counts.incorrect + counts.unassessable === 0) continue;
    const priority = counts.incorrect
      ? "reconsider"
      : counts.unassessable
        ? "seek_evidence"
        : "extend";
    paths.set(id, {
      competencyId: id,
      counts: { ...counts },
      priority,
      explanation:
        priority === "reconsider"
          ? "The original review records at least one observable decision error. Reconstruct its evidence before choosing another practice episode."
          : priority === "seek_evidence"
            ? "Some original decisions could not be assessed from the available evidence. This is an evidence opportunity gap, not an incorrect answer or learner deficit."
            : "The original review supports these decisions in this scenario. A different practice item can extend the exercise; it does not establish transfer or mastery.",
      cases: [],
    });
  }
  const seen = new Map<string, string>();
  for (const o of e.observations) {
    if (!/^C0[1-5]$/.test(o.competency_id)) continue;
    if (
      typeof o.decision_id !== "string" ||
      !o.decision_id ||
      o.decision_id.length > 160 ||
      !count(o.tick) ||
      !["correct", "incorrect", "unassessable"].includes(o.verdict) ||
      typeof o.reason !== "string" ||
      !o.reason ||
      o.reason.length > 200
    )
      throw new Error("Invalid source decision in rehearsal path.");
    const key = `${o.competency_id}:${o.decision_id}`,
      signature = JSON.stringify([o.tick, o.verdict, o.reason]);
    if (seen.has(key)) {
      if (seen.get(key) !== signature)
        throw new Error("Conflicting source decisions in rehearsal path.");
      continue;
    }
    seen.set(key, signature);
    paths.get(o.competency_id)?.cases.push({
      decisionId: o.decision_id,
      tick: o.tick,
      verdict: o.verdict as TrainingBridgeCase["verdict"],
      reason: o.reason,
    });
  }
  const rank = { reconsider: 0, seek_evidence: 1, extend: 2 };
  return [...paths.values()]
    .filter((p) => p.cases.length)
    .map((p) => ({
      ...p,
      cases: p.cases.sort(
        (a, b) => a.tick - b.tick || a.decisionId.localeCompare(b.decisionId),
      ),
    }))
    .sort(
      (a, b) =>
        rank[a.priority] - rank[b.priority] ||
        a.competencyId.localeCompare(b.competencyId),
    );
}
/** Current individual practice only. Historical evidence keeps its frozen catalog;
 * assessment and controlled protocols remain in their deliberate workflows. */
export function trainingBridgeCandidates(
  catalogue: LearningCatalogue,
  competencyId: string,
): LearningItem[] {
  if (
    catalogue.version !== "learning-v1" ||
    !hash(catalogue.catalog_hash) ||
    !Array.isArray(catalogue.items) ||
    catalogue.items.length > 1000 ||
    !Array.isArray(catalogue.competencies) ||
    !catalogue.competencies.some(
      (c) => c.id === competencyId && c.scope === "individual",
    ) ||
    new Set(catalogue.items.map((i) => i.id)).size !== catalogue.items.length
  )
    throw new Error(
      "The current practice catalog cannot support this rehearsal.",
    );
  return catalogue.items
    .filter(
      (i) =>
        i.competency_id === competencyId &&
        i.audience === "individual" &&
        i.pool === "practice" &&
        i.form === null &&
        ["full", "faded"].includes(i.assistance),
    )
    .map((i) => {
      if (
        !/^[A-Z0-9_-]{3,64}$/.test(i.id) ||
        typeof i.title !== "string" ||
        typeof i.objective !== "string" ||
        !Array.isArray(i.instructions) ||
        !i.instructions.every((v) => typeof v === "string")
      )
        throw new Error("Invalid practice item in current catalog.");
      return i;
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}
export function preferredTrainingBridgeItem(
  candidates: LearningItem[],
  sourceItemId: string,
  priority: TrainingBridgePath["priority"],
): LearningItem | undefined {
  const different = candidates.filter((i) => i.id !== sourceItemId),
    pool = different.length ? different : candidates;
  return (
    pool.find(
      (i) => i.assistance === (priority === "extend" ? "faded" : "full"),
    ) ?? pool[0]
  );
}
export function nextTrainingBridgeSeed(seed: number): number {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw new Error("Invalid original scenario seed.");
  return (seed + 1) >>> 0;
}
