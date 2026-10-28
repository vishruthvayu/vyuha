import ObservationMissionJourney from "./ObservationMissionJourney";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "./UI";
import { api } from "./storage";
import { newId, type UnitIdentity } from "./unit-state";
import type { LearningCatalogue, LearningPreparation } from "./learning";
import { LearningBanner } from "./LearningEvidence";
import AcademyLesson from "./AcademyLesson";
import {
  academyCourses,
  initialCompetency,
  nextAcademyStage,
  preparationMatches,
  stageEvidence,
  stageItems,
  stages,
  type AcademyProgress,
  type AcademyStage,
} from "./academy-journey";

export default function Academy({ identity }: { identity?: UnitIdentity }) {
  const trainee = identity?.trainee_id ?? "CADET-01";
  return (
    <AcademyJourney
      key={trainee}
      trainee={trainee}
      callsign={identity?.callsign ?? trainee}
    />
  );
}
function AcademyJourney({
  trainee,
  callsign,
}: {
  trainee: string;
  callsign: string;
}) {
  const [catalogue, setCatalogue] = useState<LearningCatalogue | null>(null),
    [progress, setProgress] = useState<AcademyProgress | null>(null);
  const [competency, setCompetency] = useState(""),
    [stage, setStage] = useState<AcademyStage>("supported"),
    [lessonId, setLessonId] = useState(""),
    [form, setForm] = useState("baseline-a");
  const [prepared, setPrepared] = useState<LearningPreparation | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0);
  const scope = useRef(0),
    pending = useRef(false),
    loadScope = useRef(0),
    request = useRef<{ key: string; id: string } | null>(null);
  const routedCompetency = useRef(
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("competency"),
  );
  const courseRail = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const rail = courseRail.current;
    const selected = rail?.querySelector<HTMLElement>(
      'button[aria-pressed="true"]',
    );
    if (rail && selected && typeof rail.scrollTo === "function") {
      const left = selected.offsetLeft - rail.offsetLeft;
      if (
        left < rail.scrollLeft ||
        left + selected.offsetWidth > rail.scrollLeft + rail.clientWidth
      )
        rail.scrollTo({ left: Math.max(0, left - 4), behavior: "auto" });
    }
  }, [competency]);
  useEffect(() => {
    const active = ++loadScope.current;
    scope.current++;
    pending.current = false;
    setBusy(false);
    setLoading(true);
    setError("");
    setPrepared(null);
    request.current = null;
    void Promise.all([
      api<LearningCatalogue>("/learning/catalogue"),
      api<AcademyProgress>(
        `/learning/trainees/${encodeURIComponent(trainee)}/progress`,
      ),
    ])
      .then(([nextCatalogue, nextProgress]) => {
        if (active !== loadScope.current) return;
        if (
          nextCatalogue.version !== "learning-v1" ||
          !Array.isArray(nextCatalogue.items) ||
          !Array.isArray(nextCatalogue.competencies)
        )
          throw new Error(
            "The curriculum contract is unavailable. Reload the original-server curriculum.",
          );
        const courses = academyCourses(nextCatalogue);
        setCatalogue(nextCatalogue);
        setProgress(nextProgress);
        setCompetency((previous) =>
          courses.some((c) => c.competency.id === previous)
            ? previous
            : initialCompetency(courses, routedCompetency.current),
        );
      })
      .catch((failure) => {
        if (active === loadScope.current)
          setError((failure as Error).message || "Curriculum unavailable.");
      })
      .finally(() => {
        if (active === loadScope.current) setLoading(false);
      });
    return () => {
      loadScope.current++;
      scope.current++;
      pending.current = false;
    };
  }, [trainee, refresh]);
  const courses = catalogue ? academyCourses(catalogue) : [],
    course = courses.find((c) => c.competency.id === competency) ?? courses[0];
  const effectiveForm = course?.assessment.some((i) => i.form === form)
    ? form
    : (course?.assessment[0]?.form ?? form);
  const available = course ? stageItems(course, stage, effectiveForm) : [],
    item = available.find((i) => i.id === lessonId) ?? available[0];
  const suggestion = course ? nextAcademyStage(course, progress) : "supported",
    counts = course && progress?.competencies[course.competency.id];
  function discardPreparation() {
    scope.current++;
    pending.current = false;
    setBusy(false);
    setPrepared(null);
    setError("");
  }
  function chooseStage(next: AcademyStage) {
    discardPreparation();
    setStage(next);
    setLessonId("");
  }
  function chooseCourse(id: string) {
    discardPreparation();
    setCompetency(id);
    setStage("supported");
    setLessonId("");
    setForm("baseline-a");
  }
  async function prepare(mode: "practice" | "assessment" | "adaptive") {
    if (
      !catalogue ||
      loading ||
      pending.current ||
      (mode !== "adaptive" && !item)
    )
      return;
    const expected = mode === "adaptive" ? undefined : item;
    const key = JSON.stringify([
      trainee,
      catalogue.catalog_hash,
      mode,
      expected?.id ?? "coverage",
      mode === "assessment" ? effectiveForm : null,
    ]);
    if (request.current?.key !== key) request.current = { key, id: newId() };
    const active = ++scope.current;
    pending.current = true;
    setBusy(true);
    setError("");
    setPrepared(null);
    try {
      const next = await api<LearningPreparation>("/learning/prepare", {
        request_id: request.current.id,
        trainee,
        mode,
        seed: 62147,
        ...(expected ? { item_id: expected.id } : {}),
        ...(mode === "assessment" ? { form: effectiveForm } : {}),
      });
      if (active !== scope.current) return;
      if (!preparationMatches(next, catalogue, mode, expected))
        throw new Error(
          "Preparation does not match this learner journey. No launch link accepted; reload the curriculum or retry.",
        );
      if (mode === "adaptive") {
        const chosen = catalogue.items.find(
          (i) => i.id === next.context.item_id,
        )!;
        setCompetency(chosen.competency_id);
        setStage(chosen.assistance === "faded" ? "faded" : "supported");
        setLessonId(chosen.id);
      }
      setPrepared(next);
    } catch (failure) {
      if (active === scope.current)
        setError((failure as Error).message || "Preparation unavailable.");
    } finally {
      if (active === scope.current) {
        pending.current = false;
        setBusy(false);
      }
    }
  }
  return (
    <main className="page academy-page academy-journey">
      <PageHeader
        eyebrow="A GUIDED LEARNING JOURNEY"
        title="Academy"
        description="Learn a decision skill with guidance, try it with less help, then gather independent evidence. Each step leads into the real simulator and back to verified review."
      />
      <ObservationMissionJourney trainee={trainee} />
      <section
        className="panel acquisition-academy-brief"
        aria-label="Active observation practice"
      >
        <span className="eyebrow">NEW SIMULATION / OPT-IN PRACTICE</span>
        <h2>Investigate before you decide.</h2>
        <p>
          Radar supplies a contact. Request EO or IR, wait for the simulated
          acquisition, then decide what the released evidence actually
          establishes. Review the complete request-to-decision chain in verified
          Ghost.
        </p>
        <p>
          Practice only. This new engine does not update individual mastery.
          Crew and VR adapters are not yet admitted.
        </p>
        <a className="button primary" href="/?acquisition=1&night=0">
          Enter active observation practice
        </a>
      </section>
      <div className="academy-journey-intro">
        <div>
          <strong>{callsign}'s learning route</strong>
          <p>
            Choose a competency, brief the task and explicitly prepare an
            attempt. Any stage is available; suggestions are not unlocks or
            mastery judgments.
          </p>
        </div>
        <button
          className="button subtle"
          disabled={loading || busy}
          onClick={() => setRefresh((n) => n + 1)}
        >
          {loading ? "Loading original-server evidence…" : "Refresh evidence"}
        </button>
      </div>
      {error && (
        <div role="alert" className="error">
          <p>{error}</p>
          <button
            className="button subtle"
            disabled={loading || busy}
            onClick={() => setRefresh((n) => n + 1)}
          >
            Reload curriculum and evidence
          </button>
        </div>
      )}
      {!catalogue ? (
        <p role="status">
          {loading
            ? "Loading local curriculum…"
            : "The curriculum could not be loaded. Use Reload curriculum and evidence to retry."}
        </p>
      ) : course ? (
        <>
          <div className="academy-course-layout">
            <nav
              className="academy-course-nav"
              aria-label="Individual competency journeys"
            >
              <p className="eyebrow">CHOOSE YOUR FOCUS</p>
              <ol ref={courseRail}>
                {courses.map((candidate, index) => {
                  const c = progress?.competencies[candidate.competency.id];
                  return (
                    <li key={candidate.competency.id}>
                      <button
                        aria-pressed={
                          course.competency.id === candidate.competency.id
                        }
                        onClick={() => chooseCourse(candidate.competency.id)}
                      >
                        <span>
                          {String(index + 1).padStart(2, "0")} ·{" "}
                          {candidate.competency.id}
                        </span>
                        <strong>{candidate.competency.title}</strong>
                        <small>
                          {c
                            ? `${c.assessed_sessions} assessed sessions · ${c.unassessable} unassessable observations`
                            : "Evidence unavailable"}
                        </small>
                      </button>
                    </li>
                  );
                })}
              </ol>
              <p className="academy-note">
                Individual routes only. Crew coordination is a separate
                curriculum contract.
              </p>
            </nav>
            <div className="academy-course-workspace">
              <nav
                className="academy-stage-nav"
                aria-label="Stages of the selected competency"
              >
                <ol>
                  {stages.map((s) => (
                    <li key={s.id}>
                      <button
                        aria-current={stage === s.id ? "step" : undefined}
                        disabled={course[s.id].length === 0}
                        onClick={() => chooseStage(s.id)}
                      >
                        <strong>{s.label}</strong>
                        <small>
                          {course[s.id].length
                            ? stageEvidence(course, s.id, progress)
                            : "No eligible catalog item"}
                        </small>
                      </button>
                    </li>
                  ))}
                </ol>
              </nav>
              <p className="academy-stage-suggestion">
                Suggested next:{" "}
                <strong>
                  {stages.find((s) => s.id === suggestion)!.title}
                </strong>
                . Based on recorded supported practice items; no proficiency or
                assessment pass is inferred.
              </p>
              <AcademyLesson
                course={course}
                stage={stage}
                item={item}
                items={available}
                form={effectiveForm}
                progress={progress}
                busy={busy || loading}
                onItem={(id) => {
                  discardPreparation();
                  setLessonId(id);
                }}
                onForm={(value) => {
                  discardPreparation();
                  setForm(value);
                  setLessonId("");
                }}
                onStage={chooseStage}
                onPrepare={() =>
                  void prepare(
                    stage === "assessment" ? "assessment" : "practice",
                  )
                }
              />
              {prepared && (
                <section
                  className="academy-ready"
                  aria-label="Prepared Academy attempt"
                >
                  <p className="eyebrow">YOUR FROZEN ATTEMPT</p>
                  <h2>Ready to train</h2>
                  <p role="status">
                    Frozen preparation ready. Open prepared training, then use
                    Start; no exercise has started automatically.
                  </p>
                  <LearningBanner preparation={prepared} />
                  <p>{prepared.scenario.title}</p>
                  <div className="academy-launch-actions">
                    <a
                      className="button primary"
                      href={`/?mode=adaptive&learning=${encodeURIComponent(prepared.preparation_id)}`}
                    >
                      Open prepared training
                    </a>
                    <button
                      className="button subtle"
                      onClick={() => {
                        discardPreparation();
                        request.current = null;
                      }}
                    >
                      Prepare another attempt
                    </button>
                  </div>
                  <p>
                    After completion and server verification, open Ghost review
                    to reconstruct one decision, then return here and refresh
                    the evidence. Preparing or opening an attempt does not mark
                    a stage complete.
                  </p>
                </section>
              )}
              {busy && (
                <p role="status">
                  Preparing the frozen lesson. You can change stage to discard a
                  pending result; an exercise will not start automatically.
                </p>
              )}
              <section
                className="academy-course-evidence"
                aria-labelledby="academy-course-evidence-title"
              >
                <h2 id="academy-course-evidence-title">
                  Evidence for this competency
                </h2>
                {counts ? (
                  <>
                    <dl>
                      <div>
                        <dt>Supported</dt>
                        <dd>{counts.correct}</dd>
                      </div>
                      <div>
                        <dt>Incorrect</dt>
                        <dd>{counts.incorrect}</dd>
                      </div>
                      <div>
                        <dt>Unassessable</dt>
                        <dd>{counts.unassessable}</dd>
                      </div>
                      <div>
                        <dt>Assessed sessions</dt>
                        <dd>{counts.assessed_sessions}</dd>
                      </div>
                    </dl>
                    <p>
                      These are original-server assessment observations across
                      this competency, not stage completion or per-form results.
                      Practice and Crew do not become individual assessment.
                    </p>
                  </>
                ) : (
                  <p>
                    Original-server evidence for this competency is unavailable.
                  </p>
                )}
                <a href="/?view=aar">Open Ghost review</a>
              </section>
            </div>
          </div>
          <details className="panel academy-course-tools">
            <summary>Coverage-first practice and full evidence record</summary>
            <p>
              Coverage-first practice chooses among individual practice items
              using the frozen, inspectable heuristic. It may change your
              selected competency; it does not allocate an assessment or
              establish learning efficacy.
            </p>
            <button
              className="button secondary"
              disabled={loading || busy}
              onClick={() => void prepare("adaptive")}
            >
              Prepare coverage-first practice
            </button>
            {progress && (
              <>
                <p>
                  {progress.practice_attempts} completed practice attempts ·{" "}
                  {progress.assessed_attempts} assessment attempts
                </p>
                <div
                  className="table-scroll"
                  role="region"
                  tabIndex={0}
                  aria-label="Academy evidence coverage"
                >
                  <table>
                    <caption>
                      Individual assessment coverage · counts, not mastery
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Competency</th>
                        <th scope="col">Supported</th>
                        <th scope="col">Incorrect</th>
                        <th scope="col">Unassessable</th>
                        <th scope="col">Assessed sessions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {courses.map((c) => {
                        const row = progress.competencies[c.competency.id];
                        return row ? (
                          <tr key={c.competency.id}>
                            <th scope="row">{c.competency.title}</th>
                            <td>{row.correct}</td>
                            <td>{row.incorrect}</td>
                            <td>{row.unassessable}</td>
                            <td>{row.assessed_sessions}</td>
                          </tr>
                        ) : null;
                      })}
                    </tbody>
                  </table>
                </div>
                <p>{progress.limitation}</p>
              </>
            )}
          </details>
          <details className="panel academy-course-contracts">
            <summary>Course sources, assessment limits and Crew scope</summary>
            <p>
              Catalog {catalogue.version} ·{" "}
              <code>{catalogue.catalog_hash}</code>. This navigator uses
              existing frozen lessons and seed 62147. Repeated preparations may
              repeat a scenario; changing forms alone does not prove semantic
              novelty, retention or transfer.
            </p>
            <p>{catalogue.limitation}</p>
            {catalogue.competencies.map((c) => (
              <article key={c.id}>
                <h3>
                  {c.id} · {c.title}
                </h3>
                <p>{c.claim}</p>
                <p>
                  {c.scope === "crew"
                    ? "Coordination contract reserved for the separate Crew curriculum; no individual assessment is inferred."
                    : c.limitation}
                </p>
              </article>
            ))}
          </details>
        </>
      ) : (
        <p>
          No individual competency journey is available in this catalog. Crew
          records are not used as individual lessons.
        </p>
      )}
      <p className="footnote">
        Illustrative curriculum, not operational certification. Structural form
        balance is not empirical difficulty equivalence, fairness or
        demonstrated human learning benefit.
      </p>
    </main>
  );
}
