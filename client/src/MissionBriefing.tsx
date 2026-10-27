import { useEffect, useId, useRef } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Compass,
  Minus,
  Plus,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import type { EpisodeBriefing } from "./episode-briefing";
import type { SurveyCommand } from "./world-survey";

export type MissionBriefingProps = {
  onPrepare?: () => void;
  busy?: boolean;
  prepared?: boolean;
  title?: string;
  label?: string;
  duration?: number;
  contacts?: number;
  environmentName: string;
  dayNight: string;
  objective?: string;
  instructions?: readonly string[];
  briefingUnavailable?: boolean;
  frozenEpisode?: EpisodeBriefing;
  availability?: {
    status: "loading" | "used" | "error";
    message: string;
    reviewUrl?: string;
  };
  assistance?: string;
  survey: boolean;
  onSurveyChange: (survey: boolean) => void;
  onSurveyCommand?: (command: SurveyCommand) => void;
};
const viewCommands = [
  ["left", "Turn view left", ArrowLeft],
  ["right", "Turn view right", ArrowRight],
  ["up", "Raise overview", ArrowUp],
  ["down", "Lower overview", ArrowDown],
  ["closer", "Move view closer", Plus],
  ["farther", "Move view farther", Minus],
  ["reset", "Reset environment view", RotateCcw],
] as const;
/** A task briefing and contact-free survey share one persistent explicit launch
 * control. Exploring, switching views or reading constraints cannot launch. */
export function MissionBriefing({
  onPrepare,
  busy = false,
  prepared = false,
  title = "Begin a training episode",
  label = "Prepare adaptive drill",
  duration,
  contacts,
  environmentName,
  dayNight,
  objective,
  instructions,
  briefingUnavailable = false,
  frozenEpisode,
  availability,
  assistance,
  survey,
  onSurveyChange,
  onSurveyCommand,
}: MissionBriefingProps) {
  const headingId = useId(),
    helpId = useId();
  const heading = useRef<HTMLHeadingElement>(null),
    surveyHeading = useRef<HTMLHeadingElement>(null);
  const previousSurvey = useRef(survey);
  useEffect(() => {
    if (previousSurvey.current !== survey) {
      previousSurvey.current = survey;
      (survey ? surveyHeading : heading).current?.focus({
        preventScroll: true,
      });
    }
  }, [survey]);
  return (
    <section
      className={`mission-briefing-next${survey ? " is-survey" : ""}`}
      aria-label="Mission briefing"
    >
      {!survey ? (
        <div className="mission-briefing-main">
          <p className="mission-briefing-eyebrow">
            {prepared ? "FROZEN EXERCISE / READY" : "TRAINING / ORIENTATION"}
          </p>
          <h2 ref={heading} tabIndex={-1} id={headingId}>
            {title}
          </h2>
          {frozenEpisode && (
            <p className="mission-briefing-competency">
              {frozenEpisode.competency_id} · {frozenEpisode.item_id}
            </p>
          )}
          {availability && (
            <div
              role={availability.status === "error" ? "alert" : "status"}
              className="mission-attempt-status"
            >
              <p>{availability.message}</p>
              {availability.reviewUrl && (
                <a href={availability.reviewUrl}>Open original review</a>
              )}
              <a href="/academy">Choose another Academy episode</a>
            </div>
          )}
          <p className="mission-briefing-objective">
            {availability
              ? "No new exercise will be started from this ticket."
              : objective ||
                (prepared
                  ? "Read the available reports, distinguish evidence from uncertainty, then make your own designation, classification and response decisions."
                  : "Prepare a repeatable exercise, orient yourself in its setting, then start when you are ready.")}
          </p>
          {briefingUnavailable && (
            <p role="note">
              Frozen lesson prose is unavailable for this preparation. The
              original exercise and assistance policy remain in force; no
              current-catalog instructions have been substituted.
            </p>
          )}
          {!!instructions?.length && (
            <details className="mission-briefing-constraints">
              <summary>Episode instructions</summary>
              <ol>
                {instructions.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ol>
            </details>
          )}
          {frozenEpisode && (
            <details className="mission-briefing-constraints">
              <summary>Frozen episode identity</summary>
              <dl className="mission-briefing-source">
                <dt>Catalog version</dt>
                <dd>{frozenEpisode.catalog_version}</dd>
                <dt>Catalog fingerprint</dt>
                <dd>{frozenEpisode.catalog_hash}</dd>
                <dt>Prepared scenario</dt>
                <dd>{frozenEpisode.scenario_id}</dd>
                <dt>Preparation</dt>
                <dd>{frozenEpisode.preparation_id}</dd>
              </dl>
            </details>
          )}
          <dl className="mission-briefing-facts">
            <div>
              <dt>Environment</dt>
              <dd>{environmentName}</dd>
            </div>
            <div>
              <dt>Conditions</dt>
              <dd>{dayNight}</dd>
            </div>
            {prepared && Number.isFinite(duration) && duration! > 0 && (
              <div>
                <dt>Exercise time</dt>
                <dd>{duration} seconds</dd>
              </div>
            )}
            {prepared && Number.isInteger(contacts) && contacts! >= 0 && (
              <div>
                <dt>Planned contacts</dt>
                <dd>{contacts}</dd>
              </div>
            )}
            {assistance && (
              <div>
                <dt>Learning support</dt>
                <dd>{assistance}</dd>
              </div>
            )}
          </dl>
          <details className="mission-briefing-constraints">
            <summary>Training boundaries</summary>
            <ul>
              <li>
                Only modeled sensor reports become observation evidence. A
                missing report does not establish an empty sky.
              </li>
              <li>
                Type, identity and response require explicit trainee decisions.
                Not every contact is a threat.
              </li>
              <li>
                Display and camera controls do not improve sensor resolution or
                change scoring.
              </li>
            </ul>
          </details>
        </div>
      ) : (
        <div className="mission-survey-note">
          <p className="mission-briefing-eyebrow">
            PUBLIC SCENERY / NO CONTACTS
          </p>
          <h2 ref={surveyHeading} tabIndex={-1}>
            Explore {environmentName}
          </h2>
          <p id={helpId}>
            Drag to orbit and scroll or pinch to change distance. This is a
            public environment preview, not a sensor observation. The exercise
            clock remains stopped.
          </p>
          {onSurveyCommand && (
            <div
              className="mission-survey-controls"
              role="group"
              aria-label="Environment survey camera"
              aria-describedby={helpId}
            >
              {viewCommands.map(([command, name, Icon]) => (
                <button
                  key={command}
                  title={name}
                  aria-label={name}
                  disabled={busy}
                  onClick={() => onSurveyCommand(command)}
                >
                  <Icon size={18} aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <footer className="mission-launch-bar">
        <div className="mission-launch-context">
          <ShieldCheck size={18} aria-hidden="true" />
          <div>
            <strong>
              {availability
                ? "Original attempt required"
                : prepared
                  ? "Ready for your explicit start"
                  : "Preparation comes before Start"}
            </strong>
            <p>
              {availability
                ? "The original attempt keeps its recorded scenario and evidence."
                : prepared
                  ? "The frozen exercise starts only when you choose Start."
                  : "Prepare freezes the exercise. You will then choose Start."}
            </p>
            <small>Contact-free scenery · not sensor evidence</small>
          </div>
        </div>
        <button
          className="mission-survey-toggle"
          disabled={busy}
          onClick={() => onSurveyChange(!survey)}
          aria-pressed={survey}
        >
          {survey ? (
            <ArrowLeft size={18} aria-hidden="true" />
          ) : (
            <Compass size={18} aria-hidden="true" />
          )}
          {survey ? "Return to briefing" : "Explore environment"}
        </button>
        <button
          className="mission-launch-action"
          disabled={busy || !onPrepare}
          onClick={onPrepare}
        >
          {busy
            ? prepared
              ? "Starting exercise…"
              : "Preparing your exercise…"
            : label}
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      </footer>
    </section>
  );
}
