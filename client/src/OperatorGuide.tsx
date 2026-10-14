import { useRef, useState } from "react";
import { useModalFocus } from "./useModalFocus";
import { X } from "lucide-react";
import { startTour } from "./CapabilityTour";
export const guideSteps = [
  {
    title: "Prepare your exercise",
    text: "Prepare an adaptive raid, inspect its focus and conditions, then start. Drill settings also opens saved exercises or legacy Night Watch.",
  },
  {
    title: "Observe and designate",
    text: "Select a radar marker or contact, then open Evidence and decisions. Designation records when you detected it; timing starts at the first working-sensor observation.",
  },
  {
    title: "Classify with evidence",
    text: "Compare visual cues, RF-link evidence and IFF before choosing contact type and identity. A missing IFF reply alone does not establish hostile intent.",
  },
  {
    title: "Choose your response",
    text: "Hold on birds and friendlies. Check response range and restrictions. RF jamming cannot stop a no-RF FPV; an accepted response may still fail to resolve a contact.",
  },
  {
    title: "Review, then adapt",
    text: "End the exercise and check verification status. Ghost explains the evidence and score. Replay a decision, compare a separate reference run, then train with a different seed.",
  },
];
export default function OperatorGuide({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLElement>(null);
  const [step, setStep] = useState(0);
  useModalFocus(dialog, true, onClose);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        ref={dialog}
        className="guide-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-title"
        aria-describedby="guide-purpose"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="modal-close"
          aria-label="Close operator guide"
          onClick={onClose}
        >
          <X size={20} aria-hidden="true" />
        </button>
        <div className="eyebrow">
          OPERATOR GUIDE · {step + 1} / {guideSteps.length}
        </div>
        <h2 id="guide-title">Your first adaptive drill</h2>
        <p id="guide-purpose">
          Five practical steps. Choose a step or follow them in order.
        </p>
        <nav className="guide-progress" aria-label="Training guide steps">
          {guideSteps.map((item, index) => (
            <button
              key={item.title}
              aria-label={`Step ${index + 1}: ${item.title}`}
              aria-pressed={step === index}
              onClick={() => setStep(index)}
            >
              {index + 1}
            </button>
          ))}
        </nav>
        <div className="guide-step" aria-live="polite" aria-atomic="true">
          <h3>{guideSteps[step].title}</h3>
          <p>{guideSteps[step].text}</p>
        </div>
        <div className="guide-actions">
          <button
            className="button subtle"
            disabled={step === 0}
            onClick={() => setStep((value) => value - 1)}
          >
            Previous step
          </button>
          {step < guideSteps.length - 1 ? (
            <button
              className="button primary"
              onClick={() => setStep((value) => value + 1)}
            >
              Next step
            </button>
          ) : (
            <button className="button primary" onClick={onClose}>
              Ready to train
            </button>
          )}
          <button
            className="button subtle"
            onClick={() => {
              onClose();
              startTour();
            }}
          >
            Replay tour
          </button>
        </div>
        <p className="guide-caution">
          Values are illustrative training parameters. They do not represent
          operational doctrine.
        </p>
      </section>
    </div>
  );
}
