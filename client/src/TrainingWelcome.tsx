import { Crosshair, ScanEye, ShieldCheck, Waypoints } from "lucide-react";
export function TrainingWelcome() {
  return (
    <div className="training-welcome">
      <div className="training-welcome-symbol" aria-hidden="true">
        <Crosshair size={44} />
      </div>
      <p className="eyebrow">YOUR NEXT DECISION</p>
      <h2>Observe. Decide. Learn.</h2>
      <p>
        Prepare an adaptive raid built around your recorded skill evidence. Your
        sensor picture determines what you can act on.
      </p>
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
