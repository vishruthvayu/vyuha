import { useRef } from "react";
import { useModalFocus } from "./useModalFocus";
import { X } from "lucide-react";
import { startTour } from "./CapabilityTour";

export default function OperatorGuide({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLElement>(null);
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
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="modal-close"
          aria-label="Close operator guide"
          onClick={onClose}
        >
          <X size={20} />
        </button>
        <div className="eyebrow">OPERATOR GUIDE</div>
        <h2 id="guide-title">Your first adaptive drill</h2>
        <button
          className="button subtle"
          onClick={() => {
            onClose();
            startTour();
          }}
        >
          Replay tour
        </button>
        <p id="guide-purpose">
          Prepare an adaptive raid, inspect its focus and conditions, then
          start. Use Drill settings for saved exercises or the 75-second legacy
          Night Watch.
        </p>
        <ol>
          <li>
            <strong>Observe.</strong> Select a radar marker or contact. The
            EO/IR camera focuses on it.
          </li>
          <li>
            <strong>Designate.</strong> Detection time starts at the first
            working-sensor observation.
          </li>
          <li>
            <strong>Classify.</strong> Use the silhouette, RF-link evidence and
            IFF response to choose type and identity.
          </li>
          <li>
            <strong>Respond.</strong> Hold on birds and friendlies. Check the
            available evidence, response range and restrictions. RF jamming does
            not stop a no-RF FPV; accepted responses can still fail to resolve a
            contact.
          </li>
          <li>
            <strong>Review.</strong> Read the debrief, replay a decision, and
            repeat with a different seed.
          </li>
        </ol>
        <p>
          The original Night Watch has a radar gap at T+22–30s. Advanced and
          authored exercises use their own frozen conditions. Values are
          illustrative and do not represent operational doctrine.
        </p>
        <button className="button primary" onClick={onClose}>
          Ready to train
        </button>
      </section>
    </div>
  );
}
