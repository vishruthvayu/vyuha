import { Crosshair, ScanEye, ShieldCheck, Waypoints } from "lucide-react";
import { PreparationTerrain } from "./PreparationTerrain";
export function TrainingWelcome({
  onPrepare,
  busy = false,
}: { onPrepare?: () => void; busy?: boolean } = {}) {
  return (
    <div className="training-welcome">
      <PreparationTerrain />
      <div className="preparation-story">
        <p className="eyebrow">Adaptive decision training</p>
        <h2 className="display">
          Read the picture.
          <br />
          <em>Own the decision.</em>
        </h2>
        <p>
          Prepare an adaptive raid built around your recorded skill evidence.
          Your sensor picture determines what you can act on.
        </p>
        {onPrepare && (
          <button
            className="button primary"
            disabled={busy}
            onClick={onPrepare}
          >
            {busy ? "Preparing your exercise…" : "Prepare adaptive drill"}
          </button>
        )}
        <p className="preparation-context">
          Illustrated setting · no sensor contacts. Your frozen exercise loads
          after preparation.
        </p>
      </div>
      <ol className="training-loop">
        <li>
          <ScanEye aria-hidden="true" />
          <strong>Observe</strong>
          <span>Read current sensor cues</span>
        </li>
        <li>
          <Crosshair aria-hidden="true" />
          <strong>Decide</strong>
          <span>Designate, identify, respond</span>
        </li>
        <li>
          <ShieldCheck aria-hidden="true" />
          <strong>Verify</strong>
          <span>Server reconstructs your decisions</span>
        </li>
        <li>
          <Waypoints aria-hidden="true" />
          <strong>Adapt</strong>
          <span>Review the evidence and train again</span>
        </li>
      </ol>
      <p className="footnote">
        Choose a legacy or saved exercise in Drill settings. Training estimates
        are illustrative; they do not certify operational competence.
      </p>
    </div>
  );
}
