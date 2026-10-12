import { useEffect, useRef, useState } from "react";
import { isAvailable } from "./useModalFocus";
export const tourStops = [
  {
    title: "Adaptive Director",
    text: "Four training skills feed the next drill from persistent verified outcomes. Open Training Ground and select Adaptive / Skill practice to see profile, focus and conditions.",
    href: "/?mode=adaptive",
    target: "#director-profile",
  },
  {
    title: "Training Ground",
    text: "Combine radar, RF, IFF and visual evidence before classifying and responding. NEXT shows the current decision step.",
    href: "/",
    target: ".sensor-workspace",
  },
  {
    title: "Instructor Control",
    text: "Session-scoped commands change a running exercise. Server receipt and trainee application are shown separately.",
    href: "/instructor",
    target: ".instructor-controls",
  },
  {
    title: "Ghost + Time Machine",
    text: "Open a completed session from Unit Overview. Verified reconstruction shows available evidence, decisions and configured reference rules. Replay cameras change observation only.",
    href: "/unit",
    target: ".replay-panel",
  },
  {
    title: "Unit Analytics",
    text: "Repeated sessions feed four-skill history and scenario × skill observations, with explicit sample counts.",
    href: "/analytics#scenario-skill",
    target: "#scenario-skill",
  },
  {
    title: "System Evidence",
    text: "Measured validation results and limitations are visible. Dedicated physical WAN-disconnected validation was not performed before submission.",
    href: "/system/evidence",
    target: "#system-evidence",
  },
];
export function tourTransition(
  index: number | null,
  action: "start" | "next" | "previous" | "skip",
  storage: Pick<Storage, "setItem">,
) {
  if (action === "start") return 0;
  if (action === "skip") return null;
  if (index == null) return null;
  if (action === "previous") return Math.max(0, index - 1);
  if (index === tourStops.length - 1) {
    try {
      storage.setItem("tour_completed", "true");
    } catch {}
    return null;
  }
  return index + 1;
}
export function startTour() {
  window.dispatchEvent(new Event("vyuha-start-tour"));
}
export default function CapabilityTour() {
  const [index, setIndex] = useState<number | null>(null);
  const card = useRef<HTMLElement>(null),
    launch = useRef<HTMLButtonElement>(null);
  const [completed, setCompleted] = useState(() => {
    try {
      return localStorage.getItem("tour_completed") === "true";
    } catch {
      return false;
    }
  });
  const open = index !== null;
  useEffect(() => {
    const start = () => setIndex(0);
    window.addEventListener("vyuha-start-tour", start);
    return () => window.removeEventListener("vyuha-start-tour", start);
  }, []);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    card.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        card.current?.contains(event.target as Node)
      ) {
        event.preventDefault();
        setIndex(null);
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      if (
        previous &&
        previous !== document.body &&
        previous.isConnected &&
        isAvailable(previous)
      )
        previous.focus();
      else launch.current?.focus();
    };
  }, [open]);
  useEffect(() => {
    if (index == null) return;
    const el = document.querySelector(tourStops[index].target);
    el?.classList.add("tour-highlight");
    return () => el?.classList.remove("tour-highlight");
  }, [index]);
  function move(action: "start" | "next" | "previous" | "skip") {
    let storage: Pick<Storage, "setItem">;
    try {
      storage = localStorage;
    } catch {
      storage = { setItem: () => {} };
    }
    const next = tourTransition(index, action, storage);
    if (action === "next" && index === tourStops.length - 1) setCompleted(true);
    setIndex(next);
  }
  return (
    <>
      <button
        ref={launch}
        className="tour-launch"
        aria-expanded={open}
        aria-controls={open ? "capability-tour" : undefined}
        onClick={() => move("start")}
      >
        {completed ? "Replay tour" : "Start tour"}
      </button>
      {index !== null && (
        <aside
          ref={card}
          id="capability-tour"
          tabIndex={-1}
          className="tour-card panel"
          role="region"
          aria-label="Optional capability tour"
        >
          <div className="eyebrow">
            CAPABILITY TOUR · {index + 1} / {tourStops.length} · ABOUT 40
            SECONDS
          </div>
          <div aria-live="polite" aria-atomic="true">
            <h2>{tourStops[index].title}</h2>
            <p>{tourStops[index].text}</p>
            <span className="sr-only">
              Step {index + 1} of {tourStops.length}
            </span>
          </div>
          <a
            href={tourStops[index].href}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open the real workspace{" "}
            <span className="sr-only">(opens in a new tab)</span>↗
          </a>
          <div className="control-buttons">
            <button
              onClick={() => move("previous")}
              disabled={index === 0}
              title={index === 0 ? "You are at the first stop." : undefined}
            >
              Previous
            </button>
            <button onClick={() => move("next")}>
              {index === tourStops.length - 1 ? "Finish tour" : "Next"}
            </button>
            <button onClick={() => move("skip")}>Skip / close</button>
          </div>
        </aside>
      )}
    </>
  );
}
