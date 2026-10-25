import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Settings2, X } from "lucide-react";
import { useModalFocus } from "./useModalFocus";
/** A phase-aware simulation station. Slots retain App's authoritative actions,
 * evidence selectors and worker ownership; this shell owns presentation only. */
export function TrainingDeck({
  mission,
  setup,
  tools,
  children,
  live,
  onSuspend,
}: {
  mission: ReactNode;
  setup: ReactNode;
  tools?: ReactNode;
  children: ReactNode;
  live: boolean;
  onSuspend: () => boolean;
}) {
  const [settings, setSettings] = useState(false);
  const [pausedOnOpen, setPausedOnOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const seenPaused = useRef(false);
  const dialog = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setSettings(false), []);
  useModalFocus(dialog, settings, close, ".deck-settings-toggle");
  useEffect(() => {
    if (!settings) return;
    if (!live) seenPaused.current = true;
    else if (seenPaused.current) {
      setSettings(false);
      setNotice(
        "Exercise resumed. Mission controls closed so the sensor view is available.",
      );
    }
  }, [live, settings]);
  return (
    <section className="training-deck" aria-label="Simulation station">
      <div className="deck-command-rail">
        {mission}
        {tools}
        <button
          className="deck-settings-toggle button subtle"
          aria-haspopup="dialog"
          aria-expanded={settings}
          onClick={() => {
            seenPaused.current = !live;
            if (live && !onSuspend()) {
              setNotice(
                "Mission controls are unavailable while the exercise initializes. Try again when the sensor view is ready.",
              );
              return;
            }
            setNotice("");
            setPausedOnOpen(live);
            setSettings(true);
          }}
        >
          <Settings2 size={16} aria-hidden="true" />
          Mission controls
        </button>
      </div>
      <p className="deck-control-notice" role="status">
        {notice}
      </p>
      {children}
      {settings && (
        <div className="deck-modal-scrim">
          <div
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="deck-settings-title"
            tabIndex={-1}
            className="deck-settings-dialog"
          >
            <header>
              <div>
                <p className="eyebrow">MISSION & DISPLAY</p>
                <h2 id="deck-settings-title">Mission controls</h2>
              </div>
              <button
                className="button subtle"
                onClick={close}
                aria-label="Close mission controls"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>
            {pausedOnOpen && (
              <p role="status">
                {live
                  ? "Pause requested. Waiting for the exercise state."
                  : "Exercise paused. Close this window, then use Resume. Instructor commands retain authority."}
              </p>
            )}
            {setup}
          </div>
        </div>
      )}
    </section>
  );
}
