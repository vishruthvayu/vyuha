import { useEffect, useRef, type ReactNode } from "react";
import {
  Eye,
  ListFilter,
  Radio,
  ScanEye,
  Crosshair,
  ArrowLeft,
} from "lucide-react";
import type { SimulationInstrument } from "./simulation-instruments";

export type SelectedReportSummary = {
  id: string;
  current: boolean;
  reportTick: number;
  rangeM: number | null;
  declaration: string | null;
  rf: string;
  iff: string;
};
const instruments = [
  { id: "observe", label: "Observe", name: "Observe world", icon: Eye },
  { id: "radar", label: "Radar", name: "Open radar picture", icon: Radio },
  {
    id: "reports",
    label: "Reports",
    name: "Browse reported contacts",
    icon: ListFilter,
  },
  {
    id: "evidence",
    label: "Evidence",
    name: "Inspect selected evidence",
    icon: ScanEye,
  },
  {
    id: "decide",
    label: "Decide",
    name: "Open decision station",
    icon: Crosshair,
  },
] as const;
/** One persistent world with deliberate instruments, not a second simulation.
 * Children retain their workers, forms and sensor selectors across view changes. */
export default function SimulationWorkstation({
  view,
  onView,
  phase,
  selected,
  reportCount,
  children,
  guidance,
}: {
  view: SimulationInstrument;
  onView: (view: SimulationInstrument) => void;
  phase: string;
  selected: SelectedReportSummary | null;
  reportCount: number;
  children: ReactNode;
  guidance?: string | null;
}) {
  const root = useRef<HTMLElement>(null),
    observe = useRef<HTMLButtonElement>(null);
  const priorView = useRef(view);
  useEffect(() => {
    if (priorView.current === view) return;
    priorView.current = view;
    if (view === "observe") {
      if (!root.current?.querySelector(".inquiry-bench"))
        observe.current?.focus({ preventScroll: true });
    } else {
      const selector =
        view === "reports"
          ? ".right-panels"
          : view === "evidence"
            ? ".decision-evidence"
            : view === "decide"
              ? ".decision-workspace"
              : ".radar-panel";
      root.current
        ?.querySelector<HTMLElement>(selector)
        ?.focus({ preventScroll: true });
    }
  }, [view]);
  const ready = phase === "ready" || phase === "restoring";
  return (
    <section
      ref={root}
      className="simulation-workstation"
      data-instrument={view}
      data-station-phase={phase}
      aria-label="Interactive simulation workstation"
      onKeyDown={(event) => {
        if (
          event.key !== "Escape" ||
          view === "observe" ||
          event.defaultPrevented ||
          (event.target as HTMLElement).closest(
            '[role="dialog"],[aria-modal="true"]',
          )
        )
          return;
        event.preventDefault();
        event.stopPropagation();
        onView("observe");
      }}
    >
      {!ready && (
        <>
          <div className="station-instrument-bar">
            <div className="station-phase-context">
              <span className="eyebrow">OBSERVATION STATION</span>
              <strong>
                {phase === "paused"
                  ? "Exercise paused"
                  : "Read the reported picture"}
              </strong>
            </div>
            <nav aria-label="Simulation instruments">
              {instruments.map(({ id, label, name, icon: Icon }) => (
                <button
                  ref={id === "observe" ? observe : undefined}
                  key={id}
                  aria-label={name}
                  aria-pressed={view === id}
                  onClick={() => onView(id)}
                >
                  <Icon size={17} aria-hidden="true" />
                  <span>
                    {label}
                    {id === "reports" ? ` · ${reportCount}` : ""}
                  </span>
                </button>
              ))}
            </nav>
          </div>
          {view !== "observe" && (
            <div className="station-instrument-heading">
              <div>
                <span>
                  {view === "reports"
                    ? "REPORTED CONTACTS"
                    : view === "evidence"
                      ? "AVAILABLE EVIDENCE"
                      : view === "decide"
                        ? "EXPLICIT TRAINEE DECISION"
                        : "REPORTED RADAR PICTURE"}
                </span>
                <strong>
                  {selected
                    ? `${selected.id} · ${selected.current ? "current report" : "last report only"}`
                    : "No contact selected"}
                </strong>
              </div>
              <button onClick={() => onView("observe")}>
                <ArrowLeft size={16} aria-hidden="true" />
                Back to observation
              </button>
            </div>
          )}
        </>
      )}
      <div className="training-grid">{children}</div>
      {!ready && (
        <footer
          className="station-selection-bar"
          aria-label="Selected report context"
        >
          <div className="station-selection-id">
            <span
              className={`station-report-dot ${selected?.current ? "current" : "stale"}`}
              aria-hidden="true"
            />
            <div>
              <small>
                {selected
                  ? selected.current
                    ? "CURRENTLY REPORTED"
                    : "STALE REPORT · NOT A CURRENT DETECTION"
                  : "NO REPORT SELECTED"}
              </small>
              <strong>{selected?.id ?? "Observe the sector"}</strong>
            </div>
          </div>
          {selected ? (
            <>
              <dl>
                <div>
                  <dt>Range</dt>
                  <dd>
                    {selected.rangeM === null
                      ? "Unavailable"
                      : `${Math.round(selected.rangeM)} m`}
                  </dd>
                </div>
                <div>
                  <dt>RF link</dt>
                  <dd>{selected.rf}</dd>
                </div>
                <div>
                  <dt>IFF</dt>
                  <dd>{selected.iff}</dd>
                </div>
              </dl>
              <p>
                {guidance ||
                  (selected.declaration
                    ? `Your declaration: ${selected.declaration}`
                    : "Type and identity remain your decision.")}
                {!selected.current &&
                  ` Last report T+${(selected.reportTick / 30).toFixed(2)}s.`}
              </p>
              <button
                className="station-primary-action"
                onClick={() =>
                  onView(view === "decide" ? "evidence" : "decide")
                }
              >
                {view === "decide"
                  ? "Inspect evidence"
                  : `Decide on ${selected.id}`}
                <Crosshair size={17} aria-hidden="true" />
              </button>
            </>
          ) : (
            <>
              <p>
                {guidance ??
                  "Select a reported contact on the radar or open Reports. A clear sky is not evidence of absence."}
              </p>
              <button
                className="station-primary-action"
                onClick={() => onView("reports")}
              >
                Browse reports
                <ListFilter size={17} aria-hidden="true" />
              </button>
            </>
          )}
        </footer>
      )}
    </section>
  );
}
