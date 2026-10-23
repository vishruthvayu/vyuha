import { useEffect, useRef, useState } from "react";
import { PageHeader } from "./UI";
import { api } from "./storage";
import { newId, type UnitIdentity } from "./unit-state";
import type { LearningCatalogue, LearningPreparation } from "./learning";
import { LearningBanner } from "./LearningEvidence";
type Progress = {
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
export default function Academy({ identity }: { identity?: UnitIdentity }) {
  const trainee = identity?.trainee_id ?? "CADET-01";
  const [catalogue, setCatalogue] = useState<LearningCatalogue | null>(null),
    [progress, setProgress] = useState<Progress | null>(null),
    [selected, setSelected] = useState(""),
    [form, setForm] = useState("baseline-a"),
    [prepared, setPrepared] = useState<LearningPreparation | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const scope = useRef(0),
    request = useRef<{ key: string; id: string } | null>(null);
  useEffect(() => {
    const active = ++scope.current;
    setPrepared(null);
    setProgress(null);
    void Promise.all([
      api<LearningCatalogue>("/learning/catalogue"),
      api<Progress>(
        `/learning/trainees/${encodeURIComponent(trainee)}/progress`,
      ),
    ])
      .then(([c, p]) => {
        if (active !== scope.current) return;
        setCatalogue(c);
        setSelected(
          c.items.find(
            (i) => i.audience === "individual" && i.pool === "practice",
          )?.id ?? "",
        );
        setProgress(p);
      })
      .catch((e) => {
        if (active === scope.current) setError(e.message);
      });
    return () => {
      scope.current++;
    };
  }, [trainee]);
  async function prepare(mode: "practice" | "assessment" | "adaptive") {
    const active = scope.current,
      key = JSON.stringify([
        trainee,
        mode,
        mode === "practice"
          ? selected
          : mode === "assessment"
            ? form
            : "coverage",
      ]);
    if (request.current?.key !== key) request.current = { key, id: newId() };
    setBusy(true);
    setError("");
    setPrepared(null);
    try {
      const p = await api<LearningPreparation>("/learning/prepare", {
        request_id: request.current.id,
        trainee,
        mode,
        seed: 62147,
        ...(mode === "practice"
          ? { item_id: selected }
          : mode === "assessment"
            ? { form }
            : {}),
      });
      if (active === scope.current) setPrepared(p);
    } catch (e) {
      if (active === scope.current)
        setError(e instanceof Error ? e.message : "Preparation unavailable");
    } finally {
      if (active === scope.current) setBusy(false);
    }
  }
  const item = catalogue?.items.find((i) => i.id === selected);
  return (
    <main className="page academy-page">
      <PageHeader
        eyebrow="LEARN / PRACTISE / REVIEW"
        title="Academy"
        description="Build evidence through focused lessons, then test independently. Practice, assessment and shared crew records stay distinct."
      />
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <p className="footnote">
        Illustrative curriculum, not operational certification. Forms have
        structural balance checks; empirical difficulty, fairness and human
        learning gains remain unvalidated.
      </p>
      {catalogue ? (
        <>
          <section className="panel">
            <h2>1 · Focused practice</h2>
            <label>
              Lesson
              <select
                value={selected}
                onChange={(e) => {
                  setSelected(e.target.value);
                  setPrepared(null);
                }}
                disabled={busy}
              >
                {catalogue.items
                  .filter(
                    (i) => i.audience === "individual" && i.pool === "practice",
                  )
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.title} · {i.assistance} guidance
                    </option>
                  ))}
              </select>
            </label>
            {item && (
              <>
                <p>{item.objective}</p>
                <ol>
                  {item.instructions.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ol>
                <p>Reflection: {item.reflection}</p>
              </>
            )}
            <div className="advanced-nav">
              <button
                className="button"
                disabled={busy || !selected}
                onClick={() => void prepare("practice")}
              >
                Prepare selected lesson
              </button>
              <button
                className="button"
                disabled={busy}
                onClick={() => void prepare("adaptive")}
              >
                Prepare coverage-first practice
              </button>
            </div>
            <p>
              Adaptive practice chooses under-observed competencies using a
              frozen, inspectable heuristic. It has no demonstrated learning
              efficacy.
            </p>
          </section>
          <section className="panel">
            <h2>2 · Independent assessment</h2>
            <label>
              Assessment form
              <select
                value={form}
                onChange={(e) => {
                  setForm(e.target.value);
                  setPrepared(null);
                }}
                disabled={busy}
              >
                {[
                  ["baseline-a", "Baseline A"],
                  ["immediate-b", "Immediate B"],
                  ["retention-c", "Retention C"],
                  ["transfer-d", "Transfer D"],
                ].map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <p>
              One seeded item per attempt; assistance is disabled. Use a
              registered protocol for timed retention/transfer comparisons;
              choosing a form here alone does not establish a controlled study.
            </p>
            <button
              className="button"
              disabled={busy}
              onClick={() => void prepare("assessment")}
            >
              Prepare assessment item
            </button>
          </section>
          {prepared && (
            <section className="panel" aria-label="Prepared Academy attempt">
              <h2>Ready to train</h2>
              <LearningBanner preparation={prepared} />
              <p>{prepared.scenario.title}</p>
              <a
                className="button"
                href={`/?mode=adaptive&learning=${encodeURIComponent(prepared.preparation_id)}`}
              >
                Open prepared training
              </a>
              <button
                className="button subtle"
                onClick={() => {
                  request.current = null;
                  setPrepared(null);
                }}
              >
                Prepare another attempt
              </button>
            </section>
          )}
          <section className="panel">
            <h2>3 · Evidence coverage</h2>
            {progress ? (
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
                    <caption>Individual assessment coverage</caption>
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
                      {Object.entries(progress.competencies).map(([id, c]) => (
                        <tr key={id}>
                          <th scope="row">
                            {catalogue.competencies.find((x) => x.id === id)
                              ?.title ?? id}
                          </th>
                          <td>{c.correct}</td>
                          <td>{c.incorrect}</td>
                          <td>{c.unassessable}</td>
                          <td>{c.assessed_sessions}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p>{progress.limitation}</p>
                <a href="/?view=aar">Open Ghost review</a>
              </>
            ) : (
              <p>Loading original-server evidence…</p>
            )}
          </section>
          <details className="panel">
            <summary>Competency contracts and limits</summary>
            {catalogue.competencies.map((c) => (
              <article key={c.id}>
                <h3>
                  {c.id} · {c.title}
                </h3>
                <p>{c.claim}</p>
                <p>
                  {c.scope === "crew"
                    ? "Coordination contract reserved for the later Crew curriculum; no individual assessment is inferred."
                    : c.limitation}
                </p>
              </article>
            ))}
          </details>
        </>
      ) : (
        <p role="status">Loading local curriculum…</p>
      )}
    </main>
  );
}
