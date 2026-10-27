import { useEffect, useId, useRef, useState } from "react";
import { api } from "./storage";
import { newId } from "./unit-state";
import { preparationMatches } from "./academy-journey";
import type {
  LearningCatalogue,
  LearningPreparation,
  LearningReview,
} from "./learning";
import {
  nextTrainingBridgeSeed,
  preferredTrainingBridgeItem,
  trainingBridgeCandidates,
  trainingBridgePaths,
  type TrainingBridgePath,
} from "./training-bridge";
type Props = {
  review: LearningReview;
  learner?: { sessionId: string; trainee: string };
  onInspectDecision?: (id: string) => void;
};
export default function TrainingBridge(props: Props) {
  return (
    <RehearsalPath
      key={JSON.stringify([
        props.learner?.sessionId,
        props.learner?.trainee,
        props.review.evidence?.original_review_hash,
        props.review.context.catalog_hash,
        props.review.context.item_id,
        props.review.context.mode,
        props.review.context.assistance,
        props.review.context.seed,
      ])}
      {...props}
    />
  );
}
function RehearsalPath({ review, learner, onInspectDecision }: Props) {
  let paths: TrainingBridgePath[] = [],
    projectionError = "";
  try {
    paths = trainingBridgePaths(review);
  } catch (failure) {
    projectionError = (failure as Error).message;
  }
  const [chosen, setChosen] = useState("");
  const [caseLimit, setCaseLimit] = useState(20);
  const path = paths.find((p) => p.competencyId === chosen) ?? paths[0];
  const [catalogue, setCatalogue] = useState<LearningCatalogue | null>(null),
    [itemId, setItemId] = useState("");
  const [prepared, setPrepared] = useState<LearningPreparation | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const epoch = useRef(0),
    pending = useRef(false),
    request = useRef<{ key: string; id: string } | null>(null);
  const headingId = useId();
  useEffect(
    () => () => {
      epoch.current++;
    },
    [],
  );
  let candidates: ReturnType<typeof trainingBridgeCandidates> = [],
    catalogError = "";
  if (path && catalogue)
    try {
      candidates = trainingBridgeCandidates(catalogue, path.competencyId);
    } catch (failure) {
      catalogError = (failure as Error).message;
    }
  const item =
    candidates.find((i) => i.id === itemId) ??
    (path
      ? preferredTrainingBridgeItem(
          candidates,
          review.context.item_id,
          path.priority,
        )
      : undefined);
  function discard() {
    epoch.current++;
    pending.current = false;
    setBusy(false);
    setPrepared(null);
    setError("");
  }
  async function loadCatalogue() {
    if (!learner || pending.current) return;
    const active = ++epoch.current;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const value = await api<LearningCatalogue>("/learning/catalogue");
      if (epoch.current !== active) return;
      if (path) trainingBridgeCandidates(value, path.competencyId);
      setCatalogue(value);
    } catch (failure) {
      if (epoch.current === active)
        setError((failure as Error).message || "Practice catalog unavailable.");
    } finally {
      if (epoch.current === active) {
        pending.current = false;
        setBusy(false);
      }
    }
  }
  async function prepare() {
    if (!learner || !catalogue || !item || !path || pending.current) return;
    const active = ++epoch.current;
    pending.current = true;
    setBusy(true);
    setError("");
    setPrepared(null);
    try {
      const seed = nextTrainingBridgeSeed(review.context.seed);
      const key = JSON.stringify([
        learner.sessionId,
        learner.trainee,
        review.evidence!.original_review_hash,
        catalogue.catalog_hash,
        item.id,
        seed,
      ]);
      if (request.current?.key !== key) request.current = { key, id: newId() };
      const dispatchedId = request.current.id;
      const value = await api<LearningPreparation>("/learning/prepare", {
        request_id: dispatchedId,
        trainee: learner.trainee,
        mode: "practice",
        item_id: item.id,
        seed,
      });
      if (epoch.current !== active) return;
      if (
        !preparationMatches(value, catalogue, "practice", item) ||
        value.context.seed !== seed ||
        value.preparation_id !== dispatchedId
      )
        throw new Error(
          "Preparation differs from the selected rehearsal. No launch was accepted. Reload the current catalog before trying again.",
        );
      setPrepared(value);
    } catch (failure) {
      if (epoch.current === active)
        setError(
          (failure as Error).message ||
            "Preparation unavailable. Original evidence is unchanged.",
        );
    } finally {
      if (epoch.current === active) {
        pending.current = false;
        setBusy(false);
      }
    }
  }
  if (projectionError)
    return (
      <p role="status">
        {projectionError} Original review remains available below.
      </p>
    );
  if (!path) return null;
  return (
    <section className="training-bridge" aria-labelledby={headingId}>
      <header>
        <p className="eyebrow">
          ORIGINAL DECISION → RECONSTRUCTION → NEXT EPISODE
        </p>
        <h4 id={headingId}>Build your next rehearsal from this evidence</h4>
        <p>
          Choose a source decision, reconstruct its information boundary, then
          deliberately prepare a practice episode. This is an explainable
          navigation aid, not a proficiency model.
        </p>
      </header>
      <nav
        aria-label="Evidence-led rehearsal paths"
        className="training-bridge-paths"
      >
        {paths.map((p) => (
          <button
            key={p.competencyId}
            className="button subtle"
            aria-pressed={p === path}
            onClick={() => {
              discard();
              setChosen(p.competencyId);
              setCaseLimit(20);
              setItemId("");
            }}
          >
            <strong>{p.competencyId}</strong>
            <span>
              {p.priority === "reconsider"
                ? "Reconstruct a decision"
                : p.priority === "seek_evidence"
                  ? "Explore an evidence gap"
                  : "Extend supported practice"}
            </span>
          </button>
        ))}
      </nav>
      <div className="training-bridge-route">
        <section
          className="training-bridge-original"
          aria-label="Source decisions for rehearsal"
        >
          <h5>1 · Reconstruct the original moment</h5>
          <p>{path.explanation}</p>
          <p className="training-bridge-votes">
            Original contact/competency votes: {path.counts.correct} supported ·{" "}
            {path.counts.incorrect} incorrect · {path.counts.unassessable}{" "}
            unassessable. Repeated decisions are not extra credit.
          </p>
          <ol>
            {path.cases.slice(0, caseLimit).map((source) => (
              <li key={source.decisionId}>
                <div>
                  <strong>{source.decisionId}</strong>
                  <time>T+{(source.tick / 30).toFixed(2)} s</time>
                </div>
                <p>
                  {source.verdict === "correct"
                    ? "Supported"
                    : source.verdict === "unassessable"
                      ? "Unassessable"
                      : "Incorrect"}{" "}
                  · {source.reason.replaceAll("_", " ").toLowerCase()}
                </p>
                {onInspectDecision && (
                  <button
                    className="button subtle"
                    onClick={() => onInspectDecision(source.decisionId)}
                  >
                    Inspect original {source.decisionId}
                  </button>
                )}
              </li>
            ))}
          </ol>
          {path.cases.length > caseLimit && (
            <button
              className="button subtle"
              onClick={() => setCaseLimit((v) => v + 20)}
            >
              Show more source decisions ({path.cases.length - caseLimit}{" "}
              remaining)
            </button>
          )}
          <small>
            Bound to original review{" "}
            {review.evidence!.original_review_hash.slice(0, 12)}. Later evidence
            does not replace this source.
          </small>
        </section>
        <section
          className="training-bridge-next"
          aria-label="Next rehearsal preparation"
        >
          <h5>2 · Choose a deliberate next episode</h5>
          {!learner ? (
            <p>
              Officer review is read-only. The learner chooses their own next
              practice episode.
            </p>
          ) : (
            <>
              {!catalogue && (
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => void loadCatalogue()}
                >
                  Find current practice episodes
                </button>
              )}
              {catalogue && (
                <>
                  {catalogue.catalog_hash !== review.context.catalog_hash && (
                    <p role="status">
                      The published catalog has changed. New practice uses the
                      current catalog; this original review retains its frozen
                      catalog and evidence.
                    </p>
                  )}
                  {catalogError ? (
                    <p role="alert">{catalogError}</p>
                  ) : item ? (
                    <>
                      <label>
                        Practice episode
                        <select
                          value={item.id}
                          onChange={(event) => {
                            discard();
                            setItemId(event.target.value);
                          }}
                        >
                          {candidates.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.title} ·{" "}
                              {i.assistance === "full"
                                ? "Supported"
                                : "Less guided"}
                              {i.id === review.context.item_id
                                ? " · repeat source item"
                                : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                      <p className="training-bridge-objective">
                        {item.objective}
                      </p>
                      <ul>
                        {item.instructions.map((instruction, index) => (
                          <li key={index}>{instruction}</li>
                        ))}
                      </ul>
                      <p>
                        {item.id === review.context.item_id
                          ? "This repeats the source catalog item with a new seed."
                          : "This is a different catalog item for the same competency, with a new seed."}{" "}
                        It is practice, not a held-out assessment or
                        demonstrated transfer.
                      </p>
                      <button
                        className="button primary"
                        disabled={busy}
                        onClick={() => void prepare()}
                      >
                        Prepare selected rehearsal
                      </button>
                    </>
                  ) : (
                    <p>
                      No individual practice item is published for this
                      competency. Continue in Academy when a suitable item is
                      available.
                    </p>
                  )}
                  <button
                    className="button subtle"
                    disabled={busy}
                    onClick={() => {
                      discard();
                      setCatalogue(null);
                      request.current = null;
                    }}
                  >
                    Reload current practice catalog
                  </button>
                </>
              )}
              {busy && (
                <p role="status">
                  Loading the selected rehearsal. Training will not start
                  automatically.
                </p>
              )}
              {error && (
                <p role="alert">
                  {error} Original score and evidence are unchanged. Retry
                  preserves the same preparation request.
                </p>
              )}
              {prepared && (
                <div className="training-bridge-ready" role="status">
                  <strong>
                    Frozen rehearsal ready · {prepared.scenario.title}
                  </strong>
                  <p>
                    Open the prepared episode, review its briefing, then
                    explicitly Start.
                  </p>
                  <a
                    className="button primary"
                    href={`/?mode=adaptive&learning=${encodeURIComponent(prepared.preparation_id)}`}
                  >
                    Open this rehearsal
                  </a>
                </div>
              )}
            </>
          )}
        </section>
      </div>
      <p className="footnote">
        Rehearsal selection never changes original actions, scores, competency
        votes or individual skill profiles. Assessment and controlled
        retention/transfer protocols remain separate.
      </p>
    </section>
  );
}
