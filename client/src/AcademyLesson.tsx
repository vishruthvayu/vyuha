import type { LearningItem } from "./learning";
import {
  assessmentForms,
  stages,
  type AcademyStage,
  type AcademyCourse,
  type AcademyProgress,
} from "./academy-journey";
type Props = {
  course: AcademyCourse;
  stage: AcademyStage;
  item: LearningItem | undefined;
  items: LearningItem[];
  form: string;
  progress: AcademyProgress | null;
  busy: boolean;
  onItem: (id: string) => void;
  onForm: (form: string) => void;
  onPrepare: () => void;
  onStage: (stage: AcademyStage) => void;
};
export default function AcademyLesson({
  course,
  stage,
  item,
  items,
  form,
  progress,
  busy,
  onItem,
  onForm,
  onPrepare,
  onStage,
}: Props) {
  const info = stages.find((s) => s.id === stage)!;
  const recorded = item && progress?.practiced_items?.includes(item.id);
  return (
    <section className="academy-lesson" aria-labelledby="academy-lesson-title">
      <header className="academy-lesson-heading">
        <div>
          <p className="eyebrow">
            {info.title} · {course.competency.id}
          </p>
          <h2 id="academy-lesson-title">{course.competency.title}</h2>
          <p>{info.detail}</p>
        </div>
        <span className="academy-assistance">
          {stage === "assessment"
            ? "No assistance"
            : stage === "faded"
              ? "Faded guidance"
              : "Full guidance"}
        </span>
      </header>
      <div className="academy-lesson-brief">
        <div>
          <label>
            {stage === "assessment" ? "Assessment item" : "Lesson"}
            <select
              aria-label={stage === "assessment" ? "Assessment item" : "Lesson"}
              value={item?.id ?? ""}
              onChange={(e) => onItem(e.target.value)}
              disabled={!items.length}
            >
              {!items.length && (
                <option value="">No eligible item in this stage</option>
              )}
              {items.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.title}
                </option>
              ))}
            </select>
          </label>
          {stage === "assessment" && (
            <label>
              Assessment form
              <select value={form} onChange={(e) => onForm(e.target.value)}>
                {assessmentForms
                  .filter((f) => course.assessment.some((i) => i.form === f.id))
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
              </select>
            </label>
          )}
          {item ? (
            <>
              <h3>Your objective</h3>
              <p className="academy-objective">{item.objective}</p>
              <h3>In the exercise</h3>
              <ol>
                {item.instructions.map((instruction) => (
                  <li key={instruction}>{instruction}</li>
                ))}
              </ol>
            </>
          ) : (
            <p role="status">
              This catalog does not provide an eligible item for this stage.
              Choose another stage or competency.
            </p>
          )}
        </div>
        <aside
          className="academy-evidence-brief"
          aria-label="Evidence to review after the exercise"
        >
          <p className="eyebrow">WHAT TO LOOK FOR IN REVIEW</p>
          <h3>Build an evidence trail</h3>
          <p>{course.competency.claim}</p>
          <ol>
            <li>Identify the available observation behind one decision.</li>
            <li>
              Compare the decision with the server-verified review in Ghost.
            </li>
            <li>
              Record what remained uncertain and what you would check next.
            </li>
          </ol>
          {item && (
            <p>
              <strong>Reflection prompt:</strong> {item.reflection}
            </p>
          )}
          <p className="academy-note">
            {stage === "assessment"
              ? "Review may include incorrect or unassessable evidence. One assessment is not proof of proficiency."
              : "Practice evidence is excluded from individual assessment. A saved reflection does not award competency credit."}
          </p>
        </aside>
      </div>
      {recorded && stage !== "assessment" && (
        <div className="academy-stage-record">
          <p>
            A supporting practice observation is recorded for this lesson. This
            is practice evidence, not assessed mastery.
          </p>
          {stage === "supported" && course.faded.length ? (
            <button className="button subtle" onClick={() => onStage("faded")}>
              Try with less guidance
            </button>
          ) : (
            course.assessment.length > 0 && (
              <button
                className="button subtle"
                onClick={() => onStage("assessment")}
              >
                Choose an independent assessment
              </button>
            )
          )}
        </div>
      )}
      {stage === "assessment" && (
        <p className="academy-note">
          One explicit item in the chosen competency and form; assistance is
          disabled. Form labels alone do not establish timed retention, transfer
          or a controlled study. Use a registered protocol for those
          comparisons.
        </p>
      )}
      <footer className="academy-lesson-action">
        <div>
          <strong>Prepare, then open in Training</strong>
          <p>
            Preparation freezes an attempt. Open the frozen attempt in Training,
            then use its Start control.
          </p>
        </div>
        <button
          className="button primary"
          disabled={busy || !item}
          onClick={onPrepare}
        >
          {busy
            ? "Preparing frozen attempt…"
            : stage === "assessment"
              ? "Prepare assessment item"
              : "Prepare selected lesson"}
        </button>
      </footer>
    </section>
  );
}
