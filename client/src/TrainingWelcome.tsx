import { ArrowRight, ShieldCheck } from "lucide-react";
/** A briefing over contact-free world scenery. Preparation and Start are still
 * explicit App transactions, never actions caused by camera animation. */
export function TrainingWelcome({
  onPrepare,
  busy = false,
  prepared = false,
  title = "Enter the observation station.",
  label = "Prepare adaptive drill",
  duration,
  contacts,
}: {
  onPrepare?: () => void;
  busy?: boolean;
  prepared?: boolean;
  title?: string;
  label?: string;
  duration?: number;
  contacts?: number;
} = {}) {
  return (
    <div className="training-welcome mission-briefing">
      <div className="briefing-copy">
        <p className="eyebrow">
          {prepared ? "MISSION BRIEFING · READY" : "VYUHA / SYNTHETIC TRAINING"}
        </p>
        <h2>{title}</h2>
        <p>
          {prepared
            ? "Observe the available cues. Designate, identify and choose your own response. Not every contact is a threat."
            : "Step into a synthetic environment. Read the sensor picture, investigate uncertainty and make the decision."}
        </p>
        {prepared && (
          <p className="briefing-facts">
            {contacts !== undefined ? `${contacts} contacts · ` : ""}
            {duration !== undefined ? `${duration} seconds · ` : ""}Frozen
            exercise
          </p>
        )}
        {onPrepare && (
          <button
            className="button primary briefing-launch"
            disabled={busy}
            onClick={onPrepare}
          >
            {busy ? "Preparing your exercise…" : label}
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        )}
        <span className="briefing-integrity">
          <ShieldCheck size={14} aria-hidden="true" />
          Simulation time starts only with Start.
        </span>
        <p className="preparation-context">
          {prepared
            ? "Contact-free environment preview · not sensor evidence"
            : "Orientation scenery · your frozen exercise loads after preparation"}
        </p>
      </div>
      <ol className="briefing-journey" aria-label="Training journey">
        <li>
          <b>01</b>Observe
        </li>
        <li>
          <b>02</b>Investigate
        </li>
        <li>
          <b>03</b>Decide
        </li>
        <li>
          <b>04</b>Reconstruct
        </li>
      </ol>
    </div>
  );
}
