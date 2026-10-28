import { createPortal } from "react-dom";
import {
  useEffect,
  useCallback,
  useId,
  useRef,
  useState,
  type ReactNode,
  type PointerEvent,
} from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Crosshair,
  ScanEye,
  Columns2,
  Bookmark,
  X,
} from "lucide-react";
import type { SensorObservation, SensorPosition } from "./sensors-v2";
import type { Vision } from "./visibility";
import {
  boundedAim,
  draggedOpticalAim,
  reportedAim,
  scopedAim,
  type OpticalAim,
} from "./optical-station";
import {
  captureInquiryMoment,
  compareInquiryMoments,
  type InquiryMoment,
  type InquiryReading,
} from "./inquiry-evidence";
import { opticalFov } from "./render-contacts";
const at = (tick: number) => `${(tick / 30).toFixed(2)}s`;
const names = { eo: "EO", ir: "IR", radar: "RADAR", rf: "RF", iff: "IFF" };
function Reading({ reading }: { reading: InquiryReading }) {
  return (
    <div className={`inquiry-reading ${reading.status}`}>
      <strong>{reading.value}</strong>
      <span>
        {reading.sampleTick === null
          ? "Sample time not recorded"
          : `Sample ${at(reading.sampleTick)} · age ${at(reading.ageTicks!)}`}
      </span>
      <small>{reading.detail}</small>
    </div>
  );
}
/** Browser-only inspection workspace. No action, scoring, storage or network APIs.
 * Its children keep the existing authoritative scene/action composition mounted.
 */
export function OpticalStation({
  children,
  scopeId,
  enabled,
  tactical,
  selected,
  observation,
  cue,
  origin,
  tick,
  vision,
  zoom,
  onZoom,
  controlsHost,
  scanEnabled = true,
  onCompareOpen,
  onCompareClose,
}: {
  children: (view: {
    manualAim: OpticalAim | null;
    onCameraAim: (aim: OpticalAim) => void;
    scanSurface: {
      onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
      onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
      onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
      onPointerCancel: (event: PointerEvent<HTMLDivElement>) => void;
      onLostPointerCapture: () => void;
    };
    canScan: boolean;
  }) => ReactNode;
  scopeId: string;
  enabled: boolean;
  tactical: boolean;
  selected: string | null;
  observation?: SensorObservation;
  cue: SensorPosition | null;
  origin: SensorPosition;
  tick: number;
  vision: Vision;
  zoom: number;
  onZoom: (zoom: number) => void;
  controlsHost?: HTMLElement | null;
  scanEnabled?: boolean;
  onCompareOpen?: () => void;
  onCompareClose?: () => void;
}) {
  const [manual, setManual] = useState<{
      scopeId: string;
      aim: OpticalAim;
    } | null>(null),
    [captures, setCaptures] = useState<{
      scopeId: string;
      track: string;
      a: InquiryMoment | null;
      b: InquiryMoment | null;
    } | null>(null),
    [benchScope, setBenchScope] = useState<string | null>(null),
    [noticeState, setNoticeState] = useState<{
      scopeId: string;
      text: string;
    } | null>(null);
  const bench = benchScope === scopeId;
  const setBench = (open: boolean) => {
    if (open) onCompareOpen?.();
    setBenchScope(open ? scopeId : null);
  };
  const notice = noticeState?.scopeId === scopeId ? noticeState.text : "";
  const setNotice = (text: string) => setNoticeState({ scopeId, text });
  const owner = useRef({ scopeId, selected });
  owner.current = { scopeId, selected };
  const displayedAim = useRef<{ scopeId: string; aim: OpticalAim } | null>(
    null,
  );
  const onCameraAim = useCallback(
    (aim: OpticalAim) => {
      const safe = boundedAim(aim);
      if (safe && owner.current.scopeId === scopeId)
        displayedAim.current = { scopeId, aim: safe };
    },
    [scopeId],
  );
  const compareButton = useRef<HTMLButtonElement>(null);
  const benchElement = useRef<HTMLElement>(null);
  useEffect(() => {
    if (bench && enabled) {
      benchElement.current?.focus({ preventScroll: true });
      benchElement.current?.scrollIntoView?.({
        block: "nearest",
        behavior: "auto",
      });
    }
  }, [bench, enabled]);
  const closeBench = () => {
    setBench(false);
    onCompareClose?.();
    compareButton.current?.focus();
  };
  const headingId = useId();
  const manualAim = enabled && !tactical ? scopedAim(manual, scopeId) : null;
  const current =
    captures?.scopeId === scopeId && captures.track === selected
      ? captures
      : null;
  const a = current?.a ?? null,
    b = current?.b ?? null;
  const compare = a && b ? compareInquiryMoments(a, b) : null;
  const move = (azimuth: number, elevation: number) => {
    if (!enabled || tactical || owner.current.scopeId !== scopeId) return;
    const base =
      manualAim ??
      scopedAim(displayedAim.current, scopeId) ??
      reportedAim(cue, origin);
    if (!base) {
      setNotice(
        "Wait for the local camera to establish its displayed bearing.",
      );
      return;
    }
    const aim = boundedAim({
      azimuthDeg: base.azimuthDeg + azimuth,
      elevationDeg: base.elevationDeg + elevation,
    });
    if (aim) {
      setManual({ scopeId, aim });
      setNotice(
        "Manual scan. Selected contact and decision evidence are unchanged.",
      );
    }
  };
  const gesture = useRef<{
    scope: string;
    selected: string | null;
    pointer: number;
    x: number;
    y: number;
    width: number;
    height: number;
    fov: number;
    aim: OpticalAim;
  } | null>(null);
  const canScan = enabled && scanEnabled && !tactical && !bench;
  // Discard input ownership immediately, including exit/re-entry into the same scope.
  if (
    !canScan ||
    gesture.current?.scope !== scopeId ||
    gesture.current?.selected !== selected
  )
    gesture.current = null;
  const finishScan = (event: PointerEvent<HTMLDivElement>) => {
    if (gesture.current?.pointer !== event.pointerId) return;
    gesture.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const scanSurface = {
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      if (
        !canScan ||
        gesture.current ||
        event.button !== 0 ||
        (event.target as HTMLElement).tagName !== "CANVAS"
      )
        return;
      const aim =
        manualAim ??
        scopedAim(displayedAim.current, scopeId) ??
        reportedAim(cue, origin);
      const rect = (event.target as HTMLElement).getBoundingClientRect();
      if (!aim || rect.width <= 0 || rect.height <= 0) return;
      event.preventDefault();
      gesture.current = {
        scope: scopeId,
        selected,
        pointer: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        width: rect.width,
        height: rect.height,
        fov: opticalFov(38, zoom),
        aim,
      };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
      const g = gesture.current;
      if (
        !canScan ||
        !g ||
        g.pointer !== event.pointerId ||
        g.scope !== scopeId ||
        g.selected !== selected
      )
        return;
      const aim = draggedOpticalAim(
        g.aim,
        event.clientX - g.x,
        event.clientY - g.y,
        g.width,
        g.height,
        g.fov,
      );
      if (!aim) return;
      event.preventDefault();
      setManual({ scopeId, aim });
      setNotice(
        "Manual scan. Pointing changes only the display; report sampling and scoring are unchanged.",
      );
    },
    onPointerUp: finishScan,
    onPointerCancel: finishScan,
    onLostPointerCapture: () => {
      gesture.current = null;
    },
  };
  const capture = (slot: "a" | "b") => {
    if (
      !enabled ||
      owner.current.scopeId !== scopeId ||
      owner.current.selected !== selected
    )
      return;
    if (!selected) {
      setNotice("Select a currently reported contact first.");
      return;
    }
    const result = captureInquiryMoment(
      { scopeId, trackId: selected, tick },
      observation,
    );
    if (result.status !== "captured") {
      setNotice(result.reason);
      return;
    }
    setCaptures((previous) => ({
      scopeId,
      track: selected,
      a:
        previous?.scopeId === scopeId && previous.track === selected
          ? previous.a
          : null,
      b:
        previous?.scopeId === scopeId && previous.track === selected
          ? previous.b
          : null,
      [slot]: result.moment,
    }));
    setBench(true);
    setNotice(
      `Capture ${slot.toUpperCase()} saved for ${selected} at ${at(tick)}. Local ungraded report, not a recorded image.`,
    );
  };
  const controls = enabled && (
    <section
      className={`optical-console ${tactical ? "is-tactical" : ""}`}
      aria-label="Optical investigation station"
    >
      {!tactical && (
        <>
          <div className="optical-mode">
            <ScanEye size={15} />
            <strong>
              {manualAim
                ? "MANUAL SCAN"
                : selected
                  ? cue
                    ? "REPORT TRACK"
                    : "HOLDING BEARING"
                  : "SECTOR VIEW"}
            </strong>
            <span>
              {manualAim
                ? `${manualAim.azimuthDeg.toFixed(1)}° / ${manualAim.elevationDeg.toFixed(1)}°`
                : (selected ?? "No selection")}
            </span>
          </div>
          <div
            className="optical-slew"
            role="group"
            aria-label="Camera pan and tilt"
            onKeyDown={(event) => {
              const delta = event.shiftKey ? 10 : 2;
              const moves: { [key: string]: [number, number] } = {
                ArrowLeft: [-delta, 0],
                ArrowRight: [delta, 0],
                ArrowUp: [0, delta],
                ArrowDown: [0, -delta],
              };
              if (moves[event.key]) {
                event.preventDefault();
                move(...moves[event.key]);
              }
            }}
          >
            <button
              type="button"
              aria-label="Pan camera left"
              onClick={() => move(-5, 0)}
            >
              <ArrowLeft size={16} />
            </button>
            <button
              type="button"
              aria-label="Tilt camera up"
              onClick={() => move(0, 5)}
            >
              <ArrowUp size={16} />
            </button>
            <button
              type="button"
              aria-label="Tilt camera down"
              onClick={() => move(0, -5)}
            >
              <ArrowDown size={16} />
            </button>
            <button
              type="button"
              aria-label="Pan camera right"
              onClick={() => move(5, 0)}
            >
              <ArrowRight size={16} />
            </button>
            <button
              type="button"
              className="optical-reacquire"
              disabled={!manualAim}
              onClick={() => {
                setManual(null);
                setNotice(
                  "Automatic view follows only the selected reported position, or holds its last bearing.",
                );
              }}
            >
              <Crosshair size={15} />
              {selected ? "Track selected report" : "Return to sector"}
            </button>
          </div>
          <label className="optical-zoom">
            Crop {zoom}×
            <input
              type="range"
              aria-label="Optical station display crop"
              min="1"
              max="6"
              step="1"
              value={zoom}
              onChange={(e) => onZoom(Number(e.target.value))}
            />
            <small>
              {opticalFov(38, zoom).toFixed(1)}° vertical display FOV
            </small>
          </label>
        </>
      )}
      <div className="optical-capture">
        <button
          type="button"
          disabled={!selected || !observation}
          onClick={() => capture(a ? "b" : "a")}
        >
          <Bookmark size={15} />
          {a ? "Capture B" : "Capture A"}
        </button>
        <button
          type="button"
          ref={compareButton}
          aria-expanded={bench}
          onClick={() => setBench(!bench)}
        >
          <Columns2 size={15} />
          Evidence compare
        </button>
      </div>
      {canScan && (
        <p className="optical-scan-hint">
          Drag the scene to scan · arrow controls for keyboard · Track selected
          report to return
        </p>
      )}
      <p className="optical-integrity">
        {vision === "day" ? "EO" : "IR"} display · Pointing and crop do not
        change sensor sampling or scoring.
      </p>
      <p className="optical-notice" role="status">
        {notice}
      </p>
    </section>
  );
  return (
    <>
      {children({ manualAim, onCameraAim, scanSurface, canScan })}
      {controlsHost ? createPortal(controls, controlsHost) : controls}
      {enabled && bench && (
        <aside
          className="inquiry-bench"
          ref={benchElement}
          tabIndex={-1}
          aria-labelledby={headingId}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              closeBench();
            }
          }}
        >
          <header>
            <div>
              <span className="eyebrow">LOCAL INVESTIGATION / UNGRADED</span>
              <h2 id={headingId}>
                Compare evidence · {selected ?? "select a contact"}
              </h2>
            </div>
            <button
              type="button"
              aria-label="Close evidence comparison"
              onClick={closeBench}
            >
              <X size={18} />
            </button>
          </header>
          <p>
            Capture reports before and after a change. These are sensor-model
            reports, not images, gaze recordings or accepted actions. Captures
            stay in this workspace only.
          </p>
          <div className="inquiry-actions">
            <button
              type="button"
              disabled={!selected || !observation}
              onClick={() => capture("a")}
            >
              Capture / replace A
            </button>
            <button
              type="button"
              disabled={!selected || !observation}
              onClick={() => capture("b")}
            >
              Capture / replace B
            </button>
            <button
              type="button"
              disabled={!current}
              onClick={() => {
                setCaptures(null);
                setNotice(
                  "Local comparison cleared. Training evidence is unchanged.",
                );
              }}
            >
              Clear comparison
            </button>
          </div>
          <div
            className="inquiry-grid"
            role="table"
            aria-label="Captured channel reports"
          >
            <div role="row" className="inquiry-row inquiry-head">
              <span role="columnheader">Channel</span>
              {[a, b].map((m, i) => (
                <strong role="columnheader" key={i}>
                  {i ? "B" : "A"}
                  {m ? (
                    <>
                      <span>Captured {at(m.capturedTick)}</span>
                      <small>Report {at(m.reportTick)}</small>
                    </>
                  ) : (
                    <span>Not captured</span>
                  )}
                </strong>
              ))}
            </div>
            {(["eo", "ir", "radar", "rf", "iff"] as const).map((channel) => (
              <div className="inquiry-row" role="row" key={channel}>
                <strong role="rowheader">{names[channel]}</strong>
                {[a, b].map((m, i) => (
                  <div role="cell" key={i}>
                    {m ? (
                      <Reading
                        reading={m.readings.find((r) => r.channel === channel)!}
                      />
                    ) : (
                      <span className="inquiry-empty">No capture</span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
          {compare?.status === "comparable" && (
            <section
              className="inquiry-reasoning"
              aria-label="Evidence comparison questions"
            >
              <strong>{at(compare.elapsedTicks!)} between captures</strong>
              <p>
                {compare.channels
                  .filter((c) => c.change === "changed_report")
                  .map((c) => names[c.channel])
                  .join(", ") || "No comparable channel cue"}{" "}
                changed. A new timestamp alone is not an independent
                confirmation.
              </p>
              <ul>
                {compare.prompts.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </section>
          )}
          <p className="inquiry-warning">
            Unavailable ≠ negative. RF silence or no IFF reply does not
            establish hostile intent. Legacy records without channel provenance
            cannot be captured here.
          </p>
        </aside>
      )}
    </>
  );
}
