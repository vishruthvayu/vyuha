import { useEffect, useState } from "react";
import {
  currentCapture,
  startDiagnostics,
  stopDiagnostics,
} from "./diagnostics";
import { download } from "./storage";
export default function PerformanceDiagnostics() {
  const [revision, refresh] = useState(0);
  useEffect(() => {
    const update = () => refresh((n) => n + 1);
    window.addEventListener("vyuha-diagnostics", update);
    return () => window.removeEventListener("vyuha-diagnostics", update);
  }, []);
  const capture = currentCapture();
  return (
    <details
      className="panel advanced-card"
      data-diagnostic-revision={revision}
    >
      <summary>Local performance diagnostics</summary>
      <p>
        Optional, local-only timing for startup, optics and interaction. No
        actions, callsigns, input text or sensor truth are recorded. Collection
        stops after four minutes; nothing is uploaded.
      </p>
      <p role="status">
        {!capture
          ? "Not recording"
          : capture.stopped
            ? "Capture stopped; ready to export"
            : "Recording local timings"}
      </p>
      <div className="advanced-nav">
        <button
          className="button"
          onClick={() => startDiagnostics()}
          disabled={!!capture && !capture.stopped}
        >
          Start timing capture
        </button>
        <button
          className="button"
          onClick={stopDiagnostics}
          disabled={!capture || capture.stopped}
        >
          Stop timing capture
        </button>
        <button
          className="button"
          disabled={!capture}
          onClick={() => {
            stopDiagnostics();
            if (capture)
              download(
                "VYUHA-local-timings.json",
                capture.report(performance.now()),
              );
          }}
        >
          Export local timings
        </button>
      </div>
      <p>
        For first-load measurement, explicitly{" "}
        <a href="/?diagnostics=1">open Training with timing enabled</a>. Keep
        the same graphics tier, viewport and workload when comparing. Frame
        intervals are not GPU time or physical headset FPS.
      </p>
    </details>
  );
}
